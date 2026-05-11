# Test Database Strategy

## Database Topology

| Database | Purpose | Who Touches It |
|----------|---------|----------------|
| `sitepilot` | Local development | Developer, `npm run start:dev` |
| `sitepilot_test` | E2E test suite | `npm run test:e2e`, CI job |
| Railway prod DB | Production (Railway) | `npm run start:prod` via `DATABASE_URL` |

The three databases are completely separate. No test ever touches `sitepilot` or the Railway DB.

---

## Test DB Lifecycle

### One-Time Setup (developer machine)
```bash
psql -U postgres -c "CREATE USER sitepilot WITH PASSWORD 'sitepilot';"
psql -U postgres -c "CREATE DATABASE sitepilot_test OWNER sitepilot;"
psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" -d sitepilot_test
```

### Per CI Run (automatic)
GitHub Actions spins up a `postgres:16` service container with `POSTGRES_DB=sitepilot_test`.
No manual setup required.

### Per Test Suite Run (automatic)
`test/setup.ts` (`globalSetup`) applies all pending migrations to `sitepilot_test` before
any suite runs. The `test/jest-e2e.json` config ensures this always runs first.

### Per Test (automatic)
`beforeEach(() => resetDb(t.dataSource))` truncates all tables:
```sql
TRUNCATE TABLE pages, subscriptions, projects, users RESTART IDENTITY CASCADE
```
This runs in ~5ms and ensures every test starts from a clean state.

---

## Why Not SQLite / in-memory?

| Concern | SQLite | Real PostgreSQL |
|---------|--------|-----------------|
| UUID generation | No `uuid-ossp` | Works via extension |
| JSONB columns | Not supported | Native |
| CASCADE behaviour | Different semantics | Identical to prod |
| Migration fidelity | TypeORM differences | Exact prod replica |
| Concurrent writes | Different locking | Same as prod |

Using a real PostgreSQL database catches bugs that SQLite silently passes.

---

## Why Not `synchronize: true`?

`synchronize: true` auto-alters the schema to match TypeORM entities on every app start.
This is disabled (`synchronize: false`) in both production and tests because:
1. It can silently drop columns/indexes without a migration record
2. It bypasses the migration system, hiding drift
3. It would make CI's migration-drift check meaningless

All schema changes must go through a migration file in `src/migrations/`.

---

## Isolation Guarantees

### No Cross-Contamination Between Suites
Each test suite creates a NEW NestJS app instance in `beforeAll`. The TypeORM DataSource
is per-instance. The `beforeEach` truncation ensures no rows from one test bleed into the next.

### No Dev Database Contamination
`setTestEnv()` performs:
```typescript
delete process.env.DATABASE_URL;   // removes any Railway URL set in shell
process.env.DB_NAME = 'sitepilot_test';
```
This runs from `test/set-test-env.ts` (Jest `setupFiles`), which executes before any module
import. Even if `DATABASE_URL` is set in the environment, it is deleted before `ConfigModule`
reads it.

### No Production Database Access in CI
The CI E2E job uses no Railway secrets. It only needs the in-job PostgreSQL service container.
Even if a developer accidentally sets `DATABASE_URL` in the CI env, `setTestEnv()` deletes it.

---

## Migration Strategy for Tests

Migrations are the single source of truth for schema. The test harness:
1. Runs `ds.runMigrations({ transaction: 'each' })` in `globalSetup` — applies migrations idempotently
2. Verifies migration records in `request-lifecycle.e2e-spec.ts` (Migration Bootstrap tests)
3. CI migration drift check confirms at least 1 migration is recorded post-E2E

If a developer adds an entity field without a migration, the E2E tests will fail at the
database query level, surfacing the drift before it reaches production.

---

## Adding a New Test Database

If a new feature requires a separate test database (e.g., for multi-tenant isolation testing):

1. Add `POSTGRES_DB_2=sitepilot_test_tenant` to the CI service container env
2. Create a second `getTestDataSourceOptions2()` in `db.helper.ts`
3. Create a separate `setup2.ts` and reference it in a new jest config
4. Never share app instances across tests targeting different databases
