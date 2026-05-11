import { HealthController } from './health.controller';
import { DataSource } from 'typeorm';

// Minimal DataSource mock — no DB connection, no NestJS context
function makeDataSource(
  isInitialized: boolean,
  queryImpl?: () => Promise<unknown>,
): DataSource {
  return {
    isInitialized,
    query: queryImpl ?? jest.fn().mockResolvedValue([{ '?column?': 1 }]),
  } as unknown as DataSource;
}

describe('HealthController', () => {
  // ── DB not initialised ──────────────────────────────────────────────────

  describe('when DataSource is not initialised', () => {
    let controller: HealthController;

    beforeEach(() => {
      controller = new HealthController(makeDataSource(false));
    });

    it('status is "degraded"', async () => {
      const result = await controller.check();
      expect(result.status).toBe('degraded');
    });

    it('services.database is "error"', async () => {
      const result = await controller.check();
      expect(result.services.database).toBe('error');
    });

    it('diagnostics.database.status is "error"', async () => {
      const result = await controller.check();
      expect(result.diagnostics.database.status).toBe('error');
    });

    it('diagnostics.database.latencyMs is -1', async () => {
      const result = await controller.check();
      expect(result.diagnostics.database.latencyMs).toBe(-1);
    });
  });

  // ── DB initialised, query succeeds ─────────────────────────────────────

  describe('when DataSource is initialised and query succeeds', () => {
    let controller: HealthController;

    beforeEach(() => {
      controller = new HealthController(makeDataSource(true));
    });

    it('status is "ok"', async () => {
      expect((await controller.check()).status).toBe('ok');
    });

    it('services.database is "ok"', async () => {
      expect((await controller.check()).services.database).toBe('ok');
    });

    it('diagnostics.database.status is "ok"', async () => {
      expect((await controller.check()).diagnostics.database.status).toBe('ok');
    });

    it('diagnostics.database.latencyMs is >= 0', async () => {
      expect((await controller.check()).diagnostics.database.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ── DB initialised but query throws ────────────────────────────────────

  describe('when DataSource is initialised but query throws', () => {
    let controller: HealthController;

    beforeEach(() => {
      controller = new HealthController(
        makeDataSource(true, () => Promise.reject(new Error('connection reset'))),
      );
    });

    it('status is "degraded" (error is caught, never propagated)', async () => {
      await expect(controller.check()).resolves.toMatchObject({ status: 'degraded' });
    });

    it('services.database is "error"', async () => {
      expect((await controller.check()).services.database).toBe('error');
    });
  });

  // ── Response shape ──────────────────────────────────────────────────────

  describe('response shape', () => {
    let controller: HealthController;

    beforeEach(() => {
      controller = new HealthController(makeDataSource(false));
    });

    it('timestamp is a valid ISO 8601 string', async () => {
      const { timestamp } = await controller.check();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it('uptime is a non-negative integer', async () => {
      const { uptime } = await controller.check();
      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(uptime)).toBe(true);
    });

    it('diagnostics.memory contains numeric heap and rss values', async () => {
      const { diagnostics } = await controller.check();
      expect(typeof diagnostics.memory.heapUsedMb).toBe('number');
      expect(typeof diagnostics.memory.heapTotalMb).toBe('number');
      expect(typeof diagnostics.memory.rssMb).toBe('number');
    });

    it('diagnostics.memory values are positive', async () => {
      const { diagnostics } = await controller.check();
      expect(diagnostics.memory.heapUsedMb).toBeGreaterThan(0);
      expect(diagnostics.memory.rssMb).toBeGreaterThan(0);
    });

    it('diagnostics.node.version matches process.version', async () => {
      expect((await controller.check()).diagnostics.node.version).toBe(process.version);
    });

    it('diagnostics.node.uptime matches top-level uptime', async () => {
      const result = await controller.check();
      // Both computed from process.uptime() in the same call — should be equal
      expect(result.diagnostics.node.uptime).toBe(result.uptime);
    });

    it('services.database and diagnostics.database.status are always consistent', async () => {
      const result = await controller.check();
      expect(result.services.database).toBe(result.diagnostics.database.status);
    });

    it('heapUsedMb is less than or equal to heapTotalMb', async () => {
      const { diagnostics } = await controller.check();
      expect(diagnostics.memory.heapUsedMb).toBeLessThanOrEqual(
        diagnostics.memory.heapTotalMb,
      );
    });
  });
});
