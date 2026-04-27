/**
 * Runs all pending TypeORM migrations and exits.
 * Called as a pre-start step in production (see railway.toml / startCommand).
 *
 * Usage: node dist/database/run-migrations
 */
import 'reflect-metadata';
import { AppDataSource } from '../data-source';

async function main() {
  console.log('[migrations] Connecting to database…');
  const ds = await AppDataSource.initialize();

  const pending = await ds.showMigrations();
  if (!pending) {
    console.log('[migrations] All migrations are up to date — nothing to run.');
  } else {
    console.log('[migrations] Running pending migrations…');
    const ran = await ds.runMigrations({ transaction: 'each' });
    console.log(`[migrations] Applied ${ran.length} migration(s):`, ran.map((m) => m.name));
  }

  await ds.destroy();
  console.log('[migrations] Done.');
}

main().catch((err) => {
  console.error('[migrations] FAILED:', err);
  process.exit(1);
});
