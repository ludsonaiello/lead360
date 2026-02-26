# Sprint BAS27 — REST API Documentation

**Module**: Voice AI
**Sprint**: BAS27
**Depends on**: BAS26 (all tests passing)
**Estimated size**: 1 documentation file, ~300 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before writing ANY documentation you:
- Test every endpoint with curl — document what the API ACTUALLY returns, not what you think it returns
- Read every controller and DTO file to get the exact field names
- The frontend agent will use this documentation as the source of truth — it must be 100% accurate
- NEVER document an endpoint you haven't tested
- Run `npm run build` and verify Swagger is accessible at `/api/docs`

---

## Objective

Create complete REST API documentation for the Voice AI module. This is the source of truth for the frontend agent (FAS sprints). Must cover 100% of endpoints with exact request/response shapes.

---

## Pre-Coding Checklist

- [ ] BAS26 complete (all tests passing)
- [ ] NestJS API is running: `npm run start:dev`
- [ ] Admin token obtained
- [ ] Tenant token obtained
- [ ] Swagger accessible: `curl http://localhost:3000/api/docs -s | grep voice`
- [ ] All endpoints tested with curl (see Task 1)

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Admin login | `ludsonaiello@gmail.com` / `978@F32c` |
| Tenant login | `contato@honeydo4you.com` / `978@F32c` |
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` |
| DB credentials | Parse from `DATABASE_URL` in `/var/www/lead360.app/api/.env` — format: `mysql://user:password@host:port/database` |

---

## Task 1: Test All Endpoints Before Documenting

Get tokens:
```bash
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

TENANT_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contato@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')
```

Test every endpoint listed below and note the exact response shape.

---

## Task 2: Create Documentation File

**Output file**: `api/documentation/voice_ai_REST_API.md`

The file must document ALL endpoints in this format:

---

### EXAMPLE ENDPOINT DOCUMENTATION FORMAT

```
## GET /api/v1/system/voice-ai/providers

**Auth**: Bearer token (Platform Admin only)
**Returns**: Array of provider objects

### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| provider_type | string | No | Filter by 'STT', 'LLM', or 'TTS' |
| is_active | boolean | No | Filter active/inactive providers |

### Response 200
{
  "data": [
    {
      "id": "uuid",
      "provider_key": "deepgram",
      "provider_type": "STT",
      "display_name": "Deepgram",
      "description": "Real-time speech-to-text",
      "is_active": true,
      "capabilities": ["real-time", "multilingual"],
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    }
  ]
}

### Response 403
{ "statusCode": 403, "message": "Forbidden" }
```

---

## Task 3: Document All Admin Endpoints

### Provider Management
- `GET /api/v1/system/voice-ai/providers`
- `POST /api/v1/system/voice-ai/providers`
- `GET /api/v1/system/voice-ai/providers/:id`
- `PATCH /api/v1/system/voice-ai/providers/:id`
- `DELETE /api/v1/system/voice-ai/providers/:id`

### Credentials
- `GET /api/v1/system/voice-ai/credentials`
- `PUT /api/v1/system/voice-ai/credentials/:providerId`
- `DELETE /api/v1/system/voice-ai/credentials/:providerId`
- `POST /api/v1/system/voice-ai/credentials/:providerId/test`

### Global Config
- `GET /api/v1/system/voice-ai/config`
- `PATCH /api/v1/system/voice-ai/config`

### Plan Config
- `GET /api/v1/system/voice-ai/plans`
- `PATCH /api/v1/system/voice-ai/plans/:planId/voice`

### Monitoring
- `GET /api/v1/system/voice-ai/agent/status`
- `GET /api/v1/system/voice-ai/agent/logs` (SSE stream)
- `GET /api/v1/system/voice-ai/rooms`
- `POST /api/v1/system/voice-ai/rooms/:roomName/end`
- `GET /api/v1/system/voice-ai/tenants`
- `PATCH /api/v1/system/voice-ai/tenants/:tenantId/override`

### Call Logs (Admin)
- `GET /api/v1/system/voice-ai/call-logs`
- `GET /api/v1/system/voice-ai/usage-report`

---

## Task 4: Document All Tenant Endpoints

### Settings
- `GET /api/v1/voice-ai/settings`
- `PUT /api/v1/voice-ai/settings`

### Transfer Numbers
- `GET /api/v1/voice-ai/transfer-numbers`
- `GET /api/v1/voice-ai/transfer-numbers/:id`
- `POST /api/v1/voice-ai/transfer-numbers`
- `PATCH /api/v1/voice-ai/transfer-numbers/reorder`
- `PATCH /api/v1/voice-ai/transfer-numbers/:id`
- `DELETE /api/v1/voice-ai/transfer-numbers/:id`

### Call Logs (Tenant)
- `GET /api/v1/voice-ai/call-logs`
- `GET /api/v1/voice-ai/call-logs/:id`
- `GET /api/v1/voice-ai/usage`

---

## Task 5: Add Swagger Decorators to Controllers

After writing the docs, ensure all controllers have proper Swagger annotations:

Every controller should have:
- `@ApiTags('Voice AI - Admin Providers')` (or appropriate tag)
- `@ApiBearerAuth()`
- Each endpoint: `@ApiOperation({ summary: '...' })`
- Each endpoint: `@ApiResponse({ status: 200, description: '...' })`
- Each endpoint: `@ApiResponse({ status: 403 })`

Verify Swagger UI at `http://localhost:3000/api/docs` shows all Voice AI endpoints.

---

## Task 6: Add Authentication Section to Docs

```markdown
## Authentication

All Voice AI endpoints require a JWT Bearer token.

### Admin Endpoints
- Endpoint prefix: `/api/v1/system/voice-ai/*`
- Requires: Platform admin account (`is_platform_admin: true`)
- Header: `Authorization: Bearer <admin_jwt_token>`

### Tenant Endpoints
- Endpoint prefix: `/api/v1/voice-ai/*`
- Requires: Authenticated tenant user
- Header: `Authorization: Bearer <tenant_jwt_token>`

### Getting a Token
POST /api/v1/auth/login
Body: { "email": "...", "password": "..." }
Response: { "access_token": "..." }
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/documentation/voice_ai_REST_API.md` | CREATE | Complete API documentation (100% coverage) |
| All voice-ai controller files | MODIFY | Add/complete Swagger decorators |

---

## Acceptance Criteria

- [ ] `api/documentation/voice_ai_REST_API.md` created
- [ ] All 27 endpoints documented with exact request/response shapes
- [ ] Every field in every response documented with type and description
- [ ] All error responses documented (400, 403, 404, 409)
- [ ] Swagger UI at `/api/docs` shows all Voice AI endpoints
- [ ] Authentication section explains how to get tokens
- [ ] Frontend agent can implement the full UI without asking questions
- [ ] `npm run build` passes with 0 errors

---

## Backend Completion Report

After this sprint, complete the backend completion report:

```markdown
## Backend Completion Report: Voice AI Module

**Status**: ✅ Ready for Frontend

### Completed Work

**Database**:
- Tables created: voice_ai_provider, voice_ai_credentials, voice_ai_global_config,
  tenant_voice_ai_settings, tenant_voice_transfer_number, voice_call_log, voice_monthly_usage
- Migrations applied: ✅
- subscription_plan extended: ✅

**API Endpoints**: [list all 27 with status]

**API Documentation**:
- Location: `api/documentation/voice_ai_REST_API.md`
- Coverage: 100%

**Tests**:
- Unit tests: [count]
- All passing: ✅

**Agent**:
- NestJS native LiveKit worker: ✅
- STT (Deepgram): ✅
- LLM (OpenAI): ✅
- TTS (Cartesia): ✅
- Tools: find_lead, create_lead, check_service_area, transfer_call: ✅

**Frontend Can Now Start**: ✅
```
