/**
 * Startup ENV guard — called by ConfigModule validate option.
 * Throws on first missing or invalid variable so the process never starts
 * with a broken config.
 *
 * Checked at bootstrap time, before any module initialises.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const nodeEnv = (config['NODE_ENV'] as string) || 'development';
  const isProduction = nodeEnv === 'production';

  // ── JWT_SECRET ────────────────────────────────────────────────────────────
  const jwtSecret = config['JWT_SECRET'] as string | undefined;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long (use: openssl rand -hex 32)');
  }

  // ── Production-only requirements ─────────────────────────────────────────
  if (isProduction) {
    const corsOrigin = config['CORS_ORIGIN'] as string | undefined;
    if (!corsOrigin) {
      throw new Error('CORS_ORIGIN is required in production (never use * in production)');
    }
    if (corsOrigin.trim() === '*') {
      throw new Error('CORS_ORIGIN=* is not allowed in production — set an explicit origin');
    }

    // If DATABASE_URL is absent, all individual params are required
    if (!config['DATABASE_URL']) {
      const required: string[] = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
      for (const key of required) {
        if (!config[key]) {
          throw new Error(
            `${key} is required in production when DATABASE_URL is not set`,
          );
        }
      }
    }
  }

  // ── PORT sanity ───────────────────────────────────────────────────────────
  const port = parseInt((config['PORT'] as string) || '3000', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be a valid TCP port number (got: ${config['PORT']})`);
  }

  return config;
}
