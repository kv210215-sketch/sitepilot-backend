# sitepilot-backend

SaaS platform for website automation, SEO and AI tools — NestJS REST API backend.

---

## Architecture

```
sitepilot-backend/          ← NestJS API (this repo)
sitepilot-frontend/         ← Next.js client (separate repo)
```

The backend exposes a versioned REST API under `/api/v*`. The frontend (Next.js) is maintained as a separate project and communicates with this API over HTTP/HTTPS.

### Module structure

```
src/
├── common/
│   ├── filters/            # Global exception filter
│   └── interceptors/       # Global logging interceptor
├── config/                 # App config via @nestjs/config
└── modules/
    └── health/             # Health-check endpoint (/api/health)
```

---

## Prerequisites

- Node.js ≥ 20
- npm ≥ 10
- Docker (optional, for containerised local dev)

---

## Getting started

```bash
# 1. Install dependencies
npm ci

# 2. Copy environment file and fill in values
cp .env.example .env

# 3. Start in development mode (hot reload)
npm run start:dev

# 4. Open the API
open http://localhost:3000/api
open http://localhost:3000/api/health
```

---

## Environment variables

See [.env.example](.env.example) for all supported variables.

| Variable         | Default              | Description                         |
|------------------|----------------------|-------------------------------------|
| `NODE_ENV`       | `development`        | `development` / `production`        |
| `PORT`           | `3000`               | Port the server listens on          |
| `APP_NAME`       | `sitepilot-backend`  | Application name (used in logs)     |
| `CORS_ORIGINS`   | *(all allowed)*      | Comma-separated allowed origins     |
| `DATABASE_URL`   | —                    | PostgreSQL connection string        |
| `JWT_SECRET`     | —                    | Secret key for JWT signing          |
| `JWT_EXPIRES_IN` | `3600s`              | JWT token expiry                    |
| `OPENAI_API_KEY` | —                    | OpenAI API key for AI features      |
| `REDIS_URL`      | —                    | Redis connection string             |

---

## Scripts

| Command               | Description                          |
|-----------------------|--------------------------------------|
| `npm run start:dev`   | Start with hot reload (dev)          |
| `npm run build`       | Compile TypeScript → `dist/`         |
| `npm run start:prod`  | Start compiled build                 |
| `npm test`            | Unit tests                           |
| `npm run test:e2e`    | End-to-end tests                     |
| `npm run test:cov`    | Unit tests with coverage report      |
| `npm run lint`        | ESLint + Prettier auto-fix           |

---

## Docker

### Build and run locally

```bash
docker build -t sitepilot-backend .
docker run -p 3000:3000 --env-file .env sitepilot-backend
```

### Docker Compose (recommended for local dev)

```bash
cp .env.example .env
docker compose up --build
```

---

## Deployment — Railway

1. Push this repository to GitHub.
2. Connect the repo to a new Railway project.
3. Set environment variables in the Railway dashboard (see table above).
4. Railway auto-detects `railway.toml` and uses the configured build/start commands.
5. The health-check path `/api/health` is configured in `railway.toml`.

> Railway automatically injects a `PORT` environment variable. The application reads it at startup.

---

## API endpoints

| Method | Path          | Description             |
|--------|---------------|-------------------------|
| GET    | `/api/health` | Health check (Terminus) |

All future endpoints will be versioned: `GET /api/v1/...`

---

## Suggested improvements (NestJS + Next.js)

- **Authentication** — Add `@nestjs/passport` + `@nestjs/jwt` with a JWT guard.
- **Database** — Add TypeORM or Prisma with a PostgreSQL service on Railway.
- **Swagger** — Add `@nestjs/swagger` for auto-generated API documentation.
- **Rate limiting** — Add `@nestjs/throttler` to protect public endpoints.
- **Queue / background jobs** — Add BullMQ (`@nestjs/bull`) for async SEO and AI tasks.
- **Caching** — Add `@nestjs/cache-manager` backed by Redis.
- **Next.js frontend** — Create a separate `sitepilot-frontend` repo; deploy to Vercel and point `NEXT_PUBLIC_API_URL` at the Railway service URL.
- **Monorepo** — Consider Nx or Turborepo if frontend and backend are kept in one repo.
