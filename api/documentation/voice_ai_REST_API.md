# Voice AI Module — REST API Documentation

**Version**: 1.0
**Last Updated**: February 2026
**Base URL**: `https://api.lead360.app/api/v1`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Common Response Formats](#common-response-formats)
4. [Error Codes](#error-codes)
5. [Admin Infrastructure Endpoints](#admin-infrastructure-endpoints)
   - [Providers](#providers)
   - [Credentials](#credentials)
   - [Global Config](#global-config)
   - [Subscription Plans](#subscription-plans)
6. [Admin Monitoring Endpoints](#admin-monitoring-endpoints)
   - [GET /system/voice-ai/tenants](#get-apiv1systemvoice-aitenantsmanual)
   - [PATCH /system/voice-ai/tenants/:tenantId/override](#patch-apiv1systemvoice-aitenantstenantidoverride)
   - [GET /system/voice-ai/call-logs](#get-apiv1systemvoice-aicall-logs)
   - [GET /system/voice-ai/usage-report](#get-apiv1systemvoice-aiusage-report)
7. [Tenant Endpoints](#tenant-endpoints)
   - [GET /voice-ai/settings](#get-apiv1voice-aisettings)
   - [PUT /voice-ai/settings](#put-apiv1voice-aisettings)
   - [GET /voice-ai/transfer-numbers](#get-apiv1voice-aitransfer-numbers)
   - [POST /voice-ai/transfer-numbers](#post-apiv1voice-aitransfer-numbers)
   - [POST /voice-ai/transfer-numbers/reorder](#post-apiv1voice-aitransfer-numbersreorder)
   - [PATCH /voice-ai/transfer-numbers/:id](#patch-apiv1voice-aitransfer-numbersid)
   - [DELETE /voice-ai/transfer-numbers/:id](#delete-apiv1voice-aitransfer-numbersid)
   - [GET /voice-ai/call-logs](#get-apiv1voice-aicall-logs)
   - [GET /voice-ai/call-logs/:id](#get-apiv1voice-aicall-logsid)
   - [GET /voice-ai/usage](#get-apiv1voice-aiusage)
8. [Internal Agent Endpoints](#internal-agent-endpoints)
   - [API-026: GET /internal/voice-ai/tenant/:tenantId/access](#api-026-get-apiv1internalvoice-aitenanttenant-idaccess)
   - [API-022: GET /internal/voice-ai/tenant/:tenantId/context](#api-022-get-apiv1internalvoice-aitenanttenant-idcontext)
   - [API-024: POST /internal/voice-ai/calls/start](#api-024-post-apiv1internalvoice-aicallsstart)
   - [API-030: POST /internal/voice-ai/calls/:callSid/complete](#api-030-post-apiv1internalvoice-aicallscallsidcomplete)
   - [API-027: POST /internal/voice-ai/tenant/:tenantId/tools/:tool](#api-027-post-apiv1internalvoice-aitenanttenant-idtoolstool)
9. [FullVoiceAiContext Schema Reference](#fullvoiceaicontext-schema-reference)
10. [Extended Error Reference](#extended-error-reference)

---

## Overview

The Voice AI module adds AI-powered phone agents to Lead360 that answer calls for tenant businesses 24/7. The agent talks naturally, books appointments, collects lead information, and transfers calls using tenant-configured behavior layered on top of platform-managed infrastructure.

**Managed service model**: Lead360 controls all AI provider keys, costs, and infrastructure. Tenants control only their greeting, languages, and transfer numbers.

### Key Features

- **Provider Registry**: Supports Deepgram (STT), OpenAI (LLM), Cartesia (TTS) with JSON Schema-driven configuration
- **Encrypted Credentials**: AES-256-GCM encrypted API keys — never exposed in responses after storage
- **Global Config Singleton**: One platform-wide configuration row (`id = "default"`) drives all default behavior
- **Subscription Plan Integration**: Voice AI enabled/disabled and minute quotas are per-plan fields
- **Agent API Key**: Single shared secret for Python agent authentication — regeneratable without downtime

### Architecture: Two-Layer Configuration Model

```
LAYER 1 — INFRASTRUCTURE (Platform Admin Only)
├── Which STT provider (Deepgram)
├── Which LLM provider (OpenAI)
├── Which TTS provider (Cartesia)
├── API keys (AES-256-GCM encrypted)
├── LiveKit SIP trunk URL + credentials
├── Agent authentication key (SHA-256 hashed)
└── Minutes limits per subscription plan tier

LAYER 2 — BEHAVIOR (Tenant Admin)
├── Enable/disable toggle
├── Languages
├── Greeting message
├── Agent instructions (system prompt additions)
├── Transfer numbers (up to 10)
├── Lead creation enabled
├── Appointment booking enabled
└── Max call duration
```

### Call Flow

```
Customer calls tenant's Twilio number
         ↓
Existing IVR menu (Press 1, Press 2, Press 3 for AI Assistant)
         ↓ (presses 3)
IVR checks: voice_ai_enabled + quota > 0
         ↓ (pass)
TwiML <Dial><Sip> to LiveKit SIP trunk
  ?tenantId=abc&callSid=xyz
         ↓
Python agent joins LiveKit room
         ↓
Agent calls GET /internal/voice-ai/tenant/:tenantId/context
         ↓
STT → LLM → TTS conversation loop
         ↓
Actions: create_lead | book_appointment | transfer_call
         ↓
Call ends → agent calls POST /internal/voice-ai/calls/:callSid/complete
         ↓
Usage recorded → call log finalized
```

---

## Authentication

### Base URLs

| Environment | URL |
|-------------|-----|
| Production | `https://api.lead360.app/api/v1` |
| Development | `http://localhost:8000/api/v1` |

### Auth Methods by Endpoint Group

| Endpoint Group | Auth Method | Header | Requirement |
|----------------|-------------|--------|-------------|
| Admin Infrastructure | JWT Bearer | `Authorization: Bearer {token}` | `is_platform_admin: true` |
| Admin Monitoring | JWT Bearer | `Authorization: Bearer {token}` | `is_platform_admin: true` |
| Tenant | JWT Bearer | `Authorization: Bearer {token}` | Any authenticated tenant user |
| Internal (Python Agent) | API Key | `X-Voice-Agent-Key: {key}` | Key matches `agent_api_key_hash` |
| Webhooks (LiveKit) | HMAC Signature | `X-LiveKit-Signature: {sig}` | Valid LiveKit signature |

All admin endpoints require `is_platform_admin: true` on the user account. Tenant user tokens (users with a `tenant_id`) will receive `401 Unauthorized` on all `/system/voice-ai/` routes.

### Obtaining a JWT Token

```bash
curl -X POST https://api.lead360.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourdomain.com","password":"your_admin_password"}'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "user": {
    "id": "bc5b3363-ebe5-46fb-adac-53f8ed75a28d",
    "email": "admin@yourdomain.com",
    "first_name": "Admin",
    "last_name": "User",
    "tenant_id": null,
    "roles": [],
    "is_platform_admin": true,
    "email_verified": true,
    "last_login_at": "2026-02-17T19:26:38.853Z",
    "created_at": "2026-01-05T18:49:39.118Z"
  }
}
```

---

## Common Response Formats

### Success (200 OK)

```json
{
  "id": "uuid",
  "...": "resource fields"
}
```

### Created (201 Created)

```json
{
  "id": "new-uuid",
  "...": "resource fields",
  "created_at": "2026-02-17T22:15:40.318Z"
}
```

### No Content (204 No Content)

Empty response body. Used for successful DELETE operations.

### Error Response Shape

```json
{
  "statusCode": 404,
  "errorCode": "RESOURCE_NOT_FOUND",
  "message": "Provider with ID \"uuid\" not found",
  "error": "Not Found",
  "timestamp": "2026-02-17T22:17:34.081Z",
  "path": "/api/v1/system/voice-ai/credentials/uuid",
  "requestId": "req_488ac000f3124103"
}
```

---

## Error Codes

| Status Code | Meaning | When It Occurs |
|-------------|---------|----------------|
| `400` | Bad Request | Validation failure, missing required fields, invalid enum value |
| `401` | Unauthorized | Missing or invalid JWT token, or token belongs to non-admin user |
| `404` | Not Found | Requested resource does not exist |
| `409` | Conflict | Duplicate `provider_key` on create |
| `500` | Internal Server Error | Unexpected server error |

---

## Admin Infrastructure Endpoints

> **Auth required for all endpoints in this section**: JWT Bearer token with `is_platform_admin: true`.

---

## Providers

Provider records define the AI service vendors available on the platform. Lead360 ships with three seeded providers: `deepgram` (STT), `openai` (LLM), `cartesia` (TTS).

### Provider Object Shape

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string (UUID)` | Unique identifier |
| `provider_key` | `string` | Unique machine key, e.g. `deepgram`, `openai`, `cartesia` |
| `provider_type` | `"STT" \| "LLM" \| "TTS"` | Service category |
| `display_name` | `string` | Human-readable name shown in the admin UI |
| `description` | `string \| null` | Optional description |
| `logo_url` | `string \| null` | URL to provider logo for display |
| `documentation_url` | `string \| null` | URL to provider's official docs |
| `capabilities` | `string \| null` | JSON array string, e.g. `["streaming","multilingual"]` |
| `config_schema` | `string \| null` | JSON Schema string that drives the dynamic configuration form in FSA03 |
| `default_config` | `string \| null` | JSON object string with default values matching `config_schema` |
| `pricing_info` | `string \| null` | JSON object string with pricing details |
| `is_active` | `boolean` | `false` = soft-deleted (hidden from agent context) |
| `created_at` | `string (ISO 8601)` | Creation timestamp |
| `updated_at` | `string (ISO 8601)` | Last update timestamp |

#### `config_schema` Field

The `config_schema` field stores a [JSON Schema](https://json-schema.org/) definition as a string. It drives the **dynamic configuration form** in the frontend admin panel (FSA03). Each provider's schema defines which fields are configurable, their types, allowed values, and defaults.

**Example — Deepgram STT config_schema:**
```json
{
  "type": "object",
  "properties": {
    "model": {
      "type": "string",
      "enum": ["nova-2", "nova-2-general", "nova-2-phonecall"],
      "default": "nova-2"
    },
    "punctuate": {
      "type": "boolean",
      "default": true
    },
    "interim_results": {
      "type": "boolean",
      "default": true
    }
  }
}
```

**Example — OpenAI LLM config_schema:**
```json
{
  "type": "object",
  "properties": {
    "model": {
      "type": "string",
      "enum": ["gpt-4o-mini", "gpt-4o"],
      "default": "gpt-4o-mini"
    },
    "temperature": {
      "type": "number",
      "minimum": 0,
      "maximum": 2,
      "default": 0.7
    },
    "max_tokens": {
      "type": "integer",
      "minimum": 100,
      "maximum": 4096,
      "default": 500
    }
  }
}
```

**Example — Cartesia TTS config_schema:**
```json
{
  "type": "object",
  "properties": {
    "model": {
      "type": "string",
      "enum": ["sonic-english", "sonic-multilingual"],
      "default": "sonic-english"
    },
    "speed": {
      "type": "number",
      "minimum": 0.5,
      "maximum": 2,
      "default": 1
    }
  }
}
```

---

### `GET /api/v1/system/voice-ai/providers`

List all AI providers registered on the platform.

**Auth**: JWT Bearer, `is_platform_admin: true`

**Request Body**: None

**Query Parameters**: None

**Response**: `200 OK` — Array of provider objects (including inactive/soft-deleted)

**Curl Example**:
```bash
TOKEN=$(curl -s -X POST https://api.lead360.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourdomain.com","password":"your_admin_password"}' | jq -r '.access_token')

curl https://api.lead360.app/api/v1/system/voice-ai/providers \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response**:
```json
[
  {
    "id": "2490153d-160e-49a1-a0db-ddc12bcbec9f",
    "provider_key": "openai",
    "provider_type": "LLM",
    "display_name": "OpenAI",
    "description": "GPT-4o-mini optimized for low-latency voice conversations",
    "logo_url": "https://openai.com/favicon.ico",
    "documentation_url": "https://platform.openai.com/docs",
    "capabilities": "[\"function_calling\",\"streaming\",\"multilingual\"]",
    "config_schema": "{\"type\":\"object\",\"properties\":{\"model\":{\"type\":\"string\",\"enum\":[\"gpt-4o-mini\",\"gpt-4o\"],\"default\":\"gpt-4o-mini\"},\"temperature\":{\"type\":\"number\",\"minimum\":0,\"maximum\":2,\"default\":0.7},\"max_tokens\":{\"type\":\"integer\",\"minimum\":100,\"maximum\":4096,\"default\":500}}}",
    "default_config": "{\"model\":\"gpt-4o-mini\",\"temperature\":0.7,\"max_tokens\":500}",
    "pricing_info": null,
    "is_active": true,
    "created_at": "2026-02-17T18:15:19.700Z",
    "updated_at": "2026-02-17T18:29:33.329Z"
  },
  {
    "id": "a8a5b151-c7c6-435a-930d-249e41868997",
    "provider_key": "deepgram",
    "provider_type": "STT",
    "display_name": "Deepgram",
    "description": "State-of-the-art speech recognition with Nova-2 model",
    "logo_url": "https://deepgram.com/favicon.ico",
    "documentation_url": "https://developers.deepgram.com",
    "capabilities": "[\"streaming\",\"multilingual\",\"punctuation\",\"diarization\"]",
    "config_schema": "{\"type\":\"object\",\"properties\":{\"model\":{\"type\":\"string\",\"enum\":[\"nova-2\",\"nova-2-general\",\"nova-2-phonecall\"],\"default\":\"nova-2\"},\"punctuate\":{\"type\":\"boolean\",\"default\":true},\"interim_results\":{\"type\":\"boolean\",\"default\":true}}}",
    "default_config": "{\"model\":\"nova-2\",\"punctuate\":true,\"interim_results\":true}",
    "pricing_info": null,
    "is_active": true,
    "created_at": "2026-02-17T18:15:19.690Z",
    "updated_at": "2026-02-17T18:29:33.324Z"
  },
  {
    "id": "ae9093bd-2f28-4b97-a240-f91bfe43f0c6",
    "provider_key": "cartesia",
    "provider_type": "TTS",
    "display_name": "Cartesia",
    "description": "Ultra-low latency neural text-to-speech with natural voices",
    "logo_url": "https://cartesia.ai/favicon.ico",
    "documentation_url": "https://docs.cartesia.ai",
    "capabilities": "[\"streaming\",\"voice_cloning\",\"multilingual\",\"emotion\"]",
    "config_schema": "{\"type\":\"object\",\"properties\":{\"model\":{\"type\":\"string\",\"enum\":[\"sonic-english\",\"sonic-multilingual\"],\"default\":\"sonic-english\"},\"speed\":{\"type\":\"number\",\"minimum\":0.5,\"maximum\":2,\"default\":1}}}",
    "default_config": "{\"model\":\"sonic-english\",\"speed\":1,\"emotion\":[]}",
    "pricing_info": null,
    "is_active": true,
    "created_at": "2026-02-17T18:15:19.704Z",
    "updated_at": "2026-02-17T18:29:33.334Z"
  }
]
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `401` | `Unauthorized` | Missing or invalid JWT token |

---

### `POST /api/v1/system/voice-ai/providers`

Create a new AI provider in the registry.

**Auth**: JWT Bearer, `is_platform_admin: true`

**Request Body**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `provider_key` | `string` | Yes | max 50 chars, unique | Machine key, e.g. `elevenlabs`. Used as identifier in code. |
| `provider_type` | `"STT" \| "LLM" \| "TTS"` | Yes | enum | Service category: Speech-to-Text, Large Language Model, Text-to-Speech |
| `display_name` | `string` | Yes | max 100 chars | Human-readable name shown in admin UI |
| `description` | `string` | No | — | Optional description of what the provider does |
| `logo_url` | `string` | No | valid URL | URL to the provider logo for display |
| `documentation_url` | `string` | No | valid URL | URL to provider's official documentation |
| `capabilities` | `string` | No | JSON array string | Array of capability strings, e.g. `["streaming","multilingual"]` |
| `config_schema` | `string` | No | JSON Schema string | JSON Schema definition that drives the dynamic config form in FSA03 |
| `default_config` | `string` | No | JSON object string | Default values matching the `config_schema` properties |
| `pricing_info` | `string` | No | JSON object string | Pricing metadata for admin reference |
| `is_active` | `boolean` | No | — | Default: `true`. Set to `false` to create disabled |

**Request Body Example**:
```json
{
  "provider_key": "elevenlabs",
  "provider_type": "TTS",
  "display_name": "ElevenLabs",
  "description": "High-quality neural text-to-speech with voice cloning",
  "logo_url": "https://elevenlabs.io/favicon.ico",
  "documentation_url": "https://docs.elevenlabs.io",
  "capabilities": "[\"voice_cloning\",\"multilingual\",\"streaming\"]",
  "config_schema": "{\"type\":\"object\",\"properties\":{\"model_id\":{\"type\":\"string\",\"default\":\"eleven_turbo_v2\"},\"stability\":{\"type\":\"number\",\"minimum\":0,\"maximum\":1,\"default\":0.5}}}",
  "default_config": "{\"model_id\":\"eleven_turbo_v2\",\"stability\":0.5}",
  "is_active": true
}
```

**Response**: `201 Created` — The created provider object

**Curl Example**:
```bash
curl -X POST https://api.lead360.app/api/v1/system/voice-ai/providers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_key": "elevenlabs",
    "provider_type": "TTS",
    "display_name": "ElevenLabs",
    "description": "High-quality neural text-to-speech with voice cloning",
    "is_active": false
  }'
```

**Example Response**:
```json
{
  "id": "814806d5-b45d-4788-838a-c5cc67d7fe10",
  "provider_key": "elevenlabs",
  "provider_type": "TTS",
  "display_name": "ElevenLabs",
  "description": "High-quality neural text-to-speech with voice cloning",
  "logo_url": null,
  "documentation_url": null,
  "capabilities": null,
  "config_schema": null,
  "default_config": null,
  "pricing_info": null,
  "is_active": false,
  "created_at": "2026-02-17T22:15:40.318Z",
  "updated_at": "2026-02-17T22:15:40.318Z"
}
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `400` | `provider_key must be shorter than or equal to 50 characters, provider_key should not be empty, ...` | Missing required fields or validation failure |
| `401` | `Unauthorized` | Missing or invalid JWT token |
| `409` | `Provider key 'deepgram' already exists` | A provider with this `provider_key` already exists |

---

### `PATCH /api/v1/system/voice-ai/providers/:id`

Update an existing provider's fields. All fields are optional — only provided fields are updated.

**Auth**: JWT Bearer, `is_platform_admin: true`

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string (UUID)` | Yes | Provider UUID |

**Request Body**: Same fields as `POST`, all optional (partial update):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider_key` | `string` | No | max 50 chars |
| `provider_type` | `"STT" \| "LLM" \| "TTS"` | No | Service category |
| `display_name` | `string` | No | max 100 chars |
| `description` | `string` | No | — |
| `logo_url` | `string` | No | valid URL |
| `documentation_url` | `string` | No | valid URL |
| `capabilities` | `string` | No | JSON array string |
| `config_schema` | `string` | No | JSON Schema string |
| `default_config` | `string` | No | JSON object string |
| `pricing_info` | `string` | No | JSON object string |
| `is_active` | `boolean` | No | Toggle active status |

**Request Body Example**:
```json
{
  "display_name": "ElevenLabs TTS",
  "is_active": false
}
```

**Response**: `200 OK` — The updated provider object

**Curl Example**:
```bash
curl -X PATCH https://api.lead360.app/api/v1/system/voice-ai/providers/814806d5-b45d-4788-838a-c5cc67d7fe10 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"display_name": "ElevenLabs TTS", "is_active": false}'
```

**Example Response**:
```json
{
  "id": "814806d5-b45d-4788-838a-c5cc67d7fe10",
  "provider_key": "elevenlabs",
  "provider_type": "TTS",
  "display_name": "ElevenLabs TTS",
  "description": "High-quality neural text-to-speech with voice cloning",
  "logo_url": null,
  "documentation_url": null,
  "capabilities": null,
  "config_schema": null,
  "default_config": null,
  "pricing_info": null,
  "is_active": false,
  "created_at": "2026-02-17T22:15:40.318Z",
  "updated_at": "2026-02-17T22:15:40.354Z"
}
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `400` | Validation message | Invalid field values |
| `401` | `Unauthorized` | Missing or invalid JWT token |
| `404` | `Provider {id} not found` | Provider UUID does not exist |

---

### `DELETE /api/v1/system/voice-ai/providers/:id`

Soft-delete a provider by setting `is_active = false`. The provider record is retained in the database but will not be available to the agent context builder.

**Auth**: JWT Bearer, `is_platform_admin: true`

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string (UUID)` | Yes | Provider UUID to soft-delete |

**Request Body**: None

**Response**: `204 No Content` — Empty body on success

**Curl Example**:
```bash
curl -X DELETE https://api.lead360.app/api/v1/system/voice-ai/providers/814806d5-b45d-4788-838a-c5cc67d7fe10 \
  -H "Authorization: Bearer $TOKEN"
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `401` | `Unauthorized` | Missing or invalid JWT token |
| `404` | `Provider {id} not found` | Provider UUID does not exist |

---

## Credentials

Credentials store the encrypted API keys for each AI provider. Each provider has at most one credential row (UNIQUE on `provider_id`). API keys are encrypted with AES-256-GCM before storage and are **never returned in plaintext** after being saved — only the last 4 characters are shown.

### Credential Object Shape (masked — returned by API)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string (UUID)` | Credential record UUID |
| `provider_id` | `string (UUID)` | FK to `voice_ai_provider.id` |
| `provider_key` | `string` | Provider key for display (e.g. `deepgram`) |
| `masked_key` | `string` | Last 4 chars visible, e.g. `****7890` |
| `updated_by` | `string (UUID)` | Admin user ID who last saved the credential |
| `updated_at` | `string (ISO 8601)` | When the credential was last saved |

> **Security Note**: The plaintext API key is **never** stored or returned. Only the `masked_key` (last 4 characters) is visible after saving. The encrypted value is only decrypted at agent call-time by `EncryptionService.decrypt()` and is never cached.

---

### `GET /api/v1/system/voice-ai/credentials`

List all stored credentials (masked keys only). Returns one entry per provider that has credentials configured.

**Auth**: JWT Bearer, `is_platform_admin: true`

**Request Body**: None

**Query Parameters**: None

**Response**: `200 OK` — Array of masked credential objects

**Curl Example**:
```bash
curl https://api.lead360.app/api/v1/system/voice-ai/credentials \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response**:
```json
[
  {
    "id": "4d4b70a5-a041-41bf-af30-c37d39a928af",
    "provider_id": "a8a5b151-c7c6-435a-930d-249e41868997",
    "provider_key": "deepgram",
    "masked_key": "****7890",
    "updated_by": "bc5b3363-ebe5-46fb-adac-53f8ed75a28d",
    "updated_at": "2026-02-17T22:16:21.994Z"
  }
]
```

Empty array `[]` when no credentials have been configured.

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `401` | `Unauthorized` | Missing or invalid JWT token |

---

### `PUT /api/v1/system/voice-ai/credentials/:providerId`

Create or replace the API key credential for a specific provider. This is an **upsert** operation — if credentials already exist for this provider, they are replaced. The key is encrypted with AES-256-GCM before storage.

**Auth**: JWT Bearer, `is_platform_admin: true`

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `providerId` | `string (UUID)` | Yes | UUID of the provider to set credentials for |

**Request Body**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `api_key` | `string` | Yes | min 10 chars | The plaintext API key to encrypt and store. Never logged or returned. |

**Request Body Example**:
```json
{
  "api_key": "dg_prod_1234567890abcdef..."
}
```

**Response**: `200 OK` — Masked credential object (plaintext key is NOT returned)

**Curl Example**:
```bash
curl -X PUT https://api.lead360.app/api/v1/system/voice-ai/credentials/a8a5b151-c7c6-435a-930d-249e41868997 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"api_key": "dg_prod_1234567890abcdef"}'
```

**Example Response**:
```json
{
  "id": "4d4b70a5-a041-41bf-af30-c37d39a928af",
  "provider_id": "a8a5b151-c7c6-435a-930d-249e41868997",
  "provider_key": "deepgram",
  "masked_key": "****cdef",
  "updated_by": "bc5b3363-ebe5-46fb-adac-53f8ed75a28d",
  "updated_at": "2026-02-17T22:16:21.994Z"
}
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `400` | `api_key must be longer than or equal to 10 characters` | Key is too short |
| `401` | `Unauthorized` | Missing or invalid JWT token |
| `404` | `Provider with ID "{id}" not found` | No provider with that UUID |

---

### `DELETE /api/v1/system/voice-ai/credentials/:providerId`

Remove the stored credential for a provider. After deletion, the provider will not have a working API key until a new credential is added via `PUT`.

**Auth**: JWT Bearer, `is_platform_admin: true`

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `providerId` | `string (UUID)` | Yes | UUID of the provider whose credential should be removed |

**Request Body**: None

**Response**: `204 No Content` — Empty body on success

**Curl Example**:
```bash
curl -X DELETE https://api.lead360.app/api/v1/system/voice-ai/credentials/a8a5b151-c7c6-435a-930d-249e41868997 \
  -H "Authorization: Bearer $TOKEN"
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `401` | `Unauthorized` | Missing or invalid JWT token |
| `404` | `No credential found for provider ID "{id}"` | No credential exists for that provider |

---

## Global Config

The global config is a **singleton** — exactly one row exists in the database with `id = "default"`. It stores platform-wide defaults for all AI providers, LiveKit infrastructure settings, and the agent API key (hashed). Every call by the Python agent that fetches tenant context uses these defaults as the base configuration layer.

### Global Config Object Shape (masked — returned by API)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Always `"default"` |
| `default_stt_provider_id` | `string (UUID) \| null` | FK to `voice_ai_provider.id` for default STT |
| `default_llm_provider_id` | `string (UUID) \| null` | FK to `voice_ai_provider.id` for default LLM |
| `default_tts_provider_id` | `string (UUID) \| null` | FK to `voice_ai_provider.id` for default TTS |
| `default_stt_config` | `string \| null` | JSON object string overriding provider defaults for STT |
| `default_llm_config` | `string \| null` | JSON object string overriding provider defaults for LLM |
| `default_tts_config` | `string \| null` | JSON object string overriding provider defaults for TTS |
| `default_voice_id` | `string \| null` | Cartesia voice ID used by default for TTS |
| `default_language` | `string` | BCP-47 language code for the default language, e.g. `"en"` |
| `default_languages` | `string` | JSON array string of enabled languages, e.g. `"[\"en\",\"es\"]"` |
| `default_greeting_template` | `string` | Default greeting. Supports `{business_name}` placeholder. |
| `default_system_prompt` | `string` | Base system prompt prepended to all agent conversations |
| `default_max_call_duration_seconds` | `integer` | Maximum call duration in seconds (default: 600 = 10 min) |
| `default_transfer_behavior` | `string` | What happens after transfer: `end_call \| voicemail \| hold` |
| `default_tools_enabled` | `string` | JSON object string: `{"booking":true,"lead_creation":true,"call_transfer":true}` |
| `livekit_sip_trunk_url` | `string \| null` | LiveKit SIP trunk URL, e.g. `sip.livekit.cloud` |
| `livekit_api_key_set` | `boolean` | `true` if LiveKit API key has been saved (key itself never returned) |
| `livekit_api_secret_set` | `boolean` | `true` if LiveKit API secret has been saved (secret never returned) |
| `agent_api_key_preview` | `string \| null` | Last 4 chars of the agent API key, e.g. `"...59d4"`. `null` if key has never been generated. |
| `max_concurrent_calls` | `integer` | Platform-wide max concurrent AI calls (default: 100) |
| `updated_at` | `string (ISO 8601)` | When the config was last updated |
| `updated_by` | `string (UUID) \| null` | Admin user ID who last updated the config |

> **Security Note**: `livekit_api_key`, `livekit_api_secret`, and the full agent API key are **never returned** in the response. The booleans `livekit_api_key_set` and `livekit_api_secret_set` indicate whether these values have been stored. Only `agent_api_key_preview` (last 4 chars) is shown.

---

### `GET /api/v1/system/voice-ai/config`

Retrieve the platform-wide global Voice AI configuration (singleton row).

**Auth**: JWT Bearer, `is_platform_admin: true`

**Request Body**: None

**Query Parameters**: None

**Response**: `200 OK` — Global config object (all sensitive values masked)

**Curl Example**:
```bash
curl https://api.lead360.app/api/v1/system/voice-ai/config \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response**:
```json
{
  "id": "default",
  "default_stt_provider_id": null,
  "default_llm_provider_id": null,
  "default_tts_provider_id": null,
  "default_stt_config": null,
  "default_llm_config": null,
  "default_tts_config": null,
  "default_voice_id": null,
  "default_language": "en",
  "default_languages": "[\"en\"]",
  "default_greeting_template": "Hello, thank you for calling {business_name}! How can I help you today?",
  "default_system_prompt": "You are a helpful phone assistant. Be concise, friendly, and professional.",
  "default_max_call_duration_seconds": 600,
  "default_transfer_behavior": "end_call",
  "default_tools_enabled": "{\"booking\":true,\"lead_creation\":true,\"call_transfer\":true}",
  "livekit_sip_trunk_url": null,
  "livekit_api_key_set": false,
  "livekit_api_secret_set": false,
  "agent_api_key_preview": "...59d4",
  "max_concurrent_calls": 100,
  "updated_at": "2026-02-17T22:16:44.832Z",
  "updated_by": "bc5b3363-ebe5-46fb-adac-53f8ed75a28d"
}
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `401` | `Unauthorized` | Missing or invalid JWT token |

---

### `PATCH /api/v1/system/voice-ai/config`

Update one or more fields of the global Voice AI configuration. All fields are optional — only provided fields are updated. The singleton row is always updated (never created via this endpoint).

**Auth**: JWT Bearer, `is_platform_admin: true`

**Request Body** (all fields optional):

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `default_stt_provider_id` | `string (UUID) \| null` | — | Set default STT provider. `null` clears the selection. |
| `default_llm_provider_id` | `string (UUID) \| null` | — | Set default LLM provider. `null` clears the selection. |
| `default_tts_provider_id` | `string (UUID) \| null` | — | Set default TTS provider. `null` clears the selection. |
| `default_voice_id` | `string \| null` | — | Cartesia voice UUID for default TTS voice |
| `default_language` | `string` | max 10 chars, BCP-47 | Default language code, e.g. `"en"`, `"es"` |
| `default_languages` | `string` | JSON array string | Enabled languages as JSON array, e.g. `"[\"en\",\"es\"]"` |
| `default_greeting_template` | `string` | max 500 chars | Greeting template. Use `{business_name}` as placeholder. |
| `default_system_prompt` | `string` | max 2000 chars | Base system prompt for all agents |
| `default_max_call_duration_seconds` | `integer` | 60–3600 | Max call duration in seconds |
| `default_transfer_behavior` | `string` | `end_call \| voicemail \| hold` | Behavior when transferring a call |
| `default_tools_enabled` | `string` | JSON object string | Enable/disable agent tools: `{"booking":true,"lead_creation":true,"call_transfer":true}` |
| `default_stt_config` | `string` | JSON object string | Override STT provider default config |
| `default_llm_config` | `string` | JSON object string | Override LLM provider default config |
| `default_tts_config` | `string` | JSON object string | Override TTS provider default config |
| `livekit_sip_trunk_url` | `string` | — | LiveKit SIP trunk URL, e.g. `sip.livekit.cloud` |
| `livekit_api_key` | `string` | — | LiveKit API key — encrypted at rest, **never returned** |
| `livekit_api_secret` | `string` | — | LiveKit API secret — encrypted at rest, **never returned** |
| `max_concurrent_calls` | `integer` | ≥ 1 | Platform-wide maximum concurrent Voice AI calls |

**Request Body Example**:
```json
{
  "default_stt_provider_id": "a8a5b151-c7c6-435a-930d-249e41868997",
  "default_llm_provider_id": "2490153d-160e-49a1-a0db-ddc12bcbec9f",
  "default_tts_provider_id": "ae9093bd-2f28-4b97-a240-f91bfe43f0c6",
  "default_language": "en",
  "default_greeting_template": "Hello, thank you for calling {business_name}! How can I assist you?",
  "default_max_call_duration_seconds": 600,
  "max_concurrent_calls": 100,
  "livekit_sip_trunk_url": "sip.livekit.cloud"
}
```

**Response**: `200 OK` — The updated global config object (all sensitive values masked)

**Curl Example**:
```bash
curl -X PATCH https://api.lead360.app/api/v1/system/voice-ai/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"default_language":"en","max_concurrent_calls":100}'
```

**Example Response**:
```json
{
  "id": "default",
  "default_stt_provider_id": null,
  "default_llm_provider_id": null,
  "default_tts_provider_id": null,
  "default_stt_config": null,
  "default_llm_config": null,
  "default_tts_config": null,
  "default_voice_id": null,
  "default_language": "en",
  "default_languages": "[\"en\"]",
  "default_greeting_template": "Hello, thank you for calling {business_name}! How can I help you today?",
  "default_system_prompt": "You are a helpful phone assistant. Be concise, friendly, and professional.",
  "default_max_call_duration_seconds": 600,
  "default_transfer_behavior": "end_call",
  "default_tools_enabled": "{\"booking\":true,\"lead_creation\":true,\"call_transfer\":true}",
  "livekit_sip_trunk_url": null,
  "livekit_api_key_set": false,
  "livekit_api_secret_set": false,
  "agent_api_key_preview": "...59d4",
  "max_concurrent_calls": 100,
  "updated_at": "2026-02-17T22:36:21.147Z",
  "updated_by": "bc5b3363-ebe5-46fb-adac-53f8ed75a28d"
}
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `400` | Validation message | Invalid field type or value out of range |
| `401` | `Unauthorized` | Missing or invalid JWT token |

---

### `POST /api/v1/system/voice-ai/config/regenerate-key`

Generate a new agent API key for authenticating Python agent requests. The plaintext key is returned **exactly once** in this response and is **never stored** — only its SHA-256 hash is saved in the database. After this call, only the last 4 characters are visible via `GET /config`.

> **Critical**: Copy and securely store the `plain_key` immediately. It cannot be retrieved after this response. If lost, regenerate again.

**Auth**: JWT Bearer, `is_platform_admin: true`

**Request Body**: None

**Response**: `200 OK`

| Field | Type | Description |
|-------|------|-------------|
| `plain_key` | `string` | The full plaintext API key. Returned **once only**. Copy immediately. |
| `preview` | `string` | Last 4 chars for UI display, e.g. `"...59d4"` |
| `warning` | `string` | Always `"Save this key now. It will not be shown again."` |

**Curl Example**:
```bash
curl -X POST https://api.lead360.app/api/v1/system/voice-ai/config/regenerate-key \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response**:
```json
{
  "plain_key": "5019605b-1585-4604-8548-ab29b33e59d4",
  "preview": "...59d4",
  "warning": "Save this key now. It will not be shown again."
}
```

**How the Python Agent Uses This Key**:

After regenerating, configure the Python agent with the new key and use it as:
```http
GET /api/v1/internal/voice-ai/tenant/{tenantId}/context
X-Voice-Agent-Key: 5019605b-1585-4604-8548-ab29b33e59d4
```

The server computes `SHA-256(plain_key)` and compares it to `agent_api_key_hash` in the global config row.

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `401` | `Unauthorized` | Missing or invalid JWT token |

---

## Subscription Plans

The Voice AI module extends the existing `subscription_plan` table with three fields: `voice_ai_enabled`, `voice_ai_minutes_included`, and `voice_ai_overage_rate`. These fields control whether tenants on a given plan can use Voice AI and how many minutes they receive per month.

### Plan Object Shape (Voice AI fields)

The `GET /plans` response returns the full plan record. The Voice AI-relevant fields are:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string (UUID)` | Plan UUID |
| `name` | `string` | Plan display name |
| `description` | `string \| null` | Plan description |
| `monthly_price` | `string (Decimal)` | Monthly price as decimal string |
| `annual_price` | `string (Decimal) \| null` | Annual price as decimal string |
| `is_active` | `boolean` | Whether plan is selectable by new tenants |
| `voice_ai_enabled` | `boolean` | Whether Voice AI feature is included in this plan |
| `voice_ai_minutes_included` | `integer` | Minutes of Voice AI included per month. `0` = none. |
| `voice_ai_overage_rate` | `string (Decimal) \| null` | Cost per minute (USD) beyond the included quota. `null` = calls blocked when quota exceeded (no overage allowed). |

### Minutes Quota Logic

```
Minutes used this month = SUM of voice_usage_record.usage_quantity
                         WHERE provider_type = 'STT'
                           AND tenant_id = tenant
                           AND year = current_year
                           AND month = current_month

Quota exceeded = minutes_used >= voice_ai_minutes_included
                 (taking into account monthly_minutes_override on tenant settings)

If quota_exceeded AND voice_ai_overage_rate IS NULL → call rejected
If quota_exceeded AND voice_ai_overage_rate IS NOT NULL → call allowed, billed at overage rate
```

---

### `GET /api/v1/system/voice-ai/plans`

List all subscription plans with their Voice AI configuration fields.

**Auth**: JWT Bearer, `is_platform_admin: true`

**Request Body**: None

**Query Parameters**: None

**Response**: `200 OK` — Array of subscription plan objects including Voice AI fields

**Curl Example**:
```bash
curl https://api.lead360.app/api/v1/system/voice-ai/plans \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response**:
```json
[
  {
    "id": "4a9f36ba-ab93-4f3a-975a-be009f5aa5c6",
    "name": "Básico",
    "description": "Básico",
    "monthly_price": "180",
    "annual_price": "1400",
    "is_active": true,
    "voice_ai_enabled": false,
    "voice_ai_minutes_included": 0,
    "voice_ai_overage_rate": null
  },
  {
    "id": "b873b601-ad6a-4528-be12-b1003ffedb8d",
    "name": "Plano do Meio",
    "description": "Plano profissional",
    "monthly_price": "700",
    "annual_price": "7000",
    "is_active": true,
    "voice_ai_enabled": false,
    "voice_ai_minutes_included": 0,
    "voice_ai_overage_rate": null
  },
  {
    "id": "71e3c818-5e7e-4793-86b3-eaaa403cf6a5",
    "name": "Professional Plan",
    "description": "Completeo",
    "monthly_price": "500",
    "annual_price": "4999",
    "is_active": true,
    "voice_ai_enabled": false,
    "voice_ai_minutes_included": 0,
    "voice_ai_overage_rate": null
  }
]
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `401` | `Unauthorized` | Missing or invalid JWT token |

---

### `PATCH /api/v1/system/voice-ai/plans/:planId/voice`

Update the Voice AI configuration fields on a specific subscription plan. Only the three Voice AI fields can be updated via this endpoint. All fields are optional.

**Auth**: JWT Bearer, `is_platform_admin: true`

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `planId` | `string (UUID)` | Yes | Subscription plan UUID |

**Request Body** (all fields optional):

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `voice_ai_enabled` | `boolean` | — | Enable or disable Voice AI for this plan. When `false`, tenants on this plan cannot enable Voice AI. |
| `voice_ai_minutes_included` | `integer` | ≥ 0 | Number of Voice AI minutes included per month. `0` disables usage even if `voice_ai_enabled` is `true`. |
| `voice_ai_overage_rate` | `number \| null` | ≥ 0 | Per-minute cost (USD) for minutes beyond the included quota. `null` blocks calls when quota is exceeded. |

**Request Body Example** — Enable with 500 minutes and $0.05/min overage:
```json
{
  "voice_ai_enabled": true,
  "voice_ai_minutes_included": 500,
  "voice_ai_overage_rate": 0.05
}
```

**Request Body Example** — Enable with 100 minutes, no overage (block when exceeded):
```json
{
  "voice_ai_enabled": true,
  "voice_ai_minutes_included": 100,
  "voice_ai_overage_rate": null
}
```

**Response**: `200 OK` — The full updated subscription plan object

**Curl Example**:
```bash
curl -X PATCH https://api.lead360.app/api/v1/system/voice-ai/plans/4a9f36ba-ab93-4f3a-975a-be009f5aa5c6/voice \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"voice_ai_enabled": true, "voice_ai_minutes_included": 500, "voice_ai_overage_rate": 0.05}'
```

**Example Response**:
```json
{
  "id": "4a9f36ba-ab93-4f3a-975a-be009f5aa5c6",
  "name": "Básico",
  "description": "Básico",
  "monthly_price": "180",
  "annual_price": "1400",
  "max_users": 5,
  "max_storage_gb": "1",
  "offers_trial": true,
  "trial_days": 5,
  "feature_flags": "{\"dashboard\":true,\"timeclock\":true,\"payments\":true,\"reports\":true,\"settings\":true,\"files\":true}",
  "is_active": true,
  "is_default": false,
  "created_at": "2026-01-15T22:57:54.080Z",
  "updated_at": "2026-02-17T22:17:11.827Z",
  "voice_ai_enabled": true,
  "voice_ai_minutes_included": 500,
  "voice_ai_overage_rate": "0.05"
}
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `400` | Validation message | Invalid field values, e.g. negative minutes |
| `401` | `Unauthorized` | Missing or invalid JWT token |
| `404` | `Subscription plan "{planId}" not found` | Plan UUID does not exist |

---

## Quick Reference

### All 12 Admin Infrastructure Endpoints

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `GET` | `/api/v1/system/voice-ai/providers` | List all providers | `200` Array |
| `POST` | `/api/v1/system/voice-ai/providers` | Create provider | `201` Object |
| `PATCH` | `/api/v1/system/voice-ai/providers/:id` | Update provider | `200` Object |
| `DELETE` | `/api/v1/system/voice-ai/providers/:id` | Soft-delete provider | `204` Empty |
| `GET` | `/api/v1/system/voice-ai/credentials` | List masked credentials | `200` Array |
| `PUT` | `/api/v1/system/voice-ai/credentials/:providerId` | Upsert encrypted credential | `200` Object |
| `DELETE` | `/api/v1/system/voice-ai/credentials/:providerId` | Remove credential | `204` Empty |
| `GET` | `/api/v1/system/voice-ai/config` | Get global config (masked) | `200` Object |
| `PATCH` | `/api/v1/system/voice-ai/config` | Update global config | `200` Object |
| `POST` | `/api/v1/system/voice-ai/config/regenerate-key` | Regenerate agent API key | `200` Object |
| `GET` | `/api/v1/system/voice-ai/plans` | List plans with voice flags | `200` Array |
| `PATCH` | `/api/v1/system/voice-ai/plans/:planId/voice` | Update plan voice config | `200` Object |

### Seeded Provider IDs (Development)

| Provider | Type | UUID |
|----------|------|------|
| `deepgram` | STT | `a8a5b151-c7c6-435a-930d-249e41868997` |
| `openai` | LLM | `2490153d-160e-49a1-a0db-ddc12bcbec9f` |
| `cartesia` | TTS | `ae9093bd-2f28-4b97-a240-f91bfe43f0c6` |

> **Note**: These UUIDs are valid for the development environment. Production IDs will differ.

---

## Admin Monitoring Endpoints

> **Auth required for all endpoints in this section**: JWT Bearer token with `is_platform_admin: true`.
>
> **Sprint**: B11 | **Frontend**: FSA04, FSA05

These endpoints give platform admins full visibility into every tenant's Voice AI usage, call history, and allow force-overriding per-tenant settings without touching the subscription plan.

---

## Tenant Voice AI Overview

### Tenant Overview Object Shape

| Field | Type | Description |
|-------|------|-------------|
| `tenant_id` | `string (UUID)` | Tenant UUID |
| `company_name` | `string` | Tenant's business name |
| `plan_name` | `string \| null` | Name of the subscription plan the tenant is on. `null` if tenant has no plan. |
| `voice_ai_included_in_plan` | `boolean` | Whether the tenant's plan includes Voice AI |
| `is_enabled` | `boolean` | Whether Voice AI is currently enabled for this tenant |
| `minutes_included` | `integer` | Monthly minutes quota (from plan or admin override) |
| `minutes_used` | `integer` | STT minutes consumed this calendar month |
| `has_admin_override` | `boolean` | `true` if any admin override field is set on this tenant |

---

### `GET /api/v1/system/voice-ai/tenants`

List all tenants with their Voice AI summary. Supports full-text search and pagination.

**Auth**: JWT Bearer, `is_platform_admin: true`

**Request Body**: None

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `integer` | `1` | Page number (1-based) |
| `limit` | `integer` | `20` | Results per page (max 100) |
| `search` | `string` | — | Optional. Filters by `company_name` (case-insensitive partial match) |

**Response**: `200 OK` — Paginated list of tenant Voice AI overview objects

**Curl Example**:
```bash
TOKEN=$(curl -s -X POST https://api.lead360.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourdomain.com","password":"your_password"}' | jq -r '.access_token')

# List all tenants
curl "https://api.lead360.app/api/v1/system/voice-ai/tenants" \
  -H "Authorization: Bearer $TOKEN"

# Search with pagination
curl "https://api.lead360.app/api/v1/system/voice-ai/tenants?page=1&limit=10&search=honey" \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response**:
```json
{
  "data": [
    {
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "company_name": "Honeydo4You Contractor",
      "plan_name": "Plano do Meio",
      "voice_ai_included_in_plan": true,
      "is_enabled": true,
      "minutes_included": 500,
      "minutes_used": 47,
      "has_admin_override": true
    },
    {
      "tenant_id": "8b89e71a-0916-326e-150d-7a09a7d30c63",
      "company_name": "MDX Roofing",
      "plan_name": "Básico",
      "voice_ai_included_in_plan": false,
      "is_enabled": false,
      "minutes_included": 0,
      "minutes_used": 0,
      "has_admin_override": false
    }
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `401` | `Unauthorized` | Missing or invalid JWT token |
| `403` | `Forbidden` | Authenticated user is not a platform admin |

---

### `PATCH /api/v1/system/voice-ai/tenants/:tenantId/override`

Apply admin-level overrides to a specific tenant's Voice AI settings. This operates independently of the tenant's own settings and the subscription plan. Used to grant temporary access, test configurations, or apply special per-tenant provider routing.

**Null values remove overrides** — sending `null` for any field reverts it to the plan/global default.

**Auth**: JWT Bearer, `is_platform_admin: true`

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenantId` | `string (UUID)` | Yes | UUID of the tenant to override |

**Request Body** (all fields optional):

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `force_enabled` | `boolean \| null` | — | `true` = force enable regardless of plan. `false` = force disable. `null` = remove override (tenant controls their own toggle again). |
| `monthly_minutes_override` | `integer \| null` | ≥ 0 | Override the monthly minute quota for this tenant. `null` removes override and reverts to plan default. |
| `stt_provider_override_id` | `string (UUID) \| null` | Valid provider UUID | Override which STT provider this tenant uses. `null` removes override. |
| `llm_provider_override_id` | `string (UUID) \| null` | Valid provider UUID | Override which LLM provider this tenant uses. `null` removes override. |
| `tts_provider_override_id` | `string (UUID) \| null` | Valid provider UUID | Override which TTS provider this tenant uses. `null` removes override. |
| `admin_notes` | `string \| null` | — | Internal admin note explaining the reason for the override. `null` clears the note. |

**Request Body Examples**:

Apply override — grant 1,000 minutes and route to specific providers:
```json
{
  "force_enabled": true,
  "monthly_minutes_override": 1000,
  "stt_provider_override_id": "a8a5b151-c7c6-435a-930d-249e41868997",
  "llm_provider_override_id": "2490153d-160e-49a1-a0db-ddc12bcbec9f",
  "admin_notes": "Enterprise trial — approved by CEO on 2026-02-17"
}
```

Remove all overrides (revert tenant to plan defaults):
```json
{
  "force_enabled": null,
  "monthly_minutes_override": null,
  "stt_provider_override_id": null,
  "llm_provider_override_id": null,
  "tts_provider_override_id": null,
  "admin_notes": null
}
```

**Response**: `204 No Content` — Empty body on success. The tenant's settings row is upserted atomically.

**Curl Example**:
```bash
curl -X PATCH https://api.lead360.app/api/v1/system/voice-ai/tenants/14a34ab2-6f6f-4e41-9bea-c444a304557e/override \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "force_enabled": true,
    "monthly_minutes_override": 200,
    "admin_notes": "Test override for dev"
  }'
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `400` | Validation message | Invalid field values (e.g. negative minutes, non-UUID provider ID) |
| `401` | `Unauthorized` | Missing or invalid JWT token |
| `403` | `Forbidden` | Authenticated user is not a platform admin |
| `404` | `Tenant with id "{tenantId}" not found` | Tenant UUID does not exist |

---

## Admin Call Logs

### `GET /api/v1/system/voice-ai/call-logs`

Cross-tenant paginated call log. Returns call records from all tenants. Supports filtering by tenant, date range, and outcome.

**Auth**: JWT Bearer, `is_platform_admin: true`

**Request Body**: None

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tenantId` | `string (UUID)` | — | Optional. Filter logs to a specific tenant only |
| `from` | `string (ISO 8601)` | — | Optional. Filter calls starting on or after this datetime. Example: `2026-01-01` |
| `to` | `string (ISO 8601)` | — | Optional. Filter calls starting on or before this datetime. Example: `2026-02-28` |
| `outcome` | `string` | — | Optional. Filter by call outcome: `completed`, `transferred`, `voicemail`, `abandoned`, `error` |
| `page` | `integer` | `1` | Page number (1-based) |
| `limit` | `integer` | `20` | Results per page (max 100) |

**Response**: `200 OK` — Paginated list of call log objects

**Call Log Object Shape**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string (UUID)` | Call log UUID |
| `tenant_id` | `string (UUID)` | FK to the tenant whose AI agent handled this call |
| `call_sid` | `string` | Twilio CallSid — globally unique call identifier |
| `from_number` | `string` | Caller's phone number (E.164) |
| `to_number` | `string` | Tenant's Twilio number (E.164) |
| `direction` | `"inbound" \| "outbound"` | Call direction (always `inbound` for AI-answered calls) |
| `status` | `"in_progress" \| "completed"` | Call status |
| `outcome` | `"completed" \| "transferred" \| "voicemail" \| "abandoned" \| "error" \| null` | How the call ended. `null` if call is still in progress |
| `is_overage` | `boolean` | `true` if this call consumed overage minutes beyond the plan quota |
| `duration_seconds` | `integer \| null` | Call duration in seconds. `null` if call is still in progress |
| `transcript_summary` | `string \| null` | AI-generated summary of the conversation |
| `full_transcript` | `string \| null` | Full STT output of the conversation |
| `actions_taken` | `string[] \| null` | Actions the agent took, e.g. `["lead_created", "appointment_booked"]` |
| `lead_id` | `string (UUID) \| null` | FK to the Lead record created or matched during this call |
| `stt_provider_id` | `string (UUID) \| null` | FK to the STT provider used |
| `llm_provider_id` | `string (UUID) \| null` | FK to the LLM provider used |
| `tts_provider_id` | `string (UUID) \| null` | FK to the TTS provider used |
| `started_at` | `string (ISO 8601)` | When the call started |
| `ended_at` | `string (ISO 8601) \| null` | When the call ended. `null` if in progress |
| `created_at` | `string (ISO 8601)` | Record creation timestamp |

**Curl Example**:
```bash
# All call logs (cross-tenant)
curl "https://api.lead360.app/api/v1/system/voice-ai/call-logs" \
  -H "Authorization: Bearer $TOKEN"

# Filter by tenant and date range
curl "https://api.lead360.app/api/v1/system/voice-ai/call-logs?tenantId=14a34ab2-6f6f-4e41-9bea-c444a304557e&from=2026-01-01&to=2026-02-28&outcome=transferred&page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "a91c2f04-1234-5678-abcd-ef0123456789",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "call_sid": "CA1234567890abcdef1234567890abcdef",
      "from_number": "+13055559876",
      "to_number": "+13055551000",
      "direction": "inbound",
      "status": "completed",
      "outcome": "transferred",
      "is_overage": false,
      "duration_seconds": 127,
      "transcript_summary": "Caller asked about plumbing emergency service. Agent took details and transferred to on-call technician.",
      "full_transcript": "Agent: Hello, thank you for calling...",
      "actions_taken": ["lead_created"],
      "lead_id": "bb7c3a12-0001-4321-8765-abcdef012345",
      "stt_provider_id": "a8a5b151-c7c6-435a-930d-249e41868997",
      "llm_provider_id": "2490153d-160e-49a1-a0db-ddc12bcbec9f",
      "tts_provider_id": "ae9093bd-2f28-4b97-a240-f91bfe43f0c6",
      "started_at": "2026-02-15T14:32:01.000Z",
      "ended_at": "2026-02-15T14:34:08.000Z",
      "created_at": "2026-02-15T14:32:01.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

**Example Response (empty — no calls yet)**:
```json
{
  "data": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "total_pages": 0
  }
}
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `401` | `Unauthorized` | Missing or invalid JWT token |
| `403` | `Forbidden` | Authenticated user is not a platform admin |

---

## Admin Usage Report

### `GET /api/v1/system/voice-ai/usage-report`

Platform-wide aggregate usage report for a given year and month. Summarizes all tenants' Voice AI consumption, grouped by tenant, sorted by cost descending.

**Auth**: JWT Bearer, `is_platform_admin: true`

**Request Body**: None

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `year` | `integer` | Current year | Year to report on, e.g. `2026` |
| `month` | `integer` | Current month | Month to report on (1–12), e.g. `2` for February |

**Response**: `200 OK`

**Response Shape**:

| Field | Type | Description |
|-------|------|-------------|
| `year` | `integer` | Year of the report |
| `month` | `integer` | Month of the report (1–12) |
| `total_calls` | `integer` | Total Voice AI calls across all tenants for this month |
| `total_stt_seconds` | `number` | Total STT (speech-to-text) seconds processed across all tenants |
| `total_estimated_cost` | `number` | Total estimated USD cost across all tenants and providers |
| `by_tenant` | `TenantUsageSummary[]` | Per-tenant breakdown, sorted by `estimated_cost` descending |

**`TenantUsageSummary` fields**:

| Field | Type | Description |
|-------|------|-------------|
| `tenant_id` | `string (UUID)` | Tenant UUID |
| `tenant_name` | `string` | Tenant's business name |
| `total_calls` | `integer` | Number of calls this tenant had this month |
| `total_stt_seconds` | `number` | STT seconds used by this tenant |
| `estimated_cost` | `number` | Estimated USD cost for this tenant |

**Curl Example**:
```bash
curl "https://api.lead360.app/api/v1/system/voice-ai/usage-report?year=2026&month=2" \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response**:
```json
{
  "year": 2026,
  "month": 2,
  "total_calls": 0,
  "total_stt_seconds": 0,
  "total_estimated_cost": 0,
  "by_tenant": []
}
```

**Example Response with data**:
```json
{
  "year": 2026,
  "month": 2,
  "total_calls": 183,
  "total_stt_seconds": 14720,
  "total_estimated_cost": 12.34,
  "by_tenant": [
    {
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "tenant_name": "Honeydo4You Contractor",
      "total_calls": 112,
      "total_stt_seconds": 9480,
      "estimated_cost": 8.21
    },
    {
      "tenant_id": "8b89e71a-0916-326e-150d-7a09a7d30c63",
      "tenant_name": "MDX Roofing",
      "total_calls": 71,
      "total_stt_seconds": 5240,
      "estimated_cost": 4.13
    }
  ]
}
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `401` | `Unauthorized` | Missing or invalid JWT token |
| `403` | `Forbidden` | Authenticated user is not a platform admin |

---

## Tenant Endpoints

> **Auth required for all endpoints in this section**: JWT Bearer token for any authenticated tenant user.
>
> **Sprint**: B04, B05, B07 | **Frontend**: FTA01–FTA04
>
> `tenant_id` is derived from the JWT — it is NEVER accepted from the request body or query parameters. Tenant users can only access their own data.

---

## Tenant Voice AI Settings

Settings control the behavioral layer of the agent — greeting, language, instructions, and feature toggles. Infrastructure-level fields (provider IDs, minute quotas) are read-only for tenants and can only be set by admins via the override endpoint.

### Settings Object Shape (full response)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string (UUID)` | Settings record UUID |
| `tenant_id` | `string (UUID)` | Tenant UUID |
| `is_enabled` | `boolean` | Whether Voice AI agent is active for this tenant |
| `default_language` | `string` | Default BCP-47 language code, e.g. `"en"` |
| `enabled_languages` | `string` | JSON array string of enabled language codes, e.g. `"[\"en\",\"es\"]"` |
| `custom_greeting` | `string \| null` | Tenant's custom greeting. `null` = use global template |
| `custom_instructions` | `string \| null` | Extra instructions appended to the agent system prompt. `null` = none |
| `after_hours_behavior` | `string \| null` | Reserved — not currently used |
| `booking_enabled` | `boolean \| null` | Whether appointment booking is enabled. `null` = use global default |
| `lead_creation_enabled` | `boolean \| null` | Whether lead creation from calls is enabled. `null` = use global default |
| `transfer_enabled` | `boolean \| null` | Whether call transfer to human operator is enabled. `null` = use global default |
| `default_transfer_number` | `string \| null` | E.164 fallback transfer number. `null` = no fallback |
| `max_call_duration_seconds` | `integer \| null` | Max call duration override in seconds. `null` = use global default (600) |
| `monthly_minutes_override` | `integer \| null` | **Admin-set only** — custom minute quota. `null` = use plan quota |
| `admin_notes` | `string \| null` | **Admin-set only** — internal admin notes |
| `stt_provider_override_id` | `string (UUID) \| null` | **Admin-set only** — custom STT provider |
| `llm_provider_override_id` | `string (UUID) \| null` | **Admin-set only** — custom LLM provider |
| `tts_provider_override_id` | `string (UUID) \| null` | **Admin-set only** — custom TTS provider |
| `stt_config_override` | `string \| null` | **Admin-set only** — custom STT config JSON |
| `llm_config_override` | `string \| null` | **Admin-set only** — custom LLM config JSON |
| `tts_config_override` | `string \| null` | **Admin-set only** — custom TTS config JSON |
| `voice_id_override` | `string \| null` | **Admin-set only** — custom Cartesia voice UUID |
| `created_at` | `string (ISO 8601)` | Settings record creation timestamp |
| `updated_at` | `string (ISO 8601)` | Last update timestamp |
| `updated_by` | `string (UUID) \| null` | User ID who last updated (admin-only updates set this) |

---

### `GET /api/v1/voice-ai/settings`

Get the authenticated tenant's Voice AI behavior settings.

**Auth**: JWT Bearer, any authenticated tenant user

**Request Body**: None

**Query Parameters**: None

**Response**: `200 OK` — Full settings object, or `null` if the tenant has never saved settings (no `PUT` has been made and no admin override has been applied). Frontend should treat `null` as "all global defaults apply."

**Curl Example**:
```bash
TOKEN=$(curl -s -X POST https://api.lead360.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tenant@yourdomain.com","password":"your_password"}' | jq -r '.access_token')

curl https://api.lead360.app/api/v1/voice-ai/settings \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response**:
```json
{
  "id": "1fbafe10-a9b9-452e-88c1-c9b7243166a0",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "is_enabled": true,
  "default_language": "en",
  "enabled_languages": "[\"en\",\"es\"]",
  "custom_greeting": "Hello, thank you for calling! How can we help?",
  "custom_instructions": "Always ask if it is an emergency.",
  "after_hours_behavior": null,
  "booking_enabled": true,
  "lead_creation_enabled": true,
  "transfer_enabled": true,
  "default_transfer_number": null,
  "max_call_duration_seconds": null,
  "monthly_minutes_override": 200,
  "admin_notes": "Test override for dev",
  "stt_provider_override_id": null,
  "llm_provider_override_id": null,
  "tts_provider_override_id": null,
  "stt_config_override": null,
  "llm_config_override": null,
  "tts_config_override": null,
  "voice_id_override": null,
  "created_at": "2026-02-17T22:56:03.967Z",
  "updated_at": "2026-02-17T22:59:49.051Z",
  "updated_by": null
}
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `401` | `Unauthorized` | Missing or invalid JWT token |

---

### `PUT /api/v1/voice-ai/settings`

Create or update the tenant's Voice AI settings (upsert). Only behavior-layer fields can be set — infrastructure overrides are admin-only and will be ignored if sent.

If `is_enabled: true` is sent but the tenant's subscription plan does not include Voice AI, the request is rejected with `403 Forbidden`.

**Auth**: JWT Bearer, any authenticated tenant user

**Request Body** (all fields optional — upsert semantics):

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `is_enabled` | `boolean` | — | Enable or disable the Voice AI agent |
| `enabled_languages` | `string[]` | Array of strings | ISO 639-1 language codes. Example: `["en", "es"]` |
| `custom_greeting` | `string \| null` | max 500 chars | Custom greeting message. `null` reverts to global template. |
| `custom_instructions` | `string \| null` | max 2000 chars | Additional instructions appended to the agent system prompt. `null` clears. |
| `booking_enabled` | `boolean` | — | Allow the agent to book appointments |
| `lead_creation_enabled` | `boolean` | — | Allow the agent to create leads from calls |
| `transfer_enabled` | `boolean` | — | Allow the agent to transfer calls to a human |
| `default_transfer_number` | `string \| null` | E.164 format | Fallback transfer number, e.g. `+15551234567`. `null` clears. |
| `max_call_duration_seconds` | `integer \| null` | 60–3600 | Override max call duration in seconds. `null` uses global default (600). |

**Request Body Example**:
```json
{
  "is_enabled": true,
  "enabled_languages": ["en", "es"],
  "custom_greeting": "Hello, thank you for calling! How can we help?",
  "custom_instructions": "Always ask if the caller has an emergency first.",
  "booking_enabled": true,
  "lead_creation_enabled": true,
  "transfer_enabled": true
}
```

**Response**: `200 OK` — The full updated settings object

**Curl Example**:
```bash
curl -X PUT https://api.lead360.app/api/v1/voice-ai/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "is_enabled": true,
    "enabled_languages": ["en", "es"],
    "custom_greeting": "Hello, thank you for calling! How can we help?",
    "booking_enabled": true,
    "lead_creation_enabled": true,
    "transfer_enabled": true
  }'
```

**Example Response**: Same shape as `GET /voice-ai/settings` (see above).

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `400` | Validation message | Invalid field values (e.g. `max_call_duration_seconds` out of range) |
| `401` | `Unauthorized` | Missing or invalid JWT token |
| `403` | `Your current subscription plan does not include Voice AI. Please upgrade your plan to enable this feature.` | Tenant's plan does not have `voice_ai_enabled: true` and `is_enabled: true` was sent |

---

## Tenant Transfer Numbers

Transfer numbers define the phone numbers the Voice AI agent can use when transferring calls to human operators. Up to **10 transfer numbers** per tenant are supported. Numbers are ordered by `display_order` for display in the UI.

### Transfer Number Object Shape

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string (UUID)` | Transfer number UUID |
| `tenant_id` | `string (UUID)` | Tenant UUID (always the authenticated tenant) |
| `label` | `string` | Display name, e.g. `"Sales"`, `"Emergency"`, `"After Hours Support"` |
| `phone_number` | `string` | E.164 format, e.g. `"+13055551234"` |
| `transfer_type` | `"primary" \| "overflow" \| "after_hours" \| "emergency"` | How the agent uses this number (see Transfer Type Values below) |
| `description` | `string \| null` | Optional description |
| `is_default` | `boolean` | `true` = this number is used as the default when no other number matches |
| `display_order` | `integer` | Order in the UI. Lower number = shown first. Updated via `/reorder`. |
| `available_hours` | `string \| null` | JSON string defining operating hours per day (see Available Hours Format below) |
| `created_at` | `string (ISO 8601)` | Creation timestamp |
| `updated_at` | `string (ISO 8601)` | Last update timestamp |

### Transfer Type Values

| Value | When Used |
|-------|-----------|
| `primary` | Default routing — agent uses this first for general transfers |
| `overflow` | Used when the primary line is busy or unavailable |
| `after_hours` | Used outside of normal business hours (combine with `available_hours`) |
| `emergency` | Always available, overrides all other routing logic for urgent calls |

### `available_hours` JSON Format

The `available_hours` field is stored and returned as a **JSON string**. When sending via the API, pass it as a string (not an object). It defines per-day time-range windows using arrays of `[start, end]` pairs. Days not listed are treated as unavailable.

**Format** — each day maps to an array of `["HH:MM", "HH:MM"]` time windows:
```json
"{\"mon\":[[\"09:00\",\"17:00\"]],\"tue\":[[\"09:00\",\"17:00\"]],\"wed\":[[\"09:00\",\"17:00\"]],\"thu\":[[\"09:00\",\"17:00\"]],\"fri\":[[\"09:00\",\"17:00\"]]}"
```

When deserialized, this represents:
```json
{
  "mon": [["09:00", "17:00"]],
  "tue": [["09:00", "17:00"]],
  "wed": [["09:00", "17:00"]],
  "thu": [["09:00", "17:00"]],
  "fri": [["09:00", "17:00"]]
}
```

Multiple windows per day are supported (e.g. split shifts):
```json
{
  "mon": [["09:00", "12:00"], ["13:00", "17:00"]]
}
```

**Day keys**: `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`

**Time values**: 24-hour format `"HH:MM"`, e.g. `"09:00"`, `"17:30"`, `"00:00"`

---

### `GET /api/v1/voice-ai/transfer-numbers`

List all transfer numbers for the authenticated tenant, ordered by `display_order` ascending.

**Auth**: JWT Bearer, any authenticated tenant user

**Request Body**: None

**Query Parameters**: None

**Response**: `200 OK` — Array of transfer number objects (empty array if none configured)

**Curl Example**:
```bash
curl https://api.lead360.app/api/v1/voice-ai/transfer-numbers \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response**:
```json
[
  {
    "id": "aaa76176-d206-4499-b8ed-8df9031d5500",
    "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
    "label": "After Hours",
    "phone_number": "+13055558888",
    "transfer_type": "after_hours",
    "description": null,
    "is_default": false,
    "display_order": 1,
    "available_hours": "{\"mon\":[[\"09:00\",\"17:00\"]]}",
    "created_at": "2026-02-17T22:58:48.762Z",
    "updated_at": "2026-02-17T23:00:14.406Z"
  },
  {
    "id": "5a1d15f3-b4ba-4571-914b-87bd9089312e",
    "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
    "label": "Sales Team",
    "phone_number": "+13055551234",
    "transfer_type": "primary",
    "description": "Main sales line",
    "is_default": false,
    "display_order": 2,
    "available_hours": null,
    "created_at": "2026-02-17T22:58:28.174Z",
    "updated_at": "2026-02-17T23:00:14.406Z"
  }
]
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `401` | `Unauthorized` | Missing or invalid JWT token |

---

### `POST /api/v1/voice-ai/transfer-numbers`

Create a new transfer number for the authenticated tenant. Maximum 10 per tenant — creating beyond this limit returns `400`.

**Auth**: JWT Bearer, any authenticated tenant user

**Request Body**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `label` | `string` | Yes | max 100 chars | Display name, e.g. `"Sales"`, `"Support"`, `"Emergency"` |
| `phone_number` | `string` | Yes | E.164 format (`+` + 1–15 digits) | Phone number to transfer calls to |
| `transfer_type` | `"primary" \| "overflow" \| "after_hours" \| "emergency"` | No | enum | How the agent uses this number. Default: `"primary"`. |
| `description` | `string` | No | max 200 chars | Optional description |
| `is_default` | `boolean` | No | — | Default: `false`. Only one transfer number per tenant can be the default. |
| `display_order` | `integer` | No | ≥ 0 | Position in UI. Default: `0`. Lower value = higher priority. |
| `available_hours` | `string` | No | JSON string | Operating hours as JSON string (see `available_hours` format above) |

**Request Body Example**:
```json
{
  "label": "Sales",
  "phone_number": "+13055551234",
  "transfer_type": "primary",
  "is_default": false,
  "display_order": 1
}
```

**Request Body Example with available_hours**:
```json
{
  "label": "After Hours Support",
  "phone_number": "+13055558888",
  "transfer_type": "after_hours",
  "is_default": false,
  "display_order": 3,
  "available_hours": "{\"mon\":[[\"09:00\",\"17:00\"]],\"fri\":[[\"09:00\",\"15:00\"]]}"
}
```

**Response**: `201 Created` — The created transfer number object

**Curl Example**:
```bash
curl -X POST https://api.lead360.app/api/v1/voice-ai/transfer-numbers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Sales",
    "phone_number": "+13055551234",
    "transfer_type": "primary",
    "is_default": false,
    "display_order": 1
  }'
```

**Example Response**:
```json
{
  "id": "5a1d15f3-b4ba-4571-914b-87bd9089312e",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "label": "Sales",
  "phone_number": "+13055551234",
  "transfer_type": "primary",
  "description": null,
  "is_default": false,
  "display_order": 1,
  "available_hours": null,
  "created_at": "2026-02-17T22:58:28.174Z",
  "updated_at": "2026-02-17T22:58:28.174Z"
}
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `400` | `Maximum of 10 transfer numbers per tenant has been reached.` | Tenant already has 10 transfer numbers |
| `400` | Validation message | Missing required fields or invalid format |
| `401` | `Unauthorized` | Missing or invalid JWT token |

---

### `POST /api/v1/voice-ai/transfer-numbers/reorder`

Bulk-update the `display_order` of multiple transfer numbers in a single request. Used to support drag-and-drop reordering in the frontend UI (FTA02).

> ⚠️ **Route order matters**: `/reorder` is a static route registered **before** `/:id` in the controller. It will always be matched correctly.

**Auth**: JWT Bearer, any authenticated tenant user

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `items` | `ReorderItem[]` | Yes | Array of transfer number IDs with their new display_order values |

**`ReorderItem` shape**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string (UUID)` | Yes | Transfer number UUID |
| `display_order` | `integer` | Yes | New display order value |

**Request Body Example**:
```json
{
  "items": [
    { "id": "aaa76176-d206-4499-b8ed-8df9031d5500", "display_order": 1 },
    { "id": "5a1d15f3-b4ba-4571-914b-87bd9089312e", "display_order": 2 },
    { "id": "ccc12345-dead-beef-cafe-000000000001", "display_order": 3 }
  ]
}
```

**Response**: `200 OK` — Array of all transfer numbers in their new order

**Curl Example**:
```bash
curl -X POST https://api.lead360.app/api/v1/voice-ai/transfer-numbers/reorder \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"id": "aaa76176-d206-4499-b8ed-8df9031d5500", "display_order": 1},
      {"id": "5a1d15f3-b4ba-4571-914b-87bd9089312e", "display_order": 2}
    ]
  }'
```

**Example Response**: Array of updated transfer number objects (same shape as `GET /transfer-numbers`).

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `400` | Validation message | Missing `items` array or invalid item fields |
| `400` | `The following transfer number IDs do not belong to your account: {id1}, {id2}` | One or more IDs do not belong to this tenant |
| `400` | `Duplicate transfer number IDs are not allowed in a reorder request.` | Duplicate IDs in the items array |
| `401` | `Unauthorized` | Missing or invalid JWT token |

---

### `PATCH /api/v1/voice-ai/transfer-numbers/:id`

Update one or more fields of an existing transfer number. All fields are optional — only provided fields are updated.

**Auth**: JWT Bearer, any authenticated tenant user

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string (UUID)` | Yes | Transfer number UUID |

**Request Body** (all fields optional):

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `label` | `string` | — | New display label |
| `phone_number` | `string` | E.164 format | New phone number |
| `transfer_type` | `"primary" \| "overflow" \| "after_hours" \| "emergency"` | enum | New transfer type |
| `description` | `string \| null` | — | Description. `null` clears. |
| `is_default` | `boolean` | — | Toggle default status |
| `display_order` | `integer` | — | New display position |
| `available_hours` | `string \| null` | JSON string | New hours definition. `null` clears. |

**Request Body Example**:
```json
{
  "label": "Sales Team",
  "description": "Main sales line — Mon-Fri 9am-5pm"
}
```

**Response**: `200 OK` — The updated transfer number object

**Curl Example**:
```bash
curl -X PATCH https://api.lead360.app/api/v1/voice-ai/transfer-numbers/5a1d15f3-b4ba-4571-914b-87bd9089312e \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label": "Sales Team", "description": "Main sales line"}'
```

**Example Response**:
```json
{
  "id": "5a1d15f3-b4ba-4571-914b-87bd9089312e",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "label": "Sales Team",
  "phone_number": "+13055551234",
  "transfer_type": "primary",
  "description": "Main sales line",
  "is_default": false,
  "display_order": 2,
  "available_hours": null,
  "created_at": "2026-02-17T22:58:28.174Z",
  "updated_at": "2026-02-17T22:58:48.730Z"
}
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `400` | Validation message | Invalid field values |
| `401` | `Unauthorized` | Missing or invalid JWT token |
| `404` | `Transfer number with ID "{id}" not found.` | UUID does not exist or belongs to a different tenant |

---

### `DELETE /api/v1/voice-ai/transfer-numbers/:id`

Delete a transfer number permanently. Hard delete — the record is removed from the database.

**Auth**: JWT Bearer, any authenticated tenant user

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string (UUID)` | Yes | Transfer number UUID to delete |

**Request Body**: None

**Response**: `204 No Content` — Empty body on success

**Curl Example**:
```bash
curl -X DELETE https://api.lead360.app/api/v1/voice-ai/transfer-numbers/5a1d15f3-b4ba-4571-914b-87bd9089312e \
  -H "Authorization: Bearer $TOKEN"
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `401` | `Unauthorized` | Missing or invalid JWT token |
| `404` | `Transfer number with ID "{id}" not found.` | UUID does not exist or belongs to a different tenant |

---

## Tenant Call Logs

### `GET /api/v1/voice-ai/call-logs`

Paginated list of all Voice AI calls for the authenticated tenant. Returns calls in reverse-chronological order.

**Auth**: JWT Bearer, any authenticated tenant user

**Request Body**: None

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `from` | `string (ISO 8601)` | — | Optional. Filter calls started on or after this date/time |
| `to` | `string (ISO 8601)` | — | Optional. Filter calls started on or before this date/time |
| `outcome` | `string` | — | Optional. Filter by outcome: `completed`, `transferred`, `voicemail`, `abandoned`, `error` |
| `page` | `integer` | `1` | Page number (1-based) |
| `limit` | `integer` | `20` | Results per page (max 100) |

**Response**: `200 OK` — Paginated list of call log objects

**Curl Example**:
```bash
# All calls
curl "https://api.lead360.app/api/v1/voice-ai/call-logs" \
  -H "Authorization: Bearer $TOKEN"

# Filtered by date range and outcome
curl "https://api.lead360.app/api/v1/voice-ai/call-logs?from=2026-01-01&to=2026-02-28&outcome=transferred&page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response**:
```json
{
  "data": [
    {
      "id": "a91c2f04-1234-5678-abcd-ef0123456789",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "call_sid": "CA1234567890abcdef1234567890abcdef",
      "from_number": "+13055559876",
      "to_number": "+13055551000",
      "direction": "inbound",
      "status": "completed",
      "outcome": "transferred",
      "is_overage": false,
      "duration_seconds": 127,
      "transcript_summary": "Caller inquired about emergency plumbing. Agent created lead and transferred to on-call tech.",
      "full_transcript": null,
      "actions_taken": ["lead_created"],
      "lead_id": "bb7c3a12-0001-4321-8765-abcdef012345",
      "stt_provider_id": "a8a5b151-c7c6-435a-930d-249e41868997",
      "llm_provider_id": "2490153d-160e-49a1-a0db-ddc12bcbec9f",
      "tts_provider_id": "ae9093bd-2f28-4b97-a240-f91bfe43f0c6",
      "started_at": "2026-02-15T14:32:01.000Z",
      "ended_at": "2026-02-15T14:34:08.000Z",
      "created_at": "2026-02-15T14:32:01.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

**Example Response (empty)**:
```json
{
  "data": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "total_pages": 0
  }
}
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `401` | `Unauthorized` | Missing or invalid JWT token |

---

### `GET /api/v1/voice-ai/call-logs/:id`

Get full detail for a single call log, including the complete STT transcript.

**Auth**: JWT Bearer, any authenticated tenant user. Tenant can only access their own call logs.

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string (UUID)` | Yes | Call log UUID |

**Request Body**: None

**Response**: `200 OK` — Full call log object (same shape as list items — includes `full_transcript`)

**Curl Example**:
```bash
curl "https://api.lead360.app/api/v1/voice-ai/call-logs/a91c2f04-1234-5678-abcd-ef0123456789" \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response**:
```json
{
  "id": "a91c2f04-1234-5678-abcd-ef0123456789",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "call_sid": "CA1234567890abcdef1234567890abcdef",
  "from_number": "+13055559876",
  "to_number": "+13055551000",
  "direction": "inbound",
  "status": "completed",
  "outcome": "transferred",
  "is_overage": false,
  "duration_seconds": 127,
  "transcript_summary": "Caller inquired about emergency plumbing. Agent created lead and transferred to on-call tech.",
  "full_transcript": "Agent: Hello, thank you for calling! How can I help you today?\nCaller: Hi, I have a water leak...",
  "actions_taken": ["lead_created"],
  "lead_id": "bb7c3a12-0001-4321-8765-abcdef012345",
  "stt_provider_id": "a8a5b151-c7c6-435a-930d-249e41868997",
  "llm_provider_id": "2490153d-160e-49a1-a0db-ddc12bcbec9f",
  "tts_provider_id": "ae9093bd-2f28-4b97-a240-f91bfe43f0c6",
  "started_at": "2026-02-15T14:32:01.000Z",
  "ended_at": "2026-02-15T14:34:08.000Z",
  "created_at": "2026-02-15T14:32:01.000Z"
}
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `401` | `Unauthorized` | Missing or invalid JWT token |
| `404` | `Call log {id} not found` | UUID does not exist or belongs to a different tenant |

---

## Tenant Usage

### `GET /api/v1/voice-ai/usage`

Get the authenticated tenant's monthly Voice AI usage summary, broken down by AI provider type (STT, LLM, TTS).

**Auth**: JWT Bearer, any authenticated tenant user

**Request Body**: None

**Query Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `year` | `integer` | Current year | Year to report on, e.g. `2026` |
| `month` | `integer` | Current month | Month to report on (1–12), e.g. `2` for February |

**Response**: `200 OK`

**Response Shape**:

| Field | Type | Description |
|-------|------|-------------|
| `year` | `integer` | Year of the report |
| `month` | `integer` | Month of the report (1–12) |
| `total_calls` | `integer` | Total Voice AI calls this tenant had this month |
| `total_stt_seconds` | `number` | Total STT seconds processed (used for quota calculation) |
| `total_llm_tokens` | `number` | Total LLM tokens consumed |
| `total_tts_characters` | `number` | Total TTS characters converted to speech |
| `estimated_cost` | `number` | Total estimated USD cost across all providers |
| `by_provider` | `ProviderUsageSummary[]` | Per-provider breakdown (see below) |

**`ProviderUsageSummary` fields**:

| Field | Type | Description |
|-------|------|-------------|
| `provider_id` | `string (UUID)` | Provider UUID |
| `provider_type` | `"STT" \| "LLM" \| "TTS"` | Provider category |
| `provider_name` | `string` | Provider display name, e.g. `"Deepgram"` |
| `total_quantity` | `number` | Total usage quantity (unit depends on `unit` field) |
| `unit` | `"seconds" \| "tokens" \| "characters"` | Unit of measurement |
| `estimated_cost` | `number` | Estimated USD cost for this provider |

> **Quota**: The `total_stt_seconds / 60` value represents minutes used. To know the tenant's effective quota: if `GET /voice-ai/settings` returns a non-null `monthly_minutes_override`, that value is the quota; otherwise the quota comes from the subscription plan's `voice_ai_minutes_included` field. Minutes remaining = quota - (total_stt_seconds / 60). Quota exceeded when minutes used ≥ quota and the plan has no overage rate.

**Curl Example**:
```bash
# Current month (defaults)
curl "https://api.lead360.app/api/v1/voice-ai/usage" \
  -H "Authorization: Bearer $TOKEN"

# Specific month
curl "https://api.lead360.app/api/v1/voice-ai/usage?year=2026&month=2" \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response (no usage yet)**:
```json
{
  "year": 2026,
  "month": 2,
  "total_calls": 0,
  "total_stt_seconds": 0,
  "total_llm_tokens": 0,
  "total_tts_characters": 0,
  "estimated_cost": 0,
  "by_provider": []
}
```

**Example Response (with usage data)**:
```json
{
  "year": 2026,
  "month": 2,
  "total_calls": 47,
  "total_stt_seconds": 2820,
  "total_llm_tokens": 148500,
  "total_tts_characters": 94200,
  "estimated_cost": 3.22,
  "by_provider": [
    {
      "provider_id": "a8a5b151-c7c6-435a-930d-249e41868997",
      "provider_type": "STT",
      "provider_name": "Deepgram",
      "total_quantity": 2820,
      "unit": "seconds",
      "estimated_cost": 0.98
    },
    {
      "provider_id": "2490153d-160e-49a1-a0db-ddc12bcbec9f",
      "provider_type": "LLM",
      "provider_name": "OpenAI",
      "total_quantity": 148500,
      "unit": "tokens",
      "estimated_cost": 1.79
    },
    {
      "provider_id": "ae9093bd-2f28-4b97-a240-f91bfe43f0c6",
      "provider_type": "TTS",
      "provider_name": "Cartesia",
      "total_quantity": 94200,
      "unit": "characters",
      "estimated_cost": 0.45
    }
  ]
}
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `401` | `Unauthorized` | Missing or invalid JWT token |

---

## Internal Agent Endpoints

> **Auth required for all endpoints in this section**: `X-Voice-Agent-Key: {key}` header — NOT JWT.
> All routes use `@Public()` to bypass the global JwtAuthGuard. Authentication is handled exclusively by `VoiceAgentKeyGuard`, which validates the key against the SHA-256 hash stored in `voice_ai_global_config.agent_api_key_hash`.

The agent key is generated via `POST /api/v1/system/voice-ai/config/regenerate-key` (admin only). The plaintext key is returned **once** and never stored. Rotate it without downtime — the old key becomes invalid immediately.

### Endpoint Overview

| API ID | Method | Path | Purpose | Called When |
|--------|--------|------|---------|-------------|
| API-026 | `GET` | `/internal/voice-ai/tenant/:tenantId/access` | Pre-flight quota check | Before accepting the LiveKit job |
| API-022 | `GET` | `/internal/voice-ai/tenant/:tenantId/context` | Full tenant context | After joining the LiveKit room |
| API-024 | `POST` | `/internal/voice-ai/calls/start` | Create call log | Before audio processing begins |
| API-030 | `POST` | `/internal/voice-ai/calls/:callSid/complete` | Finalize call + usage | In `finally` block — always runs |
| API-027 | `POST` | `/internal/voice-ai/tenant/:tenantId/tools/:tool` | Dispatch tool action | When LLM decides to act |

---

### API-026: `GET /api/v1/internal/voice-ai/tenant/:tenantId/access`

Pre-flight quota and enabled check. The Python agent calls this **before** accepting a call job from the LiveKit queue. It is a cheap operation — it does NOT decrypt provider credentials.

**Auth**: `X-Voice-Agent-Key` header

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenantId` | `string (UUID)` | Yes | UUID of the tenant, sourced from the call routing params |

**Request Body**: None

**Response**: `200 OK`

| Field | Type | Description |
|-------|------|-------------|
| `has_access` | `boolean` | `true` → agent may proceed; `false` → agent must reject the call |
| `reason` | `string \| undefined` | Only present when `has_access: false`. See reason values below |
| `minutes_remaining` | `number \| undefined` | Available quota minutes. Present when `has_access: true` or reason is `quota_exceeded` |
| `overage_rate` | `number \| null \| undefined` | Cost per minute for overage. `null` = no overage allowed |

**`reason` values**:

| Value | Meaning | Action |
|-------|---------|--------|
| `not_enabled` | Voice AI is disabled for this tenant | Reject call, hang up |
| `quota_exceeded` | Monthly minutes exhausted, no overage rate configured | Reject call, hang up |
| `tenant_not_found` | Tenant UUID does not exist in the database | Reject call, log error |

**Curl Examples**:

```bash
AGENT_KEY="your-agent-key-from-admin"
TENANT_ID="bc5b3363-ebe5-46fb-adac-53f8ed75a28d"

curl "https://api.lead360.app/api/v1/internal/voice-ai/tenant/$TENANT_ID/access" \
  -H "X-Voice-Agent-Key: $AGENT_KEY" | jq .
```

**Example Responses**:

```json
// Access granted
{
  "has_access": true,
  "minutes_remaining": 453,
  "overage_rate": null
}

// Access granted with overage available
{
  "has_access": true,
  "minutes_remaining": 0,
  "overage_rate": 0.05
}

// Quota exhausted, no overage
{
  "has_access": false,
  "reason": "quota_exceeded",
  "minutes_remaining": 0,
  "overage_rate": null
}

// Voice AI not enabled for this tenant
{
  "has_access": false,
  "reason": "not_enabled"
}

// Tenant UUID does not exist
{
  "has_access": false,
  "reason": "tenant_not_found"
}
```

**Error Responses**:

| Status | Cause |
|--------|-------|
| `401` | Missing or invalid `X-Voice-Agent-Key` header |

> **Note**: This endpoint returns `200` in ALL cases — even when access is denied. The agent must check `has_access` in the response body, not the HTTP status code.

---

### API-022: `GET /api/v1/internal/voice-ai/tenant/:tenantId/context`

Returns the complete `FullVoiceAiContext` for the tenant. Called **once per call** after the agent has been dispatched to the LiveKit room. Contains decrypted provider API keys — see [Section 9: FullVoiceAiContext Schema Reference](#fullvoiceaicontext-schema-reference) for the full JSON shape.

**Auth**: `X-Voice-Agent-Key` header

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenantId` | `string (UUID)` | Yes | UUID of the tenant |

**Request Body**: None

**Cache Policy**: Agent SHOULD cache this response for **up to 60 seconds** per tenant. The context contains decrypted API keys — DO NOT cache beyond 60 seconds, DO NOT persist to disk, DO NOT log.

**Response**: `200 OK` — `FullVoiceAiContext` object. See full schema in [Section 9](#fullvoiceaicontext-schema-reference).

**Curl Example**:

```bash
curl "https://api.lead360.app/api/v1/internal/voice-ai/tenant/$TENANT_ID/context" \
  -H "X-Voice-Agent-Key: $AGENT_KEY" | jq .
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `401` | `Unauthorized` | Missing or invalid `X-Voice-Agent-Key` |
| `404` | `Tenant with ID "..." not found` | Tenant UUID does not exist |
| `500` | `Global config has not been initialized` | Platform admin has not saved the global config yet |

---

### API-024: `POST /api/v1/internal/voice-ai/calls/start`

Creates a `voice_call_log` row with `status = 'in_progress'`. Called by the Python agent **before** the audio stream begins, once dispatched to the LiveKit room.

**Auth**: `X-Voice-Agent-Key` header

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tenant_id` | `string (UUID)` | Yes | Tenant UUID |
| `call_sid` | `string` | Yes | Twilio CallSid (e.g. `CA1234567890abcdef`) |
| `from_number` | `string` | Yes | Caller's E.164 phone number (e.g. `+15551234567`) |
| `to_number` | `string` | Yes | Tenant's Twilio number in E.164 or SIP format |
| `direction` | `"inbound" \| "outbound"` | No | Default: `"inbound"` |
| `stt_provider_id` | `string (UUID)` | No | STT provider UUID from `context.providers.stt.provider_id` |
| `llm_provider_id` | `string (UUID)` | No | LLM provider UUID from `context.providers.llm.provider_id` |
| `tts_provider_id` | `string (UUID)` | No | TTS provider UUID from `context.providers.tts.provider_id` |

> **Provider IDs**: Pass the `provider_id` values from the context response. These UUIDs link usage records to providers for billing aggregation. See [FullVoiceAiContext Schema](#fullvoiceaicontext-schema-reference) for where to source them.

**Idempotency**: If the agent crashes and restarts, it may call this endpoint again with the same `call_sid`. The endpoint returns the existing `call_log_id` instead of creating a duplicate row.

**Response**: `201 Created`

```json
{
  "call_log_id": "7f8a9b0c-1d2e-3f4a-5b6c-7d8e9f0a1b2c"
}
```

**Curl Example**:

```bash
curl -X POST "https://api.lead360.app/api/v1/internal/voice-ai/calls/start" \
  -H "X-Voice-Agent-Key: $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "'$TENANT_ID'",
    "call_sid": "CA1234567890abcdef",
    "from_number": "+15551234567",
    "to_number": "+15559999999",
    "direction": "inbound",
    "stt_provider_id": "a8a5b151-c7c6-435a-930d-249e41868997",
    "llm_provider_id": "2490153d-160e-49a1-a0db-ddc12bcbec9f",
    "tts_provider_id": "ae9093bd-2f28-4b97-a240-f91bfe43f0c6"
  }' | jq .
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `400` | Validation error | Missing required fields or invalid `from_number` format |
| `401` | `Unauthorized` | Missing or invalid `X-Voice-Agent-Key` |

---

### API-030: `POST /api/v1/internal/voice-ai/calls/:callSid/complete`

Finalizes the call log and persists per-provider usage records. Called by the Python agent in its `finally` block — **this must execute even if the call ended with an error**.

All writes (call log update + usage record creation) execute in a single database transaction.

**Auth**: `X-Voice-Agent-Key` header

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `callSid` | `string` | Yes | Twilio CallSid — authoritative identifier |

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `call_sid` | `string` | Yes | Twilio CallSid — must match `:callSid` path param |
| `duration_seconds` | `integer ≥ 0` | Yes | Total call duration in seconds |
| `outcome` | `string` | Yes | One of: `completed`, `transferred`, `voicemail`, `abandoned`, `error` |
| `transcript_summary` | `string` | No | AI-generated summary of the call (max ~2000 chars recommended) |
| `full_transcript` | `string` | No | Full STT output — complete conversation text |
| `actions_taken` | `string[]` | No | List of actions taken, e.g. `["lead_created", "appointment_booked"]` |
| `lead_id` | `string (UUID)` | No | UUID of the lead matched or created during this call |
| `is_overage` | `boolean` | No | `true` if this call consumed overage minutes beyond the plan limit |
| `usage_records` | `UsageRecord[]` | No | Per-provider usage records (typically 1–3 entries: STT, LLM, TTS) |

**`UsageRecord` object**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider_id` | `string (UUID)` | Yes | UUID of the `voice_ai_provider` row — from context response |
| `provider_type` | `"STT" \| "LLM" \| "TTS"` | Yes | Service category |
| `usage_quantity` | `number ≥ 0` | Yes | Consumption amount (seconds for STT, tokens for LLM, characters for TTS) |
| `usage_unit` | `"seconds" \| "tokens" \| "characters"` | Yes | Unit matching the provider type |
| `estimated_cost` | `number ≥ 0` | No | Cost estimate in USD |

> **`provider_id` for billing**: The `provider_id` in each usage record must be the UUID of the `voice_ai_provider` row — sourced from `context.providers.stt.provider_id`, `.llm.provider_id`, and `.tts.provider_id`. This links usage to the correct provider for quota aggregation and billing reports.

**Response**: `200 OK`

```json
{
  "success": true
}
```

**Curl Example**:

```bash
curl -X POST "https://api.lead360.app/api/v1/internal/voice-ai/calls/CA1234567890abcdef/complete" \
  -H "X-Voice-Agent-Key: $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "call_sid": "CA1234567890abcdef",
    "duration_seconds": 127,
    "outcome": "completed",
    "transcript_summary": "Customer called about a leaking pipe. Appointment created for next Monday.",
    "actions_taken": ["lead_created", "appointment_booked"],
    "lead_id": "7f8a9b0c-1d2e-3f4a-5b6c-7d8e9f0a1b2c",
    "is_overage": false,
    "usage_records": [
      {
        "provider_id": "a8a5b151-c7c6-435a-930d-249e41868997",
        "provider_type": "STT",
        "usage_quantity": 127,
        "usage_unit": "seconds",
        "estimated_cost": 0.13
      },
      {
        "provider_id": "2490153d-160e-49a1-a0db-ddc12bcbec9f",
        "provider_type": "LLM",
        "usage_quantity": 3200,
        "usage_unit": "tokens",
        "estimated_cost": 0.004
      },
      {
        "provider_id": "ae9093bd-2f28-4b97-a240-f91bfe43f0c6",
        "provider_type": "TTS",
        "usage_quantity": 8400,
        "usage_unit": "characters",
        "estimated_cost": 0.09
      }
    ]
  }' | jq .
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `400` | Validation error | Invalid body fields or enum values |
| `401` | `Unauthorized` | Missing or invalid `X-Voice-Agent-Key` |
| `404` | `Call log not found for callSid "..."` | No call log exists for the given CallSid |

---

### API-027: `POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/:tool`

Generic tool dispatcher. When the LLM decides to take an action during a call, the Python agent calls this endpoint. The `:tool` path parameter selects the handler.

**Auth**: `X-Voice-Agent-Key` header

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenantId` | `string (UUID)` | Yes | Tenant UUID — authorization source, NOT from request body |
| `tool` | `string` | Yes | Tool name: `create_lead`, `book_appointment`, or `transfer_call` |

> **Tenant isolation**: `tenantId` is always sourced from the URL path, never from the request body. The server enforces this — body fields cannot override the tenant context.

**Request Body** varies by tool — see per-tool payloads below.

**Response**: `200 OK` — shape varies by tool (documented per-tool below).

**Unknown tool** → `404 Not Found`:
```json
{
  "statusCode": 404,
  "message": "Unknown tool: 'my_tool'. Available: create_lead, book_appointment, transfer_call"
}
```

---

#### Tool: `create_lead`

Creates a new lead from a call, or returns the existing lead if one already exists for the caller's phone number. **409 conflict is not an error** — the response includes `created: false` to distinguish.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `call_log_id` | `string (UUID)` | Yes | The `call_log_id` returned by API-024 (start call) |
| `phone_number` | `string (E.164)` | Yes | Caller's phone number (e.g. `+15551234567`) |
| `first_name` | `string` | No | Caller's first name |
| `last_name` | `string` | No | Caller's last name |
| `notes` | `string` | No | Call notes to attach to the lead |
| `service_type` | `string` | No | Service the caller is interested in |

**Response**: `200 OK`

```json
// New lead created
{
  "lead_id": "7f8a9b0c-1d2e-3f4a-5b6c-7d8e9f0a1b2c",
  "created": true
}

// Lead already existed for this phone number — NOT an error
{
  "lead_id": "3a4b5c6d-7e8f-9a0b-1c2d-3e4f5a6b7c8d",
  "created": false
}
```

> **`created: false` handling**: This is NOT an error. The existing lead is linked to the call log. The agent should continue normally and may use the returned `lead_id` in subsequent tool calls (e.g. `book_appointment`).

**Curl Example**:

```bash
curl -X POST "https://api.lead360.app/api/v1/internal/voice-ai/tenant/$TENANT_ID/tools/create_lead" \
  -H "X-Voice-Agent-Key: $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "call_log_id": "7f8a9b0c-1d2e-3f4a-5b6c-7d8e9f0a1b2c",
    "phone_number": "+15551234567",
    "first_name": "John",
    "last_name": "Doe",
    "notes": "Needs urgent pipe repair",
    "service_type": "Plumbing"
  }' | jq .
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `400` | `phone_number required for create_lead` | `phone_number` field is missing |
| `401` | `Unauthorized` | Missing or invalid `X-Voice-Agent-Key` |

---

#### Tool: `book_appointment`

Creates an appointment request tied to this call. The appointment is stored as a pending service request that tenant staff can review and confirm.

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `call_log_id` | `string (UUID)` | Yes | The `call_log_id` returned by API-024 |
| `lead_id` | `string (UUID)` | No | UUID of the associated lead (from `create_lead` response) |
| `service_type` | `string` | No | Type of service requested (e.g. `"Plumbing Repair"`) |
| `preferred_date` | `string (ISO date)` | No | Preferred appointment date in `YYYY-MM-DD` format |
| `notes` | `string` | No | Additional booking notes |

**Response**: `200 OK`

```json
{
  "appointment_id": "9b0c1d2e-3f4a-5b6c-7d8e-9f0a1b2c3d4e",
  "status": "pending"
}
```

> **Status**: Always returns `"pending"`. The appointment requires staff confirmation — the AI agent does not auto-confirm bookings.

**Curl Example**:

```bash
curl -X POST "https://api.lead360.app/api/v1/internal/voice-ai/tenant/$TENANT_ID/tools/book_appointment" \
  -H "X-Voice-Agent-Key: $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "call_log_id": "7f8a9b0c-1d2e-3f4a-5b6c-7d8e9f0a1b2c",
    "lead_id": "3a4b5c6d-7e8f-9a0b-1c2d-3e4f5a6b7c8d",
    "service_type": "Plumbing Repair",
    "preferred_date": "2026-03-01",
    "notes": "Morning preferred, main bathroom"
  }' | jq .
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `401` | `Unauthorized` | Missing or invalid `X-Voice-Agent-Key` |

---

#### Tool: `transfer_call`

Resolves the phone number to transfer the call to. The agent uses this number to initiate the Twilio transfer. If no transfer number is configured for the tenant, the response returns `success: false` with an empty `phone_number` — the agent must handle this gracefully (inform the caller, do not drop the call abruptly).

**Request Body**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `call_log_id` | `string (UUID)` | Yes | The `call_log_id` returned by API-024 |
| `transfer_number_id` | `string (UUID)` | No | UUID of a specific transfer number. Omit to use the tenant's default transfer number |
| `lead_id` | `string (UUID)` | No | UUID of the associated lead |

**Response**: `200 OK`

```json
// Transfer number found
{
  "success": true,
  "phone_number": "+15559876543"
}

// No transfer number configured — agent must handle gracefully
{
  "success": false,
  "phone_number": ""
}
```

> **`success: false` handling**: This is NOT a server error — it means the tenant has no transfer number configured. The agent should inform the caller that it cannot transfer the call, and offer an alternative (e.g. take a message, book an appointment). Do not return `5xx` to the agent for this case.

**Curl Example**:

```bash
# Use default transfer number
curl -X POST "https://api.lead360.app/api/v1/internal/voice-ai/tenant/$TENANT_ID/tools/transfer_call" \
  -H "X-Voice-Agent-Key: $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "call_log_id": "7f8a9b0c-1d2e-3f4a-5b6c-7d8e9f0a1b2c"
  }' | jq .

# Use a specific transfer number
curl -X POST "https://api.lead360.app/api/v1/internal/voice-ai/tenant/$TENANT_ID/tools/transfer_call" \
  -H "X-Voice-Agent-Key: $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "call_log_id": "7f8a9b0c-1d2e-3f4a-5b6c-7d8e9f0a1b2c",
    "transfer_number_id": "f1e2d3c4-b5a6-7890-abcd-ef1234567890",
    "lead_id": "3a4b5c6d-7e8f-9a0b-1c2d-3e4f5a6b7c8d"
  }' | jq .
```

**Error Responses**:

| Status | Message | Cause |
|--------|---------|-------|
| `401` | `Unauthorized` | Missing or invalid `X-Voice-Agent-Key` |

---

## FullVoiceAiContext Schema Reference

This is the complete JSON object returned by [API-022: `GET /internal/voice-ai/tenant/:tenantId/context`](#api-022-get-apiv1internalvoice-aitenanttenant-idcontext).

> **SECURITY**: This response contains **decrypted API keys** for all configured AI providers. The Python agent MUST:
> - NEVER log or print this response
> - NEVER persist this response to disk or any cache store
> - Cache in-memory for no more than **60 seconds**
> - Treat `providers.*.api_key` values as secrets equivalent to environment variables

### Top-Level Shape

```json
{
  "tenant":           { ... },
  "quota":            { ... },
  "behavior":         { ... },
  "providers":        { "stt": ..., "llm": ..., "tts": ... },
  "services":         [ ... ],
  "service_areas":    [ ... ],
  "transfer_numbers": [ ... ]
}
```

---

### `tenant` Object

Identity information for the business the agent is representing.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | `string (UUID)` | No | Tenant UUID |
| `company_name` | `string` | No | Business name (e.g. `"Acme Plumbing"`) |
| `phone` | `string (E.164) \| null` | Yes | Tenant's primary contact phone |
| `timezone` | `string` | No | IANA timezone (e.g. `"America/New_York"`) |
| `language` | `string \| null` | Yes | Tenant's default language code (e.g. `"en"`) |

---

### `quota` Object

Monthly usage quota for this tenant. Derived from the subscription plan plus any admin override.

| Field | Type | Description |
|-------|------|-------------|
| `minutes_included` | `number` | Total minutes included in the current plan for this month |
| `minutes_used` | `number` | Minutes consumed so far this month (derived from STT usage records) |
| `minutes_remaining` | `number` | `minutes_included - minutes_used` (may be negative if overage is allowed) |
| `overage_rate` | `number \| null` | Cost per minute for usage beyond `minutes_included`. `null` = overage not allowed — calls are rejected when quota is exceeded |
| `quota_exceeded` | `boolean` | `true` when `minutes_used >= minutes_included`. If `overage_rate` is not `null`, the agent may continue |

> **Overage logic**: When `quota_exceeded: true` AND `overage_rate` is not `null`, the agent SHOULD continue and pass `is_overage: true` in the complete-call request. When `quota_exceeded: true` AND `overage_rate: null`, the agent must reject new calls (but complete any in-progress call).

---

### `behavior` Object

Tenant-configured agent behavior. All fields are merged from `tenant_voice_ai_settings` with `voice_ai_global_config` as defaults.

| Field | Type | Description |
|-------|------|-------------|
| `is_enabled` | `boolean` | `false` → agent must reject calls for this tenant |
| `language` | `string` | BCP-47 language code for the agent (e.g. `"en"`, `"es"`) |
| `greeting` | `string` | Opening message spoken by the agent. `{business_name}` has already been replaced with the actual company name |
| `custom_instructions` | `string \| null` | Additional instructions appended to the system prompt. May contain business-specific rules |
| `booking_enabled` | `boolean` | `true` → agent may offer and create appointments |
| `lead_creation_enabled` | `boolean` | `true` → agent may create leads via `create_lead` tool |
| `transfer_enabled` | `boolean` | `true` → agent may transfer calls via `transfer_call` tool |
| `max_call_duration_seconds` | `number` | Hard limit on call length in seconds. Agent must end the call if this threshold is reached |

---

### `providers` Object

Resolved AI provider configuration with decrypted credentials. Each slot is `null` if the provider has not been configured.

#### `providers.stt` — Speech-to-Text

| Field | Type | Description |
|-------|------|-------------|
| `provider_id` | `string (UUID)` | UUID of the `voice_ai_provider` row. Pass as `stt_provider_id` in API-024 start call, and as `usage_records[].provider_id` (with `provider_type: "STT"`) in API-030 complete call |
| `provider_key` | `string` | Machine key identifying the provider (e.g. `"deepgram"`) |
| `api_key` | `string` | **Decrypted** API key for the STT service — treat as secret |
| `config` | `object` | Provider-specific configuration (e.g. `{ "model": "nova-2", "punctuate": true }`) |

#### `providers.llm` — Large Language Model

| Field | Type | Description |
|-------|------|-------------|
| `provider_id` | `string (UUID)` | UUID of the `voice_ai_provider` row. Pass as `llm_provider_id` in API-024 start call, and as `usage_records[].provider_id` (with `provider_type: "LLM"`) in API-030 complete call |
| `provider_key` | `string` | Machine key (e.g. `"openai"`) |
| `api_key` | `string` | **Decrypted** API key — treat as secret |
| `config` | `object` | Provider-specific configuration (e.g. `{ "model": "gpt-4o-mini", "temperature": 0.7, "max_tokens": 500 }`) |

#### `providers.tts` — Text-to-Speech

| Field | Type | Description |
|-------|------|-------------|
| `provider_id` | `string (UUID)` | UUID of the `voice_ai_provider` row. Pass as `tts_provider_id` in API-024 start call, and as `usage_records[].provider_id` (with `provider_type: "TTS"`) in API-030 complete call |
| `provider_key` | `string` | Machine key (e.g. `"cartesia"`) |
| `api_key` | `string` | **Decrypted** API key — treat as secret |
| `config` | `object` | Provider-specific configuration (e.g. `{ "model": "sonic-english", "speed": 1.0 }`) |
| `voice_id` | `string \| null` | Voice identifier for TTS (e.g. Cartesia voice UUID). `null` if not configured |

> **Null providers**: If a provider slot is `null`, the agent must fall back to its own defaults or terminate gracefully. Do not attempt to call a null provider.

---

### `services` Array

List of services the business offers. Use this to understand what the agent should discuss and offer.

```typescript
services: Array<{
  name: string;           // e.g. "Plumbing Repair"
  description: string | null;  // e.g. "General plumbing fixes and emergency repairs"
}>
```

Empty array `[]` if the tenant has not configured any services.

---

### `service_areas` Array

Geographic areas the business serves. Use to answer "do you serve my area?" questions.

```typescript
service_areas: Array<{
  type: string;           // e.g. "city", "zip", "county", "state"
  value: string;          // e.g. "Miami", "33101"
  state: string | null;   // US state abbreviation, e.g. "FL"
}>
```

Empty array `[]` if the tenant has not configured any service areas.

---

### `transfer_numbers` Array

Phone numbers the agent can transfer calls to, ordered by `display_order ASC`.

```typescript
transfer_numbers: Array<{
  label: string;              // e.g. "Sales", "Emergency Line"
  phone_number: string;       // E.164 format, e.g. "+15559876543"
  transfer_type: string;      // "primary" | "overflow" | "after_hours" | "emergency"
  is_default: boolean;        // true = use this number when no specific number is requested
  available_hours: string | null;  // JSON object or null (see format below)
}>
```

**`available_hours` format** (when not `null`):

```json
{
  "mon": [["09:00", "17:00"]],
  "tue": [["09:00", "17:00"]],
  "wed": [["09:00", "17:00"]],
  "thu": [["09:00", "17:00"]],
  "fri": [["09:00", "17:00"]],
  "sat": [],
  "sun": []
}
```

Keys: `mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`. Value: array of `[start, end]` time pairs in `HH:MM` 24-hour format. Empty array `[]` = closed that day. `null` = available 24/7.

Empty array `[]` if the tenant has no transfer numbers configured.

---

### Complete Example Response

```json
{
  "tenant": {
    "id": "bc5b3363-ebe5-46fb-adac-53f8ed75a28d",
    "company_name": "Acme Plumbing",
    "phone": "+13054561234",
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
      "provider_id": "a8a5b151-c7c6-435a-930d-249e41868997",
      "provider_key": "deepgram",
      "api_key": "dg_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "config": { "model": "nova-2", "punctuate": true, "smart_format": true }
    },
    "llm": {
      "provider_id": "2490153d-160e-49a1-a0db-ddc12bcbec9f",
      "provider_key": "openai",
      "api_key": "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "config": { "model": "gpt-4o-mini", "temperature": 0.7, "max_tokens": 500 }
    },
    "tts": {
      "provider_id": "ae9093bd-2f28-4b97-a240-f91bfe43f0c6",
      "provider_key": "cartesia",
      "api_key": "cartesia_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "config": { "model": "sonic-english", "speed": 1.0 },
      "voice_id": "694f9389-aac1-45b6-b726-9d9369183238"
    }
  },
  "services": [
    { "name": "Plumbing Repair", "description": "General plumbing fixes and emergency repairs" },
    { "name": "Water Heater", "description": "Installation and repair of water heaters" },
    { "name": "Drain Cleaning", "description": null }
  ],
  "service_areas": [
    { "type": "city", "value": "Miami", "state": "FL" },
    { "type": "city", "value": "Coral Gables", "state": "FL" },
    { "type": "zip", "value": "33101", "state": "FL" }
  ],
  "transfer_numbers": [
    {
      "label": "Sales",
      "phone_number": "+13055550001",
      "transfer_type": "primary",
      "is_default": false,
      "available_hours": "{\"mon\":[[\"09:00\",\"17:00\"]],\"tue\":[[\"09:00\",\"17:00\"]],\"wed\":[[\"09:00\",\"17:00\"]],\"thu\":[[\"09:00\",\"17:00\"]],\"fri\":[[\"09:00\",\"17:00\"]],\"sat\":[],\"sun\":[]}"
    },
    {
      "label": "Emergency",
      "phone_number": "+13055550002",
      "transfer_type": "emergency",
      "is_default": true,
      "available_hours": null
    }
  ]
}
```

---

## Extended Error Reference

### Standard Error Response Format

All errors follow this shape:

```json
{
  "statusCode": 404,
  "errorCode": "RESOURCE_NOT_FOUND",
  "message": "Tenant with ID \"bc5b3363-ebe5-46fb-adac-53f8ed75a28d\" not found",
  "error": "Not Found",
  "timestamp": "2026-02-17T22:17:34.081Z",
  "path": "/api/v1/internal/voice-ai/tenant/bc5b3363-ebe5-46fb-adac-53f8ed75a28d/context",
  "requestId": "req_488ac000f3124103"
}
```

### HTTP Status Code Reference

| Status | Name | When It Occurs |
|--------|------|----------------|
| `200` | OK | Successful GET, POST (non-creating), tool dispatch |
| `201` | Created | Successful POST that creates a resource (API-024 start call) |
| `204` | No Content | Successful DELETE — empty response body |
| `400` | Bad Request | Validation failure: missing required fields, invalid enum value, wrong data type, E.164 format violation |
| `401` | Unauthorized | Missing or invalid `Authorization: Bearer` JWT; missing or invalid `X-Voice-Agent-Key` header |
| `403` | Forbidden | Valid JWT but insufficient permissions (e.g. non-admin accessing `/system/` routes) |
| `404` | Not Found | Resource UUID does not exist; unknown tool name in API-027 |
| `409` | Conflict | Duplicate unique constraint violation (e.g. duplicate `provider_key` on create) |
| `422` | Unprocessable Entity | Business logic rejection (e.g. transfer number limit reached) |
| `500` | Internal Server Error | Unexpected server error — includes uninitialized global config |

### Auth Error Details

| Scenario | Auth Method | Response |
|----------|-------------|----------|
| Missing `Authorization` header | JWT | `401 Unauthorized` |
| Expired JWT token | JWT | `401 Unauthorized` |
| Valid JWT but `is_platform_admin: false` on `/system/` route | JWT | `401 Unauthorized` |
| Valid tenant JWT on `/system/` route | JWT | `401 Unauthorized` |
| Missing `X-Voice-Agent-Key` header | Agent Key | `401 Unauthorized` |
| Invalid or rotated agent key | Agent Key | `401 Unauthorized` |

### Internal Endpoint Error Scenarios

| Endpoint | Status | Scenario |
|----------|--------|----------|
| API-026 `/access` | `200` (always) | All cases — check `has_access` in body, not HTTP status |
| API-022 `/context` | `404` | Tenant UUID does not exist |
| API-022 `/context` | `500` | Global config not initialized by admin |
| API-024 `/calls/start` | `400` | Missing `tenant_id`, `call_sid`, `from_number`, or `to_number`; invalid E.164 format |
| API-030 `/calls/:callSid/complete` | `400` | Invalid `outcome` value; `usage_records` entry missing required fields |
| API-030 `/calls/:callSid/complete` | `404` | No `voice_call_log` row found for the given `callSid` |
| API-027 `/tools/:tool` | `400` | `create_lead` called without `phone_number` |
| API-027 `/tools/:tool` | `404` | Unknown `:tool` value (not one of `create_lead`, `book_appointment`, `transfer_call`) |
| API-027 `/tools/transfer_call` | `200` with `success: false` | No transfer number configured — NOT an HTTP error |
| API-027 `/tools/create_lead` | `200` with `created: false` | Lead already exists for phone number — NOT an HTTP error |

### Validation Error Shape (400)

When request body validation fails, the response includes field-level details:

```json
{
  "statusCode": 400,
  "message": [
    "from_number must be E.164 format",
    "outcome must be one of the following values: completed, transferred, voicemail, abandoned, error"
  ],
  "error": "Bad Request"
}
```

---

## Quick Reference — All Endpoints

### Admin Infrastructure (B12a)

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `GET` | `/api/v1/system/voice-ai/providers` | List all providers | `200` Array |
| `POST` | `/api/v1/system/voice-ai/providers` | Create provider | `201` Object |
| `PATCH` | `/api/v1/system/voice-ai/providers/:id` | Update provider | `200` Object |
| `DELETE` | `/api/v1/system/voice-ai/providers/:id` | Soft-delete provider | `204` Empty |
| `GET` | `/api/v1/system/voice-ai/credentials` | List masked credentials | `200` Array |
| `PUT` | `/api/v1/system/voice-ai/credentials/:providerId` | Upsert encrypted credential | `200` Object |
| `DELETE` | `/api/v1/system/voice-ai/credentials/:providerId` | Remove credential | `204` Empty |
| `GET` | `/api/v1/system/voice-ai/config` | Get global config | `200` Object |
| `PATCH` | `/api/v1/system/voice-ai/config` | Update global config | `200` Object |
| `POST` | `/api/v1/system/voice-ai/config/regenerate-key` | Regenerate agent API key | `200` Object |
| `GET` | `/api/v1/system/voice-ai/plans` | List plans with voice flags | `200` Array |
| `PATCH` | `/api/v1/system/voice-ai/plans/:planId/voice` | Update plan voice config | `200` Object |

### Admin Monitoring (B12b)

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `GET` | `/api/v1/system/voice-ai/tenants` | All tenants with voice AI summary | `200` Paginated |
| `PATCH` | `/api/v1/system/voice-ai/tenants/:tenantId/override` | Admin override for tenant | `204` Empty |
| `GET` | `/api/v1/system/voice-ai/call-logs` | Cross-tenant call logs | `200` Paginated |
| `GET` | `/api/v1/system/voice-ai/usage-report` | Platform-wide usage report | `200` Object |

### Tenant (B12b)

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `GET` | `/api/v1/voice-ai/settings` | Get tenant voice AI settings | `200` Object |
| `PUT` | `/api/v1/voice-ai/settings` | Upsert settings (behavior only) | `200` Object |
| `GET` | `/api/v1/voice-ai/transfer-numbers` | List transfer numbers | `200` Array |
| `POST` | `/api/v1/voice-ai/transfer-numbers` | Create transfer number | `201` Object |
| `POST` | `/api/v1/voice-ai/transfer-numbers/reorder` | Bulk reorder transfer numbers | `200` Array |
| `PATCH` | `/api/v1/voice-ai/transfer-numbers/:id` | Update transfer number | `200` Object |
| `DELETE` | `/api/v1/voice-ai/transfer-numbers/:id` | Delete transfer number | `204` Empty |
| `GET` | `/api/v1/voice-ai/call-logs` | Tenant paginated call history | `200` Paginated |
| `GET` | `/api/v1/voice-ai/call-logs/:id` | Single call log with full transcript | `200` Object |
| `GET` | `/api/v1/voice-ai/usage` | Monthly usage summary | `200` Object |

### Internal Agent (B12c)

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `GET` | `/api/v1/internal/voice-ai/tenant/:tenantId/access` | Pre-flight quota/enabled check | `200` Object |
| `GET` | `/api/v1/internal/voice-ai/tenant/:tenantId/context` | Full merged context with decrypted keys | `200` FullVoiceAiContext |
| `POST` | `/api/v1/internal/voice-ai/calls/start` | Create call log at call start | `201` `{ call_log_id }` |
| `POST` | `/api/v1/internal/voice-ai/calls/:callSid/complete` | Finalize call log + persist usage records | `200` `{ success: true }` |
| `POST` | `/api/v1/internal/voice-ai/tenant/:tenantId/tools/create_lead` | Create or find lead by phone | `200` `{ lead_id, created }` |
| `POST` | `/api/v1/internal/voice-ai/tenant/:tenantId/tools/book_appointment` | Book appointment from call | `200` `{ appointment_id, status }` |
| `POST` | `/api/v1/internal/voice-ai/tenant/:tenantId/tools/transfer_call` | Initiate call transfer | `200` `{ success, phone_number }` |

---

*Voice AI REST API Documentation — Sprint B12c complete*
