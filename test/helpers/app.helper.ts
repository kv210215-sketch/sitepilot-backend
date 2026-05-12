/**
 * Bootstrap a full NestJS application for E2E tests.
 *
 * Uses the real AppModule wired to an isolated test database via TEST_DATABASE_URL.
 * The app starts on a random port — callers receive the supertest agent.
 */
import { ClassSerializerInterceptor, INestApplication, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { LoggingInterceptor } from '../../src/common/interceptors/logging.interceptor';
import { truncateAll } from './db.helper';

export interface TestApp {
  app: INestApplication;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawRequest: any;
  dataSource: DataSource;
  close: () => Promise<void>;
}

/**
 * Set test environment variables before module compilation.
 * Must be called before createTestApp().
 */
export function setTestEnv(): void {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-exactly-32-chars!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-chars-ok!!';
  process.env.JWT_EXPIRES_IN = '15m';
  process.env.CORS_ORIGIN = 'http://localhost:3001';
  process.env.THROTTLE_TTL = '60000';
  process.env.THROTTLE_LIMIT = '1000'; // high limit so tests never hit rate limit
  // Override DB to test database — never touch sitepilot (dev)
  delete process.env.DATABASE_URL;
  process.env.DB_HOST = 'localhost';
  process.env.DB_PORT = '5432';
  process.env.DB_USER = 'sitepilot';
  process.env.DB_PASSWORD = 'sitepilot';
  process.env.DB_NAME = 'sitepilot_backend';
}

export async function createTestApp(): Promise<TestApp> {
  setTestEnv();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ThrottlerStorage)
    .useValue({
      increment: async () => ({
        totalHits: 1,
        timeToExpire: 0,
        isBlocked: false,
        timeToBlockExpire: 0,
      }),
    })
    .compile();

  const app = moduleFixture.createNestApplication();

  // Mirror production middleware setup from main.ts
  app.use(cookieParser());
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

  await app.init();

  const dataSource = moduleFixture.get<DataSource>(DataSource);
  const agent = request.agent(app.getHttpServer());
  const rawRequest = request(app.getHttpServer());

  return {
    app,
    agent,
    rawRequest,
    dataSource,
    close: () => app.close(),
  };
}

export async function resetDb(dataSource: DataSource): Promise<void> {
  await truncateAll(dataSource);
}
