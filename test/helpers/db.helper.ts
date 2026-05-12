/**
 * Test database helpers.
 *
 * TEST_DATABASE_URL env var is the escape hatch for CI:
 *   TEST_DATABASE_URL=postgresql://sitepilot:sitepilot@localhost:5432/sitepilot_test
 *
 * Falls back to local sitepilot_backend with default credentials.
 * Never reads DATABASE_URL — that is the production/dev variable.
 */
import { Client } from 'pg';
import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Subscription } from '../../src/billing/entities/subscription.entity';
import { InitialSchema1776200624919 } from '../../src/database/migrations/1776200624919-InitialSchema';
import { Page } from '../../src/pages/entities/page.entity';
import { Project } from '../../src/projects/entities/project.entity';
import { User } from '../../src/users/entities/user.entity';

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://sitepilot:sitepilot@localhost:5432/sitepilot_backend';

function getParsedTestDbUrl(): URL {
  return new URL(TEST_DB_URL);
}

export async function ensureTestDatabase(): Promise<void> {
  const parsed = getParsedTestDbUrl();
  const databaseName = parsed.pathname.replace(/^\//, '');

  const admin = new Client({
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 5432,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: 'postgres',
  });

  await admin.connect();

  try {
    const exists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
    if (exists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${databaseName.replace(/"/g, '""')}"`);
    }
  } finally {
    await admin.end();
  }
}

export function getTestDataSourceOptions(): DataSourceOptions {
  return {
    type: 'postgres',
    url: TEST_DB_URL,
    entities: [User, Project, Page, Subscription],
    migrations: [InitialSchema1776200624919],
    synchronize: false,
    logging: false,
    ssl: false,
  };
}

/**
 * Truncate all application tables in dependency order.
 * Called in beforeEach of each suite to guarantee a clean slate.
 * Does NOT drop/recreate — much faster than re-migrating.
 */
export async function truncateAll(ds: DataSource): Promise<void> {
  await ds.query(
    `TRUNCATE TABLE pages, subscriptions, projects, users RESTART IDENTITY CASCADE`,
  );
}
