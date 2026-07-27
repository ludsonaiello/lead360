# Sprint 3 — Time Clock Settings DTOs + Service + Controller
**Module:** time-clock
**File:** ./documentation/sprints/clockin_backend/sprint_3.md
**Type:** Backend — CRUD
**Depends On:** Sprint 2
**Gate:** STOP — All 3 settings endpoints must return correct responses before Sprint 4 begins.
**Estimated Complexity:** Low

---

## Code Quality Standard

> You are a **Google / Amazon / Apple senior-level engineer**. Every file you produce must be production-grade: clean, safe, fully typed, zero lint errors, zero runtime errors. No TODO comments, no placeholder code, no shortcuts. Review your own output as if submitting a PR to a FAANG codebase.

---

## Environment

- **This project does NOT use PM2. Do not reference or run any PM2 command.**
- **Database credentials**: Read from `.env` file (`DATABASE_URL`). Never hardcode credentials.
- **Dev server runs in watch mode**: `npm run start:dev` (NestJS hot-reload)
- Port: **8000**, Global prefix: **api/v1**, Base URL: `http://127.0.0.1:8000/api/v1`
- Swagger: `http://127.0.0.1:8000/api/docs`
- Validation pipe: `whitelist: true, forbidNonWhitelisted: true`
- Tenant ID: ALWAYS from JWT (`req.user.tenant_id`), NEVER from request body
- User ID: ALWAYS from JWT (`req.user.id`), NEVER from request body
- Every DB query MUST include `tenant_id` filter — no exceptions

---

## Dev Server

```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :8000   ← must return nothing before proceeding

START the dev server:
  cd /var/www/lead360.app/api && npm run start:dev

WAIT — the server takes 60 to 120 seconds to compile and become ready.
Do NOT attempt to hit any endpoint until the health check passes:
  curl -s http://localhost:8000/health   ← must return 200 before proceeding

Keep retrying the health check every 10 seconds until it responds.

KEEP the server running for the entire duration of the sprint.
Do NOT stop and restart between tests — keep it open.

BEFORE marking the sprint COMPLETE:
  lsof -i :8000
  kill {PID}
  Confirm port is free: lsof -i :8000   ← must return nothing
```

---

## Controller Pattern

```typescript
@ApiTags('Time Clock')
@ApiBearerAuth()
@Controller('time-clock')
@UseGuards(JwtAuthGuard, RolesGuard)
// Use @Request() req → req.user.tenant_id, req.user.id
```

---

## Objective

Implement the complete Settings CRUD: GET settings, PATCH settings (upsert), and POST kiosk-token/regenerate. Replace the stub service and controller from Sprint 2 with full implementations.

---

## Pre-Sprint Checklist
- [ ] Verify Sprint 2 is complete (module compiles, all stubs registered)
- [ ] Read `api/src/modules/time-clock/time-clock.module.ts` — understand module structure
- [ ] Read `api/prisma/schema.prisma` — verify `time_clock_settings` model exists with all fields
- [ ] Read `api/src/modules/audit/services/audit-logger.service.ts` — exact `logTenantChange()` signature
- [ ] Read `api/src/main.ts` — understand port, global prefix, validation pipe config

---

## Tasks

### Task 1 — Create Settings DTO

**What:** Create `api/src/modules/time-clock/dto/time-clock-settings.dto.ts` with `UpdateTimeClockSettingsDto`:

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional, IsBoolean, IsEnum, IsNumber, IsInt, IsDateString,
  Min, Max,
} from 'class-validator';

export class UpdateTimeClockSettingsDto {
  @ApiPropertyOptional({ description: 'Clock-in location mode', enum: ['anywhere', 'specific_addresses', 'active_job_sites'] })
  @IsOptional()
  @IsEnum(['anywhere', 'specific_addresses', 'active_job_sites'])
  clock_in_mode?: string;

  @ApiPropertyOptional({ description: 'Action when outside geofence', enum: ['block', 'warn_only'] })
  @IsOptional()
  @IsEnum(['block', 'warn_only'])
  geofence_violation_action?: string;

  @ApiPropertyOptional({ description: 'Whether GPS is required' })
  @IsOptional()
  @IsBoolean()
  gps_required?: boolean;

  @ApiPropertyOptional({ description: 'Action when GPS unavailable', enum: ['block', 'allow_flagged'] })
  @IsOptional()
  @IsEnum(['block', 'allow_flagged'])
  gps_unavailable_action?: string;

  @ApiPropertyOptional({ description: 'Require project selection at clock-in' })
  @IsOptional()
  @IsBoolean()
  require_job_tag?: boolean;

  @ApiPropertyOptional({ description: 'Require task selection at clock-in' })
  @IsOptional()
  @IsBoolean()
  require_task_tag?: boolean;

  @ApiPropertyOptional({ description: 'Enable overtime calculation' })
  @IsOptional()
  @IsBoolean()
  overtime_enabled?: boolean;

  @ApiPropertyOptional({ description: 'Daily overtime threshold in hours (0-24)', example: 8.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  overtime_daily_threshold_hours?: number;

  @ApiPropertyOptional({ description: 'Weekly overtime threshold in hours (0-168)', example: 40.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(168)
  overtime_weekly_threshold_hours?: number;

  @ApiPropertyOptional({ description: 'Overtime rate multiplier (1-5)', example: 1.50 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(5)
  overtime_multiplier?: number;

  @ApiPropertyOptional({ description: 'Pay period type', enum: ['weekly', 'biweekly', 'semimonthly', 'monthly'] })
  @IsOptional()
  @IsEnum(['weekly', 'biweekly', 'semimonthly', 'monthly'])
  pay_period_type?: string;

  @ApiPropertyOptional({ description: 'Pay period start day (0=Sun, 6=Sat)', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  pay_period_start_day?: number;

  @ApiPropertyOptional({ description: 'Anchor date for biweekly pay period', example: '2026-01-06' })
  @IsOptional()
  @IsDateString()
  pay_period_anchor_date?: string;

  @ApiPropertyOptional({ description: 'Enable kiosk mode' })
  @IsOptional()
  @IsBoolean()
  kiosk_mode_enabled?: boolean;

  @ApiPropertyOptional({ description: 'Minutes before shift to send reminder (5-120)', example: 30 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  shift_reminder_minutes?: number;

  @ApiPropertyOptional({ description: 'Minutes after shift start to mark as missed (5-120)', example: 30 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  missed_shift_threshold_minutes?: number;
}
```

All fields are optional — this is a PATCH DTO. The validation pipe with `whitelist: true, forbidNonWhitelisted: true` will strip unknown fields.

**Acceptance:** DTO compiles. All validators present.

---

### Task 2 — Implement TimeClockSettingsService

**What:** Replace the stub `api/src/modules/time-clock/services/time-clock-settings.service.ts` with full implementation.

**Constructor dependencies:**
- `PrismaService` (from `../../core/database/prisma.service` — verify exact import path)
- `AuditLoggerService` (from `../../audit/services/audit-logger.service` — verify exact import path)

**Methods:**

#### 1. `getSettings(tenantId: string)`

- Query: `prisma.time_clock_settings.findUnique({ where: { tenant_id: tenantId } })`
- If found: return it
- If NOT found: return a **default-values object** with `id: null` (NOT a 404 error). Default values:
  ```typescript
  {
    id: null,
    tenant_id: tenantId,
    clock_in_mode: 'anywhere',
    geofence_violation_action: 'warn_only',
    gps_required: true,
    gps_unavailable_action: 'allow_flagged',
    require_job_tag: false,
    require_task_tag: false,
    overtime_enabled: true,
    overtime_daily_threshold_hours: '8.00',
    overtime_weekly_threshold_hours: '40.00',
    overtime_multiplier: '1.50',
    pay_period_type: 'biweekly',
    pay_period_start_day: null,
    pay_period_anchor_date: null,
    kiosk_mode_enabled: false,
    kiosk_token_hash: null,
    shift_reminder_minutes: 30,
    missed_shift_threshold_minutes: 30,
    native_app_features_enabled: false,
    created_at: new Date(),
    updated_at: new Date(),
  }
  ```

**Why return defaults instead of 404:** The frontend always expects a settings object. If the tenant has never configured settings, they should see the defaults — not an error page.

#### 2. `upsertSettings(tenantId: string, userId: string, dto: UpdateTimeClockSettingsDto)`

- First check if record exists: `prisma.time_clock_settings.findUnique({ where: { tenant_id: tenantId } })`
- Use `prisma.time_clock_settings.upsert({ where: { tenant_id: tenantId }, create: { tenant_id: tenantId, ...dto }, update: { ...dto } })`
- Audit log:
  ```typescript
  this.auditLoggerService.logTenantChange({
    action: existedBefore ? 'updated' : 'created',
    entityType: 'time_clock_settings',
    entityId: result.id,
    tenantId,
    actorUserId: userId,
    before: existedBefore ? before : undefined,
    after: result,
    description: existedBefore ? 'Updated time clock settings' : 'Created time clock settings',
  });
  ```
- Return the updated/created record

#### 3. `regenerateKioskToken(tenantId: string, userId: string)`

- Generate token: `'tc_k_' + crypto.randomBytes(48).toString('hex')`
  - Import `crypto` from Node.js: `import * as crypto from 'crypto';`
- Hash with bcrypt (12 rounds): `const hash = await bcrypt.hash(plaintextToken, 12)`
  - Import `bcrypt`: `import * as bcrypt from 'bcrypt';`
- If no settings record exists: auto-create with defaults + token hash using `prisma.time_clock_settings.upsert`
- If exists: update `kiosk_token_hash`
- Audit log:
  ```typescript
  this.auditLoggerService.logTenantChange({
    action: 'updated',
    entityType: 'time_clock_settings',
    entityId: result.id,
    tenantId,
    actorUserId: userId,
    description: 'Regenerated kiosk authentication token',
  });
  ```
- Return `{ kiosk_token: plaintextToken }` — the plaintext token is returned ONCE and never stored

**CRITICAL:** The plaintext token is only returned in this response. After this, only the hash is stored. If the user loses the token, they must regenerate.

**Acceptance:** All 3 methods work correctly.

---

### Task 3 — Implement TimeClockSettingsController

**What:** Replace the stub `api/src/modules/time-clock/controllers/time-clock-settings.controller.ts` with full implementation:

```typescript
import { Controller, Get, Patch, Post, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { Roles } from '../../rbac/decorators/roles.decorator';
import { TimeClockSettingsService } from '../services/time-clock-settings.service';
import { UpdateTimeClockSettingsDto } from '../dto/time-clock-settings.dto';

@ApiTags('Time Clock')
@ApiBearerAuth()
@Controller('time-clock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimeClockSettingsController {
  constructor(private readonly settingsService: TimeClockSettingsService) {}

  @Get('settings')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Get tenant time clock settings' })
  @ApiResponse({ status: 200, description: 'Settings retrieved' })
  async getSettings(@Request() req) {
    return this.settingsService.getSettings(req.user.tenant_id);
  }

  @Patch('settings')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Update tenant time clock settings' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  async updateSettings(@Request() req, @Body() dto: UpdateTimeClockSettingsDto) {
    return this.settingsService.upsertSettings(req.user.tenant_id, req.user.id, dto);
  }

  @Post('settings/kiosk-token/regenerate')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Regenerate kiosk authentication token' })
  @ApiResponse({ status: 201, description: 'Token regenerated — plaintext returned once' })
  async regenerateKioskToken(@Request() req) {
    return this.settingsService.regenerateKioskToken(req.user.tenant_id, req.user.id);
  }
}
```

**Roles:** All 3 endpoints require `Owner` or `Admin` role.

**Acceptance:** All 3 endpoints respond correctly.

---

### Task 4 — Update Module Registration

**What:** Update `api/src/modules/time-clock/time-clock.module.ts` to ensure the real `TimeClockSettingsService` and `TimeClockSettingsController` are imported (they should already be registered from Sprint 2, but verify the imports point to the updated files).

**Acceptance:** Module compiles.

---

### Task 5 — Verify All 3 Endpoints

**What:** Start dev server and test all 3 endpoints with curl.

**Login to get JWT:**
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r .access_token)
```

**Test GET settings (expect defaults with id:null):**
```bash
curl -s http://localhost:8000/api/v1/time-clock/settings \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: JSON object with `id: null`, `clock_in_mode: "anywhere"`, all default values.

**Test PATCH settings:**
```bash
curl -s -X PATCH http://localhost:8000/api/v1/time-clock/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"overtime_enabled":true,"overtime_daily_threshold_hours":10}' | jq .
```

Expected: JSON object with `id` (UUID now set), `overtime_daily_threshold_hours: "10.00"`.

**Test GET settings again (expect record with id):**
```bash
curl -s http://localhost:8000/api/v1/time-clock/settings \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: Same record as PATCH response (with UUID `id`, not null).

**Test kiosk token regeneration:**
```bash
curl -s -X POST http://localhost:8000/api/v1/time-clock/settings/kiosk-token/regenerate \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: `{ "kiosk_token": "tc_k_..." }` — a `tc_k_` prefixed hex string (100 characters after prefix).

**Test credentials:**
- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant user: `contact@honeydo4you.com` / `978@F32c`

**Acceptance:** All 3 endpoints return correct responses. GET returns defaults when no record. PATCH upserts. Token returns `tc_k_` prefixed string.

---

## Integration Points
- `PrismaService` — `api/src/core/database/prisma.service.ts`
- `AuditLoggerService` — `api/src/modules/audit/services/audit-logger.service.ts`
  - Method: `logTenantChange({ action, entityType: 'time_clock_settings', entityId, tenantId, actorUserId, before?, after?, description })`
- `bcrypt` — for kiosk token hashing (12 rounds)
- `crypto` — Node.js built-in for random bytes

---

## Acceptance Criteria
- [ ] `UpdateTimeClockSettingsDto` created with all 16 optional validated fields
- [ ] `TimeClockSettingsService` with 3 methods (getSettings, upsertSettings, regenerateKioskToken)
- [ ] `TimeClockSettingsController` with 3 endpoints (GET, PATCH, POST)
- [ ] GET /time-clock/settings returns defaults (id:null) when no record
- [ ] PATCH /time-clock/settings upserts correctly (creates on first call, updates on subsequent)
- [ ] POST /time-clock/settings/kiosk-token/regenerate returns `tc_k_` prefixed plaintext token
- [ ] Kiosk token hash stored in DB (never plaintext)
- [ ] Audit logs created for settings create, update, and token regeneration
- [ ] All Prisma queries include `tenant_id` filter
- [ ] Only Owner and Admin roles can access all 3 endpoints
- [ ] `npm run lint` passes
- [ ] No frontend code modified
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — Before Sprint 4 begins, verify:
1. All 3 endpoints return correct responses
2. GET returns defaults when no record exists
3. PATCH creates and updates correctly
4. Kiosk token is generated, hashed, and returned
5. Audit logs are recorded
6. `npm run lint` passes

---

## Handoff Notes
- `TimeClockSettingsService.getSettings(tenantId)` is used by later sprints (Sprint 5+) to read tenant config for overtime rules, geofence enforcement, GPS requirements, etc.
- The kiosk token hash stored in `time_clock_settings.kiosk_token_hash` is validated by `KioskTokenGuard` in Sprint 7
- Settings are tenant-scoped (one row per tenant, `tenant_id` is `@unique`)
