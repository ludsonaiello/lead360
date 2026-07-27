# Sprint 9 — Clock Session DTOs + Service + Controller (8 Endpoints)
**Module:** time-clock
**File:** ./documentation/sprints/clockin_backend/sprint_9.md
**Type:** Backend — Core Logic
**Depends On:** Sprints 4, 5, 7, 8
**Gate:** STOP — Clock-in/out cycle works end-to-end, all 8 endpoints respond correctly with proper status codes before any subsequent sprint begins.
**Estimated Complexity:** High

---

## Code Quality Standard

> You are a **Google / Amazon / Apple senior-level engineer**. Every file you produce must be production-grade: clean, safe, fully typed, zero lint errors, zero runtime errors. No TODO comments, no placeholder code, no shortcuts. Review your own output as if submitting a PR to a FAANG codebase.

---

## Objective

Implement the **ClockSessionService** with the complete clock-in/clock-out engine and all 8 session endpoints. This is the heart of the time-clock module: it enforces geofence rules, GPS validation, shift auto-matching, overtime calculation, labor cost attribution, and break auto-end on clock-out.

---

## Pre-Sprint Checklist
- [ ] Verify Sprints 4, 5, 7, and 8 are complete (employee profiles, geofence, work shifts, overtime, labor cost attribution all functional)
- [ ] Read `api/src/modules/time-clock/time-clock.module.ts` — understand current providers/controllers
- [ ] Read `api/src/modules/time-clock/services/geofence.service.ts` — understand `GeofenceService.checkGeofence()` signature and return shape
- [ ] Read `api/src/modules/time-clock/services/overtime.service.ts` — understand `calculateOvertime()` signature and return shape
- [ ] Read `api/src/modules/time-clock/services/labor-cost-attribution.service.ts` — understand `postLaborCost()` signature
- [ ] Read `api/src/modules/time-clock/services/employee-profile.service.ts` — understand employee lookup patterns
- [ ] Read `api/src/modules/time-clock/services/time-clock-settings.service.ts` — understand `getSettings()` return shape and defaults behavior
- [ ] Read `api/src/modules/communication/services/notifications.service.ts` — exact `createNotification()` signature
- [ ] Read `api/prisma/schema.prisma` — verify `clock_session`, `break_entry`, `clock_session_edit_log`, `time_dispute` models exist with all required fields
- [ ] Read `api/src/modules/audit/services/audit-logger.service.ts` — exact `logTenantChange()` signature

---

## Environment

- **This project does NOT use PM2. Do not reference or run any PM2 command.**
- **Database credentials**: Read from `.env` file (`DATABASE_URL`). Never hardcode credentials.
- **Dev server runs in watch mode**: `npm run start:dev` (NestJS hot-reload)
- **API prefix**: `api/v1` — all endpoints are prefixed automatically
- **Port**: 8000
- **Tenant ID**: Always extracted from JWT via `@TenantId()` decorator. Never accept tenant_id from request body.

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

## Test Credentials

- **Admin login**: `ludsonaiello@gmail.com` / `978@F32c`
- Use this to obtain a JWT Bearer token for all authenticated endpoint tests.

---

## Tasks

### Task 1 — Clock Session DTOs

**What:** Create `api/src/modules/time-clock/dto/clock-session.dto.ts` with all DTOs for the 8 session endpoints (or update the existing file if it already exists as a placeholder from a prior sprint).

**ClockInDto:**
```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional, IsString, IsUUID, IsNumber, IsEnum,
  Min, Max, MaxLength,
} from 'class-validator';

export enum LocationSourceEnum {
  BROWSER_GPS = 'browser_gps',
  NATIVE_GPS = 'native_gps',
  KIOSK = 'kiosk',
  MANUAL = 'manual',
}

export class ClockInDto {
  @ApiPropertyOptional({ description: 'Project to tag this session to' })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ description: 'Task to tag this session to' })
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiPropertyOptional({ description: 'Latitude (8 decimal places)', example: 40.71280000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude (8 decimal places)', example: -74.00600000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Source of GPS coordinates',
    enum: LocationSourceEnum,
    default: LocationSourceEnum.BROWSER_GPS,
  })
  @IsOptional()
  @IsEnum(LocationSourceEnum)
  location_source?: LocationSourceEnum;

  @ApiPropertyOptional({ description: 'Clock-in notes', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

**ClockOutDto:**
```typescript
export class ClockOutDto {
  @ApiPropertyOptional({ description: 'Latitude', example: 40.71280000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude', example: -74.00600000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Source of GPS coordinates',
    enum: LocationSourceEnum,
    default: LocationSourceEnum.BROWSER_GPS,
  })
  @IsOptional()
  @IsEnum(LocationSourceEnum)
  location_source?: LocationSourceEnum;

  @ApiPropertyOptional({ description: 'Clock-out notes', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
```

**ListClockSessionsDto** (admin list — query params):
```typescript
import { Type } from 'class-transformer';
import {
  IsOptional, IsInt, IsString, IsUUID, IsEnum, IsBoolean,
  IsDateString, Min, Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListClockSessionsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by employee profile ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;

  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by session status',
    enum: ['active', 'on_break', 'completed'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter sessions starting from this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'Filter sessions ending at this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Filter by flagged status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_flagged?: boolean;

  @ApiPropertyOptional({ description: 'Filter by manually edited sessions' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_manual_edit?: boolean;
}
```

**ListMyClockSessionsDto** (employee own history — query params):
```typescript
export class ListMyClockSessionsDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by session status',
    enum: ['active', 'on_break', 'completed'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter sessions starting from this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'Filter sessions ending at this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;
}
```

---

### Task 2 — ClockSessionService

**What:** Create `api/src/modules/time-clock/services/clock-session.service.ts`

**Constructor dependencies:**
- `PrismaService` (from `../../../core/database/prisma.service`)
- `GeofenceService` (from `./geofence.service`)
- `OvertimeService` (from `./overtime.service`)
- `LaborCostAttributionService` (from `./labor-cost-attribution.service`)
- `NotificationsService` (from `../../communication/services/notifications.service`)

**All injected via NestJS constructor injection.** Read each service file before using it to verify exact class names and method signatures.

---

#### Method: `clockIn(tenantId: string, userId: string, dto: ClockInDto)`

**Execution order — STOP on first failure. Do NOT proceed past a failing step.**

**Step 1 — Find employee profile:**
```
Find employee_profile where:
  user_id = userId
  AND tenant_id = tenantId
  AND is_active = true

If not found: throw NotFoundException("Employee profile not found or inactive")
```

**Step 2 — BR-001: Check for existing active session:**
```
Query clock_session where:
  employee_profile_id = found profile's id
  AND status IN ('active', 'on_break')
  AND tenant_id = tenantId

If found: throw ConflictException("You already have an active clock session. Please clock out first.")
```

**Step 3 — Load tenant settings:**
```
Call time-clock-settings service getSettings(tenantId)
The getSettings method MUST return defaults if no settings record exists for the tenant.
Store the result in a local variable `settings`.
```

**Step 4 — BR: require_job_tag enforcement:**
```
If settings.require_job_tag === true AND dto.project_id is null/undefined:
  throw BadRequestException("Project selection is required")
```

**Step 5 — BR: require_task_tag enforcement:**
```
If settings.require_task_tag === true AND dto.task_id is null/undefined:
  throw BadRequestException("Task selection is required")
```

**Step 6 — BR-004: GPS availability check:**
```
Initialize:
  let geofence_status = 'not_enforced'
  let is_flagged = false
  let flag_reason = null

If settings.gps_required === false:
  → geofence_status = 'not_enforced'
  → Skip geofence check entirely
  → No flag

If settings.gps_required === true AND (dto.latitude is null/undefined OR dto.longitude is null/undefined):
  If settings.gps_unavailable_action === 'block':
    → throw ForbiddenException("GPS location is required to clock in.")
  If settings.gps_unavailable_action === 'allow_flagged':
    → is_flagged = true
    → flag_reason = "GPS location unavailable — employee denied or browser blocked location access"
    → geofence_status = 'unavailable'
    → Skip geofence check (no coordinates to check against)
```

**Step 7 — BR-003: Geofence enforcement (only if GPS coordinates available AND clock_in_mode is NOT 'anywhere'):**
```
If GPS coordinates are available AND settings.clock_in_mode !== 'anywhere':
  Call GeofenceService.checkGeofence({
    tenantId,
    latitude: dto.latitude,
    longitude: dto.longitude,
    projectId: dto.project_id ?? null,
    clockInMode: settings.clock_in_mode,
  })

  Read the return value. Expected shape: { status: 'inside' | 'outside' | 'not_enforced', nearestAddressId?: string, distance?: number, reason?: string }

  If result.status === 'outside':
    If settings.geofence_violation_action === 'block':
      → Notify admins: type='timeclock_geofence_block', title='Clock-In Blocked',
        message='{employee name} was blocked from clocking in — outside all configured locations'
        (query users with Owner or Admin role for this tenant to get recipient IDs)
      → throw ForbiddenException("You are outside all configured clock-in locations")
      → Do NOT create the session

    If settings.geofence_violation_action === 'warn_only':
      → is_flagged = true
      → flag_reason = result.reason ?? "Outside all configured locations"
      → geofence_status = 'outside'
      → Notify admins: type='timeclock_geofence_warning', title='Geofence Warning',
        message='{employee name} clocked in outside configured locations'

  If result.status === 'inside':
    → geofence_status = 'inside'
    → Set clockin_address_id to result.nearestAddressId (if returned)

  If result.status === 'not_enforced':
    → geofence_status = 'not_enforced'
    → Proceed without flag
```

**Step 8 — BR-009: Shift auto-match:**
```
Query work_shift where:
  employee_profile_id = found profile's id
  AND status = 'scheduled'
  AND scheduled_start BETWEEN (now() - 2 hours) AND (now() + 2 hours)
  AND tenant_id = tenantId

If multiple results: pick the one where ABS(scheduled_start - now()) is smallest.

If match found:
  → Set work_shift_id = matched shift's id
  → Update work_shift: SET status = 'in_progress'

If no match:
  → work_shift_id = null

IMPORTANT: Shift matching is INFORMATIONAL only. It does NOT override the employee's
project_id or task_id selection from the DTO. The employee's explicit selection always wins.
```

**Step 9 — Create clock_session record:**
```
prisma.clock_session.create({
  data: {
    tenant_id: tenantId,
    employee_profile_id: profile.id,
    work_shift_id: work_shift_id ?? null,
    project_id: dto.project_id ?? null,
    task_id: dto.task_id ?? null,
    clockin_address_id: clockin_address_id ?? null,
    status: 'active',
    clock_in_at: new Date(),
    clock_in_latitude: dto.latitude ?? null,
    clock_in_longitude: dto.longitude ?? null,
    clock_in_location_source: dto.location_source ?? 'browser_gps',
    clock_in_geofence_status: geofence_status,
    is_flagged: is_flagged,
    flag_reason: flag_reason,
    notes: dto.notes ?? null,
  },
})
```

**Step 10 — Return with includes:**
```
Re-fetch the created session with includes:
  employee_profile: { include: { user: { select: { id, first_name, last_name } } } }
  project: { select: { id, name, project_number } }
  work_shift: true (or select relevant fields)

Return the session object.
```

---

#### Method: `clockOut(tenantId: string, userId: string, dto: ClockOutDto)`

**Step 1 — Find active or on_break session:**
```
Find employee_profile for userId + tenantId (is_active = true) → 404

Query clock_session where:
  employee_profile_id = profile.id
  AND status IN ('active', 'on_break')
  AND tenant_id = tenantId

If not found: throw NotFoundException("No active clock session found")
```

**Step 2 — Auto-end active break (if status is 'on_break'):**
```
If session.status === 'on_break':
  Find break_entry where:
    clock_session_id = session.id
    AND ended_at IS NULL
    AND tenant_id = tenantId

  If found:
    Set ended_at = new Date()
    Set duration_minutes = Math.floor((ended_at.getTime() - new Date(break_entry.started_at).getTime()) / 60000)
    If duration_minutes < 0: duration_minutes = 0
    Update break_entry with ended_at and duration_minutes
```

**Step 3 — Set clock-out time and GPS:**
```
clock_out_at = new Date()
Store dto.latitude, dto.longitude, dto.location_source if provided.
No geofence enforcement at clock-out in Phase 1.
```

**Step 4 — BR-004B: Calculate total_worked_minutes:**
```
Fetch all break_entries for this session where break_type = 'unpaid' AND duration_minutes IS NOT NULL.
Sum their duration_minutes → unpaid_break_minutes.

total_worked_minutes = Math.floor(
  (clock_out_at.getTime() - new Date(session.clock_in_at).getTime()) / 60000
) - unpaid_break_minutes

If total_worked_minutes < 0: total_worked_minutes = 0

NOTE: Paid breaks are NOT subtracted. Only unpaid breaks reduce worked time.
```

**Step 5 — BR-006: Calculate overtime:**
```
await OvertimeService.calculateOvertime({
  tenantId,
  employeeProfileId: session.employee_profile_id,
  sessionId: session.id,
  totalWorkedMinutes: total_worked_minutes,
  clockInAt: session.clock_in_at,
})

Returns: { regular_minutes, overtime_minutes }
```

**Step 6 — BR-004C: Update matched work shift (if applicable):**
```
If session.work_shift_id is not null:
  Update work_shift: SET status = 'completed'
```

**Step 7 — BR-005: Post labor cost (non-blocking):**
```
try {
  await LaborCostAttributionService.postLaborCost({
    tenantId,
    sessionId: session.id,
    employeeProfileId: session.employee_profile_id,
    projectId: session.project_id,
    taskId: session.task_id,
    totalWorkedMinutes: total_worked_minutes,
    regularMinutes: regular_minutes,
    overtimeMinutes: overtime_minutes,
    clockInAt: session.clock_in_at,
  })
} catch (error) {
  // Log error but do NOT fail the clock-out
  console.error('Labor cost attribution failed:', error.message);
}
```

**Step 8 — Update session to completed:**
```
prisma.clock_session.update({
  where: { id: session.id },
  data: {
    status: 'completed',
    clock_out_at,
    clock_out_latitude: dto.latitude ?? null,
    clock_out_longitude: dto.longitude ?? null,
    clock_out_location_source: dto.location_source ?? 'browser_gps',
    total_worked_minutes,
    regular_minutes,
    overtime_minutes,
  },
})
```

**Step 9 — Return completed session:**
```
Re-fetch session with includes (employee_profile, project, work_shift, break_entries).
Return the session object.
```

---

#### Method: `findAll(tenantId: string, query: ListClockSessionsDto)`

**Logic:**
1. Build `where` clause: `{ tenant_id: tenantId }`
2. Apply optional filters:
   - `employee_profile_id` if provided
   - `project_id` if provided
   - `status` if provided
   - `date_from`: `clock_in_at: { gte: new Date(date_from) }`
   - `date_to`: `clock_in_at: { lte: new Date(date_to) }` (combine with gte if both present)
   - `is_flagged` if provided (boolean)
   - `is_manual_edit` if provided (boolean)
3. Count total matching records.
4. Fetch paginated results with `skip` and `take` (default page=1, limit=20).
5. Include: `employee_profile` with `user` (id, first_name, last_name), `project` (id, name), `task` (id, title), `work_shift` (id, scheduled_start, scheduled_end).
6. Order by `clock_in_at DESC`.
7. Return `{ data: [...], meta: { total, page, limit, totalPages } }`.

---

#### Method: `findMyActive(tenantId: string, userId: string)`

**Logic:**
1. Find employee_profile for userId + tenantId → 404 if not found.
2. Query clock_session where `employee_profile_id` AND `status IN ('active', 'on_break')` AND `tenant_id`.
3. If found: include `project`, `task`, `work_shift`, `clockin_address`, `break_entries` (where `ended_at IS NULL` for active break).
4. If not found: return `{ data: null }` (do NOT throw 404 — absence of active session is valid state).

---

#### Method: `findAvailableProjects(tenantId: string, userId: string)` — BR-015

**Logic:**
1. Find employee_profile for userId + tenantId → 404 if not found.
2. Load settings via `getSettings(tenantId)`.
3. Determine project list based on `settings.clock_in_mode`:

   **If `clock_in_mode` is `'anywhere'` OR `'specific_addresses'`:**
   - Return ALL projects where `tenant_id = tenantId` AND `status IN ('planned', 'in_progress')`.

   **If `clock_in_mode` is `'active_job_sites'`:**
   - Query projects from `employee_project_assignment` where `employee_profile_id = profile.id` AND `tenant_id = tenantId`. Get list of project IDs.
   - Query projects from `task_assignee` (join through `project_task`):
     - Find `task_assignee` records where `user_id = userId` OR `crew_member_id = profile.crew_member_id` (if crew_member_id is not null).
     - Join `task_assignee.task_id` → `project_task.id` → get `project_task.project_id`.
   - UNION both sets of project IDs (deduplicate).
   - Fetch projects by those IDs where `status IN ('planned', 'in_progress')`.

4. Select only: `{ id, name, project_number }`.
5. Return `{ data: [...] }`.

---

#### Method: `findMine(tenantId: string, userId: string, query: ListMyClockSessionsDto)`

**Logic:**
1. Find employee_profile for userId + tenantId → 404 if not found.
2. Build where clause: `{ tenant_id: tenantId, employee_profile_id: profile.id }`.
3. Apply optional filters: `status`, `date_from`, `date_to`, `project_id`.
4. Count total.
5. Fetch paginated with includes: `project` (id, name), `task` (id, title), `work_shift`.
6. Order by `clock_in_at DESC`.
7. Return `{ data: [...], meta: { total, page, limit, totalPages } }`.

---

#### Method: `findAllActive(tenantId: string)`

**Logic:**
1. Query clock_session where `tenant_id = tenantId` AND `status IN ('active', 'on_break')`.
2. Include: `employee_profile` with `user` (id, first_name, last_name), `project` (id, name), `task` (id, title), `clockin_address` (label).
3. Order by `clock_in_at ASC`.
4. Count total.
5. Return `{ data: [...], total: count }`.

---

#### Method: `findOne(tenantId: string, sessionId: string)`

**Logic:**
1. Find clock_session where `id = sessionId` AND `tenant_id = tenantId`.
2. If not found: throw NotFoundException("Clock session not found").
3. Include: `employee_profile` with `user`, `project`, `task`, `work_shift`, `clockin_address`, `break_entries` (ordered by `started_at ASC`), `clock_session_edit_log` (ordered by `edited_at DESC`), `time_dispute` (ordered by `created_at DESC`).
4. Return the full session object.

---

### Task 3 — ClockSessionController

**What:** Create `api/src/modules/time-clock/controllers/clock-session.controller.ts`

**Controller decorator:**
```typescript
@ApiTags('Time Clock - Sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('time-clock/sessions')
```

**CRITICAL — Route order matters.** NestJS matches routes top-to-bottom. Static segments MUST come before parameterized segments. Declare endpoints in this exact order:

1. `POST /clock-in` — `clockIn()`
2. `POST /clock-out` — `clockOut()`
3. `GET /me/active` — `findMyActive()`
4. `GET /me/available-projects` — `findAvailableProjects()`
5. `GET /mine` — `findMine()`
6. `GET /active/all` — `findAllActive()`
7. `GET /` — `findAll()` (the list endpoint)
8. `GET /:id` — `findOne()` (MUST be LAST — otherwise it captures 'clock-in', 'mine', etc.)

**Endpoint Specifications:**

#### Endpoint 1: POST /sessions/clock-in
```
@Post('clock-in')
@Roles('Owner', 'Admin', 'Project Manager', 'Employee')
@ApiOperation({ summary: 'Clock in — start a new work session' })

Parameters:
  @TenantId() tenantId: string
  @CurrentUser() user: { id: string; roles: string[] }
  @Body() dto: ClockInDto

Calls: ClockSessionService.clockIn(tenantId, user.id, dto)
Returns: 201 with created session
Errors: 404 (no profile), 409 (already active), 400 (missing project/task), 403 (GPS/geofence block)
```

#### Endpoint 2: POST /sessions/clock-out
```
@Post('clock-out')
@Roles('Owner', 'Admin', 'Project Manager', 'Employee')
@ApiOperation({ summary: 'Clock out — end the active session' })

Parameters:
  @TenantId() tenantId: string
  @CurrentUser() user: { id: string }
  @Body() dto: ClockOutDto

Calls: ClockSessionService.clockOut(tenantId, user.id, dto)
Returns: 200 with completed session
Errors: 404 (no active session)
```

#### Endpoint 3: GET /sessions/me/active
```
@Get('me/active')
@Roles('Owner', 'Admin', 'Project Manager', 'Employee')
@ApiOperation({ summary: 'Get my current active session (or null)' })

Parameters:
  @TenantId() tenantId: string
  @CurrentUser() user: { id: string }

Calls: ClockSessionService.findMyActive(tenantId, user.id)
Returns: 200 with { data: session | null }
Errors: 404 (no employee profile)
```

#### Endpoint 4: GET /sessions/me/available-projects
```
@Get('me/available-projects')
@Roles('Owner', 'Admin', 'Project Manager', 'Employee')
@ApiOperation({ summary: 'Get projects available for clock-in (BR-015)' })

Parameters:
  @TenantId() tenantId: string
  @CurrentUser() user: { id: string }

Calls: ClockSessionService.findAvailableProjects(tenantId, user.id)
Returns: 200 with { data: [{ id, name, project_number }] }
Errors: 404 (no employee profile)
```

#### Endpoint 5: GET /sessions/mine
```
@Get('mine')
@Roles('Owner', 'Admin', 'Project Manager', 'Employee')
@ApiOperation({ summary: 'Get my clock session history (paginated)' })

Parameters:
  @TenantId() tenantId: string
  @CurrentUser() user: { id: string }
  @Query() query: ListMyClockSessionsDto

Calls: ClockSessionService.findMine(tenantId, user.id, query)
Returns: 200 with { data: [...], meta: { total, page, limit, totalPages } }
```

#### Endpoint 6: GET /sessions/active/all
```
@Get('active/all')
@Roles('Owner', 'Admin', 'Project Manager')
@ApiOperation({ summary: 'Get all currently active sessions across the tenant' })

Parameters:
  @TenantId() tenantId: string

Calls: ClockSessionService.findAllActive(tenantId)
Returns: 200 with { data: [...], total: number }
```

#### Endpoint 7: GET /sessions
```
@Get()
@Roles('Owner', 'Admin', 'Project Manager', 'Bookkeeper')
@ApiOperation({ summary: 'List all clock sessions (paginated, filtered)' })

Parameters:
  @TenantId() tenantId: string
  @Query() query: ListClockSessionsDto

Calls: ClockSessionService.findAll(tenantId, query)
Returns: 200 with { data: [...], meta: { total, page, limit, totalPages } }
```

#### Endpoint 8: GET /sessions/:id
```
@Get(':id')
@Roles('Owner', 'Admin', 'Project Manager', 'Bookkeeper')
@ApiOperation({ summary: 'Get clock session full detail with breaks, edits, disputes' })
@ApiParam({ name: 'id', type: 'string' })

Parameters:
  @TenantId() tenantId: string
  @Param('id') id: string

Calls: ClockSessionService.findOne(tenantId, id)
Returns: 200 with full session object
Errors: 404 (not found)
```

---

### Task 4 — Register in Module

**What:** Open `api/src/modules/time-clock/time-clock.module.ts` and:
1. Import `ClockSessionService` into the `providers` array.
2. Import `ClockSessionController` into the `controllers` array.
3. Ensure all dependencies are imported: `GeofenceService`, `OvertimeService`, `LaborCostAttributionService`, `NotificationsService`.
4. If `CommunicationModule` or `NotificationsService` is from another module, ensure that module is imported via `imports` array.
5. Verify the module compiles without errors.

---

### Task 5 — Admin Notification Helper

**What:** Implement a private helper method in `ClockSessionService` for sending notifications to tenant admins.

```typescript
private async notifyAdmins(
  tenantId: string,
  type: string,
  title: string,
  message: string,
  actionUrl?: string,
): Promise<void> {
  // Query users with Owner or Admin role in this tenant
  // For each admin user, call NotificationsService.createNotification()
  // Wrap in try/catch — notification failure must NEVER block clock-in/out
}
```

**Notification types used in this sprint:**
- `timeclock_geofence_block` — sent when an employee is blocked from clocking in due to geofence
- `timeclock_geofence_warning` — sent when an employee clocks in outside geofence (warn_only mode)
- `timeclock_gps_unavailable` — sent when an employee clocks in without GPS (allow_flagged mode)

All notifications go to all users with `Owner` or `Admin` role within the tenant.

---

### Task 6 — End-to-End Testing

**What:** Test all 8 endpoints manually using curl or an HTTP client.

**Test sequence (must be run in order):**

```bash
# 1. Login to get JWT token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

# 2. Check available projects (should return project list)
curl -s http://localhost:8000/api/v1/time-clock/sessions/me/available-projects \
  -H "Authorization: Bearer $TOKEN" | jq .

# 3. Check active session (should be null)
curl -s http://localhost:8000/api/v1/time-clock/sessions/me/active \
  -H "Authorization: Bearer $TOKEN" | jq .

# 4. Clock in (with GPS coordinates)
curl -s -X POST http://localhost:8000/api/v1/time-clock/sessions/clock-in \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"latitude":40.7128,"longitude":-74.006,"location_source":"browser_gps"}' | jq .

# 5. Verify active session is now present
curl -s http://localhost:8000/api/v1/time-clock/sessions/me/active \
  -H "Authorization: Bearer $TOKEN" | jq .

# 6. Try to clock in again (should return 409)
curl -s -X POST http://localhost:8000/api/v1/time-clock/sessions/clock-in \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"latitude":40.7128,"longitude":-74.006}' | jq .

# 7. Clock out
curl -s -X POST http://localhost:8000/api/v1/time-clock/sessions/clock-out \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"latitude":40.7128,"longitude":-74.006}' | jq .

# 8. Verify session is completed (list mine)
curl -s "http://localhost:8000/api/v1/time-clock/sessions/mine?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 9. Get all sessions (admin view)
curl -s "http://localhost:8000/api/v1/time-clock/sessions?limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 10. Get all active sessions
curl -s http://localhost:8000/api/v1/time-clock/sessions/active/all \
  -H "Authorization: Bearer $TOKEN" | jq .

# 11. Get session detail by ID (use an ID from step 9)
curl -s http://localhost:8000/api/v1/time-clock/sessions/{SESSION_ID} \
  -H "Authorization: Bearer $TOKEN" | jq .
```

**Expected results:**
- Step 2: 200 with array of projects
- Step 3: 200 with `{ data: null }`
- Step 4: 201 with created session (status='active')
- Step 5: 200 with the active session
- Step 6: 409 with conflict error message
- Step 7: 200 with completed session (total_worked_minutes, regular_minutes, overtime_minutes populated)
- Step 8: 200 with paginated list including the completed session
- Step 9: 200 with paginated admin list
- Step 10: 200 with `{ data: [], total: 0 }` (no active sessions now)
- Step 11: 200 with full session detail including break_entries, edit_logs, disputes

---

## Acceptance Criteria

- [ ] `ClockInDto`, `ClockOutDto`, `ListClockSessionsDto`, `ListMyClockSessionsDto` DTOs exist with all validators
- [ ] `ClockSessionService` implements all 8 methods: `clockIn`, `clockOut`, `findAll`, `findMyActive`, `findAvailableProjects`, `findMine`, `findAllActive`, `findOne`
- [ ] `clockIn` enforces BR-001 (one active session), BR-003 (geofence), BR-004 (GPS), BR-009 (shift match)
- [ ] `clockIn` respects `require_job_tag` and `require_task_tag` settings
- [ ] `clockOut` auto-ends active breaks
- [ ] `clockOut` calculates `total_worked_minutes` correctly (subtracts unpaid breaks only)
- [ ] `clockOut` calls `OvertimeService.calculateOvertime()` and stores results
- [ ] `clockOut` calls `LaborCostAttributionService.postLaborCost()` non-blocking (try/catch)
- [ ] `clockOut` updates matched work_shift status to 'completed'
- [ ] `findAvailableProjects` respects `clock_in_mode` settings (BR-015)
- [ ] All 8 endpoints respond with correct status codes
- [ ] Route order in controller prevents `:id` from capturing static segments
- [ ] All Prisma queries include `tenant_id` filter
- [ ] Admin notifications sent for geofence blocks, warnings, GPS unavailable
- [ ] Module compiles without errors
- [ ] All endpoints tested manually and return expected responses
- [ ] Dev server is shut down after testing

---

## Gate Marker

**STOP** — This sprint is the core of the time-clock module. All 8 endpoints must respond correctly:
1. Clock-in creates a session with correct status, GPS, geofence evaluation
2. Clock-out completes the session with correct time calculations and overtime
3. BR-001 (duplicate session) returns 409
4. BR-003 (geofence block) returns 403
5. BR-004 (GPS block) returns 403
6. Available projects respects clock_in_mode
7. List endpoints return paginated results with correct filters
8. Session detail includes breaks, edit_logs, and disputes

Do NOT proceed to Sprint 10 until all 8 endpoints are verified working.

---

## Handoff Notes

**For Sprint 10 (Break Endpoints):**
- The `ClockSessionService` is now available and can be imported.
- Break auto-end logic is already handled in `clockOut()` — Sprint 10 adds explicit start/end/list break endpoints.
- The `break_entry` Prisma model is already in the schema from Sprint 1.
- The `StartBreakDto` pattern is similar to the DTOs in this sprint.

**For Sprint 11 (Manual Edit):**
- The `GET /sessions/:id` endpoint already includes `clock_session_edit_log` in its response.
- The `PATCH /sessions/:id` endpoint should be declared in this controller but wired to `ClockSessionEditService` (built in Sprint 11).
