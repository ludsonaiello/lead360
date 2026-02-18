YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint FSA06 — Admin API Client + Types

**Module**: Voice AI - Frontend Admin  
**Sprint**: FSA06  
**Depends on**: B12 (REST API documentation complete)  
**Do this FIRST — all other admin sprints depend on these files**

---

## Objective

Create the TypeScript API client and type definitions for the Voice AI admin endpoints. These files must exist before any admin UI pages are built.

---

## Mandatory Pre-Coding Steps

1. Read `/api/documentation/voice_ai_REST_API.md` completely
2. **HIT THE ACTUAL ENDPOINTS** at `http://localhost:8000/api/v1` — verify real response shapes before writing types
3. Read `/app/src/lib/api/twilio-admin.ts` — replicate this pattern exactly
4. Read `/app/src/lib/types/twilio-admin.ts` — use same type structure

**DO NOT USE PM2** — Frontend: `cd /var/www/lead360.app/app && npm run dev` (port 7000)  
Backend: `cd /var/www/lead360.app/api && npm run dev` (port 8000)

---

## Credentials

- Admin login: `ludsonaiello@gmail.com` / `978@F32c`  
- Tenant login: `contato@honeydo4you.com` / `978@F32c`  
- DB credentials: in `/var/www/lead360.app/api/.env`

---

## Task 1: Types File

Create `/app/src/lib/types/voice-ai-admin.ts`:

```typescript
// Providers
export interface VoiceAiProvider {
  id: string;
  provider_key: string;
  provider_type: 'STT' | 'LLM' | 'TTS';
  display_name: string;
  description: string | null;
  config_schema: Record<string, any>;  // JSON schema for provider config fields — used in FSA03 to render dynamic config form
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProviderRequest {
  provider_key: string;
  provider_type: 'STT' | 'LLM' | 'TTS';
  display_name: string;
  description?: string;
  is_active?: boolean;
}

// Credentials
export interface VoiceAiCredential {
  provider_id: string;
  masked_api_key: string;
  is_configured: boolean;
  updated_by: string | null;
  updated_at: string;
}

// Global Config
export interface VoiceAiGlobalConfig {
  id: string;
  default_stt_provider_id: string | null;
  default_llm_provider_id: string | null;
  default_tts_provider_id: string | null;
  default_voice_id: string | null;
  default_stt_config: Record<string, any> | null;   // provider-specific config (e.g. { model: 'nova-2' })
  default_llm_config: Record<string, any> | null;   // provider-specific config (e.g. { model: 'gpt-4o-mini', temperature: 0.7 })
  default_tts_config: Record<string, any> | null;   // provider-specific config (e.g. { model: 'sonic-english', speed: 1.0 })
  default_language: string;
  default_languages: string[];                       // list of supported BCP-47 codes
  default_greeting_template: string;
  default_system_prompt: string;
  default_max_call_duration_seconds: number;
  default_transfer_behavior: 'end_call' | 'voicemail' | 'hold';
  default_tools_enabled: { booking: boolean; lead_creation: boolean; call_transfer: boolean };
  livekit_sip_trunk_url: string | null;
  livekit_configured: boolean;  // true if livekit keys are set (masked)
  agent_api_key_preview: string | null;  // last 4 chars
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
  default_stt_config?: Record<string, any>;
  default_llm_config?: Record<string, any>;
  default_tts_config?: Record<string, any>;
  default_languages?: string[];
  default_transfer_behavior?: 'end_call' | 'voicemail' | 'hold';
  default_tools_enabled?: { booking: boolean; lead_creation: boolean; call_transfer: boolean };
}

// Plans
export interface PlanWithVoiceConfig {
  id: string;
  name: string;
  monthly_price: number;
  voice_ai_enabled: boolean;
  voice_ai_minutes_included: number;
  voice_ai_overage_rate: number | null;
}

// Tenant Overview
export interface TenantVoiceAiOverview {
  tenant_id: string;
  company_name: string;
  plan_name: string;
  voice_ai_included_in_plan: boolean;
  is_enabled: boolean;
  minutes_included: number;
  minutes_used: number;
  total_calls: number;
  has_admin_override: boolean;
}

// Admin Override
export interface AdminOverrideRequest {
  force_enabled?: boolean | null;
  monthly_minutes_override?: number | null;
  stt_provider_override_id?: string | null;
  llm_provider_override_id?: string | null;
  tts_provider_override_id?: string | null;
  admin_notes?: string | null;
}

// Call Logs
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
  full_transcript: string | null;       // full text (may be large — load lazily in detail view)
  actions_taken: string | null;         // JSON array of action names, e.g. '["create_lead","book_appointment"]'
  outcome: string | null;
  lead_id: string | null;
  stt_provider_id: string | null;
  llm_provider_id: string | null;
  tts_provider_id: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

// Usage Report
export interface AdminUsageReport {
  year: number;
  month: number;
  total_calls: number;
  total_minutes: number;
  total_overage_minutes: number;
  estimated_total_cost: number;
  by_tenant: Array<{
    tenant_id: string;
    company_name: string;
    minutes_used: number;
    overage_minutes: number;
    total_calls: number;
    estimated_cost: number;
  }>;
}

// Pagination
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}
```

---

## Task 2: API Client File

Create `/app/src/lib/api/voice-ai-admin.ts`:

Follow the exact pattern from `twilio-admin.ts` — import `apiClient`, typed functions, JSDoc with endpoint path.

```typescript
import apiClient from './axios';
import type { /* all types */ } from '../types/voice-ai-admin';

// PROVIDERS — /api/v1/system/voice-ai/providers
/** GET /system/voice-ai/providers - List all AI providers */
export async function getVoiceAiProviders(): Promise<VoiceAiProvider[]> { ... }

/** POST /system/voice-ai/providers - Create provider */
export async function createVoiceAiProvider(data: CreateProviderRequest): Promise<VoiceAiProvider> { ... }

/** PATCH /system/voice-ai/providers/:id - Update provider */
export async function updateVoiceAiProvider(id: string, data: Partial<CreateProviderRequest>): Promise<VoiceAiProvider> { ... }

/** DELETE /system/voice-ai/providers/:id - Soft delete provider */
export async function deleteVoiceAiProvider(id: string): Promise<void> { ... }

// CREDENTIALS — /api/v1/system/voice-ai/credentials
/** GET /system/voice-ai/credentials - List credentials (masked) */
export async function getVoiceAiCredentials(): Promise<VoiceAiCredential[]> { ... }

/** PUT /system/voice-ai/credentials/:providerId - Set credential */
export async function setVoiceAiCredential(providerId: string, apiKey: string): Promise<VoiceAiCredential> { ... }

/** DELETE /system/voice-ai/credentials/:providerId - Remove credential */
export async function deleteVoiceAiCredential(providerId: string): Promise<void> { ... }

// GLOBAL CONFIG — /api/v1/system/voice-ai/config
/** GET /system/voice-ai/config - Get global config */
export async function getVoiceAiGlobalConfig(): Promise<VoiceAiGlobalConfig> { ... }

/** PATCH /system/voice-ai/config - Update global config */
export async function updateVoiceAiGlobalConfig(data: UpdateGlobalConfigRequest): Promise<VoiceAiGlobalConfig> { ... }

/** POST /system/voice-ai/config/regenerate-key - Regenerate agent API key */
export async function regenerateAgentKey(): Promise<{ plain_key: string; preview: string; warning: string }> { ... }

// PLANS — /api/v1/system/voice-ai/plans
/** GET /system/voice-ai/plans - List plans with voice config */
export async function getPlansWithVoiceConfig(): Promise<PlanWithVoiceConfig[]> { ... }

/** PATCH /system/voice-ai/plans/:planId/voice - Update plan voice config */
export async function updatePlanVoiceConfig(planId: string, data: Partial<PlanWithVoiceConfig>): Promise<PlanWithVoiceConfig> { ... }

// MONITORING — /api/v1/system/voice-ai/
/** GET /system/voice-ai/tenants - All tenants with voice AI summary */
export async function getTenantsVoiceAiOverview(params?: { page?: number; limit?: number; search?: string }): Promise<PaginatedResponse<TenantVoiceAiOverview>> { ... }

/** PATCH /system/voice-ai/tenants/:tenantId/override - Override tenant settings */
export async function overrideTenantVoiceSettings(tenantId: string, data: AdminOverrideRequest): Promise<void> { ... }

/** GET /system/voice-ai/call-logs - Cross-tenant call logs */
export async function getAdminCallLogs(params?: { tenantId?: string; from?: string; to?: string; outcome?: string; search?: string; page?: number; limit?: number }): Promise<PaginatedResponse<VoiceCallLog>> { ... }

/** GET /system/voice-ai/usage-report - Aggregate usage report */
export async function getAdminUsageReport(year?: number, month?: number): Promise<AdminUsageReport> { ... }
```

---

## Acceptance Criteria

- [ ] `/app/src/lib/types/voice-ai-admin.ts` created with all types matching real API responses
- [ ] `/app/src/lib/api/voice-ai-admin.ts` created with all API functions
- [ ] All types verified against real API at `http://localhost:8000/api/v1`
- [ ] No `any` types
- [ ] `npm run build` passes
