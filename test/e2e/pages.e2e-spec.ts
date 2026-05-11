import { createTestApp, resetDb, TestApp } from '../helpers/app.helper';
import { registerUser, bearerHeader } from '../helpers/auth.helper';

describe('Pages (E2E)', () => {
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

  /** Helper: create a project for a user and return its id */
  async function createProject(token: string, name = 'Test Project'): Promise<string> {
    const res = await t.agent
      .post('/projects')
      .set('Authorization', bearerHeader(token))
      .send({ name });
    return res.body.id;
  }

  // ── CRUD lifecycle ─────────────────────────────────────────────────────────

  describe('CRUD lifecycle', () => {
    it('creates a page in own project → 201 with id and slug', async () => {
      const { accessToken } = await registerUser(t.agent);
      const projectId = await createProject(accessToken);

      const res = await t.agent
        .post(`/projects/${projectId}/pages`)
        .set('Authorization', bearerHeader(accessToken))
        .send({ title: 'Home Page' })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('Home Page');
      expect(res.body.slug).toBe('home-page');
      expect(res.body.projectId).toBe(projectId);
      expect(res.body.isPublished).toBe(false);
    });

    it('lists pages in own project → array ordered by order ASC', async () => {
      const { accessToken } = await registerUser(t.agent);
      const projectId = await createProject(accessToken);

      await t.agent
        .post(`/projects/${projectId}/pages`)
        .set('Authorization', bearerHeader(accessToken))
        .send({ title: 'Page B', order: 2 });
      await t.agent
        .post(`/projects/${projectId}/pages`)
        .set('Authorization', bearerHeader(accessToken))
        .send({ title: 'Page A', order: 1 });

      const res = await t.agent
        .get(`/projects/${projectId}/pages`)
        .set('Authorization', bearerHeader(accessToken))
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Page A');
      expect(res.body[1].title).toBe('Page B');
    });

    it('gets single page by id', async () => {
      const { accessToken } = await registerUser(t.agent);
      const projectId = await createProject(accessToken);

      const { body: page } = await t.agent
        .post(`/projects/${projectId}/pages`)
        .set('Authorization', bearerHeader(accessToken))
        .send({ title: 'Detail Page' });

      const res = await t.agent
        .get(`/projects/${projectId}/pages/${page.id}`)
        .set('Authorization', bearerHeader(accessToken))
        .expect(200);

      expect(res.body.id).toBe(page.id);
    });

    it('updates page content field → 200', async () => {
      const { accessToken } = await registerUser(t.agent);
      const projectId = await createProject(accessToken);

      const { body: page } = await t.agent
        .post(`/projects/${projectId}/pages`)
        .set('Authorization', bearerHeader(accessToken))
        .send({ title: 'Editable Page' });

      const updatedContent = { blocks: [{ type: 'text', value: 'Hello World' }] };
      const res = await t.agent
        .patch(`/projects/${projectId}/pages/${page.id}`)
        .set('Authorization', bearerHeader(accessToken))
        .send({ content: updatedContent })
        .expect(200);

      expect(res.body.content).toEqual(updatedContent);
    });

    it('deletes page → 204, then 404 on re-fetch', async () => {
      const { accessToken } = await registerUser(t.agent);
      const projectId = await createProject(accessToken);

      const { body: page } = await t.agent
        .post(`/projects/${projectId}/pages`)
        .set('Authorization', bearerHeader(accessToken))
        .send({ title: 'Delete Me' });

      await t.agent
        .delete(`/projects/${projectId}/pages/${page.id}`)
        .set('Authorization', bearerHeader(accessToken))
        .expect(204);

      await t.agent
        .get(`/projects/${projectId}/pages/${page.id}`)
        .set('Authorization', bearerHeader(accessToken))
        .expect(404);
    });
  });

  // ── Project isolation ──────────────────────────────────────────────────────

  describe('Project isolation', () => {
    it('user B cannot create page in user A\'s project → 403', async () => {
      const userA = await registerUser(t.agent);
      const userB = await registerUser(t.agent);
      const projectId = await createProject(userA.accessToken, 'Private Project');

      await t.agent
        .post(`/projects/${projectId}/pages`)
        .set('Authorization', bearerHeader(userB.accessToken))
        .send({ title: 'Intruder Page' })
        .expect(403);
    });

    it('user B cannot list pages in user A\'s project → 403', async () => {
      const userA = await registerUser(t.agent);
      const userB = await registerUser(t.agent);
      const projectId = await createProject(userA.accessToken);

      await t.agent
        .get(`/projects/${projectId}/pages`)
        .set('Authorization', bearerHeader(userB.accessToken))
        .expect(403);
    });

    it('user B cannot read a page in user A\'s project → 403', async () => {
      const userA = await registerUser(t.agent);
      const userB = await registerUser(t.agent);
      const projectId = await createProject(userA.accessToken);

      const { body: page } = await t.agent
        .post(`/projects/${projectId}/pages`)
        .set('Authorization', bearerHeader(userA.accessToken))
        .send({ title: 'Secret Page' });

      await t.agent
        .get(`/projects/${projectId}/pages/${page.id}`)
        .set('Authorization', bearerHeader(userB.accessToken))
        .expect(403);
    });

    it('deleting project cascades to its pages (no orphans)', async () => {
      const { accessToken } = await registerUser(t.agent);
      const projectId = await createProject(accessToken);

      await t.agent
        .post(`/projects/${projectId}/pages`)
        .set('Authorization', bearerHeader(accessToken))
        .send({ title: 'Orphan Candidate' });

      // Delete project
      await t.agent
        .delete(`/projects/${projectId}`)
        .set('Authorization', bearerHeader(accessToken))
        .expect(204);

      // Directly check DB — no pages should remain for this project
      const count = await t.dataSource.query(
        `SELECT COUNT(*) FROM pages WHERE "projectId" = $1`,
        [projectId],
      );
      expect(parseInt(count[0].count)).toBe(0);
    });
  });

  // ── Auth guard ─────────────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('returns 401 on page routes without token', async () => {
      await t.agent.get('/projects/some-id/pages').expect(401);
      await t.agent.post('/projects/some-id/pages').send({ title: 'X' }).expect(401);
    });
  });
});
