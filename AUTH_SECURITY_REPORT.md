# SitePilot Backend — Auth Security Report

> **Generated:** 2026-05-10  
> **Phase:** Security + Auth Hardening  
> **Branch:** `claude/audit-backend-database-R4noy`

---

## 1. Auth Architecture (After Hardening)

```
Client
  ├── POST /auth/register
  │     body: { email, password, name }
  │     response: { accessToken, user }          ← accessToken in body
  │     cookie: refresh_token (httpOnly, /auth)  ← refreshToken in cookie only
  │
  ├── POST /auth/login
  │     body: { email, password }
  │     response: { accessToken, user }
  │     cookie: refresh_token (httpOnly, /auth)
  │
  ├── POST /auth/refresh           (reads cookie via JwtRefreshGuard)
  │     response: { accessToken }   ← new access token
  │     cookie: refresh_token        ← rotated (new refresh token)
  │
  ├── POST /auth/logout             (requires valid Bearer access token)
  │     cookie: refresh_token=''    ← cleared
  │
  └── Protected routes: Bearer <accessToken>
```

---

## 2. Token Architecture

| Token | Type | TTL | Transport | Secret | Storage (client) |
|---|---|---|---|---|---|
| Access token | JWT HS256 | 15 min | `Authorization: Bearer` header | `JWT_SECRET` | Memory / localStorage |
| Refresh token | JWT HS256 | 7 days | httpOnly cookie, `path=/auth` | `JWT_REFRESH_SECRET` | httpOnly cookie (browser) |

### Why separate secrets?

Using different secrets for access and refresh tokens ensures that:
1. A compromised access token cannot be used to forge refresh tokens
2. Rotating or revoking `JWT_REFRESH_SECRET` invalidates all refresh tokens without affecting the access token signing key
3. Secret rotation can be done independently per token type

### Why 15 minute access tokens?

| Lifetime | Risk |
|---|---|
| 7 days (old) | Stolen token valid for a week; no way to revoke |
| 15 minutes (new) | Stolen token expires quickly; refresh token in httpOnly cookie is XSS-proof |

---

## 3. Refresh Token Rotation

Every call to `POST /auth/refresh` issues a **new pair** of tokens:
- A new access token (15 min)
- A new refresh token (7 days) replacing the old cookie

This means:
- Old refresh tokens become invalid as soon as they are used
- If a refresh token is stolen and used by an attacker first, the legitimate user's next refresh attempt will fail (the cookie they hold is now invalid)
- This is "refresh token rotation" — industry standard for stateless token security

### Limitation

Because there is no server-side token blocklist (no Redis or DB table), a stolen
refresh token that has NOT yet been used remains valid until expiry. This is an
acceptable tradeoff for a stateless architecture.

**Mitigation:** Short access token TTL (15 min) limits the blast radius. The refresh
token is in an httpOnly cookie which is immune to XSS attacks.

---

## 4. httpOnly Cookie Security

```typescript
{
  httpOnly: true,           // ✅ JavaScript cannot read this cookie
  secure: isProduction,     // ✅ HTTPS-only in production
  sameSite: 'strict',       // ✅ No cross-site sending in production
  path: '/auth',            // ✅ Only sent with /auth/* requests
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
}
```

| Flag | Protects Against |
|---|---|
| `httpOnly` | XSS — attacker's JS cannot steal the token |
| `secure` | Network sniffing — only sent over HTTPS |
| `sameSite: strict` | CSRF — not sent on cross-origin requests |
| `path: /auth` | Scope leak — not sent on non-auth API calls |

---

## 5. Rate Limiting on Auth Endpoints

| Endpoint | Rate Limit | Scope |
|---|---|---|
| `POST /auth/login` | **10 req / 60s** per IP | Brute-force mitigation |
| `POST /auth/register` | **10 req / 60s** per IP | Registration spam mitigation |
| `POST /auth/refresh` | 100 req / 60s (global) | Normal refresh frequency |
| `POST /auth/logout` | 100 req / 60s (global) | Standard |
| `GET /health` | **Unlimited** (`@SkipThrottle`) | Always reachable by Railway healthcheck |
| All other routes | 100 req / 60s (global) | Configurable via ENV |

**Trust proxy** is configured (`trust proxy: 1`) so rate limiting uses the real
client IP from `X-Forwarded-For` header (set by Railway's proxy).

---

## 6. bcrypt Analysis

| Parameter | Value | Status |
|---|---|---|
| Cost factor | 10 | ✅ Adequate (0.1s on modern hardware) |
| Max input length | 72 bytes (enforced by @MaxLength) | ✅ FIXED — bcrypt bomb prevented |
| Salt rounds | Auto-generated per hash | ✅ |

For new production deployments, consider cost factor 12 (~0.3s). Each increment
doubles compute time for both legitimate logins and brute-force attacks.

**Password policy:**
- Min length: 8 chars (consider 12 for new deployments)
- Max length: 72 chars (@MaxLength enforced in DTO)
- No complexity rules (symbols/numbers not enforced) — acceptable for MVP

---

## 7. JWT Strategy Analysis

### Access token strategy (`jwt.strategy.ts`)
```typescript
ExtractJwt.fromAuthHeaderAsBearerToken()  // ✅ standard Bearer
ignoreExpiration: false                    // ✅ expired tokens rejected
secretOrKey: JWT_SECRET                   // ✅ validated at startup
```

### Refresh token strategy (`jwt-refresh.strategy.ts`)
```typescript
ExtractJwt.fromExtractors([
  (req) => req?.cookies?.refresh_token     // ✅ reads from httpOnly cookie
])
ignoreExpiration: false                    // ✅ expired refresh tokens rejected
secretOrKey: JWT_REFRESH_SECRET            // ✅ separate from access token secret
```

---

## 8. Guard Coverage Map

| Route | Guard | Auth Required |
|---|---|---|
| `POST /auth/register` | None (public) + @Throttle | Registration open |
| `POST /auth/login` | None (public) + @Throttle | Login open |
| `POST /auth/refresh` | `JwtRefreshGuard` | Refresh cookie required |
| `POST /auth/logout` | `JwtAuthGuard` | Access token required |
| `GET /auth/me` | `JwtAuthGuard` | ✅ |
| `PATCH /auth/me` | `JwtAuthGuard` | ✅ |
| `PATCH /auth/me/password` | `JwtAuthGuard` | ✅ |
| `GET /projects` | `JwtAuthGuard` | ✅ |
| `GET /users` | `JwtAuthGuard` + `assertAdmin()` | Admin only |
| `GET /health` | None + @SkipThrottle | Public |

---

## 9. Remaining Security Gaps

| Gap | Severity | Mitigation |
|---|---|---|
| No server-side token revocation | 🟡 Medium | Stateless tradeoff; rotation reduces risk |
| No account lockout after N failed logins | 🟡 Medium | Rate limiting reduces brute-force risk |
| No email verification on register | 🟢 Low | Users can register with any email |
| Password min 8 chars (weak for prod) | 🟢 Low | Increase MinLength to 12 before launch |
| No MFA (2FA) | 🟢 Low | Future work |
| Admin check via `assertAdmin()` pattern | 🟢 Low | Replace with decorator-based `@Roles` guard |

---

## 10. Recommended Next Steps

1. **Increase minimum password length** to 12 in `register.dto.ts` and `change-password.dto.ts`
2. **Add `@Roles` guard** — replace `assertAdmin()` pattern with a proper RBAC decorator
3. **Add Redis-backed token blocklist** for logout revocation (optional, only if compliance requires it)
4. **Add email verification** step after registration
5. **Enable PKCE flow** if adding OAuth providers in future
