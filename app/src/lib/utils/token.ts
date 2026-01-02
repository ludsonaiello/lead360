/**
 * Token Storage Utilities
 * Uses js-cookie for secure token storage
 */

import Cookies from 'js-cookie';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TOKEN_EXPIRY_KEY = 'token_expiry';

/**
 * Cookie configuration for security
 */
const cookieOptions: Cookies.CookieAttributes = {
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'strict', // CSRF protection
  path: '/', // Available across all paths
};

/**
 * Store access and refresh tokens
 * @param accessToken - JWT access token
 * @param refreshToken - JWT refresh token
 * @param expiresIn - Token expiry time in seconds (default: 86400 = 24 hours)
 */
export function setTokens(
  accessToken: string,
  refreshToken: string,
  expiresIn: number = 86400
): void {
  // Calculate expiry timestamp
  const expiryTimestamp = Date.now() + expiresIn * 1000;

  // Store tokens in cookies
  Cookies.set(ACCESS_TOKEN_KEY, accessToken, {
    ...cookieOptions,
    expires: expiresIn / 86400, // Convert seconds to days
  });

  Cookies.set(REFRESH_TOKEN_KEY, refreshToken, {
    ...cookieOptions,
    expires: 30, // Refresh token valid for 30 days max
  });

  Cookies.set(TOKEN_EXPIRY_KEY, expiryTimestamp.toString(), {
    ...cookieOptions,
    expires: expiresIn / 86400,
  });
}

/**
 * Get access token from storage
 * @returns Access token or null if not found/expired
 */
export function getAccessToken(): string | null {
  const token = Cookies.get(ACCESS_TOKEN_KEY);

  if (!token) {
    return null;
  }

  // Check if token is expired
  const expiryStr = Cookies.get(TOKEN_EXPIRY_KEY);
  if (expiryStr) {
    const expiry = parseInt(expiryStr, 10);
    if (Date.now() >= expiry) {
      // Token expired, clear it
      clearTokens();
      return null;
    }
  }

  return token;
}

/**
 * Get refresh token from storage
 * @returns Refresh token or null if not found
 */
export function getRefreshToken(): string | null {
  return Cookies.get(REFRESH_TOKEN_KEY) || null;
}

/**
 * Get token expiry timestamp
 * @returns Expiry timestamp in milliseconds or null
 */
export function getTokenExpiry(): number | null {
  const expiryStr = Cookies.get(TOKEN_EXPIRY_KEY);
  return expiryStr ? parseInt(expiryStr, 10) : null;
}

/**
 * Check if access token is about to expire
 * @param thresholdMinutes - Minutes before expiry to consider "about to expire" (default: 5)
 * @returns true if token will expire within threshold
 */
export function isTokenExpiringSoon(thresholdMinutes: number = 5): boolean {
  const expiry = getTokenExpiry();
  if (!expiry) {
    return true; // No expiry means no token
  }

  const thresholdMs = thresholdMinutes * 60 * 1000;
  const timeUntilExpiry = expiry - Date.now();

  return timeUntilExpiry <= thresholdMs;
}

/**
 * Clear all authentication tokens
 */
export function clearTokens(): void {
  Cookies.remove(ACCESS_TOKEN_KEY, { path: '/' });
  Cookies.remove(REFRESH_TOKEN_KEY, { path: '/' });
  Cookies.remove(TOKEN_EXPIRY_KEY, { path: '/' });
}

/**
 * Check if user is authenticated (has valid access token)
 * @returns true if user has valid access token
 */
export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}
