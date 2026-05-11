# SitePilot Backend — Security Audit Report

> **Generated:** 2026-05-10  
> **Branch:** `claude/audit-backend-database-R4noy`  
> **Auditor:** Claude (automated static analysis)  
> **Standard:** OWASP Top 10 (2021)

---

## 1. Security Score

| Category | Score | Status |
|---|---|---|
| Authentication | 7 / 10 | ⚠️ No refresh tokens, no token revocation |
| Authorization | 8 / 10 | ✅ Ownership checks on all resources |
| Input Validation | 8 / 10 | ✅ ValidationPipe + DTO; ⚠️ MaxLength added in this audit |
| Data Exposure | 9 / 10 | ✅ @Exclude on password; ✅ exception filter hides internals |
| Security Headers | 2 / 10 | ❌ Helmet not installed |
| Rate Limiting | 0 / 10 | ❌ No throttling on any endpoint |
| CORS | 6 / 10 | ✅ Locked in prod; ⚠️ CORS_ORIGIN=* blocked by ENV validation |
| SQL Injection | 9 / 10 | ✅ TypeORM parameterised queries throughout |
| Secrets Management | 7 / 10 | ✅ Env vars; ⚠️ JWT_SECRET min-length now enforced |
| **Overall** | **63 / 100** | ⚠️ Acceptable for early stage; not production-hardened yet |

---

## 2. OWASP Top 10 Mapping

### A01 — Broken Access Control

| Finding | Severity | Status |
|---|---|---|
| All resource endpoints require JWT | ✅ | OK |
| Ownership verified per-request (userId match) | ✅ | OK |
| Admin check via `assertAdmin()` (runtime, not decorator) | ⚠️ | Acceptable but fragile — decorator-based guard preferred |
| No RBAC system for fine-grained permissions | ℹ️ | Future work |
| `GET /users` and `GET /users/:id` are admin-only | ✅ | OK (throws ForbiddenException) |

**`assertAdmin()` risk:** The private method pattern in UsersController is safe (throws on
non-admin), but if a developer adds a new endpoint and forgets to call `assertAdmin()`,
there's no safety net. A decorator-based `@Roles('admin')` guard enforced at the framework
level is safer.

### A02 — Cryptographic Failures

| Finding | Severity | Status |
|---|---|---|
| Passwords hashed with bcrypt (cost 10) | ✅ | OK |
| bcrypt cost factor 10 | ⚠️ | Adequate now; consider 12 for new production deployments |
| bcrypt bomb (>72 byte passwords) | 🔴 **FIXED** | `@MaxLength(72)` added to all password DTOs |
| JWT uses HS256 (symmetric) | ✅ | Acceptable for single-service setup |
| JWT secret minimum length enforced | ✅ **FIXED** | min 32 chars enforced in ENV validation |
| No token encryption (payload visible if decoded) | ℹ️ | Payload contains only sub/email/role — no sensitive data |
| SSL enforced in production (Railway) | ✅ | `rejectUnauthorized: false` (Railway self-signed CA) |

#### bcrypt Bomb Detail

bcrypt silently truncates input at 72 bytes. Without `@MaxLength(72)`, an attacker
could send a 100KB password string — bcrypt would still process only the first 72 bytes
but the server wastes CPU hashing a massive payload:

```
attacker → POST /auth/login { password: "A" * 100_000 }
server   → bcrypt.compare(100KB_string, hash) — CPU spike, DoS potential
```

**Fix applied:** `@MaxLength(72)` on `password` in `LoginDto`, `RegisterDto`,
and both fields in `ChangePasswordDto`.

### A03 — Injection

| Finding | Severity | Status |
|---|---|---|
| All DB queries use TypeORM Repository API | ✅ | Parameterised |
| `findByIdWithPassword` uses QueryBuilder with `:id` param | ✅ | Parameterised |
| No raw SQL strings with user input | ✅ | Verified across all services |
| `slugify()` utility — output used as DB value, not in SQL | ✅ | Safe |
| No file upload endpoints | ✅ | No file injection surface |

**SQL injection risk: NONE FOUND.** TypeORM's Repository API and QueryBuilder both
use parameterised statements exclusively.

### A04 — Insecure Design

| Finding | Severity | Status |
|---|---|---|
| No refresh token implementation | 🔴 | Access tokens expire in 7d — long-lived |
| No token revocation / blocklist | 🔴 | Compromised token valid until expiry |
| No account lockout on failed logins | 🔴 | Brute force possible without rate limiting |
| Login timing consistent (constant-time bcrypt) | ✅ | OK |
| Register returns token immediately | ⚠️ | No email verification step |

### A05 — Security Misconfiguration

| Finding | Severity | Status |
|---|---|---|
| Swagger exposed only in development | ✅ | Gated by `NODE_ENV !== 'production'` |
| `synchronize: true` in development | ⚠️ | Intentional; startup diagnostics warn |
| `synchronize: false` in production | ✅ | Enforced |
| Hardcoded DB credentials in dev defaults | ⚠️ | Dev only (`sitepilot/sitepilot`); acceptable |
| CORS `*` blocked in production by ENV validation | ✅ **FIXED** | Throws on startup if `CORS_ORIGIN=*` in production |
| Missing HTTP security headers (Helmet) | 🔴 | No CSP, HSTS, X-Frame-Options |
| Error internals hidden in production | ✅ **FIXED** | AllExceptionsFilter masks 5xx messages |

### A06 — Vulnerable Components

| Package | Version | Notes |
|---|---|---|
| `@nestjs/core` | ^10.3.0 | Stable LTS stream |
| `typeorm` | ^0.3.20 | Current |
| `bcrypt` | ^5.1.1 | Current |
| `passport-jwt` | ^4.0.1 | Current |
| `pg` | ^8.11.3 | Current |

**Recommendation:** Run `npm audit` before each production deploy. Add `npm audit --audit-level=high`
to CI pipeline.

### A07 — Identification and Authentication Failures

| Finding | Severity | Status |
|---|---|---|
| JWT `ignoreExpiration: false` | ✅ | Tokens expire |
| JWT secret validated at startup | ✅ | |
| No brute-force protection on `POST /auth/login` | 🔴 | Rate limiting needed |
| Password min 8 chars | ⚠️ | Consider 12+ for production |
| No password complexity rules (numbers, symbols) | ⚠️ | MinLength only |
| No account lockout | 🔴 | |
| JWT token lifetime 7d | ⚠️ | Long for access token; consider 15min + refresh token |

### A08 — Software and Data Integrity Failures

| Finding | Severity | Status |
|---|---|---|
| `npm ci` in Dockerfile (lockfile honoured) | ✅ | Reproducible |
| No `npm audit` in CI | ⚠️ | Add to GitHub Actions |
| Migrations run in transaction per migration | ✅ | Atomic |
| No supply chain (SBOM) tooling | ℹ️ | Future work |

### A09 — Security Logging and Monitoring Failures

| Finding | Severity | Status |
|---|---|---|
| 5xx errors logged with stack trace | ✅ **FIXED** | AllExceptionsFilter |
| No audit log for sensitive operations | ⚠️ | Login/logout/password change not logged |
| No request ID correlation | ⚠️ | Hard to trace a specific request across logs |
| No alerting on repeated failures | ❌ | Future work |

### A10 — Server-Side Request Forgery (SSRF)

| Finding | Severity | Status |
|---|---|---|
| No HTTP client (axios/fetch) calls to user-supplied URLs | ✅ | No SSRF surface found |
| PublishService uses only internal DB values | ✅ | |

---

## 3. JWT Security Analysis

```
Algorithm : HS256 (HMAC-SHA256 — symmetric)
Key source : JWT_SECRET env var
Min length : 32 chars (enforced by env.validation.ts)
Expiry     : JWT_EXPIRES_IN (default 7d)
Storage    : Client-side (Bearer header) — not httpOnly cookie
Revocation : None — tokens valid until expiry
Refresh    : Not implemented
```

### Risks

| Risk | Impact | Mitigation |
|---|---|---|
| 7-day access token | If stolen, valid for a week | Implement refresh tokens with short-lived access tokens (15 min) |
| No revocation | Logout doesn't invalidate token | Implement token blocklist (Redis) or short expiry |
| HS256 symmetric key | Single leaked secret compromises all tokens | For multi-service: consider RS256 with public key distribution |
| Bearer header storage | XSS can steal tokens | For browser clients: httpOnly cookie is safer |

---

## 4. DTO Validation Analysis

| DTO | Fields | Validators Applied | Gaps Fixed |
|---|---|---|---|
| `RegisterDto` | email, password, name | `@IsEmail`, `@IsString`, `@MinLength(8)` | `@MaxLength(72)` on password ✅ |
| `LoginDto` | email, password | `@IsEmail`, `@IsString` | `@MaxLength(72)` on password ✅ |
| `ChangePasswordDto` | currentPassword, newPassword | `@IsString`, `@MinLength(8)` | `@MaxLength(72)` on both ✅ |
| `UpdateProfileDto` | email, name | `@IsEmail`, `@IsString` | No MaxLength — low risk |

**`ValidationPipe` configuration (global):**
```typescript
{
  whitelist: true,            // strips unknown fields — prevents mass assignment
  transform: true,            // coerces types
  forbidNonWhitelisted: true, // 400 on unknown fields (defence in depth)
}
```

No DTO validation gaps found beyond password MaxLength (now fixed).

---

## 5. Data Exposure Analysis

| Endpoint | Returns password? | Notes |
|---|---|---|
| `POST /auth/register` | ❌ No | `sanitize()` strips it + `@Exclude` |
| `POST /auth/login` | ❌ No | Same |
| `GET /auth/me` | ❌ No | `findById` — no `addSelect('user.password')` |
| `GET /users/me` | ❌ No | |
| `GET /users/:id` (admin) | ❌ No | `@Exclude` + ClassSerializerInterceptor |

`findById` uses standard `findOne` which does NOT select password (it uses `@Select(false)` implicitly
via the `@Exclude` pattern + ClassSerializerInterceptor). The only method that explicitly loads
the password is `findByIdWithPassword` — used only in `changePassword` flow.

---

## 6. CORS Analysis

| Environment | Configuration | Safe? |
|---|---|---|
| Development | `CORS_ORIGIN=*` → `origin: true` | ✅ Acceptable for local dev |
| Production | Must set `CORS_ORIGIN=https://your-domain.com` | ✅ ENV validation blocks `*` in prod |

**Fix applied:** `validateEnv()` throws if `NODE_ENV=production` and `CORS_ORIGIN` is `*` or missing.

---

## 7. Critical Risks Summary

| Risk | Severity | Action Required |
|---|---|---|
| No rate limiting on login endpoint | 🔴 Critical | Install `@nestjs/throttler` — brute force possible |
| No Helmet HTTP headers | 🔴 Critical | Install `helmet` — clickjacking, MIME sniffing exposed |
| 7-day JWT with no revocation | 🔴 High | Implement refresh tokens with short access token TTL |
| No account lockout | 🔴 High | Combine with rate limiting |
| bcrypt bomb (password MaxLength) | ✅ **FIXED** | `@MaxLength(72)` added to all password DTOs |
| Error internals in production | ✅ **FIXED** | AllExceptionsFilter masks 5xx messages |
| CORS=* in production | ✅ **FIXED** | ENV validation blocks it at startup |
| JWT_SECRET weak length | ✅ **FIXED** | Min 32 chars enforced |

---

## 8. Immediate Action Plan

### Step 1 — Install Helmet (1 hour)
```bash
npm install helmet
```
```typescript
// src/main.ts — add before enableCors()
import helmet from 'helmet';
app.use(helmet());
```

### Step 2 — Install Rate Limiting (2 hours)
```bash
npm install @nestjs/throttler
```
```typescript
// src/app.module.ts
ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

// src/auth/auth.controller.ts — stricter on login/register
@Throttle({ default: { ttl: 60_000, limit: 10 } })
@Post('login')
login(...) {}
```

### Step 3 — Shorten JWT TTL + Refresh Tokens (1 day)
```env
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### Step 4 — Add npm audit to CI
```yaml
# .github/workflows/ci.yml
- run: npm audit --audit-level=high
```
