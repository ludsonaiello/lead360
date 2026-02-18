YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B12b — REST API Documentation: Monitoring + Tenant Endpoints

**Module**: Voice AI
**Sprint**: B12b
**Depends on**: B12a complete, B07, B11 all complete
**Next**: B12c (Internal agent endpoints)

---

## Objective

Document admin monitoring endpoints and all tenant-facing endpoints. Frontend agents FSA04, FSA05 (admin), FTA01–FTA05 (tenant) depend on this documentation.

---

## Pre-Coding Checklist

- [ ] B12a is complete (overview + admin infra already documented)
- [ ] B07, B11 are complete — all monitoring + tenant endpoints working
- [ ] Backend server running: `http://localhost:8000`
- [ ] **HIT EVERY ENDPOINT** to capture real response shapes:
  ```bash
  TOKEN_ADMIN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

  TOKEN_TENANT=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"contato@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

  # Admin monitoring
  curl "http://localhost:8000/api/v1/system/voice-ai/tenants" -H "Authorization: Bearer $TOKEN_ADMIN" | jq .
  curl "http://localhost:8000/api/v1/system/voice-ai/call-logs" -H "Authorization: Bearer $TOKEN_ADMIN" | jq .
  curl "http://localhost:8000/api/v1/system/voice-ai/usage-report?year=2026&month=2" -H "Authorization: Bearer $TOKEN_ADMIN" | jq .

  # Tenant
  curl http://localhost:8000/api/v1/voice-ai/settings -H "Authorization: Bearer $TOKEN_TENANT" | jq .
  curl http://localhost:8000/api/v1/voice-ai/transfer-numbers -H "Authorization: Bearer $TOKEN_TENANT" | jq .
  curl http://localhost:8000/api/v1/voice-ai/call-logs -H "Authorization: Bearer $TOKEN_TENANT" | jq .
  curl "http://localhost:8000/api/v1/voice-ai/usage?year=2026&month=2" -H "Authorization: Bearer $TOKEN_TENANT" | jq .
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

---

## Required Sections

### Section 3: Admin Monitoring Endpoints (4 endpoints)

Document with full request/response schemas, curl examples, error codes:

- `GET /system/voice-ai/tenants`
  - Query params: `page` (default 1), `limit` (default 20), `search` (optional name filter)
  - Response: paginated list with per-tenant voice AI summary (plan, enabled, minutes used, override badge)

- `PATCH /system/voice-ai/tenants/:tenantId/override`
  - Body: `AdminOverrideTenantVoiceDto` (force_enabled, monthly_minutes_override, provider override IDs, admin_notes)
  - Document: null values remove override, non-null values set override

- `GET /system/voice-ai/call-logs`
  - Query params: `tenantId` (optional), `from` (ISO date), `to` (ISO date), `outcome`, `page`, `limit`
  - Response: paginated cross-tenant call logs with all fields

- `GET /system/voice-ai/usage-report`
  - Query params: `year` (default current), `month` (default current)
  - Response: `{ total_calls, total_stt_seconds, total_estimated_cost, by_tenant: [...] }`

### Section 4: Tenant Endpoints (9 endpoints)

Document with full schemas, curl examples (using tenant token), error codes:

**Settings**
- `GET /voice-ai/settings` — get tenant's voice AI settings (returns null if not configured)
- `PUT /voice-ai/settings` — upsert settings (behavior fields only, not infrastructure)
  - 403 if plan does not include voice AI and `is_enabled: true` being set

**Transfer Numbers**
- `GET /voice-ai/transfer-numbers` — list tenant's transfer numbers (ordered by display_order)
- `POST /voice-ai/transfer-numbers` — create transfer number (max 10 enforced)
- `PATCH /voice-ai/transfer-numbers/:id` — update transfer number
- `DELETE /voice-ai/transfer-numbers/:id` — delete transfer number
- Document: `transfer_type` values (primary/overflow/after_hours/emergency), `available_hours` JSON format

**Call Logs**
- `GET /voice-ai/call-logs` — tenant's paginated call logs
  - Query: `from`, `to`, `outcome`, `page` (default 1), `limit` (default 20)
- `GET /voice-ai/call-logs/:id` — single call log with full detail + usage records

**Usage**
- `GET /voice-ai/usage` — tenant's monthly usage summary
  - Query: `year` (default current year), `month` (default current month)
  - Response: `{ year, month, total_calls, total_stt_seconds, total_llm_tokens, total_tts_characters, estimated_cost, by_provider: [...] }`
  - Also includes quota: `{ minutes_included, minutes_used, minutes_remaining, quota_exceeded }`

---

## For Each Endpoint Include

1. **Method + full path** with all path params noted
2. **Description** — one sentence
3. **Auth** — JWT Bearer + role requirement
4. **Request body** — all fields: type, required/optional, constraints, example
5. **Query parameters** — all options with defaults
6. **Response body** — full schema with nested objects
7. **Curl example** using real credentials
8. **Example response** (JSON from actual API)
9. **Error responses** — all relevant status codes

---

## Acceptance Criteria

- [ ] All 4 admin monitoring endpoints documented with full schema and examples
- [ ] All 9 tenant endpoints documented (settings, transfer-numbers, call-logs, usage)
- [ ] `transfer_type` enum values documented (primary/overflow/after_hours/emergency)
- [ ] `available_hours` JSON format documented with example
- [ ] Pagination format documented (page, limit, total, totalPages)
- [ ] Usage summary response schema matches B07 `getUsageSummary()` return type exactly
- [ ] Appended to `/api/documentation/voice_ai_REST_API.md`
