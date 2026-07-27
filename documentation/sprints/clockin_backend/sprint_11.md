# Sprint 11 — ClockSessionEditService + Manual Edit Endpoint (1 Endpoint)
**Module:** time-clock
**File:** ./documentation/sprints/clockin_backend/sprint_11.md
**Type:** Backend — Business Logic
**Depends On:** Sprint 9
**Gate:** STOP — Edit creates immutable log entries, recalculation works, reconciliation flag set correctly. Verify before proceeding to Sprint 12.
**Estimated Complexity:** Medium

---

## Code Quality Standard

> You are a **Google / Amazon / Apple senior-level engineer**. Every file you produce must be production-grade: clean, safe, fully typed, zero lint errors, zero runtime errors. No TODO comments, no placeholder code, no shortcuts. Review your own output as if submitting a PR to a FAANG codebase.

---

## Objective

Implement the **ClockSessionEditService** that powers the `PATCH /time-clock/sessions/:id` endpoint. This service allows Owner and Admin users to manually edit a completed (or active) clock session. Every field change creates an immutable `clock_session_edit_log` record. If time fields are changed, the session is recalculated. If labor cost was already posted, a reconciliation flag is set and admins are notified.

The PATCH endpoint was declared in the `ClockSessionController` during Sprint 9 — this sprint implements the service method and wires it.

---

## Pre-Sprint Checklist
- [ ] Verify Sprint 9 is complete (ClockSessionService, ClockSessionController functional)
- [ ] Read `api/src/modules/time-clock/controllers/clock-session.controller.ts` — confirm PATCH `/sessions/:id` is either declared and needs wiring, or needs to be added
- [ ] Read `api/src/modules/time-clock/services/overtime.service.ts` — understand `calculateOvertime()` exact signature and return shape
- [ ] Read `api/src/modules/time-clock/services/clock-session.service.ts` — understand session query patterns
- [ ] Read `api/src/modules/communication/services/notifications.service.ts` — understand `createNotification()` signature
- [ ] Read `api/src/modules/audit/services/audit-logger.service.ts` — exact `logTenantChange()` signature and parameter shape
- [ ] Read `api/prisma/schema.prisma` — verify `clock_session_edit_log` model exists with fields: `id`, `tenant_id`, `clock_session_id`, `edited_by_user_id`, `field_changed`, `original_value`, `new_value`, `reason`, `edited_at`
- [ ] Read `api/src/modules/time-clock/time-clock.module.ts` — understand current providers/controllers registration

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

### Task 1 — EditClockSessionDto

**What:** Create `api/src/modules/time-clock/dto/clock-session-edit.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional, IsString, IsUUID, IsDateString, IsNotEmpty,
  MaxLength,
} from 'class-validator';

export class EditClockSessionDto {
  @ApiPropertyOptional({ description: 'New clock-in time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  clock_in_at?: string;

  @ApiPropertyOptional({ description: 'New clock-out time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  clock_out_at?: string;

  @ApiPropertyOptional({ description: 'New project ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ description: 'New task ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiPropertyOptional({ description: 'Updated notes', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({
    description: 'Reason for the edit — REQUIRED, must not be empty',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty({ message: 'Edit reason is required' })
  @MaxLength(500)
  reason: string;
}
```

**Rules:**
- `reason` is the ONLY required field. It must be non-empty (reject with 400 if blank/whitespace-only).
- All other fields are optional. Only provided fields are applied. Omitted fields are NOT changed.
- Editable fields: `clock_in_at`, `clock_out_at`, `project_id`, `task_id`, `notes`.
- Fields NOT editable via this endpoint: `status`, `employee_profile_id`, `is_flagged`, `flag_reason`, `labor_cost_posted`, `labor_cost_entry_id`.

---

### Task 2 — ClockSessionEditService

**What:** Create `api/src/modules/time-clock/services/clock-session-edit.service.ts`

**Constructor dependencies:**
- `PrismaService` (from `../../../core/database/prisma.service`)
- `OvertimeService` (from `./overtime.service`)
- `AuditLoggerService` (from `../../audit/services/audit-logger.service`)
- `NotificationsService` (from `../../communication/services/notifications.service`)

---

#### Method: `editSession(tenantId: string, userId: string, sessionId: string, dto: EditClockSessionDto)`

**Execution order — STOP on first failure:**

**Step 1 — Find the session:**
```
Find clock_session where:
  id = sessionId
  AND tenant_id = tenantId

Include: employee_profile (with user for notification name), break_entries

If not found: throw NotFoundException("Clock session not found")
```

**Step 2 — Validate reason:**
```
If dto.reason is empty, blank, or whitespace-only:
  throw BadRequestException("Edit reason is required")

Note: The @IsNotEmpty() validator on the DTO should catch this, but add a service-level check as defense-in-depth.
```

**Step 3 — Determine which fields changed:**

Define the list of editable fields and compare each:
```typescript
const editableFields = ['clock_in_at', 'clock_out_at', 'project_id', 'task_id', 'notes'];
const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

for (const field of editableFields) {
  if (dto[field] !== undefined) {
    const oldValue = session[field];
    const newValue = dto[field];

    // Compare as strings for consistency (original_value and new_value are stored as text)
    const oldStr = oldValue != null ? String(oldValue) : null;
    const newStr = newValue != null ? String(newValue) : null;

    // Only log if value actually changed
    if (oldStr !== newStr) {
      changes.push({ field, oldValue: oldStr, newValue: newStr });
    }
  }
}
```

If `changes` is empty (no actual changes): return the session as-is (no edit logs created, no flags set).

**Step 4 — Create edit log entries (IMMUTABLE):**
```
For EACH entry in changes:
  prisma.clock_session_edit_log.create({
    data: {
      tenant_id: tenantId,
      clock_session_id: sessionId,
      edited_by_user_id: userId,
      field_changed: change.field,
      original_value: change.oldValue,
      new_value: change.newValue,
      reason: dto.reason,
    },
  })

Collect the created edit_log IDs for the audit log metadata.

IMPORTANT: clock_session_edit_log records are IMMUTABLE. Never update or delete them.
No UPDATE or DELETE operations should ever target this table.
```

**Step 5 — Set is_manual_edit flag:**
```
Set clock_session.is_manual_edit = true (regardless of which fields changed).
```

**Step 6 — Apply field changes to session:**

Build the update data object with only the changed fields:
```typescript
const updateData: any = { is_manual_edit: true };

for (const change of changes) {
  if (change.field === 'clock_in_at' || change.field === 'clock_out_at') {
    updateData[change.field] = change.newValue ? new Date(change.newValue) : null;
  } else {
    updateData[change.field] = change.newValue;
  }
}
```

**Step 7 — Recalculate times (only if clock_in_at or clock_out_at changed AND session is completed):**
```
const timeFieldsChanged = changes.some(c => c.field === 'clock_in_at' || c.field === 'clock_out_at');

If timeFieldsChanged AND the session has a clock_out_at (either existing or newly set):
  // Determine effective clock_in and clock_out
  const effectiveClockIn = new Date(dto.clock_in_at ?? session.clock_in_at);
  const effectiveClockOut = new Date(dto.clock_out_at ?? session.clock_out_at);

  // Recalculate total_worked_minutes (BR-004B):
  // Fetch all UNPAID break_entries for this session where duration_minutes IS NOT NULL
  const unpaidBreaks = session.break_entries.filter(
    b => b.break_type === 'unpaid' && b.duration_minutes != null
  );
  const unpaidBreakMinutes = unpaidBreaks.reduce((sum, b) => sum + b.duration_minutes, 0);

  const totalWorkedMinutes = Math.max(
    0,
    Math.floor((effectiveClockOut.getTime() - effectiveClockIn.getTime()) / 60000) - unpaidBreakMinutes
  );

  updateData.total_worked_minutes = totalWorkedMinutes;

  // Recalculate overtime (BR-006):
  const overtimeResult = await OvertimeService.calculateOvertime({
    tenantId,
    employeeProfileId: session.employee_profile_id,
    sessionId: session.id,
    totalWorkedMinutes,
    clockInAt: effectiveClockIn,
  });

  updateData.regular_minutes = overtimeResult.regular_minutes;
  updateData.overtime_minutes = overtimeResult.overtime_minutes;
```

**Step 8 — If ONLY project_id, task_id, or notes changed:**
```
If timeFieldsChanged is false:
  Do NOT recalculate total_worked_minutes, regular_minutes, or overtime_minutes.
  Only apply the non-time field changes.
```

**Step 9 — Labor cost reconciliation check:**
```
If session.labor_cost_posted === true:
  updateData.labor_cost_reconciliation_needed = true;

  // Notify admins
  const employeeName = `${session.employee_profile.user.first_name} ${session.employee_profile.user.last_name}`;
  const sessionDate = new Date(session.clock_in_at).toISOString().split('T')[0];

  // Query all users with Owner or Admin role in this tenant
  // For each admin, send notification:
  //   type: 'timeclock_reconciliation_needed'
  //   title: 'Reconciliation Needed'
  //   message: `Clock session for ${employeeName} on ${sessionDate} was edited after labor cost was posted — manual reconciliation required`
  //   action_url: '/workforce/timesheets'

  // Wrap in try/catch — notification failure must NOT block the edit
```

**Step 10 — Apply the update:**
```
prisma.clock_session.update({
  where: { id: sessionId },
  data: updateData,
})
```

**Step 11 — Audit log:**
```
Call AuditLoggerService.logTenantChange() with:
  action: 'updated'
  entityType: 'clock_session'
  entityId: sessionId
  tenantId: tenantId
  userId: userId
  before: { ...relevant old values from changes }
  after: { ...relevant new values from changes }
  metadata: { edit_log_ids: [...created edit log IDs] }
```

**Step 12 — Return updated session:**
```
Re-fetch the session with includes:
  employee_profile, project, task, work_shift,
  clock_session_edit_log (ordered by edited_at DESC),
  break_entries

Return the full session object.
```

---

### Task 3 — Wire PATCH Endpoint in Controller

**What:** In `api/src/modules/time-clock/controllers/clock-session.controller.ts`, add or wire the PATCH endpoint.

```
@Patch(':id')
@Roles('Owner', 'Admin')
@ApiOperation({ summary: 'Manually edit a clock session (creates immutable edit log)' })
@ApiParam({ name: 'id', description: 'Clock session ID' })

Parameters:
  @TenantId() tenantId: string
  @CurrentUser() user: { id: string }
  @Param('id') sessionId: string
  @Body() dto: EditClockSessionDto

Calls: ClockSessionEditService.editSession(tenantId, user.id, sessionId, dto)
Returns: 200 with updated session including edit_logs
Errors: 404 (session not found), 400 (missing reason)
```

**IMPORTANT:** Only `Owner` and `Admin` roles may edit sessions. Employees and PMs cannot edit sessions.

**Route ordering:** `PATCH /:id` should be declared alongside `GET /:id` — both use the `:id` param. Ensure it does NOT conflict with static routes. Place it after all static routes and after `GET /:id`.

---

### Task 4 — Register in Module

**What:** Open `api/src/modules/time-clock/time-clock.module.ts` and:
1. Import `ClockSessionEditService` into the `providers` array.
2. Ensure `OvertimeService`, `AuditLoggerService`, `NotificationsService` are available (already imported from prior sprints).
3. Verify the module compiles without errors.

---

### Task 5 — End-to-End Testing

**What:** Test the edit flow using curl.

**Setup:** First create and complete a session so there is something to edit.

```bash
# 1. Login to get JWT token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

# 2. Clock in
CLOCK_IN=$(curl -s -X POST http://localhost:8000/api/v1/time-clock/sessions/clock-in \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"latitude":40.7128,"longitude":-74.006}')
SESSION_ID=$(echo "$CLOCK_IN" | jq -r '.id')
echo "Session ID: $SESSION_ID"

# 3. Clock out
curl -s -X POST http://localhost:8000/api/v1/time-clock/sessions/clock-out \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq .

# 4. Edit the session — change clock_in_at (should trigger recalculation)
curl -s -X PATCH "http://localhost:8000/api/v1/time-clock/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "clock_in_at": "2026-04-10T07:00:00.000Z",
    "reason": "Employee reported incorrect start time — corrected from badge log"
  }' | jq .

# Expected: 200, is_manual_edit=true, total_worked_minutes recalculated,
#   clock_session_edit_log array has 1 entry (field_changed='clock_in_at')

# 5. Edit the session — change notes only (no recalculation)
curl -s -X PATCH "http://localhost:8000/api/v1/time-clock/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "notes": "Updated per employee request",
    "reason": "Employee asked to add note about early start"
  }' | jq .

# Expected: 200, notes updated, total_worked_minutes unchanged,
#   clock_session_edit_log now has 2 entries

# 6. Try edit without reason (should fail 400)
curl -s -X PATCH "http://localhost:8000/api/v1/time-clock/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "notes": "test",
    "reason": ""
  }' | jq .

# Expected: 400 — "Edit reason is required"

# 7. Try edit with reason missing entirely (should fail 400)
curl -s -X PATCH "http://localhost:8000/api/v1/time-clock/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"notes": "test"}' | jq .

# Expected: 400 — validation error for reason field

# 8. Verify edit logs are immutable — GET the session detail
curl -s "http://localhost:8000/api/v1/time-clock/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '.clock_session_edit_log'

# Expected: Array with 2 entries, each with field_changed, original_value, new_value, reason, edited_at

# 9. Edit both clock_in_at and clock_out_at simultaneously
curl -s -X PATCH "http://localhost:8000/api/v1/time-clock/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "clock_in_at": "2026-04-10T06:30:00.000Z",
    "clock_out_at": "2026-04-10T15:00:00.000Z",
    "reason": "Adjusted both times based on security camera footage"
  }' | jq .

# Expected: 200, BOTH fields updated, 2 new edit_log entries (one per changed field),
#   total_worked_minutes, regular_minutes, overtime_minutes all recalculated
```

**Verify edit_log immutability:**
- After all edits, the session's `clock_session_edit_log` array should contain entries for every individual field change.
- Each entry has: `field_changed`, `original_value` (string), `new_value` (string), `reason`, `edited_by_user_id`, `edited_at`.
- The log grows monotonically — old entries are never modified or removed.

---

## Acceptance Criteria

- [ ] `EditClockSessionDto` exists with `clock_in_at?`, `clock_out_at?`, `project_id?`, `task_id?`, `notes?`, `reason` (required, @IsNotEmpty, max 500)
- [ ] `ClockSessionEditService` implements `editSession` method
- [ ] For EACH field that actually changed, a `clock_session_edit_log` record is created
- [ ] `original_value` and `new_value` are stored as strings
- [ ] `reason` from the DTO is copied to every edit_log entry created in that edit batch
- [ ] `is_manual_edit` is set to `true` on the session after any edit
- [ ] If `clock_in_at` or `clock_out_at` changed AND session is completed: `total_worked_minutes` is recalculated (subtracting unpaid break durations)
- [ ] If `clock_in_at` or `clock_out_at` changed: overtime is recalculated via `OvertimeService.calculateOvertime()`
- [ ] If ONLY `project_id`, `task_id`, or `notes` changed: NO time recalculation occurs
- [ ] If `labor_cost_posted === true`: `labor_cost_reconciliation_needed` is set to `true`
- [ ] If `labor_cost_posted === true`: admin notification is sent (timeclock_reconciliation_needed)
- [ ] Audit log is created via `AuditLoggerService.logTenantChange()` with before/after and edit_log_ids
- [ ] `PATCH /time-clock/sessions/:id` responds correctly — roles: Owner, Admin only
- [ ] Empty reason returns 400
- [ ] Missing reason returns 400
- [ ] Edit with no actual changes returns session as-is (no logs created)
- [ ] All Prisma queries include `tenant_id` filter
- [ ] `clock_session_edit_log` records are never updated or deleted (IMMUTABLE)
- [ ] Module compiles without errors
- [ ] Dev server is shut down after testing

---

## Gate Marker

**STOP** — Verify these critical behaviors before proceeding to Sprint 12:

1. Editing `clock_in_at` creates an edit_log AND recalculates `total_worked_minutes` and overtime
2. Editing `notes` creates an edit_log but does NOT recalculate times
3. Editing a session with `labor_cost_posted=true` sets `labor_cost_reconciliation_needed=true` and sends admin notification
4. Edit logs are immutable — the GET session detail shows all historical edits
5. Empty or missing `reason` is rejected with 400
6. Only Owner and Admin roles can access the endpoint

---

## Handoff Notes

**For Sprint 12 (Disputes):**
- The `ClockSessionEditService.editSession()` method is now available and will be called by the dispute approval flow.
- When a dispute is approved, the dispute service should call `editSession` internally (or replicate its field-change logic) to apply proposed values and create edit logs with `reason = "Approved dispute: {description}"`.
- The reconciliation check is already built into `editSession` — no need to duplicate it in the dispute service.
