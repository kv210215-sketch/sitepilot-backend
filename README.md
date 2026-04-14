# Sitepilot Backend

SaaS platform for website automation, SEO and AI tools.

## Structure

```
.
├── backend/   # NestJS 10 API
└── frontend/  # Next.js 14 UI
```

## Quick Start

### Development

```bash
# Backend
cd backend
cp .env.example .env
npm install
npm run start:dev

# Frontend
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

### Docker

```bash
docker-compose up --build
```

## API

- `GET /api/health` — Health check
- `POST /api/auth/register` — Register
- `POST /api/auth/login` — Login (returns JWT)
- `GET /api/users/me` — Current user (JWT required)

## Deployment (Railway)

Set the following environment variables in Railway:
- `DATABASE_URL`
- `JWT_SECRET`
- `PORT` (optional, defaults to 3000)
