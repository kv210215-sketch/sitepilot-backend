import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { PagesModule } from './pages/pages.module';
import { PublishModule } from './publish/publish.module';
import { BillingModule } from './billing/billing.module';
import { HealthModule } from './health/health.module';
import { validateEnv } from './common/config/env.validation';

function getRequiredConfig(config: ConfigService, key: string): string {
  const value = config.get<string>(key);
  if (!value) throw new Error(`${key} environment variable is required in production`);
  return value;
}

@Module({
  imports: [
    // Load .env and validate required variables at startup before any module inits
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
    }),

    // Rate limiting — configurable via THROTTLE_TTL / THROTTLE_LIMIT env vars
    // Default: 100 requests per 60 seconds per IP
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

    // TypeORM — supports DATABASE_URL (Railway) or individual DB_* params
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        const isProduction = config.get<string>('NODE_ENV') === 'production';

        const base = {
          type: 'postgres' as const,
          autoLoadEntities: true,
          synchronize: !isProduction,
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
    // Apply ThrottlerGuard globally to every route
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
