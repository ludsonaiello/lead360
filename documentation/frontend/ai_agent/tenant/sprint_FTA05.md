YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint FTA05 — Tenant API Client + Types

**Module**: Voice AI - Frontend Tenant  
**Sprint**: FTA05  
**Depends on**: B12 (REST API documentation complete)  
**Do this FIRST — all other tenant sprints depend on these files**

---

## Objective

Create the TypeScript API client and type definitions for the Voice AI tenant-facing endpoints.

---

## Mandatory Pre-Coding Steps

1. Read `/api/documentation/voice_ai_REST_API.md` (Tenant Endpoints section)
2. **HIT THE ENDPOINTS**: login as tenant and test each endpoint at `http://localhost:8000/api/v1`
3. Read `/app/src/lib/api/twilio-tenant.ts` — replicate pattern
4. Read `/app/src/lib/types/twilio-tenant.ts` — use same type structure

**DO NOT USE PM2** — `npm run dev` on both services

---

## Credentials

- Tenant: `contato@honeydo4you.com` / `978@F32c`

---

## Task 1: Types File

Create `/app/src/lib/types/voice-ai-tenant.ts`:

```typescript
export interface TenantVoiceAiSettings {
  id: string;
  tenant_id: string;
  is_enabled: boolean;
  enabled_languages: string[];  // parsed from JSON
  custom_greeting: string | null;
  custom_instructions: string | null;
  booking_enabled: boolean;
  lead_creation_enabled: boolean;
  transfer_enabled: boolean;
  default_transfer_number: string | null;
  max_call_duration_seconds: number | null;
  // voice_ai_included_in_plan: returned by settings endpoint
  voice_ai_included_in_plan: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpsertVoiceSettingsRequest {
  is_enabled?: boolean;
  enabled_languages?: string[];
  custom_greeting?: string | null;
  custom_instructions?: string | null;
  booking_enabled?: boolean;
  lead_creation_enabled?: boolean;
  transfer_enabled?: boolean;
  default_transfer_number?: string | null;
  max_call_duration_seconds?: number | null;
}

export interface VoiceTransferNumber {
  id: string;
  tenant_id: string;
  label: string;
  phone_number: string;
  transfer_type: string;            // primary | overflow | after_hours | emergency
  description: string | null;
  is_default: boolean;
  available_hours: string | null;   // JSON string or null (e.g. {"mon":[["09:00","17:00"]]})
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTransferNumberRequest {
  label: string;
  phone_number: string;
  transfer_type?: string;           // defaults to 'primary' if omitted
  description?: string | null;
  is_default?: boolean;
  available_hours?: string | null;
  display_order?: number;
}

export interface TenantCallLog {
  id: string;
  call_sid: string;
  from_number: string;
  to_number: string;
  direction: string;
  status: string;
  is_overage: boolean;
  duration_seconds: number | null;
  transcript_summary: string | null;
  outcome: string | null;
  lead_id: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface TenantUsageSummary {
  tenant_id: string;
  year: number;
  month: number;
  minutes_included: number;
  minutes_used: number;
  minutes_remaining: number;
  overage_rate: number | null;
  quota_exceeded: boolean;
  total_calls: number;
  total_stt_seconds: number;
  total_llm_tokens: number;
  total_tts_characters: number;
  estimated_cost: number;
}

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

Create `/app/src/lib/api/voice-ai-tenant.ts`:

```typescript
import apiClient from './axios';
import type { ... } from '../types/voice-ai-tenant';

/** GET /voice-ai/settings - Get tenant voice AI settings */
export async function getTenantVoiceSettings(): Promise<TenantVoiceAiSettings | null> { ... }

/** PUT /voice-ai/settings - Update tenant voice AI settings */
export async function updateTenantVoiceSettings(data: UpsertVoiceSettingsRequest): Promise<TenantVoiceAiSettings> { ... }

/** GET /voice-ai/transfer-numbers - List transfer numbers */
export async function getTransferNumbers(): Promise<VoiceTransferNumber[]> { ... }

/** POST /voice-ai/transfer-numbers - Create transfer number */
export async function createTransferNumber(data: CreateTransferNumberRequest): Promise<VoiceTransferNumber> { ... }

/** PATCH /voice-ai/transfer-numbers/:id - Update transfer number */
export async function updateTransferNumber(id: string, data: Partial<CreateTransferNumberRequest>): Promise<VoiceTransferNumber> { ... }

/** DELETE /voice-ai/transfer-numbers/:id - Delete transfer number */
export async function deleteTransferNumber(id: string): Promise<void> { ... }

/** POST /voice-ai/transfer-numbers/reorder - Update display order of multiple numbers */
export async function reorderTransferNumbers(data: Array<{ id: string; display_order: number }>): Promise<void> { ... }

/** GET /voice-ai/call-logs - List call logs */
export async function getTenantCallLogs(params?: { from?: string; to?: string; outcome?: string; search?: string; page?: number; limit?: number }): Promise<PaginatedResponse<TenantCallLog>> { ... }

/** GET /voice-ai/call-logs/:id - Get call detail */
export async function getTenantCallLog(id: string): Promise<TenantCallLog> { ... }

/** GET /voice-ai/usage - Get usage summary */
export async function getTenantUsage(year?: number, month?: number): Promise<TenantUsageSummary> { ... }
```

---

## Task 3: Add to Tenant Sidebar Navigation

In `/app/src/components/dashboard/DashboardSidebar.tsx`, add to the settings-related navigation items:

```typescript
{ name: 'Voice AI', href: '/settings/voice-ai', icon: Mic, permission: 'settings:voice_ai' }
```

Also add to Communications group:
```typescript
{ name: 'AI Call Logs', href: '/communications/voice-ai', icon: PhoneCall }
```

---

## Acceptance Criteria

- [ ] All types match real API responses (verified via curl)
- [ ] All API functions created and typed
- [ ] No `any` types
- [ ] Voice AI items added to sidebar navigation
- [ ] `npm run build` passes
