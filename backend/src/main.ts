import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableShutdownHooks();

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = app.get(ConfigService);
  const corsOrigins = config.get<string[]>('app.corsOrigins') ?? ['http://localhost:3000'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const port = config.get<number>('app.port') ?? 3001;
  const nodeEnv = config.get<string>('app.nodeEnv') ?? 'development';
  await app.listen(port, '0.0.0.0');

  const dbMode = process.env.DATABASE_URL ? 'DATABASE_URL' : 'discrete DB vars';
  console.log(`🚀 API running  → http://localhost:${port}/api`);
  console.log(`   NODE_ENV     → ${nodeEnv}`);
  console.log(`   DB config    → ${dbMode}`);
  console.log(`   Health       → http://localhost:${port}/api/health`);
}

bootstrap().catch((err) => {
  console.error('Fatal: bootstrap failed', err);
  process.exit(1);
});

