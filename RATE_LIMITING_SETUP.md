# SitePilot Backend — Rate Limiting Setup

> **Package:** `@nestjs/throttler@6.x`  
> **Configured in:** `src/app.module.ts` (global) + `src/auth/auth.controller.ts` (route-level)

---

## How It Works

1. `ThrottlerModule` is configured globally in `AppModule` with ENV-driven defaults.
2. `ThrottlerGuard` is registered as a global `APP_GUARD` — all routes are throttled automatically.
3. Sensitive auth endpoints override the global limit with a stricter per-route `@Throttle` decorator.
4. The health endpoint uses `@SkipThrottle()` to remain always reachable.
5. **Trust proxy is enabled** (`trust proxy: 1`) so Railway's `X-Forwarded-For` is used for IP detection.

---

## Configuration

### ENV variables

| Variable | Default | Description |
|---|---|---|
| `THROTTLE_TTL` | `60000` | Rate limit window in **milliseconds** (60000 = 1 min) |
| `THROTTLE_LIMIT` | `100` | Max requests per IP per window |

These apply globally. Auth endpoints (login/register) are always hard-capped at **10 req/min** regardless.

### Railway production values (recommended)

```env
THROTTLE_TTL=60000
THROTTLE_LIMIT=200    # higher if you have many legitimate concurrent users
```

---

## Rate Limits by Endpoint

| Endpoint | Limit | Window | Rationale |
|---|---|---|---|
| `POST /auth/login` | 10 | 60s | Brute-force protection |
| `POST /auth/register` | 10 | 60s | Registration spam protection |
| `POST /auth/refresh` | 100 (global) | 60s | Normal refresh cadence |
| `GET /health` | Unlimited | — | Must always be reachable |
| All other routes | 100 (global) | 60s | Default protection |

---

## Response on Rate Limit Exceeded

When the limit is exceeded, the client receives:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60

{
  "statusCode": 429,
  "timestamp": "2026-05-10T10:00:00.000Z",
  "path": "/auth/login",
  "message": "ThrottlerException: Too Many Requests"
}
```

---

## Adding Custom Limits to New Endpoints

```typescript
import { Throttle, SkipThrottle } from '@nestjs/throttler';

// Override global limit for specific endpoint:
@Throttle({ default: { ttl: 60_000, limit: 5 } })
@Post('sensitive-action')
sensitiveAction() { ... }

// Skip throttling (use carefully — only for internal/infra endpoints):
@SkipThrottle()
@Get('internal-status')
internalStatus() { ... }
```

---

## Trust Proxy Configuration

```typescript
// src/main.ts
app.getHttpAdapter().getInstance().set('trust proxy', 1);
```

**Why this matters:** Without this, all requests behind Railway's proxy appear to
come from the same IP (the proxy's IP), defeating per-IP rate limiting.

With `trust proxy: 1`, Express reads the real client IP from `X-Forwarded-For`.

---

## Customizing Per-Route Throttle Names

If you need multiple throttle tiers (e.g., different limits for premium vs. free users),
configure named throttlers:

```typescript
// app.module.ts
ThrottlerModule.forRoot([
  { name: 'short', ttl: 1000,  limit: 3 },   // burst protection
  { name: 'medium', ttl: 10000, limit: 20 },  // sustained protection
  { name: 'long', ttl: 60000,  limit: 100 },  // hourly protection
])

// On a route:
@Throttle({ short: { limit: 1, ttl: 1000 } })
@Post('webhook')
```

---

## Testing Rate Limits Locally

```bash
# Should succeed (first 10 within 60s)
for i in {1..10}; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"test@test.com","password":"wrong"}'
done

# 11th request should return 429
curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@test.com","password":"wrong"}'
```

---

## Production Recommendations

| Scenario | Recommendation |
|---|---|
| High-traffic API | Increase `THROTTLE_LIMIT` to 200–500 |
| Public API with abuse | Add Redis-backed ThrottlerStorage |
| Multi-instance Railway | Add Redis storage (in-memory throttler is per-instance) |
| Mobile clients | Increase limits or use user-based throttling |

### Multi-instance throttling note

The default in-memory ThrottlerStorage is **not shared between instances**.
If Railway scales to multiple replicas, each instance has its own counter —
effective limit per user becomes `THROTTLE_LIMIT × instanceCount`.

For strict limits across instances:
```bash
npm install @nestjs/throttler ioredis
```
```typescript
import { ThrottlerStorageRedisService } from '@nestjs-throttler-storage-redis';
// Configure with your Redis URL
```
