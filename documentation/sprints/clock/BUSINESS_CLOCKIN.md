# CLAUDE.md — Time Clock & Workforce Module Contract Builder

**Role**: AI Planner Agent — Contract Author
**Mission**: Read the entire Lead360 codebase, then produce three authoritative contract documents that a PM agent will use to generate implementation sprints.
**Output Files**:
- `/documentation/contracts/clockin-contract.md` — Core feature contract
- `/documentation/backend/clockin-backend.md` — Backend specification
- `/documentation/frontend/clockin-frontend.md` — Frontend specification

---

## CRITICAL READING REQUIREMENTS

Before writing a single line of any contract, you MUST read the following files in full. Not skim. Read every field name, every type, every relation, every method signature, every decorator, every DTO property. The contracts you produce will be read by AI developer agents who will use them as the sole source of truth. Any field name you get wrong, any method signature you invent, any import path you guess — will cause the developer agent to build broken code.

**Do not trust your training data. Read the actual files.**

### Step 1 — Read Prisma Schema (MANDATORY FIRST)

```
api/prisma/schema.prisma
```

Read the complete file. Extract and document:
- Every model that the time clock module will reference: `project`, `project_task`, `crew_member`, `crew_hour_log`, `user`, `user_role`, `role`, `permission`, `module`, `lead`, `lead_address`, `quote`, `quote_jobsite_address`, `notification`, `tenant`
- For each model: every field name, type, nullability (`?`), default values, relations, indexes, `@@map` names
- The `hour_log_source` enum — exact values
- The `project_status` enum — exact values
- The `project_task_status` enum — exact values
- Every existing enum relevant to this module

### Step 2 — Read Existing Services (MANDATORY)

Read these files completely:

```
api/src/modules/financial/services/crew-hour-log.service.ts
api/src/modules/financial/services/financial-entry.service.ts
api/src/modules/projects/services/project.service.ts
api/src/modules/projects/services/task-assignment.service.ts
api/src/modules/communication/services/notifications.service.ts
api/src/modules/audit/services/audit-logger.service.ts
api/src/modules/users/services/user.service.ts (if exists)
api/src/modules/rbac/services/rbac.service.ts
api/src/modules/rbac/guards/roles.guard.ts
api/src/modules/leads/services/lead-addresses.service.ts
api/src/modules/leads/services/google-maps.service.ts
api/src/modules/quotes/services/quote-jobsite-address.service.ts
```

For each service, document:
- Class name and constructor dependencies
- Every public method: name, parameters (with types), return type, what it does
- How `AuditLoggerService.logTenantChange()` is called — exact parameter shape
- How `NotificationsService.createNotification()` is called — exact parameter shape
- How `crew_hour_log` is created — exact Prisma fields used
- How `GoogleMapsService.validateAddress()` is called — exact input/output shape

### Step 3 — Read Core Infrastructure (MANDATORY)

```
api/src/main.ts                                          — port, prefix, CORS
api/src/core/database/prisma.service.ts                  — PrismaService class name
api/src/modules/auth/decorators/tenant-id.decorator.ts  — @TenantId() decorator
api/src/modules/auth/decorators/current-user.decorator.ts — @CurrentUser() decorator
api/src/modules/auth/guards/jwt-auth.guard.ts           — JwtAuthGuard class name
api/src/modules/rbac/decorators/roles.decorator.ts      — @Roles() decorator
api/src/app.module.ts                                    — module registration pattern
```

### Step 4 — Read an Existing Module End to End (MANDATORY)

Pick ONE complete module as your pattern reference. Read it fully:

```
api/src/modules/projects/
  projects.module.ts
  controllers/project.controller.ts (or equivalent)
  services/project.service.ts
  dto/ (all files)

api/src/modules/financial/
  financial.module.ts
  controllers/ (all)
  services/ (all)
  dto/ (all)
```

Document the exact patterns for:
- How a NestJS module is registered (`@Module` decorator, imports, providers, controllers, exports)
- How a controller is structured (`@Controller`, `@UseGuards`, `@ApiTags`, `@ApiBearerAuth`)
- How route guards are applied (`JwtAuthGuard`, `RolesGuard`)
- How `@TenantId()` and `@CurrentUser()` decorators are used in controller methods
- How DTOs are structured with `class-validator` decorators
- How Prisma queries are structured (always with `tenant_id`, `findFirst` not `findUnique`)
- How pagination responses are shaped (`data`, `meta` with `total`, `page`, `limit`, `totalPages`)
- How errors are thrown (`NotFoundException`, `BadRequestException`, `ConflictException`)

### Step 5 — Read Existing Frontend Module (MANDATORY)

Read these frontend files completely:

```
app/src/components/crew/ (all files)
app/src/components/users/ (all files)
app/src/components/ui/ (list all filenames — you will reference these)
app/src/app/(dashboard)/ (directory structure — all route folders)
app/src/lib/ (all files — API client pattern)
app/src/contexts/ (all files — auth context pattern)
app/src/types/ (all files — TypeScript type patterns)
```

Document:
- Exact import paths for all existing UI components
- How API calls are made (fetch wrapper, axios, or custom client — exact function names)
- How authentication token is attached to requests
- How error states are handled
- How loading states are handled
- How `tenant_id` is excluded from all request bodies
- The Next.js route group structure under `(dashboard)`
- Tailwind class patterns used for consistency

### Step 6 — Read RBAC Seed Data (MANDATORY)

```
api/prisma/seed.ts (or seeds/ folder)
api/scripts/ (any seed or migration scripts)
```

Find and document:
- Exact role names as stored in the database (e.g. `Owner`, `Admin`, `PM`, `Employee`)
- Existing permission structure: module name strings and action name strings
- How permissions are seeded and structured
- The `timeclock` module permissions already seeded (if any)

### Step 7 — Read BullMQ / Jobs Infrastructure (MANDATORY)

```
api/src/modules/jobs/ (all files)
Any existing processor files (e.g. task-delay-check.processor.ts, insurance-expiry-check.processor.ts)
```

Document:
- Queue names already registered
- How processors are structured (`@Processor`, `WorkerHost`, `process()` method)
- How jobs are enqueued from services
- How the scheduler works (`@Cron` decorator, scheduler class)
- How multi-tenant job processing works (iterate all tenants, isolate failures)

---

## THE MODULE YOU ARE BUILDING

### What Is the Time Clock & Workforce Module

A mobile-first employee time tracking system directly integrated with Lead360's Project and Financial modules. When an employee clocks out of a project, the system automatically posts labor cost to `crew_hour_log` — no manual entry required.

This is the key differentiator: **labor hours flow directly into project profitability in real time.**

### Who Uses It

| Role | Primary Actions |
|------|----------------|
| Owner / Admin | Configure settings, manage employees, review timesheets, approve disputes, export payroll |
| Project Manager (PM) | View all sessions, manage shifts, view reports |
| Bookkeeper | Export payroll CSV, view reports |
| Employee | Clock in/out, view own hours, submit disputes |
| Kiosk (no login) | PIN-based clock in/out on shared tablet |

---

## BUSINESS RULES — IMPLEMENT EXACTLY AS SPECIFIED

These rules were designed by the product owner after careful analysis. The contracts must embed all of them with full implementation detail.

### BR-001: One Active Session Per Employee
An employee can only have one `active` or `on_break` clock session at a time across all tenants. A clock-in request when a session is already open must return HTTP 409 with message: `"You already have an active clock session. Please clock out first."` Check must be made before creating any session.

### BR-002: Multi-Site Clock-In — Gaps Are Ignored
An employee may clock out of Site A and clock into Site B unlimited times per day. Each session is a completely independent record. The time between sessions (e.g., 11am out, 12pm in = 1 hour gap) is NOT tracked, NOT calculated, NOT flagged. Sessions are independent. Overtime is calculated by aggregating across all sessions for the day and week.

### BR-003: Geofence Enforcement at Clock-In
On clock-in, if the tenant's `clock_in_mode` is `specific_addresses` or `active_job_sites`:
1. Query all active `clockin_address` records where:
   - `tenant_id` matches AND `is_active = true`
   - AND (`project_id IS NULL` — tenant-wide addresses always included)
   - AND (if employee selected a `project_id`: also include `project_id = selected_project_id`)
2. Compute haversine distance between employee GPS and each address's `latitude`/`longitude`
3. If employee is within `radius_meters` of ANY address: `geofence_status = inside`
4. If outside ALL addresses: apply `geofence_violation_action`:
   - `block`: return HTTP 403, do NOT create session, queue admin in-app notification
   - `warn_only`: create session with `is_flagged = true`, `flag_reason = "Outside all configured locations — {distance}m from nearest"`, queue admin in-app notification

### BR-004: GPS Permission Denied
If employee's browser denies GPS permission (frontend sends `location_source = browser_gps` but no coordinates):
- If `gps_unavailable_action = block`: return HTTP 403
- If `gps_unavailable_action = allow_flagged`: create session with `clock_in_geofence_status = unavailable`, `is_flagged = true`

### BR-005: Auto Labor Cost Attribution on Clock-Out
On every successful clock-out:
1. Check `clock_session.project_id` — if null, skip attribution entirely (no error)
2. Check `employee_profile.crew_member_id` — if null, skip attribution, log warning
3. Resolve hourly rate: use `employee_profile.hourly_rate` if set; else use `crew_member.default_hourly_rate` (verify exact field name in schema)
4. Check `clock_session.labor_cost_posted = false` — if true, skip (idempotency guard, NEVER post twice)
5. Call `prisma.crew_hour_log.create()` DIRECTLY (do not call `CrewHourLogService.logHours()` — that method hardcodes `source: 'manual'`):
   ```
   {
     tenant_id: session.tenant_id,
     crew_member_id: employee_profile.crew_member_id,
     project_id: session.project_id,
     task_id: session.task_id ?? null,
     log_date: date portion of clock_in_at (in tenant timezone),
     hours_regular: regular_minutes / 60,
     hours_overtime: overtime_minutes / 60,
     source: 'clockin_system',         ← exact enum value from schema
     clockin_event_id: session.id,     ← already exists in crew_hour_log schema
     notes: null,
     created_by_user_id: employee_profile.user_id,
   }
   ```
6. On success: set `labor_cost_posted = true`, `labor_cost_entry_id = created_record.id`
7. On failure: do NOT fail clock-out. Log error. Queue admin in-app notification: `"Labor cost for [employee] session on [date] could not be posted — manual action required."`

**IMPORTANT**: Read the actual `crew_hour_log` Prisma model to verify `project_id` nullability. If `project_id` is NOT nullable in the current schema, a migration is required to make it nullable. Document this migration requirement in the contract.

### BR-006: Overtime Calculation
Run on every clock-out, in this exact order:
1. Determine applicable thresholds:
   - If `employee_profile.overtime_rule_override = true`: use employee-level thresholds
   - Else: use `time_clock_settings` tenant-level thresholds
2. If `overtime_enabled = false`: all minutes are regular, skip OT math
3. Fetch all COMPLETED sessions for this employee on the same calendar day (UTC date of `clock_in_at`)
4. Fetch all COMPLETED sessions for this employee in the same pay period week
5. Sum minutes already assigned to regular and overtime from prior sessions
6. Remaining daily capacity = `(daily_threshold_hours × 60) - prior_regular_today`
7. Remaining weekly capacity = `(weekly_threshold_hours × 60) - prior_regular_this_week`
8. This session's `regular_minutes = MIN(session_worked_minutes, remaining_daily, remaining_weekly)`
9. This session's `overtime_minutes = session_worked_minutes - regular_minutes`

### BR-007: Kiosk Mode
- Kiosk endpoints are PUBLIC — no JWT required
- Authenticated by `X-Kiosk-Token` header — a tenant-scoped token stored (hashed) in `time_clock_settings.kiosk_token_hash`
- `KioskTokenGuard` validates the token against the stored hash
- Employee PIN stored as bcrypt hash in `employee_profile.kiosk_pin_hash`
- After 5 consecutive wrong PIN attempts: lock employee from kiosk for 15 minutes, send admin in-app alert
- Rate limit kiosk PIN endpoint: 10 attempts per minute per token
- `location_source = kiosk` on sessions created via kiosk

### BR-008: Manual Edit Rules
Only Owner or Admin can edit a `clock_session` after creation.
For every edit:
1. Record MUST create a `clock_session_edit_log` entry: `field_changed`, `original_value` (as string), `new_value` (as string), `reason` (mandatory — reject if empty), `edited_by_user_id`, `edited_at`
2. Set `clock_session.is_manual_edit = true`
3. Recalculate `total_worked_minutes`, `regular_minutes`, `overtime_minutes`
4. If `labor_cost_posted = true`: do NOT re-post. Flag for reconciliation by setting a new field `labor_cost_reconciliation_needed = true` (add this field to the schema). Queue admin in-app alert.
5. `clock_session_edit_log` records are IMMUTABLE — no update or delete ever allowed

### BR-009: Shift Auto-Match on Clock-In
When an employee clocks in:
1. Query `work_shift` where:
   - `employee_profile_id = clocking_employee's profile id`
   - `status = scheduled`
   - `scheduled_start BETWEEN (clock_in_at - 2 hours) AND (clock_in_at + 2 hours)`
2. If multiple matches: pick the one where `ABS(scheduled_start - clock_in_at)` is smallest
3. If match found:
   - Set `clock_session.work_shift_id = matched_shift.id`
   - Update `work_shift.status = in_progress`
   - Employee's project/task selection is NOT overridden — shift match is informational
4. If no match: `clock_session.work_shift_id = null`

### BR-010: Missed Shift Auto-Detection
Background job runs every 15 minutes:
1. Find all `work_shift` where `status = scheduled` AND `scheduled_start < now() - tenant.missed_shift_threshold_minutes`
2. For each: check if any `clock_session` exists with `work_shift_id = shift.id` OR `clock_in_at` within ±2h window for same employee
3. If no session found: set `work_shift.status = missed`
4. Queue in-app notifications: Admin gets "X has not clocked in — shift started Y minutes ago", Employee gets "You were marked as missed for your shift on [date]"
5. Process per tenant. One tenant failure must not stop others. Log errors per tenant.

### BR-011: Dispute Lifecycle
Employee can submit ONE active dispute per session at a time.

Two types:
- `flag_only`: Employee flags without suggesting a correction. Admin reviews and edits manually.
- `correction_request`: Employee suggests specific corrected values.

On approval by Admin:
1. Apply proposed values to `clock_session` (only non-null proposed fields)
2. For each changed field: create `clock_session_edit_log` entry, reason = `"Approved dispute: {employee description}"`
3. Recalculate `total_worked_minutes`, `regular_minutes`, `overtime_minutes`
4. If `labor_cost_posted = true`: set `labor_cost_reconciliation_needed = true`, queue admin alert
5. Set `time_dispute.status = approved`, `reviewed_by_user_id`, `reviewed_at`
6. Queue employee notification: `"Your time correction for [date] has been approved"`

On rejection by Admin:
1. No changes to `clock_session`
2. Set `time_dispute.status = rejected`, `review_notes` (mandatory), `reviewed_by_user_id`, `reviewed_at`
3. Queue employee notification: `"Your time correction for [date] was not approved. [review_notes]"`

Employee can cancel a `pending` dispute (sets `status = resolved`).

### BR-012: Pay Period Boundary Calculation
Always computed dynamically from settings. Never stored.

- `weekly`: Period starts on `pay_period_start_day` (0=Sun, 6=Sat) of the current week in tenant timezone
- `biweekly`: Requires `pay_period_anchor_date` stored in `time_clock_settings`. Current period = most recent date where `(anchor_date + N×14 days) <= today`. Period length = 14 days.
- `semimonthly`: Period 1 = 1st through 15th. Period 2 = 16th through last day of month.
- `monthly`: 1st through last day of month.
- Timezone: always use tenant's timezone field. Read the actual `tenant` model to find the timezone field name. If not present, default to `America/New_York`.

### BR-013: Employee Profile Lifecycle
- Created manually by Admin/Owner from the settings UI
- Admin selects an existing `user` from the tenant's user list
- Admin optionally selects an existing `crew_member` record to link (for labor cost attribution)
- **Auto-link rule**: If a `crew_member` record exists where `crew_member.user_id` matches the selected `user.id`, automatically set `employee_profile.crew_member_id` to that `crew_member.id` without requiring manual selection
- If `crew_member_id` is null: clock-in still works, but labor cost attribution is skipped
- If `employee_profile` already exists for a `user_id` within the tenant: reject creation with HTTP 409

### BR-014: Clock-In Address Resolution (Geofence Location Source)

`clockin_address` is a standalone entity. One tenant can have many. Each can optionally be linked to a project.

Address creation sources:
- `manual`: Admin enters address + radius manually (geocoded via `GoogleMapsService`)
- `imported_from_quote`: Admin imports from `quote_jobsite_address` — copies `latitude`, `longitude`, `address_line1`, `city`, `state`, `zip_code` into new `clockin_address` record
- `imported_from_lead`: Admin imports from `lead_address` — copies coordinates and address fields

**Resolution at clock-in time** (when mode = `specific_addresses` or `active_job_sites`):
```
Query:
  SELECT * FROM clockin_address
  WHERE tenant_id = :tenant_id
    AND is_active = true
    AND (
      project_id IS NULL                           -- always include tenant-wide
      OR project_id = :selected_project_id         -- include project-specific if project selected
    )

Result: compute haversine distance to each.
Inside any one = geofence pass.
Outside all = geofence violation.
Empty result = not_enforced (geofence does not apply).
```

### BR-015: Employee-Project Assignment
New junction table `employee_project_assignment` allows any employee to be assigned to any project without requiring a task assignment.

- Admin assigns employee to project from the project's settings or from the employee's profile
- When `clock_in_mode = active_job_sites`: the project selector at clock-in should show ONLY projects where `employee_project_assignment` exists for this employee OR where the employee has a `task_assignee` record on any task within the project
- Admin can add an employee to a project at any time — even mid-project

---

## NEW DATA MODEL

### Tables to Create

You must verify exact Prisma syntax by reading `api/prisma/schema.prisma` in full before writing schema. Use the same conventions as existing models.

---

#### `time_clock_settings`
One record per tenant. Created when module is first configured.

Fields to include:
- `id` UUID PK
- `tenant_id` UUID unique FK → tenant (one per tenant)
- `clock_in_mode` ENUM: `anywhere` | `specific_addresses` | `active_job_sites` — default `anywhere`
- `geofence_violation_action` ENUM: `block` | `warn_only` — default `warn_only`
- `gps_required` BOOLEAN default true
- `gps_unavailable_action` ENUM: `block` | `allow_flagged` — default `allow_flagged`
- `require_job_tag` BOOLEAN default false — employee must select project at clock-in
- `require_task_tag` BOOLEAN default false — employee must select task
- `overtime_enabled` BOOLEAN default true
- `overtime_daily_threshold_hours` DECIMAL(4,2) nullable — default 8.00
- `overtime_weekly_threshold_hours` DECIMAL(5,2) nullable — default 40.00
- `overtime_multiplier` DECIMAL(3,2) nullable — default 1.50
- `pay_period_type` ENUM: `weekly` | `biweekly` | `semimonthly` | `monthly` — default `biweekly`
- `pay_period_start_day` INT nullable — 0=Sunday through 6=Saturday for weekly/biweekly
- `pay_period_anchor_date` DATE nullable — required for biweekly
- `kiosk_mode_enabled` BOOLEAN default false
- `kiosk_token_hash` VARCHAR(255) nullable — bcrypt hash of the kiosk access token
- `shift_reminder_minutes` INT default 30 — minutes before shift to send reminder
- `missed_shift_threshold_minutes` INT default 30 — minutes after shift start before marking missed
- `native_app_features_enabled` BOOLEAN default false — Phase 2 flag
- `created_at`, `updated_at`

Indexes: `UNIQUE(tenant_id)`

---

#### `employee_profile`
Bridges `user` (login identity) to `crew_member` (financial record). One per user per tenant.

Fields:
- `id` UUID PK
- `tenant_id` UUID FK → tenant
- `user_id` UUID FK → user
- `crew_member_id` UUID nullable FK → crew_member — null = no labor cost attribution
- `hourly_rate` DECIMAL(10,2) nullable — overrides crew_member.default_hourly_rate if set
- `overtime_rule_override` BOOLEAN default false
- `overtime_daily_threshold_hours` DECIMAL(4,2) nullable
- `overtime_weekly_threshold_hours` DECIMAL(5,2) nullable
- `kiosk_pin_hash` VARCHAR(255) nullable — bcrypt hash of PIN
- `kiosk_pin_failed_attempts` INT default 0
- `kiosk_pin_locked_until` DATETIME nullable
- `is_active` BOOLEAN default true
- `push_subscription_json` TEXT nullable — Web Push VAPID subscription (Phase 1)
- `push_token_native` VARCHAR(500) nullable — Native push token (Phase 2)
- `created_at`, `updated_at`

Indexes: `UNIQUE(tenant_id, user_id)`, `INDEX(tenant_id, is_active)`, `INDEX(tenant_id, crew_member_id)`

---

#### `clockin_address`
Standalone tenant-owned address for geofence enforcement. Optional project link.

Fields:
- `id` UUID PK
- `tenant_id` UUID FK → tenant
- `project_id` UUID nullable FK → project — null = available for any project
- `label` VARCHAR(100) required — e.g. "Home Depot Waltham", "Main Job Site"
- `address_line1` VARCHAR(255) required
- `address_line2` VARCHAR(255) nullable
- `city` VARCHAR(100) required
- `state` VARCHAR(2) required
- `zip_code` VARCHAR(10) required
- `latitude` DECIMAL(10,8) required
- `longitude` DECIMAL(11,8) required
- `radius_meters` INT required default 100
- `is_active` BOOLEAN default true
- `source` ENUM: `manual` | `imported_from_quote` | `imported_from_lead`
- `source_address_id` VARCHAR(36) nullable — original quote_jobsite_address.id or lead_address.id
- `created_by_user_id` UUID FK → user
- `created_at`, `updated_at`

Indexes: `INDEX(tenant_id, is_active)`, `INDEX(tenant_id, project_id)`

---

#### `employee_project_assignment`
Junction table: which employees are assigned to which projects for clock-in purposes.

Fields:
- `id` UUID PK
- `tenant_id` UUID FK → tenant
- `employee_profile_id` UUID FK → employee_profile
- `project_id` UUID FK → project
- `assigned_by_user_id` UUID FK → user
- `created_at`

Indexes: `UNIQUE(tenant_id, employee_profile_id, project_id)`, `INDEX(tenant_id, project_id)`

---

#### `work_shift`
Scheduled shifts published by Admin/PM.

Fields:
- `id` UUID PK
- `tenant_id` UUID FK → tenant
- `employee_profile_id` UUID FK → employee_profile
- `project_id` UUID nullable FK → project
- `task_id` UUID nullable FK → project_task
- `scheduled_start` DATETIME required (UTC)
- `scheduled_end` DATETIME required (UTC)
- `title` VARCHAR(100) nullable
- `notes` TEXT nullable
- `status` ENUM: `scheduled` | `in_progress` | `completed` | `missed` | `cancelled` — default `scheduled`
- `reminder_sent_at` DATETIME nullable — prevents double reminder
- `published_at` DATETIME nullable
- `created_by_user_id` UUID FK → user
- `created_at`, `updated_at`

Constraints: `scheduled_end > scheduled_start`
Indexes: `INDEX(tenant_id, employee_profile_id, scheduled_start)`, `INDEX(tenant_id, status)`, `INDEX(tenant_id, scheduled_start)`

---

#### `clock_session`
Core time tracking record. Each clock-in creates one.

Fields:
- `id` UUID PK
- `tenant_id` UUID FK → tenant
- `employee_profile_id` UUID FK → employee_profile
- `work_shift_id` UUID nullable FK → work_shift
- `project_id` UUID nullable FK → project
- `task_id` UUID nullable FK → project_task
- `clockin_address_id` UUID nullable FK → clockin_address — address matched at clock-in
- `status` ENUM: `active` | `on_break` | `completed` | `flagged` — default `active`
- `clock_in_at` DATETIME required
- `clock_out_at` DATETIME nullable
- `clock_in_latitude` DECIMAL(10,8) nullable
- `clock_in_longitude` DECIMAL(11,8) nullable
- `clock_in_location_source` ENUM: `browser_gps` | `native_gps` | `kiosk` | `manual` — default `browser_gps`
- `clock_in_geofence_status` ENUM: `inside` | `outside` | `unavailable` | `not_enforced` — default `not_enforced`
- `clock_out_latitude` DECIMAL(10,8) nullable
- `clock_out_longitude` DECIMAL(11,8) nullable
- `clock_out_location_source` ENUM: same as clock_in — default `browser_gps`
- `clock_out_geofence_status` ENUM: same as clock_in — default `not_enforced`
- `total_worked_minutes` INT nullable — computed on clock-out
- `regular_minutes` INT nullable
- `overtime_minutes` INT nullable
- `is_manual_edit` BOOLEAN default false
- `is_flagged` BOOLEAN default false
- `flag_reason` VARCHAR(255) nullable
- `labor_cost_posted` BOOLEAN default false
- `labor_cost_entry_id` VARCHAR(36) nullable — crew_hour_log.id
- `labor_cost_reconciliation_needed` BOOLEAN default false
- `notes` TEXT nullable
- `created_at`, `updated_at`

Indexes: `INDEX(tenant_id, employee_profile_id, clock_in_at)`, `INDEX(tenant_id, status)`, `INDEX(tenant_id, project_id)`, `INDEX(tenant_id, is_flagged)`, `INDEX(tenant_id, clock_in_at)`, `INDEX(tenant_id, labor_cost_posted)`

---

#### `break_entry`
Breaks within a session. Multiple allowed per session. One active at a time.

Fields:
- `id` UUID PK
- `tenant_id` UUID FK → tenant
- `clock_session_id` UUID FK → clock_session
- `break_type` ENUM: `paid` | `unpaid` — default `unpaid`
- `break_label` VARCHAR(50) nullable
- `started_at` DATETIME required
- `ended_at` DATETIME nullable
- `duration_minutes` INT nullable — computed on end
- `created_at`, `updated_at`

---

#### `clock_session_edit_log`
Immutable audit trail. No updates or deletes ever.

Fields:
- `id` UUID PK
- `tenant_id` UUID FK → tenant
- `clock_session_id` UUID FK → clock_session
- `edited_by_user_id` UUID FK → user
- `field_changed` VARCHAR(100) required
- `original_value` TEXT nullable
- `new_value` TEXT nullable
- `reason` TEXT required — reject if empty
- `edited_at` DATETIME default now()

---

#### `time_dispute`
Employee-initiated dispute against a session.

Fields:
- `id` UUID PK
- `tenant_id` UUID FK → tenant
- `clock_session_id` UUID FK → clock_session
- `submitted_by_user_id` UUID FK → user
- `dispute_type` ENUM: `flag_only` | `correction_request`
- `description` TEXT required
- `proposed_clock_in_at` DATETIME nullable
- `proposed_clock_out_at` DATETIME nullable
- `proposed_project_id` UUID nullable
- `proposed_task_id` UUID nullable
- `proposed_notes` TEXT nullable
- `status` ENUM: `pending` | `approved` | `rejected` | `resolved` — default `pending`
- `reviewed_by_user_id` UUID nullable FK → user
- `review_notes` TEXT nullable
- `reviewed_at` DATETIME nullable
- `created_at`, `updated_at`

Constraint: Only one `pending` dispute per session at a time (enforce in service logic, not DB constraint)

---

#### `clock_session_location_log`
Phase 2 placeholder. Create table now, write no data.

Fields:
- `id` UUID PK
- `tenant_id` UUID FK → tenant
- `clock_session_id` UUID FK → clock_session
- `captured_at` DATETIME required
- `latitude` DECIMAL(10,8) required
- `longitude` DECIMAL(11,8) required
- `accuracy_meters` DECIMAL(6,2) nullable
- `geofence_status` ENUM: `inside` | `outside`

---

### Migration Required on Existing Tables

**`crew_hour_log`**: Read the current schema. If `project_id` is `String @db.VarChar(36)` (not nullable), it must become `String? @db.VarChar(36)` (nullable). This requires a migration. Document this as a BREAKING CHANGE that must be coordinated — run migration before any time clock code is deployed.

**`project`**: No changes to existing fields. The time clock module reads `project.quote_id` and `project.lead_id` for address resolution but adds no fields to `project`.

---

## MODULE ARCHITECTURE

### Backend Module Location
```
api/src/modules/time-clock/
├── time-clock.module.ts
├── controllers/
│   ├── time-clock-settings.controller.ts
│   ├── employee-profile.controller.ts
│   ├── clockin-address.controller.ts
│   ├── employee-project-assignment.controller.ts
│   ├── work-shift.controller.ts
│   ├── clock-session.controller.ts
│   ├── break-entry.controller.ts
│   ├── time-dispute.controller.ts
│   ├── kiosk.controller.ts
│   ├── time-clock-dashboard.controller.ts
│   └── time-clock-reports.controller.ts
├── services/
│   ├── time-clock-settings.service.ts
│   ├── employee-profile.service.ts
│   ├── clockin-address.service.ts
│   ├── employee-project-assignment.service.ts
│   ├── work-shift.service.ts
│   ├── clock-session.service.ts
│   ├── break-entry.service.ts
│   ├── clock-session-edit.service.ts
│   ├── time-dispute.service.ts
│   ├── kiosk.service.ts
│   ├── geofence.service.ts
│   ├── overtime.service.ts
│   ├── labor-cost-attribution.service.ts
│   ├── time-clock-dashboard.service.ts
│   └── time-clock-reports.service.ts
├── processors/
│   └── time-clock.processor.ts
├── schedulers/
│   └── time-clock.scheduler.ts
├── guards/
│   └── kiosk-token.guard.ts
└── dto/
    └── [all DTOs]
```

### Frontend Location
```
app/src/components/time-clock/     ← ALL new components here
app/src/app/(dashboard)/workforce/ ← ALL new pages here
app/src/app/kiosk/                 ← Kiosk page (outside dashboard layout)
```

---

## API ENDPOINTS

### Server Configuration (Verified from main.ts)
- Port: 8000
- Prefix: `api/v1`
- Base URL dev: `http://127.0.0.1:8000/api/v1`
- No PM2 — server runs via nohup or systemd
- Database: always from `DATABASE_URL` env var

### Endpoint List

When writing contracts, specify each endpoint with:
- HTTP method and full path
- Required roles (verify exact role name strings from seed data)
- Request body shape (all fields, types, required/optional)
- Response shape (all fields, types)
- All possible error codes and their conditions
- Which business rules apply

**Settings**: GET/PATCH `/time-clock/settings`, POST `/time-clock/settings/kiosk-token/regenerate`

**Employee Profiles**: GET `/time-clock/employees`, POST, GET `:id`, PATCH `:id`, POST `:id/pin`, DELETE `:id/pin`, POST `/me/push-subscription`

**Clock-In Addresses**: GET `/time-clock/addresses`, POST, GET `:id`, PATCH `:id`, DELETE `:id`, POST `/import-from-quote`, POST `/import-from-lead`

**Employee Project Assignments**: GET `/time-clock/employee-projects`, POST, DELETE `:id`

**Work Shifts**: GET `/time-clock/shifts`, POST, POST `/bulk`, GET `:id`, PATCH `:id`, DELETE `:id`

**Clock Sessions**: POST `/time-clock/sessions/clock-in`, POST `/time-clock/sessions/clock-out`, GET `/time-clock/sessions`, GET `/time-clock/sessions/:id`, PATCH `/time-clock/sessions/:id`, GET `/time-clock/sessions/me/active`, GET `/time-clock/sessions/active/all`

**Breaks**: POST `/time-clock/sessions/:id/breaks/start`, POST `/time-clock/sessions/:id/breaks/end`, GET `/time-clock/sessions/:id/breaks`

**Disputes**: POST `/time-clock/sessions/:id/disputes`, GET `/time-clock/disputes`, GET `/time-clock/disputes/mine`, GET `/time-clock/disputes/:id`, PATCH `/time-clock/disputes/:id/approve`, PATCH `/time-clock/disputes/:id/reject`, DELETE `/time-clock/disputes/:id`

**Kiosk (PUBLIC)**: GET `/time-clock/kiosk/employees`, POST `/time-clock/kiosk/clock-in`, POST `/time-clock/kiosk/clock-out`

**Dashboard**: GET `/time-clock/dashboard/whos-in`

**Reports**: GET `/time-clock/reports/timesheet`, GET `/time-clock/reports/payroll`, GET `/time-clock/reports/payroll/export`, GET `/time-clock/reports/shift-variance`, GET `/time-clock/reports/geo-violations`, GET `/time-clock/reports/activity-feed`

---

## PERMISSIONS — RBAC

Read the actual RBAC seed to find the permission module/action pattern. Then add these new permissions for the `timeclock` module:

| Permission Action | Roles |
|---|---|
| `manage_settings` | Owner, Admin |
| `manage_employees` | Owner, Admin |
| `manage_addresses` | Owner, Admin |
| `manage_shifts` | Owner, Admin, PM |
| `clock_in` | Owner, Admin, PM, Employee |
| `clock_out` | Owner, Admin, PM, Employee |
| `view_own` | Owner, Admin, PM, Employee |
| `view_all` | Owner, Admin, PM, Bookkeeper |
| `edit_session` | Owner, Admin |
| `submit_dispute` | Owner, Admin, PM, Employee |
| `review_disputes` | Owner, Admin |
| `view_reports` | Owner, Admin, PM, Bookkeeper |
| `export_payroll` | Owner, Admin, Bookkeeper |
| `manage_kiosk` | Owner, Admin |
| `kiosk_access` | Public (no JWT — kiosk token only) |

Verify the exact module name string used in the permissions table by reading the seed file.

---

## INTEGRATIONS

### Cross-Module Dependencies

**CRITICAL**: Verify each import path by reading the actual files.

| Integration | What to Call | Purpose |
|---|---|---|
| `PrismaService` | `this.prisma.*` | All DB queries |
| `AuditLoggerService` | `logTenantChange({...})` | All audit entries — read method signature from source |
| `NotificationsService` | `createNotification({...})` | In-app alerts — read method signature from source |
| `GoogleMapsService` | `validateAddress({...})` | Geocoding new addresses — in leads module, cross-module import, document dependency |
| Direct Prisma | `prisma.crew_hour_log.create({...})` | Labor cost attribution — bypasses CrewHourLogService |

**GoogleMapsService Cross-Module Import Note**: `GoogleMapsService` is currently in `api/src/modules/leads/services/google-maps.service.ts`. The time clock module must import it from that path. Document this as a known cross-module dependency that should be refactored to `api/src/core/` in a future sprint. For now, add `LeadsModule` to the `time-clock.module.ts` imports array if needed, or export `GoogleMapsService` from `LeadsModule`.

### GeofenceService — Haversine Formula
The `GeofenceService` must implement haversine distance calculation in-module. Do not import from anywhere — implement it fresh:

```
Given two coordinate pairs (lat1, lon1) and (lat2, lon2):
R = 6371000 (Earth radius in meters)
φ1, φ2 = lat1, lat2 in radians
Δφ = (lat2-lat1) in radians
Δλ = (lon2-lon1) in radians
a = sin²(Δφ/2) + cos(φ1) × cos(φ2) × sin²(Δλ/2)
c = 2 × atan2(√a, √(1-a))
d = R × c   (distance in meters)
```

Returns: distance in meters as a number.

---

## BACKGROUND JOBS

### Job Architecture
Read existing processors (`task-delay-check.processor.ts`, etc.) to understand the exact pattern. The time clock module adds two new jobs to an existing or new queue.

**Missed Shift Detector**
- Queue: add `time-clock` queue (or verify if an appropriate queue already exists)
- Cron schedule: every 15 minutes `*/15 * * * *`
- Logic: see BR-010
- Pattern: iterate all tenants, process each independently, catch errors per tenant

**Shift Reminder**
- Cron: every 1 minute `* * * * *`
- Logic: Find `work_shift` where `status = scheduled` AND `scheduled_start BETWEEN now() AND now() + shift_reminder_minutes` AND `reminder_sent_at IS NULL`
- Set `reminder_sent_at = now()` before sending notification (prevents double-send)
- Queue push subscription lookup + in-app notification

---

## FRONTEND PAGES

### Test Credentials (Embed in frontend contract)
| Role | Email | Password |
|---|---|---|
| Tenant Contact / Employee | contact@honeydo4you.com | 978@F32c |
| Sys Admin | ludsonaiello@gmail.com | 978@F32c |

### Pre-Sprint Verification Protocol
Every frontend sprint MUST begin with:
1. Read `documentation/time-clock/clockin_REST_API.md` (generated by backend agent)
2. Hit every endpoint this sprint uses via Swagger at `http://127.0.0.1:8000/api/docs`
3. Authenticate with test credentials above
4. Verify response shapes match documentation
5. Copy real response types into TypeScript interfaces
6. Only then build components

### Existing UI Components (Do NOT Recreate)
Read `app/src/components/ui/` to get the complete, current list of all component filenames. In the frontend contract, list every single one with its exact filename and usage. The frontend agent must import from these — never recreate.

### Existing Component Folders (Do NOT Recreate)
Read `app/src/components/` to get the complete folder list. New time clock components go exclusively in `app/src/components/time-clock/`.

### Routing
Read `app/src/app/(dashboard)/` to understand the current route structure. New routes:

```
app/src/app/(dashboard)/workforce/
  page.tsx                  (redirect)
  clock/page.tsx            (employee clock-in screen — mobile first)
  dashboard/page.tsx        (who's in dashboard)
  timesheets/page.tsx       (admin timesheet management)
  my-hours/page.tsx         (employee self-service)
  shifts/page.tsx           (admin shift scheduling)
  my-shifts/page.tsx        (employee shift view)
  disputes/page.tsx         (admin dispute queue)
  reports/page.tsx          (reports hub)

app/src/app/(dashboard)/settings/time-clock/
  page.tsx                  (settings — geofence, OT, pay period, kiosk)

app/src/app/kiosk/
  page.tsx                  (NO layout — full screen, token from URL query param)
```

### New Components to Build
All in `app/src/components/time-clock/`:
- `ClockButton.tsx` — large CTA, status-aware, loading state
- `SessionDurationTimer.tsx` — live HH:MM:SS, updates every second
- `GPSStatusIndicator.tsx` — acquiring / confirmed / denied states
- `ProjectTaskSelector.tsx` — searchable dropdown, project then task
- `BreakControls.tsx` — start/end break, type selector
- `TodaysSessionsSummary.tsx` — list of today's completed sessions
- `EmployeeStatusCard.tsx` — who's in card per employee
- `ActivityFeedItem.tsx` — single event row
- `ShiftCalendar.tsx` — week view with employee lanes
- `ShiftCard.tsx` — single shift display
- `DisputeForm.tsx` — flag / correction request toggle + fields
- `PayrollExportFilter.tsx` — date range + employee + project
- `VarianceReportRow.tsx` — scheduled vs actual delta
- `KioskEmployeeSelector.tsx` — scrollable employee list
- `KioskPinPad.tsx` — numeric pad, 0-9 + delete
- `KioskConfirmation.tsx` — post-action screen, auto-reset 10s
- `ClockinAddressForm.tsx` — create/edit address with import options
- `GeoViolationBadge.tsx` — flag indicator

### Mobile Requirements (Clock-In Screen)
- Must function in Chrome mobile and Safari iOS 16.4+
- All tap targets minimum 48px height
- No horizontal scroll at 375px viewport
- Clock-in/out button minimum 64px height
- Font size minimum 16px on inputs (prevents iOS zoom)
- GPS permission request handled gracefully

---

## WHAT THE AGENT MUST PRODUCE

### Document 1: `/documentation/contracts/clockin-contract.md`

The core contract. Contents:
1. Module purpose and business value
2. Scope (in/out, Phase 1/Phase 2)
3. Architecture overview with dependency map
4. Complete data model — every table, every field, every index, every relation (verified from real schema)
5. All business rules (BR-001 through BR-015) with full implementation detail
6. All enums with exact values
7. Integration points (verified service names, method signatures, import paths)
8. RBAC permission matrix
9. Notification event table
10. Background job specifications
11. API endpoint overview table
12. Open questions resolved table
13. Risk table
14. Sprint build order recommendation

### Document 2: `/documentation/backend/clockin-backend.md`

The backend agent's implementation guide. Contents:
1. Mandatory reading checklist (files agent must read before starting)
2. Server rules (port 8000, no PM2, DATABASE_URL from .env, findFirst not findUnique, tenant_id always from JWT)
3. Test credentials
4. Complete Prisma schema additions — copy-paste ready, using real syntax from existing schema
5. Migration notes including the `crew_hour_log.project_id` nullability change
6. Module structure with exact file paths
7. Every API endpoint with full request/response shapes, error codes, business rules applied
8. Every service method with implementation logic (not code — logic description precise enough to implement correctly)
9. `GeofenceService` haversine formula
10. `OvertimeService` aggregation algorithm
11. `LaborCostAttributionService` logic with exact Prisma call shape
12. Background job implementations
13. `KioskTokenGuard` implementation logic
14. Audit log requirements per action
15. RBAC seed additions
16. Testing requirements: unit tests per service, integration tests per endpoint, tenant isolation tests (mandatory), RBAC tests

### Document 3: `/documentation/frontend/clockin-frontend.md`

The frontend agent's implementation guide. Contents:
1. Pre-sprint verification protocol (mandatory)
2. Test credentials
3. Complete list of existing UI components with import paths (read from actual codebase)
4. Complete list of existing component folders
5. New component list with location and purpose
6. Complete route structure
7. Per-page specification: route, roles, API calls, layout, components used, state management, error handling, loading states
8. API call pattern (read from actual lib/ files — exact function names)
9. Auth token attachment pattern
10. Mobile-first requirements for clock-in screen
11. Kiosk mode: no JWT, token from URL, full-screen, auto-reset
12. Push notification subscription flow
13. Masked input requirements (PIN, time fields, rate fields)
14. Icon library (read from package.json)
15. Pattern enforcement: same error handling, same loading states, same modal pattern as existing modules

---

## QUALITY REQUIREMENTS FOR THE CONTRACTS

Every contract must be:

1. **Grounded in reality** — every field name, method name, import path, and enum value must be verified from the actual codebase. Zero invented names.

2. **Self-contained** — a developer agent reading only the contract must be able to implement the sprint with no other references.

3. **Precise enough to test** — every endpoint must have enough detail that a QA agent can write tests without asking questions.

4. **Consistent** — field names used in the backend contract must exactly match field names in the frontend contract.

5. **Ordered** — the sprint build order must reflect real dependencies. No frontend sprint can reference an endpoint that hasn't been built yet.

---

## FINAL CHECKLIST BEFORE SUBMITTING CONTRACTS

Before saving any document, verify:

- [ ] Every Prisma model field name verified against `api/prisma/schema.prisma`
- [ ] `crew_hour_log.source` enum value is `clockin_system` (not `clockin`)
- [ ] `hour_log_source` enum confirmed — exact values listed
- [ ] `crew_hour_log.project_id` nullability status documented with migration note if required
- [ ] All service method names verified against actual service files
- [ ] `AuditLoggerService.logTenantChange()` parameter shape is exact
- [ ] `NotificationsService.createNotification()` parameter shape is exact
- [ ] Role name strings verified from seed file (exact case: `Owner`, `Admin`, etc.)
- [ ] Permission module name string verified from seed file
- [ ] All existing UI component filenames verified from `app/src/components/ui/`
- [ ] API call pattern in frontend contract verified from actual `app/src/lib/` files
- [ ] Auth context pattern verified from `app/src/contexts/`
- [ ] `GoogleMapsService` import path is correct (`leads/services/google-maps.service.ts`)
- [ ] `tenant.timezone` field name verified — or default documented if field doesn't exist
- [ ] Port 8000 confirmed from `main.ts`
- [ ] No PM2 confirmed from `main.ts`
- [ ] BullMQ queue registration pattern verified from existing processors
- [ ] `clockin_system` value exists in `hour_log_source` enum — confirmed
- [ ] `clock_session_location_log` table marked as Phase 2 placeholder
- [ ] `native_app_features_enabled` flag returns 403 for Phase 2 endpoints
- [ ] Kiosk token uses bcrypt hash — not plaintext storage
- [ ] Employee PIN uses bcrypt hash — not plaintext storage

---

## AGENT EXECUTION INSTRUCTIONS

1. Start by reading `api/prisma/schema.prisma` in its entirety. Take notes on every model you will reference.
2. Read every service file listed in Step 2. Extract method signatures.
3. Read the infrastructure files in Step 3.
4. Read one complete existing module end to end (Step 4).
5. Read the frontend files in Step 5.
6. Read the RBAC seed (Step 6).
7. Read the jobs infrastructure (Step 7).
8. Only after completing all reading: begin writing contracts.
9. Write Document 1 (clockin-contract.md) first — this is the source of truth.
10. Write Document 2 (clockin-backend.md) — derived from Document 1 plus backend detail.
11. Write Document 3 (clockin-frontend.md) — derived from Document 1 plus frontend detail.
12. Run the final checklist before saving.
13. Save all three files to the correct paths.

**Do not start writing until you have finished reading. Contracts written from incomplete codebase knowledge will be rejected.**