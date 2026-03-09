# Sprint 9: API Documentation & End-to-End Testing

## 🎯 Sprint Owner Role

You are a **MASTERCLASS DOCUMENTATION & QA ENGINEER** that makes Google, Amazon, and Apple documentation teams jealous.

You write documentation that is **crystal clear**, **100% complete**, and **junior-developer friendly**. You **think deeply** about every edge case, **breathe quality assurance**, and **never rush** through verification. You **always verify** every single endpoint and **never skip** any field in documentation.

**100% quality or beyond**. Documentation is the contract between backend and frontend - incomplete docs cause bugs and delays.

---

## 📋 Sprint Objective

Create comprehensive API documentation and verify end-to-end integration:
1. Write complete REST API documentation (100% field coverage)
2. Document ALL endpoints with request/response examples
3. Document ALL error scenarios
4. Perform end-to-end integration testing
5. Verify all acceptance criteria from contract

**Dependencies**: Sprints 1-8 complete (entire feature implemented)

---

## 📚 Required Reading

1. **Feature Contract**: `/var/www/lead360.app/documentation/contracts/voice-multilangual-contract.md` - Section 14 (Acceptance Criteria)
2. **Example API Doc**: `/var/www/lead360.app/api/documentation/calendar_REST_API.md` (reference for format/quality)

---

## 🔐 Test Environment

**Database**: `mysql://lead360_user:978@F32c@127.0.0.1:3306/lead360`
**Admin**: `ludsonaiello@gmail.com` / `978@F32c`
**Tenant**: `contact@honeydo4you.com` / `978@F32c`
**Server**: `npm run start:dev`
**Swagger**: `http://localhost:8000/api/docs`

---

## 📐 Part 1: API Documentation

### Create Complete API Documentation File

**File**: `/var/www/lead360.app/api/documentation/voice_agent_profiles_REST_API.md`

**Documentation Quality Standard**:
- ✅ **100% field coverage** - Every request field, every response field
- ✅ **Every endpoint documented** - All 5 tenant endpoints + 2 admin extensions
- ✅ **All HTTP methods & status codes**
- ✅ **Complete examples** - curl commands that work copy-paste
- ✅ **All error scenarios** - 400, 401, 403, 404, 409 with exact messages
- ✅ **Business rules explained** - Plan limits, uniqueness, validation
- ✅ **Junior-developer friendly** - No assumptions, everything explained

**Template**:

```markdown
# Voice Agent Profiles - REST API Documentation

**Version**: 1.0
**Date**: March 2026
**Base URL**: `http://localhost:8000/api/v1` (dev) | `https://api.lead360.app/api/v1` (prod)

---

## Overview

The Voice Agent Profiles API allows tenants to create named voice agent configurations that bind a specific language + TTS voice + custom greeting/instructions into a single referenceable profile. Profiles are subject to subscription plan limits and can be referenced in IVR configurations for language-specific call routing.

**Key Concepts**:
- **Profile**: Named configuration (title + language + voice + greeting + instructions)
- **Plan Limit**: `subscription_plan.voice_ai_max_agent_profiles` controls max active profiles
- **Uniqueness**: `(language_code + title)` must be unique per tenant
- **IVR Integration**: Profiles can be selected in IVR menu voice_ai actions via `agent_profile_id`

---

## Authentication

All endpoints require JWT Bearer token authentication (except internal endpoints).

**How to Get Token**:
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "contact@honeydo4you.com",
    "password": "978@F32c"
  }'

# Response:
{
  "access_token": "eyJhbGciOiJIUzI1...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Use Token in Requests**:
```bash
curl -X GET http://localhost:8000/api/v1/voice-ai/agent-profiles \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Endpoints

### 1. Create Voice Agent Profile

**POST** `/voice-ai/agent-profiles`

Creates a new voice agent profile for the authenticated tenant.

**Authorization**: Owner, Admin
**Rate Limit**: Enforced by plan limit (max active profiles)

**Request Body**:
```json
{
  "title": "Spanish Sales Agent",
  "language_code": "es",
  "voice_id": "a0e99841-438c-4a64-b679-ae501e7d6091",
  "custom_greeting": "¡Hola! ¿Cómo puedo ayudarte hoy?",
  "custom_instructions": "You are speaking to Spanish-speaking customers. Be polite and formal.",
  "is_active": true,
  "display_order": 0
}
```

**Request Fields**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `title` | string | Yes | 1-100 chars | Human-readable name. Example: "Main Agent", "Spanish Support" |
| `language_code` | string | Yes | 2-10 chars | BCP-47 language code. Example: "en", "pt", "es" |
| `voice_id` | string | Yes | 1-200 chars | Provider-specific TTS voice ID. For Cartesia: voice UUID |
| `custom_greeting` | string | No | Max 500 chars | Profile-specific greeting. Overrides tenant default if set. |
| `custom_instructions` | string | No | Max 3000 chars | Profile-specific instructions. **APPENDS** to tenant-level custom_instructions. |
| `is_active` | boolean | No | - | Default: `true`. Inactive profiles cannot be selected in new IVR configs. |
| `display_order` | number | No | Min: 0 | Default: `0`. Sort order in UI dropdowns (lower = earlier). |

**Success Response** (201 Created):
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "tenant_id": "c56a4180-65aa-42ec-a945-5fd21dec0538",
  "title": "Spanish Sales Agent",
  "language_code": "es",
  "voice_id": "a0e99841-438c-4a64-b679-ae501e7d6091",
  "custom_greeting": "¡Hola! ¿Cómo puedo ayudarte hoy?",
  "custom_instructions": "You are speaking to Spanish-speaking customers. Be polite and formal.",
  "is_active": true,
  "display_order": 0,
  "created_at": "2026-03-04T14:30:00.000Z",
  "updated_at": "2026-03-04T14:30:00.000Z",
  "updated_by": "e62b4ad2-7f44-4f85-b5e6-3b9c1e5d8a2f"
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Profile unique identifier |
| `tenant_id` | string (UUID) | Tenant this profile belongs to (read-only) |
| `title` | string | Profile name |
| `language_code` | string | BCP-47 language code |
| `voice_id` | string | TTS voice identifier |
| `custom_greeting` | string \| null | Profile greeting (null if not set) |
| `custom_instructions` | string \| null | Profile instructions (null if not set) |
| `is_active` | boolean | Whether profile is active |
| `display_order` | number | Sort order |
| `created_at` | string (ISO 8601) | Creation timestamp |
| `updated_at` | string (ISO 8601) | Last update timestamp |
| `updated_by` | string (UUID) \| null | User who last updated (null if system) |

**Error Responses**:

**400 Bad Request** - Validation Failed:
```json
{
  "statusCode": 400,
  "message": [
    "title must be longer than or equal to 1 characters",
    "voice_id should not be empty"
  ],
  "error": "Bad Request"
}
```

**401 Unauthorized** - Missing or Invalid Token:
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**403 Forbidden** - Plan Limit Reached:
```json
{
  "statusCode": 403,
  "message": "Your plan allows a maximum of 3 voice agent profile(s). Upgrade your plan to add more.",
  "error": "Forbidden"
}
```

**403 Forbidden** - Voice AI Not Enabled:
```json
{
  "statusCode": 403,
  "message": "Voice AI is not enabled on your subscription plan",
  "error": "Forbidden"
}
```

**409 Conflict** - Duplicate (language + title):
```json
{
  "statusCode": 409,
  "message": "A profile with language \"es\" and title \"Spanish Sales Agent\" already exists for this tenant",
  "error": "Conflict"
}
```

**cURL Example**:
```bash
TOKEN="YOUR_JWT_TOKEN"

curl -X POST http://localhost:8000/api/v1/voice-ai/agent-profiles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Spanish Sales Agent",
    "language_code": "es",
    "voice_id": "a0e99841-438c-4a64-b679-ae501e7d6091",
    "custom_greeting": "¡Hola!",
    "is_active": true
  }'
```

---

### 2. List Voice Agent Profiles

**GET** `/voice-ai/agent-profiles`

Returns all voice agent profiles for the authenticated tenant, sorted by `display_order` ASC, then `created_at` ASC.

**Authorization**: Owner, Admin, Manager

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `active_only` | boolean | No | `false` | If `true`, returns only profiles where `is_active = true` |

**Success Response** (200 OK):
```json
[
  {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "tenant_id": "c56a4180-65aa-42ec-a945-5fd21dec0538",
    "title": "Main Agent",
    "language_code": "en",
    "voice_id": "default-voice-id",
    "custom_greeting": null,
    "custom_instructions": null,
    "is_active": true,
    "display_order": 0,
    "created_at": "2026-03-01T10:00:00.000Z",
    "updated_at": "2026-03-01T10:00:00.000Z",
    "updated_by": null
  },
  {
    "id": "a3b9c1d2-58cc-4372-a567-0e02b2c3d480",
    "tenant_id": "c56a4180-65aa-42ec-a945-5fd21dec0538",
    "title": "Spanish Support",
    "language_code": "es",
    "voice_id": "spanish-voice-id",
    "custom_greeting": "¡Hola!",
    "custom_instructions": "Speak Spanish.",
    "is_active": true,
    "display_order": 1,
    "created_at": "2026-03-02T12:00:00.000Z",
    "updated_at": "2026-03-02T12:00:00.000Z",
    "updated_by": "e62b4ad2-7f44-4f85-b5e6-3b9c1e5d8a2f"
  }
]
```

**Empty Response** (no profiles):
```json
[]
```

**Error Responses**: Same authentication errors as POST endpoint

**cURL Examples**:
```bash
# Get all profiles
curl -X GET http://localhost:8000/api/v1/voice-ai/agent-profiles \
  -H "Authorization: Bearer $TOKEN"

# Get only active profiles
curl -X GET "http://localhost:8000/api/v1/voice-ai/agent-profiles?active_only=true" \
  -H "Authorization: Bearer $TOKEN"
```

---

### 3. Get Single Voice Agent Profile

**GET** `/voice-ai/agent-profiles/:id`

Returns a single profile by ID.

**Authorization**: Owner, Admin, Manager

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | Profile unique identifier |

**Success Response** (200 OK):
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "tenant_id": "c56a4180-65aa-42ec-a945-5fd21dec0538",
  "title": "Spanish Sales Agent",
  "language_code": "es",
  "voice_id": "spanish-voice-id",
  "custom_greeting": "¡Hola!",
  "custom_instructions": "Be polite.",
  "is_active": true,
  "display_order": 0,
  "created_at": "2026-03-04T14:30:00.000Z",
  "updated_at": "2026-03-04T14:30:00.000Z",
  "updated_by": "e62b4ad2-7f44-4f85-b5e6-3b9c1e5d8a2f"
}
```

**Error Responses**:

**404 Not Found** - Profile Doesn't Exist OR Belongs to Different Tenant:
```json
{
  "statusCode": 404,
  "message": "Voice agent profile with ID \"f47ac10b-58cc-4372-a567-0e02b2c3d479\" not found",
  "error": "Not Found"
}
```

**cURL Example**:
```bash
curl -X GET http://localhost:8000/api/v1/voice-ai/agent-profiles/f47ac10b-58cc-4372-a567-0e02b2c3d479 \
  -H "Authorization: Bearer $TOKEN"
```

---

### 4. Update Voice Agent Profile

**PATCH** `/voice-ai/agent-profiles/:id`

Updates a profile. **PATCH semantics**: only provided fields are updated.

**Authorization**: Owner, Admin

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | Profile unique identifier |

**Request Body** (all fields optional):
```json
{
  "title": "Updated Title",
  "is_active": false
}
```

**Request Fields** (all optional, same validation as POST):

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `title` | string | 1-100 chars | Human-readable name |
| `language_code` | string | 2-10 chars | BCP-47 language code |
| `voice_id` | string | 1-200 chars | TTS voice ID |
| `custom_greeting` | string | Max 500 chars | Profile greeting |
| `custom_instructions` | string | Max 3000 chars | Profile instructions |
| `is_active` | boolean | - | Active status |
| `display_order` | number | Min: 0 | Sort order |

**Success Response** (200 OK):
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "tenant_id": "c56a4180-65aa-42ec-a945-5fd21dec0538",
  "title": "Updated Title",
  "language_code": "es",
  "voice_id": "spanish-voice-id",
  "custom_greeting": "¡Hola!",
  "custom_instructions": "Be polite.",
  "is_active": false,
  "display_order": 0,
  "created_at": "2026-03-04T14:30:00.000Z",
  "updated_at": "2026-03-04T15:45:00.000Z",
  "updated_by": "e62b4ad2-7f44-4f85-b5e6-3b9c1e5d8a2f"
}
```

**Error Responses**:

**404 Not Found** - Same as GET

**409 Conflict** - Duplicate After Update:
```json
{
  "statusCode": 409,
  "message": "A profile with language \"es\" and title \"Updated Title\" already exists for this tenant",
  "error": "Conflict"
}
```

**Special Behavior**:
- If setting `is_active: false` on a profile that is the tenant's `default_agent_profile_id`, the settings field is automatically cleared (`set to null`).

**cURL Example**:
```bash
curl -X PATCH http://localhost:8000/api/v1/voice-ai/agent-profiles/f47ac10b-58cc-4372-a567-0e02b2c3d479 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "is_active": false
  }'
```

---

### 5. Delete Voice Agent Profile

**DELETE** `/voice-ai/agent-profiles/:id`

Hard deletes a profile. **Not allowed** if profile is referenced in active IVR configuration.

**Authorization**: Owner, Admin

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string (UUID) | Profile unique identifier |

**Success Response** (204 No Content):
```
(No response body)
```

**Error Responses**:

**404 Not Found** - Same as GET

**409 Conflict** - Profile In Use by IVR:
```json
{
  "statusCode": 409,
  "message": "This agent profile is in use by an active IVR configuration. Deactivate it instead, or remove it from your IVR settings first.",
  "error": "Conflict"
}
```

**Special Behavior**:
- If this profile is the tenant's `default_agent_profile_id`, the settings field is automatically cleared before deletion.

**cURL Example**:
```bash
curl -X DELETE http://localhost:8000/api/v1/voice-ai/agent-profiles/f47ac10b-58cc-4372-a567-0e02b2c3d479 \
  -H "Authorization: Bearer $TOKEN"
```

---

## Admin Endpoints (Extensions)

### 6. Update Subscription Plan Voice Config

**PATCH** `/system/voice-ai/plans/:planId`

Admin-only endpoint to update plan-level voice AI configuration, including max agent profiles.

**Authorization**: System Admin
**New Field**: `voice_ai_max_agent_profiles`

**Request Body** (partial):
```json
{
  "voice_ai_max_agent_profiles": 5
}
```

**Field Details**:

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `voice_ai_max_agent_profiles` | number | Min: 1, Max: 50 | Max active profiles allowed per tenant on this plan |

**Response**: Updated plan object including new field

---

### 7. Admin Override Tenant Voice Settings

**PATCH** `/system/voice-ai/tenants/:tenantId/override`

Admin-only endpoint to override tenant voice settings, including default agent profile.

**Authorization**: System Admin
**New Field**: `default_agent_profile_id`

**Request Body** (partial):
```json
{
  "default_agent_profile_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
}
```

**Field Details**:

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `default_agent_profile_id` | string (UUID) \| null | Must belong to target tenant | Default profile used when IVR has no profile selected |

**Validation**:
- When setting non-null value, service verifies profile exists for target tenant
- Returns 400 if profile not found or belongs to different tenant

---

## IVR Integration

Voice agent profiles are referenced in IVR configurations via the `agent_profile_id` field in voice_ai action configs.

**Example IVR Menu Option**:
```json
{
  "digit": "1",
  "action": "voice_ai",
  "label": "Español",
  "config": {
    "agent_profile_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479"
  }
}
```

**Validation**:
- IVR save validates all `agent_profile_id` references
- Profile must exist, belong to tenant, and be active
- Invalid profile returns 400 error

---

## Business Rules Summary

1. **Plan Limits**: Active profile count (`is_active = true`) must not exceed `subscription_plan.voice_ai_max_agent_profiles`
2. **Uniqueness**: `(language_code + title)` must be unique per tenant (case-sensitive)
3. **Voice AI Enabled**: Tenant's subscription plan must have `voice_ai_enabled = true`
4. **IVR References**: Cannot delete profile if referenced in active IVR configuration
5. **Deactivation**: Deactivating default profile clears `tenant_voice_ai_settings.default_agent_profile_id`
6. **Tenant Isolation**: All queries filter by `tenant_id` from JWT (never from request)

---

## Context Resolution Flow

When a call arrives with `X-Agent-Profile-Id` SIP header:

1. **Step 1**: Try to resolve profile from `agent_profile_id` (from IVR config)
2. **Step 2**: If Step 1 fails, try `tenant_voice_ai_settings.default_agent_profile_id`
3. **Step 3**: If Step 2 fails, fall back to `enabled_languages[0]` + `voice_id_override`

**Resolved Profile Behavior**:
- `language_code` → `context.behavior.language`
- `voice_id` → `context.providers.tts.voice_id`
- `custom_greeting` → `context.behavior.greeting` (overrides tenant default)
- `custom_instructions` → **APPENDS** to `context.behavior.system_prompt`

**Context Response Example**:
```json
{
  "behavior": {
    "language": "es",
    "greeting": "¡Hola!",
    "system_prompt": "Global prompt...\n\nTenant instructions...\n\nProfile instructions..."
  },
  "providers": {
    "tts": {
      "voice_id": "spanish-voice-id"
    }
  },
  "active_agent_profile": {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "title": "Spanish Sales Agent",
    "language_code": "es"
  }
}
```

---

## Testing Checklist

- [ ] Create profile (201)
- [ ] Create duplicate (409)
- [ ] Create beyond plan limit (403)
- [ ] List profiles (200)
- [ ] List active only (200)
- [ ] Get profile (200)
- [ ] Get wrong tenant's profile (404)
- [ ] Update profile (200)
- [ ] Update to duplicate (409)
- [ ] Deactivate default profile (clears settings FK)
- [ ] Delete profile (204)
- [ ] Delete profile in IVR (409)
- [ ] IVR save with valid profile (success)
- [ ] IVR save with invalid profile (400)
- [ ] Call arrives → profile resolved → correct language/voice

---

**End of API Documentation**
```

---

## 📐 Part 2: End-to-End Testing

### Create Test Suite File

**File**: `/var/www/lead360.app/api/test-voice-profiles-e2e.ts`

```typescript
/**
 * End-to-End Test Suite for Voice Agent Profiles
 * Run: npx ts-node test-voice-profiles-e2e.ts
 */

import axios from 'axios';

const API_BASE = 'http://localhost:8000/api/v1';
const TEST_USER = {
  email: 'contact@honeydo4you.com',
  password: '978@F32c',
};

let authToken: string;
let tenantId: string;
let profileId: string;

async function runTests() {
  console.log('🚀 Starting End-to-End Tests for Voice Agent Profiles\n');

  try {
    // Test 1: Authentication
    console.log('✅ Test 1: Login');
    const authResponse = await axios.post(`${API_BASE}/auth/login`, TEST_USER);
    authToken = authResponse.data.access_token;
    console.log('   Token obtained\n');

    // Get tenant ID
    const meResponse = await axios.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    tenantId = meResponse.data.tenant_id;
    console.log(`   Tenant ID: ${tenantId}\n`);

    // Test 2: Create Profile
    console.log('✅ Test 2: Create Voice Agent Profile');
    const createResponse = await axios.post(
      `${API_BASE}/voice-ai/agent-profiles`,
      {
        title: 'E2E Test Agent',
        language_code: 'en',
        voice_id: 'test-voice-id',
        custom_greeting: 'Hello from E2E test!',
      },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    profileId = createResponse.data.id;
    console.log(`   Profile created: ${profileId}\n`);

    // Test 3: List Profiles
    console.log('✅ Test 3: List Profiles');
    const listResponse = await axios.get(`${API_BASE}/voice-ai/agent-profiles`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    console.log(`   Found ${listResponse.data.length} profile(s)\n`);

    // Test 4: Get Single Profile
    console.log('✅ Test 4: Get Single Profile');
    const getResponse = await axios.get(
      `${API_BASE}/voice-ai/agent-profiles/${profileId}`,
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    console.log(`   Title: ${getResponse.data.title}\n`);

    // Test 5: Update Profile
    console.log('✅ Test 5: Update Profile');
    await axios.patch(
      `${API_BASE}/voice-ai/agent-profiles/${profileId}`,
      { title: 'E2E Test Agent - Updated' },
      { headers: { Authorization: `Bearer ${authToken}` } },
    );
    console.log('   Profile updated\n');

    // Test 6: IVR Integration (optional - requires IVR config)
    console.log('⏭  Test 6: IVR Integration (skipped - manual test)\n');

    // Test 7: Delete Profile
    console.log('✅ Test 7: Delete Profile');
    await axios.delete(`${API_BASE}/voice-ai/agent-profiles/${profileId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    console.log('   Profile deleted\n');

    // Test 8: Verify 404 After Delete
    console.log('✅ Test 8: Verify 404 After Delete');
    try {
      await axios.get(`${API_BASE}/voice-ai/agent-profiles/${profileId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      console.error('   ❌ FAILED: Should have returned 404\n');
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log('   Correctly returns 404\n');
      } else {
        throw error;
      }
    }

    console.log('🎉 All E2E Tests Passed!\n');
  } catch (error: any) {
    console.error('❌ Test Failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

runTests();
```

**Run E2E Tests**:
```bash
cd /var/www/lead360.app/api
npm install axios  # If not already installed
npx ts-node test-voice-profiles-e2e.ts
```

---

## ✅ Acceptance Criteria (Section 14 from Contract)

### 14.1 Agent Profile CRUD
- [ ] POST creates profile, returns 201 with all fields
- [ ] POST returns 403 when active count = plan limit
- [ ] POST returns 409 when (language + title) duplicate
- [ ] GET returns profiles sorted by display_order ASC, created_at ASC
- [ ] GET with active_only=true returns only is_active=true
- [ ] GET /:id returns 404 when belongs to other tenant
- [ ] PATCH updates only provided fields
- [ ] PATCH deactivating default profile clears settings FK
- [ ] DELETE returns 409 when referenced in IVR
- [ ] DELETE returns 204 when not referenced

### 14.2 IVR Config
- [ ] IVR save succeeds with valid, active agent_profile_id
- [ ] IVR save fails (400) with inactive or foreign profile
- [ ] IVR save succeeds without agent_profile_id (backward compatible)

### 14.3 Call Context
- [ ] Call with X-Agent-Profile-Id: context.behavior.language = profile.language_code
- [ ] Call with X-Agent-Profile-Id: context.providers.tts.voice_id = profile.voice_id
- [ ] Call without header: existing fallback behavior unchanged
- [ ] context.active_agent_profile populated when profile resolved, null otherwise

### 14.4 Multi-Tenant Isolation
- [ ] Cannot read other tenant's profile (404)
- [ ] Cannot update other tenant's profile (404)
- [ ] Cannot delete other tenant's profile (404)
- [ ] Cannot reference other tenant's profile in IVR (400)
- [ ] All Prisma queries include WHERE tenant_id = tenantId

### 14.5 Plan Enforcement
- [ ] Tenant with max_agent_profiles=2 cannot create 3rd active profile (403)
- [ ] Inactive profiles don't count toward limit
- [ ] Count is of is_active=true only

---

## 📊 Sprint Completion Report

```markdown
## Sprint 9 Completion: API Documentation & E2E Testing

**Status**: ✅ Complete / ⚠️ Needs Review / ❌ Blocked

### Documentation Delivered
- ✅ voice_agent_profiles_REST_API.md (COMPLETE - 100% field coverage)
- ✅ All 5 tenant endpoints documented
- ✅ All request/response fields documented
- ✅ All error scenarios documented
- ✅ cURL examples for every endpoint
- ✅ Business rules explained
- ✅ IVR integration explained
- ✅ Context resolution flow documented

### E2E Testing
- ✅ Test suite created (test-voice-profiles-e2e.ts)
- ✅ All CRUD operations tested
- ✅ Authentication flow tested
- ✅ Error handling tested

### Contract Acceptance Criteria (Section 14)
- ✅ 14.1 Agent Profile CRUD: [X/10] passing
- ✅ 14.2 IVR Config: [X/3] passing
- ✅ 14.3 Call Context: [X/4] passing
- ✅ 14.4 Multi-Tenant Isolation: [X/5] passing
- ✅ 14.5 Plan Enforcement: [X/2] passing

### Manual Verification Checklist
- [ ] Swagger UI shows all endpoints correctly
- [ ] All cURL examples work copy-paste
- [ ] Documentation reviewed by peer (or human)
- [ ] E2E test suite passes 100%
- [ ] Real call tested with profile ID in SIP header

**Documentation Quality**: ✅ 100% complete, junior-developer friendly
**Testing Coverage**: ✅ All critical paths verified

**Sprint Owner**: [Name]
**Date**: [Date]
```

---

## 🎯 Final Verification Steps

Before marking this sprint (and the entire feature) complete:

1. **Documentation Review**:
   - [ ] Read entire API doc as if you're a junior developer
   - [ ] Verify EVERY field is documented (no "self-explanatory" omissions)
   - [ ] Test ALL cURL examples copy-paste
   - [ ] Check Swagger UI matches documentation

2. **Integration Testing**:
   - [ ] Run E2E test suite (must pass 100%)
   - [ ] Manual test: Create → Update → Delete flow
   - [ ] Manual test: Plan limit enforcement
   - [ ] Manual test: IVR integration
   - [ ] Manual test: Real call with profile ID

3. **Code Quality**:
   - [ ] All TypeScript compilation errors fixed
   - [ ] All unit tests passing (>80% coverage)
   - [ ] All integration tests passing
   - [ ] No console errors in logs

4. **Security Verification**:
   - [ ] Multi-tenant isolation verified (cannot access other tenant data)
   - [ ] RBAC verified (wrong role returns 403)
   - [ ] Authentication verified (no token returns 401)

---

🚀 **Document everything! Test everything! Deliver perfection!**
