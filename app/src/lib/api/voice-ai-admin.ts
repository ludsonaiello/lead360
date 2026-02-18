/**
 * Voice AI Admin API Client
 * Sprint FSA06: Foundation — API client for all Voice AI admin endpoints
 * All endpoints: /api/v1/system/voice-ai/* (require is_platform_admin: true)
 */

import { apiClient } from './axios';
import type {
  VoiceAiProvider,
  CreateProviderRequest,
  VoiceAiCredential,
  VoiceAiGlobalConfig,
  UpdateGlobalConfigRequest,
  PlanWithVoiceConfig,
  TenantVoiceAiOverview,
  AdminOverrideRequest,
  VoiceCallLog,
  AdminUsageReport,
  PaginatedResponse,
} from '../types/voice-ai-admin';

// ============================================
// PROVIDERS — /api/v1/system/voice-ai/providers
// ============================================

/**
 * GET /system/voice-ai/providers
 * List all AI providers registered on the platform (including inactive).
 */
export async function getVoiceAiProviders(): Promise<VoiceAiProvider[]> {
  const { data } = await apiClient.get('/system/voice-ai/providers');
  return data;
}

/**
 * POST /system/voice-ai/providers
 * Create a new AI provider in the registry.
 * Returns 409 if provider_key already exists.
 */
export async function createVoiceAiProvider(dto: CreateProviderRequest): Promise<VoiceAiProvider> {
  const { data } = await apiClient.post('/system/voice-ai/providers', dto);
  return data;
}

/**
 * PATCH /system/voice-ai/providers/:id
 * Partial update of an existing provider. All fields optional.
 */
export async function updateVoiceAiProvider(
  id: string,
  dto: Partial<CreateProviderRequest>
): Promise<VoiceAiProvider> {
  const { data } = await apiClient.patch(`/system/voice-ai/providers/${id}`, dto);
  return data;
}

/**
 * DELETE /system/voice-ai/providers/:id
 * Soft-delete a provider (sets is_active = false and removes from agent context).
 * Returns 204 No Content on success.
 */
export async function deleteVoiceAiProvider(id: string): Promise<void> {
  await apiClient.delete(`/system/voice-ai/providers/${id}`);
}

// ============================================
// CREDENTIALS — /api/v1/system/voice-ai/credentials
// ============================================

/**
 * GET /system/voice-ai/credentials
 * List all provider credentials with masked API keys.
 */
export async function getVoiceAiCredentials(): Promise<VoiceAiCredential[]> {
  const { data } = await apiClient.get('/system/voice-ai/credentials');
  return data;
}

/**
 * PUT /system/voice-ai/credentials/:providerId
 * Set or update the API key for a provider. Key is AES-256-GCM encrypted at rest.
 */
export async function setVoiceAiCredential(
  providerId: string,
  apiKey: string
): Promise<VoiceAiCredential> {
  const { data } = await apiClient.put(`/system/voice-ai/credentials/${providerId}`, {
    api_key: apiKey,
  });
  return data;
}

/**
 * DELETE /system/voice-ai/credentials/:providerId
 * Remove the stored credential for a provider.
 */
export async function deleteVoiceAiCredential(providerId: string): Promise<void> {
  await apiClient.delete(`/system/voice-ai/credentials/${providerId}`);
}

// ============================================
// GLOBAL CONFIG — /api/v1/system/voice-ai/config
// ============================================

/**
 * GET /system/voice-ai/config
 * Get the platform-wide Voice AI configuration singleton.
 */
export async function getVoiceAiGlobalConfig(): Promise<VoiceAiGlobalConfig> {
  const { data } = await apiClient.get('/system/voice-ai/config');
  return data;
}

/**
 * PATCH /system/voice-ai/config
 * Update the global Voice AI configuration. All fields optional.
 */
export async function updateVoiceAiGlobalConfig(
  dto: UpdateGlobalConfigRequest
): Promise<VoiceAiGlobalConfig> {
  const { data } = await apiClient.patch('/system/voice-ai/config', dto);
  return data;
}

/**
 * POST /system/voice-ai/config/regenerate-key
 * Regenerate the agent API key. Returns the new plain key once — store it securely.
 */
export async function regenerateAgentKey(): Promise<{
  plain_key: string;
  preview: string;
  warning: string;
}> {
  const { data } = await apiClient.post('/system/voice-ai/config/regenerate-key');
  return data;
}

// ============================================
// SUBSCRIPTION PLANS — /api/v1/system/voice-ai/plans
// ============================================

/**
 * GET /system/voice-ai/plans
 * List all subscription plans with their Voice AI configuration.
 */
export async function getPlansWithVoiceConfig(): Promise<PlanWithVoiceConfig[]> {
  const { data } = await apiClient.get('/system/voice-ai/plans');
  return data;
}

/**
 * PATCH /system/voice-ai/plans/:planId/voice
 * Update the Voice AI configuration for a subscription plan.
 */
export async function updatePlanVoiceConfig(
  planId: string,
  dto: Partial<Pick<PlanWithVoiceConfig, 'voice_ai_enabled' | 'voice_ai_minutes_included' | 'voice_ai_overage_rate'>>
): Promise<PlanWithVoiceConfig> {
  const { data } = await apiClient.patch(`/system/voice-ai/plans/${planId}/voice`, dto);
  return data;
}

// ============================================
// MONITORING — /api/v1/system/voice-ai/tenants & call-logs
// ============================================

/**
 * GET /system/voice-ai/tenants
 * All tenants with their Voice AI summary (usage, status, overrides).
 */
export async function getTenantsVoiceAiOverview(params?: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<PaginatedResponse<TenantVoiceAiOverview>> {
  const { data } = await apiClient.get('/system/voice-ai/tenants', { params });
  return data;
}

/**
 * PATCH /system/voice-ai/tenants/:tenantId/override
 * Apply admin overrides to a tenant's Voice AI settings.
 * Pass null values to remove an override.
 */
export async function overrideTenantVoiceSettings(
  tenantId: string,
  dto: AdminOverrideRequest
): Promise<void> {
  await apiClient.patch(`/system/voice-ai/tenants/${tenantId}/override`, dto);
}

/**
 * GET /system/voice-ai/call-logs
 * Cross-tenant call log history with optional filters.
 */
export async function getAdminCallLogs(params?: {
  tenantId?: string;
  from?: string;
  to?: string;
  outcome?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<VoiceCallLog>> {
  const { data } = await apiClient.get('/system/voice-ai/call-logs', { params });
  return data;
}

/**
 * GET /system/voice-ai/usage-report
 * Aggregate usage report by month. Defaults to current month if not provided.
 */
export async function getAdminUsageReport(
  year?: number,
  month?: number
): Promise<AdminUsageReport> {
  const { data } = await apiClient.get('/system/voice-ai/usage-report', {
    params: { year, month },
  });
  return data;
}
