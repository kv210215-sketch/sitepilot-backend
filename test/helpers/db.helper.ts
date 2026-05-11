/**
 * Test database helpers.
 *
 * TEST_DATABASE_URL env var is the escape hatch for CI:
 *   TEST_DATABASE_URL=postgresql://sitepilot:sitepilot@localhost:5432/sitepilot_test
 *
 * Falls back to local sitepilot_test with default credentials.
 * Never reads DATABASE_URL — that is the production/dev variable.
 */
import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from '../../src/users/entities/user.entity';
import { Project } from '../../src/projects/entities/project.entity';
import { Page } from '../../src/pages/entities/page.entity';
import { Subscription } from '../../src/billing/entities/subscription.entity';
import { InitialSchema1776200624919 } from '../../src/database/migrations/1776200624919-InitialSchema';

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://sitepilot:sitepilot@localhost:5432/sitepilot_test';

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
