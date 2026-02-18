YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B04 — Tenant Settings CRUD + Context Builder Service

**Module**: Voice AI  
**Sprint**: B04  
**Depends on**: B01, B02, B03  
**Estimated scope**: ~3 hours

---

## Objective

Build tenant-facing endpoints so business owners can configure their Voice AI behavior settings. Build the `VoiceAiContextBuilderService` that merges global defaults with tenant overrides — this is the core service the Python agent depends on.

---

## Pre-Coding Checklist

- [ ] B01, B02, B03 are complete
- [ ] Read `/api/src/modules/leads/leads.controller.ts` — tenant endpoint pattern
- [ ] Read `/api/src/modules/communication/services/platform-email-config.service.ts` — fallback/merge pattern
- [ ] Understand `tenant_voice_ai_settings` has behavior fields (tenant editable) and infrastructure override fields (admin-only, set in B11)

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`  
- Tenant: `contato@honeydo4you.com` / `978@F32c`  
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Task 1: DTOs

### `upsert-tenant-voice-settings.dto.ts`

Only behavior fields — tenant CANNOT set infrastructure overrides:

```typescript
export class UpsertTenantVoiceSettingsDto {
  @IsOptional() @IsBoolean() is_enabled?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) enabled_languages?: string[];
  @IsOptional() @IsString() @MaxLength(500) custom_greeting?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) custom_instructions?: string | null;
  @IsOptional() @IsBoolean() booking_enabled?: boolean;
  @IsOptional() @IsBoolean() lead_creation_enabled?: boolean;
  @IsOptional() @IsBoolean() transfer_enabled?: boolean;
  @IsOptional() @IsString() @Matches(/^\+[1-9]\d{1,14}$/) default_transfer_number?: string | null;
  @IsOptional() @IsInt() @Min(60) @Max(3600) max_call_duration_seconds?: number | null;
}
```

---

## Task 2: Tenant Settings Service

`voice-ai-settings.service.ts`:

```typescript
@Injectable()
export class VoiceAiSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTenantSettings(tenantId: string): Promise<tenant_voice_ai_settings | null>

  async upsertTenantSettings(tenantId: string, dto: UpsertTenantVoiceSettingsDto): Promise<tenant_voice_ai_settings>
  // Uses prisma.tenant_voice_ai_settings.upsert({ where: { tenant_id: tenantId }, ... })
  // GUARD: if dto.is_enabled === true, verify tenant's subscription plan has voice_ai_enabled = true
  // Throw ForbiddenException if plan does not include voice AI

  async isVoiceAiIncludedInPlan(tenantId: string): Promise<boolean>
  // Joins tenant → subscription_plan → voice_ai_enabled
}
```

---

## Task 3: Context Builder Service

`voice-ai-context-builder.service.ts` — the most important service in this module:

```typescript
@Injectable()
export class VoiceAiContextBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialsService: VoiceAiCredentialsService,
    private readonly globalConfigService: VoiceAiGlobalConfigService,
    private readonly encryption: EncryptionService,
    // NOTE: Do NOT inject VoiceUsageService in B04 — it does not exist yet (created in B07).
    // Implement quota calculation inline here using prisma.voice_usage_record.aggregate().
    // B07 will refactor this to delegate to VoiceUsageService after that service exists.
  ) {}

  async buildContext(tenantId: string): Promise<FullVoiceAiContext>
}
```

**`buildContext` logic** (step by step):

1. Load `tenant` with `subscription_plan` (check voice_ai_enabled)
2. Load `tenant_voice_ai_settings` (may be null — use defaults if so)
3. Load `voice_ai_global_config`
4. Inline quota calculation (no VoiceUsageService yet — B07 will refactor this):
   - Aggregate STT `usage_quantity` from `voice_usage_record` for current `year`/`month` and this `tenant_id`
   - `const sttSeconds = Number(sttAgg._sum.usage_quantity ?? 0)` // Prisma returns Decimal — convert before Math.ceil
   - `minutes_used = Math.ceil(sttSeconds / 60)`
   - `minutes_remaining = Math.max(0, minutes_included - minutes_used)`
   - `overage_rate = plan.voice_ai_overage_rate ?? null`
   - `quota_exceeded = minutes_used >= minutes_included && overage_rate === null` // only blocks when no overage pricing configured
5. Resolve active providers: tenant override IDs → if null, fall back to global config IDs
6. Load `voice_ai_credentials` for each resolved provider, DECRYPT the api_key
7. Load `tenant_service` + `service` records for this tenant (services list)
8. Load `tenant_service_area` records for this tenant
9. Load `tenant_voice_transfer_number` records
10. Build and return the `FullVoiceAiContext` object

**FullVoiceAiContext interface**:

```typescript
export interface FullVoiceAiContext {
  tenant: {
    id: string;
    company_name: string;
    phone: string | null;
    timezone: string;
    language: string | null;
  };
  quota: {
    minutes_included: number;
    minutes_used: number;
    minutes_remaining: number;
    overage_rate: number | null;
    quota_exceeded: boolean;
  };
  behavior: {
    is_enabled: boolean;
    language: string;
    greeting: string;
    custom_instructions: string | null;
    booking_enabled: boolean;
    lead_creation_enabled: boolean;
    transfer_enabled: boolean;
    max_call_duration_seconds: number;
  };
  providers: {
    // provider_id: UUID of voice_ai_provider row — used by Python agent for usage tracking (A09)
    // config: provider-specific settings from global/tenant config (model, temperature, etc.)
    stt: { provider_id: string; provider_key: string; api_key: string; config: Record<string, unknown> } | null;
    llm: { provider_id: string; provider_key: string; api_key: string; config: Record<string, unknown> } | null;
    tts: { provider_id: string; provider_key: string; api_key: string; config: Record<string, unknown>; voice_id: string | null } | null;
  };
  services: Array<{ name: string; description: string | null }>;
  service_areas: Array<{ type: string; value: string; state: string | null }>;
  transfer_numbers: Array<{ label: string; phone_number: string; transfer_type: string; is_default: boolean; available_hours: string | null }>;
}
```

**Greeting resolution**: `context.behavior.greeting` = tenant's `custom_greeting` OR global `default_greeting_template` with `{business_name}` replaced by `tenant.company_name`.

**Minutes calculation** (inline — VoiceUsageService from B07 doesn't exist yet):
- Aggregate STT seconds: `const sttAgg = await prisma.voice_usage_record.aggregate({ where: { tenant_id: tenantId, year, month, provider_type: 'STT' }, _sum: { usage_quantity: true } })`
- `const sttSeconds = Number(sttAgg._sum.usage_quantity ?? 0);`  // Prisma returns Decimal — must convert to number before Math.ceil
- `minutes_used = Math.ceil(sttSeconds / 60)`
- `minutes_remaining = Math.max(0, minutes_included - minutes_used)`
- `overage_rate = plan.voice_ai_overage_rate ?? null`
- `quota_exceeded = minutes_used >= minutes_included && overage_rate === null`  // only blocks when no overage configured — tenants with overage_rate can call beyond quota at cost
- NOTE: B07 creates `VoiceUsageService.getQuota()` which will be used by B09. B04 implements this inline because B07 doesn't exist yet.

---

## Task 4: Tenant Controller

`controllers/tenant/voice-ai-settings.controller.ts`:

```
GET /api/v1/voice-ai/settings     → getTenantSettings(req.user.tenant_id)
PUT /api/v1/voice-ai/settings     → upsertTenantSettings(req.user.tenant_id, dto)
```

Uses `JwtAuthGuard` only (no specific role required — any tenant user can configure).
Returns 403 if tenant's plan does not include voice AI and `is_enabled: true` is being set.

---

## Task 5: Update Module

Add to `voice-ai.module.ts`:
- `VoiceAiSettingsService`
- `VoiceAiContextBuilderService`
- `VoiceAiSettingsController`
- Export `VoiceAiContextBuilderService` (needed by B06 internal controller)

---

## Acceptance Criteria

- [ ] `GET /api/v1/voice-ai/settings` returns tenant's current settings (or null if not configured)
- [ ] `PUT /api/v1/voice-ai/settings` upserts tenant settings (behavior fields only)
- [ ] Setting `is_enabled: true` throws 403 if plan does not include voice AI
- [ ] `VoiceAiContextBuilderService.buildContext()` returns complete context with decrypted provider keys
- [ ] Greeting template `{business_name}` is replaced with actual company name
- [ ] Fallback: if tenant has no settings, global defaults are used
- [ ] `npm run build` passes
