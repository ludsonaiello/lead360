/**
 * Type definitions for API responses
 * These mirror the DTOs/interfaces from the NestJS side
 */

// Tenant lookup response
export interface LookupTenantResponse {
  found: boolean;
  tenant_id?: string;
  tenant_name?: string;
  phone_number?: string;
  error?: string;
}

// Access check response
export interface AccessCheckResponse {
  has_access: boolean;
  reason?: 'tenant_not_found' | 'not_enabled' | 'quota_exceeded';
  minutes_remaining?: number;
  overage_rate?: number | null;
}

// Start call response
export interface StartCallResponse {
  call_log_id: string;
}

// Complete call response (usually empty success)
export interface CompleteCallResponse {
  success?: boolean;
}

// Context response (full VoiceAiContext)
export interface VoiceAiContext {
  call_sid: string | null;
  tenant: {
    id: string;
    company_name: string;
    phone: string | null;
    timezone: string;
    language: string | null;
    business_description: string | null;
    email?: string | null;
    primary_address?: {
      street: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
    } | null;
  };

  // Sprint 4: Lead context for personalized greeting (agent_sprint_fixes_feb27_4)
  lead?: {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    email: string | null;
    phone_number: string;
    status: string;
    last_contact_date: Date | null;
    total_contacts: number;
    notes: string | null;
  } | null;

  quota: {
    minutes_included: number;
    minutes_used: number;
    minutes_remaining: number;
    overage_rate: number | null;
    quota_exceeded: boolean;
  };
  behavior: {
    is_enabled: boolean;
    language: string;
    enabled_languages: string[];
    greeting: string;
    system_prompt: string;
    custom_instructions: string | null;
    booking_enabled: boolean;
    lead_creation_enabled: boolean;
    transfer_enabled: boolean;
    max_call_duration_seconds: number;
  };
  providers: {
    stt: ProviderConfig | null;
    llm: ProviderConfig | null;
    tts: (ProviderConfig & { voice_id: string | null }) | null;
  };
  services: Array<{ name: string; description: string | null }>;
  service_areas: Array<{ type: string; value: string; state: string | null }>;
  business_hours: Array<{
    day: string;
    is_closed: boolean;
    shifts: Array<{ open: string; close: string }>;
  }>;
  industries: Array<{ name: string; description: string | null }>;
  transfer_numbers: Array<{
    id: string;
    label: string;
    phone_number: string;
    transfer_type: string;
    is_default: boolean;
    available_hours: string | null;
  }>;
}

interface ProviderConfig {
  provider_id: string;
  provider_key: string;
  api_key: string;
  config: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Tool response types — Sprint VAB-05
// ---------------------------------------------------------------------------

// Create Lead tool response
export interface CreateLeadResult {
  success: boolean;
  lead_id?: string;
  message?: string;
  error?: string;
}

// Find Lead tool response
export interface FindLeadResult {
  success: boolean;
  found: boolean;
  lead_id?: string;
  lead_name?: string;
  error?: string;
}

// Check Service Area tool response
export interface CheckServiceAreaResult {
  success: boolean;
  in_service_area: boolean;
  message?: string;
  error?: string;
}

// Transfer Call tool response
export interface TransferCallResult {
  success: boolean;
  transfer_to?: string;
  label?: string;
  reason?: string;
  action?: string;  // 'TRANSFER'
  error?: string;
}

// ---------------------------------------------------------------------------
// Sprint 4 — Lead Context for First Interaction (agent_sprint_fixes_feb27_4)
// ---------------------------------------------------------------------------

// Find Lead by Phone response (for call context before first LLM interaction)
export interface FindLeadByPhoneResponse {
  found: boolean;
  lead?: {
    id: string;
    first_name: string;
    last_name: string;
    full_name: string;
    email: string | null;
    phone_number: string;
    status: string;
    last_contact_date: Date | null;
    total_contacts: number;
    notes: string | null;
  } | null;
}
