# Sprint 15 — Dashboard + Reports + Payroll CSV Export (7 Endpoints)
**Module:** time-clock
**File:** ./documentation/sprints/clockin_backend/sprint_15.md
**Type:** Backend — Reports
**Depends On:** Sprint 9 (Clock Sessions), Sprint 11 (Manual Edit)
**Gate:** NONE
**Estimated Complexity:** Medium

---

## Code Quality Standard

> You are a **Google / Amazon / Apple senior-level engineer**. Every file you produce must be production-grade: clean, safe, fully typed, zero lint errors, zero runtime errors. No TODO comments, no placeholder code, no shortcuts. Review your own output as if submitting a PR to a FAANG codebase.

---

## Objective

Implement the Dashboard endpoint (who's currently clocked in), all 6 Report endpoints (timesheet, payroll, payroll CSV export, shift variance, geo-violations, activity feed), and the controllers to expose them. This sprint produces 7 endpoints total: 1 dashboard + 6 reports.

---

## Pre-Sprint Checklist
- [ ] Verify Sprint 9 is complete (clock-in/out, session listing all working)
- [ ] Verify Sprint 11 is complete (manual edit, edit log all working)
- [ ] Read `api/src/modules/time-clock/time-clock.module.ts` — verify all existing services registered
- [ ] Read `api/src/modules/time-clock/services/geofence.service.ts` — understand haversine helper signature
- [ ] Read `api/src/modules/time-clock/services/overtime.service.ts` — understand threshold resolution
- [ ] Read `api/src/modules/audit/services/audit-logger.service.ts` — exact `logTenantChange()` signature
- [ ] Read `api/prisma/schema.prisma` — verify all time-clock models are present
- [ ] Read `api/src/modules/time-clock/services/clock-session.service.ts` — understand session query patterns

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

### Task 1 — Dashboard + Reports DTOs

**What:** Create `api/src/modules/time-clock/dto/dashboard.dto.ts` and `api/src/modules/time-clock/dto/reports.dto.ts` (or add to existing DTO files if they already exist as placeholders).

#### dashboard.dto.ts

No request DTO is needed for the dashboard endpoint (no query parameters).

#### reports.dto.ts

**TimesheetReportDto** (query params):
```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class TimesheetReportDto {
  @ApiProperty({ description: 'Start date (inclusive)', example: '2026-04-01' })
  @IsDateString()
  date_from: string;

  @ApiProperty({ description: 'End date (inclusive)', example: '2026-04-15' })
  @IsDateString()
  date_to: string;

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
}
```

**PayrollReportDto** (query params):
```typescript
export class PayrollReportDto {
  @ApiProperty({ description: 'Start date (inclusive)', example: '2026-04-01' })
  @IsDateString()
  date_from: string;

  @ApiProperty({ description: 'End date (inclusive)', example: '2026-04-15' })
  @IsDateString()
  date_to: string;

  @ApiPropertyOptional({ description: 'Filter by employee profile ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;
}
```

**ShiftVarianceReportDto** (query params):
```typescript
export class ShiftVarianceReportDto {
  @ApiProperty({ description: 'Start date (inclusive)', example: '2026-04-01' })
  @IsDateString()
  date_from: string;

  @ApiProperty({ description: 'End date (inclusive)', example: '2026-04-15' })
  @IsDateString()
  date_to: string;

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
}
```

**GeoViolationsReportDto** (query params):
```typescript
import { Type } from 'class-transformer';
import { IsInt, Min, Max } from 'class-validator';

export class GeoViolationsReportDto {
  @ApiProperty({ description: 'Start date (inclusive)', example: '2026-04-01' })
  @IsDateString()
  date_from: string;

  @ApiProperty({ description: 'End date (inclusive)', example: '2026-04-15' })
  @IsDateString()
  date_to: string;

  @ApiPropertyOptional({ description: 'Filter by employee profile ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;

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
}
```

**ActivityFeedDto** (query params):
```typescript
export class ActivityFeedDto {
  @ApiPropertyOptional({ description: 'Number of events to return', default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by employee profile ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;

  @ApiPropertyOptional({ description: 'Cursor: return events before this timestamp (ISO DateString)' })
  @IsOptional()
  @IsDateString()
  after?: string;
}
```

---

### Task 2 — TimeClockDashboardService

**What:** Create `api/src/modules/time-clock/services/time-clock-dashboard.service.ts`

**Constructor dependencies:**
- `PrismaService` (from `../../core/database/prisma.service`)

**Method: `getWhosIn(tenantId: string)`**

**Logic:**
1. Query `clock_session` where `tenant_id = tenantId` AND `status IN ('active', 'on_break')`
2. Include:
   - `employee_profile` with nested `user: { select: { id, first_name, last_name } }`
   - `project: { select: { id, name } }`
   - `task: { select: { id, title } }`
   - `clockin_address: { select: { label } }`
   - `break_entries` where `ended_at IS NULL` (active break only)
3. For each session, compute `elapsed_minutes = Math.floor((Date.now() - new Date(session.clock_in_at).getTime()) / 60000)`
4. Count `total_clocked_in` = sessions where `status = 'active'` count
5. Count `total_on_break` = sessions where `status = 'on_break'` count
6. For each session, set `current_break`:
   - If there is a `break_entry` where `ended_at IS NULL`: return `{ id, break_type, break_label, started_at }`
   - Otherwise: `null`
7. Return the response shape exactly as specified

**Response shape:**
```json
{
  "total_clocked_in": 5,
  "total_on_break": 1,
  "employees": [
    {
      "employee_profile_id": "uuid",
      "user": { "id": "uuid", "first_name": "John", "last_name": "Doe" },
      "session": {
        "id": "uuid",
        "status": "active",
        "clock_in_at": "2026-04-10T08:00:00.000Z",
        "elapsed_minutes": 240,
        "project": { "id": "uuid", "name": "Kitchen Renovation" },
        "task": { "id": "uuid", "title": "Drywall" },
        "clockin_address": { "label": "Home Depot Waltham" },
        "is_flagged": false,
        "current_break": null
      }
    }
  ]
}
```

**IMPORTANT:**
- `total_clocked_in` counts ALL sessions with status `active` (not on_break)
- `total_on_break` counts ALL sessions with status `on_break`
- Both groups appear in the `employees` array
- `elapsed_minutes` is computed live: `Math.floor((Date.now() - new Date(session.clock_in_at).getTime()) / 60000)`
- All Prisma queries MUST include `tenant_id` filter

---

### Task 3 — TimeClockReportsService

**What:** Create `api/src/modules/time-clock/services/time-clock-reports.service.ts`

**Constructor dependencies:**
- `PrismaService` (from `../../core/database/prisma.service`)
- `GeofenceService` (from `./geofence.service`) -- for nearest address calculation in geo-violations
- `AuditLoggerService` (from `../../audit/services/audit-logger.service`) -- for payroll export audit

**Methods:**

#### 3a. `getTimesheetReport(tenantId: string, query: TimesheetReportDto)`

**Logic:**
1. Parse `date_from` and `date_to` into Date objects. Set time range: `clock_in_at >= date_from (start of day)` AND `clock_in_at < date_to + 1 day (start of next day)`.
2. Build where clause: `{ tenant_id: tenantId, status: 'completed', clock_in_at: { gte: dateFrom, lt: dateTo } }`
3. If `query.employee_profile_id` provided, add `employee_profile_id` filter.
4. If `query.project_id` provided, add `project_id` filter.
5. Include: `employee_profile` with `user: { select: { id, first_name, last_name } }`, `project: { select: { id, name } }`, `task: { select: { id, title } }`
6. Sort by `employee_profile_id ASC`, then `clock_in_at ASC`.
7. Group results by employee, then by day (extract date portion from `clock_in_at`).
8. For each day: compute `day_regular_minutes`, `day_overtime_minutes`, `day_total_minutes` by summing session values.
9. For each employee: compute `total_regular_minutes`, `total_overtime_minutes`, `total_sessions`.
10. Return the response shape.

**Response shape:**
```json
{
  "date_from": "2026-04-01",
  "date_to": "2026-04-15",
  "employees": [
    {
      "employee_profile_id": "uuid",
      "user": { "id": "uuid", "first_name": "John", "last_name": "Doe" },
      "total_regular_minutes": 2400,
      "total_overtime_minutes": 120,
      "total_sessions": 10,
      "days": [
        {
          "date": "2026-04-01",
          "sessions": [
            {
              "id": "uuid",
              "clock_in_at": "2026-04-01T08:00:00.000Z",
              "clock_out_at": "2026-04-01T16:30:00.000Z",
              "total_worked_minutes": 480,
              "regular_minutes": 480,
              "overtime_minutes": 0,
              "project": { "id": "uuid", "name": "Kitchen Renovation" },
              "task": null,
              "is_flagged": false,
              "is_manual_edit": false
            }
          ],
          "day_regular_minutes": 480,
          "day_overtime_minutes": 0,
          "day_total_minutes": 480
        }
      ]
    }
  ]
}
```

#### 3b. `getPayrollReport(tenantId: string, query: PayrollReportDto)`

**Logic:**
1. Parse date range same as timesheet.
2. Fetch all completed sessions in the date range (filtered by `employee_profile_id` if provided).
3. Include `employee_profile` with `user: { select: { id, first_name, last_name, email } }` and `crew_member: { select: { default_hourly_rate } }`.
4. Fetch `time_clock_settings` for the tenant to get `overtime_multiplier`.
5. Group sessions by employee. For each employee:
   - Resolve `hourly_rate`: use `employee_profile.hourly_rate` if set; else use `employee_profile.crew_member.default_hourly_rate`; else default to `0`.
   - Sum `regular_minutes` across all sessions -> convert to hours: `regular_hours = sum / 60` (round to 2 decimal places).
   - Sum `overtime_minutes` -> convert to hours: `overtime_hours = sum / 60`.
   - Resolve `overtime_multiplier`: from `time_clock_settings.overtime_multiplier` (or employee override if `overtime_rule_override = true`). Default `1.50`.
   - Compute: `regular_pay = regular_hours * hourly_rate`
   - Compute: `overtime_pay = overtime_hours * hourly_rate * overtime_multiplier`
   - Compute: `total_pay = regular_pay + overtime_pay`
   - Count `sessions_count`.
   - Count `flagged_sessions` (where `is_flagged = true`).
   - Count `manual_edits` (where `is_manual_edit = true`).
6. Compute summary: `total_employees`, `total_regular_hours`, `total_overtime_hours`, `total_regular_pay`, `total_overtime_pay`, `total_pay`.
7. Return the response shape.

**Response shape:**
```json
{
  "date_from": "2026-04-01",
  "date_to": "2026-04-15",
  "summary": {
    "total_employees": 5,
    "total_regular_hours": 320.5,
    "total_overtime_hours": 12.0,
    "total_regular_pay": 8012.50,
    "total_overtime_pay": 450.00,
    "total_pay": 8462.50
  },
  "employees": [
    {
      "employee_profile_id": "uuid",
      "user": { "id": "uuid", "first_name": "John", "last_name": "Doe", "email": "john@example.com" },
      "hourly_rate": 25.00,
      "regular_hours": 80.0,
      "overtime_hours": 4.0,
      "overtime_multiplier": 1.50,
      "regular_pay": 2000.00,
      "overtime_pay": 150.00,
      "total_pay": 2150.00,
      "sessions_count": 10,
      "flagged_sessions": 0,
      "manual_edits": 1
    }
  ]
}
```

#### 3c. `exportPayrollCsv(tenantId: string, userId: string, query: PayrollReportDto): Promise<{ csv: string; filename: string }>`

**Logic:**
1. Call `getPayrollReport(tenantId, query)` to get the same data.
2. Build CSV string with headers: `Employee Name,Employee ID,Hourly Rate,Regular Hours,Overtime Hours,Overtime Multiplier,Regular Pay,Overtime Pay,Total Pay,Sessions Count,Flagged Sessions,Manual Edits`
3. For each employee row: format as CSV line. Use double-quote escaping for fields that may contain commas.
4. Build filename: `payroll_${query.date_from}_${query.date_to}.csv`
5. **Audit log**: Call `this.auditLogger.logTenantChange({ action: 'accessed' as any, entityType: 'payroll_export', entityId: 'payroll_export', tenantId, actorUserId: userId, metadata: { date_from: query.date_from, date_to: query.date_to }, description: 'Exported payroll report to CSV' })`
6. Return `{ csv, filename }`.

**CSV columns (in order):**
```
Employee Name,Employee ID,Hourly Rate,Regular Hours,Overtime Hours,Overtime Multiplier,Regular Pay,Overtime Pay,Total Pay,Sessions Count,Flagged Sessions,Manual Edits
```

**IMPORTANT:**
- `Employee Name` = `"${user.first_name} ${user.last_name}"`
- `Employee ID` = `employee_profile_id`
- All monetary values formatted to 2 decimal places
- Hours formatted to 2 decimal places

#### 3d. `getShiftVarianceReport(tenantId: string, query: ShiftVarianceReportDto)`

**Logic:**
1. Parse date range.
2. Query `work_shift` where `tenant_id = tenantId` AND `scheduled_start >= date_from` AND `scheduled_start < date_to + 1 day`.
3. If `query.employee_profile_id` provided, add filter.
4. If `query.project_id` provided, add filter.
5. Include: `employee_profile` with `user`, `project`, linked `clock_sessions` (via `work_shift_id` on clock_session).
6. For each shift:
   - `scheduled_minutes = Math.floor((scheduled_end - scheduled_start) / 60000)`
   - If shift has a linked `clock_session` (matched via `clock_sessions` relation or `work_shift_id`):
     - `actual_clock_in_at = session.clock_in_at`
     - `actual_clock_out_at = session.clock_out_at`
     - `actual_worked_minutes = session.total_worked_minutes`
     - `variance_start_minutes = Math.floor((actual_clock_in_at - scheduled_start) / 60000)` -- positive = late, negative = early
     - `variance_end_minutes = Math.floor((actual_clock_out_at - scheduled_end) / 60000)` -- positive = stayed late, negative = left early
     - `variance_total_minutes = actual_worked_minutes - scheduled_minutes` -- positive = worked more, negative = worked less
     - `session_id = session.id`
   - If shift `status = 'missed'` or no linked session:
     - `actual_clock_in_at = null`
     - `actual_clock_out_at = null`
     - `actual_worked_minutes = null`
     - `variance_start_minutes = null`
     - `variance_end_minutes = null`
     - `variance_total_minutes = null`
     - `session_id = null`
7. Paginate results (default page=1, limit=20).
8. Return with `meta` pagination object.

**Response shape:**
```json
{
  "date_from": "2026-04-01",
  "date_to": "2026-04-15",
  "data": [
    {
      "work_shift_id": "uuid",
      "employee_profile_id": "uuid",
      "user": { "id": "uuid", "first_name": "John", "last_name": "Doe" },
      "project": { "id": "uuid", "name": "Kitchen Renovation" },
      "scheduled_start": "2026-04-01T08:00:00.000Z",
      "scheduled_end": "2026-04-01T16:00:00.000Z",
      "scheduled_minutes": 480,
      "actual_clock_in_at": "2026-04-01T08:12:00.000Z",
      "actual_clock_out_at": "2026-04-01T16:45:00.000Z",
      "actual_worked_minutes": 493,
      "variance_start_minutes": 12,
      "variance_end_minutes": 45,
      "variance_total_minutes": 13,
      "shift_status": "completed",
      "session_id": "uuid"
    }
  ],
  "meta": { "total": 25, "page": 1, "limit": 20, "totalPages": 2 }
}
```

#### 3e. `getGeoViolationsReport(tenantId: string, query: GeoViolationsReportDto)`

**Logic:**
1. Parse date range.
2. Query `clock_session` where:
   - `tenant_id = tenantId`
   - `is_flagged = true`
   - `clock_in_geofence_status IN ('outside', 'unavailable')`
   - `clock_in_at >= date_from` AND `clock_in_at < date_to + 1 day`
3. If `query.employee_profile_id` provided, add filter.
4. Include: `employee_profile` with `user`, `project`.
5. Paginate with `query.page` (default 1) and `query.limit` (default 20).
6. For each session: compute `nearest_address` by:
   - If `clock_in_latitude` and `clock_in_longitude` are not null:
     - Query active `clockin_address` records for this tenant.
     - Compute haversine distance from session GPS to each address (use `GeofenceService.haversineDistance()` or inline the calculation).
     - Return the closest address: `{ id, label, distance_meters }`.
   - If GPS coords are null (GPS was unavailable): `nearest_address = null`.
7. Return paginated response.

**Response shape:**
```json
{
  "data": [
    {
      "session_id": "uuid",
      "employee_profile_id": "uuid",
      "user": { "id": "uuid", "first_name": "John", "last_name": "Doe" },
      "clock_in_at": "2026-04-05T08:15:00.000Z",
      "clock_in_latitude": 42.37627,
      "clock_in_longitude": -71.23567,
      "clock_in_geofence_status": "outside",
      "is_flagged": true,
      "flag_reason": "Outside all configured locations -- 350m from nearest",
      "nearest_address": { "id": "uuid", "label": "Home Depot Waltham", "distance_meters": 350 },
      "project": { "id": "uuid", "name": "Kitchen Renovation" },
      "status": "completed"
    }
  ],
  "meta": { "total": 3, "page": 1, "limit": 20, "totalPages": 1 }
}
```

**IMPORTANT:** `nearest_address` is computed at query time, not stored. Use active addresses only for the re-calculation. If no addresses exist at all, return `nearest_address = null`.

#### 3f. `getActivityFeed(tenantId: string, query: ActivityFeedDto)`

**Logic:**

This method builds a unified event feed from multiple source tables. The approach is to query each source independently, merge, sort by timestamp DESC, and apply cursor pagination.

**Event sources and types:**

| Source Table | Event Type | Timestamp Field | Notes |
|---|---|---|---|
| `clock_session` | `clock_in` | `clock_in_at` | All sessions |
| `clock_session` | `clock_out` | `clock_out_at` | Only completed sessions (clock_out_at IS NOT NULL) |
| `break_entry` | `break_start` | `started_at` | All breaks |
| `break_entry` | `break_end` | `ended_at` | Only ended breaks (ended_at IS NOT NULL) |
| `time_dispute` | `dispute_submitted` | `created_at` | All disputes |
| `time_dispute` | `dispute_approved` | `reviewed_at` | Where status = 'approved' AND reviewed_at IS NOT NULL |
| `time_dispute` | `dispute_rejected` | `reviewed_at` | Where status = 'rejected' AND reviewed_at IS NOT NULL |
| `clock_session_edit_log` | `manual_edit` | `edited_at` | All edit logs |
| `work_shift` | `shift_missed` | `updated_at` | Where status = 'missed' |

**Implementation steps:**
1. Define the `limit` (default 50, max 200).
2. If `query.after` is provided, add cursor filter: only return events where timestamp < `after` value.
3. If `query.employee_profile_id` is provided, filter all queries by that employee.
4. For each source table, run a Prisma query with `tenant_id` filter, optional employee filter, optional cursor filter. Fetch up to `limit` records from each source (over-fetch to ensure enough after merge).
5. Include `employee_profile.user: { select: { id, first_name, last_name } }` on each query.
6. Include `project: { select: { id, name } }` where available (clock_session, work_shift have project).
7. Map each raw record to a unified event shape:
   ```typescript
   interface ActivityEvent {
     event_type: string;
     timestamp: string; // ISO
     employee_profile_id: string;
     user: { id: string; first_name: string; last_name: string };
     session_id: string | null;
     project: { id: string; name: string } | null;
     details: Record<string, any>;
   }
   ```
8. Merge all events into a single array.
9. Sort by `timestamp DESC`.
10. Slice to `limit` entries.
11. Return `{ data: events }`.

**Event details mapping:**
- `clock_in`: `details = {}` (or `{ notes: session.notes }` if present)
- `clock_out`: `details = { total_worked_minutes, regular_minutes, overtime_minutes }`
- `break_start`: `details = { break_type, break_label }`
- `break_end`: `details = { break_type, break_label, duration_minutes }`
- `dispute_submitted`: `details = { dispute_type, dispute_id }`
- `dispute_approved`: `details = { dispute_type, dispute_id, review_notes }`
- `dispute_rejected`: `details = { dispute_type, dispute_id, review_notes }`
- `manual_edit`: `details = { field_changed, original_value, new_value, reason, edited_by_user_id }`
- `shift_missed`: `details = { shift_id, scheduled_start, scheduled_end }`

**Response shape:**
```json
{
  "data": [
    {
      "event_type": "clock_in",
      "timestamp": "2026-04-10T08:00:00.000Z",
      "employee_profile_id": "uuid",
      "user": { "id": "uuid", "first_name": "John", "last_name": "Doe" },
      "session_id": "uuid",
      "project": { "id": "uuid", "name": "Kitchen Renovation" },
      "details": {}
    },
    {
      "event_type": "break_start",
      "timestamp": "2026-04-10T12:00:00.000Z",
      "employee_profile_id": "uuid",
      "user": { "id": "uuid", "first_name": "John", "last_name": "Doe" },
      "session_id": "uuid",
      "project": null,
      "details": { "break_type": "unpaid", "break_label": "Lunch" }
    },
    {
      "event_type": "dispute_submitted",
      "timestamp": "2026-04-10T17:00:00.000Z",
      "employee_profile_id": "uuid",
      "user": { "id": "uuid", "first_name": "Jane", "last_name": "Smith" },
      "session_id": "uuid",
      "project": null,
      "details": { "dispute_type": "correction_request", "dispute_id": "uuid" }
    }
  ]
}
```

---

### Task 4 — TimeClockDashboardController

**What:** Create `api/src/modules/time-clock/controllers/time-clock-dashboard.controller.ts`

```typescript
import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { Roles } from '../../rbac/decorators/roles.decorator';
import { TimeClockDashboardService } from '../services/time-clock-dashboard.service';

@ApiTags('Time Clock')
@ApiBearerAuth()
@Controller('time-clock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimeClockDashboardController {
  constructor(private readonly dashboardService: TimeClockDashboardService) {}

  @Get('dashboard/whos-in')
  @Roles('Owner', 'Admin', 'Project Manager')
  @ApiOperation({ summary: "Get who's currently clocked in" })
  @ApiResponse({ status: 200, description: 'Current clock-in status of all employees' })
  async getWhosIn(@Request() req) {
    return this.dashboardService.getWhosIn(req.user.tenant_id);
  }
}
```

---

### Task 5 — TimeClockReportsController

**What:** Create `api/src/modules/time-clock/controllers/time-clock-reports.controller.ts`

```typescript
import { Controller, Get, Query, Request, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { Roles } from '../../rbac/decorators/roles.decorator';
import { TimeClockReportsService } from '../services/time-clock-reports.service';
import {
  TimesheetReportDto,
  PayrollReportDto,
  ShiftVarianceReportDto,
  GeoViolationsReportDto,
  ActivityFeedDto,
} from '../dto/reports.dto';

@ApiTags('Time Clock')
@ApiBearerAuth()
@Controller('time-clock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimeClockReportsController {
  constructor(private readonly reportsService: TimeClockReportsService) {}

  @Get('reports/timesheet')
  @Roles('Owner', 'Admin', 'Project Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Get timesheet report grouped by employee and day' })
  @ApiResponse({ status: 200, description: 'Timesheet report' })
  async getTimesheetReport(@Request() req, @Query() query: TimesheetReportDto) {
    return this.reportsService.getTimesheetReport(req.user.tenant_id, query);
  }

  @Get('reports/payroll')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Get payroll summary report' })
  @ApiResponse({ status: 200, description: 'Payroll report with pay calculations' })
  async getPayrollReport(@Request() req, @Query() query: PayrollReportDto) {
    return this.reportsService.getPayrollReport(req.user.tenant_id, query);
  }

  @Get('reports/payroll/export')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Export payroll report as CSV file' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  async exportPayrollCsv(@Request() req, @Query() query: PayrollReportDto, @Res() res: Response) {
    const { csv, filename } = await this.reportsService.exportPayrollCsv(
      req.user.tenant_id,
      req.user.id,
      query,
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Get('reports/shift-variance')
  @Roles('Owner', 'Admin', 'Project Manager')
  @ApiOperation({ summary: 'Get shift variance report' })
  @ApiResponse({ status: 200, description: 'Shift variance data with scheduled vs actual' })
  async getShiftVarianceReport(@Request() req, @Query() query: ShiftVarianceReportDto) {
    return this.reportsService.getShiftVarianceReport(req.user.tenant_id, query);
  }

  @Get('reports/geo-violations')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Get geo-violation report' })
  @ApiResponse({ status: 200, description: 'Sessions flagged for geofence violations' })
  async getGeoViolationsReport(@Request() req, @Query() query: GeoViolationsReportDto) {
    return this.reportsService.getGeoViolationsReport(req.user.tenant_id, query);
  }

  @Get('reports/activity-feed')
  @Roles('Owner', 'Admin', 'Project Manager')
  @ApiOperation({ summary: 'Get activity feed of recent time clock events' })
  @ApiResponse({ status: 200, description: 'Unified activity feed' })
  async getActivityFeed(@Request() req, @Query() query: ActivityFeedDto) {
    return this.reportsService.getActivityFeed(req.user.tenant_id, query);
  }
}
```

**IMPORTANT for payroll export:**
- Use `@Res() res: Response` to send the CSV directly. This bypasses NestJS's automatic JSON serialization.
- Set `Content-Type: text/csv` and `Content-Disposition: attachment; filename="payroll_{date_from}_{date_to}.csv"`.

---

### Task 6 — Update Module Registration

**What:** Update `api/src/modules/time-clock/time-clock.module.ts`:
1. Import `TimeClockDashboardController` and `TimeClockReportsController` into the `controllers` array.
2. Import `TimeClockDashboardService` and `TimeClockReportsService` into the `providers` array.
3. Ensure `GeofenceService` and `AuditLoggerService` (via `AuditModule`) are available for injection.

Verify these are not already registered as placeholders. If they are, replace the placeholders with real implementations.

---

### Task 7 — Verify All 7 Endpoints

Test with JWT from admin login. For each endpoint, verify:

1. **GET /api/v1/time-clock/dashboard/whos-in** -- returns employee status list (create test clock-in session first if needed)
2. **GET /api/v1/time-clock/reports/timesheet?date_from=2026-04-01&date_to=2026-04-15** -- returns grouped timesheet data
3. **GET /api/v1/time-clock/reports/payroll?date_from=2026-04-01&date_to=2026-04-15** -- returns payroll breakdown with pay calculations
4. **GET /api/v1/time-clock/reports/payroll/export?date_from=2026-04-01&date_to=2026-04-15** -- returns CSV file download with correct headers
5. **GET /api/v1/time-clock/reports/shift-variance?date_from=2026-04-01&date_to=2026-04-15** -- returns shift variance data
6. **GET /api/v1/time-clock/reports/geo-violations?date_from=2026-04-01&date_to=2026-04-15** -- returns flagged sessions
7. **GET /api/v1/time-clock/reports/activity-feed** -- returns unified event feed

**Curl template for all tests:**
```bash
# Get JWT token first
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

# Dashboard
curl -s http://localhost:8000/api/v1/time-clock/dashboard/whos-in \
  -H "Authorization: Bearer $TOKEN" | jq .

# Timesheet
curl -s "http://localhost:8000/api/v1/time-clock/reports/timesheet?date_from=2026-04-01&date_to=2026-04-15" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Payroll
curl -s "http://localhost:8000/api/v1/time-clock/reports/payroll?date_from=2026-04-01&date_to=2026-04-15" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Payroll Export (CSV)
curl -s "http://localhost:8000/api/v1/time-clock/reports/payroll/export?date_from=2026-04-01&date_to=2026-04-15" \
  -H "Authorization: Bearer $TOKEN" -D - -o payroll.csv
# Verify Content-Type: text/csv and Content-Disposition headers

# Shift Variance
curl -s "http://localhost:8000/api/v1/time-clock/reports/shift-variance?date_from=2026-04-01&date_to=2026-04-15" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Geo Violations
curl -s "http://localhost:8000/api/v1/time-clock/reports/geo-violations?date_from=2026-04-01&date_to=2026-04-15" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Activity Feed
curl -s "http://localhost:8000/api/v1/time-clock/reports/activity-feed?limit=50" \
  -H "Authorization: Bearer $TOKEN" | jq .

# Activity Feed with filter
curl -s "http://localhost:8000/api/v1/time-clock/reports/activity-feed?limit=10&employee_profile_id={uuid}" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## Business Rules Enforced in This Sprint
- **BR-006**: Overtime thresholds used in payroll calculations
- **BR-008**: Manual edit tracking surfaced in reports
- **BR-012**: Pay period boundaries for payroll date range context

---

## Integration Points
- `PrismaService` -- `api/src/core/database/prisma.service.ts`
- `GeofenceService` -- `api/src/modules/time-clock/services/geofence.service.ts` (haversine for geo-violations)
- `AuditLoggerService` -- `api/src/modules/audit/services/audit-logger.service.ts` (payroll export audit)

---

## Files Created in This Sprint

| File | Purpose |
|---|---|
| `api/src/modules/time-clock/dto/dashboard.dto.ts` | Dashboard DTO (none needed currently, placeholder) |
| `api/src/modules/time-clock/dto/reports.dto.ts` | TimesheetReportDto, PayrollReportDto, ShiftVarianceReportDto, GeoViolationsReportDto, ActivityFeedDto |
| `api/src/modules/time-clock/services/time-clock-dashboard.service.ts` | Dashboard getWhosIn() method |
| `api/src/modules/time-clock/services/time-clock-reports.service.ts` | 6 report methods (timesheet, payroll, export, shift-variance, geo-violations, activity-feed) |
| `api/src/modules/time-clock/controllers/time-clock-dashboard.controller.ts` | 1 dashboard endpoint |
| `api/src/modules/time-clock/controllers/time-clock-reports.controller.ts` | 6 report endpoints |

---

## Acceptance Criteria
- [ ] All 6 report DTOs created with full validation
- [ ] TimeClockDashboardService with `getWhosIn()` method
- [ ] TimeClockReportsService with 6 methods (timesheet, payroll, payroll export, shift-variance, geo-violations, activity-feed)
- [ ] TimeClockDashboardController with 1 endpoint
- [ ] TimeClockReportsController with 6 endpoints
- [ ] Module registration updated with new controllers and services
- [ ] Dashboard `elapsed_minutes` computed live (not stored)
- [ ] Dashboard `current_break` returns active break or null
- [ ] Timesheet report groups sessions by employee then by day
- [ ] Payroll report computes `regular_pay`, `overtime_pay`, `total_pay` correctly
- [ ] Payroll export returns valid CSV with correct Content-Type and Content-Disposition headers
- [ ] Payroll export creates audit log entry
- [ ] Shift variance report correctly identifies late/early/missed shifts
- [ ] Geo-violations report re-computes nearest_address via haversine at query time
- [ ] Activity feed merges events from 5 source tables, sorted by timestamp DESC
- [ ] Activity feed cursor pagination works correctly via `after` parameter
- [ ] All Prisma queries include `tenant_id` filter
- [ ] `npm run lint` passes
- [ ] All endpoints tested via curl
- [ ] No frontend code modified
- [ ] Dev server shut down before sprint is marked complete

---

## Handoff Notes
- This sprint depends on Sprint 9 (clock sessions) and Sprint 11 (manual edit) being complete
- The payroll CSV export requires `AuditLoggerService` for audit logging — ensure the `AuditModule` is imported or `AuditLoggerService` is available for injection
- The geo-violations report uses `GeofenceService.haversineDistance()` — verify this helper exists and accepts `(lat1, lon1, lat2, lon2)` returning meters
- The activity feed queries 5 source tables independently — if performance becomes an issue, consider using raw SQL with UNION ALL in a future optimization sprint
