# sitepilot-backend

SaaS platform for website automation, SEO and AI tools.

## Project Structure

```
src/
├── config/          # Typed configuration via @nestjs/config
├── common/
│   ├── filters/     # Global exception filter (AllExceptionsFilter)
│   └── interceptors/# Global logging interceptor (LoggingInterceptor)
├── modules/
│   └── health/      # Health-check module (GET /api/health)
├── app.module.ts    # Root module
└── main.ts          # Bootstrap with validation pipe, filter, interceptor
```

## Getting Started

```bash
# Copy environment file and adjust values
cp .env.example .env

# Install dependencies
npm install

# Development (watch mode)
npm run start:dev

# Production build
npm run build
npm run start:prod
```

## Available Endpoints

| Method | Path         | Description          |
|--------|--------------|----------------------|
| GET    | /api/health  | Health-check endpoint|

## Scripts

| Command              | Description                  |
|----------------------|------------------------------|
| `npm run start:dev`  | Start in watch mode          |
| `npm run build`      | Compile TypeScript           |
| `npm run start:prod` | Run compiled output          |
| `npm run lint`       | Lint and auto-fix            |
| `npm run test`       | Run unit tests               |
| `npm run test:e2e`   | Run end-to-end tests         |
| `npm run test:cov`   | Coverage report              |
