/**
 * Startup ENV guard — called by ConfigModule validate option.
 * Throws on the first missing or invalid variable so the process never
 * starts with a broken configuration.
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
    throw new Error(
      'JWT_SECRET must be at least 32 characters (generate: openssl rand -hex 32)',
    );
  }

  // ── JWT_REFRESH_SECRET ─────────────────────────────────────────────────
  const jwtRefreshSecret = config['JWT_REFRESH_SECRET'] as string | undefined;
  if (isProduction) {
    if (!jwtRefreshSecret) {
      throw new Error(
        'JWT_REFRESH_SECRET is required in production (must be different from JWT_SECRET)',
      );
    }
    if (jwtRefreshSecret.length < 32) {
      throw new Error(
        'JWT_REFRESH_SECRET must be at least 32 characters (generate: openssl rand -hex 32)',
      );
    }
    if (jwtRefreshSecret === jwtSecret) {
      throw new Error(
        'JWT_REFRESH_SECRET must be different from JWT_SECRET — using the same value defeats refresh token security',
      );
    }
  }

  // ── Production-only requirements ───────────────────────────────────────
  if (isProduction) {
    const corsOrigin = config['CORS_ORIGIN'] as string | undefined;
    if (!corsOrigin) {
      throw new Error('CORS_ORIGIN is required in production');
    }
    if (corsOrigin.trim() === '*') {
      throw new Error(
        'CORS_ORIGIN=* is not allowed in production — set an explicit frontend origin',
      );
    }

    if (!config['DATABASE_URL']) {
      for (const key of ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
        if (!config[key]) {
          throw new Error(`${key} is required in production when DATABASE_URL is not set`);
        }
      }
    }
  }

  // ── THROTTLE config sanity ──────────────────────────────────────────────
  const throttleTtl = config['THROTTLE_TTL'] as string | undefined;
  if (throttleTtl !== undefined) {
    const ttl = parseInt(throttleTtl, 10);
    if (isNaN(ttl) || ttl < 1000) {
      throw new Error('THROTTLE_TTL must be a number >= 1000 (milliseconds)');
    }
  }

  // ── PORT sanity ───────────────────────────────────────────────────────────
  const port = parseInt((config['PORT'] as string) || '3000', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be a valid TCP port (got: ${config['PORT']})`);
  }

  return config;
}
