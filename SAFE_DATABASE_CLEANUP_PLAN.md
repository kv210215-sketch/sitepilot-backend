# Safe Database Cleanup Plan — SitePilot Backend

**Date:** 2026-05-11
**Branch:** `claude/audit-backend-database-R4noy`

> **READ FIRST:** This document describes safe, non-destructive cleanup steps.
> Nothing here drops production data. All steps are local-only unless explicitly stated.
> **DO NOT execute any step without reading its full description first.**

---

## 1. Cleanup Scope

| Item | Action | Risk | Reversible? |
|---|---|---|---|
| `sitepilot_backend` local DB | Drop (optional) | None — zero code refs | Via pg_dump restore |
| `uuid-ossp` extension | Add to migration | None — additive only | Yes |
| Local `.env` file | Create from `.env.example` | None | N/A |
| `sitepilot` database | **DO NOT TOUCH** | — | — |
| Railway production DB | **DO NOT TOUCH** | — | — |

---

## 2. Task 1 — Drop the `sitepilot_backend` Orphan Database

### 2.1 Confirm it is safe to drop

Before dropping, run these checks:
```sql
-- Connect as postgres superuser
\c postgres

-- 1. Confirm no active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'sitepilot_backend';
-- Expected: 0

-- 2. Inspect its tables (if any)
\c sitepilot_backend
\dt
-- Expected: either empty or stale dev tables with no production value

-- 3. Check owner/creation info
SELECT datname, pg_catalog.pg_get_userbyid(datdba) AS owner, pg_size_pretty(pg_database_size(datname)) AS size
FROM pg_database WHERE datname = 'sitepilot_backend';
```

### 2.2 Optional: back it up first (belt-and-suspenders)

```bash
# Dump to file before dropping (safe to skip if \dt showed empty schema)
pg_dump -U postgres sitepilot_backend > ~/sitepilot_backend_backup_$(date +%Y%m%d).sql
```

### 2.3 Drop the database

```sql
-- Must be connected to a different database (e.g., postgres)
\c postgres

-- Terminate any lingering connections first
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'sitepilot_backend' AND pid <> pg_backend_pid();

-- Drop the database
DROP DATABASE IF EXISTS sitepilot_backend;
```

### 2.4 Verify

```sql
SELECT datname FROM pg_database WHERE datname = 'sitepilot_backend';
-- Expected: 0 rows
```

### 2.5 Alternative: via pgAdmin

Right-click `sitepilot_backend` → Delete/Drop → confirm dialog.

---

## 3. Task 2 — Fix the `uuid-ossp` Extension Gap in Migration

### 3.1 Problem

The migration `1776200624919-InitialSchema` creates tables with:
```sql
"id" uuid NOT NULL DEFAULT uuid_generate_v4()
```

The function `uuid_generate_v4()` requires the `uuid-ossp` extension. The migration does not install it. On a fresh PostgreSQL 15–17 instance without the extension enabled, the migration fails with:
```
ERROR: function uuid_generate_v4() does not exist
```

Railway pre-installs this extension, so production is unaffected. Local developers must enable it manually — this has caused confusion.

### 3.2 Fix: add extension creation to migration `up()`

**File:** `src/database/migrations/1776200624919-InitialSchema.ts`

Add as the **first line** of the `up()` method:
```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    // ... rest of existing statements unchanged ...
```

This is:
- **Idempotent** — `IF NOT EXISTS` means it never fails if already installed
- **Non-destructive** — installing an extension doesn't affect data
- **Backwards compatible** — if applied to Railway (already has extension), it no-ops

### 3.3 Should `down()` drop the extension?

**No.** The `down()` method should NOT include `DROP EXTENSION "uuid-ossp"`. Reasons:
- Other databases on the same PostgreSQL instance may depend on it
- Railway manages extensions at the cluster level
- Extension removal is a system-level DBA decision, not a migration concern

The current `down()` is correct as-is.

### 3.4 Status: this fix is documented in `SAFE_PHASE1_IMPLEMENTATION.md` (Phase 1 Fix #1)

The fix has been planned but not yet committed. It should be applied in the same PR as the other Phase 1 fixes.

---

## 4. Task 3 — Establish a Clean Local Development Database

Use this procedure for any developer setting up the project fresh, or after dropping `sitepilot_backend`.

### 4.1 Via Docker Compose (recommended)

```bash
cd sitepilot-backend

# Start PostgreSQL 16 (creates sitepilot database automatically)
docker compose up -d postgres

# Wait for healthcheck to pass
docker compose ps
# postgres: healthy

# Enable uuid-ossp (one-time per fresh volume)
docker compose exec postgres psql -U sitepilot -d sitepilot -c \
  "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

# Run migrations
npm run db:migrate:run
# Expected: "Applied 1 migration(s): [ 'InitialSchema1776200624919' ]"

# (Optional) Seed dev data
SEED_ADMIN_PASSWORD=DevPass123! npm run db:seed

# Start the app
npm run dev
```

### 4.2 Via local PostgreSQL (manual)

```sql
-- Step 1: create user (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sitepilot') THEN
    CREATE USER sitepilot WITH PASSWORD 'sitepilot';
  END IF;
END
$$;

-- Step 2: create database
CREATE DATABASE sitepilot WITH OWNER = sitepilot ENCODING = 'UTF8';

-- Step 3: grant privileges
GRANT ALL PRIVILEGES ON DATABASE sitepilot TO sitepilot;

-- Step 4: connect to sitepilot and enable extension
\c sitepilot
GRANT USAGE, CREATE ON SCHEMA public TO sitepilot;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

Then from the shell:
```bash
npm run db:migrate:run
npm run dev
```

### 4.3 Create `.env` from template

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET to any 32+ char string:
# JWT_SECRET=dev-only-secret-must-be-at-least-32-chars
```

---

## 5. Task 4 — Verify Local Database Is Clean Post-Cleanup

Run these checks after completing Tasks 1–3:

```sql
-- Connect to sitepilot
\c sitepilot

-- 1. Extensions present
SELECT extname FROM pg_extension WHERE extname = 'uuid-ossp';
-- Expected: 1 row

-- 2. Migration applied
SELECT name, timestamp FROM typeorm_migrations ORDER BY timestamp;
-- Expected: InitialSchema1776200624919

-- 3. Tables exist
\dt
-- Expected: migrations, users, projects, pages, subscriptions

-- 4. No sitepilot_backend
\c postgres
SELECT datname FROM pg_database WHERE datname = 'sitepilot_backend';
-- Expected: 0 rows
```

---

## 6. What NOT To Do

| Action | Why forbidden |
|---|---|
| Drop `sitepilot` | This is the canonical dev database — dropping it breaks local dev |
| Edit the migration file AFTER it has been applied | TypeORM tracks migrations by name+timestamp — edits create drift |
| Set `synchronize: true` manually in `data-source.ts` | The CLI data source must always be `false` |
| Delete `typeorm_migrations` table | TypeORM will re-run all migrations on next startup |
| Run cleanup on Railway production DB | Production database is managed by Railway — no manual intervention |
| Set `DB_NAME=sitepilot_backend` in `.env` | There is no database by this name in any supported config |

---

## 7. Execution Order Summary

```
Step 1: (Optional) Backup sitepilot_backend if you want a snapshot
Step 2: Drop sitepilot_backend orphan database
Step 3: Apply uuid-ossp fix to migration up() method
Step 4: Commit migration fix (as part of Phase 1 PR)
Step 5: Verify local database with check queries above
Step 6: Update LOCAL_DATABASE_SETUP.md if steps change after fix
```

Steps 1–2 are **local-only maintenance** — no git changes required.
Step 3–4 are **code changes** — require PR review before merging.

---

## 8. Post-Cleanup State (Target)

After all cleanup tasks are complete:

| Database | Status |
|---|---|
| `sitepilot` | Active, migrated, uuid-ossp enabled, canonical dev DB |
| `sitepilot_backend` | Dropped — no longer exists |
| Railway production | Unchanged — not touched |

| Configuration | Status |
|---|---|
| `.env.example` defaults | Point to `sitepilot` — correct |
| `docker-compose.yml` | Targets `sitepilot` — correct |
| Migration `up()` | Installs `uuid-ossp` before creating tables — fixed |
| `data-source.ts` fallback | `'sitepilot'` — correct |
| `app.module.ts` fallback | `'sitepilot'` — correct |
