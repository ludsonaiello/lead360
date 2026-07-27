# Sprint 13 — KioskTokenGuard + Kiosk Service + Controller (3 Public Endpoints)
**Module:** time-clock
**File:** ./documentation/sprints/clockin_backend/sprint_13.md
**Type:** Backend — Auth + CRUD
**Depends On:** Sprint 9 (Clock Sessions)
**Gate:** NONE
**Estimated Complexity:** Medium

---

## Code Quality Standard

> You are a **Google / Amazon / Apple senior-level engineer**. Every file you produce must be production-grade: clean, safe, fully typed, zero lint errors, zero runtime errors. No TODO comments, no placeholder code, no shortcuts. Review your own output as if submitting a PR to a FAANG codebase.

---

## Objective

Implement the `KioskTokenGuard` for public kiosk authentication (bypasses JWT, uses `X-Kiosk-Token` header), the `KioskService` with PIN validation, rate limiting, and lockout logic, and the `KioskController` exposing 3 public endpoints for kiosk-based clock-in/out.

---

## Pre-Sprint Checklist
- [ ] Verify Sprint 9 is complete (ClockSessionService.clockIn/clockOut working)
- [ ] Read `api/src/modules/time-clock/time-clock.module.ts` — understand current providers and imports
- [ ] Read `api/src/modules/time-clock/services/clock-session.service.ts` — understand clockIn/clockOut signatures
- [ ] Read `api/src/modules/time-clock/services/employee-profile.service.ts` — understand employee lookup patterns
- [ ] Read `api/src/modules/communication/services/notifications.service.ts` — exact `createNotification()` signature
- [ ] Read `api/prisma/schema.prisma` — verify `time_clock_settings`, `employee_profile`, `clock_session` models
- [ ] Read `api/src/modules/auth/decorators/public.decorator.ts` — understand `@Public()` decorator
- [ ] Confirm `bcrypt` is installed: `npm ls bcrypt` (used for PIN and kiosk token validation)

---

## Environment

- **This project does NOT use PM2. Do not reference or run any PM2 command.**
- **Database credentials**: Read from `.env` file (`DATABASE_URL`). Never hardcode credentials.
- **Dev server runs in watch mode**: `npm run start:dev` (NestJS hot-reload)
- Port: **8000**, Global prefix: **api/v1**, Base URL: `http://127.0.0.1:8000/api/v1`
- Swagger: `http://127.0.0.1:8000/api/docs`
- Validation pipe: `whitelist: true, forbidNonWhitelisted: true`
- Tenant ID: ALWAYS from JWT (`req.user.tenant_id`) for authenticated routes, from `req.kioskTenantId` for kiosk routes
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
  lsof -i :8000   <- must return nothing before proceeding

START the dev server:
  cd /var/www/lead360.app/api && npm run start:dev

WAIT -- the server takes 60 to 120 seconds to compile and become ready.
Do NOT attempt to hit any endpoint until the health check passes:
  curl -s http://localhost:8000/health   <- must return 200 before proceeding

Keep retrying the health check every 10 seconds until it responds.

KEEP the server running for the entire duration of the sprint.
Do NOT stop and restart between tests -- keep it open.

BEFORE marking the sprint COMPLETE:
  lsof -i :8000
  kill {PID}
  Confirm port is free: lsof -i :8000   <- must return nothing
```

---

## Tasks

### Task 1 — KioskTokenGuard

**What:** Create `api/src/modules/time-clock/guards/kiosk-token.guard.ts`

**Purpose:** A custom NestJS guard that authenticates kiosk requests using a shared token passed via the `X-Kiosk-Token` header. This replaces JWT auth for kiosk-only endpoints.

```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class KioskTokenGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-kiosk-token'];
    if (!token) throw new UnauthorizedException('Missing X-Kiosk-Token header');

    const settingsRecords = await this.prisma.time_clock_settings.findMany({
      where: { kiosk_mode_enabled: true, kiosk_token_hash: { not: null } },
      select: { tenant_id: true, kiosk_token_hash: true },
    });

    for (const settings of settingsRecords) {
      const isMatch = await bcrypt.compare(token, settings.kiosk_token_hash);
      if (isMatch) {
        request.kioskTenantId = settings.tenant_id;
        request.kioskTokenHash = settings.kiosk_token_hash;
        return true;
      }
    }
    throw new UnauthorizedException('Invalid kiosk token');
  }
}
```

**Key Details:**
- Import `PrismaService` from `../../../core/database/prisma.service` — verify the exact relative path from the guard file location
- The guard queries ALL tenants with kiosk mode enabled and a non-null token hash
- It iterates and bcrypt-compares the plaintext token against each stored hash
- On match: sets `request.kioskTenantId` to the matching tenant's `tenant_id` AND `request.kioskTokenHash` to the stored hash (used for rate limiting in KioskService)
- On failure: throws `UnauthorizedException`
- The controller accesses the resolved tenant via `req.kioskTenantId`

**Usage on controller:**
```typescript
@Public()
@UseGuards(KioskTokenGuard)
```
The `@Public()` decorator bypasses JWT auth. The `KioskTokenGuard` replaces it with kiosk token auth.

---

### Task 2 — Kiosk DTOs

**What:** Create `api/src/modules/time-clock/dto/kiosk.dto.ts`

**KioskClockInDto:**
```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';

export class KioskClockInDto {
  @ApiProperty({ description: 'Employee profile ID' })
  @IsString()
  @IsUUID()
  employee_profile_id: string;

  @ApiProperty({ description: 'Kiosk PIN (4-6 digits)', example: '1234' })
  @IsString()
  @MinLength(4)
  @MaxLength(6)
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4-6 digits' })
  pin: string;

  @ApiPropertyOptional({ description: 'Project to clock in for' })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ description: 'Task to clock in for' })
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiPropertyOptional({ description: 'Notes for the clock-in' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

**KioskClockOutDto:**
```typescript
export class KioskClockOutDto {
  @ApiProperty({ description: 'Employee profile ID' })
  @IsString()
  @IsUUID()
  employee_profile_id: string;

  @ApiProperty({ description: 'Kiosk PIN (4-6 digits)', example: '1234' })
  @IsString()
  @MinLength(4)
  @MaxLength(6)
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4-6 digits' })
  pin: string;

  @ApiPropertyOptional({ description: 'Notes for the clock-out' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

---

### Task 3 — KioskService

**What:** Create `api/src/modules/time-clock/services/kiosk.service.ts`

**Constructor dependencies:**
- `PrismaService` (from `../../../core/database/prisma.service`)
- `ClockSessionService` (from `./clock-session.service`)
- `NotificationsService` (from `../../communication/services/notifications.service`)

**Private properties:**
- `private readonly pinAttemptMap = new Map<string, { count: number; resetAt: number }>()` — in-memory rate limiter keyed by kiosk token hash

**Methods:**

#### 3a. `getEmployees(tenantId: string)`

- Query `employee_profile` where:
  - `tenant_id = tenantId`
  - `is_active = true`
  - `kiosk_pin_hash: { not: null }` (only employees with a PIN set)
- Include: `{ user: { select: { first_name: true, last_name: true } } }`
- For each employee, query `clock_session` where:
  - `employee_profile_id = employee.id`
  - `tenant_id = tenantId`
  - `status` IN `('active', 'on_break')`
  - Take 1 (just checking existence)
- Map response to:
  ```typescript
  {
    data: employees.map(emp => ({
      id: emp.id,
      user: {
        first_name: emp.user.first_name,
        last_name: emp.user.last_name.charAt(0) + '.',  // Truncated for privacy
      },
      has_pin: true,
      is_clocked_in: /* true if active/on_break session exists */,
    }))
  }
  ```
- **Last name truncation**: Only return first character + period (e.g., "Doe" becomes "D.") for kiosk privacy
- **All queries MUST include `tenant_id = tenantId`**

#### 3b. `clockIn(tenantId: string, dto: KioskClockInDto, kioskTokenHash: string)`

Execution order:

1. **Rate limit check**: Call `this.checkRateLimit(kioskTokenHash)`. If exceeded, throw `HttpException` with status 429 and message `'Too many PIN attempts. Please wait.'`

2. **Validate employee belongs to tenant**: Query `employee_profile` where `{ id: dto.employee_profile_id, tenant_id: tenantId }`. If not found, throw `NotFoundException('Employee not found')`. This prevents cross-tenant lookups.

3. **Check lockout**: If `employee.kiosk_pin_locked_until` is not null AND is greater than `new Date()`, throw `HttpException` with status 423 (Locked) and message `'Account locked for 15 minutes'`

4. **Validate PIN**: `const isValid = await bcrypt.compare(dto.pin, employee.kiosk_pin_hash)`

5. **Wrong PIN path**:
   - Increment: `kiosk_pin_failed_attempts = employee.kiosk_pin_failed_attempts + 1`
   - If `kiosk_pin_failed_attempts >= 5`:
     - Set `kiosk_pin_locked_until = new Date(Date.now() + 15 * 60 * 1000)` (15 minutes)
     - Notify all tenant admins via `NotificationsService.createNotification()`:
       - `type: 'timeclock_kiosk_lockout'`
       - `title: 'Kiosk Account Locked'`
       - `message: '{employee_name} has been locked out of the kiosk after 5 failed PIN attempts'`
       - `action_url: '/settings/time-clock'`
     - To find admin users: query `user_tenant_membership` joined with `user_role` where `role.name IN ('Owner', 'Admin')` and `tenant_id = tenantId`
   - Update the employee record with new `kiosk_pin_failed_attempts` and (if applicable) `kiosk_pin_locked_until`
   - Throw `UnauthorizedException('Invalid PIN')` with body: `{ message: 'Invalid PIN', remaining_attempts: Math.max(0, 5 - newFailedAttempts) }`

6. **Correct PIN path**:
   - Reset: update `{ kiosk_pin_failed_attempts: 0, kiosk_pin_locked_until: null }`
   - Delegate to `ClockSessionService.clockIn()` with:
     - `tenantId`
     - `employee_profile_id: dto.employee_profile_id`
     - `location_source: 'kiosk'`
     - No GPS coordinates (latitude/longitude are null)
     - `project_id: dto.project_id` (if provided)
     - `task_id: dto.task_id` (if provided)
     - `notes: dto.notes` (if provided)
   - Return the clock session result

#### 3c. `clockOut(tenantId: string, dto: KioskClockOutDto, kioskTokenHash: string)`

Execution order is identical to `clockIn` for steps 1-6, except:
- Step 6 (correct PIN): delegate to `ClockSessionService.clockOut()` with:
  - `tenantId`
  - `employee_profile_id: dto.employee_profile_id`
  - `location_source: 'kiosk'`
  - `notes: dto.notes` (if provided)
- Return the clock session result

#### 3d. `private checkRateLimit(kioskTokenHash: string): void`

```typescript
private checkRateLimit(kioskTokenHash: string): void {
  const now = Date.now();
  const entry = this.pinAttemptMap.get(kioskTokenHash);

  if (!entry || now >= entry.resetAt) {
    this.pinAttemptMap.set(kioskTokenHash, { count: 1, resetAt: now + 60_000 });
    return;
  }

  entry.count += 1;
  if (entry.count > 10) {
    throw new HttpException('Too many PIN attempts. Please wait.', 429);
  }
}
```

- Keyed by the kiosk token hash (not the plaintext token)
- 10 PIN attempts per 60 seconds per kiosk token
- In-memory Map — resets on server restart (acceptable for rate limiting)
- The `kioskTokenHash` parameter is obtained from the matched `settings.kiosk_token_hash` during guard validation. The guard sets `request.kioskTokenHash = settings.kiosk_token_hash` alongside `request.kioskTenantId`.

---

### Task 4 — KioskController

**What:** Create `api/src/modules/time-clock/controllers/kiosk.controller.ts`

```typescript
import { Controller, Get, Post, Body, Req, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { KioskTokenGuard } from '../guards/kiosk-token.guard';
import { KioskService } from '../services/kiosk.service';
import { KioskClockInDto } from '../dto/kiosk.dto';
import { KioskClockOutDto } from '../dto/kiosk.dto';

@ApiTags('Time Clock - Kiosk')
@Controller('time-clock/kiosk')
@Public()
@UseGuards(KioskTokenGuard)
@ApiHeader({ name: 'X-Kiosk-Token', required: true, description: 'Kiosk authentication token' })
export class KioskController {
  constructor(private readonly kioskService: KioskService) {}

  @Get('employees')
  @ApiOperation({ summary: 'List kiosk-eligible employees' })
  async getEmployees(@Req() req) {
    return this.kioskService.getEmployees(req.kioskTenantId);
  }

  @Post('clock-in')
  @HttpCode(200)
  @ApiOperation({ summary: 'Clock in via kiosk' })
  async clockIn(@Req() req, @Body() dto: KioskClockInDto) {
    return this.kioskService.clockIn(req.kioskTenantId, dto, req.kioskTokenHash);
  }

  @Post('clock-out')
  @HttpCode(200)
  @ApiOperation({ summary: 'Clock out via kiosk' })
  async clockOut(@Req() req, @Body() dto: KioskClockOutDto) {
    return this.kioskService.clockOut(req.kioskTenantId, dto, req.kioskTokenHash);
  }
}
```

**Key Details:**
- `@Public()` at the class level bypasses JwtAuthGuard for all kiosk routes
- `@UseGuards(KioskTokenGuard)` at the class level enforces kiosk token auth for all routes
- Tenant ID comes from `req.kioskTenantId` (set by the guard)
- Kiosk token hash comes from `req.kioskTokenHash` (set by the guard, used for rate limiting)
- No `@ApiBearerAuth()` — kiosk endpoints do not use JWT
- Verify the import path for `@Public()` decorator — check `api/src/modules/auth/decorators/public.decorator.ts`

---

### Task 5 — Update Module Registration

**What:** Update `api/src/modules/time-clock/time-clock.module.ts` to register all new providers.

**Add to controllers:**
- `KioskController`

**Add to providers:**
- `KioskTokenGuard`
- `KioskService`

**Verify existing providers are still registered:**
- All services and controllers from previous sprints must remain

---

### Task 6 — Verify Kiosk Endpoints

Start the dev server and test all 3 kiosk endpoints.

**Prerequisites:**
- A tenant with `kiosk_mode_enabled = true` and a valid `kiosk_token_hash` in `time_clock_settings`
- At least one `employee_profile` with `is_active = true` and `kiosk_pin_hash` set
- You will need to create test data or use existing seeded data

**Test 1: GET /api/v1/time-clock/kiosk/employees**
```bash
curl -s -X GET http://localhost:8000/api/v1/time-clock/kiosk/employees \
  -H "X-Kiosk-Token: {PLAINTEXT_TOKEN}" \
  | jq .
```
Expected: 200 with `{ data: [{ id, user: { first_name, last_name: "X." }, has_pin: true, is_clocked_in: false }] }`

**Test 2: Missing token**
```bash
curl -s -X GET http://localhost:8000/api/v1/time-clock/kiosk/employees \
  | jq .
```
Expected: 401 `"Missing X-Kiosk-Token header"`

**Test 3: Invalid token**
```bash
curl -s -X GET http://localhost:8000/api/v1/time-clock/kiosk/employees \
  -H "X-Kiosk-Token: wrong-token" \
  | jq .
```
Expected: 401 `"Invalid kiosk token"`

**Test 4: POST /api/v1/time-clock/kiosk/clock-in**
```bash
curl -s -X POST http://localhost:8000/api/v1/time-clock/kiosk/clock-in \
  -H "X-Kiosk-Token: {PLAINTEXT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"employee_profile_id": "{ID}", "pin": "1234"}' \
  | jq .
```
Expected: 200 with clock session data

**Test 5: Wrong PIN**
```bash
curl -s -X POST http://localhost:8000/api/v1/time-clock/kiosk/clock-in \
  -H "X-Kiosk-Token: {PLAINTEXT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"employee_profile_id": "{ID}", "pin": "9999"}' \
  | jq .
```
Expected: 401 `"Invalid PIN"` with `{ remaining_attempts: N }`

**Test 6: POST /api/v1/time-clock/kiosk/clock-out**
```bash
curl -s -X POST http://localhost:8000/api/v1/time-clock/kiosk/clock-out \
  -H "X-Kiosk-Token: {PLAINTEXT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"employee_profile_id": "{ID}", "pin": "1234"}' \
  | jq .
```
Expected: 200 with clock session data

**Test 7: Lockout after 5 wrong PINs**
Send 5 consecutive wrong PINs, then verify the 6th returns 423 `"Account locked for 15 minutes"`.

---

## Notification Events Summary

| Event Type | Recipients | Title | Trigger |
|---|---|---|---|
| `timeclock_kiosk_lockout` | All tenant Admins + Owners | Kiosk Account Locked | 5 failed PIN attempts |

---

## Business Rules Enforced in This Sprint
- Kiosk PIN lockout — 5 failed attempts triggers 15-minute lockout + admin notification
- Kiosk rate limiting — 10 PIN attempts per minute per kiosk token (in-memory)
- Kiosk privacy — last name truncated to initial on employee list
- Tenant isolation — every kiosk query uses `kioskTenantId` from the guard
- Cross-tenant guard — employee `tenant_id` validated against kiosk `tenantId` before PIN check

---

## Integration Points
- `PrismaService` — `api/src/core/database/prisma.service.ts`
- `ClockSessionService` — `api/src/modules/time-clock/services/clock-session.service.ts` (clockIn/clockOut)
- `NotificationsService` — `api/src/modules/communication/services/notifications.service.ts`
- `bcrypt` — for PIN validation and kiosk token comparison

---

## Files Created in This Sprint

| File | Purpose |
|---|---|
| `api/src/modules/time-clock/guards/kiosk-token.guard.ts` | Kiosk token authentication guard |
| `api/src/modules/time-clock/dto/kiosk.dto.ts` | KioskClockInDto, KioskClockOutDto |
| `api/src/modules/time-clock/services/kiosk.service.ts` | Kiosk business logic (employees, clock-in/out, PIN, rate limit) |
| `api/src/modules/time-clock/controllers/kiosk.controller.ts` | 3 public kiosk endpoints |

---

## Acceptance Criteria
- [ ] KioskTokenGuard validates `X-Kiosk-Token` header via bcrypt comparison
- [ ] KioskTokenGuard sets `req.kioskTenantId` and `req.kioskTokenHash` on match
- [ ] GET `/api/v1/time-clock/kiosk/employees` returns active employees with PIN, last name truncated
- [ ] POST `/api/v1/time-clock/kiosk/clock-in` validates PIN, handles lockout, delegates to ClockSessionService
- [ ] POST `/api/v1/time-clock/kiosk/clock-out` validates PIN, handles lockout, delegates to ClockSessionService
- [ ] PIN lockout activates after 5 failed attempts with 15-minute duration
- [ ] Lockout triggers `timeclock_kiosk_lockout` notification to all tenant admins
- [ ] Rate limiting: 10 PIN attempts per minute per kiosk token (429 when exceeded)
- [ ] All kiosk queries include `tenant_id` from `req.kioskTenantId`
- [ ] Employee from one tenant cannot be accessed via another tenant's kiosk token
- [ ] Kiosk endpoints are public (no JWT required) but require valid kiosk token
- [ ] All new providers registered in `time-clock.module.ts`
- [ ] `npm run lint` passes
- [ ] All endpoints tested via curl
- [ ] No frontend code modified
- [ ] Dev server shut down before sprint is marked complete

---

## Handoff Notes
- `KioskService` depends on `ClockSessionService` from Sprint 9 for actual clock-in/out logic
- The `timeclock_kiosk_lockout` notification type should be added to any notification type enum or constants file if one exists
- The in-memory rate limit Map resets on server restart — this is acceptable for PIN rate limiting; if persistence is needed later, migrate to Redis-based rate limiting
- Kiosk endpoints are completely independent of JWT auth — they use a separate authentication mechanism via `X-Kiosk-Token` header
