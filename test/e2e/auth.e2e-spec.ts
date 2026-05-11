import { createTestApp, resetDb, TestApp } from '../helpers/app.helper';
import { uniqueEmail, registerUser, loginUser, bearerHeader } from '../helpers/auth.helper';

describe('Auth (E2E)', () => {
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

  // ── Register ───────────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('registers a new user → 201 with accessToken and user (no password)', async () => {
      const email = uniqueEmail('reg');
      const res = await t.agent
        .post('/auth/register')
        .send({ email, password: 'ValidPass1!' })
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.id).toBeDefined();
      expect(res.body.user.email).toBe(email);
      expect(res.body.user.role).toBe('user');
      expect(res.body.user.password).toBeUndefined();
    });

    it('sets httpOnly refresh_token cookie on register', async () => {
      const res = await t.agent
        .post('/auth/register')
        .send({ email: uniqueEmail(), password: 'ValidPass1!' })
        .expect(201);

      const cookies: string[] = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
      const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('Path=/auth');
    });

    it('rejects duplicate email → 409', async () => {
      const email = uniqueEmail('dup');
      await t.agent.post('/auth/register').send({ email, password: 'ValidPass1!' }).expect(201);

      const res = await t.agent
        .post('/auth/register')
        .send({ email, password: 'DifferentPass1!' })
        .expect(409);

      expect(res.body.statusCode).toBe(409);
    });

    it('rejects short password (< 8 chars) → 400', async () => {
      await t.agent
        .post('/auth/register')
        .send({ email: uniqueEmail(), password: 'short' })
        .expect(400);
    });

    it('rejects password > 72 chars → 400 (bcrypt bomb guard)', async () => {
      await t.agent
        .post('/auth/register')
        .send({ email: uniqueEmail(), password: 'a'.repeat(73) })
        .expect(400);
    });

    it('rejects invalid email format → 400', async () => {
      await t.agent
        .post('/auth/register')
        .send({ email: 'not-an-email', password: 'ValidPass1!' })
        .expect(400);
    });

    it('rejects extra unknown fields (whitelist validation) → 400', async () => {
      await t.agent
        .post('/auth/register')
        .send({ email: uniqueEmail(), password: 'ValidPass1!', adminOverride: true })
        .expect(400);
    });
  });

  // ── Login ──────────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('logs in with correct credentials → 200 with accessToken', async () => {
      const email = uniqueEmail('login');
      const password = 'LoginPass1!';
      await t.agent.post('/auth/register').send({ email, password }).expect(201);

      const res = await t.agent
        .post('/auth/login')
        .send({ email, password })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user.email).toBe(email);
      expect(res.body.user.password).toBeUndefined();
    });

    it('sets httpOnly refresh_token cookie on login', async () => {
      const email = uniqueEmail();
      const password = 'LoginPass1!';
      await t.agent.post('/auth/register').send({ email, password });

      const res = await t.agent.post('/auth/login').send({ email, password }).expect(200);
      const cookies: string[] = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
      expect(cookies.find((c: string) => c.startsWith('refresh_token='))).toBeDefined();
    });

    it('rejects wrong password → 401', async () => {
      const email = uniqueEmail();
      await t.agent.post('/auth/register').send({ email, password: 'CorrectPass1!' });

      const res = await t.agent
        .post('/auth/login')
        .send({ email, password: 'WrongPass1!' })
        .expect(401);

      expect(res.body.statusCode).toBe(401);
    });

    it('rejects unknown email → 401', async () => {
      await t.agent
        .post('/auth/login')
        .send({ email: 'nobody@test.example', password: 'ValidPass1!' })
        .expect(401);
    });

    it('returns same error message for wrong password and unknown email (no user enumeration)', async () => {
      const email = uniqueEmail();
      await t.agent.post('/auth/register').send({ email, password: 'CorrectPass1!' });

      const wrongPwd = await t.agent
        .post('/auth/login')
        .send({ email, password: 'WrongPass1!' });
      const unknownUser = await t.agent
        .post('/auth/login')
        .send({ email: 'ghost@test.example', password: 'ValidPass1!' });

      expect(wrongPwd.body.message).toEqual(unknownUser.body.message);
    });
  });

  // ── GET /auth/me ───────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('returns current user with valid token', async () => {
      const { accessToken, email } = await registerUser(t.agent);

      const res = await t.agent
        .get('/auth/me')
        .set('Authorization', bearerHeader(accessToken))
        .expect(200);

      expect(res.body.email).toBe(email);
      expect(res.body.password).toBeUndefined();
      expect(res.body.id).toBeDefined();
    });

    it('returns 401 with no token', async () => {
      await t.agent.get('/auth/me').expect(401);
    });

    it('returns 401 with malformed token', async () => {
      await t.agent
        .get('/auth/me')
        .set('Authorization', 'Bearer not.a.real.token')
        .expect(401);
    });

    it('returns 401 with expired-looking token', async () => {
      const fakeExpired =
        'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZW1haWwiOiJ4QHkuY29tIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDAwMDAwMX0.fake';
      await t.agent
        .get('/auth/me')
        .set('Authorization', `Bearer ${fakeExpired}`)
        .expect(401);
    });
  });

  // ── Refresh ────────────────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('issues a new accessToken when refresh cookie is valid', async () => {
      const { refreshCookie } = await registerUser(t.agent);

      const res = await t.agent
        .post('/auth/refresh')
        .set('Cookie', refreshCookie)
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
    });

    it('rotates the refresh token cookie on each refresh', async () => {
      const { refreshCookie: first } = await registerUser(t.agent);

      const res = await t.agent
        .post('/auth/refresh')
        .set('Cookie', first)
        .expect(200);

      const cookies: string[] = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
      const second = cookies.find((c: string) => c.startsWith('refresh_token='));
      expect(second).toBeDefined();
    });

    it('returns 401 with no refresh cookie', async () => {
      // Use raw request (no cookie jar) to ensure no refresh token is sent
      await t.rawRequest.post('/auth/refresh').expect(401);
    });

    it('returns 401 with tampered refresh cookie', async () => {
      // Use raw request (no cookie jar) to prevent the valid cookie bleeding in
      await t.rawRequest
        .post('/auth/refresh')
        .set('Cookie', 'refresh_token=tampered.token.here')
        .expect(401);
    });
  });

  // ── Logout ─────────────────────────────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('clears refresh token cookie and returns message', async () => {
      const { accessToken } = await registerUser(t.agent);

      const res = await t.agent
        .post('/auth/logout')
        .set('Authorization', bearerHeader(accessToken))
        .expect(200);

      expect(res.body.message).toContain('Logged out');
      const cookies: string[] = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
      const clearedCookie = cookies.find((c: string) => c.startsWith('refresh_token='));
      expect(clearedCookie).toBeDefined();
      // Cleared cookie has maxAge=0 or expires in the past
      expect(clearedCookie).toMatch(/Max-Age=0|expires=Thu, 01 Jan 1970/i);
    });

    it('returns 401 without access token', async () => {
      await t.agent.post('/auth/logout').expect(401);
    });
  });

  // ── PATCH /auth/me ─────────────────────────────────────────────────────────

  describe('PATCH /auth/me', () => {
    it('updates user name', async () => {
      const { accessToken } = await registerUser(t.agent);

      const res = await t.agent
        .patch('/auth/me')
        .set('Authorization', bearerHeader(accessToken))
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(res.body.name).toBe('Updated Name');
    });

    it('rejects email update to already-taken address → 409', async () => {
      const taken = await registerUser(t.agent);
      const { accessToken } = await registerUser(t.agent);

      await t.agent
        .patch('/auth/me')
        .set('Authorization', bearerHeader(accessToken))
        .send({ email: taken.email })
        .expect(409);
    });
  });

  // ── PATCH /auth/me/password ────────────────────────────────────────────────

  describe('PATCH /auth/me/password', () => {
    it('changes password and allows login with new password', async () => {
      const email = uniqueEmail('pwd');
      const oldPass = 'OldPass123!';
      const newPass = 'NewPass456!';

      const { accessToken } = await registerUser(t.agent, { email, password: oldPass });

      await t.agent
        .patch('/auth/me/password')
        .set('Authorization', bearerHeader(accessToken))
        .send({ currentPassword: oldPass, newPassword: newPass })
        .expect(200);

      // Old password rejected
      await t.agent.post('/auth/login').send({ email, password: oldPass }).expect(401);
      // New password works
      await t.agent.post('/auth/login').send({ email, password: newPass }).expect(200);
    });

    it('rejects wrong currentPassword → 400', async () => {
      const { accessToken } = await registerUser(t.agent);

      await t.agent
        .patch('/auth/me/password')
        .set('Authorization', bearerHeader(accessToken))
        .send({ currentPassword: 'WrongOldPass!', newPassword: 'NewPass456!' })
        .expect(400);
    });
  });
});
