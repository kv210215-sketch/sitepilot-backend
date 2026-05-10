# Logging Architecture — SitePilot Backend

**Branch:** `claude/audit-backend-database-R4noy`  
Date: 2026-05-10

---

## Architecture Overview

```
HTTP Request
     │
     ▼
┌─────────────────────────────┐
│   RequestIdMiddleware        │  Attaches X-Request-Id to req + res headers
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│   LoggingInterceptor         │  Logs METHOD URL STATUS +Xms rid=UUID
│   (pre-route)                │  — never logs bodies
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│   Route Handler              │  Business logic
└──────────────┬──────────────┘
               │
        ┌──────┴──────┐
        │ success     │ error
        ▼             ▼
 LoggingInterceptor   AllExceptionsFilter
 (tap — status OK)    (logs 5xx with stack + rid)
        │             │
        └──────┬──────┘
               ▼
      JSON Response to client
      (includes requestId on errors)
```

---

## Log Levels

| Level | When used | Example |
|-------|-----------|--------|
| `log` | Normal info events | Server started, request logged |
| `warn` | Non-critical issues | synchronize=true in dev |
| `error` | 5xx errors, fatal startup | Stack traces, missing secrets |
| `debug` | Dev-only detailed info | TypeORM query logs |
| `verbose` | Very detailed tracing | (reserved) |

In production, `debug` and `verbose` are suppressed by NestJS log level filtering.

---

## JSON Log Schema (Production)

Every log line is a single JSON object:

```typescript
{
  level: 'log' | 'error' | 'warn' | 'debug' | 'verbose';
  message: string;      // human-readable message
  context: string;      // NestJS context (class or label)
  timestamp: string;    // ISO 8601
  pid: number;          // process PID
  trace?: string;       // stack trace (error level only)
}
```

### HTTP log line example

```json
{"level":"log","message":"GET /health 200 +3ms rid=f7e1c2d3-4a5b-6c7d-8e9f-0a1b2c3d4e5f","context":"HTTP","timestamp":"2026-05-10T12:00:00.123Z","pid":1}
```

### Error log line example

```json
{"level":"error","message":"POST /auth/login 500 +12ms rid=abc-123","context":"AllExceptionsFilter","timestamp":"2026-05-10T12:00:01.456Z","pid":1,"trace":"TypeError: Cannot read properties of undefined...\n    at AuthService.login (auth.service.ts:42)"}
```

---

## Sensitive Data Policy

| Data type | In logs? | Enforcement |
|-----------|----------|-------------|
| Passwords | NEVER | LoggingInterceptor never logs request body |
| JWT tokens | NEVER | Same |
| Refresh cookies | NEVER | Same |
| Request body | NEVER | Same |
| Response body | NEVER | Same |
| User email | NEVER | Not included in log messages |
| Request headers | NEVER | Not included (only X-Request-Id used internally) |
| HTTP status codes | YES | Safe — part of the standard log line |
| URL paths | YES | Safe — no query params with secrets expected; document in API guidelines to avoid secrets in URLs |
| DB query errors | YES (5xx only) | Stack trace server-side only; never sent to client |

### Warning: URL query parameters

If any endpoint ever accepts secrets via query parameters (e.g. `?token=...`), the URL logged in `LoggingInterceptor` would expose them. Current API design does not use query-param secrets. Document this as a team constraint.

---

## Request Correlation Flow

```
Client sends request:
  GET /projects HTTP/1.1
  X-Request-Id: my-frontend-trace-id-123

Server processes:
  RequestIdMiddleware: accepts 'my-frontend-trace-id-123'
  LoggingInterceptor: GET /projects 200 +8ms rid=my-frontend-trace-id-123
  Response header: X-Request-Id: my-frontend-trace-id-123

Client receives response:
  HTTP/1.1 200 OK
  X-Request-Id: my-frontend-trace-id-123
  (frontend can log this ID alongside its own trace)

---

Client sends request without X-Request-Id:
  POST /auth/login HTTP/1.1

Server generates UUID:
  RequestIdMiddleware: generates f7e1c2d3-4a5b-6c7d-8e9f-0a1b2c3d4e5f
  LoggingInterceptor: POST /auth/login 401 +45ms rid=f7e1c2d3-...
  Response header: X-Request-Id: f7e1c2d3-...
```

---

## Files

| File | Role |
|------|------|
| `src/common/logger/app-logger.service.ts` | NestJS `LoggerService` implementation — JSON prod, colored dev |
| `src/common/middleware/request-id.middleware.ts` | X-Request-Id correlation middleware |
| `src/common/interceptors/logging.interceptor.ts` | HTTP request/response logger (no body) |
| `src/common/filters/all-exceptions.filter.ts` | Global exception filter with requestId in response |
| `src/app.module.ts` | Applies `RequestIdMiddleware` to all routes |
| `src/main.ts` | Registers `AppLoggerService` and `LoggingInterceptor` globally |

---

## Future: @nestjs/pino (Recommended Upgrade)

For high-throughput production workloads, replace `AppLoggerService` with `@nestjs/pino`:

```typescript
// main.ts
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger)); // from nestjs-pino
```

Benefits over current implementation:
- Async JSON serialization (non-blocking)
- Child loggers with automatic request context propagation (via `AsyncLocalStorage`)
- Automatic `req.id`, `res.statusCode`, `responseTime` in log objects
- Pino transports (pretty-print dev, file, Datadog, Loki)
- Benchmark: ~5× faster than `console.log` under load

Migration is non-breaking — same log structure, same `Logger` injection pattern.
