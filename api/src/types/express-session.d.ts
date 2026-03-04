import 'express-session';

/**
 * Extend Express Session to include OAuth-specific data
 * This provides type safety for session properties used in Google OAuth flow
 */
declare module 'express-session' {
  interface SessionData {
    // Google OAuth CSRF protection
    googleOAuthState?: string;

    // Tenant isolation for OAuth flow
    googleOAuthTenantId?: string;

    // Temporary token storage during calendar selection
    googleOAuthTokens?: {
      accessToken: string;
      refreshToken: string;
      expiryDate: string; // ISO 8601 format
    };
  }
}
