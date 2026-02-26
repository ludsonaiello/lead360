# Sprint BAS15 — Call Log Service

**Module**: Voice AI
**Sprint**: BAS15
**Depends on**: BAS14 (usage tracking service complete)
**Estimated size**: 1–2 files, ~150 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `voice-call-log.service.ts` completely
- Read `api/prisma/schema.prisma` — `voice_call_log` model — every field and index
- Understand that `call_sid` is the unique identifier (from Twilio) — not the row `id`
- Check the `lead` model in Prisma — verify `voice_call_logs` relation exists
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Verify (and complete if needed) `VoiceCallLogService` — manages the full call lifecycle. Called by the agent worker at call start, during the call, and at call end. Also provides history endpoints for admin and tenant views.

---

## Pre-Coding Checklist

- [ ] BAS14 complete (usage tracking service verified)
- [ ] Read `api/src/modules/voice-ai/services/voice-call-log.service.ts` completely
- [ ] Read `api/prisma/schema.prisma` — `voice_call_log` model (all fields, indexes)
- [ ] Read `api/prisma/schema.prisma` — check valid `status` values from contract

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
| `api/src/modules/voice-ai/services/voice-call-log.service.ts` | Existing service |
| `api/prisma/schema.prisma` | `voice_call_log` — fields, status values, indexes |

---

## Task 1: Verify Service Methods

```typescript
@Injectable()
export class VoiceCallLogService {
  constructor(private readonly prisma: PrismaService) {}

  // Called when LiveKit room connects (call starts)
  async startCall(dto: StartCallDto): Promise<voice_call_log>

  // Called at call end — updates status, duration, transcript, outcome
  async completeCall(callSid: string, dto: CompleteCallDto): Promise<voice_call_log>

  // Get call by ID — enforce tenant_id
  async findById(tenantId: string, id: string): Promise<voice_call_log>

  // Get call by Twilio call_sid
  async findByCallSid(callSid: string): Promise<voice_call_log | null>

  // Tenant: list calls with filters and pagination
  async listForTenant(tenantId: string, filters: CallLogFiltersDto): Promise<PaginatedCallLogsDto>

  // Admin: list calls across tenants with filters
  async listForAdmin(filters: AdminCallLogFiltersDto): Promise<PaginatedCallLogsDto>

  // Get usage report aggregate (for admin)
  async getUsageReport(filters: AdminUsageReportFiltersDto): Promise<UsageReportDto>
}
```

**Key rules**:
- `startCall()`: creates row with `status: 'in_progress'`
- `completeCall()`: updates `status`, `duration_seconds`, `ended_at`, `outcome`, `transcript_summary`, `full_transcript`, `actions_taken` (JSON array), `lead_id`, `error_message`
- Valid `status` values: `'in_progress'`, `'completed'`, `'failed'`, `'transferred'`
- Valid `outcome` values: `'lead_created'`, `'transferred'`, `'abandoned'`, `null`
- `listForTenant()` always filters by `tenant_id` from JWT — never cross-tenant

---

## Task 2: Verify DTOs

**StartCallDto**:
```typescript
export class StartCallDto {
  @IsString() tenant_id: string;
  @IsString() call_sid: string;
  @IsOptional() @IsString() room_name?: string;
  @IsString() from_number: string;
  @IsString() to_number: string;
  @IsOptional() @IsString() language_used?: string;
  @IsOptional() @IsString() intent?: string;    // From IVR selection
}
```

**CompleteCallDto**:
```typescript
export class CompleteCallDto {
  @IsEnum(['completed','failed','transferred']) status: string;
  @IsOptional() @IsEnum(['lead_created','transferred','abandoned']) outcome?: string;
  @IsOptional() @IsInt() duration_seconds?: number;
  @IsOptional() @IsString() transcript_summary?: string;
  @IsOptional() @IsString() full_transcript?: string;
  @IsOptional() @IsString() actions_taken?: string;  // JSON array
  @IsOptional() @IsString() lead_id?: string;
  @IsOptional() @IsString() transferred_to?: string;
  @IsOptional() @IsString() error_message?: string;
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
| `api/src/modules/voice-ai/services/voice-call-log.service.ts` | VERIFY/MODIFY | All 7 methods |
| `api/src/modules/voice-ai/dto/start-call.dto.ts` | VERIFY/CREATE | Start call DTO |
| `api/src/modules/voice-ai/dto/complete-call.dto.ts` | VERIFY/CREATE | Complete call DTO |
| `api/src/modules/voice-ai/dto/call-log-filters.dto.ts` | VERIFY/CREATE | Filter/pagination DTOs |

---

## Acceptance Criteria

- [ ] `startCall()` creates row with `status: 'in_progress'`
- [ ] `completeCall()` updates all fields correctly
- [ ] `listForTenant()` always filters by `tenant_id` — no cross-tenant data
- [ ] Pagination works on tenant and admin list endpoints
- [ ] `npm run build` passes with 0 errors
