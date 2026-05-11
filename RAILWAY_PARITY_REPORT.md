# Railway Parity Report — SitePilot Backend

**Date:** 2026-05-11
**Branch:** `claude/audit-backend-database-R4noy`
**Scope:** Full comparison of local dev environment vs Railway production deployment

---

## 1. Executive Summary

| Parity Check | Status | Notes |
|---|---|---|
| Node.js version: Docker 20-alpine vs local v22 | ⚠️ MINOR DRIFT | Dockerfile targets Node 20; local runs Node 22 |
| `npm ci` deterministic from lockfile | ✅ PASS | Same lockfile used in Docker, CI, and local |
| `.npmrc` `legacy-peer-deps` in Docker | ✅ PASS | `.npmrc` explicitly COPY'd into builder stage |
| `NODE_ENV=production` in container | ✅ PASS | Baked via `ENV NODE_ENV=production` in Dockerfile |
| `synchronize: false` in container | ✅ PASS | Guaranteed by `NODE_ENV=production` guard |
| `.env` excluded from Docker image | ✅ PASS | `.dockerignore` covers `.env` and `.env.*` |
| `node_modules` excluded from Docker image | ✅ PASS | Multi-stage build; production stage does fresh `npm ci --omit=dev` |
| `dist` excluded from Docker image | ✅ PASS | Copied from builder stage, never from host |
| Non-root user in container | ✅ PASS | `appuser` with `appgroup`, chown before USER switch |
| Railway `DATABASE_URL` injection | ✅ PASS | App correctly branches on `DATABASE_URL` presence |
| Migration runs before app start | ✅ PASS | `startCommand` enforces order |
| Healthcheck path correct | ✅ PASS | `/health` matches `healthcheckPath` |
| Healthcheck timeout adequate | ⚠️ RISK | `healthcheckTimeout = 30` — should be 120 |
| SSL for DB connection on Railway | ✅ PASS | `{ rejectUnauthorized: false }` when prod + DATABASE_URL |
| Swagger disabled in production | ✅ PASS | `NODE_ENV=production` disables Swagger setup |
| CORS correctly restricted | ✅ PASS | Requires `CORS_ORIGIN` in prod; wildcard blocked by validation |
| Trust proxy enabled | ✅ PASS | `app.getHttpAdapter().getInstance().set('trust proxy', 1)` |
| `cookie-parser` CJS interop | ✅ FIXED | `esModuleInterop: true` added to tsconfig |
| JSON logging in production | ✅ PASS | `AppLoggerService` outputs newline-delimited JSON |

---

## 2. Node.js Version Matrix

| Environment | Node version | Source |
|---|---|---|
| Dockerfile (builder stage) | `node:20-alpine` | `FROM node:20-alpine AS builder` |
| Dockerfile (production stage) | `node:20-alpine` | `FROM node:20-alpine AS production` |
| Local developer machine | v22.22.2 | System installation |
| GitHub Actions (CI) | Not pinned | Uses runner default (typically latest LTS) |

### Drift assessment
Node 20 (Docker) vs Node 22 (local) is a **minor drift**. Node 20 is the current LTS; Node 22 is the next LTS. The code uses `ES2021` target in tsconfig with `module: commonjs`, which compiles down to syntax supported by both versions. No Node 20-specific APIs are used.

**No breaking differences observed** between Node 20 and 22 for this codebase.

**Recommended:** Pin CI to Node 20 to match Docker: `node-version: '20'` in `.github/workflows/ci.yml`.

---

## 3. Dockerfile Analysis

```dockerfile
# Builder stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json .npmrc ./   # ← .npmrc included for legacy-peer-deps
RUN npm ci                     # ← Full install with dev deps for build
COPY . .
RUN npm run build              # ← TypeScript compilation

# Production stage
FROM node:20-alpine AS production
ENV NODE_ENV=production        # ← Baked in — NOT runtime-dependent
WORKDIR /app
COPY package*.json .npmrc ./   # ← .npmrc again for production install
RUN npm ci --omit=dev && npm cache clean --force  # ← prod deps only
COPY --from=builder /app/dist ./dist   # ← Only compiled JS

# Security: non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app   # ← chown BEFORE USER switch ✅
USER appuser

EXPOSE 3000
HEALTHCHECK ...
CMD ["node", "dist/main"]  # ← App only — no migrations here
```

### Key strengths
- **Multi-stage:** dev dependencies never enter production image
- **Deterministic:** `npm ci` always, never `npm install`
- **`.npmrc` propagated:** `legacy-peer-deps=true` available in both stages
- **`NODE_ENV` baked in:** cannot be accidentally `undefined` in container
- **Non-root user:** security requirement met
- **chown before USER:** file ownership correct before privilege drop

### Note: CMD vs railway.toml startCommand
The Dockerfile `CMD` is `node dist/main` (no migrations).
Railway overrides this with `startCommand = "node dist/database/run-migrations && node dist/main"`.
The `CMD` serves as a safe fallback for `docker run` without Railway context.

---

## 4. railway.toml Analysis

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "node dist/database/run-migrations && node dist/main"
healthcheckPath = "/health"
healthcheckTimeout = 30          # ⚠️ SHOULD BE 120
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

### `startCommand` correctness
The sequence `run-migrations && main` guarantees:
1. Migrations are always applied before app starts
2. If migrations fail, app never starts (shell `&&` short-circuits)
3. Exit code propagated correctly

### `healthcheckTimeout = 30` — Risk Window

**Current timeline analysis:**
```
t=0s:   Container start
t=0s:   node dist/database/run-migrations
        → If DB not ready: exit(1)
        → Railway restart 1: t≈5s
        → If DB not ready: exit(1)
        → Railway restart 2: t≈10s
        → DB ready: SUCCESS
t=10s:  node dist/main
        → TypeORM connects (retryAttempts: 10, 3s each)
        → Worst case: all 10 retries → ready at t=40s
t=30s:  Railway healthcheck fires → app not ready → FAIL?
```

**Recommended:** Set `healthcheckTimeout = 120` to accommodate the 30s TypeORM retry window plus migration startup time.

### `restartPolicyMaxRetries = 3`
With the migration retry gap (no retry in `run-migrations`), 3 Railway-level restarts provide a ~30s DB wait window at the infrastructure level. Acceptable but fragile. Adding retry to `run-migrations` would eliminate this dependency.

---

## 5. Environment Variable Chain

### Production (Railway)

```
Railway Service Variables
    JWT_SECRET                      (set by operator)
    JWT_REFRESH_SECRET              (set by operator)
    JWT_EXPIRES_IN                  (set by operator)
    CORS_ORIGIN                     (set by operator)
    [optional] THROTTLE_TTL         (default: 60000)
    [optional] THROTTLE_LIMIT       (default: 100)
    [optional] PORT                 (default: 3000)

Railway PostgreSQL Plugin injects:
    DATABASE_URL                    (auto-injected — never set manually)

Docker image bakes:
    NODE_ENV=production             (via ENV in Dockerfile)
```

### Validation at startup
```
validateEnv() checks (ConfigModule load):
  JWT_SECRET          required, ≥32 chars
  JWT_REFRESH_SECRET  required in prod, ≥32 chars, ≠ JWT_SECRET
  CORS_ORIGIN         required in prod, cannot be '*'
  DB_HOST/etc.        required in prod if DATABASE_URL not set
  THROTTLE_TTL        numeric, ≥1000 if set
  PORT                numeric, 1–65535 if set

bootstrap() checks:
  JWT_EXPIRES_IN      required in prod (AuthModule factory)
  CORS_ORIGIN         not '*' in prod (getCorsOrigin())
```

All validation fails fast at startup with exit(1) — no partial-up state.

### Local development
```
.env file (from .env.example):
    NODE_ENV=development
    DB_HOST=localhost
    DB_PORT=5432
    DB_USER=sitepilot
    DB_PASSWORD=sitepilot
    DB_NAME=sitepilot
    JWT_SECRET=dev-local-secret-change-me-min-32-chars
    [JWT_REFRESH_SECRET optional — uses fallback in dev]
    [CORS_ORIGIN not required in dev]
```

`.env` is excluded from both Docker image (`.dockerignore`) and git (`.gitignore`). No leakage possible.

---

## 6. Database Connection Parity

| Aspect | Local | Railway |
|---|---|---|
| Connection method | `DB_HOST/PORT/USER/PASSWORD/NAME` | `DATABASE_URL` |
| SSL | Disabled | `{ rejectUnauthorized: false }` |
| `synchronize` | `true` (dev mode) | `false` (prod mode, baked) |
| Pool size | TypeORM default (10) | TypeORM default (10) |
| Retry on connect | `retryAttempts: 10`, `retryDelay: 3000` | Same |
| `uuid-ossp` | Must create extension manually (or via migration fix) | Pre-installed by Railway |
| Migration trigger | Manual: `npm run db:migrate:run` | Auto: `startCommand` pre-start |
| Schema creation | `synchronize: true` auto-creates on startup | Migrations only |

### uuid-ossp parity
After the migration fix (`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` added to `up()`):
- **Railway:** extension already exists → `IF NOT EXISTS` no-ops → ✅
- **Local fresh DB:** extension created by migration → ✅
- **Local existing DB (manual install):** `IF NOT EXISTS` no-ops → ✅

Fully portable. No environment-specific setup needed.

---

## 7. Security Headers Parity

| Header | Development | Production (Railway) |
|---|---|---|
| `Content-Security-Policy` | ❌ Disabled (for Swagger UI) | ✅ Enabled via Helmet |
| `X-Frame-Options` | ✅ via Helmet | ✅ via Helmet |
| `X-Content-Type-Options` | ✅ via Helmet | ✅ via Helmet |
| `Strict-Transport-Security` | Not set (HTTP dev) | ✅ Railway terminates TLS |
| `X-Powered-By` | ✅ Removed by Helmet | ✅ Removed by Helmet |
| CORS `credentials: true` | ✅ | ✅ |
| CORS wildcard `*` | Allowed in dev | ❌ Blocked by validateEnv |

---

## 8. Logging Parity

| Aspect | Development | Production (Railway) |
|---|---|---|
| Format | Colored text (`NestJS` style) | JSON, newline-delimited |
| Destination | stdout (log/warn), stderr (error) | stdout (all, including errors) |
| HTTP logs | `METHOD PATH STATUS +LAT rid=UUID` | Same format, as JSON field |
| Context field | Present | Present |
| Trace field | Only on error | Only on error |
| Railway log viewer | Not parseable | ✅ Each JSON line is one event |

Railway's log aggregator (LogDNA/Datadog integration) parses JSON natively. Each `\n`-terminated JSON object is one log event.

---

## 9. Local Dependency Leakage Audit

| Risk | Check | Result |
|---|---|---|
| Dev dependencies in production image | `npm ci --omit=dev` in production stage | ✅ Not present |
| Local `.env` in Docker image | `.dockerignore` includes `.env`, `.env.*` | ✅ Not present |
| `node_modules` from host in image | `.dockerignore` includes `node_modules` | ✅ Not present |
| `dist` from host in image | `.dockerignore` includes `dist` | ✅ Not present — built fresh |
| `.git` in image | `.dockerignore` includes `.git` | ✅ Not present |
| Test files in production image | `tsconfig.build.json` excludes `**/*.spec.ts` | ✅ Not compiled |
| Source TypeScript in production image | Only `dist/` copied from builder | ✅ Not present |
| `.npmrc` in image | Explicitly COPY'd | ✅ Required for `legacy-peer-deps` |

**No local dependency leakage.** The production image contains only: `dist/`, `package*.json`, `.npmrc`, and production `node_modules`.

---

## 10. CI/CD Pipeline Parity

### Current GitHub Actions (`.github/workflows/ci.yml`)
```yaml
# Runs: npm ci, build check, lint
# Does NOT: connect to DB, run migrations, run tests with secrets
```

**Gap:** Tests are not gated in CI. The test suite passes locally and on clean install but is not enforced before merge.

**Recommended CI gate:**
```yaml
- name: Test
  run: npm test
  env:
    NODE_ENV: test
    JWT_SECRET: ${{ secrets.CI_JWT_SECRET }}
    JWT_REFRESH_SECRET: ${{ secrets.CI_JWT_REFRESH_SECRET }}
```

Required secrets to add: `CI_JWT_SECRET` (any ≥32 char string), `CI_JWT_REFRESH_SECRET`.

### Node version pin recommendation
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'    # Match Dockerfile
    cache: 'npm'
```

---

## 11. Unresolved Items

| Item | Severity | Recommended Action |
|---|---|---|
| `healthcheckTimeout = 30` | MEDIUM | Change to 120 in `railway.toml` |
| No retry in `run-migrations` | MEDIUM | Add `connectWithRetry()` loop (see `COLD_BOOT_REPORT.md`) |
| CI does not run tests | MEDIUM | Add `npm test` step to CI workflow |
| Node 20 (Docker) vs 22 (local) | LOW | Pin CI to Node 20 |
| 23 npm audit vulnerabilities | LOW-MED | Audit which are in production deps vs devDeps; address `high` severities |
| Docker not available in test environment | INFO | All Docker verification done via static analysis + local NodeJS tests |

---

## 12. Overall Railway Compatibility Verdict

**COMPATIBLE — with 2 pre-deploy actions required:**

1. **Set `healthcheckTimeout = 120`** in `railway.toml` (currently 30)
2. **Set 5 Railway service variables:** `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EXPIRES_IN`, `CORS_ORIGIN`, and ensure PostgreSQL plugin is attached

Everything else is in order: `NODE_ENV=production` is baked in, `DATABASE_URL` is handled, migrations run before app starts, logging is Railway-compatible JSON, healthcheck path is correct, non-root user is configured.
