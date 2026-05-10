import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// Catch any unhandled promise rejections and crash loudly — silent swallowing
// of rejections hides bugs that would otherwise go unnoticed.
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
  const port = process.env.PORT || '3000';
  const dbMode = process.env.DATABASE_URL
    ? 'DATABASE_URL (Railway)'
    : `${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'} / ${process.env.DB_NAME || 'sitepilot'}`;

  logger.log('─────────────────────────────────────────');
  logger.log('  SitePilot Backend — Startup Diagnostics');
  logger.log('─────────────────────────────────────────');
  logger.log(`  NODE_ENV    : ${env}`);
  logger.log(`  PORT        : ${port}`);
  logger.log(`  Database    : ${dbMode}`);
  logger.log(`  JWT_SECRET  : ${process.env.JWT_SECRET ? 'set ✓' : 'MISSING ✗'}`);
  logger.log(`  CORS_ORIGIN : ${process.env.CORS_ORIGIN || '*'}`);
  logger.log(`  synchronize : ${env !== 'production'}`);
  logger.log('─────────────────────────────────────────');

  if (env !== 'production') {
    logger.warn('synchronize=true is active — TypeORM will auto-alter schema on every start');
  }
  if ((process.env.CORS_ORIGIN || '*') === '*' && env === 'production') {
    logger.error('CORS_ORIGIN=* is not safe in production!');
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: [
      'error',
      'warn',
      'log',
      ...(process.env.NODE_ENV !== 'production'
        ? (['debug', 'verbose'] as const)
        : []),
    ],
  });

  // ── Graceful shutdown — lets TypeORM/HTTP connections drain cleanly ────────
  app.enableShutdownHooks();

  // ── CORS ──────────────────────────────────────────────────────────────────
  const corsOrigin = getCorsOrigin();
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: corsOrigin !== '*',
  });

  // ── Global exception filter — consistent JSON error envelope ──────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Global validation — strips unknown fields, coerces types ──────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // ── Serialize responses — respects @Exclude() on entity fields ────────────
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // ── Swagger (development only) ────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('SitePilot API')
      .setDescription('SaaS backend for website automation, SEO and AI tools')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'JWT',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    logger.log('Swagger docs available at /api/docs');
  }

  // ── Startup diagnostics ───────────────────────────────────────────────────
  logStartupDiagnostics(logger);

  // ── Start listening ───────────────────────────────────────────────────────
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
