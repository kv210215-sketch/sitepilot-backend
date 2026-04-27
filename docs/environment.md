# Environment requirements

This backend now uses explicit production guardrails.

## Production required values

Production must define these values before the application starts:

- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`
- either `DATABASE_URL` or the full explicit database variable set: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

## Local development defaults

Local development may keep the docker-compose database defaults and permissive CORS. Production must not rely on local fallback values.

## Seed script

`npm run db:seed` requires `SEED_ADMIN_PASSWORD` and accepts optional `SEED_ADMIN_EMAIL`. The seed password must be at least 12 characters and is not printed to logs.
