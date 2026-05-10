# Production Monitoring Checklist — SitePilot Backend

**Branch:** `claude/audit-backend-database-R4noy`  
Date: 2026-05-10

---

## Pre-Deploy Verification

### Environment Variables

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` set (Railway PostgreSQL)
- [ ] `JWT_SECRET` ≥ 32 chars, unique, not a default value
- [ ] `JWT_REFRESH_SECRET` ≥ 32 chars, different from `JWT_SECRET`
- [ ] `CORS_ORIGIN` set to exact frontend URL (not `*`)
- [ ] `JWT_EXPIRES_IN=15m`
- [ ] `JWT_REFRESH_EXPIRES_IN=7d`
- [ ] `THROTTLE_TTL=60000`
- [ ] `THROTTLE_LIMIT=100`

### Generate secrets

```bash
# JWT_SECRET
openssl rand -base64 48

# JWT_REFRESH_SECRET (must be different)
openssl rand -base64 48
```

---

## Health Endpoint Monitoring

**Endpoint:** `GET /health`

### What to alert on

| Condition | Alert level | Action |
|-----------|-------------|--------|
| `status` = `'degraded'` | CRITICAL | Database unreachable — check Railway PostgreSQL |
| `diagnostics.database.latencyMs` > 100 | WARNING | DB slow — check connection pool, region |
| `diagnostics.memory.heapUsedMb` > 400 | WARNING | Memory pressure — check for leaks |
| `diagnostics.memory.rssMb` > 600 | CRITICAL | Near container memory limit |
| HTTP 5xx from `/health` | CRITICAL | App crashed or panicked |
| Railway healthcheck fails 3× | CRITICAL | Container killed and restarted |

### External uptime monitoring (Recommended)

Set up an external ping via:
- **Better Uptime** / **UptimeRobot** — free tier sufficient
- Poll `GET /health` every 60 seconds
- Alert if status ≠ 200 or `status` ≠ `'ok'`
- This catches Railway regional failures that internal Railway alerting may miss

---

## Log Monitoring

### Railway log viewer

1. Dashboard → your service → Logs
2. Filter by: `"level":"error"` to see only errors
3. Search by: `rid=<request-id>` to trace a specific request

### Recommended: external log aggregation

Ship Railway logs to an aggregator via **log drain** (Settings → Log Drain):

| Tool | Free tier | Search | Alerts |
|------|-----------|--------|--------|
| Logtail (Better Stack) | 1GB/mo | ✓ | ✓ |
| Datadog | 5GB/day trial | ✓ | ✓ |
| Grafana Loki (self-hosted) | Unlimited | ✓ | ✓ |
| Papertrail | 50MB/day | ✓ | ✓ |

With JSON logs from `AppLoggerService`, any of these can parse fields automatically.

### Key log queries to set up as saved searches

```
# All 5xx errors
level:error AND context:AllExceptionsFilter

# Slow requests (>1000ms) — if latency parsing supported
message:+1000ms

# Auth failures
message:401 AND message:/auth/login

# Database errors
message:"database" AND level:error
```

---

## Performance Baselines

Establish these baselines in the first week of production:

| Metric | Measure | Tool |
|--------|---------|------|
| p50/p95/p99 response time | `/health` latency + app routes | External monitor or Datadog APM |
| DB query latency | `diagnostics.database.latencyMs` from `/health` | Scrape periodically |
| Heap usage at idle | `diagnostics.memory.heapUsedMb` | Scrape `/health` every 5min |
| Heap usage under load | Load test with k6 or artillery | One-time |
| Requests per minute | Railway metrics | Dashboard |

---

## Error Tracking

### Current state

Errors are logged as JSON to stdout with stack traces. Visible in Railway logs and any connected log drain.

### Recommended: Sentry integration

```bash
npm install @sentry/nestjs @sentry/profiling-node
```

```typescript
// main.ts (before NestFactory.create)
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

Benefits:
- Issue grouping (same error across many requests = one issue)
- Release tracking (which deploy introduced the error)
- User context on errors
- Performance traces
- Alerts via email/Slack

---

## Rate Limit Monitoring

**Current:** In-memory throttler (single instance)

### What to monitor

- Railway metrics: HTTP 429 response count
- Sudden spike of 429s may indicate a brute-force attack or misconfigured client
- Log drain query: `message:429`

### When to upgrade to Redis throttler

Upgrade when Railway scales to ≥2 replicas. Until then, in-memory is sufficient.

```bash
npm install @nestjs/throttler @nestjs/throttler-storage-redis ioredis
```

---

## Incident Response Runbook

### Database unreachable (`status: 'degraded'`)

1. Check Railway PostgreSQL service status
2. Check `DATABASE_URL` env var is correct
3. Check Railway PostgreSQL usage limits (free tier has connection limits)
4. Check `retryAttempts` logs — TypeORM will retry 10× with 3s delay
5. If persistent: Railway dashboard → PostgreSQL → Restart

### High memory usage (heap > 400MB)

1. Check `/health` `diagnostics.memory` trend over time
2. Look for memory leak: heap growing steadily over hours without dropping
3. Restart the service (Railway dashboard) as immediate mitigation
4. Profile with `node --inspect` locally with production-like load
5. Common causes: unclosed DB connections, event listener leaks, large in-memory caches

### Sustained 5xx errors

1. Check Railway logs for stack traces: filter `level:error`
2. Note `rid` values — correlate with client-side error reports
3. Check for recent deployments (did it start after deploy?)
4. Rollback via Railway dashboard if cause is unclear
5. Check ENV vars — missing `JWT_SECRET` or `DATABASE_URL` causes immediate 500s

### Brute-force on `/auth/login`

1. Railway metrics: spike in 429 responses
2. Current mitigation: ThrottlerGuard (10 req/60s per IP at login)
3. If IP changes (distributed attack): escalate to Cloudflare WAF or Railway IP allowlist
4. Increase `THROTTLE_LIMIT` env var to make throttle stricter (no deploy needed, just env change + restart)

---

## Scaling Readiness Checklist

- [ ] Replace in-memory throttler with Redis storage
- [ ] Set TypeORM pool size: `extra: { max: 10 }` in TypeOrmModule config
- [ ] Add `@nestjs/bull` + Redis for background jobs (email, webhooks)
- [ ] Configure Railway horizontal scaling (requires Redis throttler first)
- [ ] Set up OpenTelemetry for distributed tracing across services
- [ ] Add Prometheus `/metrics` endpoint for scraping
- [ ] Configure Railway autoscaling thresholds (CPU > 70%, memory > 80%)
