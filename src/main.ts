import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import 'reflect-metadata';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { AppLoggerService } from './common/logger/app-logger.service';

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

function getSynchronizeMode(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  if (process.env.DB_SYNCHRONIZE === undefined) {
    return (process.env.NODE_ENV || 'development') !== 'production';
  }

  return process.env.DB_SYNCHRONIZE.toLowerCase() === 'true';
}

function logStartupDiagnostics(logger: AppLoggerService): void {
  const env = process.env.NODE_ENV || 'development';
  const dbMode = process.env.DATABASE_URL
    ? 'DATABASE_URL (Railway)'
    : `${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'sitepilot'}`;
  const synchronize = getSynchronizeMode();

  const mem = process.memoryUsage();
  const heapUsedMb = (mem.heapUsed / 1024 / 1024).toFixed(1);
  const heapTotalMb = (mem.heapTotal / 1024 / 1024).toFixed(1);
  const rssMb = (mem.rss / 1024 / 1024).toFixed(1);

  const line = '────────────────────────────────────────────';
  logger.log(line, 'Bootstrap');
  logger.log('  SitePilot Backend — Startup Diagnostics', 'Bootstrap');
  logger.log(line, 'Bootstrap');
  logger.log(`  NODE_ENV        : ${env}`, 'Bootstrap');
  logger.log(`  NODE_VERSION    : ${process.version}`, 'Bootstrap');
  logger.log(`  PORT            : ${process.env.PORT || '3000'}`, 'Bootstrap');
  logger.log(`  Database        : ${dbMode}`, 'Bootstrap');
  logger.log(`  JWT_SECRET      : ${process.env.JWT_SECRET ? 'set ✓' : 'MISSING ✗'}`, 'Bootstrap');
  logger.log(`  JWT_REFRESH_SEC : ${process.env.JWT_REFRESH_SECRET ? 'set ✓' : 'fallback (dev)'}`, 'Bootstrap');
  logger.log(`  CORS_ORIGIN     : ${process.env.CORS_ORIGIN || '*'}`, 'Bootstrap');
  logger.log(`  Throttle        : ${process.env.THROTTLE_LIMIT || '100'} req / ${process.env.THROTTLE_TTL || '60000'}ms`, 'Bootstrap');
  logger.log(`  synchronize     : ${synchronize}`, 'Bootstrap');
  logger.log(`  Memory (startup): heap ${heapUsedMb}/${heapTotalMb} MB  rss ${rssMb} MB`, 'Bootstrap');
  logger.log(line, 'Bootstrap');

  if (synchronize) {
    logger.warn('synchronize=true is active — TypeORM will auto-alter schema on every start', 'Bootstrap');
  }
  if (!process.env.JWT_REFRESH_SECRET && env === 'production') {
    logger.error(
      'JWT_REFRESH_SECRET is not set — refresh tokens use a derived fallback (insecure in production!)',
      undefined,
      'Bootstrap',
    );
  }
}

async function bootstrap() {
  const appLogger = new AppLoggerService();

  const app = await NestFactory.create(AppModule, {
    logger: appLogger,
  });

  app.enableShutdownHooks();

  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
    }),
  );

  app.use(cookieParser());

  const corsOrigin = getCorsOrigin();
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    credentials: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    new LoggingInterceptor(),
  );

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
    appLogger.log('Swagger docs available at /api/docs', 'Bootstrap');
  }

  logStartupDiagnostics(appLogger);

  const port = parseInt(process.env.PORT || '3000', 10);
  await app.listen(port, '0.0.0.0');
  appLogger.log(
    `SitePilot backend running on http://localhost:${port} [${process.env.NODE_ENV || 'development'}]`,
    'Bootstrap',
  );
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
