// Runs before any test module is imported (Jest setupFiles).
// Sets all env vars required by ConfigModule.forRoot({ validate }) so that
// importing AppModule does not throw during module evaluation.
const LOCAL_TEST_DATABASE_URL = 'postgresql://sitepilot:sitepilot@localhost:5432/sitepilot_backend';

function applyResolvedTestDatabaseEnv(): void {
    const resolvedUrl = process.env.TEST_DATABASE_URL || LOCAL_TEST_DATABASE_URL;
    const parsed = new URL(resolvedUrl);

    process.env.TEST_DATABASE_URL = resolvedUrl;
    process.env.DATABASE_URL = resolvedUrl;
    process.env.DB_HOST = parsed.hostname;
    process.env.DB_PORT = parsed.port || '5432';
    process.env.DB_USER = decodeURIComponent(parsed.username);
    process.env.DB_PASSWORD = decodeURIComponent(parsed.password);
    process.env.DB_NAME = parsed.pathname.replace(/^\//, '');
}

export function setTestEnv(): void {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-exactly-32-chars!!';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-chars-ok!!';
    process.env.JWT_EXPIRES_IN = '15m';
    process.env.CORS_ORIGIN = 'http://localhost:3001';
    process.env.THROTTLE_TTL = '60000';
    process.env.THROTTLE_LIMIT = '1000';
    applyResolvedTestDatabaseEnv();
}

setTestEnv();
