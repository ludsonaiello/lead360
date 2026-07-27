# Sprint 8 — OvertimeService + LaborCostAttributionService
**Module:** time-clock
**File:** ./documentation/sprints/clockin_backend/sprint_8.md
**Type:** Backend — Business Logic Services
**Depends On:** Sprint 2
**Gate:** STOP — Both services must be implemented and unit tested before Sprint 9
**Estimated Complexity:** High

---

## Code Quality Standard

> You are a **Google / Amazon / Apple senior-level engineer**. Every file you produce must be production-grade: clean, safe, fully typed, zero lint errors, zero runtime errors. No TODO comments, no placeholder code, no shortcuts.

---

## Objective

Implement the two most complex utility services in the time-clock module with **zero endpoints**. These are pure business logic services consumed by `ClockSessionService` in Sprint 9:

1. **OvertimeService** — Calculates daily and weekly overtime thresholds per employee/tenant settings (BR-006)
2. **LaborCostAttributionService** — Auto-posts `crew_hour_log` entries on clock-out, linking time-clock data to the financial module (BR-005)

Both services require thorough unit tests covering edge cases.

---

## Pre-Sprint Checklist
- [ ] Verify Sprint 2 is complete (employee profiles working, module compiles)
- [ ] Read `api/prisma/schema.prisma` — verify `employee_profile` fields: `overtime_rule_override`, `overtime_daily_threshold_hours`, `overtime_weekly_threshold_hours`, `hourly_rate`, `crew_member_id`
- [ ] Read `api/prisma/schema.prisma` — verify `time_clock_settings` fields: `overtime_enabled`, `overtime_daily_threshold_hours`, `overtime_weekly_threshold_hours`, `pay_period_type`, `pay_period_start_day`
- [ ] Read `api/prisma/schema.prisma` — verify `clock_session` fields: `regular_minutes`, `overtime_minutes`, `labor_cost_posted`, `labor_cost_entry_id`, `project_id`, `task_id`
- [ ] Read `api/prisma/schema.prisma` — verify `crew_hour_log` fields and `hour_log_source` enum (must include `'clockin_system'`)
- [ ] Read `api/prisma/schema.prisma` — verify `tenant` model has `timezone` field
- [ ] Read `api/src/modules/financial/services/crew-hour-log.service.ts` — understand `crew_hour_log` Prisma fields and the `logHours()` method (we will NOT use it — see LaborCostAttributionService notes)
- [ ] Read `api/src/modules/communication/services/notifications.service.ts` — exact `createNotification()` signature
- [ ] Read `api/src/modules/time-clock/services/time-clock-settings.service.ts` — understand settings retrieval pattern

---

## Environment

- **This project does NOT use PM2.**
- **Database credentials**: from `.env` file. Never hardcode.
- **Dev server**: `npm run start:dev` (watch mode)
- Port: 8000 | Prefix: api/v1 | Swagger: http://127.0.0.1:8000/api/docs
- Validation pipe: whitelist: true, forbidNonWhitelisted: true
- Tenant ID / User ID: ALWAYS from JWT, NEVER from body
- Every DB query MUST include tenant_id

---

## Dev Server

```
CHECK: lsof -i :8000
KILL if found: kill {PID} (then kill -9 if needed)
CONFIRM free: lsof -i :8000 → empty
START: cd /var/www/lead360.app/api && npm run start:dev
WAIT 60-120s for compile. Health check: curl -s http://localhost:8000/health → 200
KEEP running entire sprint. SHUTDOWN before marking complete.
```

**Test credentials:**
- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Tasks

### Task 1 — OvertimeService

**What:** Create `api/src/modules/time-clock/services/overtime.service.ts`.

**Imports required:**
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database';
```

**Constructor:**
```typescript
@Injectable()
export class OvertimeService {
  private readonly logger = new Logger(OvertimeService.name);

  constructor(private readonly prisma: PrismaService) {}
```

**Method: `calculateOvertime(params)`**

```typescript
async calculateOvertime(params: {
  tenantId: string;
  employeeProfileId: string;
  sessionId: string;
  totalWorkedMinutes: number;
  clockInAt: Date;
}): Promise<{ regular_minutes: number; overtime_minutes: number }> {
  const { tenantId, employeeProfileId, sessionId, totalWorkedMinutes, clockInAt } = params;
```

**Full algorithm (BR-006):**

```
Step 1: Get employee_profile (with overtime fields)
  - Query: employee_profile where id=employeeProfileId AND tenant_id=tenantId
  - Include: crew_member (for rate info, used by LaborCostAttributionService but fetched here for convenience)

Step 2: Get time_clock_settings for tenant
  - Query: time_clock_settings where tenant_id=tenantId
  - If not found, use defaults: overtime_enabled=false

Step 3: Resolve thresholds
  - If employee_profile.overtime_rule_override === true:
      dailyThreshold = employee_profile.overtime_daily_threshold_hours
      weeklyThreshold = employee_profile.overtime_weekly_threshold_hours
  - Else:
      dailyThreshold = settings.overtime_daily_threshold_hours
      weeklyThreshold = settings.overtime_weekly_threshold_hours

Step 4: Check if overtime is enabled
  - If settings.overtime_enabled === false:
      return { regular_minutes: totalWorkedMinutes, overtime_minutes: 0 }

Step 5: Get tenant timezone
  - Query: tenant where id=tenantId, select timezone
  - Default: "America/New_York" if null/undefined

Step 6: Compute calendar day boundaries in tenant timezone for clockInAt date
  - Convert clockInAt to tenant timezone
  - Get start of day (00:00:00) and end of day (23:59:59.999) in tenant timezone
  - Convert those boundaries back to UTC for Prisma queries

Step 7: Compute 7-day work week boundaries
  - pay_period_start_day from settings (default 0 = Sunday)
  - Work week is ALWAYS 7 days regardless of pay_period_type
  - Find the most recent start-of-week day that is on or before clockInAt
  - Week end = week start + 7 days

Step 8: Fetch prior COMPLETED sessions — same employee, same calendar day
  - Query: clock_session where tenant_id, employee_profile_id, status='completed',
    clock_in_at >= dayStart AND clock_in_at <= dayEnd, id != sessionId
  - Select: regular_minutes

Step 9: Fetch prior COMPLETED sessions — same employee, same work week
  - Query: clock_session where tenant_id, employee_profile_id, status='completed',
    clock_in_at >= weekStart AND clock_in_at < weekEnd, id != sessionId
  - Select: regular_minutes

Step 10: Sum prior regular_minutes
  - priorRegularToday = sum of regular_minutes from daily sessions
  - priorRegularThisWeek = sum of regular_minutes from weekly sessions

Step 11: Calculate remaining capacity
  - remainingDaily = Math.max(0, dailyThreshold * 60 - priorRegularToday)
  - remainingWeekly = Math.max(0, weeklyThreshold * 60 - priorRegularThisWeek)

Step 12: Compute split
  - regular_minutes = Math.min(totalWorkedMinutes, remainingDaily, remainingWeekly)
  - overtime_minutes = totalWorkedMinutes - regular_minutes

Step 13: Return
  - return { regular_minutes, overtime_minutes }
```

**Timezone handling notes:**
- Use a timezone library that is already available in the project (check `package.json` for `luxon`, `date-fns-tz`, `dayjs`, or `moment-timezone`). If none is available, use plain JavaScript `Date` with manual UTC offset calculations, or use `Intl.DateTimeFormat` for timezone resolution.
- The key requirement is: "today" is determined by the **tenant's timezone**, not UTC. An employee clocking in at 11 PM Eastern on Monday has their hours counted toward Monday, not Tuesday UTC.

---

### Task 2 — LaborCostAttributionService

**What:** Create `api/src/modules/time-clock/services/labor-cost-attribution.service.ts`.

**Imports required:**
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database';
import { NotificationsService } from '../../communication/services/notifications.service';
```

**Constructor:**
```typescript
@Injectable()
export class LaborCostAttributionService {
  private readonly logger = new Logger(LaborCostAttributionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}
```

**Method: `postLaborCost(session, employeeProfile, tenantId)`**

This method MUST NEVER throw. All errors are logged and notified, never re-thrown.

```typescript
async postLaborCost(
  session: any, // clock_session record with all fields
  employeeProfile: any, // employee_profile with crew_member included
  tenantId: string,
): Promise<void> {
```

**Full algorithm (BR-005):**

```
Step 1: Check if project is assigned
  - If session.project_id is null → skip entirely, return
  - No project = no labor cost to attribute

Step 2: Check if crew_member is linked
  - If employeeProfile.crew_member_id is null:
      this.logger.warn(`Employee profile ${employeeProfile.id} has no crew_member_id — skipping labor cost`)
      return

Step 3: Resolve hourly rate
  - rate = employeeProfile.hourly_rate ?? employeeProfile.crew_member?.default_hourly_rate
  - If rate is null (BOTH are null):
      this.logger.warn(`No hourly rate configured for employee ${employeeProfile.id} — skipping labor cost`)
      return

Step 4: Check idempotency
  - If session.labor_cost_posted === true:
      this.logger.log(`Labor cost already posted for session ${session.id} — skipping`)
      return

Step 5: Create crew_hour_log entry DIRECTLY via Prisma
  CRITICAL: Call prisma.crew_hour_log.create() DIRECTLY.
  Do NOT use CrewHourLogService.logHours() — it hardcodes source:'manual'.

  Get tenant timezone (query tenant where id=tenantId, select timezone, default "America/New_York")
  Compute log_date = clockInAt date in tenant timezone (YYYY-MM-DD)

  const entry = await this.prisma.crew_hour_log.create({
    data: {
      tenant_id: tenantId,
      crew_member_id: employeeProfile.crew_member_id,
      project_id: session.project_id,
      task_id: session.task_id ?? null,
      log_date: logDate,  // Date object for the calendar date in tenant timezone
      hours_regular: (session.regular_minutes || 0) / 60,
      hours_overtime: (session.overtime_minutes || 0) / 60,
      source: 'clockin_system',
      clockin_event_id: session.id,
      notes: null,
      created_by_user_id: employeeProfile.user_id,
    },
  });

Step 6: Update session on success
  await this.prisma.clock_session.update({
    where: { id: session.id },
    data: {
      labor_cost_posted: true,
      labor_cost_entry_id: entry.id,
    },
  });

Step 7: On failure — catch ALL errors
  In a try/catch wrapping Steps 5 and 6:
  - Log the error: this.logger.error(`Failed to post labor cost for session ${session.id}: ${error.message}`, error.stack)
  - Notify all tenant admins:
      1. Query users with Owner/Admin role for this tenant
      2. For each admin user, call:
         this.notificationsService.createNotification({
           tenant_id: tenantId,
           user_id: adminUser.id,
           type: 'timeclock_labor_cost_failed',
           title: 'Labor Cost Error',
           message: `Labor cost for ${employeeName} on ${logDate} could not be posted — manual action required`,
           action_url: '/workforce/timesheets',
           related_entity_type: 'clock_session',
           related_entity_id: session.id,
         })
  - Do NOT re-throw the error. The method must always return without throwing.
```

**Key design decisions:**
- **Never throws**: This service is called during clock-out. A failure to post labor cost should NOT prevent the clock-out from completing. Errors are logged and admin-notified.
- **Direct Prisma call**: We bypass `CrewHourLogService.logHours()` because it hardcodes `source: 'manual'`. We need `source: 'clockin_system'`.
- **Idempotency**: If `labor_cost_posted === true`, skip. This prevents duplicate entries if clock-out is retried.
- **Tenant admins notification**: Query all users with Owner or Admin role for the tenant. Send one notification per admin.

---

### Task 3 — Update Module Registration

**What:** Update `time-clock.module.ts` to register `OvertimeService` and `LaborCostAttributionService` as providers.

Ensure required imports:
- `CommunicationModule` must be imported (for `NotificationsService` used by `LaborCostAttributionService`)
- If `CommunicationModule` is not already imported, add it

---

### Task 4 — Unit Tests for OvertimeService

**What:** Create `api/src/modules/time-clock/services/overtime.service.spec.ts`.

**Test cases (minimum required):**

1. **OT disabled** — `overtime_enabled = false` → returns `{ regular_minutes: totalWorkedMinutes, overtime_minutes: 0 }`
2. **Under daily threshold** — 6 hours worked, daily threshold 8h, no prior sessions → `regular_minutes: 360, overtime_minutes: 0`
3. **Daily threshold exceeded** — 10 hours worked, daily threshold 8h, no prior sessions → `regular_minutes: 480, overtime_minutes: 120`
4. **Daily threshold exceeded with prior sessions** — 4 hours worked, daily threshold 8h, prior 6 hours today → `regular_minutes: 120, overtime_minutes: 120` (only 2h remaining in daily cap)
5. **Weekly threshold exceeded** — 8 hours worked, weekly threshold 40h, prior 36h this week → `regular_minutes: 240, overtime_minutes: 240` (only 4h remaining in weekly cap)
6. **Both daily and weekly exceeded** — whichever is tighter wins (regular_minutes = min of all three: totalWorkedMinutes, remainingDaily, remainingWeekly)
7. **Employee override** — `overtime_rule_override = true` with employee-specific thresholds (e.g., daily 10h, weekly 50h) → uses employee thresholds, not tenant
8. **No employee override** — `overtime_rule_override = false` → uses tenant settings thresholds

**Mock:** Mock `PrismaService` with jest. Provide controlled return values for `employee_profile.findFirst`, `time_clock_settings.findFirst`, `tenant.findFirst`, and `clock_session.findMany`.

---

### Task 5 — Unit Tests for LaborCostAttributionService

**What:** Create `api/src/modules/time-clock/services/labor-cost-attribution.service.spec.ts`.

**Test cases (minimum required):**

1. **No project** — `session.project_id = null` → skips entirely, no Prisma call, no notification
2. **No crew_member** — `employeeProfile.crew_member_id = null` → skips, logs warning
3. **No hourly rate** — both `employeeProfile.hourly_rate` and `crew_member.default_hourly_rate` are null → skips, logs warning "No hourly rate configured"
4. **Idempotency** — `session.labor_cost_posted = true` → skips, no duplicate entry created
5. **Happy path** — project set, crew_member linked, rate available, not yet posted → creates `crew_hour_log` with `source: 'clockin_system'`, updates session `labor_cost_posted: true`
6. **Uses employee hourly_rate when available** — `employeeProfile.hourly_rate = 25` → uses 25, not crew_member.default_hourly_rate
7. **Falls back to crew_member rate** — `employeeProfile.hourly_rate = null`, `crew_member.default_hourly_rate = 20` → uses 20
8. **Failure handling** — `prisma.crew_hour_log.create()` throws → logs error, notifies admins, does NOT re-throw
9. **Admin notification on failure** — verify `notificationsService.createNotification` called for each admin user with correct payload (type: 'timeclock_labor_cost_failed', title: 'Labor Cost Error', action_url: '/workforce/timesheets')

**Mock:** Mock `PrismaService` and `NotificationsService` with jest. For failure test, make `prisma.crew_hour_log.create` reject with an Error.

---

### Task 6 — Compile and Verify

1. Run `npm run lint` — must pass with zero errors
2. Start dev server — must compile successfully
3. Run unit tests: `npx jest --testPathPattern=overtime.service.spec` and `npx jest --testPathPattern=labor-cost-attribution.service.spec`
4. All tests must pass
5. Shut down dev server

---

## Integration Points
- `PrismaService` — `api/src/core/database/prisma.service.ts`
- `NotificationsService` — `api/src/modules/communication/services/notifications.service.ts`
- `crew_hour_log` table — direct Prisma access (NOT through CrewHourLogService)
- `tenant.timezone` — for calendar day / work week boundary calculations

---

## Business Rules Enforced in This Sprint

### BR-006: Overtime Calculation
- Overtime is opt-in per tenant (`overtime_enabled`)
- Daily and weekly thresholds are configurable at tenant level
- Employees can override tenant thresholds (`overtime_rule_override = true`)
- Work week is always 7 days, starting on `pay_period_start_day` (default Sunday)
- Calendar day boundaries use tenant timezone, not UTC
- Prior completed sessions are summed to determine remaining capacity
- `regular_minutes = min(totalWorkedMinutes, remainingDaily, remainingWeekly)`
- `overtime_minutes = totalWorkedMinutes - regular_minutes`

### BR-005: Labor Cost Attribution
- Only applies when session has a `project_id`
- Requires `crew_member_id` on the employee profile
- Hourly rate: employee override > crew_member default > skip with warning
- Idempotent: checks `labor_cost_posted` flag before creating entry
- Source is `'clockin_system'` (not 'manual')
- Never throws: errors logged + admin notified
- Creates one `crew_hour_log` entry per completed clock session

---

## Acceptance Criteria
- [ ] OvertimeService implemented with `calculateOvertime()` method
- [ ] LaborCostAttributionService implemented with `postLaborCost()` method
- [ ] OvertimeService handles: OT disabled, daily exceeded, weekly exceeded, both exceeded, employee override
- [ ] LaborCostAttributionService handles: no project, no crew_member, no rate, idempotency, success, failure
- [ ] LaborCostAttributionService NEVER throws — all errors caught, logged, and notified
- [ ] LaborCostAttributionService uses `prisma.crew_hour_log.create()` directly (NOT CrewHourLogService.logHours())
- [ ] LaborCostAttributionService sets `source: 'clockin_system'`
- [ ] Unit tests for OvertimeService (minimum 8 test cases)
- [ ] Unit tests for LaborCostAttributionService (minimum 9 test cases)
- [ ] Both services registered in time-clock.module.ts
- [ ] CommunicationModule imported in TimeClockModule (for NotificationsService)
- [ ] All Prisma queries include `tenant_id` filter
- [ ] `npm run lint` passes
- [ ] All unit tests pass
- [ ] No frontend code modified
- [ ] Dev server compiles cleanly
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — Both services must be implemented and all unit tests must pass before Sprint 9 begins. Sprint 9 (ClockSessionService) directly calls both `OvertimeService.calculateOvertime()` and `LaborCostAttributionService.postLaborCost()` during the clock-out flow.

---

## Handoff Notes
- `OvertimeService.calculateOvertime()` is called by `ClockSessionService.clockOut()` in Sprint 9 to compute the regular/overtime split before persisting the session
- `LaborCostAttributionService.postLaborCost()` is called by `ClockSessionService.clockOut()` in Sprint 9 after overtime calculation completes
- The `crew_hour_log` entries created by `LaborCostAttributionService` appear in the financial module's crew hours reports and project cost tracking
- The `clockin_event_id` field on `crew_hour_log` enables traceability from financial data back to the original clock session
- These are the two most complex services in the time-clock module — they must be bullet-proof before Sprint 9
