# Sprint BAS04 — Provider Controller (Admin Endpoints)

**Module**: Voice AI
**Sprint**: BAS04
**Depends on**: BAS03 (VoiceAiProvidersService complete)
**Estimated size**: 1 file, ~100 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read the existing `voice-ai-providers.controller.ts` completely
- Read `api/src/modules/admin/guards/platform-admin.guard.ts` — understand how it works
- Check how other admin controllers are structured (read `api/src/modules/admin/controllers/system-settings.controller.ts`)
- NEVER guess decorator names or guard classes — read the source files
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Verify (and complete if needed) the admin `VoiceAiProvidersController`. This controller exposes CRUD endpoints for the `voice_ai_provider` table under `/api/v1/system/voice-ai/providers`. All endpoints require platform admin authentication.

---

## Pre-Coding Checklist

- [ ] BAS03 complete (VoiceAiProvidersService verified)
- [ ] Read `api/src/modules/voice-ai/controllers/admin/voice-ai-providers.controller.ts`
- [ ] Read `api/src/modules/admin/guards/platform-admin.guard.ts` — class name and how it's used
- [ ] Read ONE existing admin controller to understand route prefix and guard pattern
- [ ] Read `api/src/modules/auth/guards/jwt-auth.guard.ts` — global guard, always applied

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

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/src/modules/voice-ai/controllers/admin/voice-ai-providers.controller.ts` | Existing controller — what's there |
| `api/src/modules/admin/guards/platform-admin.guard.ts` | Guard class name — don't assume |
| `api/src/modules/admin/controllers/system-settings.controller.ts` | Admin controller pattern reference |
| `api/src/modules/voice-ai/services/voice-ai-providers.service.ts` | Service methods available |

---

## Task 1: Verify Controller Endpoints

`VoiceAiProvidersController` must have:

```typescript
@Controller('system/voice-ai/providers')   // → /api/v1/system/voice-ai/providers
@UseGuards(PlatformAdminGuard)             // READ the guard file for correct class name
@ApiBearerAuth()
@ApiTags('Admin - Voice AI Providers')
export class VoiceAiProvidersController {

  // GET /api/v1/system/voice-ai/providers
  // Query params: ?provider_type=STT&is_active=true
  @Get() findAll(@Query() filters: FilterVoiceAiProvidersDto)

  // GET /api/v1/system/voice-ai/providers/:id
  @Get(':id') findOne(@Param('id') id: string)

  // POST /api/v1/system/voice-ai/providers
  @Post() create(@Body() dto: CreateVoiceAiProviderDto, @Req() req)

  // PATCH /api/v1/system/voice-ai/providers/:id
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateVoiceAiProviderDto)

  // DELETE /api/v1/system/voice-ai/providers/:id  (soft delete)
  @Delete(':id') deactivate(@Param('id') id: string)
}
```

**Critical**:
- Route prefix is `system/voice-ai/providers` — the API global prefix `/api/v1` is added by the NestJS app
- Use `PlatformAdminGuard` — read the exact class name from the guard file, do NOT assume
- JWT is already applied globally — do NOT add JwtAuthGuard again on this controller
- `DELETE` is a soft delete (calls `deactivate()`) — document this in Swagger `@ApiOperation`

---

## Task 2: Add FilterDto if Missing

Check if `FilterVoiceAiProvidersDto` exists. If not, create it:

```typescript
export class FilterVoiceAiProvidersDto {
  @IsOptional() @IsEnum(['STT', 'LLM', 'TTS']) provider_type?: string;
  @IsOptional() @IsBoolean() @Transform(({ value }) => value === 'true') is_active?: boolean;
}
```

---

## Task 3: Add Swagger Decorators

Every endpoint must have:
- `@ApiOperation({ summary: '...' })`
- `@ApiResponse({ status: 200, ... })` for success
- `@ApiResponse({ status: 404 })` for endpoints that can return not found
- `@ApiResponse({ status: 403 })` — platform admin only

---

## Task 4: Verify Build

```bash
cd /var/www/lead360.app/api
npm run build
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/voice-ai/controllers/admin/voice-ai-providers.controller.ts` | VERIFY/MODIFY | Complete 5 CRUD endpoints |
| `api/src/modules/voice-ai/dto/filter-voice-ai-providers.dto.ts` | CREATE (if missing) | Query filter DTO |

---

## Acceptance Criteria

- [ ] `GET /api/v1/system/voice-ai/providers` returns list (200)
- [ ] `POST /api/v1/system/voice-ai/providers` creates provider (201)
- [ ] `PATCH /api/v1/system/voice-ai/providers/:id` updates provider (200)
- [ ] `DELETE /api/v1/system/voice-ai/providers/:id` soft-deletes (200)
- [ ] All endpoints return 403 for non-admin users
- [ ] `npm run build` passes with 0 errors

---

## Testing

```bash
# Login as admin and get JWT token
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' \
  | jq -r '.access_token')

# Create Deepgram provider
curl -X POST http://localhost:3000/api/v1/system/voice-ai/providers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider_key":"deepgram","provider_type":"STT","display_name":"Deepgram","description":"Real-time STT"}'

# Create OpenAI provider
curl -X POST http://localhost:3000/api/v1/system/voice-ai/providers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider_key":"openai","provider_type":"LLM","display_name":"OpenAI GPT-4o"}'

# Create Cartesia provider
curl -X POST http://localhost:3000/api/v1/system/voice-ai/providers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider_key":"cartesia","provider_type":"TTS","display_name":"Cartesia"}'

# List all providers
curl http://localhost:3000/api/v1/system/voice-ai/providers \
  -H "Authorization: Bearer $TOKEN"

# Verify 403 with tenant user
TENANT_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contato@honeydo4you.com","password":"978@F32c"}' \
  | jq -r '.access_token')

curl http://localhost:3000/api/v1/system/voice-ai/providers \
  -H "Authorization: Bearer $TENANT_TOKEN"
# Expected: 403 Forbidden
```
