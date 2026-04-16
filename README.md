# SitePilot Backend

Production-safe NestJS backend foundation for SitePilot SaaS.

## Stack
- NestJS 10
- TypeORM + PostgreSQL
- JWT authentication (Passport)
- DTO validation (`class-validator`)
- Swagger (`/api/docs`)

## Setup
```bash
npm install
cp .env.example .env
npm run start:dev
```

## Required environment variables
- `JWT_SECRET` (minimum 32 characters)

Database can be configured via either:
- `DATABASE_URL`
- or `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`

## Verification
```bash
npm run build
npm run lint
```

## Health check
- `GET /api/v1/health`
