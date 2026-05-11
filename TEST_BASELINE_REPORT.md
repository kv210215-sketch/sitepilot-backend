# Test Baseline Report — SitePilot Backend

**Status: ✅ PASSING**
Date: 2026-05-11

```
Test Suites: 7 passed, 7 total
Tests:       124 passed, 124 total
Time:        ~8s
```

---

## How to Run

```bash
# All tests (from repo root):
npm test

# With coverage report:
npm run test:cov

# Watch mode (development):
npm run test:watch

# Single suite:
npx jest src/common/config/env.validation.spec.ts
```

> Note: `JWT_SECRET` is read by the app module if ConfigModule loads, but
> these unit tests do NOT load the NestJS app — no environment variable is
> required to run the test suite.

---

## Test Files Added

### 1. `src/common/config/env.validation.spec.ts`
**28 tests** | Pure function unit tests — no DB, no NestJS

What it verifies:
- `validateEnv()` throws on missing `JWT_SECRET`
- Throws on `JWT_SECRET` shorter than 32 chars
- Passes with a 32-char secret in development
- Returns the same config object reference
- Production: throws when `JWT_REFRESH_SECRET` is missing
- Production: throws when `JWT_REFRESH_SECRET` equals `JWT_SECRET`
- Production: throws when `JWT_REFRESH_SECRET` is too short
- Production: throws when `CORS_ORIGIN` is missing or is `*` (including whitespace around it)
- Production: throws when individual `DB_*` vars are absent and `DATABASE_URL` is not set
- Production: passes with `DATABASE_URL` present (DB vars not required)
- `THROTTLE_TTL`: throws on non-numeric or < 1000
- `PORT`: throws on non-numeric, 0, or > 65535

---

### 2. `src/common/config/security.config.spec.ts`
**12 tests** | Pure function unit tests — no DB, no NestJS

What it verifies:
- `REFRESH_TOKEN_COOKIE` constant equals `"refresh_token"`
- `getRefreshCookieOptions(true)` → `httpOnly: true, secure: true, sameSite: 'strict', path: '/auth'`
- `getRefreshCookieOptions(false)` → `secure: false, sameSite: 'lax'`
- `maxAge` is exactly 7 days in milliseconds
- `getClearCookieOptions` → `maxAge: 0` in both environments
- Cookie is always scoped to `/auth` path

---

### 3. `src/common/middleware/request-id.middleware.spec.ts`
**7 tests** | Unit tests with mock req/res — no DB, no NestJS

What it verifies:
- Generates a valid UUID v4 when no `X-Request-Id` header is present
- Preserves an existing `X-Request-Id` from the client
- Echoes the ID back in the response `setHeader` call
- Generates a new UUID when the header is an empty string
- Always calls `next()` exactly once with no arguments
- Two consecutive requests without headers receive different UUIDs
- `REQUEST_ID_HEADER` constant is lowercase `"x-request-id"`

---

### 4. `src/common/filters/all-exceptions.filter.spec.ts`
**10 tests** | Unit tests with mocked `ArgumentsHost` — no DB, no NestJS

What it verifies:
- Returns the HTTP status from an `HttpException`
- Returns 500 for a plain `Error` (non-HttpException)
- Returns 500 for a thrown string
- Response body contains `statusCode`, `timestamp`, `path`, `message`
- Includes `requestId` in body when `x-request-id` header is present
- Omits `requestId` when header is absent
- **Masks** 5xx `HttpException` message in production (`"Internal server error"`)
- **Exposes** 5xx `HttpException` message in development
- Does NOT mask 4xx messages in production
- Calls `logger.error` for 5xx; does NOT call it for 4xx

---

### 5. `src/common/logger/app-logger.service.spec.ts`
**20 tests** | Unit tests with stdout/stderr spies — no DB, no NestJS

What it verifies (development mode):
- `log()` and `warn()` write to stdout
- `error()` writes to stderr, not stdout
- Output is plain text (not JSON) in dev mode
- Message text and context appear in output

What it verifies (production mode):
- `log()` writes to stdout as a single JSON line ending with `\n`
- JSON fields: `level`, `message`, `timestamp`, `pid`, optionally `context`, `trace`
- `level` is correctly set per method: `"log"`, `"error"`, `"warn"`
- `context` is included when provided; omitted when absent
- `trace` is included when provided; omitted when absent
- `pid` matches `process.pid`
- Non-string messages are serialised to JSON string

---

### 6. `src/health/health.controller.spec.ts`
**14 tests** | Unit tests with mocked `DataSource` — no real DB connection

What it verifies:
- `status: 'degraded'` when `DataSource.isInitialized = false`
- `status: 'ok'` when `DataSource.isInitialized = true` and query succeeds
- `status: 'degraded'` when query throws — error is caught, never propagated to caller
- `services.database` is `'ok'` or `'error'` matching status
- `diagnostics.database.latencyMs` is `-1` when DB not initialised
- `diagnostics.database.latencyMs` is `>= 0` after a successful query
- `timestamp` is a valid ISO 8601 string
- `uptime` is a non-negative integer
- `diagnostics.memory.heapUsedMb/heapTotalMb/rssMb` are positive numbers
- `diagnostics.node.version` matches `process.version`
- `diagnostics.node.uptime` equals top-level `uptime`
- `services.database` and `diagnostics.database.status` are always consistent
- `heapUsedMb <= heapTotalMb`

---

### 7. `src/auth/dto/auth.dto.spec.ts`
**33 tests** | DTO class-validator tests — no DB, no NestJS app

Uses `plainToInstance` + `validate()` from `class-validator` / `class-transformer`.
Requires `reflect-metadata` (imported at top of file).

**LoginDto (8 tests):**
- Valid email + password → passes
- Non-email string → fails
- Password > 72 chars → fails (bcrypt bomb protection)
- Password = 72 chars → passes (boundary)
- Email > 255 chars → fails
- Missing both fields → fails
- Missing password → fails
- Missing email → fails

**RegisterDto (9 tests):**
- Valid input → passes
- Optional name → passes with and without
- Password < 8 chars → fails
- Password = 8 chars → passes (boundary)
- Password > 72 chars → fails
- Password = 72 chars → passes (boundary)
- Name > 100 chars → fails
- Name = 100 chars → passes (boundary)
- Invalid email → fails

**ChangePasswordDto (6 tests):**
- Valid input → passes
- `newPassword` < 8 chars → fails
- `newPassword` > 72 chars → fails
- `currentPassword` > 72 chars → fails
- Empty object → fails
- Missing `newPassword` → fails

**UpdateProfileDto (7 tests):**
- Empty object → passes (all fields optional)
- Valid name → passes
- Valid email → passes
- Both name and email → passes
- Invalid email → fails
- Name > 100 chars → fails
- Email > 255 chars → fails

---

## What Is NOT Covered (Intentionally)

| Area | Reason not covered in baseline |
|------|--------------------------------|
| Auth service (login, register, JWT signing) | Requires mocking `UsersService`, `JwtService`, `bcrypt` — valuable but scope of next test phase |
| Auth controller endpoints | Requires mocked guards, responses — e2e or integration tests |
| TypeORM entities and migrations | Requires real DB — integration test territory |
| Projects / Pages / Billing services | Business logic with DB dependency — next phase |
| Publish service | DB + file I/O dependency |
| `LoggingInterceptor` | RxJS Observable chain testing — integration level |
| `JwtRefreshStrategy` | Requires `passport` + `ConfigService` mock chain |
| `AppModule` bootstrap | Full NestJS context with DB — e2e only |
| E2E tests (`test/jest-e2e.json`) | Requires running server + DB — out of scope for unit baseline |

---

## Test Quality Notes

**What these tests do NOT do:**
- No `--passWithNoTests` workarounds
- No `exit 0` tricks
- No fake assertions (`expect(true).toBe(true)`)
- No mocked implementations that always return the "correct" answer
- No production DB connections
- No Railway ENV vars required

**What each test actually exercises:**
- `env.validation.spec.ts` — calls the real `validateEnv()` function and checks real thrown errors
- `security.config.spec.ts` — calls real cookie option functions and checks real return values
- `request-id.middleware.spec.ts` — runs the real middleware with minimal mock req/res
- `all-exceptions.filter.spec.ts` — runs the real filter with a mock HTTP context; production masking tested by switching `process.env.NODE_ENV`
- `app-logger.service.spec.ts` — runs the real logger and asserts on what it actually writes to stdout/stderr
- `health.controller.spec.ts` — runs the real controller with a mocked `DataSource`; covers all three DB states (not initialised, query OK, query throws)
- `auth.dto.spec.ts` — runs real `class-validator` decorators via `plainToInstance` + `validate()`

---

## CI Test Gate — Ready?

**YES — safe to enable now.**

Update `.github/workflows/ci.yml`:

```yaml
- name: Test
  run: npm test
  env:
    NODE_ENV: test
    JWT_SECRET: ${{ secrets.CI_JWT_SECRET }}
    JWT_REFRESH_SECRET: ${{ secrets.CI_JWT_REFRESH_SECRET }}
```

**Do NOT add `--passWithNoTests`** — the suite now has 124 real tests and that flag is no longer needed or appropriate.

Pre-conditions before enabling the gate:
- [ ] `CI_JWT_SECRET` and `CI_JWT_REFRESH_SECRET` added to GitHub Secrets (any 32-char strings)
- [ ] ci.yml updated to remove `--passWithNoTests` from the test step (or replaced entirely with `npm test`)

---

## Next Test Phase (Recommended)

Once this baseline is merged and CI gate is active:

| Priority | What to add | Approach |
|----------|-------------|----------|
| HIGH | `auth.service.spec.ts` — login/register/token logic | Mock `UsersService`, `JwtService`, `bcrypt.compare` |
| HIGH | `auth.controller.spec.ts` — cookie setting, guard behaviour | NestJS `Test.createTestingModule` with mocked guards |
| MEDIUM | `projects.service.spec.ts` | Mock TypeORM `Repository` |
| MEDIUM | `pages.service.spec.ts` | Mock TypeORM `Repository` |
| LOW | E2E tests (`test/app.e2e-spec.ts`) | Requires test DB via Docker Compose |
