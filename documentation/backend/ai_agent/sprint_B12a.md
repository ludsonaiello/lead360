YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B12a — REST API Documentation: Admin Infrastructure Endpoints

**Module**: Voice AI
**Sprint**: B12a
**Depends on**: B02a, B02b, B03 all complete
**Next**: B12b (Monitoring + Tenant endpoints), B12c (Internal agent endpoints)

---

## Objective

Document all admin infrastructure endpoints for the Voice AI module. This covers providers, credentials, global config, and subscription plan voice flags. Frontend admin agents (FSA01–FSA03) will use this documentation exclusively.

---

## Pre-Coding Checklist

- [ ] B02a, B02b, B03 are complete — all admin infra endpoints working
- [ ] Backend server running: `http://localhost:8000`
- [ ] **HIT EVERY ENDPOINT** to capture real response shapes before writing docs
- [ ] Read `/api/documentation/communication_REST_API.md` — use as format reference
  ```bash
  TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

  curl http://localhost:8000/api/v1/system/voice-ai/providers -H "Authorization: Bearer $TOKEN" | jq .
  curl http://localhost:8000/api/v1/system/voice-ai/credentials -H "Authorization: Bearer $TOKEN" | jq .
  curl http://localhost:8000/api/v1/system/voice-ai/config -H "Authorization: Bearer $TOKEN" | jq .
  curl http://localhost:8000/api/v1/system/voice-ai/plans -H "Authorization: Bearer $TOKEN" | jq .
  ```

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant: `contato@honeydo4you.com` / `978@F32c`
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Output File

Append to (or create): `/var/www/lead360.app/api/documentation/voice_ai_REST_API.md`

Start with the overview section, then document all 12 admin infrastructure endpoints.

---

## Required Sections

### Section 1: Overview

```markdown
# Voice AI Module — REST API Documentation

## Base URLs
- Production: `https://api.lead360.app/api/v1`
- Development: `http://localhost:8000/api/v1`

## Authentication

| Endpoint Group | Auth Method | Header |
|---|---|---|
| Admin Infrastructure | JWT Bearer | `Authorization: Bearer {token}` |
| Admin Monitoring | JWT Bearer | `Authorization: Bearer {token}` |
| Tenant | JWT Bearer | `Authorization: Bearer {token}` |
| Internal (Python Agent) | API Key | `X-Voice-Agent-Key: {key}` |

All admin endpoints require `is_platform_admin: true` on the user account.
```

### Section 2: Admin Infrastructure Endpoints

Document these 12 endpoints with full request/response schemas, curl examples, and error codes:

**Providers**
- `GET /system/voice-ai/providers` — list all providers
- `POST /system/voice-ai/providers` — create a provider
- `PATCH /system/voice-ai/providers/:id` — update a provider
- `DELETE /system/voice-ai/providers/:id` — soft-delete (is_active=false)

**Credentials**
- `GET /system/voice-ai/credentials` — list masked credentials
- `PUT /system/voice-ai/credentials/:providerId` — upsert encrypted credential
- `DELETE /system/voice-ai/credentials/:providerId` — remove credential

**Global Config**
- `GET /system/voice-ai/config` — get platform-wide defaults
- `PATCH /system/voice-ai/config` — update config fields
- `POST /system/voice-ai/config/regenerate-key` — regenerate agent API key (returns plain key ONCE)

**Subscription Plans**
- `GET /system/voice-ai/plans` — list plans with voice AI flags
- `PATCH /system/voice-ai/plans/:planId/voice` — update voice AI fields on a plan

---

## For Each Endpoint Include

1. **Method + full path** (e.g., `GET /api/v1/system/voice-ai/providers`)
2. **Description** — one sentence
3. **Auth** — `JWT Bearer, is_platform_admin required`
4. **Request body** — all fields with type, required/optional, validation rules, example value
5. **Query parameters** (if any) — same format
6. **Response body** — all fields with type and description
7. **Curl example** using real credentials
8. **Example response** (JSON from actual API call)
9. **Error responses** — list each relevant status code with message

---

## Documentation Quality Requirements

- Every field documented: name, type, required/optional, description, example
- Curl examples must use real credentials that work
- Response examples must be real JSON from the running API (not invented)
- No placeholders, no `// TODO`, no `...`
- `config_schema` field: show the JSON Schema structure clearly (it drives the dynamic config UI)
- `FullVoiceAiContext` shape documented in B12c (not here)

---

## Acceptance Criteria

- [ ] Overview section with base URLs and auth table written
- [ ] All 12 admin infrastructure endpoints documented with full schema
- [ ] `config_schema` field format explained (drives dynamic form in FSA03)
- [ ] `POST /system/voice-ai/config/regenerate-key` behavior documented: returns plain key ONCE, then only last-4 visible
- [ ] Curl examples tested against running server
- [ ] File saved at `/api/documentation/voice_ai_REST_API.md`
