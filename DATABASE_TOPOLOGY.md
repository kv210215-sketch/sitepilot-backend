# Database Topology — SitePilot Backend

**Date:** 2026-05-11
**Branch:** `claude/audit-backend-database-R4noy`

---

## 1. Environment Map

```
┌─────────────────────────────────────────────────────────────────────┐
│  LOCAL DEVELOPER MACHINE                                            │
│                                                                     │
│  ┌──────────────────────────────┐                                   │
│  │  PostgreSQL 16/17            │                                   │
│  │  localhost:5432              │                                   │
│  │                              │                                   │
│  │  ✅ sitepilot          ◄─────┼── CANONICAL DEV DATABASE          │
│  │     owner: sitepilot         │   (all config points here)        │
│  │     used by: all dev tooling │                                   │
│  │                              │                                   │
│  │  ⚠️  sitepilot_backend  ──────┼── ORPHANED (zero code refs)       │
│  │     owner: unknown           │   safe to drop                    │
│  │                              │                                   │
│  │  🔒 postgres            ──────┼── system default, never used      │
│  └──────────────────────────────┘                                   │
│                                                                     │
│  Docker Compose: postgres:16-alpine                                 │
│    POSTGRES_DB:   sitepilot                                         │
│    POSTGRES_USER: sitepilot                                         │
│    POSTGRES_PASSWORD: sitepilot                                     │
│    port: 5432 → 5432                                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  CI — GitHub Actions                                                │
│                                                                     │
│  ❌ NO DATABASE CONNECTION                                          │
│     Unit tests only — no DB required                               │
│     No DB container in workflow                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  PRODUCTION — Railway                                               │
│                                                                     │
│  ┌──────────────────────────────┐                                   │
│  │  Railway PostgreSQL Plugin   │                                   │
│  │  (managed, cloud)            │                                   │
│  │                              │                                   │
│  │  ✅ railway (internal name)  │◄── auto-created by Railway plugin │
│  │     DATABASE_URL injected    │    name transparent to app        │
│  │     via environment variable │                                   │
│  └──────────────────────────────┘                                   │
│                                                                     │
│  App reads: process.env.DATABASE_URL                                │
│  SSL: { rejectUnauthorized: false }                                 │
│  synchronize: false (NODE_ENV=production baked into Docker image)   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Connection Routing Logic

```
Application starts
│
├── DATABASE_URL set?
│   ├── YES (Railway production)
│   │   └── TypeORM connects via URL
│   │       SSL: { rejectUnauthorized: false }
│   │       synchronize: false
│   │       retryAttempts: 10, retryDelay: 3000ms
│   │
│   └── NO (local development)
│       └── TypeORM connects via individual params
│           host:     DB_HOST     || 'localhost'
│           port:     DB_PORT     || 5432
│           username: DB_USER     || 'sitepilot'
│           password: DB_PASSWORD || 'sitepilot'
│           database: DB_NAME     || 'sitepilot'
│           SSL: false
│           synchronize: true (dev mode)
│           retryAttempts: 10, retryDelay: 3000ms
```

---

## 3. Migration Flow Per Environment

### 3.1 Railway Production

```
git push origin main
    │
    ▼
GitHub Actions
    │ npm ci + build check
    ▼
Railway Build
    │ Docker image built (multi-stage)
    │ ENV NODE_ENV=production baked in
    ▼
Railway Deploy
    │
    ├── node dist/database/run-migrations
    │       │
    │       ├── AppDataSource.initialize()
    │       │   reads DATABASE_URL from Railway env
    │       │
    │       ├── ds.showMigrations()
    │       │   queries typeorm_migrations table
    │       │
    │       ├── ds.runMigrations({ transaction: 'each' })
    │       │   runs any pending migrations
    │       │   each migration in own transaction
    │       │   failure → rollback → process.exit(1)
    │       │
    │       └── ds.destroy()
    │
    └── node dist/main
            │
            ├── NestJS bootstrap
            ├── TypeOrmModule.forRootAsync()
            │   retryAttempts: 10, retryDelay: 3000ms
            └── App listening on PORT
```

### 3.2 Local Development

```
docker compose up -d postgres
    │ PostgreSQL 16 starts on localhost:5432
    │ POSTGRES_DB=sitepilot, POSTGRES_USER=sitepilot
    ▼
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    ← one-time, per fresh DB
    ▼
npm run db:migrate:run
    │ typeorm-ts-node-commonjs migration:run
    │ reads DB_* from .env (or defaults to sitepilot)
    │ runs InitialSchema1776200624919 if pending
    ▼
npm run dev
    │ NestJS starts with synchronize: true
    │ connects to localhost:5432/sitepilot
    ▼
App ready at localhost:3000
```

---

## 4. Database Object Inventory

### Tables (post-migration)

```
sitepilot (local) / railway (prod)
│
├── typeorm_migrations          (TypeORM internal)
│     id, timestamp, name
│
├── users_role_enum             (PostgreSQL ENUM type)
│     values: 'admin', 'user'
│
├── subscriptions_plan_enum     (PostgreSQL ENUM type)
│     values: 'free', 'pro', 'agency'
│
├── users
│     id          uuid PK DEFAULT uuid_generate_v4()
│     email       varchar UNIQUE NOT NULL
│     password    varchar NOT NULL
│     name        varchar
│     role        users_role_enum DEFAULT 'user'
│     createdAt   timestamp DEFAULT now()
│     updatedAt   timestamp DEFAULT now()
│
├── projects
│     id          uuid PK DEFAULT uuid_generate_v4()
│     name        varchar NOT NULL
│     description varchar
│     slug        varchar
│     userId      uuid FK → users(id) ON DELETE CASCADE
│     isPublished boolean DEFAULT false
│     publishedUrl varchar
│     createdAt   timestamp DEFAULT now()
│     updatedAt   timestamp DEFAULT now()
│
├── pages
│     id              uuid PK DEFAULT uuid_generate_v4()
│     title           varchar NOT NULL
│     slug            varchar
│     content         jsonb DEFAULT '{}'
│     isPublished     boolean DEFAULT false
│     projectId       uuid FK → projects(id) ON DELETE CASCADE
│     metaTitle       varchar
│     metaDescription varchar
│     order           integer DEFAULT 0
│     createdAt       timestamp DEFAULT now()
│     updatedAt       timestamp DEFAULT now()
│
└── subscriptions
      id                   uuid PK DEFAULT uuid_generate_v4()
      userId               uuid FK → users(id) ON DELETE CASCADE UNIQUE
      plan                 subscriptions_plan_enum DEFAULT 'free'
      stripeCustomerId     varchar
      stripeSubscriptionId varchar
      currentPeriodEnd     timestamptz
      isActive             boolean DEFAULT true
      createdAt            timestamp DEFAULT now()
      updatedAt            timestamp DEFAULT now()
```

### Relation graph

```
users (1) ──── (N) projects (1) ──── (N) pages
  │
  └─── (1) subscriptions
```

All foreign keys use `ON DELETE CASCADE`. Deleting a user removes all their projects, pages, and subscription automatically.

---

## 5. Extension Requirements

| Extension | Required by | Railway | Docker (PG 16 alpine) | Local PG 15-17 |
|---|---|---|---|---|
| `uuid-ossp` | Migration DDL (`uuid_generate_v4()`) | ✅ Pre-installed | ⚠️ Must activate | ⚠️ Must activate |

One-time activation command (run once per fresh database):
```sql
\c sitepilot
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## 6. Migration Registry

| # | Name | Timestamp | Status |
|---|---|---|---|
| 1 | `InitialSchema1776200624919` | 1776200624919 | Applied on Railway; pending on fresh local DB |

All future schema changes must be implemented as new numbered migration files — never by editing `InitialSchema1776200624919`.

---

## 7. Data Flow: API Request → Database

```
HTTP Request
    │
    ├── RequestIdMiddleware (assigns X-Request-Id)
    ├── ThrottlerGuard (rate limit check — no DB)
    ├── JwtAuthGuard (validates JWT signature — no DB)
    ▼
Controller
    ▼
Service
    ├── UsersRepository     → users table
    ├── ProjectsRepository  → projects table
    ├── PagesRepository     → pages table
    └── BillingRepository   → subscriptions table
    ▼
TypeORM (connection pool)
    ▼
PostgreSQL
```

No Redis, no queue, no external cache in current architecture. All state lives in PostgreSQL.

---

## 8. Local vs Production Differences Summary

| Aspect | Local | Production (Railway) |
|---|---|---|
| Database name | `sitepilot` | `railway` (internal, opaque) |
| Connection method | `DB_*` env vars | `DATABASE_URL` |
| SSL | Disabled | `rejectUnauthorized: false` |
| `synchronize` | `true` | `false` |
| Migration trigger | Manual: `npm run db:migrate:run` | Automatic: pre-start command |
| `uuid-ossp` | Manual: `CREATE EXTENSION` | Pre-installed |
| Swagger | Available at `/api/docs` | Disabled |
| SQL logging | Enabled | Disabled |
| `NODE_ENV` | `development` (from `.env`) | `production` (Docker `ENV`) |
