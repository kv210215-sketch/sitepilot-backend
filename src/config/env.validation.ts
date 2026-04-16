const toNumber = (value: string | undefined, defaultValue: number): number => {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number value: ${value}`);
  }

  return parsed;
};

const toBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  return ['true', '1', 'yes'].includes(value.toLowerCase());
};

export const validateEnv = (config: Record<string, string | undefined>) => {
  const nodeEnv = config.NODE_ENV ?? 'development';
  const jwtSecret = config.JWT_SECRET;

  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: toNumber(config.PORT, 3000),
    FRONTEND_URL: config.FRONTEND_URL ?? '',
    DATABASE_URL: config.DATABASE_URL,
    DB_HOST: config.DB_HOST ?? 'localhost',
    DB_PORT: toNumber(config.DB_PORT, 5432),
    DB_USERNAME: config.DB_USERNAME ?? 'postgres',
    DB_PASSWORD: config.DB_PASSWORD ?? 'postgres',
    DB_NAME: config.DB_NAME ?? 'sitepilot',
    DB_SSL: toBoolean(config.DB_SSL, false),
    DB_SYNCHRONIZE: toBoolean(config.DB_SYNCHRONIZE, nodeEnv !== 'production'),
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: config.JWT_EXPIRES_IN ?? '1d',
  };
};
