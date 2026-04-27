# SitePilot Backend

Production-ready SaaS backend for website automation, SEO and AI tools.
Built with **NestJS 10 + TypeORM + PostgreSQL**.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20, TypeScript 5 |
| Framework | NestJS 10 |
| Database | PostgreSQL 16 via TypeORM |
| Auth | JWT (passport-jwt) + bcrypt |
| Docs | Swagger UI @ `/api/docs` |
| Deployment | Railway / Docker |

---

## Modules & Endpoints

| Module | Base path | Description |
|---|---|---|
| **health** | `GET /health` | App and DB liveness check |
| **auth** | `POST /auth/register` `POST /auth/login` `GET /auth/me` | JWT-based authentication |
| **users** | `/users/me` | Profile management |
| **projects** | `/projects` | Full CRUD, user-scoped |
| **pages** | `/projects/:projectId/pages` | Full CRUD, nested under project |
| **publish** | `POST /publish/project/:id` | Publish project, persist state |
| **billing** | `/billing/subscription` `/billing/plan` | Plan management (Stripe-ready) |

All protected routes require `Authorization: Bearer <token>` header.

---

## Quickstart — One-command local dev

### Option A: Native PostgreSQL (if already installed)

```bash
# Start postgres, create DB and user
service postgresql start
sudo -u postgres psql -c "CREATE USER sitepilot WITH PASSWORD 'sitepilot';"
sudo -u postgres psql -c "CREATE DATABASE sitepilot OWNER sitepilot;"

# Clone, install, seed
cp .env.example .env
npm install
SEED_ADMIN_PASSWORD='local-seed-password-min-12-chars' npm run db:seed
npm run start:dev       # http://localhost:3000
```

### Option B: Docker Compose

```bash
cp .env.example .env
npm install
npm run dev:db          # starts postgres container (docker compose)
# wait ~5 seconds for postgres to be healthy
SEED_ADMIN_PASSWORD='local-seed-password-min-12-chars' npm run db:seed
npm run start:dev
```

### Fastest test (2 commands after npm install):

```bash
npm run dev:db && sleep 5 && npm run start:dev
```

---

## All Available Scripts

```bash
# Development
npm run start:dev       # start with hot-reload (dev)
npm run start:prod      # run compiled output (production)
npm run dev             # alias for start:dev
npm run build           # compile TypeScript → dist/

# Docker
npm run dev:db          # start postgres container only
npm run dev:up          # start all services (postgres)
npm run dev:down        # stop all containers

# Database
npm run db:seed         # seed demo user + project + page; requires SEED_ADMIN_PASSWORD
npm run db:migrate:run  # run pending TypeORM migrations
npm run db:migrate:revert    # revert last migration
# npm run db:migrate:generate --name=MigrationName  # generate new migration
```

---

## Environment Variables

Copy `.env.example` to `.env`. See `docs/environment.md` for the production requirements and guardrails.

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | no | `3000` | HTTP port |
| `NODE_ENV` | no | `development` | `development` or `production` |
| `DATABASE_URL` | production option | — | Full postgres URL, often injected by Railway |
| `DB_HOST` | production if no `DATABASE_URL` | `localhost` in local dev | Postgres host |
| `DB_PORT` | production if no `DATABASE_URL` | `5432` | Postgres port |
| `DB_USER` | production if no `DATABASE_URL` | `sitepilot` in local dev | Postgres username |
| `DB_PASSWORD` | production if no `DATABASE_URL` | `sitepilot` in local dev | Postgres password |
| `DB_NAME` | production if no `DATABASE_URL` | `sitepilot` in local dev | Database name |
| `JWT_SECRET` | **required** | — | Strong JWT signing secret |
| `JWT_EXPIRES_IN` | production | `7d` in local dev | Token lifetime |
| `CORS_ORIGIN` | production | `*` in local dev | Frontend origin(s), comma-separated |
| `SEED_ADMIN_PASSWORD` | only for `npm run db:seed` | — | Seed admin password, minimum 12 characters |
| `SEED_ADMIN_EMAIL` | no | `admin@sitepilot.local` | Seed admin email |

> **Before production:** generate a secure JWT_SECRET with `openssl rand -hex 32`.

---

## Swagger API Docs

Available at **[http://localhost:3000/api/docs](http://localhost:3000/api/docs)** in development.

Click **Authorize** → enter your `Bearer <token>` to test protected routes interactively.

---

## Database

### Development
`NODE_ENV=development` → `synchronize: true` — TypeORM auto-syncs schema on every restart.
No need to run migrations manually in local dev.

### Production (Railway)
`NODE_ENV=production` → `synchronize: false`. Migrations run automatically via `railway.toml`:
```
startCommand = "node dist/database/run-migrations && node dist/main"
```
This runs `dist/database/run-migrations.js` before the app starts, applying any pending migrations.
The initial migration (`1776200624919-InitialSchema.ts`) creates all tables on a fresh DB.

### Migration workflow for schema changes
```bash
# 1. Change entity files
# 2. Generate migration (uses an empty DB to diff)
DB_NAME=sitepilot_empty npm run db:migrate:generate --name=AddColumnToProjects

# 3. Review the generated file in src/database/migrations/
# 4. Apply to dev DB (if dev DB is not fresh)
npm run db:migrate:run

# 5. Rollback if needed
npm run db:migrate:revert
```

### Stamping an existing DB (sync → migration switch)
If the DB was previously created via `synchronize: true`, stamp the migration as applied:
```sql
INSERT INTO migrations (timestamp, name) VALUES (1776200624919, 'InitialSchema1776200624919');
```

---

## Data Model

```
User
 ├── id, email, password(hashed), name, role(user|admin)
 ├── subscription → Subscription (1:1)
 └── projects → Project[] (1:many)

Project
 ├── id, name, description, slug, userId
 ├── isPublished, publishedUrl
 └── pages → Page[] (1:many)

Page
 ├── id, title, slug, content(jsonb), projectId
 ├── isPublished, order, metaTitle, metaDescription
 └── (FK → Project, cascades on delete)

Subscription
 ├── id, userId, plan(free|pro|agency)
 ├── isActive, stripeCustomerId, stripeSubscriptionId, currentPeriodEnd
 └── (FK → User, cascades on delete)
```

---

## Billing & Plans

| Plan | Value |
|---|---|
| `free` | Default for all new users |
| `pro` | Future paid tier |
| `agency` | Future high-volume tier |

**Stripe integration hooks** are scaffolded in `BillingService`:
- `activateSubscription()` — call from Stripe webhook on `invoice.paid`
- `cancelSubscription()` — call from Stripe webhook on `customer.subscription.deleted`

---

## Deploy to Railway

1. Create Railway project → **Add PostgreSQL** plugin
2. Railway auto-injects `DATABASE_URL` — no DB config needed
3. Set these env vars in Railway dashboard:
   - `JWT_SECRET` = `$(openssl rand -hex 32)`
   - `JWT_EXPIRES_IN` = `7d` or your chosen token lifetime
   - `NODE_ENV` = `production`
   - `CORS_ORIGIN` = `https://yourdomain.com`
4. Connect this repo — Railway detects `Dockerfile` and builds automatically
5. Health check is configured at `GET /health` (see `railway.toml`)

---

## API Quick Reference

```bash
BASE=http://localhost:3000

# Health
curl $BASE/health

# Register
curl -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"password123","name":"You"}'

# Login → get token
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"password123"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

# Me
curl $BASE/auth/me -H "Authorization: Bearer $TOKEN"

# Create project
PROJECT=$(curl -s -X POST $BASE/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"My Site"}')
PROJECT_ID=$(echo $PROJECT | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

# List projects
curl $BASE/projects -H "Authorization: Bearer $TOKEN"

# Create page
curl -X POST $BASE/projects/$PROJECT_ID/pages \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Home","content":{"blocks":[]}}'

# Publish
curl -X POST $BASE/publish/project/$PROJECT_ID \
  -H "Authorization: Bearer $TOKEN"

# Billing
curl $BASE/billing/subscription -H "Authorization: Bearer $TOKEN"
```

---

## Project Structure

```
src/
├── main.ts                     # Bootstrap, Swagger, CORS, pipes
├── app.module.ts               # Root module, TypeORM config
├── data-source.ts              # TypeORM CLI data source (migrations)
├── auth/                       # JWT auth, guards, decorators
├── users/                      # User entity + profile management
├── projects/                   # Project CRUD (user-scoped)
├── pages/                      # Page CRUD (project-scoped)
├── publish/                    # Publish logic (extensible)
├── billing/                    # Subscription + plan management
├── health/                     # GET /health
├── common/utils/               # Shared utilities (slugify)
└── database/
    ├── seed.ts                 # Dev seed script
    └── migrations/             # TypeORM migration files
```

---

## Next Steps for Frontend / Dashboard Integration

- [ ] Add `CORS_ORIGIN` to your actual frontend domain
- [ ] Implement Stripe webhook endpoint → call `BillingService.activateSubscription()`
- [ ] Add `@Roles(UserRole.ADMIN)` guard for admin-only routes
- [ ] Add refresh token endpoint when access tokens expire
- [ ] Add `content` schema validation once page builder format is finalized
- [ ] Generate TypeORM migrations before disabling `synchronize` in production
- [ ] Add rate limiting (`@nestjs/throttler`) before going public
