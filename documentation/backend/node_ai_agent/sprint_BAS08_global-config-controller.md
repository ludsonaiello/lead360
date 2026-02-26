# Sprint BAS08 — Global Config Controller (Admin Endpoints)

**Module**: Voice AI
**Sprint**: BAS08
**Depends on**: BAS07 (VoiceAiGlobalConfigService complete)
**Estimated size**: 1 file, ~80 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `voice-ai-global-config.controller.ts` completely
- Read `api/src/modules/admin/guards/platform-admin.guard.ts` for the guard class name
- NEVER expose LiveKit secrets in API responses — only the service's safe response DTO
- After completing this sprint, enter LiveKit credentials from BAS00 into the database
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Verify (and complete if needed) the admin `VoiceAiGlobalConfigController` at `/api/v1/system/voice-ai/config`. Two endpoints: GET current config, PATCH to update. After implementation, use the PATCH endpoint to enter the LiveKit credentials noted in BAS00.

---

## Pre-Coding Checklist

- [ ] BAS07 complete (VoiceAiGlobalConfigService verified)
- [ ] Have LiveKit credentials from BAS00 Task 2 ready to enter
- [ ] Read `api/src/modules/voice-ai/controllers/admin/voice-ai-global-config.controller.ts`
- [ ] Read `api/src/modules/admin/guards/platform-admin.guard.ts`

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Admin login | `ludsonaiello@gmail.com` / `978@F32c` |
| LiveKit URL | From BAS00 Task 2 notes (was in `/var/www/lead360.app/agent/voice-ai/.env`) |
| LiveKit API Key | From BAS00 Task 2 notes |
| LiveKit API Secret | From BAS00 Task 2 notes |
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` |

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/src/modules/voice-ai/controllers/admin/voice-ai-global-config.controller.ts` | Existing controller |
| `api/src/modules/admin/guards/platform-admin.guard.ts` | Guard class name |
| `api/src/modules/voice-ai/services/voice-ai-global-config.service.ts` | Service methods |

---

## Task 1: Verify Controller Endpoints

```typescript
@Controller('system/voice-ai/config')
@UseGuards(PlatformAdminGuard)
export class VoiceAiGlobalConfigController {

  // GET /api/v1/system/voice-ai/config
  // Returns current global config with provider details (no raw secrets)
  @Get() getConfig()

  // PATCH /api/v1/system/voice-ai/config
  // Partial update — only provided fields are updated
  @Patch() updateConfig(@Body() dto: UpdateGlobalConfigDto, @Req() req)
}
```

---

## Task 2: Enter LiveKit Credentials (Post-Implementation Step)

After the controller is working, use it to store the LiveKit credentials from BAS00:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

# Get provider IDs
curl -s http://localhost:3000/api/v1/system/voice-ai/providers \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | {id, provider_key}'

# Store LiveKit config and set default providers
# Replace values below with actual credentials from BAS00 notes and actual provider IDs
curl -X PATCH http://localhost:3000/api/v1/system/voice-ai/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_enabled": false,
    "livekit_url": "<LIVEKIT_URL from BAS00>",
    "livekit_api_key": "<LIVEKIT_API_KEY from BAS00>",
    "livekit_api_secret": "<LIVEKIT_API_SECRET from BAS00>",
    "default_stt_provider_id": "<deepgram UUID>",
    "default_llm_provider_id": "<openai UUID>",
    "default_tts_provider_id": "<cartesia UUID>",
    "default_language": "en",
    "default_max_call_seconds": 300,
    "max_concurrent_calls": 10
  }'
```

**Note**: `agent_enabled` is set to `false` until BAS19 agent worker is complete.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/voice-ai/controllers/admin/voice-ai-global-config.controller.ts` | VERIFY/MODIFY | GET and PATCH endpoints |

---

## Acceptance Criteria

- [ ] `GET /api/v1/system/voice-ai/config` returns config with provider details (200)
- [ ] `PATCH /api/v1/system/voice-ai/config` updates only provided fields (200)
- [ ] Response never includes `livekit_api_key_encrypted` or `livekit_api_secret_encrypted`
- [ ] LiveKit credentials entered into database for BAS19
- [ ] Both endpoints return 403 for non-admin users
- [ ] `npm run build` passes with 0 errors

---

## Testing

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

# Get current config
curl http://localhost:3000/api/v1/system/voice-ai/config \
  -H "Authorization: Bearer $TOKEN"

# Update to enable agent (after BAS19)
curl -X PATCH http://localhost:3000/api/v1/system/voice-ai/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent_enabled": true}'
```
