# DOCKER_RECOVERY_PLAYBOOK

Date: 2026-05-12

## Observed Host Failure

Docker commands failed before repository build logic started:

```text
request returned 500 Internal Server Error for API route and version http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.54/version
```

The same failure happened on:

1. `desktop-linux`
2. `default`

## Recovery Steps

1. Quit Docker Desktop completely.
2. Verify all `Docker Desktop` processes are gone.
3. Start Docker Desktop again.
4. Confirm these both work before touching the repo:

```powershell
docker version
docker info
```

5. After Docker is healthy, rerun the repository recovery sequence:

```powershell
npm ci
npm run docker:reset
npm run docker:build
npm run docker:up
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:3000/health | Select-Object -ExpandProperty Content
```

## Expected Outcome After Recovery

1. PostgreSQL becomes healthy.
2. Backend container starts after PostgreSQL.
3. Migrations run before app boot.
4. `/health` returns HTTP 200.

## If the Stack Still Fails

Inspect logs:

```powershell
npm run docker:logs
```

Then retry from zero:

```powershell
npm run docker:reset
npm run docker:build
npm run docker:up
```