/**
 * TypeORM DataSource for the CLI (migration generation, run, revert).
 * The NestJS app uses TypeOrmModule.forRootAsync() in app.module.ts.
 *
 * Usage:
 *   npm run db:migrate:run
 *   npm run db:migrate:revert
 *   npm run db:migrate:generate --name=AddColumnX
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

// Entities — direct imports work in both ts-node (dev) and compiled JS (prod)
import { User } from './users/entities/user.entity';
import { Project } from './projects/entities/project.entity';
import { Page } from './pages/entities/page.entity';
import { Subscription } from './billing/entities/subscription.entity';

// Migrations — TypeScript sources (ts-node for CLI, compiled JS at runtime)
import { InitialSchema1776200624919 } from './database/migrations/1776200624919-InitialSchema';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === 'production';

const base: Partial<DataSourceOptions> = {
  type: 'postgres',
  entities: [User, Project, Page, Subscription],
  migrations: [InitialSchema1776200624919],
  synchronize: false, // always false — let migrations handle schema
  ssl: databaseUrl && isProduction ? ({ rejectUnauthorized: false } as any) : false,
  logging: !isProduction,
};

export const AppDataSource = new DataSource(
  databaseUrl
    ? ({ ...base, url: databaseUrl } as DataSourceOptions)
    : ({
        ...base,
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USER || 'sitepilot',
        password: process.env.DB_PASSWORD || 'sitepilot',
        database: process.env.DB_NAME || 'sitepilot',
      } as DataSourceOptions),
);
