/**
 * Global Jest setup — runs once before all E2E suites.
 * Boots the test database: applies migrations from scratch on sitepilot_test.
 * Never touches the development (sitepilot) database.
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { getTestDataSourceOptions } from './helpers/db.helper';

export default async function globalSetup(): Promise<void> {
  process.env.NODE_ENV = 'test';

  const ds = new DataSource(getTestDataSourceOptions());

  try {
    await ds.initialize();
    await ds.runMigrations({ transaction: 'each' });
    console.log('\n[test:setup] Migrations applied to sitepilot_test ✓');
  } finally {
    await ds.destroy();
  }
}
