# Sprint 4 — Employee Profile DTOs + Service + Controller
**Module:** time-clock
**File:** ./documentation/sprints/clockin_backend/sprint_4.md
**Type:** Backend — CRUD
**Depends On:** Sprint 3
**Gate:** STOP — All 7 endpoints must return correct responses before Sprint 5 begins.
**Estimated Complexity:** Medium

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

Implement the complete Employee Profile CRUD (7 endpoints) including auto-link to crew_member, kiosk PIN management (bcrypt), push subscription save, and audit logging. Replace the stub service and controller from Sprint 2 with full implementations.

---

## Pre-Sprint Checklist
- [ ] Verify Sprint 3 is complete (settings endpoints working)
- [ ] Read `api/src/modules/time-clock/time-clock.module.ts` — understand current module structure
- [ ] Read `api/src/modules/time-clock/services/time-clock-settings.service.ts` — understand service pattern used in Sprint 3
- [ ] Read `api/prisma/schema.prisma` — verify `employee_profile` model exists with all fields
- [ ] Read `api/src/modules/audit/services/audit-logger.service.ts` — exact `logTenantChange()` signature

---

## Tasks

### Task 1 — Create Employee Profile DTOs

**What:** Create `api/src/modules/time-clock/dto/employee-profile.dto.ts` with these 5 DTOs:

#### ListEmployeeProfilesDto (query params):

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsString, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class ListEmployeeProfilesDto {
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

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Search by user name or email' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
```

#### CreateEmployeeProfileDto:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsNumber, IsBoolean, Min, Max } from 'class-validator';

export class CreateEmployeeProfileDto {
  @ApiProperty({ description: 'User ID to create profile for' })
  @IsString()
  @IsUUID()
  user_id: string;

  @ApiPropertyOptional({ description: 'Crew member ID for labor cost linkage' })
  @IsOptional()
  @IsString()
  @IsUUID()
  crew_member_id?: string;

  @ApiPropertyOptional({ description: 'Override hourly rate', example: 25.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hourly_rate?: number;

  @ApiPropertyOptional({ description: 'Use employee-level overtime thresholds' })
  @IsOptional()
  @IsBoolean()
  overtime_rule_override?: boolean;

  @ApiPropertyOptional({ description: 'Employee daily OT threshold', example: 8.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  overtime_daily_threshold_hours?: number;

  @ApiPropertyOptional({ description: 'Employee weekly OT threshold', example: 40.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(168)
  overtime_weekly_threshold_hours?: number;
}
```

#### UpdateEmployeeProfileDto:

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsNumber, IsBoolean, Min, Max } from 'class-validator';

export class UpdateEmployeeProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  crew_member_id?: string;

  @ApiPropertyOptional({ example: 30.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hourly_rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  overtime_rule_override?: boolean;

  @ApiPropertyOptional({ example: 8.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  overtime_daily_threshold_hours?: number;

  @ApiPropertyOptional({ example: 40.00 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(168)
  overtime_weekly_threshold_hours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
```

**NOTE:** `UpdateEmployeeProfileDto` does NOT include `user_id` — the user association cannot be changed after creation.

#### SetEmployeePinDto:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class SetEmployeePinDto {
  @ApiProperty({ description: 'Kiosk PIN (4-6 digits)', example: '1234' })
  @IsString()
  @MinLength(4)
  @MaxLength(6)
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4-6 digits' })
  pin: string;
}
```

#### SavePushSubscriptionDto:

```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class SavePushSubscriptionDto {
  @ApiProperty({ description: 'Web Push subscription JSON' })
  @IsString()
  @IsNotEmpty()
  push_subscription_json: string;
}
```

**Acceptance:** All 5 DTOs compile with full validation decorators.

---

### Task 2 — Implement EmployeeProfileService

**What:** Replace the stub `api/src/modules/time-clock/services/employee-profile.service.ts` with full implementation.

**Constructor dependencies:**
- `PrismaService` (from `../../core/database/prisma.service` — verify exact import path)
- `AuditLoggerService` (from `../../audit/services/audit-logger.service` — verify exact import path)

**Methods (7 total):**

#### 1. `findAll(tenantId: string, query: ListEmployeeProfilesDto)`

- Default page=1, limit=20
- Base filter: `{ tenant_id: tenantId }`
- If `query.is_active` is provided (not undefined): add `is_active` to filter
- If `query.search` is provided: add OR condition matching against `user.first_name`, `user.last_name`, or `user.email` using `contains` (case-insensitive mode: `mode: 'insensitive'`)
- Include:
  ```typescript
  {
    user: { select: { id: true, first_name: true, last_name: true, email: true } },
    crew_member: { select: { id: true, first_name: true, last_name: true, default_hourly_rate: true } },
  }
  ```
- **NEVER return** `kiosk_pin_hash` or `push_subscription_json` in list responses. Use Prisma `select` to explicitly pick fields, or use `omit` if available, or map results to strip these fields.
- Paginate: `{ skip: (page - 1) * limit, take: limit }`
- Count: `prisma.employee_profile.count({ where: filter })`
- Return:
  ```typescript
  {
    data: [...],
    meta: {
      total: count,
      page: page,
      limit: limit,
      totalPages: Math.ceil(count / limit),
    },
  }
  ```

#### 2. `create(tenantId: string, userId: string, dto: CreateEmployeeProfileDto)`

- **Step 1:** Validate `dto.user_id` belongs to tenant — query `user_tenant_membership` where `user_id = dto.user_id AND tenant_id = tenantId AND status = 'ACTIVE'` (enum value is uppercase `ACTIVE`, not lowercase). If not found: throw `NotFoundException('User not found in this tenant')`
- **Step 2:** Check uniqueness — query `employee_profile` where `tenant_id = tenantId AND user_id = dto.user_id`. If found: throw `ConflictException('Employee profile already exists for this user')`
- **Step 3:** If `dto.crew_member_id` is provided, validate it belongs to tenant — query `crew_member` where `id = dto.crew_member_id AND tenant_id = tenantId`. If not found: throw `NotFoundException('Crew member not found')`
- **Step 4 (BR-013 Auto-link):** If `dto.crew_member_id` is NOT provided, attempt auto-link — query `crew_member` where `user_id = dto.user_id AND tenant_id = tenantId`. If found, auto-set `crew_member_id` to this crew member's ID.
- **Step 5:** Create record:
  ```typescript
  prisma.employee_profile.create({
    data: {
      tenant_id: tenantId,
      user_id: dto.user_id,
      crew_member_id: resolvedCrewMemberId, // from step 3 or 4
      hourly_rate: dto.hourly_rate,
      overtime_rule_override: dto.overtime_rule_override,
      overtime_daily_threshold_hours: dto.overtime_daily_threshold_hours,
      overtime_weekly_threshold_hours: dto.overtime_weekly_threshold_hours,
    },
    include: {
      user: { select: { id: true, first_name: true, last_name: true, email: true } },
      crew_member: { select: { id: true, first_name: true, last_name: true, default_hourly_rate: true } },
    },
  })
  ```
- **Step 6:** Audit log:
  ```typescript
  this.auditLoggerService.logTenantChange({
    action: 'created',
    entityType: 'employee_profile',
    entityId: result.id,
    tenantId,
    actorUserId: userId,
    after: result,
    description: 'Created employee profile',
  });
  ```
- Return created record with user and crew_member includes

#### 3. `findOne(tenantId: string, id: string)`

- Query: `prisma.employee_profile.findFirst({ where: { id, tenant_id: tenantId } })`
- Include: user (select: id, first_name, last_name, email), crew_member (select: id, first_name, last_name, default_hourly_rate), project_assignments (include: { project: { select: { id, name, status } } })
- If not found: throw `NotFoundException('Employee profile not found')`
- **Exclude** `kiosk_pin_hash` and `push_subscription_json` from response
- Return record

#### 4. `update(tenantId: string, userId: string, id: string, dto: UpdateEmployeeProfileDto)`

- Find existing: `prisma.employee_profile.findFirst({ where: { id, tenant_id: tenantId } })` — throw 404 if not found
- If `dto.crew_member_id` is provided: validate it belongs to tenant — query `crew_member` where `id = dto.crew_member_id AND tenant_id = tenantId`. If not found: throw `NotFoundException('Crew member not found')`
- Update: `prisma.employee_profile.update({ where: { id }, data: { ...dto } })`
- Audit log:
  ```typescript
  this.auditLoggerService.logTenantChange({
    action: 'updated',
    entityType: 'employee_profile',
    entityId: id,
    tenantId,
    actorUserId: userId,
    before: existing,
    after: updated,
    description: 'Updated employee profile',
  });
  ```
- Return updated record (with user and crew_member includes, excluding sensitive fields)

#### 5. `setPin(tenantId: string, userId: string, id: string, dto: SetEmployeePinDto)`

- Find existing: throw 404 if not found
- Hash PIN with bcrypt (12 rounds): `const hash = await bcrypt.hash(dto.pin, 12)`
  - Import: `import * as bcrypt from 'bcrypt';`
- Update:
  ```typescript
  prisma.employee_profile.update({
    where: { id },
    data: {
      kiosk_pin_hash: hash,
      kiosk_pin_failed_attempts: 0,
      kiosk_pin_locked_until: null,
    },
  })
  ```
- Audit log:
  ```typescript
  this.auditLoggerService.logTenantChange({
    action: 'updated',
    entityType: 'employee_profile',
    entityId: id,
    tenantId,
    actorUserId: userId,
    description: 'Updated kiosk PIN for employee',
  });
  ```
- Return `{ message: 'PIN updated successfully' }`

**CRITICAL:** Never log the PIN value (plaintext or hash) in the audit log. The `before`/`after` fields are intentionally omitted.

#### 6. `removePin(tenantId: string, userId: string, id: string)`

- Find existing: throw 404 if not found
- Update:
  ```typescript
  prisma.employee_profile.update({
    where: { id },
    data: {
      kiosk_pin_hash: null,
      kiosk_pin_failed_attempts: 0,
      kiosk_pin_locked_until: null,
    },
  })
  ```
- Audit log:
  ```typescript
  this.auditLoggerService.logTenantChange({
    action: 'updated',
    entityType: 'employee_profile',
    entityId: id,
    tenantId,
    actorUserId: userId,
    description: 'Removed kiosk PIN for employee',
  });
  ```
- Return `{ message: 'PIN removed successfully' }`

#### 7. `savePushSubscription(tenantId: string, userId: string, dto: SavePushSubscriptionDto)`

- Find employee_profile where `user_id = userId AND tenant_id = tenantId` (NOT by profile ID — by the current user's ID)
- If not found: throw `NotFoundException('No employee profile found for current user')`
- Update: `prisma.employee_profile.update({ where: { id: profile.id }, data: { push_subscription_json: dto.push_subscription_json } })`
- Return `{ message: 'Push subscription saved' }`

**Acceptance:** All 7 methods implemented with full tenant isolation and audit logging.

---

### Task 3 — Implement EmployeeProfileController

**What:** Replace the stub `api/src/modules/time-clock/controllers/employee-profile.controller.ts` with full implementation:

```typescript
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { Roles } from '../../rbac/decorators/roles.decorator';
import { EmployeeProfileService } from '../services/employee-profile.service';
import {
  ListEmployeeProfilesDto,
  CreateEmployeeProfileDto,
  UpdateEmployeeProfileDto,
  SetEmployeePinDto,
  SavePushSubscriptionDto,
} from '../dto/employee-profile.dto';

@ApiTags('Time Clock')
@ApiBearerAuth()
@Controller('time-clock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeeProfileController {
  constructor(private readonly employeeProfileService: EmployeeProfileService) {}

  // ─── IMPORTANT: /employees/me/* routes MUST come BEFORE /:id routes ───

  @Post('employees/me/push-subscription')
  @Roles('Owner', 'Admin', 'Project Manager', 'Employee')
  @ApiOperation({ summary: 'Save web push subscription for current user' })
  @ApiResponse({ status: 201, description: 'Push subscription saved' })
  async savePushSubscription(@Request() req, @Body() dto: SavePushSubscriptionDto) {
    return this.employeeProfileService.savePushSubscription(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Get('employees')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'List employee profiles' })
  @ApiResponse({ status: 200, description: 'Paginated employee profiles' })
  async findAll(@Request() req, @Query() query: ListEmployeeProfilesDto) {
    return this.employeeProfileService.findAll(req.user.tenant_id, query);
  }

  @Post('employees')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Create employee profile' })
  @ApiResponse({ status: 201, description: 'Employee profile created' })
  @ApiResponse({ status: 409, description: 'Profile already exists for this user' })
  async create(@Request() req, @Body() dto: CreateEmployeeProfileDto) {
    return this.employeeProfileService.create(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Get('employees/:id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Get employee profile detail' })
  @ApiResponse({ status: 200, description: 'Employee profile detail' })
  @ApiResponse({ status: 404, description: 'Employee profile not found' })
  async findOne(@Request() req, @Param('id') id: string) {
    return this.employeeProfileService.findOne(req.user.tenant_id, id);
  }

  @Patch('employees/:id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Update employee profile' })
  @ApiResponse({ status: 200, description: 'Employee profile updated' })
  @ApiResponse({ status: 404, description: 'Employee profile not found' })
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeProfileDto,
  ) {
    return this.employeeProfileService.update(
      req.user.tenant_id,
      req.user.id,
      id,
      dto,
    );
  }

  @Post('employees/:id/pin')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Set employee kiosk PIN' })
  @ApiResponse({ status: 201, description: 'PIN updated successfully' })
  @ApiResponse({ status: 404, description: 'Employee profile not found' })
  async setPin(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: SetEmployeePinDto,
  ) {
    return this.employeeProfileService.setPin(
      req.user.tenant_id,
      req.user.id,
      id,
      dto,
    );
  }

  @Delete('employees/:id/pin')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Remove employee kiosk PIN' })
  @ApiResponse({ status: 200, description: 'PIN removed successfully' })
  @ApiResponse({ status: 404, description: 'Employee profile not found' })
  async removePin(@Request() req, @Param('id') id: string) {
    return this.employeeProfileService.removePin(
      req.user.tenant_id,
      req.user.id,
      id,
    );
  }
}
```

**CRITICAL ROUTE ORDER:** The `/employees/me/push-subscription` route MUST be defined BEFORE any `/:id` routes in the controller class. NestJS evaluates routes top-to-bottom, and without this ordering, `"me"` would be interpreted as an `:id` parameter value, causing a 404 or incorrect behavior.

**Roles Summary:**
| Endpoint | Roles |
|---|---|
| POST /employees/me/push-subscription | Owner, Admin, Project Manager, Employee |
| GET /employees | Owner, Admin |
| POST /employees | Owner, Admin |
| GET /employees/:id | Owner, Admin |
| PATCH /employees/:id | Owner, Admin |
| POST /employees/:id/pin | Owner, Admin |
| DELETE /employees/:id/pin | Owner, Admin |

**Acceptance:** All 7 endpoints respond correctly.

---

### Task 4 — Update Module Registration

**What:** Update `api/src/modules/time-clock/time-clock.module.ts` to ensure the real `EmployeeProfileService` and `EmployeeProfileController` are imported correctly (they should already be registered from Sprint 2, but verify the imports point to the updated files with real implementations).

**Acceptance:** Module compiles with no errors.

---

### Task 5 — Verify All 7 Endpoints

**What:** Start dev server and test all 7 endpoints with curl.

**Login to get JWT:**
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r .access_token)
```

**Test 1 — List employees (empty initially):**
```bash
curl -s http://localhost:8000/api/v1/time-clock/employees \
  -H "Authorization: Bearer $TOKEN" | jq .
```
Expected: `{ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } }`

**Test 2 — Create employee profile:**
First, get a valid user ID from the tenant:
```bash
# Use the user ID from the JWT token payload, or query users
curl -s -X POST http://localhost:8000/api/v1/time-clock/employees \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"<VALID_USER_UUID>"}' | jq .
```
Expected: Created profile with auto-linked `crew_member` (if exists). Status 201.

**Test 3 — Create duplicate (should fail):**
```bash
curl -s -X POST http://localhost:8000/api/v1/time-clock/employees \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"<SAME_USER_UUID>"}' | jq .
```
Expected: 409 Conflict — `"Employee profile already exists for this user"`

**Test 4 — Get employee profile detail:**
```bash
curl -s http://localhost:8000/api/v1/time-clock/employees/<PROFILE_UUID> \
  -H "Authorization: Bearer $TOKEN" | jq .
```
Expected: Full profile with user, crew_member, project_assignments. No `kiosk_pin_hash` or `push_subscription_json`.

**Test 5 — Update employee profile:**
```bash
curl -s -X PATCH http://localhost:8000/api/v1/time-clock/employees/<PROFILE_UUID> \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"hourly_rate":35.00,"is_active":true}' | jq .
```
Expected: Updated profile with `hourly_rate: "35.00"`.

**Test 6 — Set PIN:**
```bash
curl -s -X POST http://localhost:8000/api/v1/time-clock/employees/<PROFILE_UUID>/pin \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"pin":"1234"}' | jq .
```
Expected: `{ "message": "PIN updated successfully" }`

**Test 7 — Remove PIN:**
```bash
curl -s -X DELETE http://localhost:8000/api/v1/time-clock/employees/<PROFILE_UUID>/pin \
  -H "Authorization: Bearer $TOKEN" | jq .
```
Expected: `{ "message": "PIN removed successfully" }`

**Test 8 — Save push subscription:**
```bash
curl -s -X POST http://localhost:8000/api/v1/time-clock/employees/me/push-subscription \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"push_subscription_json":"{\"endpoint\":\"https://fcm.googleapis.com/test\"}"}' | jq .
```
Expected: `{ "message": "Push subscription saved" }`

**Test 9 — List employees (with search):**
```bash
curl -s "http://localhost:8000/api/v1/time-clock/employees?search=honey&page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq .
```
Expected: Paginated results filtered by search term. No `kiosk_pin_hash` or `push_subscription_json` in any item.

**Test credentials:**
- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant user: `contact@honeydo4you.com` / `978@F32c`

**Acceptance:** All 7 endpoints return correct responses. Auto-link works. Duplicate returns 409. PIN is hashed. Sensitive fields excluded.

---

## Business Rules Enforced in This Sprint

- **BR-013**: Employee profile lifecycle:
  - Auto-link `crew_member` when `crew_member_id` is not provided but a matching `crew_member` exists for the user
  - Reject duplicate `user_id` per tenant with 409 Conflict
  - Validate user belongs to tenant via `user_tenant_membership`

---

## Integration Points
- `PrismaService` — `api/src/core/database/prisma.service.ts`
- `AuditLoggerService` — `api/src/modules/audit/services/audit-logger.service.ts`
  - Method: `logTenantChange({ action, entityType: 'employee_profile', entityId, tenantId, actorUserId, before?, after?, description })`
- `bcrypt` — for PIN hashing (12 rounds)

---

## Acceptance Criteria
- [ ] All 5 DTOs created with full validation decorators
- [ ] `EmployeeProfileService` with 7 methods (findAll, create, findOne, update, setPin, removePin, savePushSubscription)
- [ ] `EmployeeProfileController` with 7 endpoints
- [ ] `/employees/me/push-subscription` route defined BEFORE `/:id` routes
- [ ] Auto-link crew_member when not provided (BR-013)
- [ ] Duplicate `user_id` per tenant returns 409 Conflict
- [ ] User validated against `user_tenant_membership` (active status)
- [ ] PIN hashed with bcrypt (12 rounds)
- [ ] PIN value NEVER logged in audit trail
- [ ] `kiosk_pin_hash` and `push_subscription_json` NEVER returned in list or detail responses
- [ ] Push subscription endpoint accessible by Owner, Admin, Project Manager, Employee
- [ ] All other endpoints restricted to Owner, Admin only
- [ ] Audit logs for create, update, PIN set, PIN remove
- [ ] All Prisma queries include `tenant_id` filter
- [ ] Pagination with `{ data, meta: { total, page, limit, totalPages } }` format
- [ ] Search by user first_name, last_name, or email (case-insensitive)
- [ ] `npm run lint` passes
- [ ] No frontend code modified
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — Before Sprint 5 begins, verify:
1. All 7 endpoints return correct responses
2. Auto-link crew_member works (BR-013)
3. Duplicate user_id returns 409
4. PIN is hashed (not stored in plaintext)
5. Sensitive fields excluded from responses
6. Push subscription saves for current user
7. Audit logs recorded for all write operations
8. `npm run lint` passes

---

## Handoff Notes
- `EmployeeProfileService` is used by Sprint 5 (`ClockSessionService`) to look up employee profiles during clock-in/out
- `EmployeeProfileService` is used by Sprint 7 (`KioskService`) for PIN validation during kiosk clock-in
- The `employee_profile.id` is the FK used by `clock_session.employee_profile_id`, `work_shift.employee_profile_id`, `employee_project_assignment.employee_profile_id`, etc.
- The auto-link behavior (BR-013) means employees may have a `crew_member_id` even if it was not explicitly provided during creation
