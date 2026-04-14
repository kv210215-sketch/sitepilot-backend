# SitePilot Backend

SaaS backend for website automation, SEO and AI tools. Built with NestJS + TypeORM + PostgreSQL.

## Stack

- **Runtime**: Node.js 20, TypeScript
- **Framework**: NestJS 10
- **Database**: PostgreSQL via TypeORM
- **Auth**: JWT (passport-jwt) + bcrypt
- **Deployment**: Railway / Docker

## Modules

| Module | Endpoints |
|---|---|
| **auth** | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| **users** | `GET /users/me`, `PATCH /users/me`, `DELETE /users/me` |
| **projects** | `GET/POST /projects`, `GET/PATCH/DELETE /projects/:id` |
| **pages** | `GET/POST /projects/:projectId/pages`, `GET/PATCH/DELETE /projects/:projectId/pages/:id` |
| **publish** | `POST /publish/project/:id` |
| **billing** | `GET /billing/subscription`, `PATCH /billing/plan` |
| **health** | `GET /health` |

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 14+

### Local Development

```bash
# 1. Clone and install
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set DB credentials and JWT_SECRET

# 3. Create database
createdb sitepilot

# 4. Start dev server (auto-syncs schema)
npm run start:dev
```

App will be available at `http://localhost:3000`.

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | * | Full PostgreSQL URL (Railway provides this automatically) |
| `DB_HOST` | local | Postgres host (if not using DATABASE_URL) |
| `DB_PORT` | local | Postgres port (default: 5432) |
| `DB_USER` | local | Postgres username |
| `DB_PASSWORD` | local | Postgres password |
| `DB_NAME` | local | Database name |
| `JWT_SECRET` | required | Secret for signing JWTs — **change in production** |
| `JWT_EXPIRES_IN` | optional | Token TTL (default: `7d`) |
| `PORT` | optional | Server port (default: `3000`) |
| `NODE_ENV` | optional | `development` or `production` |
| `CORS_ORIGIN` | optional | Allowed origin(s), comma-separated or `*` |

### Database Schema

Schema is auto-synchronized in development (`synchronize: true`). In production set `NODE_ENV=production` to disable auto-sync and use migrations instead.

## Deploy to Railway

1. Create a new Railway project
2. Add a **PostgreSQL** plugin — `DATABASE_URL` is injected automatically
3. Set environment variables: `JWT_SECRET`, `NODE_ENV=production`
4. Railway auto-detects the `Dockerfile` and builds

## Build & Production

```bash
npm run build          # compile TypeScript to dist/
npm run start:prod     # run compiled output
```

## Plans

| Plan | Value |
|---|---|
| `free` | Default for all new users |
| `pro` | Future paid tier |
| `agency` | Future high-volume tier |

Stripe integration hooks are scaffolded in `BillingService` — connect `activateSubscription` and `cancelSubscription` to your Stripe webhook handler.

## API Examples

### Register
```bash
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"password123","name":"Alice"}'
```

### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Create Project
```bash
curl -X POST http://localhost:3000/projects \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"name":"My Site","description":"A landing page"}'
```

### Publish Project
```bash
curl -X POST http://localhost:3000/publish/project/<projectId> \
  -H 'Authorization: Bearer <token>'
```
