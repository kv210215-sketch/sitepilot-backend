# E2E Test Plan

## Summary

67 E2E tests across 5 suites, all run against a real PostgreSQL database (`sitepilot_test`).
No mocked HTTP clients, no in-memory DB, no faked guards (except ThrottlerStorage — see
TEST_HARNESS_ARCHITECTURE.md).

**Run**: `TEST_DATABASE_URL=postgresql://sitepilot:sitepilot@localhost:5432/sitepilot_test npm run test:e2e`

---

## Suite 1: Health (`health.e2e-spec.ts`) — 5 tests

| Test | Assertion |
|------|-----------|
| GET /health → 200 | `status`, `database`, `uptime` fields present |
| Response contains X-Request-Id | UUID v4 in header |
| Client X-Request-Id echoed | Header pass-through works |
| Unique IDs per request | 5 consecutive calls, all distinct |
| GET /nonexistent → 404 shape | `statusCode`, `message`, `path`, `requestId` present |

---

## Suite 2: Auth (`auth.e2e-spec.ts`) — 26 tests

### POST /auth/register (7 tests)
- 201 with `accessToken`, `user.id`, `user.email`, `user.role`; no `password` in body
- httpOnly `refresh_token` cookie with `Path=/auth`
- Duplicate email → 409
- Password < 8 chars → 400
- Password > 72 chars → 400 (bcrypt bomb guard)
- Invalid email format → 400
- Extra unknown fields (`adminOverride`) → 400 (whitelist)

### POST /auth/login (5 tests)
- 200 with `accessToken` + `user`
- httpOnly `refresh_token` cookie on login
- Wrong password → 401
- Unknown email → 401
- User enumeration check: wrong password and unknown email return identical `message` (prevents oracle attack)

### GET /auth/me (4 tests)
- 200 with `email`, `id`; no `password` in body
- No token → 401
- Malformed token → 401
- Fake expired token → 401

### POST /auth/refresh (4 tests)
- Issues new `accessToken` when refresh cookie is valid
- Rotates refresh token cookie on each call
- No cookie → 401 (uses `t.rawRequest` to avoid cookie-jar bleed)
- Tampered cookie → 401 (uses `t.rawRequest`)

### POST /auth/logout (2 tests)
- Clears `refresh_token` cookie (`Max-Age=0` or `expires=...1970`)
- No access token → 401

### PATCH /auth/me (2 tests)
- Updates `name` field → 200 with new name
- Email already taken → 409

### PATCH /auth/me/password (2 tests)
- Changes password; old password rejected (401), new password accepted (200)
- Wrong `currentPassword` → 400

---

## Suite 3: Projects (`projects.e2e-spec.ts`) — 12 tests

### CRUD lifecycle (5 tests)
- Create → 201 with `id`, `slug` auto-generated from name, `userId`
- List → only own projects returned (ownership isolation)
- Get by id → 200
- Update name → 200 with updated name
- Delete → 204, then GET → 404

### Ownership isolation (4 tests)
- User B GET user A's project → 403
- User B UPDATE user A's project → 403
- User B DELETE user A's project → 403
- Non-existent ID → 404 (not 403 — no info leak about existence)

### Auth guard (1 test)
- All project routes without token → 401

### Input validation (2 tests)
- Create with missing `name` → 400
- Create with explicit `slug` → accepted

---

## Suite 4: Pages (`pages.e2e-spec.ts`) — 10 tests

### CRUD lifecycle (5 tests)
- Create → 201 with `id`, `slug` derived from title, `projectId`, `isPublished: false`
- List → ordered by `order ASC`
- Get by id → 200
- Update `content` (JSONB) → 200 with new content
- Delete → 204, then GET → 404

### Project isolation (4 tests)
- User B create page in user A's project → 403
- User B list pages in user A's project → 403
- User B get page in user A's project → 403
- Delete project cascades to its pages (direct DB query: `COUNT(*) = 0`)

### Auth guard (1 test)
- GET/POST on page routes without token → 401

---

## Suite 5: Request Lifecycle (`request-lifecycle.e2e-spec.ts`) — 14 tests

### X-Request-Id propagation (4 tests)
- UUID v4 generated when no header provided
- Client-supplied ID echoed back unchanged
- `requestId` included in error response body
- 5 consecutive requests → 5 unique IDs

### Error response shape (5 tests)
- 404: `statusCode`, `timestamp` (ISO 8601), `path`, `message`, `requestId`
- 401: correct `statusCode`
- 400 validation error: `statusCode: 400`
- 409 conflict: `statusCode: 409`
- 403 forbidden: `statusCode: 403`

### Whitelist validation (2 tests)
- `isAdmin` / `role` fields in register body → 400
- `ownerId` in project create body → 400

### Migration bootstrap (3 tests)
- Tables `users`, `projects`, `pages`, `subscriptions`, `migrations` all exist
- `InitialSchema1776200624919` recorded in migrations table
- `uuid-ossp` extension active

---

## Known Intentional Omissions

| Area | Reason |
|------|--------|
| Publish flow | External Railway deploy; out of scope for unit E2E |
| Billing / Stripe webhooks | Requires Stripe test keys; not wired for local tests |
| Admin endpoints | Not yet implemented |
| Rate limit enforcement | Throttler storage overridden in tests; integration tested manually |
