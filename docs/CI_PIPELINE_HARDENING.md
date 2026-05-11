# CI Pipeline Hardening

## Current CI State (after this sprint)

Two jobs in `.github/workflows/ci.yml`:

### Job 1: `backend-build` (build + unit tests)

1. `npm ci --legacy-peer-deps` — clean install
2. ENV validation gate — fails CI if `JWT_SECRET` < 32 chars
3. `npm run build` — TypeScript compilation
4. `npm run test -- --passWithNoTests=false --forceExit` — unit tests (124 tests)

### Job 2: `backend-e2e` (E2E tests, runs after build passes)

Spins up a PostgreSQL 16 service container (`sitepilot_test`), then:

1. `npm ci --legacy-peer-deps` — clean install
2. `npm run test:e2e` — full E2E suite (67 tests, migrations applied automatically)
3. Migration drift check — queries `migrations` table; fails if 0 rows

---

## Failure Modes That Now Break CI

| Scenario | Which step fails |
|----------|-----------------|
| Missing/short `JWT_SECRET` | ENV validation gate (build job) |
| TypeScript compilation error | `npm run build` |
| Unit test regression | `npm run test` |
| Migration not applied (schema drift) | Migration drift check (e2e job) |
| E2E test failure | `npm run test:e2e` |
| `uuid-ossp` extension missing | `request-lifecycle.e2e-spec.ts` migration bootstrap test |
| Cascade delete broken | `pages.e2e-spec.ts` cascade test |
| RBAC guard removed | Multiple 403 tests |
| Cookie config broken | Auth cookie tests |

---

## Gaps That Remain

| Gap | Risk | Suggested Fix |
|-----|------|---------------|
| No throttle rate-limit integration test | `@Throttle` limits could be silently removed | Add a dedicated throttle test suite (don't bypass ThrottlerStorage) |
| No Railway deploy smoke test | Deploy could succeed but app crash on startup | Add a post-deploy health check in Railway config |
| Unit tests mock most of the app | Real behaviour gaps between unit and E2E | Increase E2E coverage for edge cases |
| No test for subscription/billing paths | Billing module untested | Add Stripe webhook test with test keys |
| `npm test` hits no database | Some services only mocked | E2E job covers real DB; keep as-is |
| No parallelism between test suites | Suite order matters (all use same test DB) | Add `--runInBand` or separate DB per suite |

---

## ENV Variables Required in CI

| Variable | Job | Value |
|----------|-----|-------|
| `JWT_SECRET` | build, e2e | `>=32 chars` (CI placeholder OK) |
| `JWT_REFRESH_SECRET` | build | `>=32 chars`, different from JWT_SECRET |
| `TEST_DATABASE_URL` | e2e | `postgresql://sitepilot:sitepilot@localhost:5432/sitepilot_test` |
| `NODE_ENV` | e2e | `test` |

None of these require Railway secrets. The E2E job uses the PostgreSQL service container.

---

## Local E2E Run

```bash
# Start PostgreSQL (if not running)
docker compose up -d db

# Create test database (once)
psql -U sitepilot -c "CREATE DATABASE sitepilot_test;"

# Run E2E suite
TEST_DATABASE_URL=postgresql://sitepilot:sitepilot@localhost:5432/sitepilot_test npm run test:e2e
```

## Guard Against Test DB Targeting Dev DB

`test/helpers/app.helper.ts` `setTestEnv()` performs:
```typescript
delete process.env.DATABASE_URL;   // prevents Railway URL bleeding in
process.env.DB_NAME = 'sitepilot_test';
```

This is reinforced by `test/set-test-env.ts` (Jest `setupFiles`) which runs BEFORE any
module import, ensuring `ConfigModule` never reads the dev `DATABASE_URL`.
