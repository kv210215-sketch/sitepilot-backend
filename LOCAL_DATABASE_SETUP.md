# Local Database Setup — SitePilot Backend

Step-by-step guide to run the backend locally with PostgreSQL 17.

> **Safe to run repeatedly.** No data is dropped or reset.

---

## Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Node.js | 20+ | `node -v` |
| npm | 10+ | `npm -v` |
| PostgreSQL | 15–17 | `psql --version` |
| pgAdmin (optional) | 4+ | GUI tool |

PostgreSQL must be running on `localhost:5432`.

---

## Option A — Automated (PowerShell)

Run `SAFE_DATABASE_INIT.ps1` — it checks everything and sets up the database safely:

```powershell
.\SAFE_DATABASE_INIT.ps1
```

Then skip to [Step 4](#step-4-install-dependencies).

---

## Option B — Manual Setup

### Step 1 — Verify PostgreSQL is running

```powershell
# Windows (PowerShell)
Get-Service postgresql*

# If stopped:
Start-Service postgresql-x64-17  # adjust service name as needed
```

Verify the port:
```powershell
netstat -ano | findstr :5432
```

---

### Step 2 — Create the database

Open pgAdmin or run in psql (connected to `postgres` database):

```sql
-- Check if database already exists first
SELECT datname FROM pg_database WHERE datname = 'sitepilot';

-- Create only if it doesn't exist
CREATE DATABASE sitepilot
  WITH OWNER = sitepilot
  ENCODING = 'UTF8'
  LC_COLLATE = 'en_US.UTF-8'
  LC_CTYPE = 'en_US.UTF-8';
```

---

### Step 3 — Create user and enable uuid-ossp

```sql
-- Create user if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sitepilot') THEN
    CREATE USER sitepilot WITH PASSWORD 'sitepilot';
  END IF;
END
$$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE sitepilot TO sitepilot;
GRANT SCHEMA USAGE ON SCHEMA public TO sitepilot;
GRANT CREATE ON SCHEMA public TO sitepilot;

-- Enable uuid-ossp extension (REQUIRED by migration)
-- Connect to sitepilot database first, then run:
\c sitepilot
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

> **Why uuid-ossp?**
> The initial migration uses `DEFAULT uuid_generate_v4()` in table definitions.
> This function requires the `uuid-ossp` extension. Without it, migration fails.
> PostgreSQL 17 ships with it but it must be explicitly activated per-database.

---

### Step 4 — Install dependencies

```bash
npm install
```

---

### Step 5 — Configure environment

Copy `.env.example` to `.env`:

```bash
copy .env.example .env
```

The defaults in `.env.example` already match local PostgreSQL settings:
```env
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_USER=sitepilot
DB_PASSWORD=sitepilot
DB_NAME=sitepilot
JWT_SECRET=dev-local-secret-change-me-min-32-chars
```

> Do NOT set `DATABASE_URL` locally unless you want to override all DB_* settings.

---

### Step 6 — Run migrations

```bash
npm run db:migrate:run
```

Expected output:
```
[migrations] Connecting to database…
[migrations] Running pending migrations…
[migrations] Applied 1 migration(s): [ 'InitialSchema1776200624919' ]
[migrations] Done.
```

If you see:
```
function uuid_generate_v4() does not exist
```
→ Go back to Step 3 and enable the `uuid-ossp` extension.

---

### Step 7 — (Optional) Seed demo data

```bash
SEED_ADMIN_PASSWORD=MySecurePassword123 npm run db:seed
```

This creates:
- Admin user at `admin@sitepilot.local`
- A demo project
- A demo page

Safe to run repeatedly — checks for existing data before inserting.

---

### Step 8 — Start the backend

```bash
npm run dev
```

Expected output:
```
[Bootstrap] SitePilot backend running on http://localhost:3000 [development]
[Bootstrap] Swagger docs available at /api/docs
```

---

## Verify everything works

```bash
# Health check
curl http://localhost:3000/health

# Expected:
# { "status": "ok", "services": { "database": "ok" } }
```

Swagger UI: http://localhost:3000/api/docs

---

## Troubleshooting

| Error | Cause | Fix |
|---|---|---|
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL not running | Start the service |
| `uuid_generate_v4() does not exist` | uuid-ossp not enabled | `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` |
| `database "sitepilot" does not exist` | DB not created | Run Step 2 |
| `role "sitepilot" does not exist` | User not created | Run Step 3 |
| `JWT_SECRET environment variable is required` | Missing .env | Copy .env.example to .env |
| `password authentication failed` | Wrong password | Check DB_PASSWORD in .env |
| Migration already applied | Re-running after first run | Normal — shows "up to date" |

---

## Database Commands Reference

```bash
# Check migration status
npm run db:migrate:run

# Revert last migration (DANGEROUS — data loss possible)
npm run db:migrate:revert

# Generate new migration after entity changes
npm run db:migrate:generate --name=YourMigrationName

# Seed dev data
SEED_ADMIN_PASSWORD=YourPassword npm run db:seed

# Start only PostgreSQL via Docker (if not using local PG)
npm run dev:db
```

---

## Notes on `sitepilot_backend` database

If you see a `sitepilot_backend` database in pgAdmin — it is **not used by this project**.
It may be a leftover from a previous setup. It can be safely deleted from pgAdmin
(right-click → Delete/Drop) if it contains no important data.

The correct database name is: **`sitepilot`**
