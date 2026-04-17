import { registerAs } from '@nestjs/config';
import { DataSourceOptions } from 'typeorm';

export type DatabaseConfig = DataSourceOptions & { autoLoadEntities: boolean };

export default registerAs('database', (): DatabaseConfig => {
  const isProduction = process.env.NODE_ENV === 'production';
  const ssl = isProduction ? { rejectUnauthorized: false } : false;

  const base = {
    type: 'postgres' as const,
    autoLoadEntities: true,
    synchronize: !isProduction,
    ssl,
  };

  if (process.env.DATABASE_URL) {
    return { ...base, url: process.env.DATABASE_URL };
  }

  return {
    ...base,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
});
