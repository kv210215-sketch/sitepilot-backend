/**
 * Runs all pending TypeORM migrations and exits.
 * Called as a pre-start step in production (see railway.toml / startCommand).
 * 
 * If the database is not ready, logs a warning and exits gracefully (code 0)
 * to allow the app to start. Migrations will retry on next deployment.
 *
 * Usage: node dist/database/run-migrations
 */
import 'reflect-metadata';
import { AppDataSource } from '../data-source';

async function main() {
  console.log('[migrations] Connecting to database…');
  
  try {
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
    process.exit(0);
  } catch (err) {
    console.warn('[migrations] Database not ready or migration failed:', err instanceof Error ? err.message : err);
    console.warn('[migrations] Allowing app to start anyway. Migrations will retry on next deployment.');
    process.exit(0); // Exit gracefully to allow app startup
  }
}

main().catch((err) => {
  console.error('[migrations] Unexpected error:', err);
  process.exit(0); // Still exit gracefully
});
