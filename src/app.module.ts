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

function getRequiredConfig(config: ConfigService, key: string): string {
  const value = config.get<string>(key);

  if (!value) {
    throw new Error(`${key} environment variable is required in production`);
  }

  return value;
}

@Module({
  imports: [
    // Load .env globally
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // TypeORM with dynamic config — supports DATABASE_URL (Railway) or individual params
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        const isProduction = config.get<string>('NODE_ENV') === 'production';

        const base = {
          type: 'postgres' as const,
          autoLoadEntities: true,
          synchronize: !isProduction, // use migrations in production
          ssl: databaseUrl && isProduction ? { rejectUnauthorized: false } : false,
          logging: !isProduction,
        };

        if (databaseUrl) {
          return { ...base, url: databaseUrl };
        }

        const host = isProduction ? getRequiredConfig(config, 'DB_HOST') : config.get<string>('DB_HOST') || 'localhost';
        const port = parseInt(config.get<string>('DB_PORT') || '5432', 10);
        const username = isProduction ? getRequiredConfig(config, 'DB_USER') : config.get<string>('DB_USER') || 'sitepilot';
        const password = isProduction ? getRequiredConfig(config, 'DB_PASSWORD') : config.get<string>('DB_PASSWORD') || 'sitepilot';
        const database = isProduction ? getRequiredConfig(config, 'DB_NAME') : config.get<string>('DB_NAME') || 'sitepilot';

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
