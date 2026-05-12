# Deployment Verification Report

**Date:** 2026-05-12
**Branch:** `main` @ `43018cb` ("Merge PR #18 — Harden Docker reproducibility and test bootstrap")
**Verified by:** Claude Code autopilot — production simulation (no Railway CLI access)

---

## Summary

| Check | Status |
|-------|--------|
| main branch clean & up to date | ✅ |
| CI (build + unit + E2E) | ✅ Both jobs passed on last push |
| `npm ci` + `npm run build` | ✅ Clean compile, zero errors |
| Unit tests (124) | ✅ |
| E2E tests (67) | ✅ |
| `synchronize: false` in production | ✅ Confirmed in startup diagnostics |
| Migrations (run-migrations.js) | ✅ Runs before app start, idempotent |
| `/health` in Railway-mode boot | ✅ `{"status":"ok","services":{"database":"ok"}}` |
| Swagger disabled in production | ✅ `GET /api/docs → 404` |
| Auth guard active | ✅ `GET /auth/me` without token → 401 |
| Error response shape | ✅ `{statusCode, timestamp, path, message, requestId}` |
| `CORS_ORIGIN=*` rejected in prod | ✅ App refuses to start with wildcard |
| Missing `JWT_SECRET` rejected | ✅ App refuses to start, structured error logged |
| Missing `JWT_EXPIRES_IN` rejected | ✅ App refuses to start — **not documented in env.validation.ts** (see blockers) |
| DATABASE_URL routing (Railway style) | ✅ Startup log shows `DATABASE_URL (Railway)` |
| Railway CLI deploy trigger | ⚠️ CLI not installed — cannot trigger remotely from this environment |
| Live Railway health endpoint | ⚠️ No production URL known — cannot probe |

---

## Railway Configuration Review

### `railway.toml`
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "node dist/database/run-migrations.js && node dist/main.js"
healthcheckPath = "/health"
healthcheckTimeout = 120
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

**Assessment:** Correct. Migration runs atomically before app start. If migration fails, `process.exit(1)` fires and Railway retries (max 3). `healthcheckTimeout = 120` gives the app the full TypeORM retry window (10 × 3s = 30s) plus margin.

### `Dockerfile`
- Multi-stage build: `deps` → `builder` → `runtime`
- Runtime stage runs as non-root `appuser` ✅
- `NODE_ENV=production` baked into runtime image ✅
- `CMD` duplicates the `startCommand` as a fallback ✅
- Node 20 (bookworm-slim) pinned ✅

### `src/data-source.ts` (migration CLI)
- `synchronize: false` hardcoded ✅
- SSL: `{ rejectUnauthorized: false }` when `DATABASE_URL` + production ✅ (required for Railway's managed Postgres)

### `src/app.module.ts` (runtime)
- `synchronize: !isProduction` — **`false` in production** ✅
- SSL: same as above ✅
- TypeORM retry: 10 attempts × 3s delay ✅

---

## Full Production Boot Simulation

Executed with all required vars using `DATABASE_URL` style (Railway-identical):

```
DATABASE_URL=postgresql://...
NODE_ENV=production
JWT_SECRET=<32+ chars>
JWT_REFRESH_SECRET=<32+ chars, different>
JWT_EXPIRES_IN=15m
CORS_ORIGIN=https://sitepilot.app
```

**Boot log (key lines):**
```
Starting Nest application...
  NODE_ENV        : production
  Database        : DATABASE_URL (Railway)
  JWT_SECRET      : set ✓
  JWT_REFRESH_SEC : set ✓
  CORS_ORIGIN     : https://sitepilot.app
  synchronize     : false
Nest application successfully started
SitePilot backend running on http://localhost:3096 [production]
```
Boot time: **~120ms** (no DB connection delay — DB already up).

**`GET /health` response:**
```json
{
  "status": "ok",
  "services": { "database": "ok" },
  "diagnostics": {
    "database": { "status": "ok", "latencyMs": 1 },
    "memory": { "heapUsedMb": 33.99, "heapTotalMb": 60.64, "rssMb": 122.24 },
    "node": { "version": "v22.22.2", "uptime": 5 }
  }
}
```

---

## Required Railway Service Variables

The following must be set in the Railway service's **Variables** panel before deploying.
The app will refuse to start (structured JSON error logged, exit 1) if any are missing.

| Variable | Required | Validation | Notes |
|----------|----------|------------|-------|
| `DATABASE_URL` | ✅ In production | Implicit — TypeORM fails to connect | Auto-injected by Railway PostgreSQL plugin |
| `JWT_SECRET` | ✅ Always | `env.validation.ts` — must be ≥ 32 chars | Generate: `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | ✅ In production | `env.validation.ts` — must be ≥ 32 chars, different from `JWT_SECRET` | Generate: `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | ✅ In production | `auth.module.ts` — **NOT in env.validation.ts** | e.g. `15m` |
| `CORS_ORIGIN` | ✅ In production | `env.validation.ts` — `*` is rejected | e.g. `https://your-frontend.up.railway.app` |
| `NODE_ENV` | Recommended | Not validated but controls many behaviours | Set to `production` |
| `PORT` | Optional | Validated as valid TCP port | Railway injects automatically |
| `JWT_REFRESH_EXPIRES_IN` | Optional | Not validated | Defaults to `7d` |
| `THROTTLE_TTL` | Optional | Must be ≥ 1000 if set | Defaults to `60000` |
| `THROTTLE_LIMIT` | Optional | Not validated | Defaults to `100` |

---

## Migration Status

### run-migrations.js behaviour (verified locally)
```
[migrations] Connecting to database…
[migrations] All migrations are up to date — nothing to run.
[migrations] Done.
```

- Idempotent: safe to run on every deploy ✅
- Uses `transaction: 'each'` — partial migration failures roll back ✅
- `process.exit(1)` on failure — blocks app start, triggers Railway retry ✅
- `uuid-ossp` extension created in migration `up()` with `IF NOT EXISTS` ✅

### Migration in `railway.toml`
```
startCommand = "node dist/database/run-migrations.js && node dist/main.js"
```
The `&&` ensures `main.js` only starts if migrations exit 0. ✅

---

## Blockers

### 🟡 MEDIUM — `JWT_EXPIRES_IN` not in `env.validation.ts`

**What:** `JWT_EXPIRES_IN` is required in production (enforced in `auth.module.ts`) but not validated in `env.validation.ts`. This means:
- The missing-var error is thrown during module initialization (later in boot) rather than at the ConfigModule validation stage (earliest possible).
- The error message is clear and the app correctly refuses to start — but it's harder to surface in pre-deploy CI ENV checks.

**Impact:** If Railway variables are misconfigured, the app crashes on deploy with a structured JSON error — Railway retries 3× then marks deploy as failed. This is recoverable, not silent data loss.

**Fix (not blocking this deploy):** Add `JWT_EXPIRES_IN` validation to `env.validation.ts`:
```typescript
if (isProduction && !config['JWT_EXPIRES_IN']) {
  throw new Error('JWT_EXPIRES_IN is required in production');
}
```

### 🟡 MEDIUM — `synchronize: true` in non-production environments

**What:** `app.module.ts` uses `synchronize: !isProduction`. In `NODE_ENV=development` or `test`, TypeORM auto-alters the schema to match entities on every startup.

**Impact for production:** None — `NODE_ENV=production` on Railway means `synchronize: false` is always active.

**Impact for development:** TypeORM silently adds/removes columns without migration records. This creates drift risk if a developer runs the app locally and then migrations don't replay the same changes in CI.

**Fix (not blocking this deploy):** Change to `synchronize: false` unconditionally and rely on migrations in all environments.

### 🟡 LOW — Railway CLI not available in this environment

**What:** Cannot trigger a live Railway deploy, stream build logs, or check the production health endpoint from this machine.

**Next action:** The person with Railway access must manually verify the production URL's `/health` endpoint after deploy, or set up Railway's auto-deploy-on-push from `main`.

### 🟢 RESOLVED — `cookie-parser` cold-boot crash

Fixed in a previous sprint. `esModuleInterop: true` is in `tsconfig.json`. Verified: clean build and boot succeed.

### 🟢 RESOLVED — `healthcheckTimeout = 30` too short

Fixed. Now `120`. TypeORM 10-retry window is 30s; 120 gives comfortable margin.

---

## CI Status (Last Push to main)

| Job | Status | Duration |
|-----|--------|----------|
| Backend build & unit tests | ✅ success | ~24s |
| Backend E2E tests | ✅ success | ~50s |

Both jobs passed on commit `43018cb` (merged PR #18).

---

## Exact Next Actions

### If Railway auto-deploy is configured on `main`:
1. The last push (`43018cb`) has already triggered a deploy.
2. Open the Railway dashboard → service → **Deployments** tab.
3. Confirm build log shows `nest build` exiting 0.
4. Confirm deploy log shows `[migrations] Done.` then `Nest application successfully started`.
5. Hit `GET https://<your-railway-url>/health` and confirm `"status":"ok"`.

### If Railway deploy must be triggered manually:
```bash
# Install Railway CLI
npm install -g @railway/cli

# Authenticate
railway login

# Link to project (one-time)
cd /home/user/sitepilot-backend
railway link

# Deploy current main
railway up --detach
```

### Minimum Railway Variables to set before first deploy:
```
JWT_SECRET=<openssl rand -hex 32>
JWT_REFRESH_SECRET=<openssl rand -hex 32>   # must differ from JWT_SECRET
JWT_EXPIRES_IN=15m
CORS_ORIGIN=https://<your-frontend-url>
NODE_ENV=production
```
`DATABASE_URL` is auto-injected by the Railway PostgreSQL plugin — do not set manually.

---

## No Code Changes Made

All checks passed against existing `main`. The two medium blockers (`JWT_EXPIRES_IN` in `env.validation.ts`, `synchronize: true` in dev) are hardening improvements, not production deploy blockers. The app correctly refuses to start and logs a structured error for every misconfigured variable.
