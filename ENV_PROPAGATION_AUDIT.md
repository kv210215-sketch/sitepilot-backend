# ENV_PROPAGATION_AUDIT

Date: 2026-05-12

## Audited Files

1. `.env.example`
2. `docker-compose.yml`
3. `railway.toml`
4. `src/app.module.ts`
5. `src/common/config/env.validation.ts`
6. `src/main.ts`
7. `test/set-test-env.ts`
8. `test/helpers/app.helper.ts`

## Findings

### Production runtime

Required in production:

1. `JWT_SECRET`
2. `JWT_REFRESH_SECRET`
3. `CORS_ORIGIN`
4. `DATABASE_URL` or full `DB_*`

### Docker compose runtime

Compose backend uses explicit `DB_*` variables instead of `DATABASE_URL`.

Reason:
- current runtime config enables SSL automatically when `DATABASE_URL` is used in production
- local compose PostgreSQL is non-SSL

### Railway runtime

Railway remains compatible with injected `DATABASE_URL` and explicit migration-first start command.

### Test runtime

Local default isolated DB:
- `sitepilot_backend`

CI override:
- `TEST_DATABASE_URL=.../sitepilot_test`

This keeps tests isolated from canonical dev DB `sitepilot` while still working on this host without `CREATE DATABASE` privilege.

## Fixes Applied

1. Added `DB_SYNCHRONIZE=false` to `.env.example`.
2. Added `TEST_DATABASE_URL` to `.env.example`.
3. Preserved explicit compose backend env propagation.
4. Updated test env helpers to use isolated local fallback DB safely.

## Remaining Risk

If a developer forces `DATABASE_URL` in local production mode against a non-SSL Postgres endpoint, current runtime logic may still attempt SSL. Compose avoids that path by design.