# Backend Observability Plan

## Currently Implemented

### Request ID Propagation
- `RequestIdMiddleware` generates UUID v4 per request (or echoes client-supplied `X-Request-Id`)
- `AllExceptionsFilter` includes `requestId` in every error response
- `LoggingInterceptor` logs method, URL, status, duration, and requestId for every request

### Structured Error Responses
Every error follows the envelope:
```json
{
  "statusCode": 4xx | 5xx,
  "timestamp": "2026-05-11T12:00:00.000Z",
  "path": "/auth/register",
  "message": { "statusCode": 409, "message": "Email already registered", "error": "Conflict" },
  "requestId": "abc-123"
}
```
5xx errors in production replace `message` with `"Internal server error"` to avoid leaking internals.

### Startup Diagnostics
`AppModule` logs DB connection parameters and migration status at boot.
`HealthModule` (`GET /health`) returns:
```json
{
  "status": "ok",
  "database": "connected",
  "uptime": 42.3
}
```

---

## Gaps & Recommended Improvements

### 1. Structured JSON Logging (High Priority)

Current: NestJS `Logger` writes plain-text to stdout.
Recommended: Replace with [pino](https://getpino.io) or a Winston JSON transport.

```typescript
// Example pino setup
import pino from 'pino';
const logger = pino({ level: 'info' });

// Log every request as JSON
logger.info({ method, url, statusCode, durationMs, requestId }, 'request');
```

**Why**: Railway streams stdout to its log aggregation. JSON logs are indexable; plain-text is not.
**Impact**: Enables log filtering by `requestId`, `statusCode`, `userId` without grep.

### 2. Correlation ID Propagation to DB Queries

Current: TypeORM queries are not tagged with the `requestId`.
Recommended: Set `SET LOCAL app.request_id = $1` at the start of each transaction.

**Why**: Correlates slow-query logs with HTTP request traces.

### 3. Migration Startup Visibility

Current: Migrations run silently (TypeORM logs to console in development, suppressed in tests).
Recommended: Log each applied migration name + timestamp to a structured logger.

```typescript
const migrations = await ds.runMigrations({ transaction: 'each' });
migrations.forEach(m => logger.info({ migration: m.name }, 'migration applied'));
```

### 4. Health Check Expansion

Current: `GET /health` checks DB connectivity with a raw query.
Recommended: Add:
- `latencyMs`: time to complete the DB ping
- `version`: `package.json` version or git SHA
- `environment`: `NODE_ENV`

**Why**: Makes Railway deployment verification deterministic.

### 5. Request Duration Histogram

Current: `LoggingInterceptor` logs duration as a number but doesn't aggregate.
Recommended: Add Prometheus metrics via `@willsoto/nestjs-prometheus`:

```
http_request_duration_seconds_bucket{method="POST", route="/auth/login", status="200"}
```

**Why**: Enables alerting on p95 latency spikes.

### 6. Failed Login Audit Log

Current: Wrong-password attempts are silently rejected.
Recommended: Log `{ userId, ip, reason: 'wrong_password' | 'unknown_email' }` at `warn` level
for failed login attempts. Do NOT log the submitted password.

**Why**: Required for SOC 2 / ISO 27001 audit trails. Detects credential stuffing.

---

## Short-Term Action Items

| Priority | Item | Effort |
|----------|------|--------|
| High | JSON logging via pino | 1 day |
| High | Health check `latencyMs` + `version` | 2 hours |
| Medium | Failed login audit log | 2 hours |
| Medium | Migration startup logging | 1 hour |
| Low | Prometheus metrics | 2 days |
| Low | Request ID → DB correlation | 1 day |
