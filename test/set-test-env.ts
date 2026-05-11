// Runs before any test module is imported (Jest setupFiles).
// Sets all env vars required by ConfigModule.forRoot({ validate }) so that
// importing AppModule does not throw during module evaluation.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-exactly-32-chars!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-chars-ok!!';
process.env.JWT_EXPIRES_IN = '15m';
process.env.CORS_ORIGIN = 'http://localhost:3001';
process.env.THROTTLE_TTL = '60000';
process.env.THROTTLE_LIMIT = '1000';
delete process.env.DATABASE_URL;
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USER = 'sitepilot';
process.env.DB_PASSWORD = 'sitepilot';
process.env.DB_NAME = 'sitepilot_test';
