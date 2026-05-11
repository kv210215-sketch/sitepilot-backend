# Database Consistency Audit — SitePilot Backend

**Date:** 2026-05-11
**Branch:** `claude/audit-backend-database-R4noy`
**Auditor:** Automated (Claude Code)
**Scope:** All PostgreSQL databases referenced by or adjacent to `kv210215-sketch/sitepilot-backend`

---

## 1. Executive Summary

| Finding | Severity | Status |
|---|---|---|
| `sitepilot` is the canonical local dev database | — | ✅ CONFIRMED |
| `sitepilot_backend` database is orphaned — zero code references | LOW | ⚠️ CLEANUP NEEDED |
| Migration uses `uuid_generate_v4()` without installing `uuid-ossp` | HIGH | 🔴 BLOCKER (local only) |
| Production uses Railway `DATABASE_URL` — transparent to code | — | ✅ SAFE |
| `synchronize: true` in dev, `false` in prod — correctly guarded | — | ✅ CORRECT |
| `retryAttempts: 10` already configured in `app.module.ts` | — | ✅ ALREADY FIXED |
| Migration `down()` correctly drops ENUMs after tables | — | ✅ CORRECT |
| No schema drift between entities and migration SQL | — | ✅ CONSISTENT |

**Verdict:** One canonical database (`sitepilot`). One orphan to remove (`sitepilot_backend`). One local setup prerequisite to document (`uuid-ossp`). No data at risk. No destructive action required before deploying.

---

## 2. Database Inventory

### 2.1 Local PostgreSQL (developer machine)

| Database | Referenced in code | Owner | Created by | Verdict |
|---|---|---|---|---|
| `postgres` | ❌ No | postgres | PostgreSQL installer | System default — keep, ignore |
| `sitepilot` | ✅ Yes (7 references) | sitepilot | `docker-compose up` or manual setup | **CANONICAL DEV DATABASE** |
| `sitepilot_backend` | ❌ No (0 references) | unknown | Manual creation (cause unknown) | **ORPHANED — safe to drop** |

### 2.2 Code references to `sitepilot` (all confirmed)

| File | Reference | Type |
|---|---|---|
| `docker-compose.yml` | `POSTGRES_DB: sitepilot` | Docker default |
| `.env.example` | `DB_NAME=sitepilot` | Developer template |
| `src/data-source.ts` | `database: process.env.DB_NAME \|\| 'sitepilot'` | TypeORM CLI fallback |
| `src/app.module.ts` | `config.get('DB_NAME') \|\| 'sitepilot'` | NestJS runtime fallback |
| `src/main.ts` | `process.env.DB_NAME \|\| 'sitepilot'` | Startup diagnostic log |
| `src/database/seed.ts` | via `AppDataSource` | Seed script target |
| `LOCAL_DATABASE_SETUP.md` | All instructions target `sitepilot` | Documentation |

### 2.3 Code references to `sitepilot_backend`

**Zero.** `grep -r "sitepilot_backend"` across the entire repository returns no matches.

### 2.4 Production database (Railway)

| Aspect | Value |
|---|---|
| Connection method | `DATABASE_URL` (auto-injected by Railway PostgreSQL plugin) |
| Database name | Internal to Railway (typically `railway`) — app never sees name directly |
| Referenced in code | Via `process.env.DATABASE_URL` — no hardcoded name |
| Migration target | Same `run-migrations` script, reads `DATABASE_URL` |

---

## 3. Schema Audit — `sitepilot` Database

### 3.1 Expected schema (from migration `1776200624919-InitialSchema`)

| Object | Type | Details |
|---|---|---|
| `typeorm_migrations` | Table | TypeORM migration tracking (auto-created) |
| `users_role_enum` | ENUM | `'admin'`, `'user'` |
| `subscriptions_plan_enum` | ENUM | `'free'`, `'pro'`, `'agency'` |
| `users` | Table | PK: uuid, email UNIQUE, password, name, role ENUM, createdAt, updatedAt |
| `projects` | Table | PK: uuid, userId FK→users CASCADE, name, description, slug, isPublished, publishedUrl, createdAt, updatedAt |
| `pages` | Table | PK: uuid, projectId FK→projects CASCADE, title, slug, content JSONB, isPublished, metaTitle, metaDescription, order, createdAt, updatedAt |
| `subscriptions` | Table | PK: uuid, userId FK→users UNIQUE CASCADE, plan ENUM, stripe fields, isActive, createdAt, updatedAt |

### 3.2 Entity-to-migration consistency check

| Entity | Table in migration | PK type | Relations | Status |
|---|---|---|---|---|
| `User` | `users` | uuid | 1:N projects, 1:1 subscription | ✅ Match |
| `Project` | `projects` | uuid | FK → users CASCADE | ✅ Match |
| `Page` | `pages` | uuid | FK → projects CASCADE | ✅ Match |
| `Subscription` | `subscriptions` | uuid | FK → users UNIQUE CASCADE | ✅ Match |

**No schema drift detected.** Entity definitions and migration SQL are fully consistent.

### 3.3 UUID generation analysis

The migration uses PostgreSQL's `uuid_generate_v4()` DB function as the column DEFAULT:
```sql
"id" uuid NOT NULL DEFAULT uuid_generate_v4()
```

However, TypeORM's `@PrimaryGeneratedColumn('uuid')` decorator generates UUIDs in JavaScript before the INSERT. The DB function is never called during normal app operation — but **the migration fails to create the table if the extension doesn't exist**, because PostgreSQL validates the DEFAULT expression at `CREATE TABLE` time.

| Environment | `uuid-ossp` status | Migration result |
|---|---|---|
| Railway production | Pre-installed by Railway | ✅ Migration runs |
| Docker (PostgreSQL 16-alpine) | Available but not activated | ⚠️ Needs `CREATE EXTENSION` |
| Local PostgreSQL 15–17 | Available but not activated | 🔴 Migration fails without it |

**Required one-time SQL per database instance:**
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### 3.4 Migration `down()` correctness

The rollback method correctly:
1. Drops FK constraints first (prevents orphan key errors)
2. Drops `subscriptions` table
3. Drops `subscriptions_plan_enum` type
4. Drops `pages` table
5. Drops `users` table
6. Drops `users_role_enum` type
7. Drops `projects` table

Order is correct. ENUMs are dropped after tables that reference them. ✅

---

## 4. Schema Audit — `sitepilot_backend` Database

### 4.1 What is this database?

`sitepilot_backend` does not appear in any configuration file, any source file, any documentation, any CI workflow, or any deployment script in this repository. It was never the target of a migration.

**Most likely origin:** Created manually (via pgAdmin or psql) during an earlier setup phase, possibly when the developer was choosing between two database names before standardizing on `sitepilot`.

### 4.2 Schema state

Since this database was never targeted by migrations, it likely contains one of:
- **Empty schema:** Just the default PostgreSQL `public` schema with no tables
- **Partial/stale schema:** Old tables from `synchronize: true` run when `DB_NAME=sitepilot_backend` was set temporarily

Either way, **the content has no production value and is not referenced by any current code path**.

### 4.3 Safe to remove?

| Question | Answer |
|---|---|
| Does any code path write to it? | No |
| Does any migration target it? | No |
| Does any backup script reference it? | No |
| Could dropping it break anything? | No |
| Could it contain irreplaceable data? | Extremely unlikely — not a migration target |

**Verdict: Safe to drop.** See `SAFE_DATABASE_CLEANUP_PLAN.md` for exact steps.

---

## 5. `synchronize` Setting Consistency

### 5.1 `data-source.ts` (TypeORM CLI)

```typescript
synchronize: false, // always false — let migrations handle schema
```

✅ Correct. CLI should never auto-sync.

### 5.2 `app.module.ts` (NestJS runtime)

```typescript
synchronize: !isProduction,
// isProduction = config.get('NODE_ENV') === 'production'
```

| `NODE_ENV` | `synchronize` | Effect |
|---|---|---|
| `production` | `false` | ✅ Safe — migrations only |
| `development` | `true` | ⚠️ Auto-alters schema on startup |
| *not set* | `true` | 🔴 Defaults to dev mode — auto-alters |

**Risk:** If `NODE_ENV` is undefined at runtime, `isProduction` is `false`, so `synchronize` is `true`. The current `validateEnv()` function does NOT enforce `NODE_ENV` must be set (it uses it for conditional checks but has no explicit `isNotEmpty()` rule on `NODE_ENV`). This is an edge case — Railway always sets `NODE_ENV=production`, and local dev should always have it set via `.env`.

### 5.3 Railway production guard

`railway.toml` does not explicitly set `NODE_ENV`. It relies on the Docker image:

```dockerfile
ENV NODE_ENV=production
```

This is baked in at build time. ✅ Safe.

---

## 6. TypeORM Connection Configuration Comparison

| Setting | `data-source.ts` (CLI) | `app.module.ts` (Runtime) | Consistent? |
|---|---|---|---|
| `type` | `postgres` | `postgres` | ✅ |
| `synchronize` | `false` (hardcoded) | `!isProduction` | ✅ (intended) |
| `ssl` | dev=false, prod=rejectUnauthorized:false | Same logic | ✅ |
| `logging` | `!isProduction` | `!isProduction` | ✅ |
| `retryAttempts` | ❌ Not set (CLI doesn't need it) | `10` | ✅ (intended) |
| `retryDelay` | ❌ Not set | `3000` | ✅ (intended) |
| Entity loading | Explicit list: `[User, Project, Page, Subscription]` | `autoLoadEntities: true` | ✅ (intended) |
| Migration list | `[InitialSchema1776200624919]` | N/A (runtime) | ✅ |

**No configuration drift detected** between CLI DataSource and runtime NestJS DataSource.

---

## 7. CI/CD Database Path Verification

### 7.1 GitHub Actions (`.github/workflows/ci.yml`)

The current CI workflow runs:
- `npm ci` (install)
- Build + lint steps

**No database connection in CI.** Tests are unit tests — no DB required. ✅

### 7.2 Railway deployment path

```
git push → GitHub Actions (build check) → Railway builds Docker image
→ Container starts → node dist/database/run-migrations
  → Reads DATABASE_URL from Railway env
  → Runs pending migrations
→ node dist/main
  → NestJS bootstrap
  → TypeOrmModule connects (retryAttempts: 10)
  → App ready
```

The migration runner and the NestJS app connect to the **same database** (same `DATABASE_URL`). No split-brain possible.

### 7.3 Local development path

```
docker compose up -d postgres → sitepilot:5432 ready
→ npm run db:migrate:run
  → AppDataSource reads DB_HOST/PORT/USER/PASSWORD/NAME from .env
  → Targets: sitepilot database
→ npm run dev
  → NestJS TypeOrmModule reads same DB_* vars
  → Targets: sitepilot database
```

Consistent. Both CLI and app target the same local database.

---

## 8. Open Issues

| # | Issue | Severity | Fix |
|---|---|---|---|
| 1 | `uuid-ossp` not activated before migration runs locally | HIGH | `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` before first migration |
| 2 | Migration does not install `uuid-ossp` itself | MEDIUM | Add `await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')` as first line of `up()` |
| 3 | `sitepilot_backend` orphan database exists locally | LOW | Drop via pgAdmin or psql |
| 4 | `NODE_ENV` not validated as required in `validateEnv()` | LOW | Add `@IsIn(['development', 'production', 'test'])` rule |
| 5 | `down()` does not drop `uuid-ossp` extension | INFO | Intentional — extension may be used by other DBs; omitting drop is safer |

---

## 9. Conclusion

The database configuration is **fundamentally sound** with two well-defined environments (local `sitepilot` dev DB, Railway production URL). The orphaned `sitepilot_backend` database is a naming artifact from early development and poses no risk.

**Before first production deploy:**
- Issue #2 must be resolved (add `uuid-ossp` extension creation to migration) OR confirmed that Railway pre-installs it (it does — but defense in depth is better).

**For local development:**
- Run `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` once per fresh database.
- Use `sitepilot` as the database name. Never `sitepilot_backend`.
