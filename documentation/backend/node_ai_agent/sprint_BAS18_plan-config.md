# Sprint BAS18 — Plan Configuration (Admin Endpoints)

**Module**: Voice AI
**Sprint**: BAS18
**Depends on**: BAS17 (IVR extension complete)
**Estimated size**: 1–2 files, ~100 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `voice-ai-plan-config.controller.ts` completely
- Read `voice-ai-plan-config.service.ts` completely
- Read `api/prisma/schema.prisma` — `subscription_plan` model — verify `voice_ai_*` columns exist
- These columns were added in BAS01 — if missing from schema, go back to BAS01
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Verify (and complete if needed) the plan configuration admin endpoints. Allows platform admins to configure how much Voice AI each subscription plan includes (minutes, overage rate, enabled/disabled).

---

## Pre-Coding Checklist

- [ ] BAS17 complete (IVR extension verified)
- [ ] Read `api/src/modules/voice-ai/services/voice-ai-plan-config.service.ts` completely
- [ ] Read `api/src/modules/voice-ai/controllers/admin/voice-ai-plan-config.controller.ts`
- [ ] Read `api/prisma/schema.prisma` — `subscription_plan` model — verify `voice_ai_enabled`, `voice_ai_minutes_included`, `voice_ai_overage_rate` columns exist
- [ ] Read `api/src/modules/admin/guards/platform-admin.guard.ts`

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Admin login | `ludsonaiello@gmail.com` / `978@F32c` |
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` |
| DB credentials | Parse from `DATABASE_URL` in `/var/www/lead360.app/api/.env` — format: `mysql://user:password@host:port/database` |

**NEVER hardcode credentials. Always read from .env.**

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/src/modules/voice-ai/services/voice-ai-plan-config.service.ts` | Existing service |
| `api/src/modules/voice-ai/controllers/admin/voice-ai-plan-config.controller.ts` | Existing controller |
| `api/prisma/schema.prisma` | `subscription_plan` — voice_ai columns |
| `api/src/modules/admin/guards/platform-admin.guard.ts` | Guard class name |

---

## Task 1: Verify Service Methods

```typescript
@Injectable()
export class VoiceAiPlanConfigService {
  constructor(private readonly prisma: PrismaService) {}

  // List all plans with their voice AI settings
  async listPlans(): Promise<PlanWithVoiceSettingsDto[]>

  // Update voice AI settings for a specific plan
  async updatePlanVoiceSettings(planId: string, dto: UpdatePlanVoiceSettingsDto): Promise<PlanWithVoiceSettingsDto>
}
```

**PlanWithVoiceSettingsDto** should include:
- Plan id, name, monthly_price, is_active
- voice_ai_enabled, voice_ai_minutes_included, voice_ai_overage_rate

---

## Task 2: Verify Controller Endpoints

```typescript
@Controller('system/voice-ai/plans')
@UseGuards(PlatformAdminGuard)
export class VoiceAiPlanConfigController {

  // GET /api/v1/system/voice-ai/plans
  // List all plans with voice AI configuration
  @Get() listPlans()

  // PATCH /api/v1/system/voice-ai/plans/:planId/voice
  // Update voice AI settings for a plan
  @Patch(':planId/voice') updatePlanVoice(@Param('planId') planId: string, @Body() dto: UpdatePlanVoiceSettingsDto)
}
```

---

## Task 3: UpdatePlanVoiceSettingsDto

```typescript
export class UpdatePlanVoiceSettingsDto {
  @IsOptional() @IsBoolean() voice_ai_enabled?: boolean;
  @IsOptional() @IsInt() @Min(0) voice_ai_minutes_included?: number;
  @IsOptional() @IsNumber() @Min(0) voice_ai_overage_rate?: number | null;
  // null = block calls when over limit (no overage billing)
}
```

---

## Task 4: Enable Voice AI on Test Tenant's Plan

After implementation, enable Voice AI on the tenant's subscription plan so BAS09 tests work:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

# List plans to find test tenant's plan ID
curl http://localhost:3000/api/v1/system/voice-ai/plans \
  -H "Authorization: Bearer $TOKEN"

# Enable Voice AI on the plan (use the plan ID from above)
curl -X PATCH "http://localhost:3000/api/v1/system/voice-ai/plans/<PLAN_ID>/voice" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"voice_ai_enabled": true, "voice_ai_minutes_included": 60, "voice_ai_overage_rate": null}'
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/voice-ai/services/voice-ai-plan-config.service.ts` | VERIFY/MODIFY | listPlans, updatePlanVoiceSettings |
| `api/src/modules/voice-ai/controllers/admin/voice-ai-plan-config.controller.ts` | VERIFY/MODIFY | GET and PATCH endpoints |
| `api/src/modules/voice-ai/dto/update-plan-voice-settings.dto.ts` | VERIFY/CREATE | Plan voice DTO |

---

## Acceptance Criteria

- [ ] `GET /api/v1/system/voice-ai/plans` returns all plans with voice AI settings (200)
- [ ] `PATCH /api/v1/system/voice-ai/plans/:planId/voice` updates voice settings (200)
- [ ] Both endpoints return 403 for non-admin users
- [ ] Test tenant's plan has Voice AI enabled (60 minutes included)
- [ ] `npm run build` passes with 0 errors
