# Voice AI Agent Profiles REST API

**Version**: 2.0 (Architecture v2 - Global Profiles + Tenant Overrides)
**Last Updated**: March 2026
**Base URL**: `https://api.lead360.app/api/v1`

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [System Admin Endpoints](#system-admin-endpoints)
3. [Tenant Endpoints](#tenant-endpoints)
4. [Common Error Responses](#common-error-responses)
5. [Changelog](#changelog)

---

## Architecture Overview

### Concept: Global Templates + Tenant Customization

Voice agent profiles follow a **two-tier architecture** designed to balance centralized control with tenant flexibility:

#### 1. Global Profiles (System Admin Managed)

Global profiles are **language/voice templates** available to ALL tenants across the platform.

**Characteristics**:
- Created and managed exclusively by **Platform Administrators**
- Provide pre-configured voice settings for different languages
- Include default greetings and instructions
- Examples: "English - Professional", "Portuguese - Friendly", "Spanish - Formal"
- Cannot be modified by tenants (read-only for tenants)

**Managed via**: `/api/v1/system/voice-ai/agent-profiles`

**Use Cases**:
- Platform admin creates "English - Professional" profile with a neutral business voice
- Platform admin creates "Portuguese - Friendly" profile with a warm, conversational voice
- Platform admin creates "Spanish - Formal" profile for markets requiring formal communication

#### 2. Tenant Overrides (Tenant Managed)

Tenant overrides allow individual tenants to **customize global profiles** for their specific business needs.

**Characteristics**:
- Tenants **select** a global profile as a base template
- Tenants **customize** greeting and instructions to match their brand voice
- Subject to **subscription plan limits** (max active profiles)
- Can be activated/deactivated without deletion

**Managed via**: `/api/v1/voice-ai/agent-profile-overrides`

**Use Cases**:
- ACME Plumbing selects "English - Professional" and customizes greeting: "Thanks for calling ACME Plumbing, available 24/7!"
- Silva Cleaning selects "Portuguese - Friendly" and customizes instructions to emphasize eco-friendly products
- Each tenant gets personalized voice AI while admins control available languages/voices centrally

---

### Resolution Flow

How voice agent context is built when an IVR call is initiated:

```
1. IVR Call Initiated
   ↓
2. IVR Action specifies: agent_profile_id = "00000000-0000-0000-0000-000000000001"
   ↓
3. Context Builder Service loads Global Profile "English - Professional"
   - language_code: "en"
   - voice_id: "2b568345-1f36-4cf8-baa7-5932856bf66a"
   - default_greeting: "Hello, thank you for calling {business_name}!"
   - default_instructions: "You are a professional assistant..."
   ↓
4. Context Builder checks: Does tenant have an override for this global profile?
   ↓
   4a. Override exists?
       YES → Apply custom_greeting and custom_instructions from override
       NO  → Use global defaults
   ↓
5. Final Voice Agent Context sent to Voice Agent Session:
   - language: "en" (from global)
   - voice_id: "2b568345-..." (from global)
   - greeting: tenant custom OR global default
   - instructions: tenant custom OR global default
   ↓
6. Voice Agent speaks with tenant-specific personality in selected language
```

**Key Principle**: Global profiles provide the **language** and **voice**, while tenant overrides provide the **personality** and **business context**.

---

### Data Model

**voice_ai_agent_profile** (Global Profiles)
```sql
id                   UUID PRIMARY KEY
language_code        VARCHAR(10)      -- ISO 639-1 code (en, pt, es, fr, de)
language_name        VARCHAR(100)     -- Human-readable (English, Portuguese)
voice_id             VARCHAR(200)     -- TTS provider voice identifier
voice_provider_type  VARCHAR(20)      -- Default: 'tts'
default_greeting     TEXT             -- Template greeting with {business_name}
default_instructions LONGTEXT         -- LLM system instructions
display_name         VARCHAR(100) UNIQUE -- "English - Professional"
description          TEXT             -- Optional explanation
is_active            BOOLEAN          -- Default: true
display_order        INT              -- UI sorting (lower = first)
created_at           TIMESTAMP
updated_at           TIMESTAMP
updated_by           UUID             -- Admin user who last modified
```

**tenant_voice_agent_profile_override** (Tenant Customizations)
```sql
id                  UUID PRIMARY KEY
tenant_id           UUID FOREIGN KEY -> tenant(id) CASCADE
agent_profile_id    UUID FOREIGN KEY -> voice_ai_agent_profile(id) CASCADE
custom_greeting     TEXT             -- Overrides global default_greeting
custom_instructions LONGTEXT         -- Overrides global default_instructions
is_active           BOOLEAN          -- Default: true
display_order       INT              -- Default: 0
created_at          TIMESTAMP
updated_at          TIMESTAMP
updated_by          UUID             -- Tenant user who last modified

UNIQUE(tenant_id, agent_profile_id)  -- One override per global profile
```

---

## System Admin Endpoints

**Base Path**: `/api/v1/system/voice-ai/agent-profiles`

### Authentication

All system admin endpoints require:

- **Header**: `Authorization: Bearer {jwt-token}`
- **Permission**: Platform Admin (`is_platform_admin: true` in user table)

**Unauthorized Requests**:
- Missing or invalid JWT → `401 Unauthorized`
- Valid JWT but not platform admin → `403 Forbidden`

---

### Create Global Profile

**POST** `/api/v1/system/voice-ai/agent-profiles`

Creates a new global voice agent profile template available to all tenants.

#### Request

**Headers**:
```
Authorization: Bearer {admin-jwt-token}
Content-Type: application/json
```

**Body**:
```json
{
  "language_code": "en",
  "language_name": "English",
  "voice_id": "2b568345-1f36-4cf8-baa7-5932856bf66a",
  "voice_provider_type": "tts",
  "display_name": "English - Professional",
  "description": "Professional English voice optimized for business calls. Clear, formal tone.",
  "default_greeting": "Hello, thank you for calling {business_name}! How can I help you today?",
  "default_instructions": "You are a professional phone assistant for a service business. Be concise, friendly, and helpful. Keep responses under 20 seconds. Always confirm understanding before ending the call.",
  "is_active": true,
  "display_order": 1
}
```

**Field Validation**:
- `language_code` (required): 2-10 characters, ISO 639-1 code (e.g., "en", "pt", "es")
- `language_name` (required): 1-100 characters (e.g., "English", "Portuguese")
- `voice_id` (required): 1-200 characters, TTS provider voice identifier
- `voice_provider_type` (optional): Max 20 characters, default: "tts"
- `display_name` (required): 1-100 characters, **must be unique**
- `description` (optional): Text, shown in UI tooltips
- `default_greeting` (optional): Text, supports `{business_name}` placeholder
- `default_instructions` (optional): LongText, LLM system prompt
- `is_active` (optional): Boolean, default: `true`
- `display_order` (optional): Integer 0-9999, default: `0`

#### Response

**Success** (`201 Created`):
```json
{
  "id": "00000000-0000-0000-0000-000000000001",
  "language_code": "en",
  "language_name": "English",
  "voice_id": "2b568345-1f36-4cf8-baa7-5932856bf66a",
  "voice_provider_type": "tts",
  "display_name": "English - Professional",
  "description": "Professional English voice optimized for business calls. Clear, formal tone.",
  "default_greeting": "Hello, thank you for calling {business_name}! How can I help you today?",
  "default_instructions": "You are a professional phone assistant for a service business. Be concise, friendly, and helpful. Keep responses under 20 seconds. Always confirm understanding before ending the call.",
  "is_active": true,
  "display_order": 1,
  "created_at": "2026-03-04T12:00:00.000Z",
  "updated_at": "2026-03-04T12:00:00.000Z",
  "updated_by": "admin-user-uuid-12345"
}
```

**Error** (`400 Bad Request` - Validation Failed):
```json
{
  "statusCode": 400,
  "message": [
    "language_code must be a string",
    "language_code must be longer than or equal to 2 characters",
    "voice_id should not be empty"
  ],
  "error": "Bad Request"
}
```

**Error** (`401 Unauthorized` - Missing or Invalid JWT):
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Error** (`403 Forbidden` - Not Platform Admin):
```json
{
  "statusCode": 403,
  "message": "Platform Admin access required.",
  "error": "Forbidden"
}
```

**Error** (`409 Conflict` - Display Name Already Exists):
```json
{
  "statusCode": 409,
  "message": "A global profile with display name \"English - Professional\" already exists. Display names must be unique.",
  "error": "Conflict"
}
```

#### Example

```bash
curl -X POST https://api.lead360.app/api/v1/system/voice-ai/agent-profiles \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "language_code": "en",
    "language_name": "English",
    "voice_id": "2b568345-1f36-4cf8-baa7-5932856bf66a",
    "display_name": "English - Professional",
    "description": "Professional English voice",
    "default_greeting": "Hello, thank you for calling {business_name}!",
    "default_instructions": "You are a professional assistant...",
    "is_active": true,
    "display_order": 1
  }'
```

---

### List Global Profiles

**GET** `/api/v1/system/voice-ai/agent-profiles`

Returns a list of all global voice agent profiles, optionally filtered to active profiles only.

#### Request

**Headers**:
```
Authorization: Bearer {admin-jwt-token}
```

**Query Parameters**:
- `active_only` (optional): Boolean, default: `false`
  - `true` → Returns only profiles where `is_active = true`
  - `false` → Returns all profiles (active and inactive)

**Examples**:
- `/api/v1/system/voice-ai/agent-profiles` → All profiles
- `/api/v1/system/voice-ai/agent-profiles?active_only=true` → Active only
- `/api/v1/system/voice-ai/agent-profiles?active_only=false` → All profiles

#### Response

**Success** (`200 OK`):
```json
[
  {
    "id": "00000000-0000-0000-0000-000000000001",
    "language_code": "en",
    "language_name": "English",
    "voice_id": "2b568345-1f36-4cf8-baa7-5932856bf66a",
    "voice_provider_type": "tts",
    "display_name": "English - Professional",
    "description": "Professional English voice",
    "default_greeting": "Hello, thank you for calling {business_name}!",
    "default_instructions": "You are a professional assistant...",
    "is_active": true,
    "display_order": 1,
    "created_at": "2026-03-04T12:00:00.000Z",
    "updated_at": "2026-03-04T12:00:00.000Z",
    "updated_by": "admin-user-uuid"
  },
  {
    "id": "00000000-0000-0000-0000-000000000002",
    "language_code": "pt",
    "language_name": "Portuguese",
    "voice_id": "3c679456-2g47-5dg9-cbb8-6043967cg77b",
    "voice_provider_type": "tts",
    "display_name": "Portuguese - Friendly",
    "description": "Warm, conversational Portuguese voice",
    "default_greeting": "Olá! Obrigado por ligar para {business_name}!",
    "default_instructions": "Você é um assistente amigável...",
    "is_active": true,
    "display_order": 2,
    "created_at": "2026-03-04T13:00:00.000Z",
    "updated_at": "2026-03-04T13:00:00.000Z",
    "updated_by": "admin-user-uuid"
  }
]
```

**Sorting**: Results are sorted by `display_order ASC, language_name ASC`.

**Error** (`401 Unauthorized` - Missing or Invalid JWT):
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Error** (`403 Forbidden` - Not Platform Admin):
```json
{
  "statusCode": 403,
  "message": "Platform Admin access required.",
  "error": "Forbidden"
}
```

#### Example

```bash
# Get all profiles
curl -X GET https://api.lead360.app/api/v1/system/voice-ai/agent-profiles \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Get only active profiles
curl -X GET "https://api.lead360.app/api/v1/system/voice-ai/agent-profiles?active_only=true" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### Get Single Global Profile

**GET** `/api/v1/system/voice-ai/agent-profiles/:id`

Returns detailed information about a specific global profile, including the count of tenant overrides using this profile.

#### Request

**Headers**:
```
Authorization: Bearer {admin-jwt-token}
```

**Path Parameters**:
- `id` (required): UUID of the global profile

**Example**: `/api/v1/system/voice-ai/agent-profiles/00000000-0000-0000-0000-000000000001`

#### Response

**Success** (`200 OK`):
```json
{
  "id": "00000000-0000-0000-0000-000000000001",
  "language_code": "en",
  "language_name": "English",
  "voice_id": "2b568345-1f36-4cf8-baa7-5932856bf66a",
  "voice_provider_type": "tts",
  "display_name": "English - Professional",
  "description": "Professional English voice",
  "default_greeting": "Hello, thank you for calling {business_name}!",
  "default_instructions": "You are a professional assistant...",
  "is_active": true,
  "display_order": 1,
  "created_at": "2026-03-04T12:00:00.000Z",
  "updated_at": "2026-03-04T12:00:00.000Z",
  "updated_by": "admin-user-uuid-12345",
  "_count": {
    "tenant_overrides": 7
  }
}
```

**Field Notes**:
- `_count.tenant_overrides`: Number of tenants who have created overrides for this profile (useful for determining if profile can be safely deleted)

**Error** (`401 Unauthorized` - Missing or Invalid JWT):
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Error** (`403 Forbidden` - Not Platform Admin):
```json
{
  "statusCode": 403,
  "message": "Platform Admin access required.",
  "error": "Forbidden"
}
```

**Error** (`404 Not Found`):
```json
{
  "statusCode": 404,
  "message": "Global voice agent profile not found: 00000000-0000-0000-0000-000000000099",
  "error": "Not Found"
}
```

#### Example

```bash
curl -X GET https://api.lead360.app/api/v1/system/voice-ai/agent-profiles/00000000-0000-0000-0000-000000000001 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### Update Global Profile

**PATCH** `/api/v1/system/voice-ai/agent-profiles/:id`

Updates a global voice agent profile. Only fields included in the request body are updated (partial update).

#### Request

**Headers**:
```
Authorization: Bearer {admin-jwt-token}
Content-Type: application/json
```

**Path Parameters**:
- `id` (required): UUID of the global profile to update

**Body** (all fields optional):
```json
{
  "display_name": "English - Professional (Updated)",
  "description": "Updated description",
  "default_greeting": "Updated greeting for {business_name}!",
  "is_active": true,
  "display_order": 10
}
```

**Note**: You can update any combination of fields. Only send fields you want to change.

#### Response

**Success** (`200 OK`):
```json
{
  "id": "00000000-0000-0000-0000-000000000001",
  "language_code": "en",
  "language_name": "English",
  "voice_id": "2b568345-1f36-4cf8-baa7-5932856bf66a",
  "voice_provider_type": "tts",
  "display_name": "English - Professional (Updated)",
  "description": "Updated description",
  "default_greeting": "Updated greeting for {business_name}!",
  "default_instructions": "You are a professional assistant...",
  "is_active": true,
  "display_order": 10,
  "created_at": "2026-03-04T12:00:00.000Z",
  "updated_at": "2026-03-08T18:30:00.000Z",
  "updated_by": "admin-user-uuid-67890"
}
```

**Error** (`400 Bad Request` - Validation Failed):
```json
{
  "statusCode": 400,
  "message": [
    "display_name must be a string",
    "is_active must be a boolean value"
  ],
  "error": "Bad Request"
}
```

**Error** (`401 Unauthorized` - Missing or Invalid JWT):
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Error** (`403 Forbidden` - Not Platform Admin):
```json
{
  "statusCode": 403,
  "message": "Platform Admin access required.",
  "error": "Forbidden"
}
```

**Error** (`404 Not Found`):
```json
{
  "statusCode": 404,
  "message": "Global voice agent profile not found: 00000000-0000-0000-0000-000000000099",
  "error": "Not Found"
}
```

**Error** (`409 Conflict` - Display Name Already Exists):
```json
{
  "statusCode": 409,
  "message": "A global profile with display name \"English - Professional\" already exists.",
  "error": "Conflict"
}
```

#### Example

```bash
curl -X PATCH https://api.lead360.app/api/v1/system/voice-ai/agent-profiles/00000000-0000-0000-0000-000000000001 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "English - Professional (Updated)",
    "display_order": 10
  }'
```

---

### Delete Global Profile

**DELETE** `/api/v1/system/voice-ai/agent-profiles/:id`

Soft-deletes a global profile by setting `is_active = false`. **Cannot delete if tenant overrides exist** (protection against breaking active tenant configurations).

#### Request

**Headers**:
```
Authorization: Bearer {admin-jwt-token}
```

**Path Parameters**:
- `id` (required): UUID of the global profile to delete

#### Response

**Success** (`204 No Content`):
```
(Empty body)
```

**Error** (`400 Bad Request` - Profile in Use):
```json
{
  "statusCode": 400,
  "message": "Cannot delete global profile: 7 tenant override(s) exist. Remove overrides first.",
  "error": "Bad Request"
}
```

**Error** (`401 Unauthorized` - Missing or Invalid JWT):
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Error** (`403 Forbidden` - Not Platform Admin):
```json
{
  "statusCode": 403,
  "message": "Platform Admin access required.",
  "error": "Forbidden"
}
```

**Error** (`404 Not Found`):
```json
{
  "statusCode": 404,
  "message": "Global voice agent profile not found: 00000000-0000-0000-0000-000000000099",
  "error": "Not Found"
}
```

**Important Notes**:
- This is a **soft delete** (sets `is_active = false`, record remains in database)
- If `_count.tenant_overrides > 0`, deletion is blocked
- To permanently delete, tenants must first delete their overrides

#### Example

```bash
curl -X DELETE https://api.lead360.app/api/v1/system/voice-ai/agent-profiles/00000000-0000-0000-0000-000000000001 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Tenant Endpoints

**Base Path**: `/api/v1/voice-ai`

### Authentication

All tenant endpoints require:

- **Header**: `Authorization: Bearer {jwt-token}`
- **Tenant ID**: Automatically extracted from JWT (`req.user.tenant_id`)
- **Roles**: Varies by endpoint (specified in each endpoint documentation)

**Tenant Isolation**: All queries automatically filter by `tenant_id` from JWT. Tenants can only access their own overrides.

---

### List Available Global Profiles

**GET** `/api/v1/voice-ai/available-profiles`

Returns all global profiles available for selection and customization. Tenants use this endpoint to see available language/voice options before creating an override.

**Read-Only**: Tenants cannot modify global profiles (system admin managed).

#### Request

**Headers**:
```
Authorization: Bearer {tenant-jwt-token}
```

**Required Roles**: `Owner`, `Admin`, `Manager`

**Query Parameters**:
- `active_only` (optional): Boolean, default: `true`
  - `true` → Returns only `is_active = true` profiles
  - `false` → Returns all profiles (active and inactive)

#### Response

**Success** (`200 OK`):
```json
[
  {
    "id": "00000000-0000-0000-0000-000000000001",
    "language_code": "en",
    "language_name": "English",
    "voice_id": "2b568345-1f36-4cf8-baa7-5932856bf66a",
    "voice_provider_type": "tts",
    "display_name": "English - Professional",
    "description": "Professional English voice",
    "default_greeting": "Hello, thank you for calling {business_name}!",
    "default_instructions": "You are a professional assistant...",
    "is_active": true,
    "display_order": 1
  },
  {
    "id": "00000000-0000-0000-0000-000000000002",
    "language_code": "pt",
    "language_name": "Portuguese",
    "voice_id": "3c679456-2g47-5dg9-cbb8-6043967cg77b",
    "voice_provider_type": "tts",
    "display_name": "Portuguese - Friendly",
    "description": "Warm Portuguese voice",
    "default_greeting": "Olá! Obrigado por ligar...",
    "default_instructions": "Você é um assistente...",
    "is_active": true,
    "display_order": 2
  }
]
```

**Sorting**: Results sorted by `display_order ASC, language_name ASC`.

**Error** (`401 Unauthorized` - Missing or Invalid JWT):
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Error** (`403 Forbidden` - Insufficient Role):
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions. Required roles: Owner, Admin, Manager",
  "error": "Forbidden"
}
```

#### Example

```bash
# Get active global profiles (default)
curl -X GET https://api.lead360.app/api/v1/voice-ai/available-profiles \
  -H "Authorization: Bearer {tenant-jwt-token}"

# Get all global profiles (including inactive)
curl -X GET "https://api.lead360.app/api/v1/voice-ai/available-profiles?active_only=false" \
  -H "Authorization: Bearer {tenant-jwt-token}"
```

---

### Create Tenant Override

**POST** `/api/v1/voice-ai/agent-profile-overrides`

Creates a tenant override for a global voice agent profile, allowing customization of greeting and instructions for your business.

**Plan Limits**: Subject to `subscription_plan.voice_ai_max_agent_profiles` limit.

#### Request

**Headers**:
```
Authorization: Bearer {tenant-jwt-token}
Content-Type: application/json
```

**Required Roles**: `Owner`, `Admin`

**Body**:
```json
{
  "agent_profile_id": "00000000-0000-0000-0000-000000000001",
  "custom_greeting": "Welcome to ACME Plumbing! We're available 24/7 for emergencies. How can we help you today?",
  "custom_instructions": "You are a friendly phone assistant for ACME Plumbing. Always mention our 24/7 emergency service availability. If the caller has a plumbing emergency (burst pipe, no water, sewage backup), immediately offer to transfer to our on-call plumber. Be warm and reassuring.",
  "is_active": true
}
```

**Field Validation**:
- `agent_profile_id` (required): UUID of an active global profile
- `custom_greeting` (optional): Max 65,535 characters, supports `{business_name}` placeholder
- `custom_instructions` (optional): LongText, LLM system prompt customization
- `is_active` (optional): Boolean, default: `true`

**Business Rules**:
- Cannot create duplicate override for same `agent_profile_id` (one override per global profile)
- Global profile must be active (`is_active = true`)
- Cannot exceed plan limit (checked before creation)

#### Response

**Success** (`201 Created`):
```json
{
  "id": "tenant-override-uuid-12345",
  "tenant_id": "tenant-abc-123",
  "agent_profile_id": "00000000-0000-0000-0000-000000000001",
  "custom_greeting": "Welcome to ACME Plumbing! We're available 24/7 for emergencies. How can we help you today?",
  "custom_instructions": "You are a friendly phone assistant for ACME Plumbing...",
  "is_active": true,
  "display_order": 0,
  "created_at": "2026-03-08T14:00:00.000Z",
  "updated_at": "2026-03-08T14:00:00.000Z",
  "updated_by": "tenant-user-uuid-456",
  "agent_profile": {
    "id": "00000000-0000-0000-0000-000000000001",
    "language_code": "en",
    "language_name": "English",
    "display_name": "English - Professional",
    "default_greeting": "Hello, thank you for calling {business_name}!",
    "default_instructions": "You are a professional assistant..."
  }
}
```

**Error** (`400 Bad Request` - Validation Failed):
```json
{
  "statusCode": 400,
  "message": [
    "agent_profile_id must be a UUID",
    "custom_greeting must be a string"
  ],
  "error": "Bad Request"
}
```

**Error** (`400 Bad Request` - Global Profile Inactive):
```json
{
  "statusCode": 400,
  "message": "Cannot create override: Global profile is inactive.",
  "error": "Bad Request"
}
```

**Error** (`401 Unauthorized` - Missing or Invalid JWT):
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Error** (`403 Forbidden` - Insufficient Role):
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions. Required roles: Owner, Admin",
  "error": "Forbidden"
}
```

**Error** (`403 Forbidden` - Plan Limit Reached):
```json
{
  "statusCode": 403,
  "message": "Your plan allows a maximum of 1 active voice agent profile(s). You currently have 1 active. Deactivate or delete an existing profile, or upgrade your plan.",
  "error": "Forbidden"
}
```

**Error** (`404 Not Found` - Global Profile Not Found):
```json
{
  "statusCode": 404,
  "message": "Global voice agent profile not found: 00000000-0000-0000-0000-000000000099",
  "error": "Not Found"
}
```

**Error** (`409 Conflict` - Duplicate Override):
```json
{
  "statusCode": 409,
  "message": "Override already exists for global profile: English - Professional",
  "error": "Conflict"
}
```

#### Example

```bash
curl -X POST https://api.lead360.app/api/v1/voice-ai/agent-profile-overrides \
  -H "Authorization: Bearer {tenant-jwt-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_profile_id": "00000000-0000-0000-0000-000000000001",
    "custom_greeting": "Welcome to ACME Plumbing! Available 24/7.",
    "custom_instructions": "You are a friendly assistant for ACME Plumbing...",
    "is_active": true
  }'
```

---

### List Tenant Overrides

**GET** `/api/v1/voice-ai/agent-profile-overrides`

Returns all voice agent profile overrides for the authenticated tenant, with global profile details included.

#### Request

**Headers**:
```
Authorization: Bearer {tenant-jwt-token}
```

**Required Roles**: `Owner`, `Admin`, `Manager`

**Query Parameters**:
- `active_only` (optional): Boolean, default: `false`
  - `true` → Returns only `is_active = true` overrides
  - `false` → Returns all overrides

#### Response

**Success** (`200 OK`):
```json
[
  {
    "id": "tenant-override-uuid-12345",
    "tenant_id": "tenant-abc-123",
    "agent_profile_id": "00000000-0000-0000-0000-000000000001",
    "custom_greeting": "Welcome to ACME Plumbing!",
    "custom_instructions": "You are a friendly assistant...",
    "is_active": true,
    "display_order": 0,
    "created_at": "2026-03-08T14:00:00.000Z",
    "updated_at": "2026-03-08T14:00:00.000Z",
    "updated_by": "tenant-user-uuid-456",
    "agent_profile": {
      "id": "00000000-0000-0000-0000-000000000001",
      "language_code": "en",
      "language_name": "English",
      "display_name": "English - Professional",
      "default_greeting": "Hello, thank you for calling {business_name}!",
      "default_instructions": "You are a professional assistant...",
      "is_active": true
    }
  },
  {
    "id": "tenant-override-uuid-67890",
    "tenant_id": "tenant-abc-123",
    "agent_profile_id": "00000000-0000-0000-0000-000000000002",
    "custom_greeting": "Bem-vindo à ACME Encanamento!",
    "custom_instructions": "Você é um assistente amigável...",
    "is_active": false,
    "display_order": 0,
    "created_at": "2026-03-07T10:00:00.000Z",
    "updated_at": "2026-03-08T12:00:00.000Z",
    "updated_by": "tenant-user-uuid-789",
    "agent_profile": {
      "id": "00000000-0000-0000-0000-000000000002",
      "language_code": "pt",
      "language_name": "Portuguese",
      "display_name": "Portuguese - Friendly",
      "default_greeting": "Olá!",
      "default_instructions": "Você é um assistente...",
      "is_active": true
    }
  }
]
```

**Empty Response** (no overrides):
```json
[]
```

**Error** (`401 Unauthorized` - Missing or Invalid JWT):
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Error** (`403 Forbidden` - Insufficient Role):
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions. Required roles: Owner, Admin, Manager",
  "error": "Forbidden"
}
```

#### Example

```bash
# Get all overrides
curl -X GET https://api.lead360.app/api/v1/voice-ai/agent-profile-overrides \
  -H "Authorization: Bearer {tenant-jwt-token}"

# Get only active overrides
curl -X GET "https://api.lead360.app/api/v1/voice-ai/agent-profile-overrides?active_only=true" \
  -H "Authorization: Bearer {tenant-jwt-token}"
```

---

### Get Single Tenant Override

**GET** `/api/v1/voice-ai/agent-profile-overrides/:id`

Returns details of a specific tenant override with global profile information.

#### Request

**Headers**:
```
Authorization: Bearer {tenant-jwt-token}
```

**Required Roles**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `id` (required): UUID of the override

#### Response

**Success** (`200 OK`):
```json
{
  "id": "tenant-override-uuid-12345",
  "tenant_id": "tenant-abc-123",
  "agent_profile_id": "00000000-0000-0000-0000-000000000001",
  "custom_greeting": "Welcome to ACME Plumbing!",
  "custom_instructions": "You are a friendly assistant...",
  "is_active": true,
  "display_order": 0,
  "created_at": "2026-03-08T14:00:00.000Z",
  "updated_at": "2026-03-08T14:00:00.000Z",
  "updated_by": "tenant-user-uuid-456",
  "agent_profile": {
    "id": "00000000-0000-0000-0000-000000000001",
    "language_code": "en",
    "language_name": "English",
    "display_name": "English - Professional",
    "default_greeting": "Hello, thank you for calling {business_name}!",
    "default_instructions": "You are a professional assistant...",
    "voice_id": "2b568345-1f36-4cf8-baa7-5932856bf66a",
    "is_active": true
  }
}
```

**Error** (`401 Unauthorized` - Missing or Invalid JWT):
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Error** (`403 Forbidden` - Insufficient Role):
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions. Required roles: Owner, Admin, Manager",
  "error": "Forbidden"
}
```

**Error** (`404 Not Found`):
```json
{
  "statusCode": 404,
  "message": "Voice agent profile override not found or access denied.",
  "error": "Not Found"
}
```

**Note**: Returns 404 if override doesn't exist OR belongs to a different tenant (tenant isolation).

#### Example

```bash
curl -X GET https://api.lead360.app/api/v1/voice-ai/agent-profile-overrides/tenant-override-uuid-12345 \
  -H "Authorization: Bearer {tenant-jwt-token}"
```

---

### Update Tenant Override

**PATCH** `/api/v1/voice-ai/agent-profile-overrides/:id`

Updates a tenant override. Only fields included in the request body are updated (partial update).

**Important**: `agent_profile_id` is **immutable** and cannot be changed after creation.

#### Request

**Headers**:
```
Authorization: Bearer {tenant-jwt-token}
Content-Type: application/json
```

**Required Roles**: `Owner`, `Admin`

**Path Parameters**:
- `id` (required): UUID of the override to update

**Body** (all fields optional):
```json
{
  "custom_greeting": "Updated greeting for {business_name}!",
  "custom_instructions": "Updated instructions...",
  "is_active": true
}
```

**Allowed Fields**:
- `custom_greeting` (optional): Max 65,535 characters
- `custom_instructions` (optional): LongText
- `is_active` (optional): Boolean

**Immutable Fields** (cannot be updated):
- `agent_profile_id` (set at creation, cannot change)
- `tenant_id` (derived from JWT)

#### Response

**Success** (`200 OK`):
```json
{
  "id": "tenant-override-uuid-12345",
  "tenant_id": "tenant-abc-123",
  "agent_profile_id": "00000000-0000-0000-0000-000000000001",
  "custom_greeting": "Updated greeting for {business_name}!",
  "custom_instructions": "Updated instructions...",
  "is_active": true,
  "display_order": 0,
  "created_at": "2026-03-08T14:00:00.000Z",
  "updated_at": "2026-03-08T18:45:00.000Z",
  "updated_by": "tenant-user-uuid-999",
  "agent_profile": {
    "id": "00000000-0000-0000-0000-000000000001",
    "language_code": "en",
    "display_name": "English - Professional"
  }
}
```

**Error** (`400 Bad Request` - Validation Failed):
```json
{
  "statusCode": 400,
  "message": [
    "custom_greeting must be a string",
    "is_active must be a boolean value"
  ],
  "error": "Bad Request"
}
```

**Error** (`401 Unauthorized` - Missing or Invalid JWT):
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Error** (`403 Forbidden` - Insufficient Role):
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions. Required roles: Owner, Admin",
  "error": "Forbidden"
}
```

**Error** (`404 Not Found`):
```json
{
  "statusCode": 404,
  "message": "Voice agent profile override not found or access denied.",
  "error": "Not Found"
}
```

#### Example

```bash
curl -X PATCH https://api.lead360.app/api/v1/voice-ai/agent-profile-overrides/tenant-override-uuid-12345 \
  -H "Authorization: Bearer {tenant-jwt-token}" \
  -H "Content-Type: application/json" \
  -d '{
    "custom_greeting": "Updated greeting!",
    "is_active": true
  }'
```

---

### Delete Tenant Override

**DELETE** `/api/v1/voice-ai/agent-profile-overrides/:id`

Deletes a tenant override. This is a **hard delete** (permanent removal from database).

**Note**: Deleting an override does NOT affect the global profile. Other tenants using the same global profile are unaffected.

#### Request

**Headers**:
```
Authorization: Bearer {tenant-jwt-token}
```

**Required Roles**: `Owner`, `Admin`

**Path Parameters**:
- `id` (required): UUID of the override to delete

#### Response

**Success** (`204 No Content`):
```
(Empty body)
```

**Error** (`401 Unauthorized` - Missing or Invalid JWT):
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Error** (`403 Forbidden` - Insufficient Role):
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions. Required roles: Owner, Admin",
  "error": "Forbidden"
}
```

**Error** (`404 Not Found`):
```json
{
  "statusCode": 404,
  "message": "Voice agent profile override not found or access denied.",
  "error": "Not Found"
}
```

#### Example

```bash
curl -X DELETE https://api.lead360.app/api/v1/voice-ai/agent-profile-overrides/tenant-override-uuid-12345 \
  -H "Authorization: Bearer {tenant-jwt-token}"
```

---

## Common Error Responses

All endpoints follow consistent error response format:

### 400 Bad Request

**Cause**: Invalid input, validation failed, or business rule violation.

**Example** (Validation Error):
```json
{
  "statusCode": 400,
  "message": [
    "language_code must be a string",
    "language_code must be longer than or equal to 2 characters",
    "voice_id should not be empty"
  ],
  "error": "Bad Request"
}
```

**Example** (Business Rule Violation):
```json
{
  "statusCode": 400,
  "message": "Cannot delete global profile: 7 tenant override(s) exist. Remove overrides first.",
  "error": "Bad Request"
}
```

---

### 401 Unauthorized

**Cause**: Missing JWT token or invalid/expired token.

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Resolution**: Provide valid JWT token in `Authorization: Bearer {token}` header.

---

### 403 Forbidden

**Cause**: Valid JWT but insufficient permissions or plan limit exceeded.

**Example** (Not Platform Admin):
```json
{
  "statusCode": 403,
  "message": "Platform Admin access required.",
  "error": "Forbidden"
}
```

**Example** (Plan Limit):
```json
{
  "statusCode": 403,
  "message": "Your plan allows a maximum of 1 active voice agent profile(s). You currently have 1 active. Deactivate or delete an existing profile, or upgrade your plan.",
  "error": "Forbidden"
}
```

**Example** (Insufficient Role):
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions. Required roles: Owner, Admin",
  "error": "Forbidden"
}
```

---

### 404 Not Found

**Cause**: Resource doesn't exist or access denied due to tenant isolation.

```json
{
  "statusCode": 404,
  "message": "Global voice agent profile not found: 00000000-0000-0000-0000-000000000099",
  "error": "Not Found"
}
```

```json
{
  "statusCode": 404,
  "message": "Voice agent profile override not found or access denied.",
  "error": "Not Found"
}
```

**Note**: Tenant endpoints return 404 for both "not found" and "belongs to different tenant" to prevent information leakage.

---

### 409 Conflict

**Cause**: Resource already exists (duplicate unique field).

**Example** (Duplicate Display Name):
```json
{
  "statusCode": 409,
  "message": "A global profile with display name \"English - Professional\" already exists.",
  "error": "Conflict"
}
```

**Example** (Duplicate Override):
```json
{
  "statusCode": 409,
  "message": "Override already exists for global profile: English - Professional",
  "error": "Conflict"
}
```

---

## Changelog

| Version | Date        | Changes                                                                                          |
|---------|-------------|--------------------------------------------------------------------------------------------------|
| 2.0     | March 2026  | **Architecture redesign**: Global profiles (admin-managed) + tenant overrides (tenant-managed). Replaced direct tenant profile creation with override system. Added plan limit enforcement. |
| 1.0     | March 2026  | Initial implementation (deprecated). Tenants created profiles directly.                          |

---

## Migration Notes (v1 → v2)

**What Changed**:
- **v1**: Tenants created their own voice agent profiles directly
- **v2**: Admins create global profiles; tenants create overrides to customize

**Data Migration**:
- Existing tenant profiles migrated to `tenant_voice_agent_profile_override` table
- Corresponding global profiles created with default settings
- All IVR configurations updated to reference global profiles

**API Consumer Impact**:
- Old endpoint `/voice-ai/agent-profiles` (tenant CRUD) → Deprecated
- New endpoints:
  - Admin: `/system/voice-ai/agent-profiles` (global profile management)
  - Tenant: `/voice-ai/available-profiles` (read-only list)
  - Tenant: `/voice-ai/agent-profile-overrides` (tenant customizations)

**Plan Limits**:
- Now enforced on **active overrides**, not profile creation
- Check `subscription_plan.voice_ai_max_agent_profiles`

---

## Support

**Questions or Issues?**
- Technical support: dev@lead360.app
- API documentation issues: Open GitHub issue
- Feature requests: Contact product team

**Swagger/OpenAPI**:
- Interactive API docs: `https://api.lead360.app/api/docs`
- OpenAPI spec: `https://api.lead360.app/api/docs-json`

---

**End of Voice AI Agent Profiles REST API Documentation**

*Last verified: March 8, 2026*
