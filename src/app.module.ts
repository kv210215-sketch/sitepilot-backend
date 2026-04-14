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

        return {
          ...base,
          host: config.get<string>('DB_HOST') || 'localhost',
          port: parseInt(config.get<string>('DB_PORT') || '5432', 10),
          username: config.get<string>('DB_USER') || 'postgres',
          password: config.get<string>('DB_PASSWORD') || 'postgres',
          database: config.get<string>('DB_NAME') || 'sitepilot',
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
