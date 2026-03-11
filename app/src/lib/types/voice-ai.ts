// ============================================================================
// Voice AI Type Definitions
// ============================================================================
// TypeScript types for Voice AI provider management system
// Matches backend schema from api/prisma/schema.prisma (voice_ai_provider model)
// ============================================================================

/**
 * Provider Types
 */
export type ProviderType = 'STT' | 'LLM' | 'TTS';

/**
 * Voice AI Provider
 * Complete provider object from backend
 */
export interface VoiceAIProvider {
  id: string;
  provider_key: string;
  provider_type: ProviderType;
  display_name: string;
  description: string | null;
  logo_url: string | null;
  documentation_url: string | null;
  capabilities: string | null; // JSON array as string
  config_schema: string | null; // JSON Schema as string
  default_config: string | null; // JSON object as string
  pricing_info: string | null; // JSON object as string
  is_active: boolean;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

/**
 * Create Provider Request
 * Data for creating a new provider
 */
export interface CreateProviderRequest {
  provider_key: string;
  provider_type: ProviderType;
  display_name: string;
  description?: string | null;
  logo_url?: string | null;
  documentation_url?: string | null;
  capabilities?: string | null;
  config_schema?: string | null;
  default_config?: string | null;
  pricing_info?: string | null;
  is_active?: boolean;
}

/**
 * Update Provider Request
 * Data for updating an existing provider (partial)
 */
export interface UpdateProviderRequest {
  provider_key?: string;
  provider_type?: ProviderType;
  display_name?: string;
  description?: string | null;
  logo_url?: string | null;
  documentation_url?: string | null;
  capabilities?: string | null;
  config_schema?: string | null;
  default_config?: string | null;
  pricing_info?: string | null;
  is_active?: boolean;
}

/**
 * Provider Filter Parameters
 * Query parameters for filtering providers
 */
export interface ProviderFilters {
  provider_type?: ProviderType;
  is_active?: boolean;
}

/**
 * Provider Form Data
 * Form state for create/edit provider
 */
export interface ProviderFormData {
  provider_key: string;
  provider_type: ProviderType;
  display_name: string;
  description: string;
  logo_url: string;
  documentation_url: string;
  capabilities: string;
  config_schema: string;
  default_config: string;
  pricing_info: string;
  is_active: boolean;
}

// ============================================================================
// Credential Management Types
// ============================================================================

/**
 * Voice AI Credential
 * Encrypted credential for a provider (masked key only)
 */
export interface VoiceAICredential {
  id: string;
  provider_id: string;
  masked_api_key: string; // Display only (e.g., "sk-p...xyz")
  additional_config: string | null; // JSON object as string
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
  updated_by: string; // User ID who last updated
}

/**
 * Upsert Credential Request
 * Data for creating/updating a credential
 */
export interface UpsertCredentialRequest {
  api_key: string; // Plain-text API key (will be encrypted before storage)
  additional_config?: string | null; // JSON object as string
}

/**
 * Test Connection Response
 * Result of testing a credential
 */
export interface TestConnectionResponse {
  success: boolean;
  message: string;
}

/**
 * Provider with Credential Status
 * Provider merged with credential information
 */
export interface ProviderWithCredential extends VoiceAIProvider {
  has_credential: boolean;
  credential_id: string | null;
  credential_masked_key: string | null;
}

// ============================================================================
// Global Configuration Types
// ============================================================================

/**
 * Provider Reference (nested in Global Config)
 */
export interface ProviderReference {
  id: string;
  provider_key: string;
  provider_type: ProviderType;
  display_name: string;
}

/**
 * Global Voice AI Configuration
 * Singleton configuration for the entire platform
 */
export interface GlobalConfig {
  id: 'default';
  agent_enabled: boolean;
  default_stt_provider: ProviderReference | null;
  default_llm_provider: ProviderReference | null;
  default_tts_provider: ProviderReference | null;
  default_stt_config: string | null; // JSON string
  default_llm_config: string | null; // JSON string
  default_tts_config: string | null; // JSON string
  default_voice_id: string;
  default_language: string;
  default_languages: string; // JSON array string
  default_greeting_template: string;
  default_system_prompt: string;
  default_max_call_duration_seconds: number;
  default_transfer_behavior: string;
  default_tools_enabled: string; // JSON object string
  livekit_url: string;
  livekit_sip_trunk_url: string | null;
  livekit_api_key_set: boolean;
  livekit_api_secret_set: boolean;
  agent_api_key_preview: string;
  max_concurrent_calls: number;
  // Sprint Voice-UX-01: Conversational phrases (2026-02-27)
  recovery_messages?: string[] | null;
  filler_phrases?: string[] | null;
  long_wait_messages?: string[] | null;
  system_error_messages?: string[] | null;
  // Sprint Tool-Audit: Per-tool instruction overrides
  tool_instructions?: string | null; // JSON string
  updated_at: string; // ISO date string
  updated_by: string; // User ID
}

/**
 * Update Global Config Request
 * Partial update - only provided fields are modified
 */
export interface UpdateGlobalConfigRequest {
  agent_enabled?: boolean;
  default_stt_provider_id?: string | null;
  default_llm_provider_id?: string | null;
  default_tts_provider_id?: string | null;
  default_voice_id?: string | null;
  default_language?: string | null;
  default_languages?: string | null; // JSON array as string
  default_greeting_template?: string | null;
  default_system_prompt?: string | null;
  default_max_call_duration_seconds?: number | null;
  default_transfer_behavior?: string | null;
  default_tools_enabled?: string | null; // JSON object as string
  default_stt_config?: string | null; // JSON object as string
  default_llm_config?: string | null; // JSON object as string
  default_tts_config?: string | null; // JSON object as string
  livekit_url?: string | null;
  livekit_sip_trunk_url?: string | null;
  livekit_api_key?: string | null;
  livekit_api_secret?: string | null;
  max_concurrent_calls?: number | null;
  // Sprint Voice-UX-01: Conversational phrases (2026-02-27)
  recovery_messages?: string[] | null;
  filler_phrases?: string[] | null;
  long_wait_messages?: string[] | null;
  system_error_messages?: string[] | null;
  // Sprint Tool-Audit: Per-tool instruction overrides
  tool_instructions?: string | null;
}

/**
 * Regenerate Agent API Key Response
 */
export interface RegenerateKeyResponse {
  plain_key: string;
  preview: string;
  warning: string;
}

// ============================================================================
// Plan Configuration Types
// ============================================================================

/**
 * Subscription Plan with Voice AI Configuration
 * Used for platform-wide plan configuration
 */
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: string; // Decimal serialized as string
  annual_price: string; // Decimal serialized as string
  is_active: boolean;
  voice_ai_enabled: boolean;
  voice_ai_minutes_included: number;
  voice_ai_overage_rate: string | null; // Decimal serialized as string, null = block calls
  voice_ai_max_agent_profiles: number; // Sprint 12: Max active profiles per tenant (multilingual)
}

/**
 * Update Plan Voice Config Request
 * Partial update - only provided fields are modified
 */
export interface UpdatePlanVoiceConfigRequest {
  voice_ai_enabled?: boolean;
  voice_ai_minutes_included?: number;
  voice_ai_overage_rate?: number | null;
  voice_ai_max_agent_profiles?: number; // Sprint 12: Max active profiles (1-50)
}

// ============================================================================
// Tenant Management Types (Admin Only)
// ============================================================================

/**
 * Tenant Voice AI Summary
 * Summary of a tenant's Voice AI usage and configuration
 */
export interface TenantVoiceAISummary {
  tenant_id: string;
  company_name: string;
  plan_name: string;
  voice_ai_included_in_plan: boolean;
  is_enabled: boolean;
  minutes_included: number;
  minutes_used: number;
  has_admin_override: boolean;
}

/**
 * Tenant Override DTO
 * Admin overrides for a tenant's Voice AI settings
 * Nullable semantics: null = remove override, undefined = leave unchanged
 */
export interface TenantOverrideDto {
  force_enabled?: boolean | null;
  monthly_minutes_override?: number | null;
  stt_provider_override_id?: string | null;
  llm_provider_override_id?: string | null;
  tts_provider_override_id?: string | null;
  admin_notes?: string | null;
  default_agent_profile_id?: string | null; // Sprint 12: Default profile for tenant (multilingual)
}

/**
 * Paginated Tenant List Response
 */
export interface PaginatedTenantsResponse {
  data: TenantVoiceAISummary[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

/**
 * Tenant Filter Parameters
 * Query parameters for filtering tenants
 */
export interface TenantFilters {
  page?: number;
  limit?: number;
  search?: string;
}

// ============================================================================
// Monitoring Types (Platform Admin Only)
// ============================================================================

/**
 * Agent Status
 * Real-time status and metrics of the Voice AI agent
 */
export interface AgentStatus {
  is_running: boolean;
  agent_enabled: boolean;
  livekit_connected: boolean;
  active_calls: number;
  today_calls: number;
  this_month_calls: number;
}

/**
 * Active Room (Call)
 * Represents an in-progress Voice AI call
 */
export interface ActiveRoom {
  id: string;
  tenant_id: string;
  company_name: string;
  call_sid: string;
  room_name: string | null;
  from_number: string;
  to_number: string;
  direction: 'inbound' | 'outbound';
  duration_seconds: number;
  started_at: string; // ISO date string
}

/**
 * Log Entry
 * SSE log entry from agent
 */
export interface LogEntry {
  timestamp: string; // ISO date string
  level: 'info' | 'error' | 'debug' | 'warn';
  message: string;
  data?: Record<string, any>;
}

// ============================================================================
// Tenant Settings (Tenant Users)
// ============================================================================

/**
 * Tenant Voice AI Settings
 * Voice AI behavior settings for a tenant
 */
export interface TenantVoiceAISettings {
  id: string;
  tenant_id: string;
  is_enabled: boolean;
  default_language: string;
  enabled_languages: string; // JSON array as string (e.g., "[\"en\",\"es\"]")
  custom_greeting: string | null;
  custom_instructions: string | null;
  after_hours_behavior: string | null;
  booking_enabled: boolean;
  lead_creation_enabled: boolean;
  transfer_enabled: boolean;
  default_transfer_number: string | null;
  default_transfer_number_id: string | null;
  max_call_duration_seconds: number | null;
  // Per-tool instruction overrides
  tool_instructions: string | null; // JSON string
  // Admin-set fields (view-only for tenants)
  monthly_minutes_override: number | null;
  admin_notes: string | null;
  stt_provider_override_id: string | null;
  llm_provider_override_id: string | null;
  tts_provider_override_id: string | null;
  stt_config_override: string | null;
  llm_config_override: string | null;
  tts_config_override: string | null;
  voice_id_override: string | null;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
  updated_by: string | null;
}

/**
 * Update Tenant Settings Request
 * Data for updating tenant Voice AI settings (all fields optional)
 * Note: enabled_languages is sent as an actual array, not JSON string
 */
export interface UpdateTenantSettingsRequest {
  is_enabled?: boolean;
  enabled_languages?: string[]; // Array of ISO 639-1 language codes
  custom_greeting?: string | null;
  custom_instructions?: string | null;
  booking_enabled?: boolean;
  lead_creation_enabled?: boolean;
  transfer_enabled?: boolean;
  default_transfer_number?: string | null;
  max_call_duration_seconds?: number | null;
}

/**
 * Language option for language selector
 */
export interface LanguageOption {
  code: string;
  name: string;
}

// ============================================================================
// Call Logs & Usage Reports (Platform Admin Only)
// ============================================================================

/**
 * Call Log
 * Complete call log record from backend
 */
export interface CallLog {
  id: string;
  tenant_id: string;
  call_sid: string;
  from_number: string;
  to_number: string;
  direction: 'inbound' | 'outbound';
  status: 'completed' | 'failed' | 'in_progress' | 'transferred';
  outcome: 'lead_created' | 'transferred' | 'abandoned' | 'completed' | null;
  is_overage: boolean;
  duration_seconds: number;
  transcript_summary: string | null;
  full_transcript: string | null;
  actions_taken: string | null;
  lead_id: string | null;
  stt_provider_id: string | null;
  llm_provider_id: string | null;
  tts_provider_id: string | null;
  started_at: string; // ISO date string
  ended_at: string | null; // ISO date string
  created_at: string; // ISO date string
}

/**
 * Call Log Filters
 * Query parameters for filtering call logs
 */
export interface CallLogFilters {
  tenantId?: string;
  from?: string; // ISO 8601 date
  to?: string; // ISO 8601 date
  outcome?: 'lead_created' | 'transferred' | 'abandoned' | 'completed';
  status?: 'completed' | 'failed' | 'in_progress' | 'transferred';
  page?: number;
  limit?: number;
}

/**
 * Paginated Call Logs Response
 */
export interface PaginatedCallLogsResponse {
  data: CallLog[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

/**
 * Tenant Usage Summary
 * Per-tenant usage breakdown in usage report
 */
export interface TenantUsageSummary {
  tenant_id: string;
  tenant_name: string;
  total_calls: number;
  total_stt_seconds: number;
  estimated_cost: number;
}

/**
 * Usage Report
 * Platform-wide usage aggregate for a specific month
 */
export interface UsageReport {
  year: number;
  month: number;
  total_calls: number;
  total_stt_seconds: number;
  total_estimated_cost: number;
  by_tenant: TenantUsageSummary[];
}

/**
 * Provider Usage Breakdown
 * Per-provider usage breakdown in tenant usage summary
 */
export interface ProviderUsageBreakdown {
  provider_id: string;
  provider_key: string;
  provider_type: 'STT' | 'LLM' | 'TTS';
  total_seconds?: number;      // For STT
  total_tokens?: number;        // For LLM
  total_characters?: number;    // For TTS
  estimated_cost: number;
}

/**
 * Tenant Usage Summary Response
 * Monthly usage summary for a specific tenant
 */
export interface TenantUsageSummaryResponse {
  year: number;
  month: number;
  total_calls: number;
  total_stt_seconds: number;
  total_llm_tokens: number;
  total_tts_characters: number;
  estimated_cost: number;
  by_provider: ProviderUsageBreakdown[];
}

// ============================================================================
// Transfer Numbers (Tenant)
// ============================================================================

/**
 * Transfer Types
 */
export type TransferType = 'primary' | 'overflow' | 'after_hours' | 'emergency';

/**
 * Transfer Number
 * Call transfer destination for tenant's Voice AI calls
 */
export interface TransferNumber {
  id: string;
  tenant_id: string;
  label: string;
  phone_number: string; // E.164 format
  transfer_type: TransferType;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  display_order: number;
  available_hours: string | null; // JSON object as string
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

/**
 * Create Transfer Number Request
 */
export interface CreateTransferNumberRequest {
  label: string;
  phone_number: string; // E.164 format
  transfer_type?: TransferType;
  description?: string | null;
  is_default?: boolean;
  available_hours?: string | null; // JSON string
  display_order?: number;
}

/**
 * Update Transfer Number Request (partial)
 */
export interface UpdateTransferNumberRequest {
  label?: string;
  phone_number?: string; // E.164 format
  transfer_type?: TransferType;
  description?: string | null;
  is_default?: boolean;
  available_hours?: string | null; // JSON string
  display_order?: number;
}

/**
 * Reorder Transfer Numbers Request
 */
export interface ReorderTransferNumbersRequest {
  items: Array<{
    id: string;
    display_order: number;
  }>;
}

/**
 * Transfer Number Form Data
 * Form state for create/edit transfer number
 */
export interface TransferNumberFormData {
  label: string;
  phone_number: string;
  transfer_type: TransferType;
  description: string;
  is_default: boolean;
  available_hours: string;
  display_order: number;
}

// ============================================================================
// Voice Agent Profiles (Tenant - Multilingual Feature)
// Base path: /api/v1/voice-ai/agent-profiles
// ============================================================================

/**
 * Voice Agent Profile
 * Named configuration binding language + voice + custom greeting/instructions
 * Matches backend API from api/documentation/voice_agent_profiles_REST_API.md
 */
export interface VoiceAgentProfile {
  id: string;
  tenant_id: string;
  title: string;
  language_code: string;
  voice_id: string;
  custom_greeting: string | null;
  custom_instructions: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
  updated_by: string | null;
}

/**
 * Create Voice Agent Profile Request
 * Data for creating a new profile
 */
export interface CreateVoiceAgentProfileRequest {
  title: string;
  language_code: string;
  voice_id: string;
  custom_greeting?: string;
  custom_instructions?: string;
  is_active?: boolean;
  display_order?: number;
}

/**
 * Update Voice Agent Profile Request (partial)
 * PATCH semantics - only provided fields are updated
 */
export interface UpdateVoiceAgentProfileRequest {
  title?: string;
  language_code?: string;
  voice_id?: string;
  custom_greeting?: string | null;
  custom_instructions?: string | null;
  is_active?: boolean;
  display_order?: number;
}

/**
 * Voice Agent Profile Form Data
 * Form state for create/edit profile
 */
export interface VoiceAgentProfileFormData {
  title: string;
  language_code: string;
  voice_id: string;
  custom_greeting: string;
  custom_instructions: string;
  is_active: boolean;
  display_order: number;
}

// ============================================================================
// Global Agent Profiles (Platform Admin - Multilingual v2)
// Base path: /api/v1/system/voice-ai/agent-profiles
// ============================================================================

/**
 * Global Agent Profile
 * Platform-wide language/voice template managed by admins
 * Matches backend API from api/documentation/voice_agent_profiles_REST_API.md
 */
export interface GlobalAgentProfile {
  id: string;
  language_code: string;
  language_name: string;
  voice_id: string;
  voice_provider_type: string;
  display_name: string;
  description?: string;
  default_greeting?: string;
  default_instructions?: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  updated_by?: string;
  _count?: {
    tenant_overrides: number;
  };
}

/**
 * Create Global Profile Request
 * Data for creating a new global profile
 */
export interface CreateGlobalProfileDto {
  language_code: string;
  language_name: string;
  voice_id: string;
  voice_provider_type?: string;
  display_name: string;
  description?: string;
  default_greeting?: string;
  default_instructions?: string;
  is_active?: boolean;
  display_order?: number;
}

/**
 * Update Global Profile Request (partial)
 * PATCH semantics - only provided fields are updated
 */
export interface UpdateGlobalProfileDto extends Partial<CreateGlobalProfileDto> {}

/**
 * Global Profile Form Data
 * Form state for create/edit global profile
 */
export interface GlobalProfileFormData {
  language_code: string;
  language_name: string;
  voice_id: string;
  voice_provider_type: string;
  display_name: string;
  description: string;
  default_greeting: string;
  default_instructions: string;
  is_active: boolean;
  display_order: number;
}
