/**
 * Admin System Settings API Client
 * Endpoints for feature flags, maintenance mode, and global settings
 */

import apiClient from './axios';
import type {
  FeatureFlag,
  MaintenanceModeConfig,
  GlobalSetting,
  GlobalSettingsResponse,
  UpdateGlobalSettingsDto,
} from '../types/admin';

// ============================================================================
// Feature Flags
// ============================================================================

/**
 * Get all feature flags
 * GET /api/v1/admin/settings/feature-flags
 */
export async function getFeatureFlags(): Promise<FeatureFlag[]> {
  const response = await apiClient.get<FeatureFlag[]>('/admin/settings/feature-flags');
  return response.data;
}

/**
 * Toggle a feature flag
 * PATCH /api/v1/admin/settings/feature-flags/:key/toggle
 */
export async function toggleFeatureFlag(key: string): Promise<FeatureFlag> {
  const response = await apiClient.patch<FeatureFlag>(
    `/admin/settings/feature-flags/${key}/toggle`
  );
  return response.data;
}

// ============================================================================
// Maintenance Mode
// ============================================================================

/**
 * Get maintenance mode configuration
 * GET /api/v1/admin/settings/maintenance-mode
 */
export async function getMaintenanceMode(): Promise<MaintenanceModeConfig> {
  const response = await apiClient.get<MaintenanceModeConfig>('/admin/settings/maintenance-mode');
  return response.data;
}

/**
 * Update maintenance mode configuration
 * PATCH /api/v1/admin/settings/maintenance-mode
 */
export async function updateMaintenanceMode(
  config: Partial<MaintenanceModeConfig>
): Promise<MaintenanceModeConfig> {
  const response = await apiClient.patch<MaintenanceModeConfig>(
    '/admin/settings/maintenance-mode',
    config
  );
  return response.data;
}

// ============================================================================
// Global Settings
// ============================================================================

/**
 * Get all global settings
 * GET /api/v1/admin/settings/global
 */
export async function getGlobalSettings(): Promise<GlobalSettingsResponse> {
  const response = await apiClient.get<GlobalSettingsResponse>('/admin/settings/global');
  return response.data;
}

/**
 * Update multiple global settings at once
 * PATCH /api/v1/admin/settings/global/bulk
 */
export async function updateGlobalSettings(
  dto: UpdateGlobalSettingsDto
): Promise<{ message: string; updated: number }> {
  const response = await apiClient.patch<{ message: string; updated: number }>(
    '/admin/settings/global/bulk',
    dto
  );
  return response.data;
}

/**
 * Helper: Get settings grouped by category
 */
export async function getSettingsByCategory(): Promise<Record<string, GlobalSetting[]>> {
  const response = await getGlobalSettings();
  return response.grouped;
}
