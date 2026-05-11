/**
 * Cross-cutting concerns: request-id propagation, error response shape
 * consistency, validation errors, throttler bypass in tests.
 */
import { createTestApp, resetDb, TestApp } from '../helpers/app.helper';
import { registerUser, bearerHeader, uniqueEmail } from '../helpers/auth.helper';

describe('Request Lifecycle (E2E)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await resetDb(t.dataSource);
  });

  // ── X-Request-Id ───────────────────────────────────────────────────────────

  describe('X-Request-Id propagation', () => {
    it('generates a UUID v4 when no header provided', async () => {
      const res = await t.agent.get('/health');
      const id = res.headers['x-request-id'];
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    });

    it('echoes back client-supplied X-Request-Id', async () => {
      const clientId = 'client-trace-id-xyz-789';
      const res = await t.agent.get('/health').set('X-Request-Id', clientId);
      expect(res.headers['x-request-id']).toBe(clientId);
    });

    it('includes requestId in error response body', async () => {
      const clientId = 'err-trace-001';
      const res = await t.agent
        .get('/nonexistent')
        .set('X-Request-Id', clientId)
        .expect(404);
      expect(res.body.requestId).toBe(clientId);
    });

    it('consecutive requests get different IDs', async () => {
      const ids = await Promise.all(
        Array.from({ length: 5 }, () =>
          t.agent.get('/health').then((r) => r.headers['x-request-id']),
        ),
      );
      const unique = new Set(ids);
      expect(unique.size).toBe(5);
    });
  });

  // ── Error response shape consistency ──────────────────────────────────────

  describe('Error response shape', () => {
    it('404 has statusCode, timestamp, path, message, requestId', async () => {
      const res = await t.agent.get('/does-not-exist').expect(404);
      expect(res.body.statusCode).toBe(404);
      expect(typeof res.body.timestamp).toBe('string');
      expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
      expect(res.body.path).toBe('/does-not-exist');
      expect(res.body.message).toBeDefined();
      expect(res.body.requestId).toBeDefined();
    });

    it('401 has correct statusCode', async () => {
      const res = await t.agent.get('/auth/me').expect(401);
      expect(res.body.statusCode).toBe(401);
    });

    it('400 validation error has statusCode 400', async () => {
      const res = await t.agent
        .post('/auth/register')
        .send({ email: 'bad', password: 'x' })
        .expect(400);
      expect(res.body.statusCode).toBe(400);
    });

    it('409 conflict has statusCode 409', async () => {
      const email = uniqueEmail();
      await t.agent.post('/auth/register').send({ email, password: 'ValidPass1!' });
      const res = await t.agent
        .post('/auth/register')
        .send({ email, password: 'ValidPass1!' })
        .expect(409);
      expect(res.body.statusCode).toBe(409);
    });

    it('403 forbidden has statusCode 403', async () => {
      const userA = await registerUser(t.agent);
      const userB = await registerUser(t.agent);
      const { body: project } = await t.agent
        .post('/projects')
        .set('Authorization', bearerHeader(userA.accessToken))
        .send({ name: 'Private' });

      const res = await t.agent
        .get(`/projects/${project.id}`)
        .set('Authorization', bearerHeader(userB.accessToken))
        .expect(403);

      expect(res.body.statusCode).toBe(403);
    });
  });

  // ── Whitelist validation ───────────────────────────────────────────────────

  describe('Whitelist validation (forbidNonWhitelisted)', () => {
    it('rejects unknown fields in register body → 400', async () => {
      await t.agent
        .post('/auth/register')
        .send({
          email: uniqueEmail(),
          password: 'ValidPass1!',
          isAdmin: true,         // unknown field
          role: 'admin',         // not allowed in DTO
        })
        .expect(400);
    });

    it('rejects unknown fields in project create body → 400', async () => {
      const { accessToken } = await registerUser(t.agent);
      await t.agent
        .post('/projects')
        .set('Authorization', bearerHeader(accessToken))
        .send({ name: 'Project', ownerId: 'hack' }) // ownerId not in DTO
        .expect(400);
    });
  });

  // ── Migration bootstrap verification ──────────────────────────────────────

  describe('Migration bootstrap', () => {
    it('all expected tables exist in test DB', async () => {
      const result = await t.dataSource.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      const tables = result.map((r: any) => r.table_name);
      expect(tables).toContain('users');
      expect(tables).toContain('projects');
      expect(tables).toContain('pages');
      expect(tables).toContain('subscriptions');
      expect(tables).toContain('migrations');
    });

    it('InitialSchema migration is recorded in migrations table', async () => {
      const result = await t.dataSource.query(
        `SELECT name FROM migrations WHERE name = 'InitialSchema1776200624919'`,
      );
      expect(result).toHaveLength(1);
    });

    it('uuid-ossp extension is active in test DB', async () => {
      const result = await t.dataSource.query(
        `SELECT extname FROM pg_extension WHERE extname = 'uuid-ossp'`,
      );
      expect(result).toHaveLength(1);
    });
  });
});
