// Lead360 - Quote Public Access & Analytics API Client
// Sprint 5: Public Access & Analytics (8 endpoints)
// Base URL: /api/v1 (configured in axios.ts)

import { apiClient } from './axios';
import axios from 'axios';
import type {
  GeneratePublicAccessDto,
  PublicAccessUrl,
  PublicAccessStatus,
  DeactivatePublicAccessResponse,
  PublicQuote,
  ValidatePasswordDto,
  ValidatePasswordResponse,
  LogViewDto,
  ViewAnalytics,
  ViewHistoryResponse,
} from '@/lib/types/quotes';

// ========== PUBLIC ACCESS MANAGEMENT (Authenticated) ==========

/**
 * Generate public URL for quote
 * @endpoint POST /quotes/:id/public-access
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param dto Public access options (password, expiration)
 * @returns Public URL with access token
 * @throws 404 - Quote not found
 *
 * @note Creates 32-character access token
 * @note Deactivates previous public URLs for this quote
 * @note Password is hashed (bcrypt) before storage
 * @note Default expiration: 30 days (if not specified)
 */
export const generatePublicUrl = async (
  quoteId: string,
  dto?: GeneratePublicAccessDto
): Promise<PublicAccessUrl> => {
  const { data } = await apiClient.post<PublicAccessUrl>(
    `/quotes/${quoteId}/public-access`,
    dto || {}
  );
  return data;
};

/**
 * Get public access status for quote
 * @endpoint GET /quotes/:id/public-access/status
 * @permission quotes:view
 * @param quoteId Quote UUID
 * @returns Public access status (active or inactive)
 * @throws 404 - Quote not found
 *
 * @note Returns has_public_access: false if no active public URL
 */
export const getPublicAccessStatus = async (
  quoteId: string
): Promise<PublicAccessStatus> => {
  const { data } = await apiClient.get<PublicAccessStatus>(
    `/quotes/${quoteId}/public-access/status`
  );
  return data;
};

/**
 * Deactivate public URL
 * @endpoint DELETE /quotes/:id/public-access
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @returns Success message
 * @throws 404 - Quote not found
 *
 * @note Sets is_active = false
 * @note Public URL immediately stops working
 * @note Cannot be reactivated (must generate new URL)
 */
export const deactivatePublicUrl = async (
  quoteId: string
): Promise<DeactivatePublicAccessResponse> => {
  const { data } = await apiClient.delete<DeactivatePublicAccessResponse>(
    `/quotes/${quoteId}/public-access`
  );
  return data;
};

/**
 * Get view analytics for quote
 * @endpoint GET /quotes/:id/views/analytics
 * @permission quotes:view
 * @param quoteId Quote UUID
 * @returns Analytics summary with views by date and device
 * @throws 404 - Quote not found
 *
 * @note Includes total views, unique visitors, engagement metrics
 * @note Device detection from user agent
 * @note Engagement score calculated by backend
 */
export const getViewAnalytics = async (quoteId: string): Promise<ViewAnalytics> => {
  const { data } = await apiClient.get<ViewAnalytics>(
    `/quotes/${quoteId}/views/analytics`
  );
  return data;
};

/**
 * Get view history (paginated log)
 * @endpoint GET /quotes/:id/views/history
 * @permission quotes:view
 * @param quoteId Quote UUID
 * @param page Page number (default: 1)
 * @param limit Items per page (default: 20, max: 100)
 * @returns Paginated view log with IP, user agent, referrer
 * @throws 404 - Quote not found
 */
export const getViewHistory = async (
  quoteId: string,
  page: number = 1,
  limit: number = 20
): Promise<ViewHistoryResponse> => {
  const { data } = await apiClient.get<ViewHistoryResponse>(
    `/quotes/${quoteId}/views/history`,
    { params: { page, limit } }
  );
  return data;
};

// ========== PUBLIC ENDPOINTS (NO AUTHENTICATION) ==========

// Note: Base URL for public endpoints
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.lead360.app/api/v1';

/**
 * View quote via public URL (NO AUTH)
 * @endpoint GET /public/quotes/:token
 * @permission NONE (Public)
 * @param token 32-character access token
 * @param password Optional password (if quote is protected)
 * @returns Public quote data (sanitized - no internal details)
 * @throws 401 - Invalid password or missing password
 * @throws 403 - Too many failed password attempts (locked out)
 * @throws 404 - Token not found or inactive
 * @throws 410 - Quote expired or no longer available
 * @throws 429 - Rate limit exceeded (10 requests per minute per IP)
 *
 * @note Does NOT expose: Internal notes, cost breakdown, approval history
 * @note Password sent via X-Password header
 * @note Automatically logs view (see logQuoteView)
 */
export const viewPublicQuote = async (
  token: string,
  password?: string
): Promise<PublicQuote> => {
  const headers: Record<string, string> = {};
  if (password) {
    headers['X-Password'] = password;
  }

  // Use raw axios (not apiClient) to avoid auth interceptor
  const { data } = await axios.get<PublicQuote>(
    `${API_BASE_URL}/public/quotes/${token}`,
    { headers }
  );
  return data;
};

/**
 * Validate password for protected quote (NO AUTH)
 * @endpoint POST /public/quotes/:token/validate-password
 * @permission NONE (Public)
 * @param token 32-character access token
 * @param dto Password to validate
 * @returns Validation result with lockout info
 *
 * @note Rate limiting: 5 failed attempts → 15 minute lockout
 * @note Lockout applies per IP + token combination
 * @note Use this to validate before attempting to view quote
 */
export const validatePassword = async (
  token: string,
  dto: ValidatePasswordDto
): Promise<ValidatePasswordResponse> => {
  // Use raw axios (not apiClient) to avoid auth interceptor
  const { data } = await axios.post<ValidatePasswordResponse>(
    `${API_BASE_URL}/public/quotes/${token}/validate-password`,
    dto
  );
  return data;
};

/**
 * Log quote view event (NO AUTH)
 * @endpoint POST /public/quotes/:token/view
 * @permission NONE (Public)
 * @param token 32-character access token
 * @param dto View metadata (referrer, duration)
 * @returns void (HTTP 204 No Content)
 *
 * @note Side effects:
 * - Logs view event with IP, user agent, timestamp
 * - Updates quote status: sent → read (if currently sent/delivered)
 * - Increments view count
 *
 * @note Use this to track:
 * - Initial page load (call immediately after viewPublicQuote)
 * - Page unload (send duration via navigator.sendBeacon)
 * - Heartbeat updates (every 30 seconds)
 */
export const logQuoteView = async (
  token: string,
  dto?: LogViewDto
): Promise<void> => {
  // Use raw axios (not apiClient) to avoid auth interceptor
  await axios.post(`${API_BASE_URL}/public/quotes/${token}/view`, dto || {});
};

/**
 * Log quote PDF download event (NO AUTH)
 * @endpoint POST /public/quotes/:token/download
 * @permission NONE (Public)
 * @param token 32-character access token
 * @param dto Download metadata (file_id)
 * @returns void (HTTP 204 No Content)
 *
 * @note Side effects:
 * - Logs download event with IP, user agent, timestamp
 * - Updates quote status: read → opened (if currently read)
 * - Increments download count
 *
 * @note Call this BEFORE triggering the actual download
 */
export const logQuoteDownload = async (
  token: string,
  dto?: { file_id?: string }
): Promise<void> => {
  // Use raw axios (not apiClient) to avoid auth interceptor
  await axios.post(`${API_BASE_URL}/public/quotes/${token}/download`, dto || {});
};

// ========== UTILITY FUNCTIONS ==========

/**
 * Get full public URL
 * @param token Access token
 * @param tenantDomain Tenant subdomain (e.g., "honeydo4you")
 * @returns Full public URL
 */
export const getFullPublicUrl = (token: string, tenantDomain: string): string => {
  return `https://${tenantDomain}.lead360.app/public/quotes/${token}`;
};

/**
 * Extract token from public URL
 * @param url Full public URL
 * @returns Access token or null
 */
export const extractTokenFromUrl = (url: string): string | null => {
  const match = url.match(/\/public\/quotes\/([a-f0-9]{32})$/);
  return match ? match[1] : null;
};

/**
 * Check if password is required
 * @param status PublicAccessStatus object
 * @returns boolean
 */
export const isPasswordRequired = (status: PublicAccessStatus): boolean => {
  return status.has_public_access && (status.has_password || false);
};

/**
 * Check if URL is expired
 * @param expiresAt ISO date string or undefined
 * @returns boolean
 */
export const isUrlExpired = (expiresAt?: string): boolean => {
  if (!expiresAt) return false;
  const expiration = new Date(expiresAt);
  const now = new Date();
  return expiration < now;
};

/**
 * Format days until expiration
 * @param expiresAt ISO date string or undefined
 * @returns Formatted string (e.g., "5 days remaining", "Expired")
 */
export const formatExpiration = (expiresAt?: string): string => {
  if (!expiresAt) return 'Never expires';

  const expiration = new Date(expiresAt);
  const now = new Date();
  const daysRemaining = Math.ceil(
    (expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysRemaining < 0) return 'Expired';
  if (daysRemaining === 0) return 'Expires today';
  if (daysRemaining === 1) return '1 day remaining';
  return `${daysRemaining} days remaining`;
};

/**
 * Copy public URL to clipboard
 * @param url Public URL string
 * @returns Promise<boolean> - true if copied successfully
 */
export const copyPublicUrlToClipboard = async (url: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch (error) {
    console.error('Failed to copy URL:', error);
    return false;
  }
};

/**
 * Get device type from analytics
 * @param analytics ViewAnalytics object
 * @returns Most common device type
 */
export const getMostCommonDevice = (analytics: ViewAnalytics): string => {
  const devices = analytics.views_by_device;
  const max = Math.max(devices.desktop, devices.mobile, devices.tablet);

  if (max === 0) return 'N/A';
  if (devices.desktop === max) return 'Desktop';
  if (devices.mobile === max) return 'Mobile';
  if (devices.tablet === max) return 'Tablet';
  return 'Unknown';
};

/**
 * Calculate engagement level from score
 * @param score Engagement score (0-100)
 * @returns Engagement level
 */
export const getEngagementLevel = (score: number): 'Low' | 'Medium' | 'High' => {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
};

/**
 * Format duration for display
 * @param seconds Duration in seconds
 * @returns Formatted string (e.g., "2m 30s", "1h 15m")
 */
export const formatDuration = (seconds: number | null): string => {
  if (seconds === null || seconds === 0) return 'N/A';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};
