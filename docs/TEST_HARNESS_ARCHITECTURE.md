# Test Harness Architecture

## Overview

The backend E2E test harness uses a real NestJS application instance wired to an isolated
PostgreSQL test database (`sitepilot_test`). No mocks are used for the database layer —
every test exercises the full stack: HTTP → NestJS → TypeORM → PostgreSQL.

## File Layout

```
test/
├── jest-e2e.json              # Jest config for E2E (separate from unit-test config)
├── set-test-env.ts            # setupFiles: sets all env vars before any module loads
├── setup.ts                   # globalSetup: runs migrations once before all suites
├── teardown.ts                # globalTeardown: no-op (DB kept for debugging)
├── helpers/
│   ├── app.helper.ts          # createTestApp(), resetDb(), TestApp interface
│   ├── auth.helper.ts         # registerUser(), loginUser(), uniqueEmail(), bearerHeader()
│   └── db.helper.ts           # getTestDataSourceOptions(), truncateAll()
└── e2e/
    ├── health.e2e-spec.ts
    ├── auth.e2e-spec.ts
    ├── projects.e2e-spec.ts
    ├── pages.e2e-spec.ts
    └── request-lifecycle.e2e-spec.ts
```

## Boot Sequence

```
Jest runner
  └─ setupFiles: set-test-env.ts     ← env vars set BEFORE any import
  └─ globalSetup: setup.ts           ← migrate sitepilot_test (once, all suites)
  └─ [test suite starts]
       └─ beforeAll: createTestApp() ← boot real NestJS app + supertest agent
       └─ beforeEach: resetDb()      ← TRUNCATE all tables (fast, deterministic)
       └─ test: ...                  ← hit HTTP, assert response + DB state
       └─ afterAll: app.close()      ← graceful teardown
```

### Why `setupFiles` (not `beforeAll`)

`ConfigModule.forRoot({ validate: validateEnv })` calls the validation function at
class-definition time when `AppModule` is imported. If env vars aren't set before the
import, the test suite crashes with "JWT_SECRET environment variable is required" before
any test code runs.

`setupFiles` runs before Jest loads test modules; `beforeAll` runs after. The former is
therefore the correct hook for env bootstrapping.

## Database Isolation

- **Database**: `sitepilot_test` — never `sitepilot` (dev) or the Railway prod DB
- **Override**: `setTestEnv()` deletes `DATABASE_URL` and sets `DB_NAME=sitepilot_test`
- **Migrations**: Run once in `globalSetup`; not re-run per suite (fast startup)
- **Reset**: `TRUNCATE TABLE pages, subscriptions, projects, users RESTART IDENTITY CASCADE`
  — removes all rows but keeps schema; runs in ~5ms vs ~500ms for drop/recreate

## ThrottlerGuard Bypass

The auth controller applies `@Throttle({ default: { ttl: 60_000, limit: 10 } })` to
`/auth/register` and `/auth/login`. A test suite making 20+ register calls within one
TTL window would hit 429 before finishing.

Solution: In `createTestApp()`, `ThrottlerStorage` is overridden to always report
`totalHits: 1, isBlocked: false`. The guard logic remains intact; only the storage
(hit counter) is neutralized. This preserves guard code coverage without interference.

Note: `overrideGuard(ThrottlerGuard)` does NOT work for `APP_GUARD` multi-providers —
it only works for guards applied with `@UseGuards()`. The storage override is required.

## Persistent Cookie Jar

`request.agent()` maintains a cookie jar across requests (like a real browser). This is
used by `t.agent` so that refresh-token cookies set during login/register are automatically
sent on subsequent calls — mirroring real client behavior.

For tests that must NOT carry the agent's cookies (e.g., "no cookie → 401"), `t.rawRequest`
provides a one-shot `request(server)` without a persistent jar.

## TestApp Interface

```typescript
interface TestApp {
  app: INestApplication;   // NestJS app — use for getHttpServer() or module refs
  agent: any;              // supertest agent with cookie jar (shared across a suite)
  rawRequest: any;         // one-shot supertest request (no cookie persistence)
  dataSource: DataSource;  // TypeORM DataSource — for direct DB assertions
  close: () => Promise<void>;
}
```
