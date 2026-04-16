# Sitepilot

SaaS platform for website automation, SEO, and AI tools.

## Stack

| Layer    | Technology           |
| -------- | -------------------- |
| Backend  | NestJS 10 (Node 20)  |
| Frontend | Next.js 14 (App Router) |
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
npm run start:dev      # http://localhost:4000/api

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
- API → http://localhost:4000/api
- Frontend → http://localhost:3000
- Health → http://localhost:4000/api/health

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
4. In each service → **Variables**, add the values from the matching `.env.example`.
5. Add a **PostgreSQL** plugin to the project; Railway will inject `DATABASE_URL` automatically.
6. Deploy.

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

- **Validation** – `ValidationPipe` is enabled globally with `whitelist: true`; all DTOs should use `class-validator` decorators.
- **Config** – `@nestjs/config` loads `.env` globally; add a `config/` module with Joi/Zod validation for strict env checks before startup.
- **Auth** – JWT scaffold is included in `package.json`. Add a `PassportModule` + `JwtStrategy` in `src/auth/`.
- **Database** – Add `@nestjs/typeorm` (or Prisma) and connect via `DATABASE_URL`.
- **Frontend API calls** – `next.config.js` rewrites `/api/*` to the backend, so the frontend never exposes the API URL to the browser.
- **Health check** – `@nestjs/terminus` checks memory; extend with `TypeOrmHealthIndicator` once a DB is wired up.
- **CORS** – Locked to `FRONTEND_URL`; update this variable per environment.

