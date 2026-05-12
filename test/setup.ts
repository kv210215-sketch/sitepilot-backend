/**
 * Global Jest setup — runs once before all E2E suites.
 * Boots the isolated test database: applies migrations from scratch.
 * Never touches the development (sitepilot) database.
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ensureTestDatabase, getTestDataSourceOptions } from './helpers/db.helper';

export default async function globalSetup(): Promise<void> {
  process.env.NODE_ENV = 'test';

  const ds = new DataSource(getTestDataSourceOptions());

  try {
    await ensureTestDatabase();
    await ds.initialize();
    await ds.runMigrations({ transaction: 'each' });
    console.log('\n[test:setup] Migrations applied to isolated test database ✓');
  } finally {
    if (ds.isInitialized) {
      await ds.destroy();
    }
  }
}
