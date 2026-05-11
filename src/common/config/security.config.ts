import type { CookieOptions } from 'express';

export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/**
 * Returns httpOnly cookie options for the refresh token.
 * Path is scoped to /auth so the browser only sends the cookie
 * on auth requests — never on API calls to other routes.
 */
export function getRefreshCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  };
}

/**
 * Returns options that immediately expire the refresh cookie (for logout).
 */
export function getClearCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/auth',
    maxAge: 0,
  };
}
