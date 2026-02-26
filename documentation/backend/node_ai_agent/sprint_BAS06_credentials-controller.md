# Sprint BAS06 — Credentials Controller (Admin Endpoints)

**Module**: Voice AI
**Sprint**: BAS06
**Depends on**: BAS05 (VoiceAiCredentialsService complete)
**Estimated size**: 1 file, ~100 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `voice-ai-credentials.controller.ts` completely
- Read `api/src/modules/admin/guards/platform-admin.guard.ts` — guard class name
- NEVER expose encrypted keys in any response
- Verify every endpoint with a curl test
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Verify (and complete if needed) the admin `VoiceAiCredentialsController` at `/api/v1/system/voice-ai/credentials`. Provides endpoints to manage (store, view masked, test, delete) AI provider API keys.

---

## Pre-Coding Checklist

- [ ] BAS05 complete (credentials service verified)
- [ ] Read `api/src/modules/voice-ai/controllers/admin/voice-ai-credentials.controller.ts`
- [ ] Read `api/src/modules/admin/guards/platform-admin.guard.ts`
- [ ] Confirm admin login works: `curl -X POST http://localhost:3000/api/v1/auth/login -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}'`

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Admin login | `ludsonaiello@gmail.com` / `978@F32c` |
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` |
| DB credentials | Parse from `DATABASE_URL` in `/var/www/lead360.app/api/.env` — format: `mysql://user:password@host:port/database` |

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/src/modules/voice-ai/controllers/admin/voice-ai-credentials.controller.ts` | Existing controller |
| `api/src/modules/admin/guards/platform-admin.guard.ts` | Guard class name — do not guess |
| `api/src/modules/voice-ai/services/voice-ai-credentials.service.ts` | Service methods |

---

## Task 1: Verify Controller Endpoints

```typescript
@Controller('system/voice-ai/credentials')
@UseGuards(PlatformAdminGuard)
export class VoiceAiCredentialsController {

  // GET /api/v1/system/voice-ai/credentials
  // Returns list of all providers with masked keys (or null if not set)
  @Get() findAll()

  // PUT /api/v1/system/voice-ai/credentials/:providerId
  // Upsert: store/replace API key for provider
  // Body: { api_key: string, additional_config?: string }
  @Put(':providerId') upsert(@Param('providerId') id: string, @Body() dto: UpsertCredentialDto, @Req() req)

  // DELETE /api/v1/system/voice-ai/credentials/:providerId
  @Delete(':providerId') delete(@Param('providerId') id: string)

  // POST /api/v1/system/voice-ai/credentials/:providerId/test
  // Test the stored API key — returns { success: boolean, message: string }
  @Post(':providerId/test') test(@Param('providerId') id: string)
}
```

---

## Task 2: Verify Build & Test

```bash
cd /var/www/lead360.app/api
npm run build

npm run start:dev
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/voice-ai/controllers/admin/voice-ai-credentials.controller.ts` | VERIFY/MODIFY | All 4 endpoints |

---

## Acceptance Criteria

- [ ] `GET /api/v1/system/voice-ai/credentials` returns masked keys only (200)
- [ ] `PUT /api/v1/system/voice-ai/credentials/:providerId` stores encrypted key (200)
- [ ] `DELETE /api/v1/system/voice-ai/credentials/:providerId` removes credential (200)
- [ ] `POST /api/v1/system/voice-ai/credentials/:providerId/test` returns `{success, message}` (200)
- [ ] Response NEVER contains `encrypted_api_key` field
- [ ] All return 403 for non-admin users
- [ ] `npm run build` passes with 0 errors

---

## Testing

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

# Get provider ID for deepgram
DEEPGRAM_ID=$(curl -s http://localhost:3000/api/v1/system/voice-ai/providers \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[] | select(.provider_key=="deepgram") | .id')

# Store Deepgram API key (use real key from .env or test key)
curl -X PUT "http://localhost:3000/api/v1/system/voice-ai/credentials/$DEEPGRAM_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"api_key":"dg_test_key_example"}'

# Verify masked key is returned, NOT plain key
curl "http://localhost:3000/api/v1/system/voice-ai/credentials" \
  -H "Authorization: Bearer $TOKEN"
# Response should show masked_api_key: "dg_t...mple"
# Response should NOT have encrypted_api_key field

# Test the connection
curl -X POST "http://localhost:3000/api/v1/system/voice-ai/credentials/$DEEPGRAM_ID/test" \
  -H "Authorization: Bearer $TOKEN"
```
