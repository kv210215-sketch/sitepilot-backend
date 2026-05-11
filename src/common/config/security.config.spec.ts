import {
  getRefreshCookieOptions,
  getClearCookieOptions,
  REFRESH_TOKEN_COOKIE,
} from './security.config';

describe('security.config', () => {
  describe('REFRESH_TOKEN_COOKIE constant', () => {
    it('equals "refresh_token"', () => {
      expect(REFRESH_TOKEN_COOKIE).toBe('refresh_token');
    });
  });

  describe('getRefreshCookieOptions', () => {
    it('is always httpOnly regardless of environment', () => {
      expect(getRefreshCookieOptions(true).httpOnly).toBe(true);
      expect(getRefreshCookieOptions(false).httpOnly).toBe(true);
    });

    it('is secure in production', () => {
      expect(getRefreshCookieOptions(true).secure).toBe(true);
    });

    it('is not secure in development (allows http localhost)', () => {
      expect(getRefreshCookieOptions(false).secure).toBe(false);
    });

    it('uses strict sameSite in production', () => {
      expect(getRefreshCookieOptions(true).sameSite).toBe('strict');
    });

    it('uses lax sameSite in development', () => {
      expect(getRefreshCookieOptions(false).sameSite).toBe('lax');
    });

    it('scopes cookie to /auth path in all environments', () => {
      expect(getRefreshCookieOptions(true).path).toBe('/auth');
      expect(getRefreshCookieOptions(false).path).toBe('/auth');
    });

    it('maxAge is 7 days expressed in milliseconds', () => {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      expect(getRefreshCookieOptions(true).maxAge).toBe(sevenDaysMs);
      expect(getRefreshCookieOptions(false).maxAge).toBe(sevenDaysMs);
    });
  });

  describe('getClearCookieOptions', () => {
    it('sets maxAge to 0 to expire immediately', () => {
      expect(getClearCookieOptions(true).maxAge).toBe(0);
      expect(getClearCookieOptions(false).maxAge).toBe(0);
    });

    it('is httpOnly', () => {
      expect(getClearCookieOptions(true).httpOnly).toBe(true);
      expect(getClearCookieOptions(false).httpOnly).toBe(true);
    });

    it('is scoped to /auth path', () => {
      expect(getClearCookieOptions(true).path).toBe('/auth');
      expect(getClearCookieOptions(false).path).toBe('/auth');
    });

    it('is secure in production', () => {
      expect(getClearCookieOptions(true).secure).toBe(true);
    });

    it('is not secure in development', () => {
      expect(getClearCookieOptions(false).secure).toBe(false);
    });
  });
});
