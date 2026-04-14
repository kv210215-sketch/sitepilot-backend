/**
 * TypeORM DataSource — used exclusively by the TypeORM CLI for migrations.
 * The app itself uses TypeOrmModule.forRootAsync() in app.module.ts.
 *
 * Usage:
 *   npm run db:migrate:generate --name=CreateUsers
 *   npm run db:migrate:run
 *   npm run db:migrate:revert
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === 'production';

const base: Partial<DataSourceOptions> = {
  type: 'postgres',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false, // always false for migrations
  ssl: databaseUrl && isProduction ? ({ rejectUnauthorized: false } as any) : false,
  logging: true,
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
