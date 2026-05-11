import { createTestApp, resetDb, TestApp } from '../helpers/app.helper';

describe('Health (E2E)', () => {
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

  it('GET /health → 200 with status ok and full diagnostics shape', async () => {
    const res = await t.agent.get('/health').expect(200);

    expect(res.body.status).toBe('ok');
    expect(res.body.services.database).toBe('ok');
    expect(typeof res.body.timestamp).toBe('string');
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);

    const { diagnostics } = res.body;
    expect(diagnostics.database.status).toBe('ok');
    expect(diagnostics.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(diagnostics.memory.heapUsedMb).toBeGreaterThan(0);
    expect(diagnostics.memory.heapTotalMb).toBeGreaterThan(0);
    expect(diagnostics.memory.heapUsedMb).toBeLessThanOrEqual(diagnostics.memory.heapTotalMb);
    expect(diagnostics.node.version).toBe(process.version);
  });

  it('GET /health → response contains x-request-id header', async () => {
    const res = await t.agent.get('/health').expect(200);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('GET /health → passes through client X-Request-Id unchanged', async () => {
    const clientId = 'my-trace-id-abc-123';
    const res = await t.agent
      .get('/health')
      .set('X-Request-Id', clientId)
      .expect(200);
    expect(res.headers['x-request-id']).toBe(clientId);
  });

  it('GET /health → each call gets a unique request id when none provided', async () => {
    const [r1, r2] = await Promise.all([
      t.agent.get('/health'),
      t.agent.get('/health'),
    ]);
    expect(r1.headers['x-request-id']).not.toBe(r2.headers['x-request-id']);
  });

  it('GET /nonexistent → 404 error shape is consistent', async () => {
    const res = await t.agent.get('/does-not-exist').expect(404);
    expect(res.body.statusCode).toBe(404);
    expect(typeof res.body.timestamp).toBe('string');
    expect(res.body.path).toBe('/does-not-exist');
    expect(res.body.message).toBeDefined();
    expect(res.body.requestId).toBeDefined();
  });
});
