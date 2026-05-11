import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';
import { ChangePasswordDto } from './change-password.dto';
import { UpdateProfileDto } from './update-profile.dto';

// Helper: validate a plain object through a DTO class and return constraint messages
async function getErrors<T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
): Promise<string[]> {
  const instance = plainToInstance(cls, plain);
  const errors = await validate(instance);
  return errors.flatMap((e) => Object.values(e.constraints ?? {}));
}

async function isValid<T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
): Promise<boolean> {
  return (await getErrors(cls, plain)).length === 0;
}

// ── LoginDto ────────────────────────────────────────────────────────────────

describe('LoginDto', () => {
  it('accepts a valid email and password', async () => {
    expect(await isValid(LoginDto, { email: 'user@example.com', password: 'secret123' })).toBe(true);
  });

  it('rejects a non-email string in the email field', async () => {
    expect(await isValid(LoginDto, { email: 'not-an-email', password: 'secret123' })).toBe(false);
  });

  it('rejects a password longer than 72 characters (bcrypt bomb)', async () => {
    expect(
      await isValid(LoginDto, { email: 'user@example.com', password: 'a'.repeat(73) }),
    ).toBe(false);
  });

  it('accepts a password of exactly 72 characters', async () => {
    expect(
      await isValid(LoginDto, { email: 'user@example.com', password: 'a'.repeat(72) }),
    ).toBe(true);
  });

  it('rejects an email longer than 255 characters', async () => {
    const longEmail = `${'a'.repeat(248)}@x.com`; // 254 + '@x.com' = over limit
    expect(await isValid(LoginDto, { email: longEmail, password: 'secret' })).toBe(false);
  });

  it('rejects an empty object', async () => {
    expect(await isValid(LoginDto, {})).toBe(false);
  });

  it('rejects missing password', async () => {
    expect(await isValid(LoginDto, { email: 'user@example.com' })).toBe(false);
  });

  it('rejects missing email', async () => {
    expect(await isValid(LoginDto, { password: 'secret123' })).toBe(false);
  });
});

// ── RegisterDto ─────────────────────────────────────────────────────────────

describe('RegisterDto', () => {
  const VALID = { email: 'user@example.com', password: 'Password1' };

  it('accepts valid email and password', async () => {
    expect(await isValid(RegisterDto, VALID)).toBe(true);
  });

  it('accepts optional name field', async () => {
    expect(await isValid(RegisterDto, { ...VALID, name: 'Alice' })).toBe(true);
  });

  it('passes without the name field', async () => {
    expect(await isValid(RegisterDto, VALID)).toBe(true);
  });

  it('rejects a password shorter than 8 characters', async () => {
    expect(await isValid(RegisterDto, { ...VALID, password: 'short' })).toBe(false);
  });

  it('accepts a password of exactly 8 characters', async () => {
    expect(await isValid(RegisterDto, { ...VALID, password: 'Passw0rd' })).toBe(true);
  });

  it('rejects a password longer than 72 characters (bcrypt bomb)', async () => {
    expect(await isValid(RegisterDto, { ...VALID, password: 'a'.repeat(73) })).toBe(false);
  });

  it('accepts a password of exactly 72 characters', async () => {
    expect(await isValid(RegisterDto, { ...VALID, password: 'a'.repeat(72) })).toBe(true);
  });

  it('rejects a name longer than 100 characters', async () => {
    expect(await isValid(RegisterDto, { ...VALID, name: 'a'.repeat(101) })).toBe(false);
  });

  it('accepts a name of exactly 100 characters', async () => {
    expect(await isValid(RegisterDto, { ...VALID, name: 'a'.repeat(100) })).toBe(true);
  });

  it('rejects an invalid email', async () => {
    expect(await isValid(RegisterDto, { ...VALID, email: 'bad-email' })).toBe(false);
  });
});

// ── ChangePasswordDto ────────────────────────────────────────────────────────

describe('ChangePasswordDto', () => {
  const VALID = { currentPassword: 'OldPass1!', newPassword: 'NewPass1!' };

  it('accepts valid current and new passwords', async () => {
    expect(await isValid(ChangePasswordDto, VALID)).toBe(true);
  });

  it('rejects newPassword shorter than 8 characters', async () => {
    expect(await isValid(ChangePasswordDto, { ...VALID, newPassword: 'short' })).toBe(false);
  });

  it('rejects newPassword longer than 72 characters', async () => {
    expect(
      await isValid(ChangePasswordDto, { ...VALID, newPassword: 'a'.repeat(73) }),
    ).toBe(false);
  });

  it('rejects currentPassword longer than 72 characters', async () => {
    expect(
      await isValid(ChangePasswordDto, { ...VALID, currentPassword: 'a'.repeat(73) }),
    ).toBe(false);
  });

  it('rejects an empty object', async () => {
    expect(await isValid(ChangePasswordDto, {})).toBe(false);
  });

  it('rejects missing newPassword', async () => {
    expect(await isValid(ChangePasswordDto, { currentPassword: 'OldPass1!' })).toBe(false);
  });
});

// ── UpdateProfileDto ─────────────────────────────────────────────────────────

describe('UpdateProfileDto', () => {
  it('accepts an empty object (all fields are optional)', async () => {
    expect(await isValid(UpdateProfileDto, {})).toBe(true);
  });

  it('accepts a valid name', async () => {
    expect(await isValid(UpdateProfileDto, { name: 'Alice' })).toBe(true);
  });

  it('accepts a valid email', async () => {
    expect(await isValid(UpdateProfileDto, { email: 'new@example.com' })).toBe(true);
  });

  it('accepts both name and email', async () => {
    expect(
      await isValid(UpdateProfileDto, { name: 'Alice', email: 'new@example.com' }),
    ).toBe(true);
  });

  it('rejects an invalid email format', async () => {
    expect(await isValid(UpdateProfileDto, { email: 'not-an-email' })).toBe(false);
  });

  it('rejects a name longer than 100 characters', async () => {
    expect(await isValid(UpdateProfileDto, { name: 'a'.repeat(101) })).toBe(false);
  });

  it('rejects an email longer than 255 characters', async () => {
    const longEmail = `${'a'.repeat(248)}@x.com`;
    expect(await isValid(UpdateProfileDto, { email: longEmail })).toBe(false);
  });
});
