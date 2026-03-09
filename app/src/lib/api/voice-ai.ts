// ============================================================================
// Voice AI API Client
// ============================================================================
// API methods for Voice AI Provider Management (Platform Admin)
// Matches backend API docs from api/documentation/voice_ai_REST_API.md
// ============================================================================

import apiClient from './axios';
import type {
  VoiceAIProvider,
  CreateProviderRequest,
  UpdateProviderRequest,
  ProviderFilters,
  VoiceAICredential,
  UpsertCredentialRequest,
  TestConnectionResponse,
  GlobalConfig,
  UpdateGlobalConfigRequest,
  RegenerateKeyResponse,
  SubscriptionPlan,
  UpdatePlanVoiceConfigRequest,
  TenantVoiceAISummary,
  TenantOverrideDto,
  PaginatedTenantsResponse,
  TenantFilters,
  AgentStatus,
  ActiveRoom,
  CallLog,
  CallLogFilters,
  PaginatedCallLogsResponse,
  UsageReport,
  TenantUsageSummaryResponse,
  TenantVoiceAISettings,
  UpdateTenantSettingsRequest,
  TransferNumber,
  CreateTransferNumberRequest,
  UpdateTransferNumberRequest,
  ReorderTransferNumbersRequest,
  VoiceAgentProfile,
  CreateVoiceAgentProfileRequest,
  UpdateVoiceAgentProfileRequest,
} from '../types/voice-ai';

// ============================================================================
// Provider Management (Platform Admin Only)
// Base path: /api/v1/system/voice-ai/providers
// ============================================================================

/**
 * Get all AI providers
 * Supports filtering by provider_type and is_active
 *
 * @param filters - Optional query parameters
 * @returns Promise<VoiceAIProvider[]>
 *
 * @example
 * // Get all providers
 * const providers = await voiceAiApi.getAllProviders();
 *
 * @example
 * // Get only STT providers
 * const sttProviders = await voiceAiApi.getAllProviders({ provider_type: 'STT' });
 *
 * @example
 * // Get only active providers
 * const activeProviders = await voiceAiApi.getAllProviders({ is_active: true });
 */
export const getAllProviders = async (
  filters?: ProviderFilters
): Promise<VoiceAIProvider[]> => {
  const params: Record<string, string> = {};

  if (filters?.provider_type) {
    params.provider_type = filters.provider_type;
  }

  if (filters?.is_active !== undefined) {
    params.is_active = filters.is_active.toString();
  }

  const { data } = await apiClient.get('/system/voice-ai/providers', { params });
  return data;
};

/**
 * Get a single provider by ID
 *
 * @param providerId - Provider ID (UUID)
 * @returns Promise<VoiceAIProvider>
 *
 * @example
 * const provider = await voiceAiApi.getProviderById('provider-id-123');
 */
export const getProviderById = async (providerId: string): Promise<VoiceAIProvider> => {
  const { data } = await apiClient.get(`/system/voice-ai/providers/${providerId}`);
  return data;
};

/**
 * Create a new AI provider
 *
 * @param providerData - Provider creation data
 * @returns Promise<VoiceAIProvider>
 *
 * @example
 * // Minimal provider (required fields only)
 * const provider = await voiceAiApi.createProvider({
 *   provider_key: 'deepgram',
 *   provider_type: 'STT',
 *   display_name: 'Deepgram'
 * });
 *
 * @example
 * // Complete provider (all fields)
 * const provider = await voiceAiApi.createProvider({
 *   provider_key: 'deepgram',
 *   provider_type: 'STT',
 *   display_name: 'Deepgram',
 *   description: 'State-of-the-art speech recognition',
 *   logo_url: 'https://deepgram.com/favicon.ico',
 *   documentation_url: 'https://developers.deepgram.com',
 *   capabilities: '["streaming","multilingual"]',
 *   config_schema: '{"type":"object","properties":{}}',
 *   default_config: '{"model":"nova-2"}',
 *   pricing_info: '{"per_minute":0.0043}',
 *   is_active: true
 * });
 */
export const createProvider = async (
  providerData: CreateProviderRequest
): Promise<VoiceAIProvider> => {
  const { data } = await apiClient.post('/system/voice-ai/providers', providerData);
  return data;
};

/**
 * Update an existing provider (partial update)
 *
 * @param providerId - Provider ID (UUID)
 * @param updates - Partial provider update data
 * @returns Promise<VoiceAIProvider>
 *
 * @example
 * // Update single field
 * const provider = await voiceAiApi.updateProvider('provider-id-123', {
 *   is_active: false
 * });
 *
 * @example
 * // Update multiple fields
 * const provider = await voiceAiApi.updateProvider('provider-id-123', {
 *   display_name: 'Deepgram Nova 2',
 *   description: 'Updated description'
 * });
 */
export const updateProvider = async (
  providerId: string,
  updates: UpdateProviderRequest
): Promise<VoiceAIProvider> => {
  const { data } = await apiClient.patch(
    `/system/voice-ai/providers/${providerId}`,
    updates
  );
  return data;
};

/**
 * Delete a provider permanently
 * WARNING: Cascade deletes all related credentials and usage records
 *
 * @param providerId - Provider ID (UUID)
 * @returns Promise<void>
 *
 * @example
 * await voiceAiApi.deleteProvider('provider-id-123');
 */
export const deleteProvider = async (providerId: string): Promise<void> => {
  await apiClient.delete(`/system/voice-ai/providers/${providerId}`);
};

// ============================================================================
// Credentials Management (Platform Admin Only)
// Base path: /api/v1/system/voice-ai/credentials
// ============================================================================

/**
 * Get all credentials (masked keys only)
 *
 * @returns Promise<VoiceAICredential[]>
 *
 * @example
 * const credentials = await voiceAiApi.getAllCredentials();
 */
export const getAllCredentials = async (): Promise<VoiceAICredential[]> => {
  const { data } = await apiClient.get('/system/voice-ai/credentials');
  return data;
};

/**
 * Create or update (upsert) a credential for a provider
 * Security: API key is encrypted (AES-256-GCM) before storage; plain key never returned
 *
 * @param providerId - Provider ID (UUID)
 * @param credentialData - Credential data (plain API key + optional config)
 * @returns Promise<VoiceAICredential>
 *
 * @example
 * // Minimal credential (required fields only)
 * const credential = await voiceAiApi.upsertCredential('provider-id-123', {
 *   api_key: 'dg_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
 * });
 *
 * @example
 * // Complete credential (with additional config)
 * const credential = await voiceAiApi.upsertCredential('provider-id-123', {
 *   api_key: 'dg_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
 *   additional_config: '{"region":"us-west-1","model":"whisper-1"}'
 * });
 */
export const upsertCredential = async (
  providerId: string,
  credentialData: UpsertCredentialRequest
): Promise<VoiceAICredential> => {
  const { data } = await apiClient.put(
    `/system/voice-ai/credentials/${providerId}`,
    credentialData
  );
  return data;
};

/**
 * Delete a credential for a provider
 *
 * @param providerId - Provider ID (UUID)
 * @returns Promise<void>
 *
 * @example
 * await voiceAiApi.deleteCredential('provider-id-123');
 */
export const deleteCredential = async (providerId: string): Promise<void> => {
  await apiClient.delete(`/system/voice-ai/credentials/${providerId}`);
};

/**
 * Test a stored credential by making a lightweight call to provider's API
 *
 * @param providerId - Provider ID (UUID)
 * @returns Promise<TestConnectionResponse>
 *
 * @example
 * const result = await voiceAiApi.testCredential('provider-id-123');
 * if (result.success) {
 *   console.log('Connection successful');
 * } else {
 *   console.error('Connection failed:', result.message);
 * }
 */
export const testCredential = async (
  providerId: string
): Promise<TestConnectionResponse> => {
  const { data } = await apiClient.post(
    `/system/voice-ai/credentials/${providerId}/test`
  );
  return data;
};

// ============================================================================
// Global Configuration (Platform Admin Only)
// Base path: /api/v1/system/voice-ai/config
// ============================================================================

/**
 * Get global Voice AI configuration
 *
 * @returns Promise<GlobalConfig>
 *
 * @example
 * const config = await voiceAiApi.getGlobalConfig();
 */
export const getGlobalConfig = async (): Promise<GlobalConfig> => {
  const { data } = await apiClient.get('/system/voice-ai/config');
  return data;
};

/**
 * Update global Voice AI configuration (partial update)
 *
 * @param updates - Partial configuration update data
 * @returns Promise<GlobalConfig>
 *
 * @example
 * // Enable agent globally
 * const config = await voiceAiApi.updateGlobalConfig({
 *   agent_enabled: true
 * });
 *
 * @example
 * // Update multiple fields
 * const config = await voiceAiApi.updateGlobalConfig({
 *   agent_enabled: true,
 *   default_stt_provider_id: 'provider-id-123',
 *   default_language: 'en',
 *   max_concurrent_calls: 20
 * });
 */
export const updateGlobalConfig = async (
  updates: UpdateGlobalConfigRequest
): Promise<GlobalConfig> => {
  const { data } = await apiClient.patch('/system/voice-ai/config', updates);
  return data;
};

/**
 * Regenerate agent API key
 * WARNING: This invalidates the current key. The plain key is returned ONCE only.
 *
 * @returns Promise<RegenerateKeyResponse>
 *
 * @example
 * const result = await voiceAiApi.regenerateAgentKey();
 * // Save result.plain_key immediately - it won't be shown again
 */
export const regenerateAgentKey = async (): Promise<RegenerateKeyResponse> => {
  const { data } = await apiClient.post('/system/voice-ai/config/regenerate-key');
  return data;
};

// ============================================================================
// Plan Configuration (Platform Admin Only)
// Base path: /api/v1/system/voice-ai/plans
// ============================================================================

/**
 * Get all subscription plans with Voice AI configuration
 *
 * @returns Promise<SubscriptionPlan[]>
 *
 * @example
 * const plans = await voiceAiApi.getAllPlans();
 */
export const getAllPlans = async (): Promise<SubscriptionPlan[]> => {
  const { data } = await apiClient.get('/system/voice-ai/plans');
  return data;
};

/**
 * Update Voice AI configuration for a specific subscription plan (partial update)
 *
 * @param planId - Plan ID (UUID)
 * @param updates - Partial plan voice config update data
 * @returns Promise<SubscriptionPlan>
 *
 * @example
 * // Enable Voice AI for a plan
 * const plan = await voiceAiApi.updatePlanVoiceConfig('plan-id-123', {
 *   voice_ai_enabled: true,
 *   voice_ai_minutes_included: 100,
 *   voice_ai_overage_rate: null // Block calls when quota exceeded
 * });
 *
 * @example
 * // Enable overage billing
 * const plan = await voiceAiApi.updatePlanVoiceConfig('plan-id-123', {
 *   voice_ai_overage_rate: 0.10 // $0.10 per minute
 * });
 */
export const updatePlanVoiceConfig = async (
  planId: string,
  updates: UpdatePlanVoiceConfigRequest
): Promise<SubscriptionPlan> => {
  const { data } = await apiClient.patch(
    `/system/voice-ai/plans/${planId}/voice`,
    updates
  );
  return data;
};

// ============================================================================
// Tenant Management (Platform Admin Only)
// Base path: /api/v1/system/voice-ai/tenants
// ============================================================================

/**
 * Get all tenants with Voice AI summary
 * Supports pagination and search by company name
 *
 * @param filters - Optional query parameters (page, limit, search)
 * @returns Promise<PaginatedTenantsResponse>
 *
 * @example
 * // Get first page with default limit (20)
 * const result = await voiceAiApi.getAllTenants();
 *
 * @example
 * // Search by company name with custom pagination
 * const result = await voiceAiApi.getAllTenants({
 *   page: 2,
 *   limit: 10,
 *   search: 'honey'
 * });
 */
export const getAllTenants = async (
  filters?: TenantFilters
): Promise<PaginatedTenantsResponse> => {
  const params: Record<string, string> = {};

  if (filters?.page !== undefined) {
    params.page = filters.page.toString();
  }

  if (filters?.limit !== undefined) {
    params.limit = filters.limit.toString();
  }

  if (filters?.search) {
    params.search = filters.search;
  }

  const { data } = await apiClient.get('/system/voice-ai/tenants', { params });
  return data;
};

/**
 * Get current admin overrides for a tenant
 * Returns all override fields (null if not set)
 *
 * @param tenantId - Tenant ID (UUID)
 * @returns Promise<TenantOverrideDto>
 *
 * @example
 * const overrides = await voiceAiApi.getTenantOverride('tenant-id-123');
 * // Returns: { force_enabled: true, monthly_minutes_override: 1000, ... }
 */
export const getTenantOverride = async (
  tenantId: string
): Promise<TenantOverrideDto> => {
  const { data } = await apiClient.get(`/system/voice-ai/tenants/${tenantId}/override`);
  return data;
};

/**
 * Update admin overrides for a tenant's Voice AI settings
 * Nullable semantics: null = remove override, undefined = leave unchanged
 *
 * @param tenantId - Tenant ID (UUID)
 * @param overrides - Partial override data
 * @returns Promise<void> (204 No Content on success)
 *
 * @example
 * // Force enable Voice AI for a tenant
 * await voiceAiApi.updateTenantOverride('tenant-id-123', {
 *   force_enabled: true,
 *   monthly_minutes_override: 500,
 *   admin_notes: 'VIP customer - extra quota'
 * });
 *
 * @example
 * // Remove all overrides (revert to defaults)
 * await voiceAiApi.updateTenantOverride('tenant-id-123', {
 *   force_enabled: null,
 *   monthly_minutes_override: null,
 *   stt_provider_override_id: null,
 *   llm_provider_override_id: null,
 *   tts_provider_override_id: null,
 *   admin_notes: null
 * });
 */
export const updateTenantOverride = async (
  tenantId: string,
  overrides: TenantOverrideDto
): Promise<void> => {
  await apiClient.patch(`/system/voice-ai/tenants/${tenantId}/override`, overrides);
};

/**
 * Get voice agent profiles for a specific tenant (Admin only)
 * Returns all profiles owned by the tenant
 *
 * @param tenantId - Tenant ID (UUID)
 * @returns Promise<VoiceAgentProfile[]>
 *
 * @example
 * const profiles = await voiceAiApi.getTenantAgentProfiles('tenant-id-123');
 */
export const getTenantAgentProfiles = async (
  tenantId: string
): Promise<VoiceAgentProfile[]> => {
  const { data } = await apiClient.get(`/system/voice-ai/tenants/${tenantId}/profiles`);
  return data;
};

// ============================================================================
// Monitoring (Platform Admin Only)
// Base path: /api/v1/system/voice-ai
// ============================================================================

/**
 * Get Voice AI agent status and metrics
 * Real-time health check and KPIs
 *
 * @returns Promise<AgentStatus>
 *
 * @example
 * const status = await voiceAiApi.getAgentStatus();
 * console.log(`Agent running: ${status.is_running}`);
 * console.log(`Active calls: ${status.active_calls}`);
 */
export const getAgentStatus = async (): Promise<AgentStatus> => {
  const { data } = await apiClient.get('/system/voice-ai/agent/status');
  return data;
};

/**
 * Get all active Voice AI calls (rooms)
 * Returns only calls with status='in_progress'
 *
 * @returns Promise<ActiveRoom[]>
 *
 * @example
 * const activeCalls = await voiceAiApi.getActiveRooms();
 * console.log(`${activeCalls.length} calls in progress`);
 */
export const getActiveRooms = async (): Promise<ActiveRoom[]> => {
  const { data } = await apiClient.get('/system/voice-ai/rooms');
  return data;
};

/**
 * Force-terminate a specific call by room name
 * Emergency operation - updates call log to 'failed' status
 *
 * @param roomName - LiveKit room name (not call_sid)
 * @returns Promise<void> (204 No Content on success)
 *
 * @example
 * await voiceAiApi.forceEndCall('room-abc123');
 */
export const forceEndCall = async (roomName: string): Promise<void> => {
  await apiClient.post(`/system/voice-ai/rooms/${roomName}/end`);
};

// ============================================================================
// Call Logs & Usage Reports (Platform Admin Only)
// Base path: /api/v1/system/voice-ai
// ============================================================================

/**
 * Get paginated call logs across all tenants
 * Supports filtering by tenant, date range, outcome, and status
 *
 * @param filters - Optional query parameters
 * @returns Promise<PaginatedCallLogsResponse>
 *
 * @example
 * // Get all call logs (first page, default limit 20)
 * const result = await voiceAiApi.getCallLogs();
 *
 * @example
 * // Filter by tenant and date range
 * const result = await voiceAiApi.getCallLogs({
 *   tenantId: 'tenant-id-123',
 *   from: '2026-02-01',
 *   to: '2026-02-28',
 *   outcome: 'lead_created',
 *   page: 1,
 *   limit: 50
 * });
 */
export const getCallLogs = async (
  filters?: CallLogFilters
): Promise<PaginatedCallLogsResponse> => {
  const params: Record<string, string> = {};

  if (filters?.tenantId) {
    params.tenantId = filters.tenantId;
  }

  if (filters?.from) {
    params.from = filters.from;
  }

  if (filters?.to) {
    params.to = filters.to;
  }

  if (filters?.outcome) {
    params.outcome = filters.outcome;
  }

  if (filters?.status) {
    params.status = filters.status;
  }

  if (filters?.page !== undefined) {
    params.page = filters.page.toString();
  }

  if (filters?.limit !== undefined) {
    params.limit = filters.limit.toString();
  }

  const { data } = await apiClient.get('/system/voice-ai/call-logs', { params });
  return data;
};

/**
 * Get platform-wide usage report for a specific month
 * Includes total calls, STT seconds, estimated cost, and per-tenant breakdown
 *
 * @param year - Year (e.g., 2026), defaults to current year
 * @param month - Month (1-12), defaults to current month
 * @returns Promise<UsageReport>
 *
 * @example
 * // Get current month's usage
 * const report = await voiceAiApi.getUsageReport();
 *
 * @example
 * // Get specific month's usage
 * const report = await voiceAiApi.getUsageReport(2026, 2);
 */
export const getUsageReport = async (
  year?: number,
  month?: number
): Promise<UsageReport> => {
  const params: Record<string, string> = {};

  if (year !== undefined) {
    params.year = year.toString();
  }

  if (month !== undefined) {
    params.month = month.toString();
  }

  const { data } = await apiClient.get('/system/voice-ai/usage-report', { params });
  return data;
};

// ============================================================================
// Tenant Settings (Tenant Users)
// Base path: /api/v1/voice-ai
// ============================================================================

/**
 * Get current tenant's Voice AI settings
 * Returns null if settings have never been configured
 *
 * @returns Promise<TenantVoiceAISettings | null>
 *
 * @example
 * const settings = await voiceAiApi.getTenantSettings();
 * if (settings) {
 *   console.log(`Voice AI enabled: ${settings.is_enabled}`);
 * } else {
 *   console.log('Settings not configured yet - using global defaults');
 * }
 */
export const getTenantSettings = async (): Promise<TenantVoiceAISettings | null> => {
  const { data } = await apiClient.get('/voice-ai/settings');
  return data;
};

/**
 * Update (upsert) tenant's Voice AI settings
 * All fields are optional (PATCH semantics on PUT endpoint)
 *
 * @param updates - Partial settings update data
 * @returns Promise<TenantVoiceAISettings>
 *
 * @example
 * // Enable Voice AI and configure languages
 * const settings = await voiceAiApi.updateTenantSettings({
 *   is_enabled: true,
 *   enabled_languages: ['en', 'es', 'pt']
 * });
 *
 * @example
 * // Set custom greeting (use null to revert to global template)
 * const settings = await voiceAiApi.updateTenantSettings({
 *   custom_greeting: 'Thank you for calling {business_name}!'
 * });
 *
 * @example
 * // Clear custom greeting (revert to global template)
 * const settings = await voiceAiApi.updateTenantSettings({
 *   custom_greeting: null
 * });
 */
export const updateTenantSettings = async (
  updates: UpdateTenantSettingsRequest
): Promise<TenantVoiceAISettings> => {
  const { data } = await apiClient.put('/voice-ai/settings', updates);
  return data;
};

// ============================================================================
// Transfer Numbers (Tenant)
// Base path: /api/v1/voice-ai/transfer-numbers
// ============================================================================

/**
 * Get all transfer numbers for authenticated tenant
 * Returns transfer numbers ordered by display_order ASC
 *
 * @returns Promise<TransferNumber[]>
 *
 * @example
 * const transferNumbers = await voiceAiApi.getAllTransferNumbers();
 */
export const getAllTransferNumbers = async (): Promise<TransferNumber[]> => {
  const { data } = await apiClient.get('/voice-ai/transfer-numbers');
  return data;
};

/**
 * Get a single transfer number by ID
 *
 * @param id - Transfer number ID (UUID)
 * @returns Promise<TransferNumber>
 *
 * @example
 * const transferNumber = await voiceAiApi.getTransferNumberById('transfer-id-123');
 */
export const getTransferNumberById = async (id: string): Promise<TransferNumber> => {
  const { data } = await apiClient.get(`/voice-ai/transfer-numbers/${id}`);
  return data;
};

/**
 * Create a new transfer number
 * Maximum 10 transfer numbers per tenant
 *
 * @param transferData - Transfer number creation data
 * @returns Promise<TransferNumber>
 *
 * @example
 * // Minimal (required fields only)
 * const transferNumber = await voiceAiApi.createTransferNumber({
 *   label: 'Sales Team',
 *   phone_number: '+13055551234'
 * });
 *
 * @example
 * // Complete
 * const transferNumber = await voiceAiApi.createTransferNumber({
 *   label: 'Sales Team',
 *   phone_number: '+13055551234',
 *   transfer_type: 'primary',
 *   description: 'Main sales line',
 *   is_default: true,
 *   available_hours: '{"mon":[["09:00","17:00"]]}',
 *   display_order: 1
 * });
 */
export const createTransferNumber = async (
  transferData: CreateTransferNumberRequest
): Promise<TransferNumber> => {
  const { data } = await apiClient.post('/voice-ai/transfer-numbers', transferData);
  return data;
};

/**
 * Update a transfer number (partial update)
 *
 * @param id - Transfer number ID (UUID)
 * @param updates - Fields to update
 * @returns Promise<TransferNumber>
 *
 * @example
 * const transferNumber = await voiceAiApi.updateTransferNumber('transfer-id-123', {
 *   is_default: true,
 *   label: 'Updated Sales Team'
 * });
 */
export const updateTransferNumber = async (
  id: string,
  updates: UpdateTransferNumberRequest
): Promise<TransferNumber> => {
  const { data } = await apiClient.patch(`/voice-ai/transfer-numbers/${id}`, updates);
  return data;
};

/**
 * Reorder transfer numbers (bulk update display_order)
 *
 * @param reorderData - Array of {id, display_order} pairs
 * @returns Promise<TransferNumber[]> - Full updated list
 *
 * @example
 * const transferNumbers = await voiceAiApi.reorderTransferNumbers({
 *   items: [
 *     { id: 'id-1', display_order: 0 },
 *     { id: 'id-2', display_order: 1 },
 *     { id: 'id-3', display_order: 2 }
 *   ]
 * });
 */
export const reorderTransferNumbers = async (
  reorderData: ReorderTransferNumbersRequest
): Promise<TransferNumber[]> => {
  const { data } = await apiClient.patch('/voice-ai/transfer-numbers/reorder', reorderData);
  return data;
};

/**
 * Delete a transfer number (soft delete)
 * Sets is_active = false
 *
 * @param id - Transfer number ID (UUID)
 * @returns Promise<void>
 *
 * @example
 * await voiceAiApi.deleteTransferNumber('transfer-id-123');
 */
export const deleteTransferNumber = async (id: string): Promise<void> => {
  await apiClient.delete(`/voice-ai/transfer-numbers/${id}`);
};

// ============================================================================
// Call Logs & Usage (Tenant)
// Base path: /api/v1/voice-ai
// ============================================================================

/**
 * Get paginated call logs for authenticated tenant
 * Supports filtering by date range, outcome, status, and pagination
 *
 * @param filters - Optional query parameters
 * @returns Promise<PaginatedCallLogsResponse>
 *
 * @example
 * // Get all call logs (first page, default limit 20)
 * const result = await voiceAiApi.getTenantCallLogs();
 *
 * @example
 * // Filter by date range and outcome
 * const result = await voiceAiApi.getTenantCallLogs({
 *   from: '2026-02-01',
 *   to: '2026-02-28',
 *   outcome: 'lead_created',
 *   page: 1,
 *   limit: 50
 * });
 */
export const getTenantCallLogs = async (
  filters?: Omit<CallLogFilters, 'tenantId'>
): Promise<PaginatedCallLogsResponse> => {
  const params: Record<string, string> = {};

  if (filters?.from) {
    params.from = filters.from;
  }

  if (filters?.to) {
    params.to = filters.to;
  }

  if (filters?.outcome) {
    params.outcome = filters.outcome;
  }

  if (filters?.status) {
    params.status = filters.status;
  }

  if (filters?.page !== undefined) {
    params.page = filters.page.toString();
  }

  if (filters?.limit !== undefined) {
    params.limit = filters.limit.toString();
  }

  const { data } = await apiClient.get('/voice-ai/call-logs', { params });
  return data;
};

/**
 * Get single call log by ID for authenticated tenant
 * Includes full transcript (populated in detail view)
 *
 * @param id - Call log ID (UUID)
 * @returns Promise<CallLog>
 *
 * @example
 * const callLog = await voiceAiApi.getTenantCallLogById('call-log-id-123');
 * console.log('Full transcript:', callLog.full_transcript);
 */
export const getTenantCallLogById = async (id: string): Promise<CallLog> => {
  const { data } = await apiClient.get(`/voice-ai/call-logs/${id}`);
  return data;
};

/**
 * Get usage summary for authenticated tenant
 * Aggregates STT seconds, LLM tokens, TTS characters, and estimated cost
 *
 * @param year - Year (e.g., 2026), defaults to current year
 * @param month - Month (1-12), defaults to current month
 * @returns Promise<TenantUsageSummaryResponse>
 *
 * @example
 * // Get current month's usage
 * const usage = await voiceAiApi.getTenantUsage();
 *
 * @example
 * // Get specific month's usage
 * const usage = await voiceAiApi.getTenantUsage(2026, 2);
 */
export const getTenantUsage = async (
  year?: number,
  month?: number
): Promise<TenantUsageSummaryResponse> => {
  const params: Record<string, string> = {};

  if (year !== undefined) {
    params.year = year.toString();
  }

  if (month !== undefined) {
    params.month = month.toString();
  }

  const { data } = await apiClient.get('/voice-ai/usage', { params });
  return data;
};

// ============================================================================
// Voice Agent Profiles (Tenant) - Multilingual Feature
// Base path: /api/v1/voice-ai/agent-profiles
// ============================================================================

/**
 * Get all voice agent profiles for authenticated tenant
 * Sorted by display_order ASC, then created_at ASC
 *
 * @param activeOnly - If true, returns only profiles where is_active = true
 * @returns Promise<VoiceAgentProfile[]>
 *
 * @example
 * // Get all profiles
 * const profiles = await voiceAiApi.getAllAgentProfiles();
 *
 * @example
 * // Get only active profiles
 * const activeProfiles = await voiceAiApi.getAllAgentProfiles(true);
 */
export const getAllAgentProfiles = async (
  activeOnly?: boolean
): Promise<VoiceAgentProfile[]> => {
  const params: Record<string, string> = {};

  if (activeOnly !== undefined) {
    params.active_only = activeOnly.toString();
  }

  const { data } = await apiClient.get('/voice-ai/agent-profiles', { params });
  return data;
};

/**
 * Get a single voice agent profile by ID
 *
 * @param id - Profile ID (UUID)
 * @returns Promise<VoiceAgentProfile>
 *
 * @example
 * const profile = await voiceAiApi.getAgentProfileById('profile-id-123');
 */
export const getAgentProfileById = async (id: string): Promise<VoiceAgentProfile> => {
  const { data } = await apiClient.get(`/voice-ai/agent-profiles/${id}`);
  return data;
};

/**
 * Create a new voice agent profile
 * Subject to subscription plan limits (voice_ai_max_agent_profiles)
 *
 * @param profileData - Profile creation data
 * @returns Promise<VoiceAgentProfile>
 *
 * @example
 * // Minimal profile (required fields only)
 * const profile = await voiceAiApi.createAgentProfile({
 *   title: 'English Sales Agent',
 *   language_code: 'en',
 *   voice_id: '694f9389-aac1-45b6-b726-9d9369183238'
 * });
 *
 * @example
 * // Complete profile (all fields)
 * const profile = await voiceAiApi.createAgentProfile({
 *   title: 'Spanish Support',
 *   language_code: 'es',
 *   voice_id: 'a0e99841-438c-4a64-b679-ae501e7d6091',
 *   custom_greeting: '¡Hola! ¿Cómo puedo ayudarle?',
 *   custom_instructions: 'You are speaking with Spanish-speaking customers.',
 *   is_active: true,
 *   display_order: 1
 * });
 *
 * @throws 403 - Plan limit reached or Voice AI not enabled
 * @throws 409 - Duplicate (language_code + title) combination
 */
export const createAgentProfile = async (
  profileData: CreateVoiceAgentProfileRequest
): Promise<VoiceAgentProfile> => {
  const { data } = await apiClient.post('/voice-ai/agent-profiles', profileData);
  return data;
};

/**
 * Update a voice agent profile (partial update)
 * PATCH semantics - only provided fields are updated
 *
 * @param id - Profile ID (UUID)
 * @param updates - Fields to update
 * @returns Promise<VoiceAgentProfile>
 *
 * @example
 * // Update single field
 * const profile = await voiceAiApi.updateAgentProfile('profile-id-123', {
 *   is_active: false
 * });
 *
 * @example
 * // Update multiple fields
 * const profile = await voiceAiApi.updateAgentProfile('profile-id-123', {
 *   title: 'Updated Title',
 *   custom_greeting: 'New greeting message'
 * });
 *
 * @throws 404 - Profile not found or belongs to different tenant
 * @throws 409 - Duplicate after update
 */
export const updateAgentProfile = async (
  id: string,
  updates: UpdateVoiceAgentProfileRequest
): Promise<VoiceAgentProfile> => {
  const { data } = await apiClient.patch(`/voice-ai/agent-profiles/${id}`, updates);
  return data;
};

/**
 * Delete a voice agent profile
 * Hard delete - not allowed if profile is referenced in active IVR configuration
 *
 * @param id - Profile ID (UUID)
 * @returns Promise<void> (204 No Content on success)
 *
 * @example
 * await voiceAiApi.deleteAgentProfile('profile-id-123');
 *
 * @throws 404 - Profile not found
 * @throws 409 - Profile in use by IVR configuration
 */
export const deleteAgentProfile = async (id: string): Promise<void> => {
  await apiClient.delete(`/voice-ai/agent-profiles/${id}`);
};

// ============================================================================
// Export all as voiceAiApi object
// ============================================================================

const voiceAiApi = {
  getAllProviders,
  getProviderById,
  createProvider,
  updateProvider,
  deleteProvider,
  getAllCredentials,
  upsertCredential,
  deleteCredential,
  testCredential,
  getGlobalConfig,
  updateGlobalConfig,
  regenerateAgentKey,
  getAllPlans,
  updatePlanVoiceConfig,
  getAllTenants,
  getTenantOverride,
  updateTenantOverride,
  getTenantAgentProfiles,
  getAgentStatus,
  getActiveRooms,
  forceEndCall,
  getCallLogs,
  getUsageReport,
  getTenantSettings,
  updateTenantSettings,
  getAllTransferNumbers,
  getTransferNumberById,
  createTransferNumber,
  updateTransferNumber,
  reorderTransferNumbers,
  deleteTransferNumber,
  getTenantCallLogs,
  getTenantCallLogById,
  getTenantUsage,
  getAllAgentProfiles,
  getAgentProfileById,
  createAgentProfile,
  updateAgentProfile,
  deleteAgentProfile,
};

export default voiceAiApi;
