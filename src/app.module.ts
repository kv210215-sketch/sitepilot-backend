import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv } from './config/env.validation';
import { User } from './users/user.entity';
import { Organization } from './organizations/organization.entity';
import { Project } from './projects/project.entity';
import { Page } from './pages/page.entity';
import { AuditLog } from './audit/audit-log.entity';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ProjectsModule } from './projects/projects.module';
import { PagesModule } from './pages/pages.module';
import { HealthModule } from './health/health.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');

        if (databaseUrl) {
          return {
            type: 'postgres' as const,
            url: databaseUrl,
            ssl: configService.get<boolean>('DB_SSL', false) ? { rejectUnauthorized: false } : false,
            entities: [User, Organization, Project, Page, AuditLog],
            synchronize: configService.get<boolean>('DB_SYNCHRONIZE', false),
            autoLoadEntities: false,
            logging: false,
          };
        }

        return {
          type: 'postgres' as const,
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 5432),
          username: configService.get<string>('DB_USERNAME', 'postgres'),
          password: configService.get<string>('DB_PASSWORD', 'postgres'),
          database: configService.get<string>('DB_NAME', 'sitepilot'),
          ssl: configService.get<boolean>('DB_SSL', false) ? { rejectUnauthorized: false } : false,
          entities: [User, Organization, Project, Page, AuditLog],
          synchronize: configService.get<boolean>('DB_SYNCHRONIZE', false),
          autoLoadEntities: false,
          logging: false,
        };
      },
    }),
    AuthModule,
    UsersModule,
    OrganizationsModule,
    ProjectsModule,
    PagesModule,
    HealthModule,
    AuditModule,
  ],
})
export class AppModule {}
