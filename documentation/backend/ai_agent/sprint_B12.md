YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B12 — REST API Documentation

**Module**: Voice AI  
**Sprint**: B12  
**Depends on**: B02–B11 all complete  
**Estimated scope**: ~2 hours

---

## Objective

Generate the complete REST API documentation file for the Voice AI module. This file is the source of truth that all frontend agents will use to implement the UI.

---

## Pre-Coding Checklist

- [ ] All sprints B02–B11 are complete
- [ ] Backend server running: `http://localhost:8000`
- [ ] Test EVERY endpoint with curl before documenting (match real responses)
- [ ] Read `/api/documentation/communication_REST_API.md` — use as format reference

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`  
- Tenant: `contato@honeydo4you.com` / `978@F32c`  
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Output File

Create `/var/www/lead360.app/api/documentation/voice_ai_REST_API.md`

---

## Required Sections

### 1. Overview
- Module purpose
- Base URL: `https://api.lead360.app/api/v1` (production) / `http://localhost:8000/api/v1` (dev)
- Authentication methods (JWT Bearer, X-Voice-Agent-Key)

### 2. Authentication Reference Table

| Endpoint Group | Auth Method | Header |
|---|---|---|
| Admin Infrastructure | JWT Bearer | `Authorization: Bearer {token}` |
| Admin Monitoring | JWT Bearer | `Authorization: Bearer {token}` |
| Tenant | JWT Bearer | `Authorization: Bearer {token}` |
| Internal (Agent) | API Key | `X-Voice-Agent-Key: {key}` |

### 3. Admin Infrastructure Endpoints (fully documented)

For EACH endpoint, document:
- Method + path
- Description
- Authentication requirement
- Request body schema (all fields, types, required/optional)
- Response body schema (all fields, types)
- Example request (curl)
- Example response (JSON)
- Error responses (status codes + messages)

Endpoints to document:
- `GET /system/voice-ai/providers`
- `POST /system/voice-ai/providers`
- `PATCH /system/voice-ai/providers/:id`
- `DELETE /system/voice-ai/providers/:id`
- `GET /system/voice-ai/credentials`
- `PUT /system/voice-ai/credentials/:providerId`
- `DELETE /system/voice-ai/credentials/:providerId`
- `GET /system/voice-ai/config`
- `PATCH /system/voice-ai/config`
- `POST /system/voice-ai/config/regenerate-key`
- `GET /system/voice-ai/plans`
- `PATCH /system/voice-ai/plans/:planId/voice`

### 4. Admin Monitoring Endpoints (fully documented)

- `GET /system/voice-ai/tenants`
- `PATCH /system/voice-ai/tenants/:tenantId/override`
- `GET /system/voice-ai/call-logs`
- `GET /system/voice-ai/usage-report`

### 5. Tenant Endpoints (fully documented)

- `GET /voice-ai/settings`
- `PUT /voice-ai/settings`
- `GET /voice-ai/transfer-numbers`
- `POST /voice-ai/transfer-numbers`
- `PATCH /voice-ai/transfer-numbers/:id`
- `DELETE /voice-ai/transfer-numbers/:id`
- `GET /voice-ai/call-logs`
- `GET /voice-ai/call-logs/:id`
- `GET /voice-ai/usage`

### 6. Internal Agent Endpoints (fully documented)

- `GET /voice-ai/internal/context/:tenantId`
- `POST /voice-ai/internal/calls/start`
- `POST /voice-ai/internal/calls/end`
- `POST /voice-ai/internal/actions/lead`
- `POST /voice-ai/internal/actions/appointment`

For internal endpoints, include the FULL `FullVoiceAiContext` response schema with all fields documented.

### 7. Error Reference

| Status | Code | When |
|---|---|---|
| 400 | BAD_REQUEST | Validation error |
| 401 | UNAUTHORIZED | Missing/invalid auth |
| 403 | FORBIDDEN | Not admin or plan restriction |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Duplicate resource |
| 422 | UNPROCESSABLE_ENTITY | Business rule violation |
| 500 | INTERNAL_SERVER_ERROR | Server error |

---

## Documentation Quality Requirements

- Every field documented with: name, type, required/optional, description, example value
- Curl examples use real test credentials (admin/tenant from above)
- Response examples show real data shapes (test manually)
- No placeholders like `// TODO` or `...`

---

## Acceptance Criteria

- [ ] File created at `/api/documentation/voice_ai_REST_API.md`
- [ ] 100% of endpoints documented
- [ ] Every endpoint has example request + response
- [ ] FullVoiceAiContext response fully documented with all nested fields
- [ ] Error responses documented for each endpoint
- [ ] File is accurate (verified by testing real endpoints)
