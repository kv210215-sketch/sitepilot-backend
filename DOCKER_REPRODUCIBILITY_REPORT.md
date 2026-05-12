# DOCKER REPRODUCIBILITY REPORT

Date: 2026-05-12
Workspace: `d:\Projects\SitePilot\sitepilot\sitepilot-backend`
Mode: real execution only

## Executive Summary

Repository-side Docker reproducibility gaps were fixed.

The remaining blocker on this machine is external to the repository: Docker Desktop engine is unhealthy and returns HTTP 500 before any image build or compose action starts.

## Exact Blockers Found

1. Docker engine outage on the host.
2. Original compose stack only defined PostgreSQL, not the backend container.
3. Original Docker image booted `dist/main` directly instead of migration-first production startup.
4. Original build context included avoidable churn from frontend/tests/docs/reports.
5. Local install reproducibility was broken by native `bcrypt` plus a global npm `omit=dev` setting.
6. Local E2E bootstrap assumed `sitepilot_test` existed and had create-database privileges.

## Exact Fixes Applied

1. Replaced native `bcrypt` with `bcryptjs`.
2. Added explicit repo-level `include=dev` in `.npmrc`.
3. Added package `engines` and Docker helper scripts in `package.json`.
4. Reworked `Dockerfile` into `deps` -> `builder` -> `runtime` stages.
5. Switched image boot to `node dist/database/run-migrations.js && node dist/main.js`.
6. Added `backend` service to `docker-compose.yml` with production env and DB dependency.
7. Tightened `.dockerignore`.
8. Made local E2E default to existing isolated DB `sitepilot_backend`; CI still overrides to `sitepilot_test` via `TEST_DATABASE_URL`.
9. Made Jest global setup create the test DB when possible and only destroy initialized datasources.
10. Updated Railway start command to explicit compiled `.js` entrypoints.

## Exact Commands Executed

```powershell
docker version
docker --context default version
docker compose -f docker-compose.yml down -v --remove-orphans
npm ci
npm install
npm run build
npm run test:e2e -- --runInBand
$env:NODE_ENV='production'; $env:JWT_SECRET='docker-repro-validation-secret-123456789012'; $env:JWT_REFRESH_SECRET='docker-repro-refresh-secret-123456789012'; $env:JWT_EXPIRES_IN='15m'; $env:JWT_REFRESH_EXPIRES_IN='7d'; $env:CORS_ORIGIN='http://localhost:3001'; $env:DB_HOST='localhost'; $env:DB_PORT='5432'; $env:DB_USER='sitepilot'; $env:DB_PASSWORD='sitepilot'; $env:DB_NAME='sitepilot'; node dist/database/run-migrations.js
```

## Verified Results

1. `npm ci` succeeded after repo-level `include=dev` and `bcryptjs` swap.
2. `npm run build` succeeded.
3. `npm run test:e2e -- --runInBand` succeeded.
4. Backend E2E result: `67/67` tests passed, `5/5` suites passed.
5. Production migration entrypoint succeeded: `All migrations are up to date — nothing to run.`

## Still Blocked Here

These Docker validations remain blocked by the unhealthy host engine, not by a proven repo defect:

1. fresh `docker build --no-cache`
2. compose `down -v` / `up` cycle
3. real backend container cold boot
4. real container `/health` probe
5. real compose-based DB recovery cycle

## PR Readiness Assessment

Repo changes are ready for review.

Final merge/deploy readiness for Docker specifically still depends on repairing the local Docker engine and rerunning the blocked container checks.