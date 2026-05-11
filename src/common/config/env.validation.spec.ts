import { validateEnv } from './env.validation';

const DEV_BASE = {
  JWT_SECRET: 'a-secret-that-is-at-least-32-chars-long',
  NODE_ENV: 'development',
};

const PROD_REFRESH = 'b-refresh-secret-at-least-32-chars-long';

const PROD_BASE = {
  ...DEV_BASE,
  NODE_ENV: 'production',
  JWT_REFRESH_SECRET: PROD_REFRESH,
  CORS_ORIGIN: 'https://app.example.com',
  DATABASE_URL: 'postgresql://user:pass@host:5432/db',
};

describe('validateEnv', () => {
  // ── JWT_SECRET ────────────────────────────────────────────────────────────

  it('throws when JWT_SECRET is missing', () => {
    expect(() => validateEnv({ NODE_ENV: 'development' })).toThrow(
      'JWT_SECRET environment variable is required',
    );
  });

  it('throws when JWT_SECRET is shorter than 32 chars', () => {
    expect(() => validateEnv({ JWT_SECRET: 'tooshort' })).toThrow(
      'JWT_SECRET must be at least 32 characters',
    );
  });

  it('passes with exactly 32-char JWT_SECRET in development', () => {
    expect(() => validateEnv({ JWT_SECRET: 'a'.repeat(32) })).not.toThrow();
  });

  it('returns the config object (same reference)', () => {
    const result = validateEnv(DEV_BASE);
    expect(result).toBe(DEV_BASE);
  });

  // ── Production: JWT_REFRESH_SECRET ─────────────────────────────────────

  describe('production — JWT_REFRESH_SECRET', () => {
    const base = { ...PROD_BASE };

    it('throws when JWT_REFRESH_SECRET is missing', () => {
      const { JWT_REFRESH_SECRET: _, ...withoutRefresh } = base;
      expect(() => validateEnv(withoutRefresh)).toThrow(
        'JWT_REFRESH_SECRET is required in production',
      );
    });

    it('throws when JWT_REFRESH_SECRET is shorter than 32 chars', () => {
      expect(() => validateEnv({ ...base, JWT_REFRESH_SECRET: 'tooshort' })).toThrow(
        'JWT_REFRESH_SECRET must be at least 32 characters',
      );
    });

    it('throws when JWT_REFRESH_SECRET equals JWT_SECRET', () => {
      expect(() =>
        validateEnv({ ...base, JWT_REFRESH_SECRET: DEV_BASE.JWT_SECRET }),
      ).toThrow('JWT_REFRESH_SECRET must be different from JWT_SECRET');
    });

    it('passes when JWT_REFRESH_SECRET is valid and distinct', () => {
      expect(() => validateEnv(base)).not.toThrow();
    });

    it('does NOT require JWT_REFRESH_SECRET in development', () => {
      // No JWT_REFRESH_SECRET in dev base — must not throw
      expect(() => validateEnv(DEV_BASE)).not.toThrow();
    });
  });

  // ── Production: CORS_ORIGIN ────────────────────────────────────────────

  describe('production — CORS_ORIGIN', () => {
    it('throws when CORS_ORIGIN is missing', () => {
      const { CORS_ORIGIN: _, ...noCors } = PROD_BASE;
      expect(() => validateEnv(noCors)).toThrow('CORS_ORIGIN is required in production');
    });

    it('throws when CORS_ORIGIN is wildcard "*"', () => {
      expect(() => validateEnv({ ...PROD_BASE, CORS_ORIGIN: '*' })).toThrow(
        "CORS_ORIGIN=* is not allowed in production",
      );
    });

    it('throws when CORS_ORIGIN is whitespace around "*"', () => {
      expect(() => validateEnv({ ...PROD_BASE, CORS_ORIGIN: '  *  ' })).toThrow(
        "CORS_ORIGIN=* is not allowed in production",
      );
    });

    it('passes with a real URL as CORS_ORIGIN', () => {
      expect(() => validateEnv(PROD_BASE)).not.toThrow();
    });
  });

  // ── Production: DB fallback vars ───────────────────────────────────────

  describe('production — DB vars when DATABASE_URL is absent', () => {
    const noDatabaseUrl = { ...PROD_BASE };
    delete (noDatabaseUrl as Record<string, unknown>)['DATABASE_URL'];

    it('throws when DB_HOST is missing and DATABASE_URL not set', () => {
      expect(() => validateEnv(noDatabaseUrl)).toThrow(
        'DB_HOST is required in production when DATABASE_URL is not set',
      );
    });

    it('passes when all individual DB vars are present', () => {
      expect(() =>
        validateEnv({
          ...noDatabaseUrl,
          DB_HOST: 'localhost',
          DB_PORT: '5432',
          DB_USER: 'app',
          DB_PASSWORD: 'pass',
          DB_NAME: 'mydb',
        }),
      ).not.toThrow();
    });

    it('does NOT require DB vars when DATABASE_URL is set', () => {
      expect(() => validateEnv(PROD_BASE)).not.toThrow();
    });
  });

  // ── THROTTLE_TTL ───────────────────────────────────────────────────────

  describe('THROTTLE_TTL validation', () => {
    it('throws when THROTTLE_TTL is not numeric', () => {
      expect(() => validateEnv({ ...DEV_BASE, THROTTLE_TTL: 'abc' })).toThrow(
        'THROTTLE_TTL must be a number >= 1000',
      );
    });

    it('throws when THROTTLE_TTL is below 1000', () => {
      expect(() => validateEnv({ ...DEV_BASE, THROTTLE_TTL: '999' })).toThrow(
        'THROTTLE_TTL must be a number >= 1000',
      );
    });

    it('passes when THROTTLE_TTL is exactly 1000', () => {
      expect(() => validateEnv({ ...DEV_BASE, THROTTLE_TTL: '1000' })).not.toThrow();
    });

    it('passes when THROTTLE_TTL is absent (optional)', () => {
      expect(() => validateEnv(DEV_BASE)).not.toThrow();
    });
  });

  // ── PORT ───────────────────────────────────────────────────────────────

  describe('PORT validation', () => {
    it('throws when PORT is not a number', () => {
      expect(() => validateEnv({ ...DEV_BASE, PORT: 'notaport' })).toThrow(
        'PORT must be a valid TCP port',
      );
    });

    it('throws when PORT is 0', () => {
      expect(() => validateEnv({ ...DEV_BASE, PORT: '0' })).toThrow(
        'PORT must be a valid TCP port',
      );
    });

    it('throws when PORT is above 65535', () => {
      expect(() => validateEnv({ ...DEV_BASE, PORT: '65536' })).toThrow(
        'PORT must be a valid TCP port',
      );
    });

    it('passes with PORT 3000', () => {
      expect(() => validateEnv({ ...DEV_BASE, PORT: '3000' })).not.toThrow();
    });

    it('passes without PORT (defaults to 3000 internally)', () => {
      expect(() => validateEnv(DEV_BASE)).not.toThrow();
    });
  });
});
