/**
 * Voice AI Admin TypeScript Types
 * Sprint FSA06 — Foundation
 * Note: config_schema, capabilities, default_config, pricing_info are JSON strings, NOT parsed objects.
 */

// ============================================
// Providers
// ============================================

export interface VoiceAiProvider {
  id: string;
  provider_key: string;
  provider_type: 'STT' | 'LLM' | 'TTS';
  display_name: string;
  description: string | null;
  logo_url: string | null;
  documentation_url: string | null;
  /** JSON array string, e.g. '["streaming","multilingual"]' */
  capabilities: string | null;
  /** JSON Schema string that drives the dynamic config form */
  config_schema: string | null;
  /** JSON object string with default values matching config_schema */
  default_config: string | null;
  /** JSON object string with pricing metadata */
  pricing_info: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** USD cost per 1 usage unit — e.g. "0.0000716" for Deepgram per second. API returns Decimal as string. */
  cost_per_unit: string | number | null;
  /** Billing unit matching usage records: 'per_second' | 'per_token' | 'per_character' */
  cost_unit: 'per_second' | 'per_token' | 'per_character' | null;
}

export interface CreateProviderRequest {
  provider_key: string;
  provider_type: 'STT' | 'LLM' | 'TTS';
  display_name: string;
  description?: string;
  logo_url?: string;
  documentation_url?: string;
  /** JSON array string */
  capabilities?: string;
  /** JSON Schema string */
  config_schema?: string;
  /** JSON object string */
  default_config?: string;
  /** JSON object string */
  pricing_info?: string;
  is_active?: boolean;
  /** USD cost per 1 usage unit */
  cost_per_unit?: number;
  /** Billing unit: 'per_second' | 'per_token' | 'per_character' */
  cost_unit?: 'per_second' | 'per_token' | 'per_character';
}

// ============================================
// Credentials
// ============================================

export interface VoiceAiCredential {
  id: string;
  provider_id: string;
  provider_key: string;
  masked_key: string;
  updated_by: string | null;
  updated_at: string;
}

// ============================================
// Global Config
// ============================================

export interface VoiceAiGlobalConfig {
  id: string;
  default_stt_provider_id: string | null;
  default_llm_provider_id: string | null;
  default_tts_provider_id: string | null;
  default_voice_id: string | null;
  /** JSON string of provider-specific STT config, e.g. '{"model":"nova-2"}' or null */
  default_stt_config: string | null;
  /** JSON string of provider-specific LLM config, e.g. '{"model":"gpt-4o-mini","temperature":0.7}' or null */
  default_llm_config: string | null;
  /** JSON string of provider-specific TTS config, e.g. '{"model":"sonic-english","speed":1.0}' or null */
  default_tts_config: string | null;
  default_language: string;
  /** JSON string of supported BCP-47 codes, e.g. '["en","es"]' */
  default_languages: string;
  default_greeting_template: string;
  default_system_prompt: string;
  default_max_call_duration_seconds: number;
  default_transfer_behavior: 'end_call' | 'voicemail' | 'hold';
  /** JSON string of enabled tools, e.g. '{"booking":true,"lead_creation":true,"call_transfer":true}' */
  default_tools_enabled: string;
  livekit_sip_trunk_url: string | null;
  /** true if LiveKit API key is set */
  livekit_api_key_set: boolean;
  /** true if LiveKit API secret is set */
  livekit_api_secret_set: boolean;
  /** Last 4 chars of agent API key, e.g. "...7a53" */
  agent_api_key_preview: string | null;
  max_concurrent_calls: number;
  updated_by: string | null;
  updated_at: string;
}

export interface UpdateGlobalConfigRequest {
  default_stt_provider_id?: string;
  default_llm_provider_id?: string;
  default_tts_provider_id?: string;
  default_voice_id?: string;
  default_language?: string;
  default_greeting_template?: string;
  default_system_prompt?: string;
  default_max_call_duration_seconds?: number;
  livekit_sip_trunk_url?: string;
  livekit_api_key?: string;
  livekit_api_secret?: string;
  max_concurrent_calls?: number;
  /** JSON string, e.g. '{"model":"nova-2"}' */
  default_stt_config?: string;
  /** JSON string, e.g. '{"model":"gpt-4o-mini","temperature":0.7}' */
  default_llm_config?: string;
  /** JSON string, e.g. '{"model":"sonic-english","speed":1.0}' */
  default_tts_config?: string;
  /** JSON string, e.g. '["en","es","pt"]' */
  default_languages?: string;
  default_transfer_behavior?: 'end_call' | 'voicemail' | 'hold';
  /** JSON string, e.g. '{"booking":true,"lead_creation":true,"call_transfer":true}' */
  default_tools_enabled?: string;
}

// ============================================
// Subscription Plans
// ============================================

export interface PlanWithVoiceConfig {
  id: string;
  name: string;
  description?: string | null;
  /** API returns as string (e.g. "180") or number */
  monthly_price: string | number;
  annual_price?: string | number | null;
  is_active?: boolean;
  voice_ai_enabled: boolean;
  voice_ai_minutes_included: number;
  voice_ai_overage_rate: number | null;
}

// ============================================
// Tenant Overview (Monitoring)
// ============================================

export interface TenantVoiceAiOverview {
  tenant_id: string;
  company_name: string;
  plan_name: string;
  voice_ai_included_in_plan: boolean;
  is_enabled: boolean;
  minutes_included: number;
  minutes_used: number;
  /** Not returned by real API — may be absent */
  total_calls?: number;
  has_admin_override: boolean;
}

// ============================================
// Admin Override
// ============================================

export interface AdminOverrideRequest {
  force_enabled?: boolean | null;
  monthly_minutes_override?: number | null;
  stt_provider_override_id?: string | null;
  llm_provider_override_id?: string | null;
  tts_provider_override_id?: string | null;
  admin_notes?: string | null;
}

// ============================================
// Call Logs
// ============================================

export interface VoiceCallLog {
  id: string;
  tenant_id: string;
  call_sid: string;
  from_number: string;
  to_number: string;
  direction: string;
  status: string;
  is_overage: boolean;
  duration_seconds: number | null;
  transcript_summary: string | null;
  /** Full transcript text — load lazily in detail view */
  full_transcript: string | null;
  /** JSON array of action names, e.g. '["create_lead","book_appointment"]' */
  actions_taken: string | null;
  outcome: string | null;
  lead_id: string | null;
  stt_provider_id: string | null;
  llm_provider_id: string | null;
  tts_provider_id: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

// ============================================
// Usage Report
// ============================================

export interface AdminUsageReport {
  year: number;
  month: number;
  total_calls: number;
  /** Total STT seconds processed across all tenants */
  total_stt_seconds: number;
  /** Total estimated USD cost across all tenants */
  total_estimated_cost: number;
  by_tenant: Array<{
    tenant_id: string;
    /** Tenant business name — API may return tenant_name or company_name */
    tenant_name?: string;
    company_name?: string;
    total_calls: number;
    total_stt_seconds: number;
    estimated_cost: number;
  }>;
}

// ============================================
// Pagination
// ============================================

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  /** Real API returns total_pages (snake_case) */
  total_pages: number;
  /** Alias kept for compatibility with any camelCase consumers */
  totalPages?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
