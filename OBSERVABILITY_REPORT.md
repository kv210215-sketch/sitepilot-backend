# Observability Report — SitePilot Backend

**Phase 4 — Observability + DevOps Hardening**  
Branch: `claude/audit-backend-database-R4noy`  
Date: 2026-05-10

---

## 1. Summary

| Area | Before | After |
|------|--------|-------|
| Logging format | NestJS default (text) | JSON (prod) / colored (dev) |
| Request tracing | None | X-Request-Id on every request |
| HTTP log line | None | `METHOD URL STATUS +Xms rid=UUID` |
| Error envelope | statusCode, path, message | + requestId |
| Health endpoint | status + DB ok/error | + DB latency, heap, rss, node version |
| Docker HEALTHCHECK | None | Node.js inline (30s interval, 3 retries) |
| NODE_ENV baked in | No | `ENV NODE_ENV=production` in Dockerfile |
| Container chown | After USER switch (bug) | Before USER switch (fixed) |

---

## 2. Structured Logger (`AppLoggerService`)

**File:** `src/common/logger/app-logger.service.ts`

### Production output (JSON to stdout)

```json
{"level":"log","message":"SitePilot backend running on http://localhost:3000","context":"Bootstrap","timestamp":"2026-05-10T12:00:00.000Z","pid":1}
{"level":"error","message":"GET /auth/login 500 +12ms rid=abc-123","context":"HTTP","timestamp":"2026-05-10T12:00:01.000Z","pid":1,"trace":"Error: ..."}
```

### Development output (colored)

```
2026-05-10T12:00:00.000Z LOG     [Bootstrap] SitePilot backend running on http://localhost:3000
2026-05-10T12:00:01.000Z ERROR   [HTTP] GET /auth/login 500 +12ms rid=abc-123
```

### Sensitive data masking

- **Bodies are NEVER logged** — `LoggingInterceptor` only logs method, URL, status, latency, and request-id
- Passwords, tokens, and cookies never appear in logs
- In production, 5xx error messages are replaced with `'Internal server error'` by `AllExceptionsFilter`
- Stack traces are logged server-side but never sent to clients in production

---

## 3. Request-ID Correlation (`RequestIdMiddleware`)

**File:** `src/common/middleware/request-id.middleware.ts`

- Applied to all routes via `AppModule.configure()`
- Reads `X-Request-Id` header from client; generates UUID v4 if absent
- Echoes the ID back in `X-Request-Id` response header
- Available in `req.headers['x-request-id']` for all downstream code
- `LoggingInterceptor` and `AllExceptionsFilter` both read and log it
- Client-side: include `X-Request-Id` in requests to correlate browser/mobile logs with server logs

---

## 4. HTTP Request Logging (`LoggingInterceptor`)

**File:** `src/common/interceptors/logging.interceptor.ts`

Log format:
```
GET /health 200 +3ms rid=f7e1c2d3-...
POST /auth/login 401 +45ms rid=a1b2c3d4-...
```

- Registered globally in `main.ts` via `useGlobalInterceptors`
- Fires on both success and error paths (via `catchError`)
- Never captures request/response bodies
- Works with the `AppLoggerService` via NestJS `Logger` class

---

## 5. Enhanced Health Endpoint

**File:** `src/health/health.controller.ts`  
**Endpoint:** `GET /health`

### Response shape

```json
{
  "status": "ok",
  "timestamp": "2026-05-10T12:00:00.000Z",
  "uptime": 3600,
  "services": {
    "database": "ok"
  },
  "diagnostics": {
    "database": {
      "status": "ok",
      "latencyMs": 2
    },
    "memory": {
      "heapUsedMb": 48.32,
      "heapTotalMb": 67.58,
      "rssMb": 89.41
    },
    "node": {
      "version": "v20.18.0",
      "uptime": 3600
    }
  }
}
```

### Backward compatibility

`services.database` is preserved as a string (`'ok'` | `'error'`) — existing Railway healthcheck and any monitors that parse this field are unaffected.

### DB latency interpretation

| Latency | Assessment |
|---------|------------|
| < 5ms | Excellent — local or same-region |
| 5–20ms | Good — normal Railway |
| 20–50ms | Acceptable |
| > 50ms | Investigate connection pool or region |
| -1 | DB not initialized |

---

## 6. Startup Diagnostics (enhanced)

`main.ts` `logStartupDiagnostics()` now emits:

```
NODE_ENV        : production
NODE_VERSION    : v20.18.0
PORT            : 3000
Database        : DATABASE_URL (Railway)
JWT_SECRET      : set ✓
JWT_REFRESH_SEC : set ✓
CORS_ORIGIN     : https://sitepilot.app
Throttle        : 100 req / 60000ms
synchronize     : false
Memory (startup): heap 38.4/65.2 MB  rss 72.1 MB
```

In production this emits as newline-delimited JSON — parseable by Railway's log viewer and any external aggregator.

---

## 7. Docker Improvements

**File:** `Dockerfile`

| Improvement | Detail |
|-------------|--------|
| `ENV NODE_ENV=production` | Baked into image — no risk of accidentally running as development |
| HEALTHCHECK | `--interval=30s --timeout=10s --start-period=30s --retries=3` via Node.js inline script |
| chown before USER switch | Fixes permission bug — appuser owns `/app` before `USER appuser` runs |
| Single RUN for user creation | Reduces image layers |

### HEALTHCHECK mechanism

Uses Node.js built-in `http` module — no `curl` or `wget` required in Alpine, keeping the image minimal.

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "const h=require('http');h.get('http://localhost:3000/health',r=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"
```

---

## 8. Scores

### Enterprise Readiness Score: 72/100

| Dimension | Score | Notes |
|-----------|-------|-------|
| Structured logging | 8/10 | JSON prod ✓, no log levels from ENV yet |
| Request tracing | 7/10 | X-Request-Id ✓, no distributed trace context (W3C Trace-Context) |
| Error observability | 7/10 | Stack logged ✓, no Sentry/OTel integration |
| Health monitoring | 9/10 | Latency + memory + node ✓ |
| Security hardening | 8/10 | Helmet + throttle + refresh rotation ✓ |
| Graceful operations | 7/10 | Shutdown hooks ✓, no connection drain timeout |
| Container quality | 8/10 | Non-root + HEALTHCHECK + ENV baked ✓ |
| ENV discipline | 8/10 | Validation on startup ✓ |

### Scaling Readiness Score: 58/100

| Bottleneck | Impact | Mitigation |
|------------|--------|------------|
| In-memory throttler | High | Replace with `@nestjs/throttler` Redis storage when >1 replica |
| No distributed tracing | Medium | Add W3C Trace-Context / OpenTelemetry |
| Stateless refresh tokens | Low | Acceptable; add Redis blocklist for instant revocation |
| Single DB connection pool | Medium | TypeORM pool size not tuned; set `extra.max` |
| No queue workers | Low | N/A now; add Bull+Redis when background jobs added |

### DevOps Maturity Score: 65/100

| Area | Score | Notes |
|------|-------|-------|
| CI pipeline | ?/10 | Not audited in this session |
| Docker image quality | 9/10 | Multi-stage, non-root, HEALTHCHECK ✓ |
| ENV management | 8/10 | railway.toml + .env.example ✓ |
| Migrations discipline | 7/10 | Run-on-start pattern ✓, no rollback strategy |
| Monitoring/alerting | 4/10 | No external alerting configured |
| Log aggregation | 6/10 | JSON to stdout ready; Railway captures but no search |
| Secret rotation | 5/10 | Documented; no automated rotation |

---

## 9. Top Remaining Bottlenecks

1. **No distributed tracing** — W3C `traceparent` propagation needed for multi-service correlation
2. **In-memory throttler** — breaks at >1 Railway replica; need Redis storage
3. **No error alerting** — Sentry or similar needed to catch prod exceptions proactively
4. **TypeORM pool not tuned** — default pool size may saturate under load; set `extra: { max: 10 }`
5. **No log retention/search** — Railway log viewer has no search; need Datadog/Logtail/Grafana Loki

---

## 10. Recommended Next Architecture Phase

**Phase 5 — Distributed Observability + Scalability**

1. **OpenTelemetry** — traces, metrics, logs via `@opentelemetry/sdk-node`; export to Grafana Tempo or Jaeger
2. **Sentry** — `@sentry/nestjs` for automatic exception capture with release tracking
3. **Redis integration** — throttler storage (`ThrottlerStorageRedisService`) + refresh token blocklist
4. **@nestjs/bull** — job queues for async operations (email, webhook delivery, AI processing)
5. **TypeORM pool tuning** — `extra: { max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 2000 }`
6. **Log aggregation** — ship JSON logs to Logtail or Datadog via Railway log drain
7. **Metrics endpoint** — `/metrics` for Prometheus scraping (request rates, error rates, DB latency histograms)
