import { plainToClass, Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

enum NodeEnvironment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  NODE_ENV: NodeEnvironment;

  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number;

  // Database — either DATABASE_URL or individual DB_* vars must be set.
  // Presence is enforced in the validate function below; these decorators
  // ensure the values are non-empty strings when they are provided.
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  DATABASE_URL?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  DB_HOST?: string;

  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : undefined))
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  DB_USERNAME?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  DB_PASSWORD?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  DB_NAME?: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_EXPIRES_IN: string;

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  CORS_ORIGINS?: string;
}

const WEAK_SECRETS = new Set([
  'change-me',
  'change-me-to-a-random-256-bit-secret',
  'secret',
  'mysecret',
  'password',
  'changeme',
]);

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: false,
    excludeExtraneousValues: false,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const messages = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Environment validation failed: ${messages}`);
  }

  // Require DATABASE_URL or the full set of DB_* vars.
  const hasUrl = Boolean(validated.DATABASE_URL);
  const hasDbParts =
    validated.DB_HOST &&
    validated.DB_PORT &&
    validated.DB_USERNAME &&
    validated.DB_PASSWORD &&
    validated.DB_NAME;

  if (!hasUrl && !hasDbParts) {
    throw new Error(
      'Environment validation failed: provide either DATABASE_URL or all of ' +
        'DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME',
    );
  }

  // In production, block known-weak secrets.
  if (validated.NODE_ENV === NodeEnvironment.Production) {
    const secretFields: Array<keyof EnvironmentVariables> = [
      'JWT_SECRET',
      'JWT_REFRESH_SECRET',
    ];
    for (const field of secretFields) {
      const value = String(validated[field] ?? '').toLowerCase().trim();
      if (WEAK_SECRETS.has(value) || value.length < 32) {
        throw new Error(
          `Environment validation failed: ${field} is too weak or is a placeholder — ` +
            'use a cryptographically random secret of at least 32 characters in production',
        );
      }
    }
  }

  return validated;
}
