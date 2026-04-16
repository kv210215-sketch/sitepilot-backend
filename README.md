# Sitepilot

SaaS platform for website automation, SEO, and AI tools.

## Stack

| Layer    | Technology           |
| -------- | -------------------- |
| Backend  | NestJS 10 (Node 20)     |
| Frontend | Next.js 15 (App Router) |
| Database | PostgreSQL (Railway) |
| Deploy   | Railway / Docker     |

---

## Project structure

```
sitepilot-backend/          ← repo root
├── backend/                ← NestJS API
│   ├── src/
│   │   ├── health/         ← GET /api/health  (Railway healthcheck)
│   │   ├── app.module.ts
│   │   ├── app.controller.ts
│   │   ├── app.service.ts
│   │   └── main.ts
│   ├── Dockerfile
│   ├── nest-cli.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── package.json
│   └── .env.example
├── frontend/               ← Next.js app
│   ├── src/app/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── Dockerfile
│   ├── next.config.js
│   ├── tsconfig.json
│   ├── package.json
│   └── .env.example
├── docker-compose.yml      ← local development stack
├── railway.toml            ← Railway monorepo config
├── .env.example            ← root env template
└── .gitignore
```

---

## Local development

### Prerequisites
- Node 20+
- Docker & Docker Compose (optional)

### Without Docker

```bash
# Backend
cd backend
cp .env.example .env   # fill in values
npm install
npm run start:dev      # http://localhost:3001/api

# Frontend (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev            # http://localhost:3000
```

### With Docker Compose

```bash
cp .env.example .env   # fill in values
docker compose up --build
```

Services:
- API → http://localhost:3001/api
- Frontend → http://localhost:3000
- Health → http://localhost:3001/api/health

---

## Environment variables

Copy the relevant `.env.example` files and fill in values:

| File                    | Used by           |
| ----------------------- | ----------------- |
| `.env.example`          | docker-compose    |
| `backend/.env.example`  | NestJS app        |
| `frontend/.env.example` | Next.js app       |

---

## API endpoints

| Method | Path          | Description          |
| ------ | ------------- | -------------------- |
| GET    | `/api`        | Liveness check       |
| GET    | `/api/health` | Full health check    |

---

## Deployment (Railway)

1. Push this repo to GitHub.
2. Create a new Railway project → **Deploy from GitHub repo**.
3. Railway auto-detects `railway.toml` and creates two services: **backend** and **frontend**.
4. Add a **PostgreSQL** plugin to the project; Railway will inject `DATABASE_URL` automatically.
5. In each service → **Variables**, add the values below.
6. Deploy.

### Backend env vars (required)

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | injected by Railway automatically |
| `DATABASE_URL` | injected by Railway PostgreSQL plugin |
| `JWT_SECRET` | random string ≥ 32 chars (`openssl rand -hex 32`) |
| `JWT_REFRESH_SECRET` | random string ≥ 32 chars (`openssl rand -hex 32`) |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `CORS_ORIGINS` | your frontend URL, e.g. `https://your-app.up.railway.app` |

> **Alternative to `DATABASE_URL`**: set `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` individually. `DATABASE_URL` takes precedence when both are present.

### Startup log (confirm config mode)

On boot the backend prints:
```
🚀 API running  → http://localhost:PORT/api
   NODE_ENV     → production
   DB config    → DATABASE_URL        ← or "discrete DB vars"
   Health       → http://localhost:PORT/api/health
```

The `railway.toml` sets the healthcheck paths so Railway knows when each service is ready:
- Backend: `GET /api/health`
- Frontend: `GET /`

---

## Build & test (backend)

```bash
cd backend
npm run build        # compile TypeScript → dist/
npm test             # unit tests (Jest)
npm run test:e2e     # end-to-end tests
npm run lint         # ESLint
```

---

## Architecture notes & improvements

- **Config** – `@nestjs/config` loads `.env` globally; typed config factories with fail-fast env validation are in `src/config/`.
- **Auth** – JWT scaffold is included in `package.json`. Add a `PassportModule` + `JwtStrategy` in `src/auth/`.
- **Database** – `@nestjs/typeorm` + `typeorm` + `pg` are connected via `TypeOrmModule.forRootAsync`. Supports `DATABASE_URL` or discrete `DB_*` vars. SSL enabled only in production.
- **Frontend API calls** – `next.config.js` rewrites `/api/*` to the backend, so the frontend never exposes the API URL to the browser.
- **Health check** – `@nestjs/terminus` checks memory heap, RSS, and DB connectivity (`TypeOrmHealthIndicator`) at `GET /api/health`.
- **CORS** – Configured via `CORS_ORIGINS` env var (comma-separated list); defaults to `http://localhost:3000`.

