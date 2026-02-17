YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B11 — Admin Monitoring Endpoints

**Module**: Voice AI  
**Sprint**: B11  
**Depends on**: B07, B09  
**Estimated scope**: ~2 hours

---

## Objective

Build platform admin endpoints to monitor all tenants' Voice AI usage, view cross-tenant call logs, and override individual tenant settings when needed.

---

## Pre-Coding Checklist

- [ ] B07 is complete — `VoiceCallLogService.findAllAdmin()` exists
- [ ] Read `/api/src/modules/admin/services/` — admin service patterns
- [ ] Read `/api/src/modules/communication/controllers/admin/twilio-admin.controller.ts` — admin controller pattern

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`  
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Task 1: Admin Override DTO

`admin-override-tenant-voice.dto.ts`:

```typescript
export class AdminOverrideTenantVoiceDto {
  @IsOptional() @IsBoolean() force_enabled?: boolean | null;  // null removes override
  @IsOptional() @IsInt() @Min(0) monthly_minutes_override?: number | null;  // null removes override
  @IsOptional() @IsString() stt_provider_override_id?: string | null;
  @IsOptional() @IsString() llm_provider_override_id?: string | null;
  @IsOptional() @IsString() tts_provider_override_id?: string | null;
}
```

---

## Task 2: Admin Monitoring Service

`voice-ai-monitoring.service.ts`:

```typescript
@Injectable()
export class VoiceAiMonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  async getTenantsVoiceAiOverview(params: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ data: TenantVoiceAiOverview[]; meta: PaginationMeta }>
  // JOIN: tenant + subscription_plan (voice_ai_enabled) + tenant_voice_ai_settings + voice_usage_record (current month)
  // Return per tenant: { tenant_id, company_name, plan_name, voice_ai_included_in_plan, is_enabled, minutes_included, minutes_used, has_admin_override }

  async overrideTenantVoiceSettings(tenantId: string, dto: AdminOverrideTenantVoiceDto): Promise<void>
  // Upserts tenant_voice_ai_settings with the infrastructure override fields
  // If dto.force_enabled is not null, also sets is_enabled accordingly (admin force)

  async getAdminCallLogs(filters: {
    tenantId?: string;
    from?: Date;
    to?: Date;
    outcome?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: voice_call_log[]; meta: PaginationMeta }>

  async getUsageReport(year: number, month: number): Promise<AdminUsageReport>
  // Returns: { total_calls, total_minutes, total_overage_minutes, estimated_overage_cost, by_tenant: [...] }
}
```

---

## Task 3: Admin Monitoring Controller

`controllers/admin/voice-ai-monitoring.controller.ts`:

```
GET   /api/v1/system/voice-ai/tenants                    → getTenantsVoiceAiOverview(query)
PATCH /api/v1/system/voice-ai/tenants/:tenantId/override  → overrideTenantVoiceSettings(tenantId, dto)
GET   /api/v1/system/voice-ai/call-logs                   → getAdminCallLogs(query)
GET   /api/v1/system/voice-ai/usage-report                → getUsageReport(year, month)
```

Query params for tenants: `page`, `limit`, `search`.  
Query params for call-logs: `tenantId`, `from`, `to`, `outcome`, `page`, `limit`.  
Query params for usage-report: `year` (default: current year), `month` (default: current month).

All admin-only (`is_platform_admin: true`).

---

## Task 4: Update Module

Add to `voice-ai.module.ts`:
- `VoiceAiMonitoringService`
- `VoiceAiMonitoringController`

---

## Acceptance Criteria

- [ ] `GET /api/v1/system/voice-ai/tenants` returns all tenants with voice AI summary
- [ ] `PATCH /api/v1/system/voice-ai/tenants/:tenantId/override` updates override fields (including admin_notes)
- [ ] `GET /api/v1/system/voice-ai/call-logs` returns paginated cross-tenant call logs with filters
- [ ] `GET /api/v1/system/voice-ai/usage-report` returns aggregate + per-tenant breakdown
- [ ] All endpoints return 403 for non-admin users
- [ ] `npm run build` passes
