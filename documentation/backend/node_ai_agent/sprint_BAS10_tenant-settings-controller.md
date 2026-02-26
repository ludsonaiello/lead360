# Sprint BAS10 — Tenant Settings Controller

**Module**: Voice AI
**Sprint**: BAS10
**Depends on**: BAS09 (VoiceAiSettingsService complete)
**Estimated size**: 1 file, ~80 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `voice-ai-settings.controller.ts` completely
- Read how other tenant controllers extract `tenant_id` from JWT (`req.user.tenant_id`)
- NEVER accept `tenant_id` from the request body — always from JWT
- Verify the route prefix follows the pattern `/api/v1/voice-ai` (no `system/`)
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Verify (and complete if needed) `VoiceAiSettingsController` (tenant-facing) at `/api/v1/voice-ai/settings`. Tenant users manage their own Voice AI settings. `tenant_id` always comes from JWT, never from request body.

---

## Pre-Coding Checklist

- [ ] BAS09 complete (VoiceAiSettingsService verified)
- [ ] Read `api/src/modules/voice-ai/controllers/tenant/voice-ai-settings.controller.ts`
- [ ] Read `api/src/modules/auth/guards/roles.guard.ts` — how `@Roles()` works
- [ ] Check how other tenant controllers (e.g., in leads module) extract `req.user.tenant_id`

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Admin login | `ludsonaiello@gmail.com` / `978@F32c` |
| Tenant login | `contato@honeydo4you.com` / `978@F32c` |
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` |

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/src/modules/voice-ai/controllers/tenant/voice-ai-settings.controller.ts` | Existing controller |
| `api/src/modules/auth/guards/roles.guard.ts` | How @Roles works |
| `api/src/modules/leads/controllers/leads.controller.ts` | Pattern for tenant_id from JWT |

---

## Task 1: Verify Controller Endpoints

```typescript
@Controller('voice-ai/settings')    // → /api/v1/voice-ai/settings
@UseGuards(RolesGuard)
export class VoiceAiSettingsController {

  // GET /api/v1/voice-ai/settings
  // Returns current tenant's settings (creates default if first time)
  @Get()
  @Roles('Owner', 'Admin', 'Manager')
  getSettings(@Req() req)

  // PUT /api/v1/voice-ai/settings
  // Upsert tenant settings
  @Put()
  @Roles('Owner', 'Admin')
  upsertSettings(@Body() dto: UpsertTenantVoiceSettingsDto, @Req() req)
}
```

**Critical**: `tenant_id` = `req.user.tenant_id` — never from body or params.

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/voice-ai/controllers/tenant/voice-ai-settings.controller.ts` | VERIFY/MODIFY | GET and PUT endpoints |

---

## Acceptance Criteria

- [ ] `GET /api/v1/voice-ai/settings` returns settings for authenticated tenant (200)
- [ ] `PUT /api/v1/voice-ai/settings` upserts settings (200)
- [ ] 403 returned if tenant's plan doesn't include Voice AI and they try to enable it
- [ ] `tenant_id` always from JWT, never from request body
- [ ] `npm run build` passes with 0 errors

---

## Testing

```bash
TENANT_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contato@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# Get current settings
curl http://localhost:3000/api/v1/voice-ai/settings \
  -H "Authorization: Bearer $TENANT_TOKEN"

# Update settings
curl -X PUT http://localhost:3000/api/v1/voice-ai/settings \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"custom_greeting":"Thank you for calling! How can I help you today?","enabled_languages":["en","es"]}'
```
