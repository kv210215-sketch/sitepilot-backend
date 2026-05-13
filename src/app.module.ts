import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { validateEnv } from './common/config/env.validation';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { HealthModule } from './health/health.module';
import { PagesModule } from './pages/pages.module';
import { ProjectsModule } from './projects/projects.module';
import { PublishModule } from './publish/publish.module';
import { UsersModule } from './users/users.module';

function getRequiredConfig(config: ConfigService, key: string): string {
  const value = config.get<string>(key);
  if (!value) throw new Error(`${key} environment variable is required in production`);
  return value;
}

function resolveSynchronize(config: ConfigService, isProduction: boolean): boolean {
  if (isProduction) {
    return false;
  }

  const raw = config.get<string>('DB_SYNCHRONIZE');
  if (raw === undefined) {
    return !isProduction;
  }

  return raw.toLowerCase() === 'true';
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: parseInt(config.get<string>('THROTTLE_TTL') ?? '60000', 10),
          limit: parseInt(config.get<string>('THROTTLE_LIMIT') ?? '100', 10),
        },
      ],
    }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        const isProduction = config.get<string>('NODE_ENV') === 'production';
        const synchronize = resolveSynchronize(config, isProduction);

        const base = {
          type: 'postgres' as const,
          autoLoadEntities: true,
          synchronize,
          ssl: databaseUrl && isProduction ? { rejectUnauthorized: false } : false,
          logging: !isProduction,
          retryAttempts: 10,
          retryDelay: 3000,
        };

        if (databaseUrl) return { ...base, url: databaseUrl };

        return {
          ...base,
          host: isProduction
            ? getRequiredConfig(config, 'DB_HOST')
            : config.get<string>('DB_HOST') || 'localhost',
          port: parseInt(config.get<string>('DB_PORT') || '5432', 10),
          username: isProduction
            ? getRequiredConfig(config, 'DB_USER')
            : config.get<string>('DB_USER') || 'sitepilot',
          password: isProduction
            ? getRequiredConfig(config, 'DB_PASSWORD')
            : config.get<string>('DB_PASSWORD') || 'sitepilot',
          database: isProduction
            ? getRequiredConfig(config, 'DB_NAME')
            : config.get<string>('DB_NAME') || 'sitepilot',
        };
      },
    }),

    AuthModule,
    UsersModule,
    ProjectsModule,
    PagesModule,
    PublishModule,
    BillingModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
