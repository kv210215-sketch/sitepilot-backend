# SitePilot Backend — Production ENV Checklist

> Use this checklist before every Railway production deploy.

---

## Critical ENV Variables (App will not start without these in production)

```
[ ] NODE_ENV=production
[ ] JWT_SECRET=<min 32 chars, cryptographically random>
[ ] JWT_REFRESH_SECRET=<min 32 chars, DIFFERENT from JWT_SECRET>
[ ] CORS_ORIGIN=https://your-frontend-domain.com  (NOT *)
[ ] DATABASE_URL=<Railway PostgreSQL plugin injects this automatically>
```

## Recommended ENV Variables

```
[ ] JWT_EXPIRES_IN=15m           (access token lifetime)
[ ] JWT_REFRESH_EXPIRES_IN=7d   (refresh token lifetime)
[ ] THROTTLE_TTL=60000          (rate limit window, ms)
[ ] THROTTLE_LIMIT=100          (max req per window per IP)
[ ] PORT=3000                   (Railway overrides this automatically)
```

## Optional ENV Variables

```
[ ] STRIPE_SECRET_KEY=sk_live_...       (when billing is implemented)
[ ] STRIPE_WEBHOOK_SECRET=whsec_...     (when Stripe webhooks are implemented)
```

---

## Secret Generation Commands

```bash
# Linux / macOS / WSL:
openssl rand -hex 32

# PowerShell:
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })

# Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Generate **two separate values** — one for `JWT_SECRET`, one for `JWT_REFRESH_SECRET`.
They MUST be different. The ENV validation will throw on startup if they are identical.

---

## Railway Environment Setup

### Step 1 — Connect PostgreSQL plugin
```
Railway dashboard → Project → Add service → Database → PostgreSQL
→ Connect to your backend service
→ DATABASE_URL is automatically injected
```

### Step 2 — Set secrets via Railway dashboard
```
Project → Backend service → Variables tab:
  NODE_ENV             = production
  JWT_SECRET           = <generated>
  JWT_REFRESH_SECRET   = <generated, different from JWT_SECRET>
  JWT_EXPIRES_IN       = 15m
  JWT_REFRESH_EXPIRES_IN = 7d
  CORS_ORIGIN          = https://your-frontend.up.railway.app
```

### Step 3 — Verify deployment
```bash
# After deploy, verify health:
curl https://your-backend.up.railway.app/health
# Expected: {"status":"ok","services":{"database":"ok"}}

# Verify Swagger is disabled:
curl https://your-backend.up.railway.app/api/docs
# Expected: 404 or HTML
```

---

## Token Lifetime Recommendations

| Token | Development | Production |
|---|---|---|
| Access token (`JWT_EXPIRES_IN`) | 15m or 1h | **15m** |
| Refresh token (`JWT_REFRESH_EXPIRES_IN`) | 7d | **7d** |

**Why 15 minutes for access tokens?**
- If an access token is stolen (e.g., via a logging mistake), it expires in 15 minutes
- The refresh token is in an httpOnly cookie — immune to XSS
- Clients simply call `POST /auth/refresh` silently to get a new access token

---

## Pre-Deploy Safety Checks

```
Code:
  [ ] All migration files committed (no pending entity changes without migration)
  [ ] No .env file committed to git (check: git ls-files | grep -E '^\.env$')
  [ ] npm run build passes without errors
  [ ] npm audit --audit-level=high passes

Infrastructure:
  [ ] Railway PostgreSQL plugin connected to backend service
  [ ] DATABASE_URL present in Railway env vars
  [ ] health endpoint returns {"status":"ok"} locally
  [ ] NODE_ENV=production is set in Railway

Security:
  [ ] JWT_SECRET ≠ JWT_REFRESH_SECRET
  [ ] Both secrets are >= 32 characters
  [ ] CORS_ORIGIN is set to exact frontend domain (no trailing slash)
  [ ] CORS_ORIGIN is NOT *
  [ ] Swagger is NOT accessible in production (test after deploy)

Functionality:
  [ ] POST /auth/register works
  [ ] POST /auth/login works and returns Set-Cookie header
  [ ] POST /auth/refresh works with cookie
  [ ] POST /auth/logout clears cookie
  [ ] Protected routes return 401 without valid token
  [ ] GET /health returns {"status":"ok","services":{"database":"ok"}}
```

---

## ENV Validation — What Happens on Missing Variables

The `validateEnv()` function in `src/common/config/env.validation.ts` runs at startup:

| Missing Variable | Error Message | When Checked |
|---|---|---|
| `JWT_SECRET` | `JWT_SECRET environment variable is required` | Always |
| `JWT_SECRET` < 32 chars | `JWT_SECRET must be at least 32 characters` | Always |
| `JWT_REFRESH_SECRET` (prod) | `JWT_REFRESH_SECRET is required in production` | Production only |
| `JWT_REFRESH_SECRET === JWT_SECRET` | `JWT_REFRESH_SECRET must be different from JWT_SECRET` | Production only |
| `CORS_ORIGIN` (prod) | `CORS_ORIGIN is required in production` | Production only |
| `CORS_ORIGIN=*` (prod) | `CORS_ORIGIN=* is not allowed in production` | Production only |
| DB vars (prod, no DATABASE_URL) | `DB_HOST is required in production when DATABASE_URL is not set` | Production only |

The app **crashes immediately** with a clear error message rather than starting in a broken state.

---

## Railway-Specific Notes

| Item | Notes |
|---|---|
| `PORT` | Railway sets `PORT` automatically — do NOT hardcode it |
| `DATABASE_URL` | Injected by Railway PostgreSQL plugin — do NOT set manually |
| `NODE_ENV` | Must be set manually to `production` in Railway variables |
| Migrations | Run automatically via `railway.toml` startCommand before app boot |
| Healthcheck | Railway uses `GET /health` with 30s timeout |
| Restart policy | `ON_FAILURE`, 3 retries — migration failures also trigger restart |
| Proxy headers | `trust proxy: 1` is set — real client IP is used for rate limiting |
| Scaling | If using multiple replicas, add Redis-backed ThrottlerStorage |
