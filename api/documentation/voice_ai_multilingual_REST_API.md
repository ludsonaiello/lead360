# Voice AI Multilingual Feature - Complete REST API Documentation

**Version**: 2.0 (Architecture v2 - Global Profiles + Tenant Overrides)
**Date**: March 2026
**Module**: Voice AI - Multilingual Support
**Base URL**: `http://localhost:8000/api/v1` (dev) | `https://api.lead360.app/api/v1` (prod)

---

## Table of Contents

1. [Architecture Change (March 2026)](#architecture-change-march-2026)
2. [Feature Overview](#feature-overview)
3. [Architecture & Data Flow](#architecture--data-flow)
4. [Voice Agent Profiles API](#voice-agent-profiles-api)
5. [IVR Integration](#ivr-integration)
6. [Call Context Resolution](#call-context-resolution)
7. [Admin Configuration](#admin-configuration)
8. [Complete Examples](#complete-examples)
9. [Testing & Validation](#testing--validation)

---

## Architecture Change (March 2026)

### Version 1 → Version 2 Migration

**IMPORTANT**: The Voice AI multilingual architecture was redesigned in March 2026 to improve scalability and centralize language/voice management.

#### Old Architecture (v1 - Deprecated)

In the original implementation:
- **Tenants created their own profiles** directly via `/voice-ai/agent-profiles`
- Each tenant independently chose voice IDs and language codes
- No global templates or centralized voice management
- Led to duplication across tenants (many tenants using identical configurations)
- Platform admins had no control over available languages/voices

**Limitation**: If a voice provider changed voice IDs or deprecated voices, every tenant had to update their profiles individually.

#### New Architecture (v2 - Current)

The redesigned architecture follows a **two-tier model**:

1. **Global Profiles** (System Admin Managed)
   - Platform admins create language/voice templates via `/system/voice-ai/agent-profiles`
   - Available to ALL tenants platform-wide
   - Examples: "English - Professional", "Portuguese - Friendly", "Spanish - Formal"
   - Centralized control over voice IDs and language options
   - Endpoint: `/api/v1/system/voice-ai/agent-profiles`

2. **Tenant Overrides** (Tenant Managed)
   - Tenants SELECT a global profile and CUSTOMIZE greeting/instructions
   - Keeps tenant flexibility while benefiting from centralized management
   - Subject to subscription plan limits
   - Endpoint: `/api/v1/voice-ai/agent-profile-overrides`

**Benefits**:
- **Centralized Updates**: Platform admin updates voice ID once → affects all tenants using that profile
- **Quality Control**: Platform admin curates high-quality voice options
- **Simplified Onboarding**: Tenants choose from pre-configured options instead of technical voice IDs
- **Reduced Duplication**: Global profiles are shared; only customizations stored per-tenant

#### Migration Impact

**Data Migration** (completed automatically):
- Existing `tenant_voice_agent_profile` records migrated to `tenant_voice_agent_profile_override` table
- Corresponding global profiles created in `voice_ai_agent_profile` table
- All IVR configurations updated to reference global profile IDs
- No data loss; all tenant customizations preserved

**API Changes**:

| Old Endpoint (v1) | New Endpoint (v2) | Notes |
|-------------------|-------------------|-------|
| `POST /voice-ai/agent-profiles` | `POST /voice-ai/agent-profile-overrides` | Tenants now create overrides, not profiles |
| `GET /voice-ai/agent-profiles` | `GET /voice-ai/agent-profile-overrides` | Lists tenant's overrides |
| (none) | `GET /voice-ai/available-profiles` | New: View available global profiles (read-only) |
| (none) | `POST /system/voice-ai/agent-profiles` | New: Admin creates global profiles |

**For API Consumers**:
1. **Frontend UI**: Update forms to show global profile selector + customization fields (see [voice_agent_profiles_REST_API.md](./voice_agent_profiles_REST_API.md))
2. **IVR Configs**: `agent_profile_id` now references global profile ID (migration handled automatically)
3. **Existing Integrations**: Old endpoints deprecated but may still work temporarily (migration path TBD)

**Plan Limits**:
- Old: Enforced on total profile creation
- New: Enforced on **active overrides** (number of global profiles you've customized)

#### Resolution Flow (Updated)

```
1. IVR call → agent_profile_id sent (global profile UUID)
   ↓
2. Context Builder loads Global Profile
   ↓
3. Check if tenant has override for this global profile
   ↓
4a. Override exists?
    YES → Apply custom greeting/instructions from override
    NO  → Use global profile defaults
   ↓
5. Return context with:
   - language/voice from global profile
   - greeting/instructions from override OR global default
```

**Key Principle**: Global profiles provide **language + voice**, tenant overrides provide **personality + business context**.

---

## Feature Overview

The **Multi-Language Voice Agent** feature enables Lead360 tenants to create and manage multiple voice agent profiles, each configured with:

- A specific **language** (BCP-47 code: en, es, pt, etc.)
- A specific **TTS voice ID** (provider-specific voice identifier)
- Custom **greeting** message (per-language greeting)
- Custom **instructions** (appended to system prompt for language-specific behavior)

### Business Value

**Before this feature**:
- Tenants could only use a single voice and language for all calls
- No way to offer language-specific greetings or instructions
- IVR could route to "Voice AI" but couldn't select language/voice

**After this feature**:
- Tenants can create multiple named profiles (e.g., "English Sales", "Spanish Support")
- IVR menu options can route to specific profiles (e.g., "Press 1 for English, Press 2 for Spanish")
- Each profile has its own greeting, voice, and behavioral instructions
- Plan-based limits control how many profiles a tenant can create

### Key Components

1. **Voice Agent Profiles** - Named configurations stored in `tenant_voice_agent_profile` table
2. **Plan Limits** - `subscription_plan.voice_ai_max_agent_profiles` controls max active profiles
3. **Default Profile** - `tenant_voice_ai_settings.default_agent_profile_id` for fallback routing
4. **IVR Integration** - `agent_profile_id` in IVR voice_ai action configs
5. **Context Resolution** - Runtime language/voice selection based on profile

---

## Architecture & Data Flow

### Database Schema

**Architecture v2 introduces two tables** (replaced single `tenant_voice_agent_profile` table):

#### 1. Global Profiles: `voice_ai_agent_profile`

```sql
CREATE TABLE voice_ai_agent_profile (
  id                   VARCHAR(36) PRIMARY KEY,
  language_code        VARCHAR(10) NOT NULL,
  language_name        VARCHAR(100) NOT NULL,
  voice_id             VARCHAR(200) NOT NULL,
  voice_provider_type  VARCHAR(20) DEFAULT 'tts',
  default_greeting     TEXT,
  default_instructions LONGTEXT,
  display_name         VARCHAR(100) NOT NULL UNIQUE,
  description          TEXT,
  is_active            BOOLEAN DEFAULT true,
  display_order        INT DEFAULT 0,
  created_at           DATETIME DEFAULT NOW(),
  updated_at           DATETIME DEFAULT NOW() ON UPDATE NOW(),
  updated_by           VARCHAR(36),

  INDEX idx_language_code (language_code),
  INDEX idx_is_active (is_active)
);
```

**Purpose**: Platform-wide language/voice templates created by admins.

#### 2. Tenant Overrides: `tenant_voice_agent_profile_override`

```sql
CREATE TABLE tenant_voice_agent_profile_override (
  id                  VARCHAR(36) PRIMARY KEY,
  tenant_id           VARCHAR(36) NOT NULL,
  agent_profile_id    VARCHAR(36) NOT NULL,
  custom_greeting     TEXT,
  custom_instructions LONGTEXT,
  is_active           BOOLEAN DEFAULT true,
  display_order       INT DEFAULT 0,
  created_at          DATETIME DEFAULT NOW(),
  updated_at          DATETIME DEFAULT NOW() ON UPDATE NOW(),
  updated_by          VARCHAR(36),

  FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE,
  FOREIGN KEY (agent_profile_id) REFERENCES voice_ai_agent_profile(id) ON DELETE CASCADE,

  INDEX idx_tenant_id (tenant_id),
  INDEX idx_tenant_profile (tenant_id, agent_profile_id),
  INDEX idx_agent_profile_id (agent_profile_id),

  CONSTRAINT uniq_tenant_override UNIQUE (tenant_id, agent_profile_id)
);
```

**Purpose**: Per-tenant customizations (greeting/instructions) for global profiles.

**Schema Extensions**:

```sql
-- subscription_plan table
ALTER TABLE subscription_plan
  ADD COLUMN voice_ai_max_agent_profiles INT DEFAULT 1;

-- tenant_voice_ai_settings table
ALTER TABLE tenant_voice_ai_settings
  ADD COLUMN default_agent_profile_id VARCHAR(36),
  ADD CONSTRAINT fk_default_profile
    FOREIGN KEY (default_agent_profile_id)
    REFERENCES tenant_voice_agent_profile(id)
    ON DELETE SET NULL;
```

### Call Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Incoming Call → Twilio → IVR Menu                            │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Caller presses digit mapped to "voice_ai" action             │
│    IVR config includes: { agent_profile_id: "uuid-here" }       │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. IVR Service → VoiceAiSipService.buildSipTwiml()              │
│    Parameters: tenantId, callSid, toNumber, agentProfileId      │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. TwiML Generated with SIP Headers:                            │
│    <SipHeader name="X-Twilio-Number">{toNumber}</SipHeader>     │
│    <SipHeader name="X-Agent-Profile-Id">{profileId}</SipHeader> │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Call Routed to LiveKit SIP Trunk                             │
│    SIP headers forwarded through LiveKit to agent worker        │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Agent Worker Extracts X-Agent-Profile-Id from SIP Headers    │
│    Calls: GET /internal/voice-ai/context?agent_profile_id=...   │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Context Builder Resolves Profile:                            │
│    - Step 1: Load profile by agentProfileId + tenant_id         │
│    - Step 2: If not found, try default_agent_profile_id         │
│    - Step 3: If still not found, use fallback (voice_id_override)│
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. Context Returned with:                                       │
│    - behavior.language = profile.language_code                  │
│    - providers.tts.voice_id = profile.voice_id                  │
│    - behavior.greeting = profile.custom_greeting                │
│    - behavior.system_prompt += profile.custom_instructions      │
│    - active_agent_profile = { id, title, language_code }        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Voice Agent Profiles API

**IMPORTANT**: The API endpoints have been updated for Architecture v2. See detailed documentation in [voice_agent_profiles_REST_API.md](./voice_agent_profiles_REST_API.md).

### Endpoint Summary (v2 - Current)

**System Admin Endpoints** (Global Profile Management):

| Method | Endpoint | Description | RBAC |
|--------|----------|-------------|------|
| POST | `/system/voice-ai/agent-profiles` | Create global profile | Platform Admin |
| GET | `/system/voice-ai/agent-profiles` | List all global profiles | Platform Admin |
| GET | `/system/voice-ai/agent-profiles/:id` | Get single global profile | Platform Admin |
| PATCH | `/system/voice-ai/agent-profiles/:id` | Update global profile | Platform Admin |
| DELETE | `/system/voice-ai/agent-profiles/:id` | Soft-delete global profile | Platform Admin |

**Tenant Endpoints** (Override Management):

| Method | Endpoint | Description | RBAC |
|--------|----------|-------------|------|
| GET | `/voice-ai/available-profiles` | List available global profiles (read-only) | Owner, Admin, Manager |
| POST | `/voice-ai/agent-profile-overrides` | Create override for global profile | Owner, Admin |
| GET | `/voice-ai/agent-profile-overrides` | List tenant's overrides | Owner, Admin, Manager |
| GET | `/voice-ai/agent-profile-overrides/:id` | Get single override | Owner, Admin, Manager |
| PATCH | `/voice-ai/agent-profile-overrides/:id` | Update override | Owner, Admin |
| DELETE | `/voice-ai/agent-profile-overrides/:id` | Delete override | Owner, Admin |

### Endpoint Summary (v1 - Deprecated)

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/voice-ai/agent-profiles` | Create new profile | Deprecated |
| GET | `/voice-ai/agent-profiles` | List all profiles | Deprecated |
| GET | `/voice-ai/agent-profiles/:id` | Get single profile | Deprecated |
| PATCH | `/voice-ai/agent-profiles/:id` | Update profile | Deprecated |
| DELETE | `/voice-ai/agent-profiles/:id` | Delete profile | Deprecated |

**Migration Note**: Old endpoints may be removed in a future release. Update integrations to use v2 endpoints.

### Complete CRUD Examples

#### 1. Create English Profile

```bash
# Login first
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "contact@honeydo4you.com",
    "password": "978@F32c"
  }' | jq -r '.access_token')

# Create English profile
curl -X POST http://localhost:8000/api/v1/voice-ai/agent-profiles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Main English Agent",
    "language_code": "en",
    "voice_id": "694f9389-aac1-45b6-b726-9d9369183238",
    "custom_greeting": "Hello! Thank you for calling. How can I help you today?",
    "custom_instructions": "You are speaking to English-speaking customers. Use clear, professional language. Be friendly and helpful.",
    "is_active": true,
    "display_order": 0
  }'
```

**Response**:
```json
{
  "id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
  "tenant_id": "tenant-uuid-here",
  "title": "Main English Agent",
  "language_code": "en",
  "voice_id": "694f9389-aac1-45b6-b726-9d9369183238",
  "custom_greeting": "Hello! Thank you for calling. How can I help you today?",
  "custom_instructions": "You are speaking to English-speaking customers. Use clear, professional language. Be friendly and helpful.",
  "is_active": true,
  "display_order": 0,
  "created_at": "2026-03-04T10:00:00.000Z",
  "updated_at": "2026-03-04T10:00:00.000Z",
  "updated_by": "user-uuid-here"
}
```

#### 2. Create Spanish Profile

```bash
curl -X POST http://localhost:8000/api/v1/voice-ai/agent-profiles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Agente en Español",
    "language_code": "es",
    "voice_id": "a0e99841-438c-4a64-b679-ae501e7d6091",
    "custom_greeting": "¡Hola! Gracias por llamar. ¿Cómo puedo ayudarle hoy?",
    "custom_instructions": "Estás hablando con clientes que hablan español. Usa un lenguaje claro y profesional. Sé amable y servicial. Usa español formal (usted) a menos que el cliente indique lo contrario.",
    "is_active": true,
    "display_order": 1
  }'
```

#### 3. Create Portuguese Profile

```bash
curl -X POST http://localhost:8000/api/v1/voice-ai/agent-profiles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Agente em Português",
    "language_code": "pt",
    "voice_id": "b1f00952-549d-5b75-c790-bf612f8e8192",
    "custom_greeting": "Olá! Obrigado por ligar. Como posso ajudá-lo hoje?",
    "custom_instructions": "Você está falando com clientes que falam português. Use linguagem clara e profissional. Seja amigável e prestativo. Use português formal (você) a menos que o cliente indique o contrário.",
    "is_active": true,
    "display_order": 2
  }'
```

#### 4. List All Profiles

```bash
curl -X GET http://localhost:8000/api/v1/voice-ai/agent-profiles \
  -H "Authorization: Bearer $TOKEN"
```

**Response**:
```json
[
  {
    "id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
    "title": "Main English Agent",
    "language_code": "en",
    "is_active": true,
    "display_order": 0,
    "..."
  },
  {
    "id": "b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e",
    "title": "Agente en Español",
    "language_code": "es",
    "is_active": true,
    "display_order": 1,
    "..."
  },
  {
    "id": "c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f",
    "title": "Agente em Português",
    "language_code": "pt",
    "is_active": true,
    "display_order": 2,
    "..."
  }
]
```

#### 5. Update Profile (Change Title)

```bash
curl -X PATCH http://localhost:8000/api/v1/voice-ai/agent-profiles/a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Primary English Agent"
  }'
```

#### 6. Deactivate Profile

```bash
curl -X PATCH http://localhost:8000/api/v1/voice-ai/agent-profiles/c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "is_active": false
  }'
```

**Note**: If this profile is set as `default_agent_profile_id` in settings, it will be automatically cleared.

#### 7. Delete Profile

```bash
curl -X DELETE http://localhost:8000/api/v1/voice-ai/agent-profiles/c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f \
  -H "Authorization: Bearer $TOKEN"
```

**Response**: 204 No Content (on success)

**Error if in use by IVR**:
```json
{
  "statusCode": 409,
  "message": "This agent profile is in use by an active IVR configuration. Deactivate it instead, or remove it from your IVR settings first.",
  "error": "Conflict"
}
```

---

## IVR Integration

### IVR Config Structure with Agent Profiles

**Before (old format - still supported)**:
```json
{
  "greeting_message": "Press 1 for Sales, Press 2 for Support",
  "menu_options": [
    {
      "digit": "1",
      "action": "voice_ai",
      "label": "Voice AI",
      "config": {}
    }
  ]
}
```

**After (new format with agent profiles)**:
```json
{
  "greeting_message": "Press 1 for English, Press 2 for Español, Press 3 for Português",
  "menu_options": [
    {
      "digit": "1",
      "action": "voice_ai",
      "label": "English Voice Agent",
      "config": {
        "agent_profile_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d"
      }
    },
    {
      "digit": "2",
      "action": "voice_ai",
      "label": "Agente de Voz en Español",
      "config": {
        "agent_profile_id": "b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"
      }
    },
    {
      "digit": "3",
      "action": "voice_ai",
      "label": "Agente de Voz em Português",
      "config": {
        "agent_profile_id": "c3d4e5f6-a7b8-6c7d-0e1f-2a3b4c5d6e7f"
      }
    }
  ]
}
```

### IVR Save Endpoint

**Endpoint**: `POST /communication/ivr-configuration`

**Request Body**:
```json
{
  "greeting_message": "Press 1 for English, Press 2 for Español",
  "menu_options": [
    {
      "digit": "1",
      "action": "voice_ai",
      "label": "English",
      "config": {
        "agent_profile_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d"
      }
    },
    {
      "digit": "2",
      "action": "voice_ai",
      "label": "Español",
      "config": {
        "agent_profile_id": "b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e"
      }
    }
  ],
  "timeout_seconds": 10,
  "max_retries": 2,
  "invalid_input_action": "repeat",
  "timeout_action": "default"
}
```

**Validation Rules**:
1. All `agent_profile_id` values must be valid UUIDs
2. Each profile ID must exist in `tenant_voice_agent_profile` for the tenant
3. Each profile must be active (`is_active = true`)
4. Profile must belong to the authenticated tenant (cross-tenant access denied)

**Success Response**: 201 Created

**Error Response (Invalid Profile)**:
```json
{
  "statusCode": 400,
  "message": "Voice agent profile b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e not found or not active for this tenant.",
  "error": "Bad Request"
}
```

---

## Call Context Resolution

### Context Endpoint (Internal)

**Endpoint**: `GET /internal/voice-ai/context`

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenant_id` | string (UUID) | Yes | Tenant ID |
| `call_sid` | string | No | Twilio call SID |
| `agent_profile_id` | string (UUID) | No | Voice agent profile ID (from SIP header) |

**Authentication**: VoiceAgentKeyGuard (internal API key)

**Example Request**:
```bash
curl -X GET "http://localhost:8000/api/v1/internal/voice-ai/context?tenant_id=tenant-uuid&call_sid=CA1234&agent_profile_id=a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d" \
  -H "X-Voice-Agent-Key: internal-api-key-here"
```

### Profile Resolution Logic

The context builder uses a **3-step fallback chain** to resolve the active profile:

**Step 1: Explicit Profile from IVR**
```typescript
if (agentProfileId) {
  profile = await prisma.tenant_voice_agent_profile.findFirst({
    where: {
      id: agentProfileId,
      tenant_id: tenantId,
      is_active: true
    }
  });

  if (profile) {
    return resolvedProfile(profile);
  }
}
```

**Step 2: Default Profile from Settings**
```typescript
if (tenantSettings?.default_agent_profile_id) {
  profile = await prisma.tenant_voice_agent_profile.findFirst({
    where: {
      id: tenantSettings.default_agent_profile_id,
      tenant_id: tenantId,
      is_active: true
    }
  });

  if (profile) {
    return resolvedProfile(profile);
  }
}
```

**Step 3: Fallback to Legacy Behavior**
```typescript
// No profile found - use legacy fields
return {
  language: tenantSettings.enabled_languages[0] ?? 'en',
  voice_id: tenantSettings.voice_id_override ?? globalConfig.default_voice_id,
  custom_greeting: tenantSettings.custom_greeting,
  custom_instructions: null,
  active_profile: null
};
```

### Context Response Structure

**When Profile Resolved**:
```json
{
  "call_sid": "CA1234567890abcdef",
  "tenant": {
    "id": "tenant-uuid",
    "company_name": "HoneyDo Home Services",
    "phone": "+15551234567",
    "..."
  },
  "behavior": {
    "language": "es",
    "enabled_languages": ["en", "es", "pt"],
    "greeting": "¡Hola! Gracias por llamar. ¿Cómo puedo ayudarle hoy?",
    "system_prompt": "You are a helpful AI assistant for HoneyDo Home Services...\n\nEstás hablando con clientes que hablan español. Usa un lenguaje claro y profesional.",
    "booking_enabled": true,
    "lead_creation_enabled": true,
    "..."
  },
  "providers": {
    "stt": { "provider_key": "deepgram", "..." },
    "llm": { "provider_key": "anthropic", "..." },
    "tts": {
      "provider_key": "cartesia",
      "voice_id": "a0e99841-438c-4a64-b679-ae501e7d6091",
      "..."
    }
  },
  "active_agent_profile": {
    "id": "b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e",
    "title": "Agente en Español",
    "language_code": "es"
  },
  "..."
}
```

**When No Profile (Fallback)**:
```json
{
  "behavior": {
    "language": "en",
    "greeting": "Hello! Thank you for calling HoneyDo Home Services.",
    "system_prompt": "You are a helpful AI assistant for HoneyDo Home Services...",
    "..."
  },
  "providers": {
    "tts": {
      "voice_id": "694f9389-aac1-45b6-b726-9d9369183238",
      "..."
    }
  },
  "active_agent_profile": null,
  "..."
}
```

### System Prompt Merging

The `system_prompt` field is constructed by **appending** instructions in this order:

1. **Global default** (from `voice_ai_global_config.default_system_prompt`)
2. **Tenant-level** (from `tenant_voice_ai_settings.custom_instructions`) - if set
3. **Profile-level** (from `tenant_voice_agent_profile.custom_instructions`) - if profile resolved

**Example**:
```typescript
let systemPrompt = globalConfig.default_system_prompt;
// "You are a helpful AI assistant..."

if (tenantSettings?.custom_instructions) {
  systemPrompt += `\n\n${tenantSettings.custom_instructions}`;
}
// "You are a helpful AI assistant...\n\nAlways ask for the customer's address."

if (profileResolution.custom_instructions) {
  systemPrompt += `\n\n${profileResolution.custom_instructions}`;
}
// "You are a helpful AI assistant...\n\nAlways ask for the customer's address.\n\nEstás hablando con clientes que hablan español..."
```

**CRITICAL**: Profile instructions **APPEND** (not replace). This ensures tenant-level instructions are preserved while adding language-specific guidance.

---

## Admin Configuration

### Set Plan Limits

**Endpoint**: `PATCH /system/voice-ai/plans/:planId`

**Request**:
```bash
curl -X PATCH http://localhost:8000/api/v1/system/voice-ai/plans/plan-uuid \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "voice_ai_max_agent_profiles": 10
  }'
```

**Response**:
```json
{
  "id": "plan-uuid",
  "name": "Professional Plan",
  "voice_ai_enabled": true,
  "voice_ai_minutes_included": 500,
  "voice_ai_max_agent_profiles": 10,
  "..."
}
```

### Set Default Profile for Tenant (Admin Override)

**Endpoint**: `PATCH /system/voice-ai/tenants/:tenantId/override`

**Request**:
```bash
curl -X PATCH http://localhost:8000/api/v1/system/voice-ai/tenants/tenant-uuid/override \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "default_agent_profile_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d"
  }'
```

**Validation**:
- Profile must exist
- Profile must belong to the target tenant
- Returns 400 if validation fails

---

## Complete Examples

### Scenario 1: Bilingual Business Setup (English + Spanish)

**Step 1: Create English Profile**
```bash
EN_PROFILE=$(curl -s -X POST http://localhost:8000/api/v1/voice-ai/agent-profiles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "English Agent",
    "language_code": "en",
    "voice_id": "694f9389-aac1-45b6-b726-9d9369183238",
    "custom_greeting": "Hello! How can I help you?",
    "is_active": true
  }' | jq -r '.id')
```

**Step 2: Create Spanish Profile**
```bash
ES_PROFILE=$(curl -s -X POST http://localhost:8000/api/v1/voice-ai/agent-profiles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Agente Español",
    "language_code": "es",
    "voice_id": "a0e99841-438c-4a64-b679-ae501e7d6091",
    "custom_greeting": "¡Hola! ¿Cómo puedo ayudarle?",
    "is_active": true
  }' | jq -r '.id')
```

**Step 3: Configure IVR with Language Selection**
```bash
curl -X POST http://localhost:8000/api/v1/communication/ivr-configuration \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"greeting_message\": \"For English, press 1. Para Español, oprima 2.\",
    \"menu_options\": [
      {
        \"digit\": \"1\",
        \"action\": \"voice_ai\",
        \"label\": \"English\",
        \"config\": {
          \"agent_profile_id\": \"$EN_PROFILE\"
        }
      },
      {
        \"digit\": \"2\",
        \"action\": \"voice_ai\",
        \"label\": \"Español\",
        \"config\": {
          \"agent_profile_id\": \"$ES_PROFILE\"
        }
      }
    ],
    \"timeout_seconds\": 10,
    \"max_retries\": 2
  }"
```

**Step 4: Verify Configuration**
```bash
curl -X GET http://localhost:8000/api/v1/communication/ivr-configuration \
  -H "Authorization: Bearer $TOKEN"
```

### Scenario 2: Multilingual with Department Routing

**Setup**: 3 languages × 2 departments = 6 profiles

```bash
# Sales profiles
EN_SALES=$(curl -s -X POST ... -d '{"title": "English Sales", "language_code": "en", ...}' | jq -r '.id')
ES_SALES=$(curl -s -X POST ... -d '{"title": "Ventas Español", "language_code": "es", ...}' | jq -r '.id')
PT_SALES=$(curl -s -X POST ... -d '{"title": "Vendas Português", "language_code": "pt", ...}' | jq -r '.id')

# Support profiles
EN_SUPPORT=$(curl -s -X POST ... -d '{"title": "English Support", "language_code": "en", ...}' | jq -r '.id')
ES_SUPPORT=$(curl -s -X POST ... -d '{"title": "Soporte Español", "language_code": "es", ...}' | jq -r '.id')
PT_SUPPORT=$(curl -s -X POST ... -d '{"title": "Suporte Português", "language_code": "pt", ...}' | jq -r '.id')

# IVR with nested submenus
curl -X POST http://localhost:8000/api/v1/communication/ivr-configuration \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"greeting_message\": \"Press 1 for English, 2 para Español, 3 para Português\",
    \"menu_options\": [
      {
        \"digit\": \"1\",
        \"action\": \"submenu\",
        \"label\": \"English\",
        \"submenu\": {
          \"greeting_message\": \"Press 1 for Sales, 2 for Support\",
          \"options\": [
            {
              \"digit\": \"1\",
              \"action\": \"voice_ai\",
              \"config\": { \"agent_profile_id\": \"$EN_SALES\" }
            },
            {
              \"digit\": \"2\",
              \"action\": \"voice_ai\",
              \"config\": { \"agent_profile_id\": \"$EN_SUPPORT\" }
            }
          ]
        }
      },
      {
        \"digit\": \"2\",
        \"action\": \"submenu\",
        \"label\": \"Español\",
        \"submenu\": {
          \"greeting_message\": \"Oprima 1 para Ventas, 2 para Soporte\",
          \"options\": [
            {
              \"digit\": \"1\",
              \"action\": \"voice_ai\",
              \"config\": { \"agent_profile_id\": \"$ES_SALES\" }
            },
            {
              \"digit\": \"2\",
              \"action\": \"voice_ai\",
              \"config\": { \"agent_profile_id\": \"$ES_SUPPORT\" }
            }
          ]
        }
      }
    ]
  }"
```

---

## Testing & Validation

### Manual Testing Checklist

**Profile Management**:
- [ ] Create profile → verify all fields in response
- [ ] Create duplicate (same language + title) → verify 409 error
- [ ] Create profile beyond plan limit → verify 403 error
- [ ] List profiles → verify sorted by display_order, then created_at
- [ ] List with `active_only=true` → verify only active returned
- [ ] Get profile by ID → verify correct profile returned
- [ ] Get another tenant's profile → verify 404 error
- [ ] Update profile title → verify only title changed
- [ ] Update to duplicate title → verify 409 error
- [ ] Deactivate default profile → verify settings FK cleared
- [ ] Delete unused profile → verify 204 response
- [ ] Delete profile in IVR → verify 409 error

**IVR Integration**:
- [ ] Save IVR with valid profile → verify success
- [ ] Save IVR with inactive profile → verify 400 error
- [ ] Save IVR with non-existent profile → verify 400 error
- [ ] Save IVR with another tenant's profile → verify 400 error
- [ ] Save IVR without profile (legacy) → verify backward compatibility

**Call Context**:
- [ ] Call with X-Agent-Profile-Id → verify language/voice from profile
- [ ] Call without header → verify fallback to defaults
- [ ] Call with invalid profile ID → verify fallback (no error)
- [ ] Verify active_agent_profile populated when resolved
- [ ] Verify active_agent_profile is null when fallback used
- [ ] Verify system_prompt includes profile instructions (appended)
- [ ] Verify greeting from profile overrides tenant default

**Multi-Tenant Isolation**:
- [ ] Verify cannot read other tenant's profiles
- [ ] Verify cannot update other tenant's profiles
- [ ] Verify cannot delete other tenant's profiles
- [ ] Verify cannot reference other tenant's profiles in IVR

### Automated Testing

See: `/var/www/lead360.app/api/test-voice-profiles-e2e.ts`

Run with: `npx ts-node test-voice-profiles-e2e.ts`

---

## Error Codes Reference

| Status | Error | Cause | Solution |
|--------|-------|-------|----------|
| 400 | Bad Request | Validation failed | Check field types and constraints |
| 401 | Unauthorized | Missing/invalid JWT | Re-authenticate and get new token |
| 403 | Forbidden (plan limit) | Active profiles >= max | Deactivate/delete profiles or upgrade plan |
| 403 | Forbidden (voice AI disabled) | Plan doesn't include Voice AI | Upgrade subscription plan |
| 404 | Not Found | Profile doesn't exist or belongs to other tenant | Check profile ID and tenant access |
| 409 | Conflict (duplicate) | (language + title) exists | Change title or language_code |
| 409 | Conflict (IVR in use) | Profile referenced in IVR | Remove from IVR config or deactivate instead |

---

## Best Practices

### Profile Naming Conventions

**Good**:
- "English Sales Agent"
- "Spanish Support Agent"
- "Portuguese After-Hours"

**Bad**:
- "Agent 1" (not descriptive)
- "en" (use title, not code)
- "Main" (which language?)

### Language Codes

Always use **BCP-47 standard codes**:
- `en` - English
- `es` - Spanish (generic)
- `es-MX` - Mexican Spanish
- `es-ES` - European Spanish
- `pt` - Portuguese (generic)
- `pt-BR` - Brazilian Portuguese
- `pt-PT` - European Portuguese

### Custom Instructions Best Practices

**DO**:
- Add language-specific behavioral guidance
- Include cultural considerations
- Specify formality level (formal/informal)
- Add domain-specific vocabulary hints

**DON'T**:
- Duplicate tenant-level instructions (they're already appended)
- Include provider-specific API keys or config
- Add instructions unrelated to language/culture

**Example**:
```json
{
  "custom_instructions": "You are speaking with Spanish-speaking customers. Use formal Spanish (usted) unless the customer indicates otherwise. Be aware of cultural nuances in Latin American business communication. When discussing pricing, always clarify currency (USD vs local). If the customer uses regional slang, acknowledge it politely but maintain professional language."
}
```

---

**End of Multilingual Feature Documentation**
