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
import { setTestEnv } from '../set-test-env';
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
