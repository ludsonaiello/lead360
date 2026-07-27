# Time Clock & Workforce Module — Feature Contract

**Module**: `time-clock`  
**Version**: 1.0  
**Status**: Draft  
**Created**: 2026-04-10  
**Working Directory**: `/var/www/lead360.app/api/` (backend), `/var/www/lead360.app/app/` (frontend)  
**Dependencies**: Projects, Financial, Leads, Communication, Auth, Audit, RBAC

---

## 1. Purpose

A mobile-first employee time tracking system integrated with Lead360's Project and Financial modules. When an employee clocks out of a project, the system automatically posts labor cost to `crew_hour_log` — no manual entry required.

**Key Differentiator**: Labor hours flow directly into project profitability in real time.

**Who Uses It**:

| Role | Primary Actions |
|------|----------------|
| Owner / Admin | Configure settings, manage employees, review timesheets, approve disputes, export payroll |
| Project Manager | View all sessions, manage shifts, view reports |
| Bookkeeper | Export payroll CSV, view reports |
| Employee | Clock in/out, view own hours, submit disputes |
| Kiosk (no login) | PIN-based clock in/out on shared tablet |

---

## 2. Platform Architecture Reference (Verified from Codebase)

### Decorators & Guards

| Item | Import Path | Usage |
|------|-------------|-------|
| `@TenantId()` | `api/src/modules/auth/decorators/tenant-id.decorator.ts` | Extracts `tenant_id` from JWT user |
| `@CurrentUser()` | `api/src/modules/auth/decorators/current-user.decorator.ts` | Extracts user object or property (e.g., `@CurrentUser('id')`) |
| `JwtAuthGuard` | `api/src/modules/auth/guards/jwt-auth.guard.ts` | JWT validation, supports `@Public()` bypass |
| `RolesGuard` | `api/src/modules/rbac/guards/roles.guard.ts` | Calls `rbacService.hasAnyRole(userId, tenantId, roleNames)` |
| `@Roles()` | `api/src/modules/rbac/decorators/roles.decorator.ts` | Sets required role names metadata |

### Service Signatures (Exact)

**AuditLoggerService.logTenantChange()**:
```typescript
interface LogTenantChangeParams {
  action: 'created' | 'updated' | 'deleted';
  entityType: string;
  entityId: string;
  tenantId: string | null;
  actorUserId: string;
  before?: object;
  after?: object;
  metadata?: object;
  description: string;
  ipAddress?: string;
  userAgent?: string;
}
```
Import: `api/src/modules/audit/services/audit-logger.service.ts`

**NotificationsService.createNotification()**:
```typescript
async createNotification(data: {
  tenant_id: string;
  user_id?: string | null;   // null = tenant-wide broadcast
  type: string;
  title: string;
  message: string;
  action_url?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  expires_at?: Date;
})
```
Import: `api/src/modules/communication/services/notifications.service.ts`

**GoogleMapsService.validateAddress()**:
```typescript
// Input
interface PartialAddress {
  address_line1: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

// Output
interface ValidatedAddress {
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  latitude: number;
  longitude: number;
  google_place_id?: string;
}
```
Import: `api/src/modules/leads/services/google-maps.service.ts` (cross-module dependency from LeadsModule)

### Controller Pattern

**Two patterns exist in the codebase.** Financial controllers use `@Request() req`; RBAC/Calendar/Projects controllers use `@TenantId()` / `@CurrentUser()`. This module MUST use the `@Request() req` pattern for consistency with the financial module (the most closely related module):

```typescript
@ApiTags('Time Clock')
@ApiBearerAuth()
@Controller('time-clock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SomeController {
  @Get()
  @Roles('Owner', 'Admin', 'Project Manager')
  async list(@Request() req) {
    // req.user.tenant_id — tenant ID from JWT
    // req.user.id         — current user ID
    return this.service.findAll(req.user.tenant_id, ...);
  }
}
```

### Pagination Response Shape
```json
{
  "data": [],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

### Server Configuration (from main.ts)
- Port: **8000**
- Global prefix: **`api/v1`**
- Base URL: `http://127.0.0.1:8000/api/v1`
- Swagger docs: `http://127.0.0.1:8000/api/docs`
- Validation pipe: `whitelist: true, forbidNonWhitelisted: true`

---

## 3. Scope

### Phase 1 — In Scope
- Time Clock Settings (per-tenant configuration)
- Employee Profiles (user-to-crew-member bridge)
- Clock-in Addresses (geofence locations)
- Employee-Project Assignments (junction table)
- Work Shifts (scheduling)
- Clock Sessions (clock-in/out with GPS, geofence, overtime)
- Break Entries (paid/unpaid breaks within sessions)
- Manual Edits with immutable audit trail
- Time Disputes (employee-initiated corrections)
- Kiosk Mode (PIN-based, public endpoints)
- Dashboard (who's currently clocked in)
- Reports (timesheet, payroll export, shift variance, geo violations, activity feed)
- Background Jobs (missed shift detector, shift reminder)
- Web Push subscription (VAPID)

### Phase 2 — Out of Scope
- `clock_session_location_log` data writes (table created as placeholder)
- Native app features (`native_app_features_enabled` flag — returns 403)
- Live GPS tracking during sessions
- Photo verification at clock-in
- Automatic break enforcement
- Biometric clock-in

---

## 4. Data Model

### 4.1 New Enums

```prisma
enum clock_in_mode {
  anywhere
  specific_addresses
  active_job_sites
}

enum geofence_violation_action {
  block
  warn_only
}

enum gps_unavailable_action {
  block
  allow_flagged
}

enum pay_period_type {
  weekly
  biweekly
  semimonthly
  monthly
}

enum clock_session_status {
  active
  on_break
  completed
  // NOTE: No 'flagged' status. Flagging is tracked via `is_flagged` boolean + `flag_reason`.
  // A session can be active AND flagged simultaneously (e.g., geofence warn_only).
  // Status only tracks the clock lifecycle: active → on_break → active → completed.
}

enum location_source {
  browser_gps
  native_gps
  kiosk
  manual
}

enum geofence_status {
  inside
  outside
  unavailable
  not_enforced
}

enum work_shift_status {
  scheduled
  in_progress
  completed
  missed
  cancelled
}

enum break_type {
  paid
  unpaid
}

enum dispute_type {
  flag_only
  correction_request
}

enum dispute_status {
  pending
  approved
  rejected
  resolved
}

enum address_source {
  manual
  imported_from_quote
  imported_from_lead
}
```

### 4.2 Existing Enum (Verified)

```prisma
enum hour_log_source {
  manual
  clockin_system    // ← used by labor cost attribution
}
```

### 4.3 New Tables

#### `time_clock_settings`
One record per tenant. Created when module is first configured.

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @default(uuid()) @db.VarChar(36) | No | uuid | PK |
| tenant_id | String @unique @db.VarChar(36) | No | - | FK → tenant, one per tenant |
| clock_in_mode | clock_in_mode | No | anywhere | |
| geofence_violation_action | geofence_violation_action | No | warn_only | |
| gps_required | Boolean | No | true | |
| gps_unavailable_action | gps_unavailable_action | No | allow_flagged | |
| require_job_tag | Boolean | No | false | Must select project at clock-in |
| require_task_tag | Boolean | No | false | Must select task |
| overtime_enabled | Boolean | No | true | |
| overtime_daily_threshold_hours | Decimal @db.Decimal(4,2) | Yes | 8.00 | |
| overtime_weekly_threshold_hours | Decimal @db.Decimal(5,2) | Yes | 40.00 | |
| overtime_multiplier | Decimal @db.Decimal(3,2) | Yes | 1.50 | Informational — used in payroll reports to compute OT pay (`overtime_hours × rate × multiplier`). NOT applied during clock-out; hours are stored unmultiplied. |
| pay_period_type | pay_period_type | No | biweekly | |
| pay_period_start_day | Int | Yes | - | 0=Sun through 6=Sat |
| pay_period_anchor_date | DateTime @db.Date | Yes | - | Required for biweekly |
| kiosk_mode_enabled | Boolean | No | false | |
| kiosk_token_hash | String @db.VarChar(255) | Yes | - | bcrypt hash |
| shift_reminder_minutes | Int | No | 30 | |
| missed_shift_threshold_minutes | Int | No | 30 | |
| native_app_features_enabled | Boolean | No | false | Phase 2 flag — any endpoint that requires native app features must check this flag and return HTTP 403 `"Native app features are not enabled"` if false |
| created_at | DateTime | No | now() | |
| updated_at | DateTime | No | @updatedAt | |

Indexes: `@@unique([tenant_id])`, `@@map("time_clock_settings")`

---

#### `employee_profile`
Bridges `user` (login identity) to `crew_member` (financial record). One per user per tenant.

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @default(uuid()) @db.VarChar(36) | No | uuid | PK |
| tenant_id | String @db.VarChar(36) | No | - | FK → tenant |
| user_id | String @db.VarChar(36) | No | - | FK → user |
| crew_member_id | String @db.VarChar(36) | Yes | - | FK → crew_member, null = no labor cost |
| hourly_rate | Decimal @db.Decimal(10,2) | Yes | - | Overrides crew_member.default_hourly_rate |
| overtime_rule_override | Boolean | No | false | Use employee-level OT thresholds |
| overtime_daily_threshold_hours | Decimal @db.Decimal(4,2) | Yes | - | |
| overtime_weekly_threshold_hours | Decimal @db.Decimal(5,2) | Yes | - | |
| kiosk_pin_hash | String @db.VarChar(255) | Yes | - | bcrypt hash |
| kiosk_pin_failed_attempts | Int | No | 0 | |
| kiosk_pin_locked_until | DateTime | Yes | - | |
| is_active | Boolean | No | true | |
| push_subscription_json | String @db.Text | Yes | - | Web Push VAPID (Phase 1) |
| push_token_native | String @db.VarChar(500) | Yes | - | Native push (Phase 2) |
| created_at | DateTime | No | now() | |
| updated_at | DateTime | No | @updatedAt | |

Indexes: `@@unique([tenant_id, user_id])`, `@@index([tenant_id, is_active])`, `@@index([tenant_id, crew_member_id])`, `@@map("employee_profile")`

---

#### `clockin_address`
Standalone tenant-owned address for geofence enforcement. Optional project link.

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @default(uuid()) @db.VarChar(36) | No | uuid | PK |
| tenant_id | String @db.VarChar(36) | No | - | FK → tenant |
| project_id | String @db.VarChar(36) | Yes | - | FK → project, null = any project |
| label | String @db.VarChar(100) | No | - | e.g. "Home Depot Waltham" |
| address_line1 | String @db.VarChar(255) | No | - | |
| address_line2 | String @db.VarChar(255) | Yes | - | |
| city | String @db.VarChar(100) | No | - | |
| state | String @db.VarChar(2) | No | - | |
| zip_code | String @db.VarChar(10) | No | - | |
| latitude | Decimal @db.Decimal(10,8) | No | - | |
| longitude | Decimal @db.Decimal(11,8) | No | - | |
| radius_meters | Int | No | 100 | |
| is_active | Boolean | No | true | |
| source | address_source | No | manual | |
| source_address_id | String @db.VarChar(36) | Yes | - | Original quote_jobsite_address.id or lead_address.id |
| created_by_user_id | String @db.VarChar(36) | No | - | FK → user |
| created_at | DateTime | No | now() | |
| updated_at | DateTime | No | @updatedAt | |

Indexes: `@@index([tenant_id, is_active])`, `@@index([tenant_id, project_id])`, `@@map("clockin_address")`

---

#### `employee_project_assignment`
Junction: which employees are assigned to which projects for clock-in purposes.

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @default(uuid()) @db.VarChar(36) | No | uuid | PK |
| tenant_id | String @db.VarChar(36) | No | - | FK → tenant |
| employee_profile_id | String @db.VarChar(36) | No | - | FK → employee_profile |
| project_id | String @db.VarChar(36) | No | - | FK → project |
| assigned_by_user_id | String @db.VarChar(36) | No | - | FK → user |
| created_at | DateTime | No | now() | |

Indexes: `@@unique([tenant_id, employee_profile_id, project_id])`, `@@index([tenant_id, project_id])`, `@@map("employee_project_assignment")`

---

#### `work_shift`
Scheduled shifts published by Admin/PM.

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @default(uuid()) @db.VarChar(36) | No | uuid | PK |
| tenant_id | String @db.VarChar(36) | No | - | FK → tenant |
| employee_profile_id | String @db.VarChar(36) | No | - | FK → employee_profile |
| project_id | String @db.VarChar(36) | Yes | - | FK → project |
| task_id | String @db.VarChar(36) | Yes | - | FK → project_task |
| scheduled_start | DateTime | No | - | UTC |
| scheduled_end | DateTime | No | - | UTC |
| title | String @db.VarChar(100) | Yes | - | |
| notes | String @db.Text | Yes | - | |
| status | work_shift_status | No | scheduled | |
| reminder_sent_at | DateTime | Yes | - | Prevents double reminder |
| published_at | DateTime | Yes | - | |
| created_by_user_id | String @db.VarChar(36) | No | - | FK → user |
| created_at | DateTime | No | now() | |
| updated_at | DateTime | No | @updatedAt | |

Constraint: `scheduled_end > scheduled_start` (enforced in service logic)  
Indexes: `@@index([tenant_id, employee_profile_id, scheduled_start])`, `@@index([tenant_id, status])`, `@@index([tenant_id, scheduled_start])`, `@@map("work_shift")`

---

#### `clock_session`
Core time tracking record. Each clock-in creates one.

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @default(uuid()) @db.VarChar(36) | No | uuid | PK |
| tenant_id | String @db.VarChar(36) | No | - | FK → tenant |
| employee_profile_id | String @db.VarChar(36) | No | - | FK → employee_profile |
| work_shift_id | String @db.VarChar(36) | Yes | - | FK → work_shift |
| project_id | String @db.VarChar(36) | Yes | - | FK → project |
| task_id | String @db.VarChar(36) | Yes | - | FK → project_task |
| clockin_address_id | String @db.VarChar(36) | Yes | - | FK → clockin_address (matched at clock-in) |
| status | clock_session_status | No | active | Lifecycle only: active, on_break, completed |
| clock_in_at | DateTime | No | - | |
| clock_out_at | DateTime | Yes | - | |
| clock_in_latitude | Decimal @db.Decimal(10,8) | Yes | - | |
| clock_in_longitude | Decimal @db.Decimal(11,8) | Yes | - | |
| clock_in_location_source | location_source | No | browser_gps | |
| clock_in_geofence_status | geofence_status | No | not_enforced | |
| clock_out_latitude | Decimal @db.Decimal(10,8) | Yes | - | Stored if provided, no enforcement |
| clock_out_longitude | Decimal @db.Decimal(11,8) | Yes | - | Stored if provided, no enforcement |
| clock_out_location_source | location_source | No | browser_gps | |
| clock_out_geofence_status | geofence_status | No | not_enforced | Phase 1: always `not_enforced` — geofence is only enforced at clock-in (BR-003). Clock-out GPS is recorded for audit purposes but not validated. Phase 2 may add clock-out geofence enforcement. |
| total_worked_minutes | Int | Yes | - | Computed on clock-out |
| regular_minutes | Int | Yes | - | |
| overtime_minutes | Int | Yes | - | |
| is_manual_edit | Boolean | No | false | |
| is_flagged | Boolean | No | false | |
| flag_reason | String @db.VarChar(255) | Yes | - | |
| labor_cost_posted | Boolean | No | false | |
| labor_cost_entry_id | String @db.VarChar(36) | Yes | - | crew_hour_log.id |
| labor_cost_reconciliation_needed | Boolean | No | false | |
| notes | String @db.Text | Yes | - | |
| created_at | DateTime | No | now() | |
| updated_at | DateTime | No | @updatedAt | |

Indexes: `@@index([tenant_id, employee_profile_id, clock_in_at])`, `@@index([tenant_id, status])`, `@@index([tenant_id, project_id])`, `@@index([tenant_id, is_flagged])`, `@@index([tenant_id, clock_in_at])`, `@@index([tenant_id, labor_cost_posted])`, `@@map("clock_session")`

---

#### `break_entry`
Breaks within a session. Multiple allowed per session. One active at a time.

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @default(uuid()) @db.VarChar(36) | No | uuid | PK |
| tenant_id | String @db.VarChar(36) | No | - | FK → tenant |
| clock_session_id | String @db.VarChar(36) | No | - | FK → clock_session |
| break_type | break_type | No | unpaid | |
| break_label | String @db.VarChar(50) | Yes | - | |
| started_at | DateTime | No | - | |
| ended_at | DateTime | Yes | - | |
| duration_minutes | Int | Yes | - | Computed on end |
| created_at | DateTime | No | now() | |
| updated_at | DateTime | No | @updatedAt | |

Indexes: `@@index([tenant_id, clock_session_id])`, `@@map("break_entry")`

---

#### `clock_session_edit_log`
Immutable audit trail. **No updates or deletes ever.**

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @default(uuid()) @db.VarChar(36) | No | uuid | PK |
| tenant_id | String @db.VarChar(36) | No | - | FK → tenant |
| clock_session_id | String @db.VarChar(36) | No | - | FK → clock_session |
| edited_by_user_id | String @db.VarChar(36) | No | - | FK → user |
| field_changed | String @db.VarChar(100) | No | - | |
| original_value | String @db.Text | Yes | - | |
| new_value | String @db.Text | Yes | - | |
| reason | String @db.Text | No | - | Reject if empty |
| edited_at | DateTime | No | now() | |

Indexes: `@@index([tenant_id, clock_session_id])`, `@@map("clock_session_edit_log")`

---

#### `time_dispute`
Employee-initiated dispute against a session.

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @default(uuid()) @db.VarChar(36) | No | uuid | PK |
| tenant_id | String @db.VarChar(36) | No | - | FK → tenant |
| clock_session_id | String @db.VarChar(36) | No | - | FK → clock_session |
| submitted_by_user_id | String @db.VarChar(36) | No | - | FK → user |
| dispute_type | dispute_type | No | - | |
| description | String @db.Text | No | - | |
| proposed_clock_in_at | DateTime | Yes | - | |
| proposed_clock_out_at | DateTime | Yes | - | |
| proposed_project_id | String @db.VarChar(36) | Yes | - | |
| proposed_task_id | String @db.VarChar(36) | Yes | - | |
| proposed_notes | String @db.Text | Yes | - | |
| status | dispute_status | No | pending | |
| reviewed_by_user_id | String @db.VarChar(36) | Yes | - | FK → user |
| review_notes | String @db.Text | Yes | - | |
| reviewed_at | DateTime | Yes | - | |
| created_at | DateTime | No | now() | |
| updated_at | DateTime | No | @updatedAt | |

Constraint: Only one `pending` dispute per session (enforced in service logic, not DB)  
Indexes: `@@index([tenant_id, clock_session_id])`, `@@index([tenant_id, status])`, `@@map("time_dispute")`

---

#### `clock_session_location_log` (Phase 2 Placeholder)
Create table now, write no data in Phase 1.

| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @default(uuid()) @db.VarChar(36) | No | uuid | PK |
| tenant_id | String @db.VarChar(36) | No | - | FK → tenant |
| clock_session_id | String @db.VarChar(36) | No | - | FK → clock_session |
| captured_at | DateTime | No | - | |
| latitude | Decimal @db.Decimal(10,8) | No | - | |
| longitude | Decimal @db.Decimal(11,8) | No | - | |
| accuracy_meters | Decimal @db.Decimal(6,2) | Yes | - | |
| geofence_status | geofence_status | No | - | Reuses existing enum but only `inside` and `outside` are valid values for this table (location logs are captured during active tracking, so `unavailable` and `not_enforced` do not apply) |

Indexes: `@@index([tenant_id, clock_session_id])`, `@@map("clock_session_location_log")`

---

### 4.4 Migration Required on Existing Tables

**`crew_hour_log`**: `project_id` is currently `String @db.VarChar(36)` (NOT nullable). Must become `String? @db.VarChar(36)` (nullable) and the relation `project project @relation(...)` must become `project project? @relation(...)`.

**BREAKING CHANGE**: Run this migration BEFORE deploying any time clock code. Existing code that creates `crew_hour_log` entries always provides `project_id`, so it will continue to work.

**`project`**: No changes. The time clock module reads `project.quote_id` and `project.lead_id` for address resolution but adds no fields.

---

## 5. Business Rules

### Clock-In Flow — Execution Order

The clock-in service MUST execute checks in this exact order. Stop on first failure.

1. Validate `employee_profile` exists for `req.user.id` in tenant and `is_active = true` → 404
2. **BR-001**: Check no active/on_break session exists → 409
3. Validate `require_job_tag` / `require_task_tag` settings → 400 if required but missing
4. **BR-004**: Check GPS availability (only if `gps_required = true`)
5. **BR-003**: Geofence check (only if GPS available AND `clock_in_mode != 'anywhere'`)
6. **BR-009**: Shift auto-match (non-blocking — no failure possible)
7. Create `clock_session` record
8. Queue notifications if flagged (geofence violation or GPS unavailable)
9. Return created session

### Clock-Out Flow — Execution Order

1. Find active/on_break session for `req.user.id` in tenant → 404
2. Auto-end active break if `status = 'on_break'` (per BR-007B)
3. Set `clock_out_at = now()`, store clock-out GPS if provided
4. **BR-004B**: Compute `total_worked_minutes` (deduct unpaid breaks)
5. **BR-006**: Calculate overtime
6. **BR-004C**: Update `work_shift.status = 'completed'` if shift matched
7. **BR-005**: Post labor cost (non-blocking — errors logged, not thrown)
8. Set `status = 'completed'`
9. Return updated session

---

### BR-001: One Active Session Per Employee
An employee can only have one `active` or `on_break` clock session at a time **within the tenant**. Clock-in when a session is already open returns **HTTP 409**: `"You already have an active clock session. Please clock out first."` Check is made before creating any session.

> **Deviation from original spec**: The original spec says "across all tenants." This contract narrows the check to the current tenant because cross-tenant queries violate the platform's absolute tenant isolation rule. If a user exists in multiple tenants, they may have one active session per tenant.

**Implementation**: `ClockSessionService.clockIn()` queries `clock_session` where `employee_profile_id` matches AND `status IN ('active', 'on_break')` AND `tenant_id` matches. If count > 0, throw `ConflictException`.

### BR-002: Multi-Site Clock-In
Employee may clock out of Site A and clock into Site B unlimited times per day. Each session is independent. Gap time between sessions is NOT tracked. Overtime is calculated by aggregating across all sessions for the day and week.

### BR-003: Geofence Enforcement at Clock-In
If `clock_in_mode` is `specific_addresses` or `active_job_sites`:
1. Query `clockin_address` where `tenant_id` matches AND `is_active = true` AND (`project_id IS NULL` OR `project_id = selected_project_id`)
2. Compute haversine distance between employee GPS and each address
3. If inside any address radius: `geofence_status = inside`, set `clockin_address_id` to matched address
4. If outside ALL addresses:
   - `block`: return HTTP 403, do NOT create session, queue admin notification
   - `warn_only`: create session with `is_flagged = true`, `flag_reason = "Outside all configured locations — {distance}m from nearest"`, queue admin notification
5. If no addresses found: `geofence_status = not_enforced`

**Implementation**: `GeofenceService.checkGeofence()` handles distance calculation. `ClockSessionService.clockIn()` applies policy.

**Haversine Formula** (implement in `GeofenceService`, do NOT import from any library):
```
Given two coordinate pairs (lat1, lon1) and (lat2, lon2):
R = 6371000               (Earth radius in meters)
φ1 = lat1 × π / 180       (convert to radians)
φ2 = lat2 × π / 180
Δφ = (lat2 - lat1) × π / 180
Δλ = (lon2 - lon1) × π / 180

a = sin²(Δφ/2) + cos(φ1) × cos(φ2) × sin²(Δλ/2)
c = 2 × atan2(√a, √(1−a))
d = R × c                 (distance in meters)
```
Returns: distance in meters as a number. Compare against `clockin_address.radius_meters`.

### BR-004: GPS Permission Denied
If browser denies GPS permission (no coordinates sent):
1. Check `time_clock_settings.gps_required` first:
   - If `gps_required = false`: GPS is optional — proceed with clock-in, set `clock_in_geofence_status = not_enforced`, do NOT flag. Skip all geofence checks. **Note**: This means `clock_in_mode = 'specific_addresses'` or `'active_job_sites'` is effectively disabled when `gps_required = false`, since geofence cannot be enforced without coordinates. The settings UI should warn admins about this combination.
   - If `gps_required = true`: continue to step 2
2. Check `gps_unavailable_action`:
   - `block`: return HTTP 403 with message `"GPS location is required to clock in."`
   - `allow_flagged`: create session with `clock_in_geofence_status = unavailable`, `is_flagged = true`, `flag_reason = "GPS location unavailable — employee denied or browser blocked location access"`

### BR-004B: Total Worked Minutes Calculation
On clock-out, `total_worked_minutes` is computed as:

```
total_worked_minutes = FLOOR((clock_out_at - clock_in_at) / 60000)
                     - SUM(duration_minutes) of all UNPAID break_entries for this session
```

- **Paid** breaks are NOT subtracted — they count as worked time
- **Unpaid** breaks are subtracted
- Any active break at clock-out time must be ended first (set `ended_at = now()`, compute its `duration_minutes`) before this calculation
- Result must be >= 0

### BR-004C: Work Shift Completion on Clock-Out
On clock-out, if `clock_session.work_shift_id` is not null, set the matched `work_shift.status = 'completed'`.

### BR-005: Auto Labor Cost Attribution on Clock-Out
On every successful clock-out, AFTER the session is marked completed (i.e., after break auto-end per BR-004B, after `total_worked_minutes` is computed, after overtime is calculated per BR-006, after work shift updated per BR-004C):
1. Check `clock_session.project_id` — if null, skip entirely
2. Check `employee_profile.crew_member_id` — if null, skip, log warning
3. Resolve hourly rate: `employee_profile.hourly_rate` if set; else `crew_member.default_hourly_rate`. If BOTH are null: skip labor cost attribution, log warning `"No hourly rate configured for employee"`. Do NOT fail clock-out.
4. Check `clock_session.labor_cost_posted = false` — if true, skip (idempotency)
5. Call `prisma.crew_hour_log.create()` DIRECTLY (not through `CrewHourLogService.logHours()` — that hardcodes `source: 'manual'`):
   ```
   {
     tenant_id: session.tenant_id,
     crew_member_id: employee_profile.crew_member_id,
     project_id: session.project_id,
     task_id: session.task_id ?? null,
     log_date: date portion of clock_in_at (in tenant timezone),
     hours_regular: regular_minutes / 60,
     hours_overtime: overtime_minutes / 60,
     source: 'clockin_system',
     clockin_event_id: session.id,
     notes: null,
     created_by_user_id: employee_profile.user_id,
   }
   ```
6. On success: set `labor_cost_posted = true`, `labor_cost_entry_id = created_record.id`
7. On failure: do NOT fail clock-out. Log error. Queue admin notification.

### BR-006: Overtime Calculation
Run on every clock-out:
1. Resolve thresholds:
   - If `employee_profile.overtime_rule_override = true`: use employee-level thresholds
   - Else: use `time_clock_settings` tenant-level thresholds
2. If `overtime_enabled = false`: all minutes are regular, skip OT
3. Fetch all COMPLETED sessions for this employee on same calendar day (**in tenant timezone** — use `tenant.timezone`, e.g. `America/New_York`, to determine the calendar date boundary. NOT UTC.)
4. Fetch all COMPLETED sessions for this employee in the current **7-day work week** (always 7 days starting on `pay_period_start_day`, regardless of pay period type). For weekly/biweekly periods this aligns with the pay week; for semimonthly/monthly periods, the weekly OT threshold still uses a rolling 7-day window anchored to `pay_period_start_day`. If `pay_period_start_day` is null, default to 0 (Sunday).
5. Sum minutes already assigned to regular and overtime from prior sessions
6. `remaining_daily = MAX(0, (daily_threshold_hours * 60) - prior_regular_today)`
7. `remaining_weekly = MAX(0, (weekly_threshold_hours * 60) - prior_regular_this_week)`
8. `regular_minutes = MIN(session_worked_minutes, remaining_daily, remaining_weekly)`
9. `overtime_minutes = session_worked_minutes - regular_minutes`

### BR-007: Kiosk Mode
- Kiosk endpoints are PUBLIC — no JWT required
- Authenticated by `X-Kiosk-Token` header
- `KioskTokenGuard` validates token against bcrypt hash in `time_clock_settings.kiosk_token_hash`
- Employee PIN stored as bcrypt hash in `employee_profile.kiosk_pin_hash`
- After 5 consecutive wrong PIN attempts: lock for 15 minutes, send admin alert. Return **HTTP 423** (Locked) with message `"Account locked for 15 minutes"` — use 423 instead of 403 so the frontend can distinguish lockout from geofence block or GPS block.
- Wrong PIN (not locked): return **HTTP 401** with message `"Invalid PIN"` and include `remaining_attempts` in response body
- Rate limit kiosk PIN endpoint: 10 attempts per minute per token
- `location_source = kiosk` on sessions created via kiosk
- `KioskTokenGuard` attaches `tenant_id` to the request. All kiosk service methods MUST verify that the `employee_profile_id` in the request body belongs to this tenant (`employee_profile.tenant_id = guard.tenant_id`). This prevents cross-tenant employee lookup via kiosk.

### BR-007B: Break Validation Rules
- A break can only be started when the session `status = 'active'`. If session is `on_break`, `completed`, or doesn't belong to the requesting employee → return 400.
- Only ONE break can be active (where `ended_at IS NULL`) per session at a time. Starting a second → return 409 `"A break is already active."`.
- Ending a break: find the active break (where `ended_at IS NULL`) for the session → 404 if none. Set `ended_at = now()`, compute `duration_minutes = FLOOR((ended_at - started_at) / 60000)`. Set `clock_session.status = 'active'`.
- Starting a break sets `clock_session.status = 'on_break'`.
- An employee can only start/end breaks on their OWN session (matched via `employee_profile.user_id = req.user.id`), unless the user is Owner or Admin.

### BR-008: Manual Edit Rules
Only Owner or Admin can edit a `clock_session`.

**Editable fields**: `clock_in_at`, `clock_out_at`, `project_id`, `task_id`, `notes`

For every edit:
1. For EACH changed field: create a `clock_session_edit_log` entry with `field_changed`, `original_value` (as string), `new_value` (as string), `reason` (mandatory — reject with 400 if empty), `edited_by_user_id`, `edited_at`
2. Set `clock_session.is_manual_edit = true`
3. **Recalculation triggers**: If `clock_in_at` OR `clock_out_at` changed → recalculate `total_worked_minutes` (per BR-004B), `regular_minutes`, `overtime_minutes` (per BR-006). If only `project_id`, `task_id`, or `notes` changed → no time recalculation needed.
4. If `labor_cost_posted = true`: do NOT re-post. Set `labor_cost_reconciliation_needed = true`. Queue admin alert (`timeclock.labor_cost_reconciliation`).
5. `clock_session_edit_log` records are IMMUTABLE — no update or delete ever

### BR-009: Shift Auto-Match on Clock-In
When employee clocks in:
1. Query `work_shift` where `employee_profile_id` matches AND `status = scheduled` AND `scheduled_start BETWEEN (clock_in_at - 2h) AND (clock_in_at + 2h)`
2. If multiple: pick closest `ABS(scheduled_start - clock_in_at)`
3. If match: set `clock_session.work_shift_id`, update `work_shift.status = in_progress`
4. If no match: `work_shift_id = null`

**IMPORTANT**: Shift matching is **informational only**. The employee's project/task selection at clock-in is NOT overridden by the shift's `project_id` or `task_id`. Even if the shift has `project_id = "A"` and the employee selects project "B", the session uses project "B". The shift link is metadata for scheduling reports.

### BR-010: Missed Shift Auto-Detection
Background job every 15 minutes:
1. Find all `work_shift` where `status = scheduled` AND `scheduled_start < now() - missed_shift_threshold_minutes`
2. For each: check if any `clock_session` exists with `work_shift_id = shift.id` OR `clock_in_at` within ±2h for same employee
3. If no session: set `work_shift.status = missed`
4. Notifications: Admin gets "X has not clocked in", Employee gets "You were marked as missed"
5. Process per tenant. One tenant failure must not stop others.

### BR-011: Dispute Lifecycle
Employee submits ONE active dispute per session at a time.

Two types:
- `flag_only`: flags without correction. Admin reviews manually.
- `correction_request`: suggests specific corrected values.

**On approval**:
1. Apply proposed values to `clock_session` (only non-null proposed fields). **Limitation**: A dispute cannot propose setting a field to null (e.g., removing a project). Both "don't change" and "set to null" are stored as null in the proposed fields. This is an accepted limitation — employees who need a field cleared should use `flag_only` type and describe the change in `description`.
2. For each changed field: create `clock_session_edit_log` with `reason = "Approved dispute: {description}"`
3. Recalculate `total_worked_minutes`, `regular_minutes`, `overtime_minutes`
4. If `labor_cost_posted = true`: set `labor_cost_reconciliation_needed = true`, queue admin alert
5. Set `time_dispute.status = approved`, `reviewed_by_user_id`, `reviewed_at`
6. Notify employee: "Your time correction for [date] has been approved"

**On rejection**:
1. No changes to `clock_session`
2. Set `status = rejected`, `review_notes` (mandatory), `reviewed_by_user_id`, `reviewed_at`
3. Notify employee: "Your time correction for [date] was not approved. [review_notes]"

Employee can cancel a `pending` dispute (sets `status = resolved`).

### BR-012: Pay Period Boundary Calculation
Always computed dynamically. Never stored.

- `weekly`: starts on `pay_period_start_day` (0=Sun, 6=Sat) of current week in tenant timezone
- `biweekly`: requires `pay_period_anchor_date`. Current period = most recent `anchor_date + N*14 days <= today`. Length = 14 days.
- `semimonthly`: Period 1 = 1st–15th. Period 2 = 16th–last day of month.
- `monthly`: 1st through last day of month.
- **Timezone**: use `tenant.timezone` field (verified: `String @default("America/New_York")`)

### BR-013: Employee Profile Lifecycle
- Created manually by Admin/Owner
- Admin selects existing `user` from tenant's user list
- Admin optionally selects existing `crew_member` to link
- **Auto-link**: If `crew_member` exists where `crew_member.user_id = selected_user.id`, auto-set `employee_profile.crew_member_id`
- If `crew_member_id` is null: clock-in still works, labor cost attribution skipped
- If `employee_profile` already exists for `user_id` within tenant: reject with HTTP 409

### BR-014: Clock-In Address Resolution
`clockin_address` is standalone. One tenant can have many. Optional project link.

Sources:
- `manual`: Admin enters address + radius, geocoded via `GoogleMapsService.validateAddress()`
- `imported_from_quote`: copies from `quote_jobsite_address`. This table HAS `tenant_id` — filter directly: `WHERE id = :id AND tenant_id = :tenant_id`. **Fields to copy**: `address_line1`, `address_line2`, `city`, `state`, `zip_code`, `latitude`, `longitude` → into matching `clockin_address` fields. Admin provides `label`, `radius_meters`, optional `project_id`.
- `imported_from_lead`: copies from `lead_address`. This table has NO `tenant_id` — it only has `lead_id`. Must join through lead: `WHERE lead_address.id = :id AND lead.tenant_id = :tenant_id` (join `lead_address` → `lead` via `lead_address.lead_id = lead.id`). **Fields to copy**: `address_line1`, `address_line2`, `city`, `state`, `zip_code`, `latitude`, `longitude` → into matching `clockin_address` fields. Admin provides `label`, `radius_meters`, optional `project_id`.

Resolution at clock-in:
```sql
SELECT * FROM clockin_address
WHERE tenant_id = :tenant_id
  AND is_active = true
  AND (project_id IS NULL OR project_id = :selected_project_id)
```
Inside any = geofence pass. Outside all = violation. Empty result = `not_enforced`.

### BR-015: Employee-Project Assignment
Junction table allows any employee to be assigned to any project.

- When `clock_in_mode = active_job_sites`: project selector shows ONLY projects where `employee_project_assignment` exists OR where employee has a `task_assignee` record (matched via `task_assignee.user_id` or `task_assignee.crew_member_id`) on any task within the project
- Admin can add employee to project at any time

**Available Projects Endpoint**: To support the filtered project selector, add:

`GET /time-clock/sessions/me/available-projects` — Returns projects the current employee can clock into.

- **Roles**: `Owner`, `Admin`, `Project Manager`, `Employee`
- **Logic**:
  1. Find `employee_profile` for current user
  2. If `time_clock_settings.clock_in_mode = 'anywhere'` or `'specific_addresses'`: return ALL active projects in tenant
  3. If `clock_in_mode = 'active_job_sites'`: return UNION of:
     - Projects where `employee_project_assignment` exists for this employee
     - Projects where any `task_assignee` exists with `task_assignee.user_id = employee_profile.user_id` OR `task_assignee.crew_member_id = employee_profile.crew_member_id` (NOTE: `task_assignee` has separate nullable FKs `user_id`, `crew_member_id`, `subcontractor_id` — there is NO generic `assignee_id` field. Join through `task_assignee.task_id → project_task.id → project_task.project_id` to get the project.)
  4. Filter to `project.status IN ('planned', 'in_progress')` — exclude completed/canceled
- **Response**: `{ data: [{ id, name, project_number }] }` — lightweight list for dropdown (field is `project.name` in schema, not `title`)

---

## 6. Module Architecture

### Backend File Structure
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
    └── [all DTOs — one file per resource]
```

### Frontend File Structure
```
app/src/components/time-clock/    ← ALL new components
app/src/app/(dashboard)/workforce/ ← ALL new pages
app/src/app/(dashboard)/settings/time-clock/ ← Settings page
app/src/app/kiosk/                ← Kiosk (outside dashboard layout)
app/src/lib/api/time-clock.ts     ← API client functions
app/src/lib/types/time-clock.ts   ← TypeScript interfaces
```

### Module Dependencies
```
TimeClockModule
  ├── imports: PrismaModule, AuditModule, CommunicationModule, LeadsModule
  ├── registers: BullModule.registerQueue({ name: 'time-clock' })
  └── must be added to AppModule imports array (api/src/app.module.ts)
```

---

## 7. Integration Points

| Service | Method | Import Path | Purpose |
|---------|--------|-------------|---------|
| `PrismaService` | `this.prisma.*` | `api/src/core/database/prisma.service.ts` | All DB queries |
| `AuditLoggerService` | `logTenantChange({...})` | `api/src/modules/audit/services/audit-logger.service.ts` | Audit entries |
| `NotificationsService` | `createNotification({...})` | `api/src/modules/communication/services/notifications.service.ts` | In-app alerts |
| `GoogleMapsService` | `validateAddress({...})` | `api/src/modules/leads/services/google-maps.service.ts` | Geocoding addresses |
| Direct Prisma | `prisma.crew_hour_log.create({...})` | N/A (direct via PrismaService) | Labor cost — bypasses CrewHourLogService |

**Cross-Module Note**: `GoogleMapsService` is in `LeadsModule`. The `TimeClockModule` must import `LeadsModule` (or `LeadsModule` must export `GoogleMapsService`). Document as known dependency to refactor to `core/` in future sprint.

---

## 8. RBAC Permission Matrix

Module name: `timeclock` (already exists in seed)

| Permission Action | Owner | Admin | Project Manager | Bookkeeper | Employee | Read-only |
|---|---|---|---|---|---|---|
| `manage_settings` | Y | Y | - | - | - | - |
| `manage_employees` | Y | Y | - | - | - | - |
| `manage_addresses` | Y | Y | - | - | - | - |
| `manage_shifts` | Y | Y | Y | - | - | - |
| `clock_in` | Y | Y | Y | - | Y | - |
| `clock_out` | Y | Y | Y | - | Y | - |
| `view_own` | Y | Y | Y | - | Y | - |
| `view_all` | Y | Y | Y | Y | - | - |
| `edit_session` | Y | Y | - | - | - | - |
| `submit_dispute` | Y | Y | Y | - | Y | - |
| `review_disputes` | Y | Y | - | - | - | - |
| `view_reports` | Y | Y | Y | Y | - | - |
| `export_payroll` | Y | Y | - | Y | - | - |
| `manage_kiosk` | Y | Y | - | - | - | - |
| `kiosk_access` | Public (no JWT — kiosk token only) | | | | | |

**Note**: The `@Roles()` decorator must use exact role names from seed: `'Owner'`, `'Admin'`, `'Project Manager'`, `'Bookkeeper'`, `'Employee'`. NOT `'PM'` or `'Manager'`.

**Existing `timeclock` permissions in seed**: `view`, `clock_in`, `clock_out`, `edit`, `delete`. These must be KEPT for backward compatibility. The new permissions listed above are ADDITIONS. Overlap mapping:
- `view` (existing) → retained as-is; `view_own` and `view_all` provide finer granularity
- `edit` (existing) → retained as-is; `edit_session` provides specific clock session edit control
- `delete` (existing) → retained as-is; not used by time clock endpoints in Phase 1
- `clock_in` / `clock_out` (existing) → already match the contract; no change needed

---

## 9. Notification Events

| Event Type | Trigger | Recipient | Title Template | Message Template |
|---|---|---|---|---|
| `timeclock.geofence_violation` | Clock-in outside geofence (warn_only mode) | Admin users | "Geofence Alert" | "{employee} clocked in {distance}m from nearest location" |
| `timeclock.geofence_blocked` | Clock-in blocked by geofence | Admin users | "Clock-in Blocked" | "{employee} attempted to clock in outside all locations" |
| `timeclock.labor_cost_failed` | Labor cost post fails on clock-out | Admin users | "Labor Cost Error" | "Labor cost for {employee} on {date} could not be posted — manual action required" |
| `timeclock.labor_cost_reconciliation` | Manual edit after labor cost posted | Admin users | "Reconciliation Needed" | "Session for {employee} on {date} edited after labor cost posted" |
| `timeclock.missed_shift` | Missed shift detected (admin) | Admin users | "Missed Shift" | "{employee} has not clocked in — shift started {minutes} minutes ago" |
| `timeclock.missed_shift_employee` | Missed shift detected (employee) | Employee user | "Missed Shift" | "You were marked as missed for your shift on {date}" |
| `timeclock.shift_reminder` | Upcoming shift reminder | Employee user | "Upcoming Shift" | "Your shift starts in {minutes} minutes" |
| `timeclock.dispute_submitted` | Employee submits dispute | Admin users | "Time Dispute" | "{employee} submitted a time correction for {date}" |
| `timeclock.dispute_approved` | Admin approves dispute | Employee user | "Dispute Approved" | "Your time correction for {date} has been approved" |
| `timeclock.dispute_rejected` | Admin rejects dispute | Employee user | "Dispute Not Approved" | "Your time correction for {date} was not approved. {review_notes}" |
| `timeclock.kiosk_lockout` | 5 failed PIN attempts | Admin users | "Kiosk Lockout" | "{employee} locked out of kiosk after 5 failed PIN attempts" |

---

## 10. Background Job Specifications

### Missed Shift Detector
- **Queue**: `time-clock`
- **Cron**: `*/15 * * * *` (every 15 minutes)
- **Logic**: BR-010
- **Pattern**: Iterate all active tenants (`{ is_active: true, deleted_at: null }` — the `tenant` model has a `deleted_at: DateTime?` field), process each independently, catch errors per tenant, continue on failure

### Shift Reminder
- **Cron**: `* * * * *` (every minute)
- **Logic**: Find `work_shift` where `status = scheduled` AND `scheduled_start BETWEEN now() AND now() + shift_reminder_minutes` AND `reminder_sent_at IS NULL`. Set `reminder_sent_at = now()` BEFORE sending notification (prevents double-send). Queue in-app notification + push subscription lookup.
- **Pattern**: Same per-tenant iteration with error isolation (`{ is_active: true, deleted_at: null }`)

---

## 11. API Endpoint Overview

### Settings (3 endpoints)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/time-clock/settings` | Owner, Admin | Get tenant settings (auto-creates with defaults if no record exists) |
| PATCH | `/time-clock/settings` | Owner, Admin | Update settings |
| POST | `/time-clock/settings/kiosk-token/regenerate` | Owner, Admin | Generate new kiosk token |

### Employee Profiles (7 endpoints)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/time-clock/employees` | Owner, Admin | List employee profiles |
| POST | `/time-clock/employees` | Owner, Admin | Create profile |
| GET | `/time-clock/employees/:id` | Owner, Admin | Get profile detail |
| PATCH | `/time-clock/employees/:id` | Owner, Admin | Update profile |
| POST | `/time-clock/employees/:id/pin` | Owner, Admin | Set/reset kiosk PIN |
| DELETE | `/time-clock/employees/:id/pin` | Owner, Admin | Remove kiosk PIN |
| POST | `/time-clock/employees/me/push-subscription` | Owner, Admin, Project Manager, Employee | Save push subscription |

### Clock-In Addresses (7 endpoints)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/time-clock/addresses` | Owner, Admin | List addresses |
| POST | `/time-clock/addresses` | Owner, Admin | Create address |
| GET | `/time-clock/addresses/:id` | Owner, Admin | Get address detail |
| PATCH | `/time-clock/addresses/:id` | Owner, Admin | Update address |
| DELETE | `/time-clock/addresses/:id` | Owner, Admin | Soft-delete (set is_active=false) |
| POST | `/time-clock/addresses/import-from-quote` | Owner, Admin | Import from quote_jobsite_address |
| POST | `/time-clock/addresses/import-from-lead` | Owner, Admin | Import from lead_address |

### Employee Project Assignments (3 endpoints)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/time-clock/employee-projects` | Owner, Admin | List assignments |
| POST | `/time-clock/employee-projects` | Owner, Admin | Create assignment |
| DELETE | `/time-clock/employee-projects/:id` | Owner, Admin | Remove assignment |

### Work Shifts (6 endpoints)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/time-clock/shifts` | Owner, Admin, Project Manager | List shifts |
| POST | `/time-clock/shifts` | Owner, Admin, Project Manager | Create shift |
| POST | `/time-clock/shifts/bulk` | Owner, Admin, Project Manager | Bulk create shifts |
| GET | `/time-clock/shifts/:id` | Owner, Admin, Project Manager | Get shift detail |
| PATCH | `/time-clock/shifts/:id` | Owner, Admin, Project Manager | Update shift |
| DELETE | `/time-clock/shifts/:id` | Owner, Admin, Project Manager | Delete shift |

### Clock Sessions (8 endpoints)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/time-clock/sessions/clock-in` | Owner, Admin, Project Manager, Employee | Clock in |
| POST | `/time-clock/sessions/clock-out` | Owner, Admin, Project Manager, Employee | Clock out |
| GET | `/time-clock/sessions` | Owner, Admin, Project Manager, Bookkeeper | List all sessions |
| GET | `/time-clock/sessions/me/active` | Owner, Admin, Project Manager, Employee | Get my active session |
| GET | `/time-clock/sessions/me/available-projects` | Owner, Admin, Project Manager, Employee | Projects available for clock-in (BR-015) |
| GET | `/time-clock/sessions/active/all` | Owner, Admin, Project Manager | All active sessions |
| GET | `/time-clock/sessions/:id` | Owner, Admin, Project Manager, Bookkeeper | Get session detail |
| PATCH | `/time-clock/sessions/:id` | Owner, Admin | Manual edit session |

### Breaks (3 endpoints)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/time-clock/sessions/:id/breaks/start` | Owner, Admin, Project Manager, Employee | Start break |
| POST | `/time-clock/sessions/:id/breaks/end` | Owner, Admin, Project Manager, Employee | End break |
| GET | `/time-clock/sessions/:id/breaks` | Owner, Admin, Project Manager, Employee | List breaks for session |

### Disputes (7 endpoints)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/time-clock/sessions/:id/disputes` | Owner, Admin, Project Manager, Employee | Submit dispute |
| GET | `/time-clock/disputes` | Owner, Admin | List all disputes |
| GET | `/time-clock/disputes/mine` | Owner, Admin, Project Manager, Employee | My disputes |
| GET | `/time-clock/disputes/:id` | Owner, Admin, Project Manager, Employee | Get dispute detail |
| PATCH | `/time-clock/disputes/:id/approve` | Owner, Admin | Approve dispute |
| PATCH | `/time-clock/disputes/:id/reject` | Owner, Admin | Reject dispute |
| DELETE | `/time-clock/disputes/:id` | Owner, Admin, Project Manager, Employee | Cancel pending dispute |

### Kiosk — PUBLIC (3 endpoints)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/time-clock/kiosk/employees` | X-Kiosk-Token | List kiosk-eligible employees |
| POST | `/time-clock/kiosk/clock-in` | X-Kiosk-Token + PIN | Clock in via kiosk |
| POST | `/time-clock/kiosk/clock-out` | X-Kiosk-Token + PIN | Clock out via kiosk |

### Dashboard (1 endpoint)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/time-clock/dashboard/whos-in` | Owner, Admin, Project Manager | Who's currently clocked in |

### Reports (6 endpoints)
| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/time-clock/reports/timesheet` | Owner, Admin, Project Manager, Bookkeeper | Timesheet report |
| GET | `/time-clock/reports/payroll` | Owner, Admin, Bookkeeper | Payroll summary |
| GET | `/time-clock/reports/payroll/export` | Owner, Admin, Bookkeeper | Export payroll CSV |
| GET | `/time-clock/reports/shift-variance` | Owner, Admin, Project Manager | Shift variance |
| GET | `/time-clock/reports/geo-violations` | Owner, Admin | Geo violation report |
| GET | `/time-clock/reports/activity-feed` | Owner, Admin, Project Manager | Activity feed |

---

## 12. Open Questions Resolved

| # | Question | Resolution | Source |
|---|----------|-----------|--------|
| Q-01 | Is `crew_hour_log.project_id` nullable? | No — currently `String @db.VarChar(36)` (non-nullable). Requires migration to `String?` before time clock deployment. | `api/prisma/schema.prisma` line 4454 |
| Q-02 | What is the exact `hour_log_source` enum value for clock-in system? | `clockin_system` — already present in schema. | `api/prisma/schema.prisma` |
| Q-03 | What is the exact field name for crew member hourly rate? | `crew_member.default_hourly_rate` — `Decimal? @db.Decimal(8, 2)` | `api/prisma/schema.prisma` line 1531 |
| Q-04 | Does the tenant model have a timezone field? | Yes — `tenant.timezone` is `String @default("America/New_York") @db.VarChar(50)` | `api/prisma/schema.prisma` line 348 |
| Q-05 | What role name strings are in the seed? | `Owner`, `Admin`, `Estimator`, `Project Manager`, `Bookkeeper`, `Employee`, `Read-only` | `api/prisma/seeds/rbac.seed.ts` |
| Q-06 | Does the `timeclock` module exist in RBAC seed? | Yes — with permissions: `view`, `clock_in`, `clock_out`, `edit`, `delete`. Needs expansion. | `api/prisma/seeds/rbac.seed.ts` |
| Q-07 | What is the existing controller auth pattern? | `@Request() req` → `req.user.tenant_id`, `req.user.id`. Some controllers use `'Manager'` instead of `'Project Manager'`. | `api/src/modules/financial/controllers/crew-hour-log.controller.ts` |
| Q-08 | How does `CrewHourLogService.logHours()` set the source field? | Hardcodes `source: 'manual'`. Time clock must bypass this service and call `prisma.crew_hour_log.create()` directly. | `api/src/modules/financial/services/crew-hour-log.service.ts` |
| Q-09 | What queue names exist in the system? | `email`, `scheduled`, `export`, `scheduled-reports`, `ocr-processing`, `recurring-expense-generation`, `audit-log-write`, `project-management`. Time clock adds `time-clock`. | `api/src/modules/jobs/jobs.module.ts`, various processors |
| Q-10 | Is `crew_member.user_id` nullable? | Yes — `String? @unique @db.VarChar(36)`. Auto-link rule uses this to match crew_member to employee_profile. | `api/prisma/schema.prisma` line 1516 |
| Q-11 | What is the pagination response shape? | `{ data: [], meta: { total, page, limit, totalPages } }` | `api/src/modules/projects/services/project.service.ts` |
| Q-12 | Does `GoogleMapsService` need cross-module import? | Yes — lives in `LeadsModule`. TimeClockModule must import `LeadsModule` or export `GoogleMapsService`. | `api/src/modules/leads/services/google-maps.service.ts` |
| Q-13 | Should `clock_session_status` include `flagged`? | No — original spec includes `flagged` but it conflicts with `is_flagged` boolean. A session can be `active` AND flagged simultaneously (geofence warn_only). Using `status = 'flagged'` would imply the session is no longer active, which is wrong. Flagging is tracked solely via `is_flagged` + `flag_reason`. | Architectural decision |
| Q-14 | BR-001 says "across all tenants" — should we query cross-tenant? | No — cross-tenant queries violate the absolute tenant isolation rule. Narrowed to single-tenant check. A user in multiple tenants may have one active session per tenant. | Platform security constraint |

---

## 13. Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `crew_hour_log.project_id` migration | Existing code depends on non-nullable project_id | Run migration before deploying time clock. Existing code always provides project_id. |
| Cross-module dependency (GoogleMapsService) | Tight coupling between TimeClockModule and LeadsModule | Import LeadsModule. Document for future refactor to core/. |
| Role name "Manager" vs "Project Manager" | Existing controllers use "Manager" which doesn't match seed | Time clock uses correct "Project Manager". Flag existing inconsistency. |
| Kiosk security | Public endpoints with PIN auth | bcrypt hashing, rate limiting, lockout, token rotation |
| Overtime edge cases | DST transitions, midnight boundary, multi-timezone | Use tenant timezone consistently, test edge cases |
| Labor cost double-posting | Session edited after labor cost posted | Idempotency flag + reconciliation flag, never auto-repost |

---

## 14. Sprint Build Order

### Backend Sprints
| Sprint | Focus | Dependencies |
|--------|-------|-------------|
| B-01 | Schema + migration + RBAC seed + module scaffold + Settings CRUD | None |
| B-02 | Employee Profiles CRUD + push subscription | B-01 |
| B-03 | Clock-in Addresses CRUD + import endpoints + GeofenceService | B-01, LeadsModule |
| B-04 | Employee-Project Assignments + Work Shifts CRUD + bulk create | B-02 |
| B-05 | Clock Sessions (clock-in/out) + OvertimeService + LaborCostAttributionService + Breaks | B-02, B-03, B-04 |
| B-06 | Manual Edit + Edit Log + Disputes lifecycle | B-05 |
| B-07 | KioskTokenGuard + Kiosk endpoints + Background Jobs | B-05, B-04 |
| B-08 | Dashboard + Reports + Payroll Export | B-05, B-06 |

### Frontend Sprints
| Sprint | Focus | Dependencies |
|--------|-------|-------------|
| F-01 | API client + types + Settings page + Employee Profiles + Addresses | B-01, B-02, B-03 |
| F-02 | Clock page (GPS, breaks, today's sessions) + My Hours | B-05 |
| F-03 | Shifts + My Shifts + Disputes + Dashboard (who's in) | B-04, B-06, B-08 |
| F-04 | Reports + Kiosk page + push subscription | B-07, B-08 |

---

**End of Feature Contract**
