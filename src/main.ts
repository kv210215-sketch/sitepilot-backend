import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// Crash on unhandled promise rejections — silent swallowing hides bugs.
process.on('unhandledRejection', (reason: unknown) => {
  console.error('[FATAL] Unhandled promise rejection:', reason);
  process.exit(1);
});

function getCorsOrigin(): string {
  const corsOrigin = process.env.CORS_ORIGIN;
  if (process.env.NODE_ENV === 'production' && !corsOrigin) {
    throw new Error('CORS_ORIGIN environment variable is required in production');
  }
  return corsOrigin || '*';
}

function logStartupDiagnostics(logger: Logger): void {
  const env = process.env.NODE_ENV || 'development';
  const dbMode = process.env.DATABASE_URL
    ? 'DATABASE_URL (Railway)'
    : `${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'sitepilot'}`;

  logger.log('────────────────────────────────────────────');
  logger.log('  SitePilot Backend — Startup Diagnostics');
  logger.log('────────────────────────────────────────────');
  logger.log(`  NODE_ENV        : ${env}`);
  logger.log(`  PORT            : ${process.env.PORT || '3000'}`);
  logger.log(`  Database        : ${dbMode}`);
  logger.log(`  JWT_SECRET      : ${process.env.JWT_SECRET ? 'set ✓' : 'MISSING ✗'}`);
  logger.log(`  JWT_REFRESH_SEC : ${process.env.JWT_REFRESH_SECRET ? 'set ✓' : 'fallback (dev)'}`);
  logger.log(`  CORS_ORIGIN     : ${process.env.CORS_ORIGIN || '*'}`);
  logger.log(`  Throttle        : ${process.env.THROTTLE_LIMIT || '100'} req / ${process.env.THROTTLE_TTL || '60000'}ms`);
  logger.log(`  synchronize     : ${env !== 'production'}`);
  logger.log('────────────────────────────────────────────');

  if (env !== 'production') {
    logger.warn('synchronize=true is active — TypeORM will auto-alter schema on every start');
  }
  if (!process.env.JWT_REFRESH_SECRET && env === 'production') {
    logger.error('JWT_REFRESH_SECRET is not set — refresh tokens use a derived fallback (insecure in production!)');
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: [
      'error',
      'warn',
      'log',
      ...(process.env.NODE_ENV !== 'production' ? (['debug', 'verbose'] as const) : []),
    ],
  });

  // ── Graceful shutdown (drains in-flight requests before exit) ─────────────
  app.enableShutdownHooks();

  // ── Trust Railway / cloud proxy (needed for correct IP in rate limiting) ──
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // ── HTTP security headers ───────────────────────────────────────────
  app.use(
    helmet({
      // Disable CSP in dev so Swagger UI loads without issues
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
    }),
  );

  // ── Cookie parsing (needed for refresh token extraction) ────────────────
  app.use(cookieParser());

  // ── CORS ─────────────────────────────────────────────────────────────
  const corsOrigin = getCorsOrigin();
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // required for cookie transport
  });

  // ── Global exception filter — consistent JSON error envelope ─────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Global validation ────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ── Serialize responses (@Exclude fields) ────────────────────────────
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // ── Swagger (development only) ──────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('SitePilot API')
      .setDescription('SaaS backend for website automation, SEO and AI tools')
      .setVersion('1.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    logger.log('Swagger docs available at /api/docs');
  }

  logStartupDiagnostics(logger);

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port, '0.0.0.0');
  logger.log(
    `SitePilot backend running on http://localhost:${port} [${process.env.NODE_ENV || 'development'}]`,
  );
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
