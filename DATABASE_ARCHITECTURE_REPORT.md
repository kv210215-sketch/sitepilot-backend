# SitePilot Backend — Database Architecture Audit Report

> **Generated:** 2026-05-10  
> **Auditor:** Claude (automated)  
> **Branch audited:** `main` (SHA: b844605d)  
> **Scope:** `kv210215-sketch/sitepilot-backend`

---

## 1. Executive Summary

| Item | Status |
|---|---|
| Production DB connection | ✅ Safe (Railway injects `DATABASE_URL`) |
| `synchronize` in production | ✅ Off (`NODE_ENV=production` → `false`) |
| `synchronize` in development | ⚠️ ON — intentional but risky if NODE_ENV missing |
| Migrations | ✅ 1 migration, runs before app start on Railway |
| UUID extension dependency | 🔴 **RISK** — migration requires `uuid-ossp`, not auto-installed locally |
| Connection retries (TypeORM) | ⚠️ Not configured — relies on Railway restart policy |
| Healthcheck | ✅ `/health` endpoint with `SELECT 1` DB probe |
| Circular module imports | ✅ None detected |
| Orphaned databases | ⚠️ `sitepilot_backend` DB exists locally but is never referenced in code |
| `sitepilot-railway` repo | ℹ️ Contains only README — no backend code |

---

## 2. Repository Overview

### `kv210215-sketch/sitepilot-railway`
- **Status:** Empty / placeholder
- **Content:** Only `README.md`
- **Conclusion:** Not used as a backend. Possibly a Railway deploy config stub.

### `kv210215-sketch/sitepilot-backend`
- **Status:** Active NestJS backend
- **Tech stack:** NestJS 10, TypeORM 0.3, PostgreSQL, JWT Auth, Swagger
- **Conclusion:** This is the ONLY real backend. All database work is here.

---

## 3. Database Inventory

Three databases found in local pgAdmin:

| Database | Used in code | Environment | Status |
|---|---|---|---|
| `postgres` | ❌ No | — | System default DB, never reference in code |
| `sitepilot` | ✅ Yes | DEV local | **Active dev DB** — default in `.env.example`, docker-compose, TypeORM fallback |
| `sitepilot_backend` | ❌ No | — | **Orphaned** — not referenced anywhere in config or code |

### Which database is PRODUCTION?
On Railway: whatever `DATABASE_URL` points to (Railway PostgreSQL plugin auto-creates a DB and injects the URL). The database name inside Railway is typically `railway` but this is transparent — the app only sees the URL.

### Which database is DEV?
`sitepilot` — used by:
- `docker-compose.yml` (`POSTGRES_DB: sitepilot`)
- `.env.example` fallback (`DB_NAME=sitepilot`)
- `data-source.ts` hardcoded fallback (`|| 'sitepilot'`)
- `app.module.ts` hardcoded fallback (`|| 'sitepilot'`)

---

## 4. Environment Variable Mapping

### Priority chain (app.module.ts + data-source.ts):

```
DATABASE_URL set?
  ├─ YES → use url: DATABASE_URL  (Railway production path)
  └─ NO  → use individual params:
           DB_HOST     (default: 'localhost')
           DB_PORT     (default: 5432)
           DB_USER     (default: 'sitepilot')
           DB_PASSWORD (default: 'sitepilot')
           DB_NAME     (default: 'sitepilot')
```

### Full ENV reference table:

| Variable | Required | Default | Used in |
|---|---|---|---|
| `DATABASE_URL` | Prod (Railway injects) | — | app.module, data-source |
| `DB_HOST` | Dev only | `localhost` | app.module, data-source |
| `DB_PORT` | Dev only | `5432` | app.module, data-source |
| `DB_USER` | Dev only | `sitepilot` | app.module, data-source |
| `DB_PASSWORD` | Dev only | `sitepilot` | app.module, data-source |
| `DB_NAME` | Dev only | `sitepilot` | app.module, data-source |
| `NODE_ENV` | Both | `development` | Toggles synchronize, SSL, logging, Swagger |
| `PORT` | Both | `3000` | main.ts |
| `JWT_SECRET` | Both | ❌ **None — throws** | auth.module |
| `JWT_EXPIRES_IN` | Prod required | `7d` | auth.module |
| `CORS_ORIGIN` | Prod required | `*` | main.ts |

---

## 5. TypeORM Configuration Analysis

### 5.1 `app.module.ts` — Runtime NestJS connection

```typescript
{
  type: 'postgres',
  autoLoadEntities: true,       // ✅ good — entities via forFeature()
  synchronize: !isProduction,   // ⚠️  true in dev, false in prod
  ssl: url && isProd ? { rejectUnauthorized: false } : false,
  logging: !isProduction,
}
```

**`autoLoadEntities: true`** means entities registered via `TypeOrmModule.forFeature([...])` in any module are automatically picked up. No manual entity list needed here.

### 5.2 `data-source.ts` — TypeORM CLI connection

```typescript
{
  type: 'postgres',
  entities: [User, Project, Page, Subscription], // explicit list
  migrations: [InitialSchema1776200624919],        // explicit list
  synchronize: false, // always false — CLI only
  ssl: url && isProd ? { rejectUnauthorized: false } : false,
}
```

**Two DataSources** exist — one for the app runtime (NestJS DI), one for the CLI. This is correct architecture.

### 5.3 Naming Strategy
- **No custom naming strategy** is configured.
- TypeORM uses camelCase→camelCase by default.
- Table names are **explicitly set** in each entity via `@Entity('tableName')` — this overrides any naming strategy for tables.
- Column names match TypeScript property names (camelCase in DB, e.g. `userId`, `isPublished`).
- This is consistent with the migration SQL.

---

## 6. Entities Audit

### 6.1 Entity List

| Entity | Table | PK | Special Columns |
|---|---|---|---|
| `User` | `users` | uuid | `email` (UNIQUE), `password` (@Exclude), `role` ENUM |
| `Project` | `projects` | uuid | `userId` FK → users, `isPublished`, `publishedUrl` |
| `Page` | `pages` | uuid | `projectId` FK → projects, `content` JSONB, `order` |
| `Subscription` | `subscriptions` | uuid | `userId` FK → users (UNIQUE), `plan` ENUM, Stripe fields |

### 6.2 Relations

```
User ──(1:N)──> Project ──(1:N)──> Page
User ──(1:1)──> Subscription
```

All FK relations use `ON DELETE CASCADE` — deleting a User removes their Projects, Pages, and Subscription.

### 6.3 Circular Import Prevention

All entities use **string references** for relations instead of direct class imports:

```typescript
// User entity
@OneToMany('Project', 'user')   // ← string, not import
projects: any[];

@OneToOne('Subscription', 'user', { nullable: true, cascade: true })
subscription: any;
```

This avoids circular TypeScript import chains. TypeORM resolves the string at runtime.

**Result: No circular import issues detected.**

### 6.4 Module Import Chain (no circular deps)

```
AppModule
  ├── AuthModule
  │     ├── UsersModule  (exports UsersService)
  │     └── BillingModule (exports BillingService)
  ├── UsersModule
  ├── ProjectsModule
  ├── PagesModule
  ├── PublishModule
  ├── BillingModule
  └── HealthModule
```

No circular dependencies between modules.

---

## 7. Migration Audit

### 7.1 Migration inventory

| # | Migration | Status |
|---|---|---|
| 1 | `1776200624919-InitialSchema` | Creates all 4 tables + enums + FK constraints |

### 7.2 Migration content summary

Creates:
- `projects` table (uuid PK, FK → users)
- `users_role_enum` enum
- `users` table (uuid PK, email UNIQUE)
- `pages` table (uuid PK, jsonb content, FK → projects)
- `subscriptions_plan_enum` enum
- `subscriptions` table (uuid PK, UNIQUE userId, FK → users)

Includes `down()` method that reverses all changes in correct order.

### 7.3 🔴 CRITICAL: uuid_generate_v4() Extension Dependency

The migration uses:
```sql
"id" uuid NOT NULL DEFAULT uuid_generate_v4()
```

This requires the `uuid-ossp` PostgreSQL extension. **The migration does NOT install it.**

| Environment | Risk |
|---|---|
| Railway PostgreSQL | ✅ Safe — Railway pre-installs `uuid-ossp` |
| Docker (docker-compose) | ✅ Safe — typically available |
| **Local PostgreSQL 17** | 🔴 **FAILS** if `uuid-ossp` not enabled |

**Fix required for local startup:** Run before migrations:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

Note: TypeORM generates UUIDs in JavaScript via `@PrimaryGeneratedColumn('uuid')`, so INSERT operations will not hit the DB default. However, **the migration itself fails to execute** if the extension doesn't exist when creating the table.

### 7.4 Migration execution flow (Production/Railway)

```
railway.toml startCommand:
  node dist/database/run-migrations
    → AppDataSource.initialize()
    → ds.showMigrations()   ← checks migrations_table
    → ds.runMigrations({ transaction: 'each' })  ← if pending
    → ds.destroy()
  node dist/main
    → NestJS bootstrap
    → TypeOrmModule connects
    → App ready
```

Each migration runs in its own transaction (`transaction: 'each'`). If a migration fails, the transaction is rolled back and `process.exit(1)` is called — the app never starts.

### 7.5 Migration execution flow (Local / CLI)

```bash
npm run db:migrate:run
# → typeorm-ts-node-commonjs migration:run -d src/data-source.ts
```

---

## 8. synchronize Setting Analysis

### Current behavior

| `NODE_ENV` | `DATABASE_URL` | `synchronize` | Risk |
|---|---|---|---|
| `development` | not set | **true** | ⚠️ Auto-alters schema |
| `development` | set | **true** | ⚠️ Auto-alters schema |
| `production` | set (Railway) | **false** | ✅ Safe |
| `production` | not set | **false** | ✅ Safe (but app may fail — DB_HOST required) |
| *not set* | not set | **true** | 🔴 DANGER — treats as dev |

### The `synchronize: true` danger in dev

`synchronize: true` means TypeORM compares entity definitions to the actual DB schema on every app start and issues `ALTER TABLE` / `CREATE TABLE` DDL automatically. This:
- Can **silently drop columns** if you remove a property from an entity
- Can **silently rename columns** if you rename a property
- Can **corrupt data** if the auto-generated SQL is incorrect

**This is acceptable for local development only.** Never acceptable in production or staging.

### Recommended guard

The current code correctly guards with `!isProduction`. The only gap is if `NODE_ENV` is not set at all — it defaults to `development` (truthy `synchronize`). Add a startup validation:

```typescript
if (!process.env.NODE_ENV) {
  console.warn('NODE_ENV is not set — defaulting to development mode');
}
```

---

## 9. Healthcheck Audit

### `/health` endpoint (`src/health/health.controller.ts`)

```typescript
await this.dataSource.query('SELECT 1');
```

Returns:
```json
{
  "status": "ok" | "degraded",
  "timestamp": "ISO8601",
  "uptime": 123,
  "services": {
    "database": "ok" | "error"
  }
}
```

| Aspect | Status |
|---|---|
| DB connectivity check | ✅ `SELECT 1` query |
| Graceful degraded state | ✅ returns `degraded` (not 500) if DB is down |
| Railway integration | ✅ `healthcheckPath = "/health"` in railway.toml |
| Timeout configured | ✅ `healthcheckTimeout = 30` seconds |
| Restart on failure | ✅ `ON_FAILURE`, max 3 retries |

### Connection Retry Gap

TypeORM does **not** have `retryAttempts` or `retryDelay` configured. If the DB is slow to start (e.g., first Railway deploy), the app bootstrap may fail before the DB is ready.

**Mitigation in production:** `run-migrations.ts` must connect first — if it fails, the app never starts, and Railway's `ON_FAILURE` restart policy retries up to 3 times with increasing delays.

**Mitigation for local:** PostgreSQL must be running before `npm run dev`. The `docker-compose.yml` healthcheck ensures postgres is ready before other services.

**Recommended improvement:**
```typescript
// In TypeOrmModule.forRootAsync useFactory:
retryAttempts: 10,
retryDelay: 3000, // 3 seconds
```

---

## 10. Local vs Railway Differences

| Aspect | Local (PostgreSQL 17) | Railway (Cloud) |
|---|---|---|
| Connection | `DB_HOST/PORT/USER/PASSWORD/NAME` | `DATABASE_URL` (auto-injected) |
| Database name | `sitepilot` | `railway` (internal, transparent) |
| SSL | Disabled | `{ rejectUnauthorized: false }` |
| synchronize | `true` (NODE_ENV=development) | `false` (NODE_ENV=production) |
| Migrations | `npm run db:migrate:run` | Auto via `run-migrations` pre-start |
| uuid-ossp | Must enable manually | Pre-installed |
| Swagger UI | Available at `/api/docs` | Disabled |
| SQL logging | Enabled | Disabled |
| Port | 3000 (or .env PORT) | Railway assigns dynamically via `PORT` env |

---

## 11. Production Risk Assessment

| Risk | Severity | Status | Recommendation |
|---|---|---|---|
| `synchronize=true` in prod | 🔴 Critical | ✅ Mitigated by NODE_ENV check | Ensure `NODE_ENV=production` always set on Railway |
| Missing `uuid-ossp` extension | 🔴 Critical | ⚠️ Local only | Run `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` before first migration |
| No TypeORM retry config | 🟡 Medium | ⚠️ Railway restart handles it | Add `retryAttempts: 10, retryDelay: 3000` |
| `JWT_SECRET` not set | 🟡 Medium | ✅ Throws on startup | Ensure set in Railway env vars |
| `CORS_ORIGIN=*` in prod | 🟡 Medium | Blocked by validation | Ensure `CORS_ORIGIN` set to specific domain |
| `sitepilot_backend` orphan DB | 🟢 Low | Informational | Can be safely deleted from local pgAdmin |
| No staging environment | 🟡 Medium | Informational | Consider Railway staging service |
| Single migration file | 🟢 Low | OK for now | Future changes need new migration files |

---

## 12. Recommended Architecture

### ENV setup per environment

**Local development:**
```env
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_USER=sitepilot
DB_PASSWORD=sitepilot
DB_NAME=sitepilot
JWT_SECRET=dev-only-secret-min-32-chars-long
```

**Railway production:**
```env
NODE_ENV=production
DATABASE_URL=<auto-injected by Railway PostgreSQL plugin>
JWT_SECRET=<strong-random-secret>
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://your-frontend.up.railway.app
```

### Safe migration workflow

```bash
# 1. Make entity change
# 2. Generate migration (name it descriptively)
npm run db:migrate:generate --name=AddUserAvatarColumn
# 3. Review generated SQL in src/database/migrations/
# 4. Apply locally
npm run db:migrate:run
# 5. Test
# 6. Commit migration file — Railway will auto-apply on next deploy
```

### Never do in production
- ❌ `synchronize: true`
- ❌ Manual `DROP TABLE` without migration
- ❌ `migration:revert` in production without backup
- ❌ Editing existing migration files after they've been applied
- ❌ Deleting `migrations` table from DB

---

## 13. Can backend start locally with PostgreSQL 17?

**Yes — with one prerequisite.**

Before running migrations on a fresh PostgreSQL 17 database, the `uuid-ossp` extension must be enabled:

```sql
-- Run once in psql or pgAdmin connected to 'sitepilot' database:
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

After that:
1. `npm install`
2. `npm run db:migrate:run`
3. `npm run dev`

Alternatively, use `SAFE_DATABASE_INIT.ps1` which handles the extension automatically.

---

## 14. Summary Recommendations

1. **Immediately:** Enable `uuid-ossp` extension in local `sitepilot` database before running migrations.
2. **Short term:** Add `retryAttempts: 10, retryDelay: 3000` to TypeORM config in `app.module.ts`.
3. **Short term:** Delete the orphaned `sitepilot_backend` database from local pgAdmin.
4. **Good practice:** Never commit a real `.env` file — only `.env.example`.
5. **Good practice:** Keep `synchronize: false` in a future staging env and always use migrations.
6. **Future:** Add a second migration guard — a startup check that `migrations` table is up to date.
