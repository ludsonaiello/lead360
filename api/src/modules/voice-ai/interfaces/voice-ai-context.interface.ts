/**
 * Active agent profile metadata included in context when a profile is resolved.
 * Used by the agent worker for call logs and debug traces.
 * Sprint: Voice Multilingual - Sprint 7 (Context Builder)
 * Sprint 18: Added is_override flag to track tenant customization status
 */
export interface ActiveAgentProfile {
  id: string;
  title: string;
  language_code: string;
  is_override: boolean; // Sprint 18: True if tenant has custom greeting/instructions
}

/**
 * Full merged context returned to the Python voice agent.
 *
 * Contains all data the agent needs for a single tenant:
 * - Call identification (call_sid)
 * - Tenant identity (company name, phone, timezone, business description, hours, industries)
 * - Monthly usage quota
 * - Behavior configuration (greeting, system_prompt, features, duration limit)
 * - Decrypted provider credentials (STT, LLM, TTS)
 * - Services the business offers
 * - Geographic service areas
 * - Business hours (daily open/close times)
 * - Industries the business operates in
 * - Transfer numbers (ordered by display_order ASC)
 * - Active agent profile (when language/voice resolved from profile)
 *
 * SECURITY: api_key fields contain DECRYPTED credentials.
 *   This object must NEVER be cached or logged.
 *   It is used exclusively for the internal agent endpoint (Sprint B06a).
 */
export interface VoiceAiContext {
  call_sid: string | null;
  tenant: {
    id: string;
    company_name: string;
    phone: string | null;
    timezone: string;
    language: string | null;
    business_description: string | null;
    email: string | null;
    primary_address: {
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
    tool_instructions?: Record<string, string> | null;
  };
  providers: {
    /** provider_id: UUID of voice_ai_provider row — used by Python agent for usage tracking */
    stt: {
      provider_id: string;
      provider_key: string;
      api_key: string;
      config: Record<string, unknown>;
    } | null;
    llm: {
      provider_id: string;
      provider_key: string;
      api_key: string;
      config: Record<string, unknown>;
    } | null;
    tts: {
      provider_id: string;
      provider_key: string;
      api_key: string;
      config: Record<string, unknown>;
      voice_id: string | null;
    } | null;
  };
  services: Array<{ id: string; name: string; description: string | null }>;
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
  conversational_phrases: {
    recovery_messages: string[]; // When STT fails / empty input
    filler_phrases: string[]; // Before tool execution
    long_wait_messages: string[]; // During long tool execution (>20s)
    system_error_messages: string[]; // Generic system errors
  };

  /**
   * Active agent profile metadata (Sprint 7: Voice Multilingual)
   * Populated when language/voice is resolved from a voice agent profile.
   * Null when using fallback behavior (no profile resolved).
   */
  active_agent_profile?: ActiveAgentProfile | null;
}
