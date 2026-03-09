# Sprint 19: API Documentation Update
## Voice Multilingual Architecture Fix

**Sprint Number**: 19 of 21
**Sprint Owner**: Documentation Specialist
**Estimated Effort**: 3-4 hours
**Prerequisites**: Sprints 16-18 complete (all backend endpoints implemented)

---

## Sprint Owner Role

You are a **masterclass Technical Writer** that makes Google, Amazon, and Apple docs jealous. You NEVER GUESS - you test every endpoint with curl, document every field, every status code, every error case. Your documentation is the single source of truth that frontend developers depend on.

---

## Goal

Update API documentation to reflect the new architecture:
1. **Rewrite** `voice_agent_profiles_REST_API.md` (complete overhaul)
2. **Update** `voice_ai_multilingual_REST_API.md` (architecture explanation)
3. **Document** all new endpoints with examples
4. **Include** error cases and edge cases

---

## Task 1: Test All Endpoints

**CRITICAL**: Before documenting, test EVERY endpoint with curl to verify:
- Request/response shapes
- Status codes
- Error messages
- Authentication requirements

### Admin Endpoints (Sprint 16)
```bash
# Set admin token
ADMIN_TOKEN="your-platform-admin-jwt"

# Test each endpoint
POST   /system/voice-ai/agent-profiles
GET    /system/voice-ai/agent-profiles
GET    /system/voice-ai/agent-profiles/:id
PATCH  /system/voice-ai/agent-profiles/:id
DELETE /system/voice-ai/agent-profiles/:id
```

### Tenant Endpoints (Sprint 17)
```bash
# Set tenant token
TENANT_TOKEN="your-tenant-jwt"

# Test each endpoint
GET    /voice-ai/available-profiles
POST   /voice-ai/agent-profile-overrides
GET    /voice-ai/agent-profile-overrides
GET    /voice-ai/agent-profile-overrides/:id
PATCH  /voice-ai/agent-profile-overrides/:id
DELETE /voice-ai/agent-profile-overrides/:id
```

**Document**: Save all curl commands and responses for reference.

---

## Task 2: Rewrite voice_agent_profiles_REST_API.md

**File**: `/api/documentation/voice_agent_profiles_REST_API.md`

**Structure**:

```markdown
# Voice AI Agent Profiles REST API

**Version**: 2.0 (Architecture v2 - Global Profiles + Tenant Overrides)
**Last Updated**: March 2026

## Architecture Overview

### Concept: Global Templates + Tenant Customization

Voice agent profiles follow a **two-tier architecture**:

1. **Global Profiles** (System Admin Managed):
   - Language templates available to ALL tenants
   - Examples: "English - Professional", "Portuguese - Friendly", "Spanish - Formal"
   - Created and managed by platform administrators
   - Endpoint: `/api/v1/system/voice-ai/agent-profiles`

2. **Tenant Overrides** (Tenant Managed):
   - Tenants SELECT a global profile
   - Tenants CUSTOMIZE greeting/instructions per their business needs
   - Subject to subscription plan limits
   - Endpoint: `/api/v1/voice-ai/agent-profile-overrides`

### Resolution Flow

```
IVR Action (agent_profile_id: global-en-001)
    ↓
Context Builder loads Global Profile "English - Professional"
    ↓
Checks for Tenant Override
    ↓
If override exists → Apply custom greeting/instructions
If not → Use global defaults
    ↓
Final Context sent to Voice Agent
```

---

## System Admin Endpoints

### Authentication
All admin endpoints require:
- **Header**: `Authorization: Bearer {jwt-token}`
- **Permission**: Platform Admin (`is_platform_admin: true`)

Unauthorized requests return `401 Unauthorized`.
Non-admin requests return `403 Forbidden`.

---

### Create Global Profile

**POST** `/api/v1/system/voice-ai/agent-profiles`

**Description**: Creates a new global voice agent profile template.

**Request Body**:
```json
{
  "language_code": "en",
  "language_name": "English",
  "voice_id": "2b568345-1f36-4cf8-baa7-5932856bf66a",
  "display_name": "English - Professional",
  "description": "Professional English voice for business calls",
  "default_greeting": "Hello, thank you for calling {business_name}!",
  "default_instructions": "You are a professional phone assistant...",
  "is_active": true,
  "display_order": 1
}
```

**Response** (`201 Created`):
```json
{
  "id": "00000000-0000-0000-0000-000000000001",
  "language_code": "en",
  "language_name": "English",
  "voice_id": "2b568345-1f36-4cf8-baa7-5932856bf66a",
  "voice_provider_type": "tts",
  "display_name": "English - Professional",
  "description": "Professional English voice for business calls",
  "default_greeting": "Hello, thank you for calling {business_name}!",
  "default_instructions": "You are a professional phone assistant...",
  "is_active": true,
  "display_order": 1,
  "created_at": "2026-03-04T12:00:00.000Z",
  "updated_at": "2026-03-04T12:00:00.000Z",
  "updated_by": "admin-user-uuid"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid input (validation failed)
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - User is not a platform admin
- `409 Conflict` - Display name already exists

**Example**:
```bash
curl -X POST https://api.lead360.app/api/v1/system/voice-ai/agent-profiles \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "language_code": "en",
    "language_name": "English",
    "voice_id": "cartesia-uuid",
    "display_name": "English - Professional"
  }'
```

[... Document all other admin endpoints similarly ...]

---

## Tenant Endpoints

### Authentication
All tenant endpoints require:
- **Header**: `Authorization: Bearer {jwt-token}`
- **Tenant ID**: Extracted from JWT (`req.user.tenant_id`)
- **Roles**: Varies by endpoint (Owner, Admin, Manager)

---

### List Available Global Profiles

**GET** `/api/v1/voice-ai/available-profiles`

**Description**: Returns all global profiles available for selection (read-only).

**Query Parameters**:
- `active_only` (boolean, optional, default: `true`) - Filter to active profiles only

**Response** (`200 OK`):
```json
[
  {
    "id": "00000000-0000-0000-0000-000000000001",
    "language_code": "en",
    "language_name": "English",
    "voice_id": "cartesia-uuid",
    "display_name": "English - Professional",
    "description": "Professional English voice",
    "default_greeting": "Hello...",
    "default_instructions": "You are...",
    "is_active": true,
    "display_order": 1
  },
  {
    "id": "00000000-0000-0000-0000-000000000002",
    "language_code": "pt",
    "language_name": "Portuguese",
    "voice_id": "cartesia-uuid-pt",
    "display_name": "Portuguese - Friendly",
    "description": "Friendly Portuguese voice",
    "default_greeting": "Olá...",
    "default_instructions": "Você é...",
    "is_active": true,
    "display_order": 2
  }
]
```

**Example**:
```bash
curl -X GET 'https://api.lead360.app/api/v1/voice-ai/available-profiles?active_only=true' \
  -H "Authorization: Bearer $TENANT_TOKEN"
```

[... Document all other tenant endpoints similarly ...]

---

## Common Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": ["language_code must be a string", "voice_id should not be empty"],
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 403 Forbidden - Plan Limit
```json
{
  "statusCode": 403,
  "message": "Your plan allows a maximum of 1 active voice agent profile(s). You currently have 1 active. Deactivate or delete an existing profile, or upgrade your plan.",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Global voice agent profile not found: {id}",
  "error": "Not Found"
}
```

### 409 Conflict
```json
{
  "statusCode": 409,
  "message": "A global profile with display name \"English - Professional\" already exists.",
  "error": "Conflict"
}
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | March 2026 | Architecture redesign: Global profiles + tenant overrides |
| 1.0 | March 2026 | Initial implementation (deprecated) |
```

---

## Task 3: Update voice_ai_multilingual_REST_API.md

**File**: `/api/documentation/voice_ai_multilingual_REST_API.md`

**Add Section**:
```markdown
## Architecture Change (March 2026)

### Version 1 → Version 2 Migration

**Old Architecture** (Deprecated):
- Tenants created their own profiles
- No global templates
- Duplication across tenants

**New Architecture** (Current):
- System admin creates global profile templates
- Tenants select and customize
- Centralized language/voice management

**Migration Impact**:
- Existing tenant profiles migrated to tenant overrides
- All IVR configurations updated to reference global profiles
- Plan limits now apply to active selections (not creations)

**For API Consumers**:
- Use `/api/v1/voice-ai/available-profiles` to list global profiles
- Use `/api/v1/voice-ai/agent-profile-overrides` to manage customizations
```

---

## Acceptance Criteria

- [ ] All endpoints tested with curl (success + error cases)
- [ ] `voice_agent_profiles_REST_API.md` completely rewritten
- [ ] `voice_ai_multilingual_REST_API.md` updated with architecture explanation
- [ ] All request/response examples accurate (tested)
- [ ] All error cases documented
- [ ] Authentication requirements clear
- [ ] RBAC roles documented
- [ ] Changelog updated

---

**Next Sprint**: 20 - Admin UI for Global Profile Management

---

**Sprint Status**: Ready to Execute
