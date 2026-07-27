# Sprint 12 — Time Dispute DTOs + Service + Controller (7 Endpoints)
**Module:** time-clock
**File:** ./documentation/sprints/clockin_backend/sprint_12.md
**Type:** Backend — Business Logic
**Depends On:** Sprint 11
**Gate:** STOP — Full dispute lifecycle works: submit, list, approve, reject, cancel. Approval applies proposed values to session and creates edit logs. Rejection requires review_notes.
**Estimated Complexity:** Medium

---

## Code Quality Standard

> You are a **Google / Amazon / Apple senior-level engineer**. Every file you produce must be production-grade: clean, safe, fully typed, zero lint errors, zero runtime errors. No TODO comments, no placeholder code, no shortcuts. Review your own output as if submitting a PR to a FAANG codebase.

---

## Objective

Implement the complete **Time Dispute lifecycle** with 7 endpoints: submit a dispute, list all disputes (admin), list my disputes (employee), get dispute detail, approve a dispute, reject a dispute, and cancel a dispute. When a correction_request dispute is approved, the proposed field values are applied to the clock session using the same edit-log pattern established in Sprint 11.

---

## Pre-Sprint Checklist
- [ ] Verify Sprint 11 is complete (ClockSessionEditService functional, PATCH endpoint working, edit logs immutable)
- [ ] Read `api/src/modules/time-clock/services/clock-session-edit.service.ts` — understand `editSession()` signature and how it creates edit logs, recalculates times, and handles reconciliation
- [ ] Read `api/src/modules/time-clock/controllers/clock-session.controller.ts` — understand existing route structure
- [ ] Read `api/src/modules/communication/services/notifications.service.ts` — exact `createNotification()` signature
- [ ] Read `api/src/modules/audit/services/audit-logger.service.ts` — exact `logTenantChange()` signature
- [ ] Read `api/prisma/schema.prisma` — verify `time_dispute` model exists with fields: `id`, `tenant_id`, `clock_session_id`, `submitted_by_user_id`, `dispute_type`, `description`, `proposed_clock_in_at`, `proposed_clock_out_at`, `proposed_project_id`, `proposed_task_id`, `proposed_notes`, `status`, `reviewed_by_user_id`, `review_notes`, `reviewed_at`, `created_at`, `updated_at`
- [ ] Read `api/src/modules/time-clock/time-clock.module.ts` — understand current providers/controllers

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

### Task 1 — Time Dispute DTOs

**What:** Create `api/src/modules/time-clock/dto/time-dispute.dto.ts`

**CreateTimeDisputeDto:**
```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID,
  IsDateString, MaxLength,
} from 'class-validator';

export enum DisputeTypeEnum {
  FLAG_ONLY = 'flag_only',
  CORRECTION_REQUEST = 'correction_request',
}

export class CreateTimeDisputeDto {
  @ApiProperty({
    description: 'Type of dispute',
    enum: DisputeTypeEnum,
  })
  @IsEnum(DisputeTypeEnum)
  dispute_type: DisputeTypeEnum;

  @ApiProperty({
    description: 'Description of the dispute — required, max 2000 characters',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Dispute description is required' })
  @MaxLength(2000)
  description: string;

  @ApiPropertyOptional({ description: 'Proposed corrected clock-in time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  proposed_clock_in_at?: string;

  @ApiPropertyOptional({ description: 'Proposed corrected clock-out time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  proposed_clock_out_at?: string;

  @ApiPropertyOptional({ description: 'Proposed corrected project ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  proposed_project_id?: string;

  @ApiPropertyOptional({ description: 'Proposed corrected task ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  proposed_task_id?: string;

  @ApiPropertyOptional({ description: 'Proposed corrected notes', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  proposed_notes?: string;
}
```

**ListTimeDisputesDto** (admin list — query params):
```typescript
import { Type } from 'class-transformer';
import {
  IsOptional, IsInt, IsString, IsUUID, IsEnum,
  Min, Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum DisputeStatusEnum {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  RESOLVED = 'resolved',
}

export class ListTimeDisputesDto {
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
    description: 'Filter by dispute status',
    enum: DisputeStatusEnum,
  })
  @IsOptional()
  @IsEnum(DisputeStatusEnum)
  status?: DisputeStatusEnum;

  @ApiPropertyOptional({ description: 'Filter by employee profile ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;
}
```

**ApproveDisputeDto:**
```typescript
export class ApproveDisputeDto {
  @ApiPropertyOptional({ description: 'Reviewer notes', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  review_notes?: string;
}
```

**RejectDisputeDto:**
```typescript
export class RejectDisputeDto {
  @ApiProperty({
    description: 'Reason for rejection — REQUIRED, must not be empty',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Review notes are required when rejecting a dispute' })
  @MaxLength(2000)
  review_notes: string;
}
```

---

### Task 2 — TimeDisputeService

**What:** Create `api/src/modules/time-clock/services/time-dispute.service.ts`

**Constructor dependencies:**
- `PrismaService` (from `../../../core/database/prisma.service`)
- `ClockSessionEditService` (from `./clock-session-edit.service`)
- `NotificationsService` (from `../../communication/services/notifications.service`)
- `AuditLoggerService` (from `../../audit/services/audit-logger.service`)

---

#### Method 1: `submit(tenantId: string, userId: string, sessionId: string, dto: CreateTimeDisputeDto)`

**Execution order:**

**Step 1 — Verify session exists:**
```
Find clock_session where:
  id = sessionId
  AND tenant_id = tenantId

If not found: throw NotFoundException("Clock session not found")
```

**Step 2 — Check no pending dispute exists for this session:**
```
Query time_dispute where:
  clock_session_id = sessionId
  AND status = 'pending'
  AND tenant_id = tenantId

If found: throw ConflictException("A pending dispute already exists for this session. Please wait for it to be reviewed or cancel it first.")
```

**Step 3 — Validate correction_request has at least one proposed value:**
```
If dto.dispute_type === 'correction_request':
  Check if ALL proposed fields are null/undefined:
    proposed_clock_in_at, proposed_clock_out_at, proposed_project_id, proposed_task_id, proposed_notes

  If ALL are null/undefined:
    throw BadRequestException("A correction request must include at least one proposed value (clock-in time, clock-out time, project, task, or notes)")
```

**Step 4 — Create the dispute:**
```
prisma.time_dispute.create({
  data: {
    tenant_id: tenantId,
    clock_session_id: sessionId,
    submitted_by_user_id: userId,
    dispute_type: dto.dispute_type,
    description: dto.description,
    proposed_clock_in_at: dto.proposed_clock_in_at ? new Date(dto.proposed_clock_in_at) : null,
    proposed_clock_out_at: dto.proposed_clock_out_at ? new Date(dto.proposed_clock_out_at) : null,
    proposed_project_id: dto.proposed_project_id ?? null,
    proposed_task_id: dto.proposed_task_id ?? null,
    proposed_notes: dto.proposed_notes ?? null,
    status: 'pending',
  },
})
```

**Step 5 — Notify admins:**
```
// Get submitter's name (query user by userId or use session's employee_profile)
// Notify all Owner/Admin users in this tenant:
//   type: 'timeclock_dispute_submitted'
//   title: 'Time Dispute Submitted'
//   message: '{employee name} submitted a {dispute_type} for {session date}'
//   action_url: '/workforce/disputes'

// Wrap in try/catch — notification failure must NOT block dispute creation
```

**Step 6 — Return the created dispute.**

---

#### Method 2: `findAll(tenantId: string, query: ListTimeDisputesDto)`

**Logic:**
1. Build where clause: `{ tenant_id: tenantId }`.
2. Apply optional filters:
   - `status` if provided
   - `employee_profile_id` if provided: join through `clock_session.employee_profile_id`
3. Count total matching records.
4. Fetch paginated (default page=1, limit=20).
5. Include:
   - `clock_session`: `{ select: { id, clock_in_at, clock_out_at, status, employee_profile: { include: { user: { select: { id, first_name, last_name } } } } } }`
   - `submitted_by`: `{ select: { id, first_name, last_name } }`
6. Order by `created_at DESC`.
7. Return `{ data: [...], meta: { total, page, limit, totalPages } }`.

---

#### Method 3: `findMine(tenantId: string, userId: string, query: ListTimeDisputesDto)`

**Logic:**
1. Same as `findAll` but add filter: `submitted_by_user_id = userId`.
2. All other logic (pagination, includes, ordering) is identical.
3. Return `{ data: [...], meta: { total, page, limit, totalPages } }`.

---

#### Method 4: `findOne(tenantId: string, userId: string, disputeId: string, userRoles: string[])`

**Logic:**
1. Find time_dispute where `id = disputeId` AND `tenant_id = tenantId`.
2. If not found: throw NotFoundException("Dispute not found").
3. Include:
   - `clock_session` with `employee_profile`, `project`, `task`, `break_entries`, `clock_session_edit_log`
   - `submitted_by` (user: id, first_name, last_name)
   - `reviewed_by` (user: id, first_name, last_name) if present
4. **Access control for non-admin users:**
   ```
   If user does NOT have 'Owner' or 'Admin' in userRoles:
     If dispute.submitted_by_user_id !== userId:
       throw ForbiddenException("You can only view your own disputes")
   ```
5. Return the dispute object.

---

#### Method 5: `approve(tenantId: string, userId: string, disputeId: string, dto: ApproveDisputeDto)`

**Execution order:**

**Step 1 — Find the dispute:**
```
Find time_dispute where:
  id = disputeId
  AND tenant_id = tenantId

Include: clock_session (with employee_profile, employee_profile.user, break_entries)

If not found: throw NotFoundException("Dispute not found")
```

**Step 2 — Verify status is pending:**
```
If dispute.status !== 'pending':
  throw BadRequestException("Only pending disputes can be approved")
```

**Step 3 — BR-011: Apply proposed values to clock_session:**

Build an edit DTO from the dispute's proposed fields:
```typescript
const editFields: any = {};
const proposedFields = [
  { disputeField: 'proposed_clock_in_at', sessionField: 'clock_in_at' },
  { disputeField: 'proposed_clock_out_at', sessionField: 'clock_out_at' },
  { disputeField: 'proposed_project_id', sessionField: 'project_id' },
  { disputeField: 'proposed_task_id', sessionField: 'task_id' },
  { disputeField: 'proposed_notes', sessionField: 'notes' },
];

for (const mapping of proposedFields) {
  const proposedValue = dispute[mapping.disputeField];
  if (proposedValue != null) {
    editFields[mapping.sessionField] = proposedValue instanceof Date
      ? proposedValue.toISOString()
      : proposedValue;
  }
}
```

**Step 4 — Apply changes via edit log pattern (same as Sprint 11):**

For EACH field that has a proposed non-null value AND the value differs from the current session value:
```
Create clock_session_edit_log entry:
  tenant_id: tenantId
  clock_session_id: dispute.clock_session_id
  edited_by_user_id: userId  (the reviewer, not the submitter)
  field_changed: sessionField name
  original_value: String(currentValue)
  new_value: String(proposedValue)
  reason: "Approved dispute: " + dispute.description.substring(0, 200)
```

Set `clock_session.is_manual_edit = true`.

**Step 5 — Recalculate times (if clock_in_at or clock_out_at was changed):**

Follow the same recalculation logic as Sprint 11 Task 2 Step 7:
- Recalculate `total_worked_minutes` (subtract unpaid break durations)
- Recalculate overtime via `OvertimeService.calculateOvertime()`
- Update `regular_minutes` and `overtime_minutes`

**Step 6 — Labor cost reconciliation (if applicable):**
```
If clock_session.labor_cost_posted === true:
  Set labor_cost_reconciliation_needed = true
  Notify admins (same pattern as Sprint 11 reconciliation notification)
```

**Step 7 — Update the dispute status:**
```
prisma.time_dispute.update({
  where: { id: disputeId },
  data: {
    status: 'approved',
    reviewed_by_user_id: userId,
    reviewed_at: new Date(),
    review_notes: dto.review_notes ?? null,
  },
})
```

**Step 8 — Notify the employee:**
```
// Find the submitter's user ID from dispute.submitted_by_user_id
// Send notification:
//   type: 'timeclock_dispute_approved'
//   title: 'Dispute Approved'
//   message: 'Your time correction for {session date} has been approved'
//   action_url: '/workforce/my-timesheets'

// Wrap in try/catch
```

**Step 9 — Audit log:**
```
Call AuditLoggerService.logTenantChange():
  action: 'updated'
  entityType: 'time_dispute'
  entityId: disputeId
  metadata: { action: 'approved', session_id: dispute.clock_session_id }
```

**Step 10 — Return the updated dispute with clock_session includes.**

**IMPORTANT:** The approve method can either call `ClockSessionEditService.editSession()` directly (passing a constructed EditClockSessionDto with the proposed values and reason), OR replicate the edit-log creation logic inline. Calling `editSession()` is cleaner and avoids code duplication — but verify that the reason field format is compatible. If calling editSession, construct the DTO like:
```typescript
const editDto = {
  clock_in_at: dispute.proposed_clock_in_at?.toISOString(),
  clock_out_at: dispute.proposed_clock_out_at?.toISOString(),
  project_id: dispute.proposed_project_id,
  task_id: dispute.proposed_task_id,
  notes: dispute.proposed_notes,
  reason: `Approved dispute: ${dispute.description.substring(0, 200)}`,
};
// Remove undefined fields
Object.keys(editDto).forEach(k => editDto[k] === undefined && delete editDto[k]);

await this.clockSessionEditService.editSession(tenantId, userId, dispute.clock_session_id, editDto);
```
This approach reuses all edit-log, recalculation, and reconciliation logic from Sprint 11.

---

#### Method 6: `reject(tenantId: string, userId: string, disputeId: string, dto: RejectDisputeDto)`

**Execution order:**

**Step 1 — Find the dispute:**
```
Find time_dispute where:
  id = disputeId
  AND tenant_id = tenantId

If not found: throw NotFoundException("Dispute not found")
```

**Step 2 — Verify status is pending:**
```
If dispute.status !== 'pending':
  throw BadRequestException("Only pending disputes can be rejected")
```

**Step 3 — Validate review_notes:**
```
If dto.review_notes is empty/blank:
  throw BadRequestException("Review notes are required when rejecting a dispute")

Note: The @IsNotEmpty() validator on the DTO should catch this, but defend in depth.
```

**Step 4 — Update the dispute (NO changes to clock_session):**
```
prisma.time_dispute.update({
  where: { id: disputeId },
  data: {
    status: 'rejected',
    reviewed_by_user_id: userId,
    reviewed_at: new Date(),
    review_notes: dto.review_notes,
  },
})
```

**Step 5 — Notify the employee:**
```
// Send notification to dispute.submitted_by_user_id:
//   type: 'timeclock_dispute_rejected'
//   title: 'Dispute Not Approved'
//   message: 'Your time correction for {session date} was not approved. {review_notes}'
//   action_url: '/workforce/my-timesheets'

// Wrap in try/catch
```

**Step 6 — Audit log:**
```
Call AuditLoggerService.logTenantChange():
  action: 'updated'
  entityType: 'time_dispute'
  entityId: disputeId
  metadata: { action: 'rejected', review_notes: dto.review_notes }
```

**Step 7 — Return the updated dispute.**

---

#### Method 7: `cancel(tenantId: string, userId: string, disputeId: string, userRoles: string[])`

**Execution order:**

**Step 1 — Find the dispute:**
```
Find time_dispute where:
  id = disputeId
  AND tenant_id = tenantId

If not found: throw NotFoundException("Dispute not found")
```

**Step 2 — Verify status is pending:**
```
If dispute.status !== 'pending':
  throw BadRequestException("Only pending disputes can be cancelled")
```

**Step 3 — Authorization check:**
```
If user is NOT the submitter (dispute.submitted_by_user_id !== userId):
  If user does NOT have 'Owner' or 'Admin' in userRoles:
    throw ForbiddenException("You can only cancel your own disputes")
```

**Step 4 — Set status to resolved:**
```
prisma.time_dispute.update({
  where: { id: disputeId },
  data: { status: 'resolved' },
})
```

**Step 5 — Return:**
```
Return { message: "Dispute cancelled" }
```

---

### Task 3 — TimeDisputeController

**What:** Create `api/src/modules/time-clock/controllers/time-dispute.controller.ts`

**IMPORTANT:** Disputes have two URL patterns:
1. `POST /time-clock/sessions/:sessionId/disputes` — submit (scoped to a session)
2. `GET/PATCH/DELETE /time-clock/disputes/...` — list, detail, approve, reject, cancel (standalone)

The submit endpoint is session-scoped (uses session ID in the URL). The management endpoints are under `/time-clock/disputes/`.

**Option A (Recommended):** Create a single `TimeDisputeController` with `@Controller('time-clock')` base path, then use full path decorators:
```typescript
@ApiTags('Time Clock - Disputes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('time-clock')
```

**Option B:** Add the submit endpoint to `ClockSessionController` (under `sessions/:id/disputes`) and create a separate `TimeDisputeController` for the management endpoints. Either approach is acceptable.

**CRITICAL — Route order matters.** Static segments MUST be declared before parameterized segments.

Declare routes in this exact order:

#### Endpoint 1: POST /sessions/:sessionId/disputes
```
@Post('sessions/:sessionId/disputes')
@Roles('Owner', 'Admin', 'Project Manager', 'Employee')
@ApiOperation({ summary: 'Submit a dispute for a clock session' })
@ApiParam({ name: 'sessionId', description: 'Clock session ID' })

Parameters:
  @TenantId() tenantId: string
  @CurrentUser() user: { id: string }
  @Param('sessionId') sessionId: string
  @Body() dto: CreateTimeDisputeDto

Calls: TimeDisputeService.submit(tenantId, user.id, sessionId, dto)
Returns: 201 with created dispute
Errors: 404 (session not found), 409 (pending dispute exists), 400 (correction_request with no proposed values)
```

#### Endpoint 2: GET /disputes
```
@Get('disputes')
@Roles('Owner', 'Admin')
@ApiOperation({ summary: 'List all time disputes (admin view, paginated)' })

Parameters:
  @TenantId() tenantId: string
  @Query() query: ListTimeDisputesDto

Calls: TimeDisputeService.findAll(tenantId, query)
Returns: 200 with { data: [...], meta: { total, page, limit, totalPages } }
```

#### Endpoint 3: GET /disputes/mine
```
@Get('disputes/mine')
@Roles('Owner', 'Admin', 'Project Manager', 'Employee')
@ApiOperation({ summary: 'List my own disputes (paginated)' })

Parameters:
  @TenantId() tenantId: string
  @CurrentUser() user: { id: string }
  @Query() query: ListTimeDisputesDto

Calls: TimeDisputeService.findMine(tenantId, user.id, query)
Returns: 200 with { data: [...], meta: { total, page, limit, totalPages } }
```

#### Endpoint 4: GET /disputes/:id
```
@Get('disputes/:id')
@Roles('Owner', 'Admin', 'Project Manager', 'Employee')
@ApiOperation({ summary: 'Get dispute detail' })
@ApiParam({ name: 'id', description: 'Dispute ID' })

Parameters:
  @TenantId() tenantId: string
  @CurrentUser() user: { id: string; roles: string[] }
  @Param('id') id: string

Calls: TimeDisputeService.findOne(tenantId, user.id, id, user.roles)
Returns: 200 with full dispute object
Errors: 404 (not found), 403 (not owner of dispute and not admin)
```

#### Endpoint 5: PATCH /disputes/:id/approve
```
@Patch('disputes/:id/approve')
@Roles('Owner', 'Admin')
@ApiOperation({ summary: 'Approve a time dispute' })
@ApiParam({ name: 'id', description: 'Dispute ID' })

Parameters:
  @TenantId() tenantId: string
  @CurrentUser() user: { id: string }
  @Param('id') id: string
  @Body() dto: ApproveDisputeDto

Calls: TimeDisputeService.approve(tenantId, user.id, id, dto)
Returns: 200 with updated dispute
Errors: 404 (not found), 400 (not pending)
```

#### Endpoint 6: PATCH /disputes/:id/reject
```
@Patch('disputes/:id/reject')
@Roles('Owner', 'Admin')
@ApiOperation({ summary: 'Reject a time dispute' })
@ApiParam({ name: 'id', description: 'Dispute ID' })

Parameters:
  @TenantId() tenantId: string
  @CurrentUser() user: { id: string }
  @Param('id') id: string
  @Body() dto: RejectDisputeDto

Calls: TimeDisputeService.reject(tenantId, user.id, id, dto)
Returns: 200 with updated dispute
Errors: 404 (not found), 400 (not pending or missing review_notes)
```

#### Endpoint 7: DELETE /disputes/:id
```
@Delete('disputes/:id')
@Roles('Owner', 'Admin', 'Project Manager', 'Employee')
@ApiOperation({ summary: 'Cancel a pending dispute' })
@ApiParam({ name: 'id', description: 'Dispute ID' })

Parameters:
  @TenantId() tenantId: string
  @CurrentUser() user: { id: string; roles: string[] }
  @Param('id') id: string

Calls: TimeDisputeService.cancel(tenantId, user.id, id, user.roles)
Returns: 200 with { message: "Dispute cancelled" }
Errors: 404 (not found), 400 (not pending), 403 (not submitter and not admin)
```

**ROUTE ORDER within the controller:**
1. `POST sessions/:sessionId/disputes` — session-scoped submit
2. `GET disputes` — admin list
3. `GET disputes/mine` — my disputes (MUST come BEFORE `disputes/:id`)
4. `GET disputes/:id` — detail (MUST come AFTER `disputes/mine`)
5. `PATCH disputes/:id/approve` — approve
6. `PATCH disputes/:id/reject` — reject
7. `DELETE disputes/:id` — cancel

---

### Task 4 — Register in Module

**What:** Open `api/src/modules/time-clock/time-clock.module.ts` and:
1. Import `TimeDisputeService` into the `providers` array.
2. Import `TimeDisputeController` into the `controllers` array.
3. Ensure `ClockSessionEditService`, `NotificationsService`, `AuditLoggerService` are available.
4. Verify the module compiles without errors.

---

### Task 5 — End-to-End Testing

**What:** Test the full dispute lifecycle using curl.

**Setup:** First create and complete a session.

```bash
# 1. Login to get JWT token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

# 2. Clock in and clock out to create a completed session
CLOCK_IN=$(curl -s -X POST http://localhost:8000/api/v1/time-clock/sessions/clock-in \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"latitude":40.7128,"longitude":-74.006}')
SESSION_ID=$(echo "$CLOCK_IN" | jq -r '.id')
echo "Session ID: $SESSION_ID"

curl -s -X POST http://localhost:8000/api/v1/time-clock/sessions/clock-out \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}' > /dev/null

# --- SUBMIT DISPUTE ---

# 3. Submit a correction_request dispute
DISPUTE=$(curl -s -X POST "http://localhost:8000/api/v1/time-clock/sessions/$SESSION_ID/disputes" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "dispute_type": "correction_request",
    "description": "I forgot to clock in this morning. My actual start time was 7:00 AM.",
    "proposed_clock_in_at": "2026-04-10T07:00:00.000Z"
  }')
echo "$DISPUTE" | jq .
DISPUTE_ID=$(echo "$DISPUTE" | jq -r '.id')

# Expected: 201, status='pending', dispute_type='correction_request'

# 4. Try to submit another dispute for the same session (should return 409)
curl -s -X POST "http://localhost:8000/api/v1/time-clock/sessions/$SESSION_ID/disputes" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "dispute_type": "flag_only",
    "description": "Another dispute"
  }' | jq .

# Expected: 409 — "A pending dispute already exists for this session"

# 5. Try to submit a correction_request with no proposed values (should return 400)
# First, create a new session for this test
CLOCK_IN2=$(curl -s -X POST http://localhost:8000/api/v1/time-clock/sessions/clock-in \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"latitude":40.7128,"longitude":-74.006}')
SESSION_ID2=$(echo "$CLOCK_IN2" | jq -r '.id')
curl -s -X POST http://localhost:8000/api/v1/time-clock/sessions/clock-out \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}' > /dev/null

curl -s -X POST "http://localhost:8000/api/v1/time-clock/sessions/$SESSION_ID2/disputes" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "dispute_type": "correction_request",
    "description": "I want a correction but not sure what"
  }' | jq .

# Expected: 400 — "A correction request must include at least one proposed value"

# --- LIST DISPUTES ---

# 6. List all disputes (admin view)
curl -s "http://localhost:8000/api/v1/time-clock/disputes?limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Expected: 200, paginated list with at least 1 dispute

# 7. List my disputes
curl -s "http://localhost:8000/api/v1/time-clock/disputes/mine?limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Expected: 200, paginated list with at least 1 dispute

# 8. Filter disputes by status
curl -s "http://localhost:8000/api/v1/time-clock/disputes?status=pending&limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Expected: 200, only pending disputes

# --- GET DETAIL ---

# 9. Get dispute detail
curl -s "http://localhost:8000/api/v1/time-clock/disputes/$DISPUTE_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Expected: 200, full dispute with clock_session, submitted_by

# --- APPROVE ---

# 10. Approve the dispute (should apply proposed clock_in_at to the session)
curl -s -X PATCH "http://localhost:8000/api/v1/time-clock/disputes/$DISPUTE_ID/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"review_notes": "Confirmed with security camera footage"}' | jq .

# Expected: 200, status='approved', reviewed_by_user_id set, reviewed_at set

# 11. Verify the session was updated
curl -s "http://localhost:8000/api/v1/time-clock/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '{clock_in_at, is_manual_edit, total_worked_minutes, regular_minutes, overtime_minutes}'

# Expected: clock_in_at='2026-04-10T07:00:00.000Z', is_manual_edit=true, times recalculated

# 12. Verify edit logs were created
curl -s "http://localhost:8000/api/v1/time-clock/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.clock_session_edit_log'

# Expected: At least 1 entry with reason containing "Approved dispute:"

# --- REJECT ---

# 13. Create another dispute on a different session, then reject it
DISPUTE2=$(curl -s -X POST "http://localhost:8000/api/v1/time-clock/sessions/$SESSION_ID2/disputes" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "dispute_type": "flag_only",
    "description": "I was on-site but GPS did not work"
  }')
DISPUTE_ID2=$(echo "$DISPUTE2" | jq -r '.id')

# 14. Try to reject without review_notes (should fail)
curl -s -X PATCH "http://localhost:8000/api/v1/time-clock/disputes/$DISPUTE_ID2/reject" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"review_notes": ""}' | jq .

# Expected: 400 — review notes required

# 15. Reject with review_notes
curl -s -X PATCH "http://localhost:8000/api/v1/time-clock/disputes/$DISPUTE_ID2/reject" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"review_notes": "GPS logs show you were at home during that period."}' | jq .

# Expected: 200, status='rejected', review_notes set

# --- CANCEL ---

# 16. Create one more dispute, then cancel it
CLOCK_IN3=$(curl -s -X POST http://localhost:8000/api/v1/time-clock/sessions/clock-in \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"latitude":40.7128,"longitude":-74.006}')
SESSION_ID3=$(echo "$CLOCK_IN3" | jq -r '.id')
curl -s -X POST http://localhost:8000/api/v1/time-clock/sessions/clock-out \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}' > /dev/null

DISPUTE3=$(curl -s -X POST "http://localhost:8000/api/v1/time-clock/sessions/$SESSION_ID3/disputes" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "dispute_type": "flag_only",
    "description": "Submitted by mistake"
  }')
DISPUTE_ID3=$(echo "$DISPUTE3" | jq -r '.id')

# 17. Cancel the dispute
curl -s -X DELETE "http://localhost:8000/api/v1/time-clock/disputes/$DISPUTE_ID3" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Expected: 200, { "message": "Dispute cancelled" }

# 18. Verify it is now resolved
curl -s "http://localhost:8000/api/v1/time-clock/disputes/$DISPUTE_ID3" \
  -H "Authorization: Bearer $TOKEN" | jq '.status'

# Expected: "resolved"

# 19. Try to approve a resolved dispute (should fail)
curl -s -X PATCH "http://localhost:8000/api/v1/time-clock/disputes/$DISPUTE_ID3/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq .

# Expected: 400 — "Only pending disputes can be approved"
```

---

## Acceptance Criteria

- [ ] `CreateTimeDisputeDto`, `ListTimeDisputesDto`, `ApproveDisputeDto`, `RejectDisputeDto` exist with correct validators
- [ ] `TimeDisputeService` implements all 7 methods: `submit`, `findAll`, `findMine`, `findOne`, `approve`, `reject`, `cancel`
- [ ] `submit` validates: session exists, no pending dispute, correction_request has at least one proposed value
- [ ] `submit` notifies admins on new dispute
- [ ] `findAll` returns paginated list with filters (status, employee_profile_id)
- [ ] `findMine` returns only the current user's disputes
- [ ] `findOne` enforces access control (non-admin can only view own disputes)
- [ ] `approve` applies proposed non-null values to clock_session
- [ ] `approve` creates immutable edit_log entries for each changed field
- [ ] `approve` recalculates times if clock_in_at or clock_out_at proposed
- [ ] `approve` handles labor_cost_reconciliation_needed flag
- [ ] `approve` sets status='approved', reviewed_by, reviewed_at
- [ ] `approve` notifies employee of approval
- [ ] `reject` requires non-empty review_notes (returns 400 if missing/empty)
- [ ] `reject` does NOT modify the clock_session
- [ ] `reject` sets status='rejected', review_notes, reviewed_by, reviewed_at
- [ ] `reject` notifies employee of rejection (includes review_notes in message)
- [ ] `cancel` verifies submitter identity (or Owner/Admin role)
- [ ] `cancel` sets status='resolved' and returns confirmation message
- [ ] Only pending disputes can be approved/rejected/cancelled (returns 400 otherwise)
- [ ] All 7 endpoints respond with correct status codes
- [ ] Route order: `disputes/mine` declared BEFORE `disputes/:id`
- [ ] All Prisma queries include `tenant_id` filter
- [ ] Module compiles without errors
- [ ] All endpoints tested and return expected responses
- [ ] Dev server is shut down after testing

---

## Gate Marker

**STOP** — Verify these critical behaviors before marking the time-clock backend complete:

1. Submit creates a pending dispute and notifies admins
2. Only one pending dispute per session (409 on duplicate)
3. Correction request with no proposed values is rejected (400)
4. Approve applies proposed values to session, creates edit logs, recalculates times
5. Approve with labor_cost_posted=true triggers reconciliation flag and notification
6. Reject requires review_notes and does NOT change the session
7. Cancel sets status to 'resolved' and is restricted to submitter or admin
8. Non-pending disputes cannot be approved/rejected/cancelled
9. Non-admin users can only view their own disputes

---

## Handoff Notes

**For the Frontend Agent:**
- All 7 dispute endpoints are now available.
- The submit endpoint uses `POST /time-clock/sessions/:sessionId/disputes` (session-scoped URL).
- The management endpoints use `GET/PATCH/DELETE /time-clock/disputes/...`.
- The approve flow automatically applies corrections and creates edit logs — the frontend does not need to call the edit endpoint separately.
- The employee notification includes the review_notes for rejected disputes, so the UI should display them.

**For API Documentation Sprint:**
- This sprint adds 7 new endpoints to the time-clock module.
- Total endpoint count after this sprint: all session endpoints (8) + break endpoints (3) + edit endpoint (1) + dispute endpoints (7) = 19 endpoints in the session/dispute subsystem.
