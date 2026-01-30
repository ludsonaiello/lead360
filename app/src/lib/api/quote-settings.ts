// Quote Settings API Client
// Sprint 5: Settings management endpoints

import { apiClient } from './axios';
import type {
  QuoteSettings,
  UpdateQuoteSettingsDto,
  ResetSettingsResponse,
} from '@/lib/types/quotes';

// ========== QUOTE SETTINGS (3 endpoints) ==========

/**
 * Get quote settings
 * @endpoint GET /quotes/settings
 * @permission quotes:view
 * @returns Current quote settings for the tenant
 */
export const getQuoteSettings = async (): Promise<QuoteSettings> => {
  const { data } = await apiClient.get<QuoteSettings>('/quotes/settings');
  return data;
};

/**
 * Update quote settings
 * @endpoint PATCH /quotes/settings
 * @permission quotes:edit (Owner, Admin only)
 * @param dto Partial quote settings to update
 * @returns Updated quote settings
 * @throws 400 - Validation errors
 * @note All fields are optional - only updates provided fields
 */
export const updateQuoteSettings = async (
  dto: UpdateQuoteSettingsDto
): Promise<QuoteSettings> => {
  const { data } = await apiClient.patch<QuoteSettings>('/quotes/settings', dto);
  return data;
};

/**
 * Reset settings to system defaults
 * @endpoint POST /quotes/settings/reset
 * @permission quotes:edit (Owner, Admin only)
 * @returns Message and updated settings with system defaults
 * @note Clears tenant-specific settings and reverts to system defaults
 */
export const resetQuoteSettings = async (): Promise<ResetSettingsResponse> => {
  const { data } = await apiClient.post<ResetSettingsResponse>('/quotes/settings/reset');
  return data;
};

/**
 * Get approval thresholds configuration
 * @endpoint GET /quotes/settings/approval-thresholds
 * @permission quotes:view
 * @returns Approval thresholds or null if approval workflow is disabled
 * @note null = no approvals required, all quotes auto-approved
 */
export const getApprovalThresholds = async (): Promise<any> => {
  const { data } = await apiClient.get('/quotes/settings/approval-thresholds');
  return data;
};
