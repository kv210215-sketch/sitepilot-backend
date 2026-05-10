<#
.SYNOPSIS
    Safe database initialization for SitePilot backend (local development).

.DESCRIPTION
    Checks PostgreSQL service, port 5432, creates database and user if missing,
    enables uuid-ossp extension, and runs pending TypeORM migrations.

    SAFE GUARANTEES:
    - Does NOT drop any database
    - Does NOT reset any schema
    - Does NOT truncate or delete data
    - Does NOT drop any table
    - Idempotent — safe to run multiple times

.NOTES
    Requires: psql.exe on PATH (comes with PostgreSQL installation)
    Run from the project root directory.
#>

[CmdletBinding()]
param(
    [string]$PgHost     = 'localhost',
    [int]   $PgPort     = 5432,
    [string]$PgAdmin    = 'postgres',       # superuser account for setup
    [string]$DbName     = 'sitepilot',
    [string]$DbUser     = 'sitepilot',
    [string]$DbPassword = 'sitepilot'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ─── Helpers ──────────────────────────────────────────────────────────────────

function Write-Step ([string]$msg) {
    Write-Host "`n[STEP] $msg" -ForegroundColor Cyan
}

function Write-Ok ([string]$msg) {
    Write-Host "  [OK] $msg" -ForegroundColor Green
}

function Write-Warn ([string]$msg) {
    Write-Host "  [WARN] $msg" -ForegroundColor Yellow
}

function Write-Fail ([string]$msg) {
    Write-Host "`n  [FAIL] $msg" -ForegroundColor Red
    exit 1
}

function Invoke-Psql {
    param(
        [string]$Sql,
        [string]$Database = 'postgres',
        [bool]  $AsTuples = $false
    )
    $args = @(
        '-h', $PgHost,
        '-p', $PgPort,
        '-U', $PgAdmin,
        '-d', $Database,
        '-c', $Sql,
        '-v', 'ON_ERROR_STOP=1'
    )
    if ($AsTuples) { $args += '-t'; $args += '-A' }
    & psql @args 2>&1
    return $LASTEXITCODE
}

# ─── Step 1: Check psql is available ──────────────────────────────────────────

Write-Step 'Checking psql availability'

$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlPath) {
    Write-Fail 'psql not found in PATH. Install PostgreSQL and add its bin directory to PATH.'
}
Write-Ok "psql found: $($psqlPath.Source)"

# ─── Step 2: Check PostgreSQL service ─────────────────────────────────────────

Write-Step 'Checking PostgreSQL Windows service'

$pgServices = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue

if (-not $pgServices) {
    Write-Warn 'No postgresql* Windows service found — PostgreSQL may be running in WSL, Docker, or as a manual process.'
} else {
    $running = $pgServices | Where-Object { $_.Status -eq 'Running' }
    if (-not $running) {
        Write-Warn 'PostgreSQL service found but not running. Attempting to start...'
        try {
            $pgServices[0] | Start-Service
            Start-Sleep -Seconds 3
            Write-Ok "Service started: $($pgServices[0].Name)"
        } catch {
            Write-Fail "Could not start PostgreSQL service: $_"
        }
    } else {
        Write-Ok "Service running: $($running[0].Name) [$($running[0].DisplayName)]"
    }
}

# ─── Step 3: Check port 5432 ──────────────────────────────────────────────────

Write-Step "Checking TCP port $PgPort on $PgHost"

try {
    $tcp = New-Object System.Net.Sockets.TcpClient
    $connect = $tcp.BeginConnect($PgHost, $PgPort, $null, $null)
    $wait = $connect.AsyncWaitHandle.WaitOne(3000, $false)
    if (-not $wait) {
        $tcp.Close()
        Write-Fail "Port $PgPort on $PgHost is not reachable. Is PostgreSQL running?"
    }
    $tcp.EndConnect($connect)
    $tcp.Close()
    Write-Ok "Port $PgPort is open and reachable"
} catch {
    Write-Fail "Cannot connect to ${PgHost}:${PgPort} — $_"
}

# ─── Step 4: Test superuser connection ────────────────────────────────────────

Write-Step "Testing connection as postgres superuser"

$env:PGPASSWORD = Read-Host -Prompt "  Enter password for PostgreSQL superuser '$PgAdmin' (leave blank to use .pgpass or trust auth)"

$rc = Invoke-Psql -Sql 'SELECT 1' -Database 'postgres'
if ($rc -ne 0) {
    Write-Fail "Cannot connect to PostgreSQL as '$PgAdmin'. Check credentials."
}
Write-Ok "Connected as '$PgAdmin'"

# ─── Step 5: Check / create DB user ───────────────────────────────────────────

Write-Step "Checking database user '$DbUser'"

$userExists = (& psql -h $PgHost -p $PgPort -U $PgAdmin -d postgres -t -A -c "SELECT 1 FROM pg_roles WHERE rolname='$DbUser'" 2>&1).Trim()

if ($userExists -eq '1') {
    Write-Ok "User '$DbUser' already exists — skipping creation"
} else {
    Write-Warn "User '$DbUser' does not exist — creating..."
    $createUser = "CREATE USER $DbUser WITH PASSWORD '$DbPassword';"
    $rc = Invoke-Psql -Sql $createUser
    if ($rc -ne 0) {
        Write-Fail "Failed to create user '$DbUser'"
    }
    Write-Ok "User '$DbUser' created"
}

# ─── Step 6: Check / create database ──────────────────────────────────────────

Write-Step "Checking database '$DbName'"

$dbExists = (& psql -h $PgHost -p $PgPort -U $PgAdmin -d postgres -t -A -c "SELECT 1 FROM pg_database WHERE datname='$DbName'" 2>&1).Trim()

if ($dbExists -eq '1') {
    Write-Ok "Database '$DbName' already exists — skipping creation (no data will be changed)"
} else {
    Write-Warn "Database '$DbName' does not exist — creating..."
    $rc = Invoke-Psql -Sql "CREATE DATABASE $DbName WITH OWNER $DbUser ENCODING 'UTF8';"
    if ($rc -ne 0) {
        Write-Fail "Failed to create database '$DbName'"
    }
    Write-Ok "Database '$DbName' created"
}

# ─── Step 7: Grant privileges ─────────────────────────────────────────────────

Write-Step "Granting privileges on '$DbName' to '$DbUser'"

$grantSql = @"
GRANT ALL PRIVILEGES ON DATABASE $DbName TO $DbUser;
GRANT USAGE ON SCHEMA public TO $DbUser;
GRANT CREATE ON SCHEMA public TO $DbUser;
"@

$rc = Invoke-Psql -Sql $grantSql -Database $DbName
if ($rc -ne 0) {
    Write-Warn "Some grant statements may have failed — this is usually OK if privileges already exist"
} else {
    Write-Ok "Privileges granted"
}

# ─── Step 8: Enable uuid-ossp extension ───────────────────────────────────────

Write-Step "Enabling uuid-ossp extension in '$DbName'"

$rc = Invoke-Psql -Sql 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' -Database $DbName
if ($rc -ne 0) {
    Write-Fail 'Failed to create uuid-ossp extension. Ensure you are connecting as a superuser.'
}
Write-Ok 'uuid-ossp extension is enabled'

# ─── Step 9: Check .env file ──────────────────────────────────────────────────

Write-Step 'Checking .env file'

if (-not (Test-Path '.env')) {
    if (Test-Path '.env.example') {
        Write-Warn '.env not found — copying from .env.example'
        Copy-Item '.env.example' '.env'
        Write-Ok '.env created from .env.example. Review and edit JWT_SECRET before starting.'
    } else {
        Write-Fail '.env and .env.example both missing. Cannot configure the application.'
    }
} else {
    Write-Ok '.env file exists'

    # Check JWT_SECRET is not the example placeholder
    $envContent = Get-Content '.env' -Raw
    if ($envContent -match 'change-this-to-a-secure-random-secret') {
        Write-Warn 'JWT_SECRET in .env still uses the example placeholder. Change it before use.'
    }
}

# ─── Step 10: Check node_modules ──────────────────────────────────────────────

Write-Step 'Checking node_modules'

if (-not (Test-Path 'node_modules')) {
    Write-Warn 'node_modules not found — running npm install...'
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Fail 'npm install failed'
    }
    Write-Ok 'Dependencies installed'
} else {
    Write-Ok 'node_modules exists'
}

# ─── Step 11: Run TypeORM migrations ──────────────────────────────────────────

Write-Step 'Running TypeORM migrations'
Write-Host '  (This is safe to run multiple times — already-applied migrations are skipped)' -ForegroundColor DarkGray

npm run db:migrate:run

if ($LASTEXITCODE -ne 0) {
    Write-Fail 'Migration failed. Check the error above.'
}

Write-Ok 'Migrations applied successfully'

# ─── Done ─────────────────────────────────────────────────────────────────────

Write-Host ''
Write-Host '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' -ForegroundColor Green
Write-Host '  Database initialization complete!' -ForegroundColor Green
Write-Host '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' -ForegroundColor Green
Write-Host ''
Write-Host '  Next steps:' -ForegroundColor White
Write-Host "  1. Review .env and set a strong JWT_SECRET" -ForegroundColor White
Write-Host '  2. (Optional) npm run db:seed -- to add demo data' -ForegroundColor White
Write-Host '  3. npm run dev                -- to start the backend' -ForegroundColor White
Write-Host '  4. curl http://localhost:3000/health -- to verify' -ForegroundColor White
Write-Host ''
