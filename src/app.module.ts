import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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

  if (!value) {
    throw new Error(`${key} environment variable is required in production`);
  }

  return value;
}

@Module({
  imports: [
    // Load .env and validate required variables at startup
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateEnv,
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
          // Retry on transient connection failures (e.g. DB slow to start on Railway)
          retryAttempts: 10,
          retryDelay: 3000,
        };

        if (databaseUrl) {
          return { ...base, url: databaseUrl };
        }

        const host = isProduction
          ? getRequiredConfig(config, 'DB_HOST')
          : config.get<string>('DB_HOST') || 'localhost';
        const port = parseInt(config.get<string>('DB_PORT') || '5432', 10);
        const username = isProduction
          ? getRequiredConfig(config, 'DB_USER')
          : config.get<string>('DB_USER') || 'sitepilot';
        const password = isProduction
          ? getRequiredConfig(config, 'DB_PASSWORD')
          : config.get<string>('DB_PASSWORD') || 'sitepilot';
        const database = isProduction
          ? getRequiredConfig(config, 'DB_NAME')
          : config.get<string>('DB_NAME') || 'sitepilot';

        return {
          ...base,
          host,
          port,
          username,
          password,
          database,
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
})
export class AppModule {}
