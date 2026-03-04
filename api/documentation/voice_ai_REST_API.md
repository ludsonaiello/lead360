# Voice AI Module — REST API Documentation

**Module**: Voice AI
**API Version**: v1
**Base URL**: `https://api.lead360.app/api/v1`
**Last Updated**: 2026-02-28
**Sprint**: Sprint 5 (STT Configuration from Database)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Admin Endpoints](#admin-endpoints)
   - [Provider Management](#provider-management)
   - [Credentials Management](#credentials-management)
   - [Global Configuration](#global-configuration)
   - [Plan Configuration](#plan-configuration)
   - [Monitoring](#monitoring)
   - [Call Logs & Usage Reports](#call-logs--usage-reports-admin)
3. [Tenant Endpoints](#tenant-endpoints)
   - [Settings](#tenant-settings)
   - [Transfer Numbers](#transfer-numbers)
   - [Call Logs & Usage](#call-logs--usage-tenant)

---

## Authentication

All Voice AI endpoints require a JWT Bearer token.

### Admin Endpoints

- **Endpoint prefix**: `/api/v1/system/voice-ai/*`
- **Requires**: Platform admin account (`is_platform_admin: true`)
- **Header**: `Authorization: Bearer <admin_jwt_token>`

### Tenant Endpoints

- **Endpoint prefix**: `/api/v1/voice-ai/*`
- **Requires**: Authenticated tenant user
- **Role Requirements**: Most endpoints require `Owner`, `Admin`, or `Manager` role
- **Header**: `Authorization: Bearer <tenant_jwt_token>`

### Getting a Token

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

**Response 200:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "...",
  "user": { ... }
}
```

---

## Admin Endpoints

### Provider Management

#### GET /api/v1/system/voice-ai/providers

**Auth**: Bearer token (Platform Admin only)
**Returns**: Array of AI provider objects

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| provider_type | string | No | Filter by 'STT', 'LLM', or 'TTS' |
| is_active | boolean | No | Filter active/inactive providers |

**Response 200**:
```json
[
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
    "updated_at": "2026-02-18T03:24:52.704Z"
  }
]
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`

---

#### GET /api/v1/system/voice-ai/providers/:id

**Auth**: Bearer token (Platform Admin only)
**Returns**: Single provider object

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Provider ID |

**Response 200**:
```json
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
  "updated_at": "2026-02-18T03:24:52.704Z"
}
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`
**Response 404**: `{ "statusCode": 404, "message": "Provider not found" }`

---

#### POST /api/v1/system/voice-ai/providers

**Auth**: Bearer token (Platform Admin only)
**Creates**: New AI provider in the registry

**Request Body Fields**:
| Field | Type | Required | Constraints | Default | Description |
|-------|------|----------|-------------|---------|-------------|
| provider_key | string | ✅ Yes | max 50 chars, unique | - | Provider unique identifier (e.g., 'deepgram') |
| provider_type | string | ✅ Yes | enum: STT, LLM, TTS | - | Type of AI provider |
| display_name | string | ✅ Yes | max 100 chars | - | Human-readable name |
| description | string | ❌ No | - | null | Optional description |
| logo_url | string | ❌ No | valid URL | null | Provider logo URL |
| documentation_url | string | ❌ No | valid URL | null | Documentation link |
| capabilities | string | ❌ No | JSON array as string | null | Provider capabilities (e.g., `'["streaming","multilingual"]'`) **Note: JSON string, not array** |
| config_schema | string | ❌ No | JSON object as string | null | JSON Schema for config UI |
| default_config | string | ❌ No | JSON object as string | null | Default configuration values |
| pricing_info | string | ❌ No | JSON object as string | null | Pricing information |
| is_active | boolean | ❌ No | - | true | Whether provider is active |

**Minimal Request Example (required fields only)**:
```json
{
  "provider_key": "deepgram",
  "provider_type": "STT",
  "display_name": "Deepgram"
}
```

**Complete Request Example**:
```json
{
  "provider_key": "deepgram",
  "provider_type": "STT",
  "display_name": "Deepgram",
  "description": "State-of-the-art speech recognition",
  "logo_url": "https://deepgram.com/favicon.ico",
  "documentation_url": "https://developers.deepgram.com",
  "capabilities": "[\"streaming\",\"multilingual\",\"punctuation\"]",
  "config_schema": "{\"type\":\"object\",\"properties\":{\"model\":{\"type\":\"string\",\"enum\":[\"nova-2\"]}}}",
  "default_config": "{\"model\":\"nova-2\",\"punctuate\":true}",
  "pricing_info": "{\"per_minute\":0.0043}",
  "is_active": true
}
```

**Response 201**:
```json
{
  "id": "a8a5b151-c7c6-435a-930d-249e41868997",
  "provider_key": "deepgram",
  "provider_type": "STT",
  "display_name": "Deepgram",
  "description": "State-of-the-art speech recognition",
  "logo_url": "https://deepgram.com/favicon.ico",
  "documentation_url": "https://developers.deepgram.com",
  "capabilities": "[\"streaming\",\"multilingual\",\"punctuation\"]",
  "config_schema": "{\"type\":\"object\",\"properties\":{\"model\":{\"type\":\"string\",\"enum\":[\"nova-2\"]}}}",
  "default_config": "{\"model\":\"nova-2\",\"punctuate\":true}",
  "pricing_info": "{\"per_minute\":0.0043}",
  "is_active": true,
  "created_at": "2026-02-22T12:00:00.000Z",
  "updated_at": "2026-02-22T12:00:00.000Z"
}
```

**Validation Error Response 400**:
```json
{
  "statusCode": 400,
  "message": [
    "provider_key should not be empty",
    "provider_key must be shorter than or equal to 50 characters",
    "provider_type must be one of the following values: STT, LLM, TTS",
    "logo_url must be a URL address"
  ],
  "error": "Bad Request"
}
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`
**Response 409**: `{ "statusCode": 409, "message": "Provider key already exists - must be unique" }`

---

#### PATCH /api/v1/system/voice-ai/providers/:id

**Auth**: Bearer token (Platform Admin only)
**Updates**: Existing provider (partial update - only provided fields are modified)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Provider ID |

**Request Body Fields (all optional)**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| provider_key | string | max 50 chars, unique | Provider unique identifier |
| provider_type | string | enum: STT, LLM, TTS | Type of AI provider |
| display_name | string | max 100 chars | Human-readable name |
| description | string | - | Provider description (can be null) |
| logo_url | string | valid URL | Provider logo URL (can be null) |
| documentation_url | string | valid URL | Documentation link (can be null) |
| capabilities | string | JSON array as string | Provider capabilities **Note: JSON string, not array** |
| config_schema | string | JSON object as string | JSON Schema for config UI |
| default_config | string | JSON object as string | Default configuration values |
| pricing_info | string | JSON object as string | Pricing information |
| is_active | boolean | - | Whether provider is active |

**Minimal Request Example**:
```json
{
  "is_active": false
}
```

**Complete Request Example**:
```json
{
  "display_name": "Deepgram Nova 2",
  "description": "Updated description - Advanced STT with Nova-2 model",
  "capabilities": "[\"streaming\",\"multilingual\",\"punctuation\",\"diarization\"]",
  "is_active": true
}
```

**Response 200**: Returns updated provider object (same structure as GET /:id)

**Validation Error Response 400**:
```json
{
  "statusCode": 400,
  "message": [
    "display_name must be shorter than or equal to 100 characters",
    "logo_url must be a URL address"
  ],
  "error": "Bad Request"
}
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`
**Response 404**: `{ "statusCode": 404, "message": "Provider not found" }`
**Response 409**: `{ "statusCode": 409, "message": "Provider key already exists (if changing provider_key)" }`

---

#### DELETE /api/v1/system/voice-ai/providers/:id

**Auth**: Bearer token (Platform Admin only)
**Deletes**: Provider permanently (hard delete)
**WARNING**: Cascade deletes all related credentials and usage records

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Provider ID |

**Response 204**: No content (success)

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`
**Response 404**: `{ "statusCode": 404, "message": "Provider not found" }`

---

### Credentials Management

#### GET /api/v1/system/voice-ai/credentials

**Auth**: Bearer token (Platform Admin only)
**Returns**: Array of provider credentials (masked keys only)

**Response 200**:
```json
[
  {
    "id": "760910f6-7017-4c06-92a1-c692b5676b55",
    "provider_id": "a8a5b151-c7c6-435a-930d-249e41868997",
    "masked_api_key": "dg_t...2345",
    "additional_config": null,
    "created_at": "2026-02-18T03:50:34.372Z",
    "updated_at": "2026-02-22T00:32:23.167Z",
    "updated_by": "bc5b3363-ebe5-46fb-adac-53f8ed75a28d"
  },
  {
    "id": "e27c7bad-c798-48f8-b23c-4aa9eb1a3ec0",
    "provider_id": "ae9093bd-2f28-4b97-a240-f91bfe43f0c6",
    "masked_api_key": "****Kg7X",
    "additional_config": null,
    "created_at": "2026-02-18T03:51:59.954Z",
    "updated_at": "2026-02-18T03:51:59.954Z",
    "updated_by": "bc5b3363-ebe5-46fb-adac-53f8ed75a28d"
  }
]
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`

---

#### PUT /api/v1/system/voice-ai/credentials/:providerId

**Auth**: Bearer token (Platform Admin only)
**Upserts**: Credential for a provider (create or replace)
**Security**: API key is encrypted (AES-256-GCM) before storage; plain key never returned

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| providerId | UUID | Provider ID |

**Request Body Fields**:
| Field | Type | Required | Constraints | Default | Description |
|-------|------|----------|-------------|---------|-------------|
| api_key | string | ✅ Yes | min 10 chars | - | Plain-text API key (will be encrypted before storage, never returned) |
| additional_config | string | ❌ No | JSON object as string | null | Provider-specific configuration **Note: JSON string, not object** |

**Minimal Request Example (required fields only)**:
```json
{
  "api_key": "dg_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**Complete Request Example**:
```json
{
  "api_key": "dg_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "additional_config": "{\"region\":\"us-west-1\",\"model\":\"whisper-1\"}"
}
```

**Response 200**:
```json
{
  "id": "760910f6-7017-4c06-92a1-c692b5676b55",
  "provider_id": "a8a5b151-c7c6-435a-930d-249e41868997",
  "masked_api_key": "dg_t...2345",
  "additional_config": "{\"region\":\"us-west-1\",\"model\":\"whisper-1\"}",
  "created_at": "2026-02-22T12:00:00.000Z",
  "updated_at": "2026-02-22T12:00:00.000Z",
  "updated_by": "bc5b3363-ebe5-46fb-adac-53f8ed75a28d"
}
```

**Validation Error Response 400**:
```json
{
  "statusCode": 400,
  "message": [
    "api_key must be longer than or equal to 10 characters",
    "api_key should not be empty"
  ],
  "error": "Bad Request"
}
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`
**Response 404**: `{ "statusCode": 404, "message": "Provider not found" }`

---

#### DELETE /api/v1/system/voice-ai/credentials/:providerId

**Auth**: Bearer token (Platform Admin only)
**Deletes**: Credential for a provider

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| providerId | UUID | Provider ID |

**Response 204**: No content (success)

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`
**Response 404**: `{ "statusCode": 404, "message": "Credential not found" }`

---

#### POST /api/v1/system/voice-ai/credentials/:providerId/test

**Auth**: Bearer token (Platform Admin only)
**Tests**: Stored API key by making a lightweight call to provider's API

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| providerId | UUID | Provider ID |

**Response 200**:
```json
{
  "success": true,
  "message": "Connection successful"
}
```

OR

```json
{
  "success": false,
  "message": "Authentication failed: Invalid API key"
}
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`
**Response 404**: `{ "statusCode": 404, "message": "Provider or credential not found" }`

---

### Global Configuration

#### GET /api/v1/system/voice-ai/config

**Auth**: Bearer token (Platform Admin only)
**Returns**: Global Voice AI configuration singleton
**Security**: Sensitive fields (LiveKit keys, hash) are masked

**Response 200**:
```json
{
  "id": "default",
  "agent_enabled": false,
  "default_stt_provider": {
    "id": "a8a5b151-c7c6-435a-930d-249e41868997",
    "provider_key": "deepgram",
    "provider_type": "STT",
    "display_name": "Deepgram"
  },
  "default_llm_provider": {
    "id": "2490153d-160e-49a1-a0db-ddc12bcbec9f",
    "provider_key": "openai",
    "provider_type": "LLM",
    "display_name": "OpenAI"
  },
  "default_tts_provider": {
    "id": "ae9093bd-2f28-4b97-a240-f91bfe43f0c6",
    "provider_key": "cartesia",
    "provider_type": "TTS",
    "display_name": "Cartesia"
  },
  "default_stt_config": "{\"model\":\"nova-2-phonecall\",\"endpointing\":800,\"utterance_end_ms\":2000,\"vad_events\":true,\"interim_results\":true,\"punctuate\":true}",
  "default_llm_config": "{\"model\":\"gpt-4o-mini\",\"temperature\":0,\"max_tokens\":500}",
  "default_tts_config": "{\"model\":\"sonic-multilingual\",\"speed\":1}",
  "default_voice_id": "agent_UB73EHZHv65uQTn44Hddho",
  "default_language": "en",
  "default_languages": "[\"en\",\"pt\",\"es\"]",
  "default_greeting_template": "Hello, this is the default greeting. thank you for calling {business_name}! How can I help you today?",
  "default_system_prompt": "You are a helpful phone assistant. Be concise, friendly, and professional. and this is the default system prompt",
  "default_max_call_duration_seconds": 300,
  "default_transfer_behavior": "end_call",
  "default_tools_enabled": "{\"lead_creation\":true,\"booking\":true,\"call_transfer\":true}",
  "livekit_url": "wss://lead360-8owqtn2p.livekit.cloud",
  "livekit_sip_trunk_url": null,
  "livekit_api_key_set": true,
  "livekit_api_secret_set": true,
  "agent_api_key_preview": "...e86a",
  "max_concurrent_calls": 10,
  "updated_at": "2026-02-22T03:22:10.911Z",
  "updated_by": "bc5b3363-ebe5-46fb-adac-53f8ed75a28d"
}
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`

---

#### PATCH /api/v1/system/voice-ai/config

**Auth**: Bearer token (Platform Admin only)
**Updates**: Global configuration (partial update - only provided fields are modified)
**Security**: LiveKit keys are encrypted before storage if provided

**Request Body Fields (all optional)**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| agent_enabled | boolean | - | Enable or disable the voice AI agent globally |
| default_stt_provider_id | string | valid UUID | UUID of the default STT provider |
| default_llm_provider_id | string | valid UUID | UUID of the default LLM provider |
| default_tts_provider_id | string | valid UUID | UUID of the default TTS provider |
| default_voice_id | string | - | Cartesia voice ID or provider-specific voice identifier |
| default_language | string | length: 2-10 chars | BCP-47 language code (e.g., 'en') |
| default_languages | string | JSON array as string | JSON array of enabled language codes (e.g., `'["en","es","pt"]'`) **Note: JSON string, not array** |
| default_greeting_template | string | max 500 chars | Default greeting template; use `{business_name}` as placeholder |
| default_system_prompt | string | max 2000 chars | Base system prompt injected into every agent conversation |
| default_max_call_duration_seconds | number | min: 60, max: 3600 | Max call duration in seconds (60-3600) |
| default_transfer_behavior | string | - | Behavior when call ends: 'end_call', 'voicemail', or 'hold' |
| default_tools_enabled | string | JSON object as string | JSON object of tool toggles (e.g., `'{"booking":true,"lead_creation":true}'`) **Note: JSON string, not object** |
| default_stt_config | string | JSON object as string | JSON object with STT provider-specific config |
| default_llm_config | string | JSON object as string | JSON object with LLM provider-specific config |
| default_tts_config | string | JSON object as string | JSON object with TTS provider-specific config |
| livekit_url | string | valid URL (http/https/ws/wss) | LiveKit server URL (e.g., `wss://your-project.livekit.cloud`) |
| livekit_sip_trunk_url | string | - | LiveKit SIP trunk URL (e.g., `sip.livekit.cloud`) |
| livekit_api_key | string | - | LiveKit API key — stored encrypted, never returned |
| livekit_api_secret | string | - | LiveKit API secret — stored encrypted, never returned |
| max_concurrent_calls | number | min: 1, max: 100 | Max concurrent calls across the entire platform (1-100) |

**Minimal Request Example**:
```json
{
  "agent_enabled": true
}
```

**Complete Request Example**:
```json
{
  "agent_enabled": true,
  "default_stt_provider_id": "a8a5b151-c7c6-435a-930d-249e41868997",
  "default_llm_provider_id": "2490153d-160e-49a1-a0db-ddc12bcbec9f",
  "default_tts_provider_id": "ae9093bd-2f28-4b97-a240-f91bfe43f0c6",
  "default_voice_id": "agent_UB73EHZHv65uQTn44Hddho",
  "default_language": "en",
  "default_languages": "[\"en\",\"es\",\"pt\"]",
  "default_greeting_template": "Hello, thank you for calling {business_name}! How can I help you today?",
  "default_system_prompt": "You are a helpful phone assistant. Be concise, friendly, and professional.",
  "default_max_call_duration_seconds": 300,
  "default_transfer_behavior": "end_call",
  "default_tools_enabled": "{\"booking\":true,\"lead_creation\":true,\"call_transfer\":true}",
  "default_stt_config": "{\"model\":\"nova-2-phonecall\",\"endpointing\":800,\"utterance_end_ms\":2000,\"vad_events\":true,\"interim_results\":true,\"punctuate\":true}",
  "default_llm_config": "{\"model\":\"gpt-4o-mini\",\"temperature\":0}",
  "default_tts_config": "{\"model\":\"sonic-multilingual\",\"speed\":1}",
  "livekit_url": "wss://lead360-8owqtn2p.livekit.cloud",
  "livekit_sip_trunk_url": "sip.livekit.cloud",
  "livekit_api_key": "APIxxxxxxxxxxxxxxx",
  "livekit_api_secret": "xxxxxxxxxxxxxxxxxxxxxxxx",
  "max_concurrent_calls": 20
}
```

**Response 200**: Returns updated config (same structure as GET)

**Validation Error Response 400**:
```json
{
  "statusCode": 400,
  "message": [
    "default_language must be longer than or equal to 2 characters",
    "default_greeting_template must be shorter than or equal to 500 characters",
    "default_max_call_duration_seconds must not be less than 60",
    "default_max_call_duration_seconds must not be greater than 3600",
    "max_concurrent_calls must not be greater than 100",
    "livekit_url must be a URL address"
  ],
  "error": "Bad Request"
}
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`

---

#### POST /api/v1/system/voice-ai/config/regenerate-key

**Auth**: Bearer token (Platform Admin only)
**Generates**: New agent API key
**WARNING**: The plain key is returned ONCE and never stored. Save it immediately.

**Response 200**:
```json
{
  "plain_key": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "preview": "...xxxx",
  "warning": "Save this key now. It will not be shown again."
}
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`

---

#### STT Configuration Guide (Sprint 5)

The `default_stt_config` field controls Speech-to-Text behavior and is critical for preventing interruptions during natural speech pauses.

**Recommended Configuration**:
```json
{
  "model": "nova-2-phonecall",
  "endpointing": 800,
  "utterance_end_ms": 2000,
  "vad_events": true,
  "interim_results": true,
  "punctuate": true,
  "smart_format": true
}
```

**Key Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model` | string | `"nova-2-phonecall"` | Deepgram model optimized for phone calls |
| `endpointing` | number | `800` | Milliseconds of silence before assuming user stopped speaking |
| `utterance_end_ms` | number | `2000` | Milliseconds before finalizing the transcript |
| `vad_events` | boolean | `true` | Enable Voice Activity Detection for better silence detection |
| `interim_results` | boolean | `true` | Send partial transcription results |
| `punctuate` | boolean | `true` | Add punctuation to transcripts |
| `smart_format` | boolean | `true` | Format numbers, dates, and times intelligently |

**Understanding Endpointing**:

The `endpointing` parameter controls how long the system waits for silence before concluding the user has stopped speaking:

- **Too Low (< 600ms)**: Agent interrupts during normal pauses in speech
  - Example: "I would like... *[pause 600ms]* ...to schedule a service"
  - Result: Agent cuts off after "I would like" ❌

- **Recommended (800-1000ms)**: Natural conversation flow
  - Allows for normal thinking pauses
  - User completes full sentences
  - Agent responds to complete thoughts ✅

- **Too High (> 1500ms)**: Slow, unnatural responses
  - Long awkward silences
  - Poor user experience

**Understanding Utterance End**:

The `utterance_end_ms` parameter controls how long before the transcript is finalized:

- **Too Low (< 1500ms)**: Premature finalization, incomplete sentences
- **Recommended (2000-2500ms)**: Complete sentences captured
- **Too High (> 3000ms)**: Delayed responses, sluggish conversation

**Testing Your Configuration**:

1. Make a test call
2. Speak with natural pauses: "I would like... um... to schedule a service"
3. Check logs for: `[DeepgramSTT] Starting transcription with config:`
4. Verify the agent waits for your complete sentence

**Troubleshooting**:

- **Agent interrupts frequently**: Increase `endpointing` to 900-1000ms
- **Agent responds too slowly**: Decrease `endpointing` to 700-800ms
- **Incomplete transcripts**: Increase `utterance_end_ms` to 2500ms
- **Poor silence detection**: Ensure `vad_events: true`

**Tenant Overrides**:

Tenants can override global STT settings via the `stt_config_override` field in their tenant settings. This allows per-tenant tuning based on:
- Language (some languages have different pause patterns)
- Industry (technical vs casual conversation styles)
- User feedback

---

### Plan Configuration

#### GET /api/v1/system/voice-ai/plans

**Auth**: Bearer token (Platform Admin only)
**Returns**: All subscription plans with Voice AI configuration

**Response 200**:
```json
[
  {
    "id": "4a9f36ba-ab93-4f3a-975a-be009f5aa5c6",
    "name": "Básico",
    "description": "Básico",
    "monthly_price": "180",
    "annual_price": "1400",
    "is_active": true,
    "voice_ai_enabled": true,
    "voice_ai_minutes_included": 100,
    "voice_ai_overage_rate": null
  },
  {
    "id": "b873b601-ad6a-4528-be12-b1003ffedb8d",
    "name": "Plano do Meio",
    "description": "Plano profissional",
    "monthly_price": "700",
    "annual_price": "7000",
    "is_active": true,
    "voice_ai_enabled": true,
    "voice_ai_minutes_included": 60,
    "voice_ai_overage_rate": null
  }
]
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`

---

#### PATCH /api/v1/system/voice-ai/plans/:planId/voice

**Auth**: Bearer token (Platform Admin only)
**Updates**: Voice AI settings for a specific subscription plan (partial update)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| planId | UUID | Subscription plan ID |

**Request Body Fields (all optional)**:
| Field | Type | Constraints | Nullable | Description |
|-------|------|-------------|----------|-------------|
| voice_ai_enabled | boolean | - | No | Enable or disable Voice AI feature for this subscription tier |
| voice_ai_minutes_included | number | min: 0, integer | No | Monthly minutes of Voice AI included in the plan (0 = none) |
| voice_ai_overage_rate | number | min: 0 | Yes | Cost per minute over the included limit in USD. **null = block calls when quota exceeded; positive number = allow overage at that rate** |

**Nullable Semantics**:
- `voice_ai_overage_rate`: **null** blocks calls when quota is exceeded. Positive number allows overage billing at that rate. Omitting the field leaves the current value unchanged.

**Minimal Request Example**:
```json
{
  "voice_ai_enabled": true
}
```

**Complete Request Example**:
```json
{
  "voice_ai_enabled": true,
  "voice_ai_minutes_included": 200,
  "voice_ai_overage_rate": 0.10
}
```

**Example: Disable Overage (Block Calls When Quota Exceeded)**:
```json
{
  "voice_ai_overage_rate": null
}
```

**Response 200**: Returns updated plan object (same structure as GET)

**Validation Error Response 400**:
```json
{
  "statusCode": 400,
  "message": [
    "voice_ai_minutes_included must not be less than 0",
    "voice_ai_overage_rate must not be less than 0"
  ],
  "error": "Bad Request"
}
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`
**Response 404**: `{ "statusCode": 404, "message": "Plan not found" }`

---

### Monitoring

#### GET /api/v1/system/voice-ai/agent/status

**Auth**: Bearer token (Platform Admin only)
**Returns**: Voice AI agent health status and metrics

**Response 200**:
```json
{
  "is_running": false,
  "agent_enabled": false,
  "livekit_connected": false,
  "active_calls": 1,
  "today_calls": 0,
  "this_month_calls": 2
}
```

**Field Descriptions**:
- `is_running`: Whether the LiveKit worker is running
- `agent_enabled`: Whether agent is enabled in global config
- `livekit_connected`: Whether agent is connected to LiveKit
- `active_calls`: Number of calls currently in progress
- `today_calls`: Total calls today
- `this_month_calls`: Total calls this month

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`

---

#### GET /api/v1/system/voice-ai/rooms

**Auth**: Bearer token (Platform Admin only)
**Returns**: List of all active Voice AI calls (status='in_progress')

**Response 200**:
```json
[
  {
    "id": "f373dfde-7bc0-416f-b346-5f0b76a4582f",
    "tenant_id": "13c2dea4-64e0-0499-f6e4-5df14d5a6ce2",
    "company_name": "Mr Patch Asphalt",
    "call_sid": "test-a08-review-1771392027",
    "room_name": null,
    "from_number": "+15551234567",
    "to_number": "+19789988778",
    "direction": "inbound",
    "duration_seconds": 351162,
    "started_at": "2026-02-18T05:20:27.305Z"
  }
]
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`

---

#### POST /api/v1/system/voice-ai/rooms/:roomName/end

**Auth**: Bearer token (Platform Admin only)
**Force-terminates**: A specific call by room name
**Emergency operation**: Updates call log to 'failed' status and attempts to disconnect LiveKit room

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| roomName | string | LiveKit room name |

**Response 204**: No content (success)

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`
**Response 404**: `{ "statusCode": 404, "message": "Room not found" }`

---

#### GET /api/v1/system/voice-ai/agent/logs

**Auth**: Bearer token (Platform Admin only)
**Returns**: Server-Sent Events (SSE) stream of agent log entries
**Format**: EventSource stream

**Response 200**: SSE stream
Each event contains:
```json
{
  "timestamp": "2026-02-22T12:00:00.000Z",
  "level": "info",
  "message": "Agent heartbeat",
  "data": { ... }
}
```

**Note**: This is a placeholder implementation that emits heartbeat events every 5 seconds. Full implementation would integrate with actual log buffer.

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`

---

#### GET /api/v1/system/voice-ai/tenants

**Auth**: Bearer token (Platform Admin only)
**Returns**: Paginated list of all tenants with Voice AI summary

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | integer | No | 1 | Page number (1-based) |
| limit | integer | No | 20 | Records per page (max: 100) |
| search | string | No | - | Filter by company name (partial match) |

**Response 200**:
```json
{
  "data": [
    {
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "company_name": "Honeydo4You Contractor",
      "plan_name": "Plano do Meio",
      "voice_ai_included_in_plan": true,
      "is_enabled": true,
      "minutes_included": 60,
      "minutes_used": 0,
      "has_admin_override": true
    },
    {
      "tenant_id": "8b89e71a-0916-326e-150d-7a09a7d30c63",
      "company_name": "MDX Roofing",
      "plan_name": "Básico",
      "voice_ai_included_in_plan": true,
      "is_enabled": true,
      "minutes_included": 300,
      "minutes_used": 0,
      "has_admin_override": true
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

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`

---

#### GET /api/v1/system/voice-ai/tenants/:tenantId/override

**Auth**: Bearer token (Platform Admin only)
**Returns**: Current admin override settings for a specific tenant
**Purpose**: Pre-populate the override form with existing values

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| tenantId | UUID | Target tenant ID |

**Response 200**:
```json
{
  "force_enabled": true,
  "monthly_minutes_override": 1000,
  "stt_provider_override_id": "a8a5b151-c7c6-435a-930d-249e41868997",
  "llm_provider_override_id": null,
  "tts_provider_override_id": null,
  "admin_notes": "VIP customer - extra quota approved by CEO"
}
```

**Response Fields**:
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| force_enabled | boolean | Yes | Current is_enabled value if overridden. **null** means no admin force (tenant controls) |
| monthly_minutes_override | number | Yes | Current monthly minute quota override. **null** means using plan default |
| stt_provider_override_id | string | Yes | Current STT provider override UUID. **null** means using global default |
| llm_provider_override_id | string | Yes | Current LLM provider override UUID. **null** means using global default |
| tts_provider_override_id | string | Yes | Current TTS provider override UUID. **null** means using global default |
| admin_notes | string | Yes | Current admin notes. **null** means no notes set |

**Response 404** (Tenant Not Found):
```json
{
  "statusCode": 404,
  "message": "Tenant with id \"invalid-uuid\" not found",
  "error": "Not Found"
}
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`

**Usage Notes**:
- Returns all fields as **null** if no overrides exist for the tenant
- Used by frontend to pre-populate the override form when editing
- Does NOT return sensitive tenant data (only override configuration)

---

#### PATCH /api/v1/system/voice-ai/tenants/:tenantId/override

**Auth**: Bearer token (Platform Admin only)
**Applies**: Admin infrastructure overrides to a tenant's Voice AI settings
**Upserts**: tenant_voice_ai_settings row (creates if doesn't exist)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| tenantId | UUID | Target tenant ID |

**Request Body Fields (all optional)**:
| Field | Type | Constraints | Nullable | Description |
|-------|------|-------------|----------|-------------|
| force_enabled | boolean | - | Yes | Force-enable or force-disable Voice AI. **true/false** overrides tenant toggle; **null** removes admin force (tenant controls again) |
| monthly_minutes_override | number | min: 0, integer | Yes | Override monthly minute quota. **null** removes override and reverts to plan default |
| stt_provider_override_id | string | valid UUID | Yes | Override STT provider. Must be valid voice_ai_provider UUID. **null** removes override |
| llm_provider_override_id | string | valid UUID | Yes | Override LLM provider. Must be valid voice_ai_provider UUID. **null** removes override |
| tts_provider_override_id | string | valid UUID | Yes | Override TTS provider. Must be valid voice_ai_provider UUID. **null** removes override |
| admin_notes | string | - | Yes | Internal admin note explaining override reason. Visible in admin panel only. **null** clears the note |

**Nullable Semantics**:
- **null** values remove overrides and revert to defaults (plan or global config)
- **Omitting** a field leaves the current value unchanged (PATCH semantics)
- **Setting** a value applies the override

**Minimal Request Example**:
```json
{
  "force_enabled": true
}
```

**Complete Request Example**:
```json
{
  "force_enabled": true,
  "monthly_minutes_override": 500,
  "stt_provider_override_id": "a8a5b151-c7c6-435a-930d-249e41868997",
  "llm_provider_override_id": "2490153d-160e-49a1-a0db-ddc12bcbec9f",
  "tts_provider_override_id": "ae9093bd-2f28-4b97-a240-f91bfe43f0c6",
  "admin_notes": "Special override for enterprise customer Q1 2026"
}
```

**Example: Remove All Overrides (Revert to Defaults)**:
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

**Response 204**: No content (success)

**Validation Error Response 400**:
```json
{
  "statusCode": 400,
  "message": [
    "monthly_minutes_override must not be less than 0"
  ],
  "error": "Bad Request"
}
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`
**Response 404**: `{ "statusCode": 404, "message": "Tenant not found" }`

---

### Call Logs & Usage Reports (Admin)

#### GET /api/v1/system/voice-ai/call-logs

**Auth**: Bearer token (Platform Admin only)
**Returns**: Paginated call logs across ALL tenants (cross-tenant visibility)

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| tenantId | UUID | No | - | Filter by specific tenant |
| from | ISO 8601 date | No | - | Start date (inclusive) |
| to | ISO 8601 date | No | - | End date (inclusive) |
| outcome | string | No | - | Filter by outcome: 'lead_created', 'transferred', 'abandoned' |
| page | integer | No | 1 | Page number (1-based) |
| limit | integer | No | 20 | Records per page (max: 100) |

**Response 200**:
```json
{
  "data": [
    {
      "id": "02f5b572-0402-48c1-aaca-43f3ce802bd2",
      "tenant_id": "13c2dea4-64e0-0499-f6e4-5df14d5a6ce2",
      "call_sid": "test-sid-A09-review",
      "from_number": "+15551234567",
      "to_number": "+15559999999",
      "direction": "inbound",
      "status": "completed",
      "outcome": "completed",
      "is_overage": false,
      "duration_seconds": 90,
      "transcript_summary": null,
      "full_transcript": null,
      "actions_taken": null,
      "lead_id": null,
      "stt_provider_id": null,
      "llm_provider_id": null,
      "tts_provider_id": null,
      "started_at": "2026-02-18T05:29:03.015Z",
      "ended_at": "2026-02-18T05:29:16.398Z",
      "created_at": "2026-02-18T05:29:03.015Z"
    }
  ],
  "meta": {
    "total": 2,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`

---

#### GET /api/v1/system/voice-ai/usage-report

**Auth**: Bearer token (Platform Admin only)
**Returns**: Platform-wide usage aggregate for specified year+month
**Includes**: Total calls, STT seconds, estimated cost, and per-tenant breakdown

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| year | integer | No | Current year | Year (e.g., 2026) |
| month | integer | No | Current month | Month (1-12) |

**Response 200**:
```json
{
  "year": 2026,
  "month": 2,
  "total_calls": 2,
  "total_stt_seconds": 90,
  "total_estimated_cost": 72.806444,
  "by_tenant": [
    {
      "tenant_id": "13c2dea4-64e0-0499-f6e4-5df14d5a6ce2",
      "tenant_name": "Mr Patch Asphalt",
      "total_calls": 2,
      "total_stt_seconds": 90,
      "estimated_cost": 72.806444
    }
  ]
}
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized" }`
**Response 403**: `{ "statusCode": 403, "message": "Platform Admin access required" }`

---

## Tenant Endpoints

### Tenant Settings

#### GET /api/v1/voice-ai/settings

**Auth**: Bearer token (Tenant user)
**Roles**: Owner, Admin, Manager
**Returns**: Current Voice AI behavior settings for the authenticated tenant
**Note**: Returns `null` if settings have never been configured (global defaults apply)

**Response 200**:
```json
{
  "id": "1fbafe10-a9b9-452e-88c1-c9b7243166a0",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "is_enabled": true,
  "default_language": "en",
  "enabled_languages": "[\"en\",\"es\"]",
  "custom_greeting": "Thank you for calling! How can I help you today?",
  "custom_instructions": "Always ask if it is an emergency.",
  "after_hours_behavior": null,
  "booking_enabled": true,
  "lead_creation_enabled": true,
  "transfer_enabled": true,
  "default_transfer_number": null,
  "default_transfer_number_id": null,
  "max_call_duration_seconds": null,
  "monthly_minutes_override": null,
  "admin_notes": null,
  "stt_provider_override_id": "a8a5b151-c7c6-435a-930d-249e41868997",
  "llm_provider_override_id": "2490153d-160e-49a1-a0db-ddc12bcbec9f",
  "tts_provider_override_id": "ae9093bd-2f28-4b97-a240-f91bfe43f0c6",
  "stt_config_override": null,
  "llm_config_override": null,
  "tts_config_override": null,
  "voice_id_override": null,
  "created_at": "2026-02-17T22:56:03.967Z",
  "updated_at": "2026-02-22T04:03:35.285Z",
  "updated_by": null
}
```

OR if never configured:
```json
null
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized — valid JWT required" }`
**Response 403**: `{ "statusCode": 403, "message": "Forbidden — requires Owner, Admin, or Manager role" }`

---

#### PUT /api/v1/voice-ai/settings

**Auth**: Bearer token (Tenant user)
**Roles**: Owner, Admin
**Upserts**: Voice AI behavior settings for the authenticated tenant
**Note**: All fields are optional (PATCH semantics on PUT endpoint)

**Request Body Fields (all optional)**:
| Field | Type | Constraints | Nullable | Description |
|-------|------|-------------|----------|-------------|
| is_enabled | boolean | - | No | Enable or disable the Voice AI agent for this tenant |
| enabled_languages | array of strings | - | No | ISO 639-1 language codes the agent should support **Note: Actual array, not JSON string** |
| custom_greeting | string | max 500 chars | Yes | Custom greeting message. **Pass null to revert to global template** |
| custom_instructions | string | max 2000 chars | Yes | Additional instructions appended to agent system prompt. **Pass null to clear** |
| booking_enabled | boolean | - | No | Allow the agent to book appointments for callers |
| lead_creation_enabled | boolean | - | No | Allow the agent to create leads from calls |
| transfer_enabled | boolean | - | No | Allow the agent to transfer calls to a human operator |
| default_transfer_number | string | E.164 format (regex: `/^\+[1-9]\d{1,14}$/`) | Yes | Default fallback transfer number. **Pass null to clear** |
| max_call_duration_seconds | number | min: 60, max: 3600, integer | Yes | Maximum call duration in seconds. **Pass null to use global default** |

**Nullable Semantics**:
- `custom_greeting`: **null** reverts to global template; **omitted** = no change; **string** = sets custom greeting
- `custom_instructions`: **null** clears custom instructions; **omitted** = no change; **string** = sets custom instructions
- `default_transfer_number`: **null** clears the default number; **omitted** = no change; **string** = sets number
- `max_call_duration_seconds`: **null** uses global default; **omitted** = no change; **number** = sets custom duration

**Minimal Request Example**:
```json
{
  "is_enabled": true
}
```

**Complete Request Example**:
```json
{
  "is_enabled": true,
  "enabled_languages": ["en", "es", "pt"],
  "custom_greeting": "Thank you for calling {business_name}! How can I help you today?",
  "custom_instructions": "Always ask if it is an emergency. Always mention we serve the Miami area.",
  "booking_enabled": true,
  "lead_creation_enabled": true,
  "transfer_enabled": true,
  "default_transfer_number": "+15551234567",
  "max_call_duration_seconds": 600
}
```

**Example: Clear Custom Greeting (Revert to Global Template)**:
```json
{
  "custom_greeting": null
}
```

**Response 200**: Returns full updated settings object (same structure as GET)

**Validation Error Response 400**:
```json
{
  "statusCode": 400,
  "message": [
    "custom_greeting must be shorter than or equal to 500 characters",
    "default_transfer_number must be a valid E.164 phone number (e.g. +15551234567)",
    "max_call_duration_seconds must not be less than 60",
    "max_call_duration_seconds must not be greater than 3600",
    "enabled_languages must be an array"
  ],
  "error": "Bad Request"
}
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized — valid JWT required" }`
**Response 403**: Either:
- `{ "statusCode": 403, "message": "Forbidden — requires Owner or Admin role" }`
- `{ "statusCode": 403, "message": "Subscription plan does not include Voice AI" }` (when setting `is_enabled: true` and plan doesn't support it)

---

### Transfer Numbers

#### GET /api/v1/voice-ai/transfer-numbers

**Auth**: Bearer token (Tenant user)
**Roles**: Owner, Admin, Manager
**Returns**: All call transfer destinations for the authenticated tenant
**Order**: display_order ASC, then created_at ASC
**Limit**: Up to 10 per tenant

**Response 200**:
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
    "is_active": true,
    "display_order": 1,
    "available_hours": "{\"mon\":{\"open\":\"09:00\",\"close\":\"17:00\"}}",
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
    "is_active": true,
    "display_order": 2,
    "available_hours": null,
    "created_at": "2026-02-17T22:58:28.174Z",
    "updated_at": "2026-02-17T23:00:14.406Z"
  }
]
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized — valid JWT required" }`
**Response 403**: `{ "statusCode": 403, "message": "Forbidden — insufficient role" }`

---

#### GET /api/v1/voice-ai/transfer-numbers/:id

**Auth**: Bearer token (Tenant user)
**Roles**: Owner, Admin, Manager
**Returns**: Single transfer number by ID
**Note**: Returns 404 if ID doesn't exist or belongs to different tenant

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Transfer number ID |

**Response 200**: Single transfer number object (same structure as array item in GET all)

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized — valid JWT required" }`
**Response 403**: `{ "statusCode": 403, "message": "Forbidden — insufficient role" }`
**Response 404**: `{ "statusCode": 404, "message": "Transfer number not found or belongs to a different tenant" }`

---

#### POST /api/v1/voice-ai/transfer-numbers

**Auth**: Bearer token (Tenant user)
**Roles**: Owner, Admin
**Creates**: New call transfer destination
**Limit**: Maximum 10 per tenant
**Note**: Setting `is_default: true` automatically unsets any existing default

**Request Body Fields**:
| Field | Type | Required | Constraints | Default | Description |
|-------|------|----------|-------------|---------|-------------|
| label | string | ✅ Yes | max 100 chars | - | Human-readable label for this transfer destination |
| phone_number | string | ✅ Yes | E.164 format (regex: `/^\+[1-9]\d{7,14}$/`) | - | Phone number (e.g., '+15551234567') |
| transfer_type | string | ❌ No | enum: 'primary', 'overflow', 'after_hours', 'emergency' | 'primary' | Category of this transfer destination |
| description | string | ❌ No | max 200 chars | null | Optional description of when to use this number |
| is_default | boolean | ❌ No | - | false | Whether this is the default transfer number for the tenant |
| available_hours | string | ❌ No | JSON object as string | null | Availability windows per day. **Note: JSON string, not object**. Example: `'{"mon":[["09:00","17:00"]],"tue":[["09:00","17:00"]]}'`. **null = always available** |
| display_order | number | ❌ No | min: 0, integer | 0 | Sort order in the UI — lower value = higher priority |

**Minimal Request Example (required fields only)**:
```json
{
  "label": "Sales Team",
  "phone_number": "+13055551234"
}
```

**Complete Request Example**:
```json
{
  "label": "Sales Team",
  "phone_number": "+13055551234",
  "transfer_type": "primary",
  "description": "Main sales line for customer inquiries",
  "is_default": true,
  "available_hours": "{\"mon\":[[\"09:00\",\"17:00\"]],\"tue\":[[\"09:00\",\"17:00\"]],\"fri\":[[\"09:00\",\"12:00\"]]}",
  "display_order": 1
}
```

**Response 201**: Returns created transfer number object

**Validation Error Response 400**:
```json
{
  "statusCode": 400,
  "message": [
    "label should not be empty",
    "label must be shorter than or equal to 100 characters",
    "Phone must be in E.164 format (+15551234567)",
    "transfer_type must be one of the following values: primary, overflow, after_hours, emergency",
    "description must be shorter than or equal to 200 characters",
    "display_order must not be less than 0"
  ],
  "error": "Bad Request"
}
```

**Business Logic Error 400**:
```json
{
  "statusCode": 400,
  "message": "Maximum of 10 transfer numbers reached",
  "error": "Bad Request"
}
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized — valid JWT required" }`
**Response 403**: `{ "statusCode": 403, "message": "Forbidden — insufficient role" }`

---

#### PATCH /api/v1/voice-ai/transfer-numbers/reorder

**Auth**: Bearer token (Tenant user)
**Roles**: Owner, Admin
**Bulk-updates**: display_order for multiple transfer numbers in one transaction
**Returns**: Full updated list ordered by display_order ASC

**Request Body Fields**:
| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| items | array of objects | ✅ Yes | minItems: 1, maxItems: 10 | Array of {id, display_order} pairs to bulk-update |
| items[].id | string | ✅ Yes | valid UUID | UUID of the transfer number to reorder |
| items[].display_order | number | ✅ Yes | min: 0, integer | New display order position (0-based, lower = higher priority) |

**Request Example**:
```json
{
  "items": [
    { "id": "aaa76176-d206-4499-b8ed-8df9031d5500", "display_order": 0 },
    { "id": "5a1d15f3-b4ba-4571-914b-87bd9089312e", "display_order": 1 },
    { "id": "c8b9e123-1234-5678-abcd-123456789def", "display_order": 2 }
  ]
}
```

**Response 200**: Returns full array of updated transfer numbers (same structure as GET all)

**Validation Error Response 400**:
```json
{
  "statusCode": 400,
  "message": [
    "items must contain at least 1 elements",
    "items must contain no more than 10 elements",
    "id should not be empty",
    "display_order must not be less than 0",
    "display_order must be an integer number"
  ],
  "error": "Bad Request"
}
```

**Business Logic Error 400**:
```json
{
  "statusCode": 400,
  "message": "One or more IDs do not belong to the tenant",
  "error": "Bad Request"
}
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized — valid JWT required" }`
**Response 403**: `{ "statusCode": 403, "message": "Forbidden — insufficient role" }`

---

#### PATCH /api/v1/voice-ai/transfer-numbers/:id

**Auth**: Bearer token (Tenant user)
**Roles**: Owner, Admin
**Updates**: One or more fields of a transfer number (partial update)
**Note**: Setting `is_default: true` automatically unsets any existing default

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Transfer number ID |

**Request Body Fields (all optional)**:
| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| label | string | max 100 chars | Human-readable label for this transfer destination |
| phone_number | string | E.164 format (regex: `/^\+[1-9]\d{7,14}$/`) | Phone number (e.g., '+15551234567') |
| transfer_type | string | enum: 'primary', 'overflow', 'after_hours', 'emergency' | Category of this transfer destination |
| description | string | max 200 chars | Optional description of when to use this number |
| is_default | boolean | - | Whether this is the default transfer number for the tenant |
| available_hours | string | JSON object as string | Availability windows per day **Note: JSON string, not object** |
| display_order | number | min: 0, integer | Sort order in the UI — lower value = higher priority |

**Minimal Request Example**:
```json
{
  "is_default": true
}
```

**Complete Request Example**:
```json
{
  "label": "Updated Sales Team",
  "phone_number": "+13055559999",
  "transfer_type": "primary",
  "description": "Updated description - Main sales line",
  "is_default": true,
  "available_hours": "{\"mon\":[[\"08:00\",\"18:00\"]],\"fri\":[[\"08:00\",\"12:00\"]]}",
  "display_order": 0
}
```

**Response 200**: Returns updated transfer number object

**Validation Error Response 400**:
```json
{
  "statusCode": 400,
  "message": [
    "label must be shorter than or equal to 100 characters",
    "Phone must be in E.164 format (+15551234567)",
    "transfer_type must be one of the following values: primary, overflow, after_hours, emergency",
    "display_order must not be less than 0"
  ],
  "error": "Bad Request"
}
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized — valid JWT required" }`
**Response 403**: `{ "statusCode": 403, "message": "Forbidden — insufficient role" }`
**Response 404**: `{ "statusCode": 404, "message": "Transfer number not found or belongs to a different tenant" }`

---

#### DELETE /api/v1/voice-ai/transfer-numbers/:id

**Auth**: Bearer token (Tenant user)
**Roles**: Owner, Admin
**Soft-deletes**: Transfer number by setting is_active = false
**Note**: Does not hard-delete from database

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Transfer number ID |

**Response 204**: No content (success)

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized — valid JWT required" }`
**Response 403**: `{ "statusCode": 403, "message": "Forbidden — insufficient role" }`
**Response 404**: `{ "statusCode": 404, "message": "Transfer number not found or belongs to a different tenant" }`

---

### Call Logs & Usage (Tenant)

#### GET /api/v1/voice-ai/call-logs

**Auth**: Bearer token (Tenant user)
**Roles**: Owner, Admin, Manager
**Returns**: Paginated call logs for the authenticated tenant
**Order**: started_at DESC (most recent first)

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| from | ISO 8601 date | No | - | Start date (inclusive) |
| to | ISO 8601 date | No | - | End date (inclusive) |
| outcome | string | No | - | Filter by outcome: 'lead_created', 'transferred', 'abandoned' |
| page | integer | No | 1 | Page number (1-based) |
| limit | integer | No | 20 | Records per page (max: 100) |

**Response 200**:
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

OR with data:
```json
{
  "data": [
    {
      "id": "uuid",
      "tenant_id": "uuid",
      "call_sid": "CA123...",
      "from_number": "+15551234567",
      "to_number": "+15559876543",
      "direction": "inbound",
      "status": "completed",
      "outcome": "lead_created",
      "is_overage": false,
      "duration_seconds": 127,
      "transcript_summary": "Customer inquired about roofing services...",
      "full_transcript": null,
      "actions_taken": "[{\"type\":\"lead_created\",\"lead_id\":\"uuid\"}]",
      "lead_id": "uuid",
      "stt_provider_id": "uuid",
      "llm_provider_id": "uuid",
      "tts_provider_id": "uuid",
      "started_at": "2026-02-22T14:30:00.000Z",
      "ended_at": "2026-02-22T14:32:07.000Z",
      "created_at": "2026-02-22T14:30:00.000Z"
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

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized — valid JWT required" }`
**Response 403**: `{ "statusCode": 403, "message": "Forbidden — Owner, Admin, or Manager role required" }`

---

#### GET /api/v1/voice-ai/call-logs/:id

**Auth**: Bearer token (Tenant user)
**Roles**: Owner, Admin, Manager
**Returns**: Single call log by UUID including full transcript
**Note**: Log must belong to authenticated tenant (cross-tenant access blocked)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Call log ID |

**Response 200**:
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "call_sid": "CA123...",
  "from_number": "+15551234567",
  "to_number": "+15559876543",
  "direction": "inbound",
  "status": "completed",
  "outcome": "lead_created",
  "is_overage": false,
  "duration_seconds": 127,
  "transcript_summary": "Customer inquired about roofing services...",
  "full_transcript": "[{\"timestamp\":\"2026-02-22T14:30:05.000Z\",\"speaker\":\"agent\",\"text\":\"Hello, thank you for calling...\"},{\"timestamp\":\"2026-02-22T14:30:08.000Z\",\"speaker\":\"user\",\"text\":\"Hi, I need a quote for roof repair.\"}]",
  "actions_taken": "[{\"type\":\"lead_created\",\"lead_id\":\"uuid\",\"timestamp\":\"2026-02-22T14:31:00.000Z\"}]",
  "lead_id": "uuid",
  "stt_provider_id": "uuid",
  "llm_provider_id": "uuid",
  "tts_provider_id": "uuid",
  "started_at": "2026-02-22T14:30:00.000Z",
  "ended_at": "2026-02-22T14:32:07.000Z",
  "created_at": "2026-02-22T14:30:00.000Z"
}
```

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized — valid JWT required" }`
**Response 403**: `{ "statusCode": 403, "message": "Forbidden — Owner, Admin, or Manager role required" }`
**Response 404**: `{ "statusCode": 404, "message": "Call log not found or belongs to a different tenant" }`

---

#### GET /api/v1/voice-ai/usage

**Auth**: Bearer token (Tenant user)
**Roles**: Owner, Admin, Manager
**Returns**: Monthly usage summary for the authenticated tenant
**Aggregates**: STT seconds, LLM tokens, TTS characters, and estimated cost from per-call records

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| year | integer | No | Current year | Year (e.g., 2026) |
| month | integer | No | Current month | Month (1-12) |

**Response 200**:
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

OR with usage:
```json
{
  "year": 2026,
  "month": 2,
  "total_calls": 47,
  "total_stt_seconds": 2840,
  "total_llm_tokens": 15420,
  "total_tts_characters": 8930,
  "estimated_cost": 12.45,
  "by_provider": [
    {
      "provider_id": "uuid",
      "provider_key": "deepgram",
      "provider_type": "STT",
      "total_seconds": 2840,
      "estimated_cost": 4.26
    },
    {
      "provider_id": "uuid",
      "provider_key": "openai",
      "provider_type": "LLM",
      "total_tokens": 15420,
      "estimated_cost": 3.08
    },
    {
      "provider_id": "uuid",
      "provider_key": "cartesia",
      "provider_type": "TTS",
      "total_characters": 8930,
      "estimated_cost": 5.11
    }
  ]
}
```

**Field Descriptions**:
- `total_calls`: Total number of calls in the month
- `total_stt_seconds`: Total STT seconds (used for quota calculation)
- `total_llm_tokens`: Total LLM tokens consumed
- `total_tts_characters`: Total TTS characters generated
- `estimated_cost`: Total estimated cost in USD
- `by_provider`: Per-provider breakdown

**Response 401**: `{ "statusCode": 401, "message": "Unauthorized — valid JWT required" }`
**Response 403**: `{ "statusCode": 403, "message": "Forbidden — Owner, Admin, or Manager role required" }`

---

## Internal Agent Endpoints

**CRITICAL**: These endpoints are exclusively for the Python voice agent. They bypass global JWT authentication and use a custom authentication mechanism.

**Auth**: `X-Voice-Agent-Key` header (NOT JWT Bearer token)
**Base**: `/api/v1/internal/voice-ai/*`
**Purpose**: Provide agent with full tenant context and handle call lifecycle
**Security**: These endpoints are protected by timing-safe key comparison. The agent API key is configured in global config and must match exactly.

⚠️ **SECURITY WARNING**: The context endpoint returns DECRYPTED provider API keys. The agent MUST NOT cache or log this response.

---

### GET /api/v1/internal/voice-ai/tenant/:tenantId/access

**Auth**: X-Voice-Agent-Key header
**Purpose**: Pre-flight access check before agent accepts a call
**Use Case**: Verify tenant has Voice AI enabled and sufficient quota before starting call

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| tenantId | UUID | Tenant ID from SIP URI parameters |

**Request Headers**:
```
X-Voice-Agent-Key: {agent_api_key}
```

**Response 200** (Access Granted):
```json
{
  "has_access": true,
  "minutes_remaining": 453,
  "overage_rate": null
}
```

**Response 403** (Access Denied - Quota Exceeded):
```json
{
  "has_access": false,
  "reason": "quota_exceeded",
  "minutes_remaining": 0,
  "overage_rate": null
}
```

**Response 403** (Access Denied - Not Enabled):
```json
{
  "has_access": false,
  "reason": "not_enabled"
}
```

**Response 401**: `{ "statusCode": 401, "message": "Invalid agent API key" }`
**Response 404**: `{ "statusCode": 404, "message": "Tenant not found" }`

---

### GET /api/v1/internal/voice-ai/tenant/:tenantId/context

**Auth**: X-Voice-Agent-Key header
**Purpose**: Get full merged context with decrypted provider credentials
**Use Case**: Agent retrieves complete configuration to initialize STT, LLM, TTS providers

⚠️ **SECURITY CRITICAL**: Response contains PLAINTEXT API keys. Never cache, log, or persist this response.

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| tenantId | UUID | Tenant ID from SIP URI parameters |

**Query Parameters** (Optional):
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| call_sid | string | No | Twilio CallSid to include in context (for call tracking) |

**Request Headers**:
```
X-Voice-Agent-Key: {agent_api_key}
```

**Response 200**:
```json
{
  "call_sid": "CA1234567890abcdef",
  "tenant": {
    "id": "uuid",
    "company_name": "Acme Plumbing",
    "phone": "+15551234567",
    "timezone": "America/New_York",
    "language": "en",
    "business_description": "Family-owned plumbing company serving Miami for 20+ years. We specialize in residential and commercial plumbing repairs, installations, and emergency services."
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
    "enabled_languages": ["en", "es", "pt"],
    "greeting": "Hello, thank you for calling Acme Plumbing! How can I help you today?",
    "system_prompt": "You are a helpful phone assistant. Be concise, friendly, and professional.\n\nAdditional Instructions:\nAlways ask if it's an emergency. Always mention we serve the Miami area.",
    "custom_instructions": "Always ask if it's an emergency. Always mention we serve the Miami area.",
    "booking_enabled": true,
    "lead_creation_enabled": true,
    "transfer_enabled": true,
    "max_call_duration_seconds": 600
  },
  "providers": {
    "stt": {
      "provider_id": "uuid-deepgram",
      "provider_key": "deepgram",
      "api_key": "DECRYPTED_DEEPGRAM_API_KEY_HERE",
      "config": {
        "model": "nova-2-phonecall",
        "punctuate": true,
        "interim_results": true
      }
    },
    "llm": {
      "provider_id": "uuid-openai",
      "provider_key": "openai",
      "api_key": "DECRYPTED_OPENAI_API_KEY_HERE",
      "config": {
        "model": "gpt-4o-mini",
        "temperature": 0.7,
        "max_tokens": 500
      }
    },
    "tts": {
      "provider_id": "uuid-cartesia",
      "provider_key": "cartesia",
      "api_key": "DECRYPTED_CARTESIA_API_KEY_HERE",
      "config": {
        "model": "sonic-multilingual",
        "speed": 1.0
      },
      "voice_id": "agent_UB73EHZHv65uQTn44Hddho"
    }
  },
  "services": [
    {
      "name": "Plumbing Repair",
      "description": "General plumbing fixes and maintenance"
    },
    {
      "name": "Water Heater",
      "description": "Installation, repair, and replacement of water heaters"
    }
  ],
  "service_areas": [
    {
      "type": "city",
      "value": "Miami",
      "state": "FL"
    },
    {
      "type": "city",
      "value": "Coral Gables",
      "state": "FL"
    }
  ],
  "business_hours": [
    {
      "day": "Monday",
      "is_closed": false,
      "shifts": [
        { "open": "08:00", "close": "17:00" }
      ]
    },
    {
      "day": "Tuesday",
      "is_closed": false,
      "shifts": [
        { "open": "08:00", "close": "17:00" }
      ]
    },
    {
      "day": "Wednesday",
      "is_closed": false,
      "shifts": [
        { "open": "08:00", "close": "17:00" }
      ]
    },
    {
      "day": "Thursday",
      "is_closed": false,
      "shifts": [
        { "open": "08:00", "close": "17:00" }
      ]
    },
    {
      "day": "Friday",
      "is_closed": false,
      "shifts": [
        { "open": "08:00", "close": "17:00" }
      ]
    },
    {
      "day": "Saturday",
      "is_closed": false,
      "shifts": [
        { "open": "09:00", "close": "13:00" }
      ]
    },
    {
      "day": "Sunday",
      "is_closed": true,
      "shifts": []
    }
  ],
  "industries": [
    {
      "name": "Plumbing",
      "description": "Residential and commercial plumbing services"
    },
    {
      "name": "HVAC",
      "description": "Heating, ventilation, and air conditioning services"
    }
  ],
  "transfer_numbers": [
    {
      "id": "uuid",
      "label": "Sales",
      "phone_number": "+15559876543",
      "transfer_type": "primary",
      "is_default": false,
      "available_hours": null
    },
    {
      "id": "uuid",
      "label": "Emergency",
      "phone_number": "+15550001111",
      "transfer_type": "emergency",
      "is_default": true,
      "available_hours": null
    }
  ]
}
```

**Response Fields**:

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| call_sid | string | Yes | Twilio CallSid if provided in query params |
| tenant.business_description | string | Yes | "About Us" text describing the business. **NEW FIELD** - helps agent introduce the company to callers. |
| business_hours | array | No | Daily operating hours with support for split shifts (e.g., 8am-12pm, 2pm-5pm). **NEW FIELD** - agent can tell callers when business is open. |
| business_hours[].day | string | No | Day name (Monday, Tuesday, etc.) |
| business_hours[].is_closed | boolean | No | Whether business is closed on this day |
| business_hours[].shifts | array | No | Array of open/close time pairs (empty if closed) |
| business_hours[].shifts[].open | string | No | Opening time (HH:MM format, 24-hour) |
| business_hours[].shifts[].close | string | No | Closing time (HH:MM format, 24-hour) |
| industries | array | No | Business types/industries. **NEW FIELD** - helps agent understand business context. |
| industries[].name | string | No | Industry name (e.g., "Plumbing", "HVAC") |
| industries[].description | string | Yes | Industry description |

**Response 401**: `{ "statusCode": 401, "message": "Invalid agent API key" }`
**Response 403**: `{ "statusCode": 403, "message": "Voice AI not enabled for tenant" }`
**Response 404**: `{ "statusCode": 404, "message": "Tenant not found" }`

**Agent Implementation Notes**:
1. Call this endpoint ONCE at call start - never cache the response
2. Extract and use provider credentials immediately
3. Never log the full response (contains plaintext API keys)
4. If call fails, call again (context is always fresh, never cached server-side)

---

### POST /api/v1/internal/voice-ai/calls/start

**Auth**: X-Voice-Agent-Key header
**Purpose**: Create call log entry when agent accepts a call
**Use Case**: Track call start time and initial metadata
**Idempotent**: Safe to call multiple times with same call_sid (upserts on call_sid)

**Request Headers**:
```
X-Voice-Agent-Key: {agent_api_key}
Content-Type: application/json
```

**Request Body**:
```json
{
  "tenant_id": "uuid",
  "call_sid": "CA1234567890abcdef",
  "from_number": "+15551234567",
  "to_number": "+15559876543",
  "direction": "inbound"
}
```

**Request Body Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tenant_id | string (UUID) | ✅ Yes | Tenant ID from SIP URI |
| call_sid | string | ✅ Yes | Twilio CallSid (must be unique) |
| from_number | string | ✅ Yes | Caller phone number (E.164) |
| to_number | string | ✅ Yes | Dialed number (E.164) |
| direction | string | ✅ Yes | Call direction: "inbound" or "outbound" |

**Response 201** (Created):
```json
{
  "call_log_id": "uuid",
  "message": "Call log created successfully"
}
```

**Response 200** (Already Exists - Idempotent):
```json
{
  "call_log_id": "uuid",
  "message": "Call log already exists"
}
```

**Response 400** (Validation Error):
```json
{
  "statusCode": 400,
  "message": [
    "tenant_id must be a UUID",
    "call_sid should not be empty",
    "from_number must be in E.164 format"
  ],
  "error": "Bad Request"
}
```

**Response 401**: `{ "statusCode": 401, "message": "Invalid agent API key" }`

---

### POST /api/v1/internal/voice-ai/calls/:callSid/complete

**Auth**: X-Voice-Agent-Key header
**Purpose**: Finalize call log and persist usage records
**Use Case**: Called at end of call to save transcript, duration, and provider usage metrics
**Atomic**: All writes happen in a single transaction

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| callSid | string | Twilio CallSid |

**Request Headers**:
```
X-Voice-Agent-Key: {agent_api_key}
Content-Type: application/json
```

**Request Body**:
```json
{
  "tenant_id": "uuid",
  "status": "completed",
  "outcome": "lead_created",
  "duration_seconds": 127,
  "transcript_summary": "Customer inquired about roofing services for a leak repair. Lead created and appointment scheduled for Friday 2pm.",
  "full_transcript": "[{\"timestamp\":\"2026-02-22T14:30:05.000Z\",\"speaker\":\"agent\",\"text\":\"Hello, thank you for calling...\"},{\"timestamp\":\"2026-02-22T14:30:08.000Z\",\"speaker\":\"user\",\"text\":\"Hi, I need a quote for roof repair.\"}]",
  "actions_taken": "[{\"type\":\"lead_created\",\"lead_id\":\"uuid\",\"timestamp\":\"2026-02-22T14:31:00.000Z\"},{\"type\":\"service_area_checked\",\"result\":\"covered\"}]",
  "lead_id": "uuid",
  "is_overage": false,
  "stt_provider_id": "uuid-deepgram",
  "llm_provider_id": "uuid-openai",
  "tts_provider_id": "uuid-cartesia",
  "usage": [
    {
      "provider_id": "uuid-deepgram",
      "provider_type": "STT",
      "usage_quantity": 127.0,
      "usage_unit": "seconds",
      "estimated_cost": 0.54
    },
    {
      "provider_id": "uuid-openai",
      "provider_type": "LLM",
      "usage_quantity": 842.0,
      "usage_unit": "tokens",
      "estimated_cost": 0.17
    },
    {
      "provider_id": "uuid-cartesia",
      "provider_type": "TTS",
      "usage_quantity": 543.0,
      "usage_unit": "characters",
      "estimated_cost": 0.32
    }
  ]
}
```

**Request Body Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tenant_id | string (UUID) | ✅ Yes | Tenant ID (must match call log) |
| status | string | ✅ Yes | Final call status: "completed", "transferred", "abandoned", "error" |
| outcome | string | ❌ No | Call outcome: "lead_created", "transferred", "info_given", "abandoned" |
| duration_seconds | number | ✅ Yes | Call duration in seconds |
| transcript_summary | string | ❌ No | AI-generated summary of conversation |
| full_transcript | string | ❌ No | Full conversation transcript (JSON string) |
| actions_taken | string | ❌ No | JSON array of actions performed during call |
| lead_id | string (UUID) | ❌ No | Lead ID if lead was created during call |
| is_overage | boolean | ❌ No | Whether call exceeded quota (default: false) |
| stt_provider_id | string (UUID) | ❌ No | STT provider used |
| llm_provider_id | string (UUID) | ❌ No | LLM provider used |
| tts_provider_id | string (UUID) | ❌ No | TTS provider used |
| usage | array | ✅ Yes | Per-provider usage records |
| usage[].provider_id | string (UUID) | ✅ Yes | Provider UUID |
| usage[].provider_type | string | ✅ Yes | "STT", "LLM", or "TTS" |
| usage[].usage_quantity | number | ✅ Yes | Quantity consumed (seconds, tokens, characters) |
| usage[].usage_unit | string | ✅ Yes | Unit: "seconds", "tokens", "characters" |
| usage[].estimated_cost | number | ❌ No | Estimated cost in USD |

**Response 200**:
```json
{
  "message": "Call log finalized successfully",
  "call_log_id": "uuid",
  "usage_records_created": 3
}
```

**Response 400** (Validation Error):
```json
{
  "statusCode": 400,
  "message": [
    "status must be one of: completed, transferred, abandoned, error",
    "duration_seconds must be a positive number",
    "usage must be an array"
  ],
  "error": "Bad Request"
}
```

**Response 401**: `{ "statusCode": 401, "message": "Invalid agent API key" }`
**Response 404**: `{ "statusCode": 404, "message": "Call log not found with sid CA123..." }`

---

## Voice AI Tools (Sprint 19)

The Voice AI agent has access to several tools that it can invoke during a call to perform actions like booking appointments, rescheduling, and canceling. These tools are exposed via HTTP endpoints that the Python agent calls when the LLM decides to use them.

---

### Tool: reschedule_appointment

**Purpose**: Allows Voice AI to reschedule an existing appointment with identity verification.

**Tool Definition** (passed to LLM):
```json
{
  "name": "reschedule_appointment",
  "description": "Reschedules an existing appointment to a new date/time. Verifies caller identity before allowing reschedule.",
  "parameters": {
    "call_log_id": {
      "type": "string",
      "required": true,
      "description": "The UUID of the current call log"
    },
    "lead_id": {
      "type": "string",
      "required": true,
      "description": "The UUID of the lead requesting reschedule"
    },
    "appointment_id": {
      "type": "string",
      "required": false,
      "description": "The UUID of the appointment to reschedule (provide when caller confirms new time)"
    },
    "new_date": {
      "type": "string",
      "required": false,
      "description": "New date in YYYY-MM-DD format (provide when caller confirms new time)"
    },
    "new_time": {
      "type": "string",
      "required": false,
      "description": "New start time in HH:MM format (provide when caller confirms new time)"
    }
  }
}
```

**Endpoint**: `POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/reschedule_appointment`

**Auth**: X-Voice-Agent-Key header

**Identity Verification**: Caller phone number (from call_log) must match lead's phone number

**Two-Phase Operation**:

**Phase 1 - Initial Call** (get current appointment + available slots):
```json
{
  "call_log_id": "uuid",
  "lead_id": "uuid"
}
```

**Phase 2 - Confirm Call** (execute reschedule):
```json
{
  "call_log_id": "uuid",
  "lead_id": "uuid",
  "appointment_id": "uuid",
  "new_date": "2026-03-12",
  "new_time": "10:30"
}
```

---

#### Response Scenarios

**1. Verification Failed** (caller phone doesn't match lead):
```json
{
  "status": "verification_failed",
  "message": "Phone number does not match our records.",
  "action": "Voice AI should ask for name + appointment date for manual verification"
}
```

**2. No Active Appointment**:
```json
{
  "status": "no_appointment_found",
  "message": "No active appointments found for this lead.",
  "action": "Voice AI should offer to book a new appointment"
}
```

**3. Multiple Active Appointments** (caller must choose):
```json
{
  "status": "multiple_appointments",
  "appointments": [
    {
      "id": "uuid",
      "date": "2026-03-10",
      "time": "09:00",
      "type": "Quote Visit"
    },
    {
      "id": "uuid",
      "date": "2026-03-15",
      "time": "14:00",
      "type": "Follow-up Visit"
    }
  ],
  "message": "You have multiple appointments. Which one would you like to reschedule?",
  "action": "Voice AI should read appointments and ask caller to choose one"
}
```

**4. Available Slots Returned** (Phase 1 success):
```json
{
  "status": "slots_available",
  "current_appointment": {
    "id": "uuid",
    "date": "2026-03-10",
    "time": "09:00",
    "type": "Quote Visit"
  },
  "available_slots": [
    {
      "date": "2026-03-12",
      "day_name": "Thursday",
      "slots": [
        { "start_time": "09:00", "end_time": "10:30" },
        { "start_time": "10:30", "end_time": "12:00" }
      ]
    },
    {
      "date": "2026-03-13",
      "day_name": "Friday",
      "slots": [
        { "start_time": "14:00", "end_time": "15:30" }
      ]
    }
  ],
  "message": "Your current appointment is March 10 at 9 AM. Next available times are Thursday March 12...",
  "action": "Voice AI should present slots conversationally and ask caller to choose"
}
```

**5. Rescheduled Successfully** (Phase 2 success):
```json
{
  "status": "rescheduled",
  "new_appointment_id": "uuid",
  "old_appointment_id": "uuid",
  "message": "Your appointment has been rescheduled to March 12 at 10:30 AM",
  "confirmation_sent": true
}
```

**6. Error**:
```json
{
  "status": "error",
  "error": "Appointment not found or cannot be rescheduled"
}
```

---

### Tool: cancel_appointment

**Purpose**: Allows Voice AI to cancel an existing appointment with identity verification.

**Tool Definition** (passed to LLM):
```json
{
  "name": "cancel_appointment",
  "description": "Cancels an existing appointment. Verifies caller identity before allowing cancellation.",
  "parameters": {
    "call_log_id": {
      "type": "string",
      "required": true,
      "description": "The UUID of the current call log"
    },
    "lead_id": {
      "type": "string",
      "required": true,
      "description": "The UUID of the lead requesting cancellation"
    },
    "appointment_id": {
      "type": "string",
      "required": false,
      "description": "The UUID of the appointment to cancel (provide when caller confirms cancellation)"
    },
    "reason": {
      "type": "string",
      "required": false,
      "description": "Reason for cancellation (optional - Voice AI can ask)"
    }
  }
}
```

**Endpoint**: `POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/cancel_appointment`

**Auth**: X-Voice-Agent-Key header

**Identity Verification**: Same as reschedule_appointment

**Two-Phase Operation**:

**Phase 1 - Initial Call** (get active appointments):
```json
{
  "call_log_id": "uuid",
  "lead_id": "uuid"
}
```

**Phase 2 - Confirm Call** (execute cancellation):
```json
{
  "call_log_id": "uuid",
  "lead_id": "uuid",
  "appointment_id": "uuid",
  "reason": "customer_cancelled"
}
```

---

#### Response Scenarios

**1. Verification Failed**: Same as reschedule

**2. No Active Appointment**: Same as reschedule

**3. Multiple Active Appointments**: Same as reschedule (caller must choose which to cancel)

**4. Cancelled Successfully**:
```json
{
  "status": "cancelled",
  "appointment_id": "uuid",
  "appointment_date": "2026-03-10",
  "appointment_time": "09:00",
  "cancellation_reason": "customer_cancelled",
  "message": "Your appointment on March 10 at 9 AM has been cancelled.",
  "confirmation_sent": true
}
```

**5. Error**:
```json
{
  "status": "error",
  "error": "Appointment not found or cannot be cancelled"
}
```

---

### Voice AI Conversation Flow Examples

**Example 1: Successful Reschedule**

```
Caller: "I need to reschedule my appointment"
AI: [Calls reschedule_appointment with call_log_id and lead_id]
AI: [Receives slots_available response]
AI: "Your current appointment is Thursday, March 10 at 9 AM. I have availability on March 12 at 9 AM, 10:30 AM, or March 15 at 2 PM. Which works best for you?"
Caller: "March 12 at 10:30"
AI: [Confirms reschedule with appointment_id, new_date, new_time]
AI: [Receives rescheduled response]
AI: "Perfect! I've rescheduled your appointment to Thursday, March 12 at 10:30 AM. You'll receive a confirmation text message shortly."
```

**Example 2: Identity Verification Failure**

```
Caller: "I want to cancel my appointment"
AI: [Calls cancel_appointment with call_log_id and lead_id]
AI: [Receives verification_failed response]
AI: "I need to verify your identity. Can you please provide your full name and the date of your appointment?"
Caller: "John Smith, March 10"
AI: [Manual verification by staff or secondary check]
```

**Example 3: No Active Appointment**

```
Caller: "I'd like to reschedule"
AI: [Calls reschedule_appointment]
AI: [Receives no_appointment_found response]
AI: "I don't see any upcoming appointments for you. Would you like to schedule a new appointment?"
```

**Example 4: Multiple Appointments**

```
Caller: "I need to cancel"
AI: [Calls cancel_appointment]
AI: [Receives multiple_appointments response]
AI: "I see you have two appointments: one on March 10 at 9 AM for a Quote Visit, and another on March 15 at 2 PM for a Follow-up Visit. Which one would you like to cancel?"
Caller: "The one on March 10"
AI: [Confirms cancellation with appointment_id for March 10 appointment]
AI: [Receives cancelled response]
AI: "Your appointment on March 10 at 9 AM has been cancelled. Is there anything else I can help you with?"
```

---

## Business Context in Voice AI Agent

When a call starts, the Voice AI Context Builder loads tenant-specific business information and provides it to the Python voice agent. This context helps the AI agent understand the business and provide contextually appropriate responses.

### How Services & Industries Are Used

**Services** and **Industries** are automatically loaded for each tenant and included in the agent context:

- **Services**: What the business offers (e.g., "Roofing", "Plumbing", "HVAC Repair")
- **Industries**: Business categories (e.g., "Construction", "Home Services", "Property Management")

Both are platform-wide master lists managed by admins, with tenants self-assigning which apply to their business.

### Context Structure

The Voice AI agent receives comprehensive business context in this format:

```typescript
interface VoiceAIContext {
  tenant: {
    name: string;
    businessDescription: string | null;
  };
  services: Array<{
    name: string;
    description: string | null;
  }>;
  industries: Array<{
    name: string;
    description: string | null;
  }>;
  businessHours: {
    monday?: { open1: string; close1: string; open2?: string; close2?: string };
    tuesday?: { open1: string; close1: string; open2?: string; close2?: string };
    wednesday?: { open1: string; close1: string; open2?: string; close2?: string };
    thursday?: { open1: string; close1: string; open2?: string; close2?: string };
    friday?: { open1: string; close1: string; open2?: string; close2?: string };
    saturday?: { open1: string; close1: string; open2?: string; close2?: string };
    sunday?: { open1: string; close1: string; open2?: string; close2?: string };
    timezone: string;
  };
  serviceAreas: Array<{
    area_type: 'radius' | 'zip_codes' | 'counties' | 'cities' | 'states';
    // ... area-specific fields
  }>;
  transferNumbers: Array<{
    label: string;
    phone_number: string;
    is_primary: boolean;
  }>;
}
```

### Example Context Payload

Here's a real example of what the agent receives:

```json
{
  "tenant": {
    "name": "ABC Roofing & Gutters",
    "businessDescription": "Full-service roofing contractor specializing in residential and commercial projects"
  },
  "services": [
    { "name": "Roofing", "description": "Roof installation, repair, and replacement" },
    { "name": "Gutter Installation", "description": "Seamless gutter systems and repairs" },
    { "name": "Roof Inspection", "description": "Comprehensive roof inspections and assessments" }
  ],
  "industries": [
    { "name": "Construction", "description": "Building and construction services" },
    { "name": "Home Services", "description": "Residential home improvement services" }
  ],
  "businessHours": {
    "monday": { "open1": "08:00", "close1": "17:00" },
    "tuesday": { "open1": "08:00", "close1": "17:00" },
    "wednesday": { "open1": "08:00", "close1": "17:00" },
    "thursday": { "open1": "08:00", "close1": "17:00" },
    "friday": { "open1": "08:00", "close1": "17:00" },
    "timezone": "America/New_York"
  },
  "serviceAreas": [
    {
      "area_type": "radius",
      "center_latitude": 40.7128,
      "center_longitude": -74.0060,
      "radius_miles": 50
    }
  ],
  "transferNumbers": [
    {
      "label": "Main Office",
      "phone_number": "+15551234567",
      "is_primary": true
    }
  ]
}
```

### How Agent Uses This Context

The Voice AI agent uses services and industries to provide contextually appropriate responses:

#### Scenario 1: Service Inquiry (Service Listed)
**Caller**: "Do you do roof repairs?"
**Agent checks**: `services` array includes "Roofing"
**Agent responds**: "Yes, we offer roofing services including repair, installation, and replacement. Would you like to schedule an appointment or get a free estimate?"

#### Scenario 2: Service Inquiry (Service NOT Listed)
**Caller**: "Do you do plumbing?"
**Agent checks**: `services` array does NOT include "Plumbing"
**Agent responds**: "We don't offer plumbing services. We specialize in roofing and gutter installation. Can I help you with either of those services?"

#### Scenario 3: Business Type Question
**Caller**: "What kind of business is this?"
**Agent checks**: `industries` array includes "Home Services" and "Construction"
**Agent responds**: "We're a home services company specializing in construction projects. Our main focus is roofing and gutter systems for both residential and commercial properties."

#### Scenario 4: Service Area Question
**Caller**: "Do you service Brooklyn?"
**Agent checks**: `serviceAreas` array for radius/zip/county coverage
**Agent responds**: "Yes, we service Brooklyn. We cover a 50-mile radius from Manhattan, which includes all of Brooklyn. Would you like to schedule a free inspection?"

#### Scenario 5: Hours Question
**Caller**: "Are you open on Saturday?"
**Agent checks**: `businessHours` for Saturday
**Agent responds**: "We're currently closed on weekends. Our hours are Monday through Friday, 8 AM to 5 PM Eastern Time. However, I can schedule an appointment for you during the week. What day works best for you?"

### Context Loading

The context is loaded by the **Voice AI Context Builder Service** ([voice-ai-context-builder.service.ts](../src/modules/voice-ai/services/voice-ai-context-builder.service.ts)) when:

1. **Call Starts**: Agent calls `GET /internal/voice-ai/tenant/{tenantId}/context`
2. **Context Built**: Service queries database for all tenant business info
3. **Returned to Agent**: Complete context object sent in single response
4. **Agent Uses**: Python voice agent uses context throughout the call

### Best Practices

**For Tenants**:
- Keep services list accurate (only include what you actually offer)
- Update industries to match your business type
- Provide clear service descriptions (helps AI explain offerings better)
- Keep business hours current

**For Developers**:
- Context is cached per call (no need to refetch)
- Services and industries are loaded from junction tables (`tenant_service`, `tenant_industry`)
- Only active services/industries are included in context
- Empty arrays are valid (tenant hasn't configured services/industries yet)

---

## Internal Agent Call Flow

Typical sequence for agent integration:

```
1. Agent receives SIP call with tenantId parameter
   ↓
2. Call GET /internal/voice-ai/tenant/{tenantId}/access
   - Check if has_access == true
   - If false, reject call with appropriate message
   ↓
3. Call GET /internal/voice-ai/tenant/{tenantId}/context?call_sid={CallSid}
   - Receive full context with decrypted provider keys
   - Initialize STT, LLM, TTS providers
   ↓
4. Call POST /internal/voice-ai/calls/start
   - Create call log entry
   - Receive call_log_id for tracking
   ↓
5. Handle call conversation
   - Use STT → LLM → TTS pipeline
   - Execute tools (create_lead, book_appointment, transfer_call)
   - Track usage per provider
   ↓
6. Call POST /internal/voice-ai/calls/{callSid}/complete
   - Finalize call log with transcript and duration
   - Persist usage records for billing
   - Update monthly usage aggregates
```

**Error Handling**:
- If step 2 fails: Reject call with "Service unavailable" message
- If step 3 fails: Retry once, then reject call
- If step 4 fails: Continue with call (will be logged on completion)
- If step 6 fails: Log error and retry up to 3 times with exponential backoff

---

## Error Response Format

All error responses follow this standard format:

```json
{
  "statusCode": 400,
  "errorCode": "VALIDATION_ERROR",
  "message": "Validation failed on field 'phone_number'",
  "error": "Bad Request",
  "timestamp": "2026-02-22T12:00:00.000Z",
  "path": "/api/v1/voice-ai/transfer-numbers",
  "requestId": "req_xxxxxxxxxx"
}
```

**Common Status Codes**:
- `200`: Success
- `201`: Created
- `204`: No Content (success, no body)
- `400`: Bad Request (validation error)
- `401`: Unauthorized (missing or invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `409`: Conflict (e.g., duplicate provider_key)

---

## Pagination Format

All paginated endpoints follow this format:

**Response**:
```json
{
  "data": [ ... ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "total_pages": 5
  }
}
```

**Default pagination**:
- `page`: 1 (1-based indexing)
- `limit`: 20
- `max limit`: 100

---

## Rate Limiting

Rate limiting is not currently enforced on Voice AI endpoints, but may be added in the future.

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-03-03 | 1.3 | **Sprint 19**: Added Voice AI Tools section documenting reschedule_appointment and cancel_appointment tools with identity verification, two-phase operation flow, and conversation examples. |
| 2026-02-25 | 1.2 | **MAJOR**: Added Internal Agent Endpoints section with 4 critical endpoints (access, context, start, complete). Added new fields to context: business_description, business_hours, industries. Enhanced context for better agent capabilities. |
| 2026-02-24 | 1.1 | Added GET `/api/v1/system/voice-ai/tenants/:tenantId/override` endpoint for retrieving current override settings (fixes tenant override form pre-population) |
| 2026-02-22 | 1.0 | Initial API documentation - Sprint BAS27 complete |

---

## Support

For API support, contact the platform admin or refer to the internal developer documentation.

---

**End of Voice AI REST API Documentation**
