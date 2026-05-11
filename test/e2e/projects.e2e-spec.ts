import { createTestApp, resetDb, TestApp } from '../helpers/app.helper';
import { registerUser, bearerHeader } from '../helpers/auth.helper';

describe('Projects (E2E)', () => {
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

  // ── CRUD lifecycle ─────────────────────────────────────────────────────────

  describe('CRUD lifecycle', () => {
    it('creates a project → 201 with id and slug', async () => {
      const { accessToken } = await registerUser(t.agent);

      const res = await t.agent
        .post('/projects')
        .set('Authorization', bearerHeader(accessToken))
        .send({ name: 'My First Project', description: 'Testing' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('My First Project');
      expect(res.body.slug).toBe('my-first-project');
      expect(res.body.userId).toBeDefined();
      expect(res.body.isPublished).toBe(false);
    });

    it('lists only own projects', async () => {
      const userA = await registerUser(t.agent);
      const userB = await registerUser(t.agent);

      await t.agent
        .post('/projects')
        .set('Authorization', bearerHeader(userA.accessToken))
        .send({ name: 'User A Project' });

      await t.agent
        .post('/projects')
        .set('Authorization', bearerHeader(userB.accessToken))
        .send({ name: 'User B Project' });

      const resA = await t.agent
        .get('/projects')
        .set('Authorization', bearerHeader(userA.accessToken))
        .expect(200);

      expect(resA.body).toHaveLength(1);
      expect(resA.body[0].name).toBe('User A Project');
    });

    it('gets own project by id → 200', async () => {
      const { accessToken } = await registerUser(t.agent);
      const { body: project } = await t.agent
        .post('/projects')
        .set('Authorization', bearerHeader(accessToken))
        .send({ name: 'Get Me' });

      const res = await t.agent
        .get(`/projects/${project.id}`)
        .set('Authorization', bearerHeader(accessToken))
        .expect(200);

      expect(res.body.id).toBe(project.id);
    });

    it('updates own project → 200 with new name', async () => {
      const { accessToken } = await registerUser(t.agent);
      const { body: project } = await t.agent
        .post('/projects')
        .set('Authorization', bearerHeader(accessToken))
        .send({ name: 'Original Name' });

      const res = await t.agent
        .patch(`/projects/${project.id}`)
        .set('Authorization', bearerHeader(accessToken))
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Name');
    });

    it('deletes own project → 204, then 404 on re-fetch', async () => {
      const { accessToken } = await registerUser(t.agent);
      const { body: project } = await t.agent
        .post('/projects')
        .set('Authorization', bearerHeader(accessToken))
        .send({ name: 'Delete Me' });

      await t.agent
        .delete(`/projects/${project.id}`)
        .set('Authorization', bearerHeader(accessToken))
        .expect(204);

      await t.agent
        .get(`/projects/${project.id}`)
        .set('Authorization', bearerHeader(accessToken))
        .expect(404);
    });
  });

  // ── Ownership isolation ────────────────────────────────────────────────────

  describe('Ownership isolation', () => {
    it('returns 403 when user B tries to GET user A\'s project', async () => {
      const userA = await registerUser(t.agent);
      const userB = await registerUser(t.agent);

      const { body: project } = await t.agent
        .post('/projects')
        .set('Authorization', bearerHeader(userA.accessToken))
        .send({ name: 'Private Project' });

      await t.agent
        .get(`/projects/${project.id}`)
        .set('Authorization', bearerHeader(userB.accessToken))
        .expect(403);
    });

    it('returns 403 when user B tries to UPDATE user A\'s project', async () => {
      const userA = await registerUser(t.agent);
      const userB = await registerUser(t.agent);

      const { body: project } = await t.agent
        .post('/projects')
        .set('Authorization', bearerHeader(userA.accessToken))
        .send({ name: 'Protected Project' });

      await t.agent
        .patch(`/projects/${project.id}`)
        .set('Authorization', bearerHeader(userB.accessToken))
        .send({ name: 'Hijacked' })
        .expect(403);
    });

    it('returns 403 when user B tries to DELETE user A\'s project', async () => {
      const userA = await registerUser(t.agent);
      const userB = await registerUser(t.agent);

      const { body: project } = await t.agent
        .post('/projects')
        .set('Authorization', bearerHeader(userA.accessToken))
        .send({ name: 'Indestructible Project' });

      await t.agent
        .delete(`/projects/${project.id}`)
        .set('Authorization', bearerHeader(userB.accessToken))
        .expect(403);
    });

    it('returns 404 for non-existent project id (not 403 — no info leak)', async () => {
      const { accessToken } = await registerUser(t.agent);
      await t.agent
        .get('/projects/00000000-0000-4000-8000-000000000000')
        .set('Authorization', bearerHeader(accessToken))
        .expect(404);
    });
  });

  // ── Auth guard ─────────────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('returns 401 on all project routes without token', async () => {
      await t.agent.get('/projects').expect(401);
      await t.agent.post('/projects').send({ name: 'X' }).expect(401);
    });
  });

  // ── Input validation ───────────────────────────────────────────────────────

  describe('Input validation', () => {
    it('rejects create with missing name → 400', async () => {
      const { accessToken } = await registerUser(t.agent);
      await t.agent
        .post('/projects')
        .set('Authorization', bearerHeader(accessToken))
        .send({ description: 'no name' })
        .expect(400);
    });

    it('accepts custom slug on create', async () => {
      const { accessToken } = await registerUser(t.agent);
      const res = await t.agent
        .post('/projects')
        .set('Authorization', bearerHeader(accessToken))
        .send({ name: 'Slug Test', slug: 'my-custom-slug' })
        .expect(201);
      expect(res.body.slug).toBe('my-custom-slug');
    });
  });
});
