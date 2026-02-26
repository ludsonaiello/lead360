# Sprint BAS09 — Tenant Settings Service

**Module**: Voice AI
**Sprint**: BAS09
**Depends on**: BAS08 (global config complete with providers set)
**Estimated size**: 1–2 files, ~150 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `voice-ai-settings.service.ts` completely
- Read `api/prisma/schema.prisma` — `tenant_voice_ai_settings` model — every field
- Read the `tenant` model to understand FK constraint
- NEVER allow a tenant to enable Voice AI if their subscription plan doesn't support it
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Verify (and complete if needed) `VoiceAiSettingsService` — per-tenant voice AI configuration. One settings row per tenant (UNIQUE tenant_id). Handles upsert, enable/disable, and custom greeting/instructions. Must enforce plan-level permissions.

---

## Pre-Coding Checklist

- [ ] BAS08 complete (global config has providers set)
- [ ] Read `api/src/modules/voice-ai/services/voice-ai-settings.service.ts` completely
- [ ] Read `api/prisma/schema.prisma` — `tenant_voice_ai_settings` model
- [ ] Read `api/prisma/schema.prisma` — `subscription_plan` model (voice_ai_enabled column)
- [ ] Understand how tenant subscription is accessed: check `api/src/modules/tenant/` for TenantService patterns

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Admin login | `ludsonaiello@gmail.com` / `978@F32c` |
| Tenant login | `contato@honeydo4you.com` / `978@F32c` |
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` |
| DB credentials | Parse from `DATABASE_URL` in `/var/www/lead360.app/api/.env` — format: `mysql://user:password@host:port/database` |

**NEVER hardcode credentials. Always read from .env.**

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/src/modules/voice-ai/services/voice-ai-settings.service.ts` | Existing service |
| `api/prisma/schema.prisma` | `tenant_voice_ai_settings` model fields |
| `api/prisma/schema.prisma` | `subscription_plan` model — `voice_ai_enabled` column |
| `api/prisma/schema.prisma` | `tenant` model — how tenant links to subscription_plan |

---

## Task 1: Verify Service Methods

```typescript
@Injectable()
export class VoiceAiSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // Get settings for a tenant — creates default row if first access
  // Returns settings with plan entitlement info
  async getSettings(tenantId: string): Promise<TenantVoiceAiSettingsDto>

  // Upsert settings for a tenant (create or update)
  // Validates plan allows Voice AI before enabling
  async upsertSettings(tenantId: string, dto: UpsertTenantVoiceSettingsDto): Promise<TenantVoiceAiSettingsDto>

  // Admin override: update settings on behalf of tenant
  // No plan restriction check (admin can override)
  async adminOverride(tenantId: string, dto: AdminOverrideVoiceSettingsDto, adminUserId: string): Promise<TenantVoiceAiSettingsDto>

  // Check if tenant can use Voice AI right now
  // Returns { allowed: boolean, reason: string }
  async checkEntitlement(tenantId: string): Promise<{ allowed: boolean; reason?: string }>
}
```

**Key rules**:
- `upsertSettings()` — if `is_enabled: true`, check `subscription_plan.voice_ai_enabled` first
  - If plan doesn't include voice AI: throw `ForbiddenException('Plan does not include Voice AI')`
- `getSettings()` — if no row exists yet, return default values (not throw error)
- `checkEntitlement()` is called by the SIP service (BAS17) before routing calls

---

## Task 2: Verify DTOs

**UpsertTenantVoiceSettingsDto**:
```typescript
export class UpsertTenantVoiceSettingsDto {
  @IsOptional() @IsBoolean() is_enabled?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) enabled_languages?: string[];
  @IsOptional() @IsString() @MaxLength(1000) custom_greeting?: string;
  @IsOptional() @IsString() @MaxLength(10000) custom_instructions?: string;
  @IsOptional() @IsBoolean() booking_enabled?: boolean;
  @IsOptional() @IsBoolean() lead_creation_enabled?: boolean;
  @IsOptional() @IsBoolean() transfer_enabled?: boolean;
  @IsOptional() @IsUUID() default_transfer_number_id?: string;
  @IsOptional() @IsInt() @Min(60) @Max(3600) max_call_duration_seconds?: number;
}
```

---

## Task 3: Verify Build

```bash
cd /var/www/lead360.app/api
npm run build
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/voice-ai/services/voice-ai-settings.service.ts` | VERIFY/MODIFY | All methods complete |
| `api/src/modules/voice-ai/dto/upsert-tenant-voice-settings.dto.ts` | VERIFY/CREATE | Tenant settings DTO |

---

## Acceptance Criteria

- [ ] `getSettings()` creates default row on first call (no 404)
- [ ] `upsertSettings()` throws 403 if tenant's plan doesn't include Voice AI
- [ ] `checkEntitlement()` returns `{ allowed: false, reason: 'plan_not_included' }` correctly
- [ ] `enabled_languages` stored as JSON string in DB
- [ ] `npm run build` passes with 0 errors
