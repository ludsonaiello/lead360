# Voice AI Module - Feature Contract

**Module**: Voice AI  
**Version**: 1.0  
**Date**: February 2026  
**Status**: Approved  
**Priority**: High

---

## Executive Summary

Voice AI adds AI-powered phone agents to Lead360 that answer calls for tenant businesses 24/7. The agent talks naturally, books appointments, collects lead information, and transfers calls using tenant-configured behavior layered on top of platform-managed infrastructure.

**Managed service model**: Lead360 controls all AI provider keys, costs, and infrastructure. Tenants control only their greeting, languages, and transfer numbers.

---

## Scope

### In Scope
- Provider registry (Deepgram STT, OpenAI LLM, Cartesia TTS)
- Encrypted credential management (admin-only)
- Platform-wide default configuration (global config singleton)
- Per-tenant behavior settings (greeting, language, instructions, transfer numbers)
- IVR extension: "Press 3 for AI Assistant" added to existing IVR menus
- Python agent integration via internal REST API (context, lead creation, appointment booking, call logging)
- Usage tracking and billing foundation (minutes per tenant per month)
- Subscription plan feature flags (voice AI enabled, minutes included, overage rate)

### Out of Scope
- Real-time agent monitoring dashboard (future)
- Agent builder UI for tenants (future)
- Multi-agent routing (future)
- Auto-failover between providers (future)
- Custom voice cloning per tenant (future)

### Dependencies
- Auth module (JWT, is_platform_admin check)
- Tenant module (tenant resolution middleware)
- Communication/IVR module (ivr_configuration table, TwiML generation)
- BullMQ/Redis (background jobs)
- EncryptionService (AES-256-GCM credential encryption)
- LeadsService (lead creation from calls)
- Twilio (existing inbound call routing)
- LiveKit Cloud (SIP trunk for call transfer to agent)

---

## Architecture

### Two-Layer Configuration Model

```
LAYER 1 - INFRASTRUCTURE (System Admin Only)
├── Which STT provider (Deepgram)
├── Which LLM provider (OpenAI)  
├── Which TTS provider (Cartesia)
├── API keys (encrypted)
├── LiveKit SIP trunk URL
├── Agent authentication key
└── Minutes limits per plan tier

LAYER 2 - BEHAVIOR (Tenant Admin)
├── Enable/disable toggle
├── Languages (English, Spanish, etc.)
├── Greeting message
├── Agent instructions (system prompt additions)
├── Transfer numbers (sales, support, emergency)
├── Lead creation enabled
├── Appointment booking enabled
└── Max call duration
```

### Call Flow

```
Customer calls tenant's Twilio number
         ↓
Existing IVR menu (Press 1, Press 2, Press 3)
         ↓ (presses 3)
IVR checks: voice_ai_enabled + quota > 0
         ↓ (pass)
TwiML <Dial><Sip> to LiveKit SIP trunk
  ?tenantId=abc&callSid=xyz
         ↓
Python agent joins LiveKit room
         ↓
Agent calls GET /api/v1/internal/voice-ai/tenant/abc/context
         ↓
Agent greets caller with tenant greeting
         ↓
Conversation: STT → LLM → TTS loop
         ↓
Actions: create_lead | book_appointment | transfer_call
         ↓
Call ends → agent calls POST /api/v1/internal/voice-ai/calls/{callSid}/complete
         ↓
Usage recorded → call log finalized
```

---

## Data Model

### voice_ai_provider

| Column | Type | Notes |
|--------|------|-------|
| id | String (UUID) | PK |
| provider_key | String | UNIQUE. e.g. `deepgram`, `openai`, `cartesia` |
| provider_type | Enum | STT, LLM, TTS |
| display_name | String | Human-readable name |
| description | String? | Optional description |
| is_active | Boolean | Default true |
| created_at | DateTime | |
| updated_at | DateTime | |

**Seed data**: deepgram (STT), openai (LLM), cartesia (TTS)

### voice_ai_credentials

| Column | Type | Notes |
|--------|------|-------|
| id | String (UUID) | PK |
| provider_id | String | FK → voice_ai_provider |
| encrypted_api_key | String (LongText) | AES-256-GCM encrypted JSON |
| masked_api_key | String | Last 4 chars visible e.g. `sk-...xxxx` |
| created_at | DateTime | |
| updated_at | DateTime | |

**No tenant_id** — admin-managed platform credentials.  
**UNIQUE**: provider_id (one credential per provider).

### voice_ai_global_config

**Singleton table** — always exactly one row with fixed ID `default`.

| Column | Type | Notes |
|--------|------|-------|
| id | String | PK, always `"default"` |
| default_stt_provider_id | String? | FK → voice_ai_provider |
| default_llm_provider_id | String? | FK → voice_ai_provider |
| default_tts_provider_id | String? | FK → voice_ai_provider |
| default_voice_id | String? | e.g. Cartesia voice ID |
| default_language | String | Default: `"en"` |
| default_greeting_template | String (Text) | `"Hello, thank you for calling {business_name}!"` |
| default_system_prompt | String (Text) | Base instructions for all agents |
| default_max_call_duration_seconds | Int | Default: 600 (10 min) |
| livekit_sip_trunk_url | String? | e.g. `sip.livekit.cloud` |
| livekit_api_key | String? | Encrypted |
| livekit_api_secret | String? | Encrypted |
| agent_api_key_hash | String? | SHA-256 hash of the agent secret |
| agent_api_key_preview | String? | Last 4 chars for UI display |
| max_concurrent_calls | Int | Default: 100 |
| updated_at | DateTime | |
| updated_by | String? | FK → user |

### tenant_voice_ai_settings

**One row per tenant** — UNIQUE on tenant_id.

| Column | Type | Notes |
|--------|------|-------|
| id | String (UUID) | PK |
| tenant_id | String | UNIQUE FK → tenant |
| is_enabled | Boolean | Default false |
| enabled_languages | String (Text) | JSON array e.g. `["en","es"]` |
| custom_greeting | String (Text)? | Overrides global default |
| custom_instructions | String (Text)? | Appended to system prompt |
| booking_enabled | Boolean | Default true |
| lead_creation_enabled | Boolean | Default true |
| transfer_enabled | Boolean | Default true |
| default_transfer_number | String? | E.164 fallback transfer |
| max_call_duration_seconds | Int? | Overrides global default |
| monthly_minutes_override | Int? | Admin override (null = use plan default) |
| stt_provider_override_id | String? | Admin-only override |
| llm_provider_override_id | String? | Admin-only override |
| tts_provider_override_id | String? | Admin-only override |
| created_at | DateTime | |
| updated_at | DateTime | |

### tenant_voice_transfer_number

| Column | Type | Notes |
|--------|------|-------|
| id | String (UUID) | PK |
| tenant_id | String | FK → tenant |
| label | String | e.g. "Sales", "Emergency" |
| phone_number | String | E.164 format |
| is_default | Boolean | Default false. Only one per tenant |
| created_at | DateTime | |

**Max 10 per tenant** enforced in service layer.

### voice_call_log

| Column | Type | Notes |
|--------|------|-------|
| id | String (UUID) | PK |
| tenant_id | String | FK → tenant. Indexed |
| call_sid | String | Twilio CallSid. UNIQUE |
| from_number | String | Caller E.164 |
| to_number | String | Tenant's Twilio number |
| direction | Enum | inbound, outbound |
| status | Enum | in_progress, completed, transferred, abandoned, error |
| is_overage | Boolean | Default false |
| duration_seconds | Int? | Set on call end |
| transcript_summary | String (Text)? | AI-generated summary |
| full_transcript | String (LongText)? | Full STT output |
| actions_taken | String (Text)? | JSON: `["lead_created","appointment_booked"]` |
| lead_id | String? | FK → lead (if matched/created) |
| outcome | String? | What happened: booked, transferred, info_given, etc. |
| started_at | DateTime | |
| ended_at | DateTime? | |
| created_at | DateTime | |

### voice_usage_record

Per-call, per-provider granular billing records. Each call creates 1–3 rows (one per provider: STT, LLM, TTS).

| Column | Type | Notes |
|--------|------|-------|
| id | String (UUID) | PK |
| tenant_id | String | FK → tenant |
| call_log_id | String | FK → voice_call_log |
| provider_id | String | FK → voice_ai_provider |
| provider_type | String | STT \| LLM \| TTS |
| usage_quantity | Decimal | seconds / tokens / characters |
| usage_unit | String | 'seconds' \| 'tokens' \| 'characters' |
| estimated_cost | Decimal? | USD cost estimate |
| year | Int | e.g. 2026 (for efficient aggregation) |
| month | Int | 1-12 |
| billed_at | DateTime | |
| created_at | DateTime | |

**No unique constraint** — each call creates new rows, never upserts. Quota is derived by aggregating STT seconds for current month.

### subscription_plan (extensions)

Add to existing model:
- `voice_ai_enabled Boolean @default(false)`
- `voice_ai_minutes_included Int @default(0)`
- `voice_ai_overage_rate Decimal? @db.Decimal(10,4)` — cost per minute over limit. NULL = blocked when quota exceeded.

---

## API Specification

> ⚠️ **Source of Truth**: Endpoint paths in this section reflect the sprint implementations (B02a–B14, FTA01–FTA06, FSA01–FSA07). These paths take precedence over any earlier draft. Do not use paths from older versions of this contract.

### Authentication

| Endpoint Group | Auth Method | Requirement |
|---|---|---|
| Admin — System | JWT | `is_platform_admin: true` |
| Tenant | JWT | Authenticated tenant user (any role) |
| Internal (Python agent) | `X-Voice-Agent-Key` header | Hash matches `agent_api_key_hash` in global config |
| Webhooks | HMAC signature | LiveKit signature verification |

### Admin — Providers (`/system/voice-ai/providers`)

> Sprint: B02a | Frontend: FSA01

- `GET    /api/v1/system/voice-ai/providers` — list all AI providers
- `POST   /api/v1/system/voice-ai/providers` — create provider
- `PATCH  /api/v1/system/voice-ai/providers/:id` — update provider
- `DELETE /api/v1/system/voice-ai/providers/:id` — soft delete provider

### Admin — Credentials (`/system/voice-ai/credentials`)

> Sprint: B02b | Frontend: FSA02

- `GET    /api/v1/system/voice-ai/credentials` — list credentials (masked keys only, never plain)
- `PUT    /api/v1/system/voice-ai/credentials/:providerId` — upsert credential (one per provider)
- `DELETE /api/v1/system/voice-ai/credentials/:providerId` — remove credential

### Admin — Global Config (`/system/voice-ai/config`)

> Sprint: B03 | Frontend: FSA03

- `GET    /api/v1/system/voice-ai/config` — get singleton global config
- `PATCH  /api/v1/system/voice-ai/config` — update global defaults
- `POST   /api/v1/system/voice-ai/config/regenerate-key` — regenerate agent API key (returns plain key ONCE, never stored)

### Admin — Subscription Plans (`/system/voice-ai/plans`)

> Sprint: B03 | Frontend: FSA04

- `GET    /api/v1/system/voice-ai/plans` — list plans with voice AI fields
- `PATCH  /api/v1/system/voice-ai/plans/:planId/voice` — update voice AI config for a plan

### Admin — Tenant Monitoring (`/system/voice-ai/tenants`)

> Sprint: B11 | Frontend: FSA04

- `GET    /api/v1/system/voice-ai/tenants?page&limit&search` — all tenants with voice AI summary
- `PATCH  /api/v1/system/voice-ai/tenants/:tenantId/override` — admin override for specific tenant

### Admin — Call Logs & Usage Report

> Sprint: B07 | Frontend: FSA05

- `GET    /api/v1/system/voice-ai/call-logs?tenantId&from&to&outcome&page&limit` — cross-tenant call logs
- `GET    /api/v1/system/voice-ai/usage-report?year&month` — aggregate usage report across all tenants

### Tenant — Settings (`/voice-ai/settings`)

> Sprint: B04 | Frontend: FTA01

- `GET    /api/v1/voice-ai/settings` — get tenant's voice AI settings
- `PUT    /api/v1/voice-ai/settings` — upsert settings (behavior fields only, no provider overrides)

### Tenant — Transfer Numbers (`/voice-ai/transfer-numbers`)

> Sprint: B05 | Frontend: FTA02

⚠️ **Route order matters**: `/reorder` is a static route and MUST be hit before `/:id` in the controller.

- `GET    /api/v1/voice-ai/transfer-numbers` — list transfer numbers (ordered by `display_order` ASC)
- `POST   /api/v1/voice-ai/transfer-numbers` — create transfer number (max 10 per tenant)
- `POST   /api/v1/voice-ai/transfer-numbers/reorder` — bulk-update `display_order` for drag-and-drop UI
- `PATCH  /api/v1/voice-ai/transfer-numbers/:id` — update a transfer number
- `DELETE /api/v1/voice-ai/transfer-numbers/:id` — delete a transfer number

### Tenant — Call Logs (`/voice-ai/call-logs`)

> Sprint: B07 | Frontend: FTA03

- `GET    /api/v1/voice-ai/call-logs?from&to&outcome&page&limit` — tenant's paginated call history
- `GET    /api/v1/voice-ai/call-logs/:id` — single call log detail with full transcript

### Tenant — Usage (`/voice-ai/usage`)

> Sprint: B07 | Frontend: FTA04

- `GET    /api/v1/voice-ai/usage?year&month` — monthly usage summary (defaults to current month)

### Internal Agent Endpoints (`/internal/voice-ai/...`)

> Sprint: B06a, B06b, B06c | Python Agent: A03, A07, A08

Auth: `X-Voice-Agent-Key` header (NOT JWT). All routes use `@Public()` to bypass global JWT guard.

**Access & Context:**
- `GET    /api/v1/internal/voice-ai/tenant/:tenantId/access` — pre-flight quota/enabled check before routing call
- `GET    /api/v1/internal/voice-ai/tenant/:tenantId/context` — full merged context (FullVoiceAiContext) with decrypted keys

**Call Lifecycle:**
- `POST   /api/v1/internal/voice-ai/calls/start` — create call log at call start, returns `{ call_log_id }`
- `POST   /api/v1/internal/voice-ai/calls/:callSid/complete` — finalize call log + create usage records

**Tool Dispatch (separate routes, not generic `:tool`):**
- `POST   /api/v1/internal/voice-ai/tenant/:tenantId/tools/create_lead` — create lead from call
- `POST   /api/v1/internal/voice-ai/tenant/:tenantId/tools/book_appointment` — book appointment
- `POST   /api/v1/internal/voice-ai/tenant/:tenantId/tools/transfer_call` — initiate call transfer

### Webhooks

> Sprint: B14

Auth: LiveKit HMAC signature verification (no JWT, no agent key).

- `POST   /api/webhooks/voice-ai/livekit` — LiveKit event webhook handler

---

## FullVoiceAiContext — JSON Shape

This is the object returned by `GET /api/v1/internal/voice-ai/tenant/:tenantId/context`.

```json
{
  "tenant": {
    "id": "uuid",
    "company_name": "Acme Plumbing",
    "phone": "+15551234567",
    "timezone": "America/New_York",
    "language": "en"
  },
  "quota": {
    "minutes_included": 500,
    "minutes_used": 47,
    "minutes_remaining": 453,
    "overage_rate": null,
    "quota_exceeded": false
  },
  "behavior": {
    "is_enabled": true,
    "language": "en",
    "greeting": "Hello, thank you for calling Acme Plumbing! How can I help you today?",
    "custom_instructions": "Always ask if it's an emergency. Always mention we serve the Miami area.",
    "booking_enabled": true,
    "lead_creation_enabled": true,
    "transfer_enabled": true,
    "max_call_duration_seconds": 600
  },
  "providers": {
    "stt": {
      "provider_id": "uuid-of-deepgram-provider-row",
      "provider_key": "deepgram",
      "api_key": "DECRYPTED_KEY_HERE",
      "config": { "model": "nova-2", "punctuate": true }
    },
    "llm": {
      "provider_id": "uuid-of-openai-provider-row",
      "provider_key": "openai",
      "api_key": "DECRYPTED_KEY_HERE",
      "config": { "model": "gpt-4o-mini", "temperature": 0.7, "max_tokens": 500 }
    },
    "tts": {
      "provider_id": "uuid-of-cartesia-provider-row",
      "provider_key": "cartesia",
      "api_key": "DECRYPTED_KEY_HERE",
      "config": { "model": "sonic-english", "speed": 1.0 },
      "voice_id": "voice-uuid"
    }
  },
  "services": [
    { "name": "Plumbing Repair", "description": "General plumbing fixes" },
    { "name": "Water Heater", "description": "Installation and repair" }
  ],
  "service_areas": [
    { "type": "city", "value": "Miami", "state": "FL" },
    { "type": "city", "value": "Coral Gables", "state": "FL" }
  ],
  "transfer_numbers": [
    { "label": "Sales", "phone_number": "+15559876543", "transfer_type": "primary", "is_default": false, "available_hours": null },
    { "label": "Emergency", "phone_number": "+15550001111", "transfer_type": "emergency", "is_default": true, "available_hours": null }
  ]
}
```

---

## IVR Integration

When a tenant has Voice AI enabled and their IVR menu includes a `voice_ai` action type:

1. Tenant's IVR menu option is configured with `action: "voice_ai"` (new action type added to existing `IVR_ACTION_TYPES`)
2. When customer dials the mapped digit, `IvrConfigurationService.generateDtmfTwiML()` handles the `voice_ai` case
3. Service checks: `tenant_voice_ai_settings.is_enabled` and quota > 0
4. If pass: returns `<Response><Dial><Sip>sip:voice-ai@{livekit_sip_url}?tenantId={tenantId}&callSid={CallSid}</Sip></Dial></Response>`
5. If fail: falls back to `default_transfer_number` with a message

---

## Acceptance Criteria

### Platform Admin
- [ ] Can register AI providers in catalog
- [ ] Can securely store API keys (never visible after entry)
- [ ] Can set platform-wide defaults for STT/LLM/TTS providers
- [ ] Can enable Voice AI per subscription plan with minute limits
- [ ] Can see all tenants' voice AI usage
- [ ] Can force-override settings for specific tenant
- [ ] Regenerate agent API key without downtime

### Tenant Admin
- [ ] Can enable/disable Voice AI (only if plan includes it)
- [ ] Can set greeting message and agent instructions
- [ ] Can manage transfer numbers (up to 10)
- [ ] Can view all their call logs with transcripts
- [ ] Can see monthly minutes usage with visual meter

### Python Agent
- [ ] Receives complete context in one API call
- [ ] Gracefully rejects calls when quota exceeded
- [ ] Creates leads via internal API
- [ ] Books appointments via internal API
- [ ] Logs every call (start + end) with transcript summary

### System
- [ ] No cross-tenant data leakage (tenant A cannot get tenant B's context)
- [ ] Credentials never exposed in API responses (masked only)
- [ ] Monthly usage resets automatically on 1st of month
- [ ] IVR extension does not break existing IVR functionality
