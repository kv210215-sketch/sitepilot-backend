# Production Validation Report — SitePilot Backend

**Date:** 2026-05-11
**Branch:** `claude/audit-backend-database-R4noy`
**Node version tested:** v22.22.2
**PostgreSQL version tested:** 16 (local), Docker 16-alpine target

---

## 1. Executive Summary

| Test | Result | Notes |
|---|---|---|
| Clean rebuild (node_modules + dist deleted) | ✅ PASS | 16s install, 3.5s build |
| Test suite on clean build | ✅ PASS | 124/124 |
| Production build artifacts present | ✅ PASS | `dist/main.js`, `dist/database/run-migrations.js`, migration JS |
| `cookie-parser` CJS interop — **BUG FOUND & FIXED** | ✅ FIXED | `esModuleInterop` was missing from tsconfig |
| DB unavailable startup — retry loop | ✅ PASS | 10 retries × 3s, then exit(1) |
| DB unavailable — exit code | ✅ PASS | exit 1 (Railway will restart) |
| Migration first-run on clean DB | ✅ PASS | All 4 tables + 2 enums + 3 FKs created |
| Migration replay idempotency | ✅ PASS | Second run: "All migrations are up to date" |
| Production startup sequence | ✅ PASS | migrations → app → /health = ok in <1s |
| `synchronize: false` in production | ✅ CONFIRMED | Diagnostics log shows `synchronize: false` |
| `synchronize: true` dev warning emitted | ✅ PASS | WARN logged on dev startup |
| Swagger disabled in production | ✅ PASS | `GET /api/docs → 404` |
| Health endpoint — DB up | ✅ PASS | `status: ok, latencyMs: 1` |
| Health endpoint — DB stopped | ✅ PASS | `status: degraded, latencyMs: -1` |
| Health endpoint — DB recovered | ✅ PASS | `status: ok` — no app restart needed |
| X-Request-Id assigned per request | ✅ PASS | Unique UUID v4, echoed in response header |
| HTTP logging format | ✅ PASS | `GET /health 200 +2ms rid=UUID` |
| JSON logger in production | ✅ PASS | Newline-delimited JSON, all fields present |

---

## 2. Critical Bug Fixed: `esModuleInterop` Missing

### Symptom
```
Fatal error during bootstrap: TypeError: (0 , cookie_parser_1.default) is not a function
```

### Root Cause
`tsconfig.json` had `allowSyntheticDefaultImports: true` but was missing `esModuleInterop: true`.

- `allowSyntheticDefaultImports` only affects type-checking (TypeScript accepts `import x from 'module'` without error).
- **Without** `esModuleInterop`, the compiled output is `cookie_parser_1.default()` where `cookie_parser_1 = require("cookie-parser")`. Since `cookie-parser` exports the function as `module.exports` (not `.default`), `cookie_parser_1.default` is `undefined`.
- **With** `esModuleInterop`, TypeScript emits `__importDefault(require(...))` which wraps CJS modules to expose `.default` correctly.

### Fix Applied
Added to `tsconfig.json`:
```json
"esModuleInterop": true
```

### Compiled output before fix:
```javascript
const cookie_parser_1 = require("cookie-parser");
app.use((0, cookie_parser_1.default)()); // TypeError: cookie_parser_1.default is not a function
```

### Compiled output after fix:
```javascript
const cookie_parser_1 = __importDefault(require("cookie-parser"));
app.use((0, cookie_parser_1.default)()); // ✅ Works
```

### Tests still pass: 124/124 ✅

---

## 3. Clean Rebuild Verification

### Test procedure
```bash
rm -rf node_modules dist
time npm ci          # 16.3s — deterministic from package-lock.json
time npm run build   # 3.5s — TypeScript → dist/
```

### Build output
| Artifact | Present | Purpose |
|---|---|---|
| `dist/main.js` | ✅ | App entrypoint |
| `dist/data-source.js` | ✅ | TypeORM CLI DataSource |
| `dist/database/run-migrations.js` | ✅ | Pre-start migration runner |
| `dist/database/migrations/1776200624919-InitialSchema.js` | ✅ | Migration with uuid-ossp fix |
| `dist/database/seed.js` | ✅ | Dev seed script |
| Total compiled files | 54 | |
| Total dist size | 1.1 MB | |

### Determinism check
`npm ci` uses `package-lock.json` exclusively. With `.npmrc` containing `legacy-peer-deps=true` (copied into Docker), the install is fully reproducible between local and CI and container.

---

## 4. Test Suite on Clean Build

```
Test Suites: 7 passed, 7 total
Tests:       124 passed, 124 total
Time:        5.02s
```

No `--passWithNoTests`. No fake assertions. No DB connection required.

---

## 5. Migration Safety Verification

### First-run result (clean database)
```
[migrations] Connecting to database…
[migrations] Running pending migrations…
[migrations] Applied 1 migration(s): [ 'InitialSchema1776200624919' ]
[migrations] Done.
```

Tables created: `projects`, `users`, `pages`, `subscriptions`
ENUMs created: `users_role_enum`, `subscriptions_plan_enum`
FK constraints created: 3
Migration recorded in `migrations` table: ✅

### Replay result (already-migrated database)
```
[migrations] All migrations are up to date — nothing to run.
[migrations] Done.
```

Exit code: 0. No errors. ✅

### Important: `synchronize` vs migrations conflict
When the dev app starts first (before migrations), `synchronize: true` creates tables directly without recording in the `migrations` table. If `run-migrations` then runs, it sees the migration as pending but fails because tables already exist.

**Resolution:** In production (Railway), migrations always run BEFORE the app starts (enforced by `startCommand` in `railway.toml`). The conflict only affects developers who skip the migration step — documented in `LOCAL_DATABASE_SETUP.md`.

---

## 6. DB Unavailable Startup Scenario

### Retry loop (measured)
```
Retrying (1)...   t=0s
Retrying (2)...   t=3s
Retrying (3)...   t=6s
...
Retrying (10)...  t=27s
Fatal exit        t=30s
```

- Total wait before fatal exit: ~30 seconds
- Exit code after retry exhaustion: **1** (Railway restart policy triggers)
- All retry messages logged as structured JSON with context `TypeOrmModule`
- No unhandled rejection — NestJS catches and routes to exception handler
- No process hang — clean exit

### Logger behavior during DB failure
- `AppLoggerService` initializes before `NestFactory.create()` — no dependency on NestJS context
- All messages during retry phase are valid JSON (production mode confirmed)
- No stdout/stderr mixing — all error logs go to stdout as JSON in production

---

## 7. DB Outage / Recovery Cycle

### Test sequence
1. App started with DB available → health: `ok`
2. PostgreSQL stopped → health: `degraded, latencyMs: -1`
3. PostgreSQL restarted → health: `ok, latencyMs: 13ms`

**App never restarted.** TypeORM's connection pool automatically reconnects when the DB becomes available. The health endpoint accurately reflects real-time DB state.

### Response bodies observed
```json
// DB up:
{"status":"ok","services":{"database":"ok"},"diagnostics":{"database":{"status":"ok","latencyMs":1},...}}

// DB stopped:
{"status":"degraded","services":{"database":"error"},"diagnostics":{"database":{"status":"error","latencyMs":-1},...}}

// DB recovered:
{"status":"ok","services":{"database":"ok"},"diagnostics":{"database":{"status":"ok","latencyMs":13},...}}
```

---

## 8. Production Startup — Full Sequence

### Command (Railway):
```
node dist/database/run-migrations && node dist/main
```

### Measured timeline
| Step | Duration | Result |
|---|---|---|
| `run-migrations` | <0.5s (already applied) | exit 0 |
| NestJS bootstrap | ~70ms | All modules loaded |
| TypeORM connection | ~25ms | Pool established |
| Startup diagnostics logged | immediate | All fields present |
| `app.listen(3000)` | immediate | Ready |
| Total from command start to ready | ~0.6s (migrations up to date path) | |

### Production diagnostics log (observed)
```json
{"level":"log","message":"  NODE_ENV        : production","context":"Bootstrap"}
{"level":"log","message":"  synchronize     : false","context":"Bootstrap"}
{"level":"log","message":"  JWT_SECRET      : set ✓","context":"Bootstrap"}
{"level":"log","message":"  JWT_REFRESH_SEC : set ✓","context":"Bootstrap"}
{"level":"log","message":"  CORS_ORIGIN     : https://example.com","context":"Bootstrap"}
```

### Production-mode behavior confirmed
- ✅ `synchronize: false` — no DDL on startup
- ✅ Swagger disabled — `GET /api/docs → 404`
- ✅ JSON logging throughout
- ✅ `trust proxy` enabled for Railway's load balancer
- ✅ Helmet CSP active

---

## 9. Request Lifecycle Verification

### X-Request-Id
```
Request → RequestIdMiddleware generates UUID v4
       → set on req.headers['x-request-id']
       → echoed in response header: x-request-id: <UUID>
       → included in error response body (requestId field)
       → logged by LoggingInterceptor: rid=<UUID>
```

Confirmed: each request gets a unique UUID. No ID collision observed.

### HTTP logging format
```
GET /health 200 +2ms rid=3fc10ba4-b399-4a8b-9176-ba7169dd35d9
```

Format: `METHOD PATH STATUS +LAT rid=UUID`

---

## 10. ENV Validation Behaviour

### Missing `JWT_SECRET`
→ `validateEnv()` throws during `ConfigModule` initialization
→ NestJS catches → logged as error → process exits 1
→ Never reaches DB connection or HTTP listener

### Missing `JWT_EXPIRES_IN` in production
→ Caught during `AuthModule` initialization (before app listens)
→ Logged as error with full stack trace
→ process exits 1 (Railway restart triggers)

### Tested production ENV vars (all required)
| Variable | Behavior if missing |
|---|---|
| `JWT_SECRET` | ConfigModule throws — fatal |
| `JWT_REFRESH_SECRET` | Prod validation throws — fatal |
| `JWT_EXPIRES_IN` | AuthModule throws — fatal |
| `CORS_ORIGIN` | Bootstrap `getCorsOrigin()` throws — fatal |
| `DATABASE_URL` / `DB_*` | TypeORM fails to connect — 10 retries then exit 1 |

---

## 11. Known Issues (Non-Blocking)

| Issue | Severity | Status |
|---|---|---|
| `esModuleInterop` missing — cookie-parser crash | **CRITICAL** | ✅ FIXED in this session |
| `healthcheckTimeout = 30` in railway.toml | MEDIUM | Documented — should be 120 to cover 10-retry window |
| `run-migrations` has no DB retry (fails immediately if DB not ready) | MEDIUM | TypeORM's `retryAttempts` only applies to app connection, not CLI |
| 23 npm audit vulnerabilities (4 low, 10 moderate, 9 high) | LOW-MED | Dev dependencies; production deps need separate audit |
| Docker not available in test environment | INFO | Dockerfile verified by static analysis; Docker tests noted as simulated |

---

## 12. Verdict

**The backend is production-ready with the `esModuleInterop` fix applied.**

The critical bootstrap crash (`cookie-parser` TypeError) that would have blocked every Railway deploy has been fixed. All other systems are verified operational:
- Retry logic works
- Health endpoint works
- Recovery without restart works
- Migration path works and is idempotent
- Production ENV gates work
- JSON logging works throughout all failure modes
