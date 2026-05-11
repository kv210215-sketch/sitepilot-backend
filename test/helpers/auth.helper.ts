/**
 * Auth helpers for E2E tests.
 * Provide quick register + login shortcuts that return tokens.
 */
import request from 'supertest';

export interface TestCredentials {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResult {
  accessToken: string;
  refreshCookie: string;
  userId: string;
  email: string;
  role: string;
}

let counter = 0;

/** Generate a unique test email to avoid conflicts across parallel tests. */
export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}-${Date.now()}-${++counter}@test.example`;
}

/** Register a new user and return tokens. */
export async function registerUser(
  agent: // eslint-disable-next-line @typescript-eslint/no-explicit-any
any,
  creds?: Partial<TestCredentials>,
): Promise<AuthResult> {
  const email = creds?.email ?? uniqueEmail();
  const password = creds?.password ?? 'TestPass123!';
  const name = creds?.name ?? 'Test User';

  const res = await agent
    .post('/auth/register')
    .send({ email, password, name })
    .expect(201);

  const refreshCookie: string =
    res.headers['set-cookie']?.find((c: string) => c.startsWith('refresh_token')) ?? '';

  return {
    accessToken: res.body.accessToken,
    refreshCookie,
    userId: res.body.user.id,
    email: res.body.user.email,
    role: res.body.user.role,
  };
}

/** Login an existing user and return tokens. */
export async function loginUser(
  agent: // eslint-disable-next-line @typescript-eslint/no-explicit-any
any,
  creds: TestCredentials,
): Promise<AuthResult> {
  const res = await agent
    .post('/auth/login')
    .send({ email: creds.email, password: creds.password })
    .expect(200);

  const refreshCookie: string =
    res.headers['set-cookie']?.find((c: string) => c.startsWith('refresh_token')) ?? '';

  return {
    accessToken: res.body.accessToken,
    refreshCookie,
    userId: res.body.user.id,
    email: res.body.user.email,
    role: res.body.user.role,
  };
}

/** Return Authorization header value for a given access token. */
export function bearerHeader(token: string): string {
  return `Bearer ${token}`;
}
