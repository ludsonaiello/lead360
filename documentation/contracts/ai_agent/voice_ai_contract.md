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
Agent calls GET /voice-ai/internal/context/abc
         ↓
Agent greets caller with tenant greeting
         ↓
Conversation: STT → LLM → TTS loop
         ↓
Actions: create_lead | book_appointment | transfer_call
         ↓
Call ends → agent calls POST /voice-ai/internal/calls/end
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

| Column | Type | Notes |
|--------|------|-------|
| id | String (UUID) | PK |
| tenant_id | String | FK → tenant |
| year | Int | e.g. 2026 |
| month | Int | 1-12 |
| minutes_used | Int | Default 0 |
| overage_minutes_used | Int | Default 0 |
| estimated_overage_cost | Decimal? | Decimal(10,4) |
| total_calls | Int | Default 0 |
| created_at | DateTime | |
| updated_at | DateTime | |

**UNIQUE**: `[tenant_id, year, month]` — enables atomic upsert.

### subscription_plan (extensions)

Add to existing model:
- `voice_ai_enabled Boolean @default(false)`
- `voice_ai_minutes_included Int @default(0)`
- `voice_ai_overage_rate Decimal? @db.Decimal(10,4)` — cost per minute over limit. NULL = blocked when quota exceeded.

---

## API Specification

### Authentication

| Endpoint Group | Auth Method | Requirement |
|---|---|---|
| Admin Infrastructure | JWT | `is_platform_admin: true` |
| Admin Monitoring | JWT | `is_platform_admin: true` |
| Tenant Behavior | JWT | Authenticated tenant user |
| Internal (Python agent) | `X-Voice-Agent-Key` header | Hash matches `agent_api_key_hash` in global config |

### Admin Infrastructure Endpoints

**Providers**
- `GET /api/v1/voice-ai/admin/providers` — list all providers
- `POST /api/v1/voice-ai/admin/providers` — create provider
- `PATCH /api/v1/voice-ai/admin/providers/:id` — update provider
- `DELETE /api/v1/voice-ai/admin/providers/:id` — soft delete

**Credentials**
- `GET /api/v1/voice-ai/admin/credentials` — list credentials (masked keys)
- `PUT /api/v1/voice-ai/admin/credentials/:providerId` — upsert credential
- `DELETE /api/v1/voice-ai/admin/credentials/:providerId` — delete

**Global Config**
- `GET /api/v1/voice-ai/admin/global-config` — get singleton
- `PATCH /api/v1/voice-ai/admin/global-config` — update defaults
- `POST /api/v1/voice-ai/admin/global-config/regenerate-key` — regenerate agent API key (returns plain key ONCE)

**Subscription Plans**
- `GET /api/v1/voice-ai/admin/plans` — list plans with voice AI fields
- `PATCH /api/v1/voice-ai/admin/plans/:planId/voice` — update voice AI plan config

### Admin Monitoring Endpoints

- `GET /api/v1/voice-ai/admin/tenants?page&limit&search` — all tenants with voice AI summary
- `PATCH /api/v1/voice-ai/admin/tenants/:tenantId/override` — admin override settings
- `GET /api/v1/voice-ai/admin/call-logs?tenantId&from&to&outcome&page&limit` — cross-tenant call logs
- `GET /api/v1/voice-ai/admin/usage-report?year&month` — aggregate usage report

### Tenant Behavior Endpoints

- `GET /api/v1/voice-ai/settings` — get tenant voice AI settings
- `PUT /api/v1/voice-ai/settings` — upsert settings (behavior fields only)
- `GET /api/v1/voice-ai/transfer-numbers` — list transfer numbers
- `POST /api/v1/voice-ai/transfer-numbers` — create transfer number
- `PATCH /api/v1/voice-ai/transfer-numbers/:id` — update
- `DELETE /api/v1/voice-ai/transfer-numbers/:id` — delete
- `GET /api/v1/voice-ai/call-logs?from&to&outcome&page&limit` — tenant's call history
- `GET /api/v1/voice-ai/call-logs/:id` — single call detail
- `GET /api/v1/voice-ai/usage?year&month` — usage summary (default: current month)

### Internal Agent Endpoints

- `GET /api/v1/voice-ai/internal/context/:tenantId` — full merged context
- `POST /api/v1/voice-ai/internal/calls/start` — start call log
- `POST /api/v1/voice-ai/internal/calls/end` — finalize call log
- `POST /api/v1/voice-ai/internal/actions/lead` — create/find lead
- `POST /api/v1/voice-ai/internal/actions/appointment` — book appointment

---

## FullVoiceAiContext — JSON Shape

This is the object returned by `GET /api/v1/voice-ai/internal/context/:tenantId`.

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
      "provider_key": "deepgram",
      "api_key": "DECRYPTED_KEY_HERE"
    },
    "llm": {
      "provider_key": "openai",
      "api_key": "DECRYPTED_KEY_HERE"
    },
    "tts": {
      "provider_key": "cartesia",
      "api_key": "DECRYPTED_KEY_HERE",
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
    { "label": "Sales", "phone_number": "+15559876543", "is_default": false },
    { "label": "Emergency", "phone_number": "+15550001111", "is_default": true }
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
