# CONTAINER_BOOT_SEQUENCE

Date: 2026-05-12

## Intended Boot Order

1. PostgreSQL container starts.
2. PostgreSQL healthcheck becomes healthy.
3. Backend container starts.
4. Backend runs `node dist/database/run-migrations.js`.
5. Backend starts `node dist/main.js`.
6. Container healthcheck probes `GET /health`.

## Compose Wiring

`docker-compose.yml` now includes:

1. `postgres` with healthcheck.
2. `backend` with `depends_on.postgres.condition = service_healthy`.
3. explicit production env values for JWT, CORS and DB connection.

## Production Parity

The same migration-first startup path is now used by:

1. Docker image `CMD`
2. `npm run start:container`
3. Railway `startCommand`

## Real Checks Completed

Verified outside Docker:

```powershell
node dist/database/run-migrations.js
```

Observed result:
- migration entrypoint completed successfully

Blocked on this host:
- full in-container boot sequence, because Docker engine returns API 500 before container operations begin