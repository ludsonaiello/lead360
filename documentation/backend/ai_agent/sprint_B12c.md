YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B12c — REST API Documentation: Internal Agent Endpoints

**Module**: Voice AI
**Sprint**: B12c
**Depends on**: B12b complete, B06a, B06b, B06c all complete

---

## Objective

Document all 5 internal endpoints that the Python agent calls, plus the complete `FullVoiceAiContext` JSON schema. This is the most critical section for Python agent developers — they must match every field exactly.

---

## Pre-Coding Checklist

- [ ] B12a and B12b are complete (overview + other sections already documented)
- [ ] B06a, B06b, B06c are complete — all internal endpoints working
- [ ] Backend server running: `http://localhost:8000`
- [ ] **HIT EVERY INTERNAL ENDPOINT** with the agent key:
  ```bash
  # Get the agent key from admin panel (B03): POST /system/voice-ai/config/regenerate-key
  AGENT_KEY="your-agent-key-from-admin"

  # Pre-flight check
  curl "http://localhost:8000/api/v1/internal/voice-ai/tenant/TENANT_ID/access" \
    -H "X-Voice-Agent-Key: $AGENT_KEY" | jq .

  # Full context
  curl "http://localhost:8000/api/v1/internal/voice-ai/tenant/TENANT_ID/context" \
    -H "X-Voice-Agent-Key: $AGENT_KEY" | jq .

  # Start a call
  curl -X POST "http://localhost:8000/api/v1/internal/voice-ai/calls/start" \
    -H "X-Voice-Agent-Key: $AGENT_KEY" \
    -H "Content-Type: application/json" \
    -d '{"tenant_id":"TENANT_ID","call_sid":"test-sid","from_number":"+15551234567","to_number":"+15559999999"}' | jq .

  # Complete a call
  curl -X POST "http://localhost:8000/api/v1/internal/voice-ai/calls/test-sid/complete" \
    -H "X-Voice-Agent-Key: $AGENT_KEY" \
    -H "Content-Type: application/json" \
    -d '{"call_sid":"test-sid","duration_seconds":120,"outcome":"completed","usage_records":[{"provider_id":"PROVIDER_ID","provider_type":"STT","usage_quantity":120,"usage_unit":"seconds"}]}' | jq .

  # Create lead tool
  curl -X POST "http://localhost:8000/api/v1/internal/voice-ai/tenant/TENANT_ID/tools/create_lead" \
    -H "X-Voice-Agent-Key: $AGENT_KEY" \
    -H "Content-Type: application/json" \
    -d '{"call_log_id":"LOG_ID","phone_number":"+15551234567","first_name":"John"}' | jq .
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

### Section 5: Internal Agent Endpoints

Auth for ALL internal endpoints: `X-Voice-Agent-Key: {key}` header — NOT JWT.

Document these 5 endpoints:

**API-026: Access Check**
- `GET /api/v1/internal/voice-ai/tenant/:tenantId/access`
- Called before agent accepts the LiveKit job
- Response: `{ has_access: boolean, reason?: string, minutes_remaining?: number, overage_rate?: number | null }`
- Reason values: `not_enabled`, `quota_exceeded`, `tenant_not_found`

**API-022: Context Fetch**
- `GET /api/v1/internal/voice-ai/tenant/:tenantId/context`
- Returns complete `FullVoiceAiContext` — see schema below
- Agent caches this for 60 seconds

**API-024: Start Call**
- `POST /api/v1/internal/voice-ai/calls/start`
- Body: `{ tenant_id, call_sid, from_number, to_number, direction?, stt_provider_id?, llm_provider_id?, tts_provider_id? }`
- Response: `{ call_log_id: string }`
- Called BEFORE audio processing begins

**API-030: Complete Call**
- `POST /api/v1/internal/voice-ai/calls/:callSid/complete`
- `call_sid` is a URL path parameter
- Body: `{ call_sid, duration_seconds, outcome, transcript_summary?, full_transcript?, actions_taken?, lead_id?, is_overage?, usage_records? }`
- `usage_records` array: each entry = `{ provider_id, provider_type (STT|LLM|TTS), usage_quantity, usage_unit, estimated_cost? }`
- Called in `finally` block — ALWAYS executes even on errors
- Response: `{ success: true }`

**API-027: Tool Dispatch**
- `POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/:tool`
- `tool` values: `create_lead`, `book_appointment`, `transfer_call`
- Body varies by tool (documented per-tool below)

#### Tool Payloads

**create_lead**:
```json
{
  "call_log_id": "uuid",
  "phone_number": "+15551234567",
  "first_name": "John",         // optional
  "last_name": "Doe",           // optional
  "notes": "Needs urgent fix",  // optional
  "service_type": "Plumbing"    // optional
}
```
Response: `{ "lead_id": "uuid", "created": true }`
409 case: returns `{ "lead_id": "existing-uuid", "created": false }` — NOT an error

**book_appointment**:
```json
{
  "call_log_id": "uuid",
  "lead_id": "uuid",              // optional
  "service_type": "Plumbing",    // optional
  "preferred_date": "2026-03-01", // optional, ISO date
  "notes": "Morning preferred"    // optional
}
```
Response: `{ "appointment_id": "uuid", "status": "pending" }`

**transfer_call**:
```json
{
  "call_log_id": "uuid",
  "transfer_number_id": "uuid",  // optional — omit to use default
  "lead_id": "uuid"              // optional
}
```
Response: `{ "success": true, "phone_number": "+15559876543" }`
If no transfer number configured: `{ "success": false, "phone_number": "" }`

---

### Section 6: FullVoiceAiContext Schema

Document the complete JSON shape returned by `GET /tenant/:tenantId/context`:

```
tenant:
  id: string
  company_name: string
  phone: string | null
  timezone: string
  language: string | null

quota:
  minutes_included: number
  minutes_used: number
  minutes_remaining: number
  overage_rate: number | null  (null = no overage allowed)
  quota_exceeded: boolean

behavior:
  is_enabled: boolean
  language: string              (BCP-47 language code, e.g. "en", "es")
  greeting: string              ({business_name} already replaced)
  custom_instructions: string | null
  booking_enabled: boolean
  lead_creation_enabled: boolean
  transfer_enabled: boolean
  max_call_duration_seconds: number

providers:
  stt: null | {
    provider_id: string         (UUID — used in usage_records)
    provider_key: string        (e.g. "deepgram")
    api_key: string             (decrypted — TREAT AS SECRET)
    config: object              (e.g. { "model": "nova-2", "punctuate": true })
  }
  llm: null | {
    provider_id: string
    provider_key: string        (e.g. "openai")
    api_key: string             (decrypted — TREAT AS SECRET)
    config: object              (e.g. { "model": "gpt-4o-mini", "temperature": 0.7 })
  }
  tts: null | {
    provider_id: string
    provider_key: string        (e.g. "cartesia")
    api_key: string             (decrypted — TREAT AS SECRET)
    config: object              (e.g. { "model": "sonic-english", "speed": 1.0 })
    voice_id: string | null
  }

services: Array<{ name: string, description: string | null }>
service_areas: Array<{ type: string, value: string, state: string | null }>
transfer_numbers: Array<{
  label: string
  phone_number: string
  transfer_type: string         (primary | overflow | after_hours | emergency)
  is_default: boolean
  available_hours: string | null  (JSON: {"mon":[["09:00","17:00"]],...} or null)
}>
```

---

### Section 7: Error Reference

Document the standard error format and all status codes.

---

## Acceptance Criteria

- [ ] All 5 internal endpoints documented with full request/response schemas
- [ ] `FullVoiceAiContext` schema documented with ALL fields (tenant, quota, behavior, providers, services, service_areas, transfer_numbers)
- [ ] `provider_id` in each provider config documented — its purpose for `usage_records` billing explained
- [ ] All 3 tool payloads documented with optional/required fields
- [ ] 409 handling for `create_lead` documented (lead exists — NOT an error, return `created: false`)
- [ ] `transfer_call` fallback documented (`success: false` when no number configured)
- [ ] Error reference table included
- [ ] File finalized at `/api/documentation/voice_ai_REST_API.md`
