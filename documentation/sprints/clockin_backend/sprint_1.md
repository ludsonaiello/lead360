# Sprint 1 — Prisma Schema + Migration
**Module:** time-clock
**File:** ./documentation/sprints/clockin_backend/sprint_1.md
**Type:** Migration
**Depends On:** NONE
**Gate:** STOP — `npx prisma validate` must pass, `npx prisma migrate status` shows no pending migrations.
**Estimated Complexity:** High

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

## Objective

Add all Time Clock Prisma schema additions (12 enums, 10 models, relation additions to 5 existing models, 1 breaking change) and run migration. **NO service or controller code in this sprint.**

---

## Pre-Sprint Checklist
- [ ] Read `api/prisma/schema.prisma` — understand existing models, enums, relations
- [ ] Read `api/src/modules/financial/services/crew-hour-log.service.ts` — understand existing `crew_hour_log` usage
- [ ] Confirm no pending migrations: `npx prisma migrate status`

---

## Tasks

### Task 1 — Add 12 New Enums to schema.prisma

**What:** Add these enums to `api/prisma/schema.prisma` in a new section clearly marked `// TIME CLOCK MODULE ENUMS`:

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

**IMPORTANT**: `clock_session_status` does NOT include `flagged`. Flagging is tracked via `is_flagged` boolean + `flag_reason` on `clock_session`. A session can be `active` AND flagged simultaneously.

**Acceptance:** `npx prisma validate` passes.
**Do NOT:** Add any enums not listed here.

---

### Task 2 — Add 10 New Models to schema.prisma

**What:** Add all 10 models. Each model MUST follow these exact field names, types, defaults, indexes, and relations.

#### Model 1: `time_clock_settings`

```prisma
model time_clock_settings {
  id                              String                     @id @default(uuid()) @db.VarChar(36)
  tenant_id                       String                     @unique @db.VarChar(36)
  clock_in_mode                   clock_in_mode              @default(anywhere)
  geofence_violation_action       geofence_violation_action  @default(warn_only)
  gps_required                    Boolean                    @default(true)
  gps_unavailable_action          gps_unavailable_action     @default(allow_flagged)
  require_job_tag                 Boolean                    @default(false)
  require_task_tag                Boolean                    @default(false)
  overtime_enabled                Boolean                    @default(true)
  overtime_daily_threshold_hours  Decimal?                   @default(8.00) @db.Decimal(4, 2)
  overtime_weekly_threshold_hours Decimal?                   @default(40.00) @db.Decimal(5, 2)
  overtime_multiplier             Decimal?                   @default(1.50) @db.Decimal(3, 2)
  pay_period_type                 pay_period_type            @default(biweekly)
  pay_period_start_day            Int?
  pay_period_anchor_date          DateTime?                  @db.Date
  kiosk_mode_enabled              Boolean                    @default(false)
  kiosk_token_hash                String?                    @db.VarChar(255)
  shift_reminder_minutes          Int                        @default(30)
  missed_shift_threshold_minutes  Int                        @default(30)
  native_app_features_enabled     Boolean                    @default(false)
  created_at                      DateTime                   @default(now())
  updated_at                      DateTime                   @updatedAt

  tenant tenant @relation("time_clock_settings_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)

  @@map("time_clock_settings")
}
```

#### Model 2: `employee_profile`

```prisma
model employee_profile {
  id                              String    @id @default(uuid()) @db.VarChar(36)
  tenant_id                       String    @db.VarChar(36)
  user_id                         String    @db.VarChar(36)
  crew_member_id                  String?   @db.VarChar(36)
  hourly_rate                     Decimal?  @db.Decimal(10, 2)
  overtime_rule_override          Boolean   @default(false)
  overtime_daily_threshold_hours  Decimal?  @db.Decimal(4, 2)
  overtime_weekly_threshold_hours Decimal?  @db.Decimal(5, 2)
  kiosk_pin_hash                  String?   @db.VarChar(255)
  kiosk_pin_failed_attempts       Int       @default(0)
  kiosk_pin_locked_until          DateTime?
  is_active                       Boolean   @default(true)
  push_subscription_json          String?   @db.Text
  push_token_native               String?   @db.VarChar(500)
  created_at                      DateTime  @default(now())
  updated_at                      DateTime  @updatedAt

  tenant                  tenant                       @relation("employee_profile_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  user                    user                         @relation("employee_profile_user", fields: [user_id], references: [id], onDelete: Restrict)
  crew_member             crew_member?                 @relation("employee_profile_crew_member", fields: [crew_member_id], references: [id], onDelete: SetNull)
  project_assignments     employee_project_assignment[] @relation("employee_project_assignment_employee")
  work_shifts             work_shift[]                 @relation("work_shift_employee")
  clock_sessions          clock_session[]              @relation("clock_session_employee")

  @@unique([tenant_id, user_id])
  @@index([tenant_id, is_active])
  @@index([tenant_id, crew_member_id])
  @@map("employee_profile")
}
```

#### Model 3: `clockin_address`

```prisma
model clockin_address {
  id                 String         @id @default(uuid()) @db.VarChar(36)
  tenant_id          String         @db.VarChar(36)
  project_id         String?        @db.VarChar(36)
  label              String         @db.VarChar(100)
  address_line1      String         @db.VarChar(255)
  address_line2      String?        @db.VarChar(255)
  city               String         @db.VarChar(100)
  state              String         @db.VarChar(2)
  zip_code           String         @db.VarChar(10)
  latitude           Decimal        @db.Decimal(10, 8)
  longitude          Decimal        @db.Decimal(11, 8)
  radius_meters      Int            @default(100)
  is_active          Boolean        @default(true)
  source             address_source @default(manual)
  source_address_id  String?        @db.VarChar(36)
  created_by_user_id String         @db.VarChar(36)
  created_at         DateTime       @default(now())
  updated_at         DateTime       @updatedAt

  tenant         tenant          @relation("clockin_address_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  project        project?        @relation("clockin_address_project", fields: [project_id], references: [id], onDelete: SetNull)
  created_by     user            @relation("clockin_address_created_by", fields: [created_by_user_id], references: [id], onDelete: Restrict)
  clock_sessions clock_session[] @relation("clock_session_clockin_address")

  @@index([tenant_id, is_active])
  @@index([tenant_id, project_id])
  @@map("clockin_address")
}
```

#### Model 4: `employee_project_assignment`

```prisma
model employee_project_assignment {
  id                  String   @id @default(uuid()) @db.VarChar(36)
  tenant_id           String   @db.VarChar(36)
  employee_profile_id String   @db.VarChar(36)
  project_id          String   @db.VarChar(36)
  assigned_by_user_id String   @db.VarChar(36)
  created_at          DateTime @default(now())

  tenant           tenant           @relation("employee_project_assignment_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  employee_profile employee_profile @relation("employee_project_assignment_employee", fields: [employee_profile_id], references: [id], onDelete: Cascade)
  project          project          @relation("employee_project_assignment_project", fields: [project_id], references: [id], onDelete: Cascade)
  assigned_by      user             @relation("employee_project_assignment_assigned_by", fields: [assigned_by_user_id], references: [id], onDelete: Restrict)

  @@unique([tenant_id, employee_profile_id, project_id])
  @@index([tenant_id, project_id])
  @@map("employee_project_assignment")
}
```

#### Model 5: `work_shift`

```prisma
model work_shift {
  id                  String            @id @default(uuid()) @db.VarChar(36)
  tenant_id           String            @db.VarChar(36)
  employee_profile_id String            @db.VarChar(36)
  project_id          String?           @db.VarChar(36)
  task_id             String?           @db.VarChar(36)
  scheduled_start     DateTime
  scheduled_end       DateTime
  title               String?           @db.VarChar(100)
  notes               String?           @db.Text
  status              work_shift_status @default(scheduled)
  reminder_sent_at    DateTime?
  published_at        DateTime?
  created_by_user_id  String            @db.VarChar(36)
  created_at          DateTime          @default(now())
  updated_at          DateTime          @updatedAt

  tenant           tenant           @relation("work_shift_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  employee_profile employee_profile @relation("work_shift_employee", fields: [employee_profile_id], references: [id], onDelete: Cascade)
  project          project?         @relation("work_shift_project", fields: [project_id], references: [id], onDelete: SetNull)
  task             project_task?    @relation("work_shift_task", fields: [task_id], references: [id], onDelete: SetNull)
  created_by       user             @relation("work_shift_created_by", fields: [created_by_user_id], references: [id], onDelete: Restrict)
  clock_sessions   clock_session[]  @relation("clock_session_work_shift")

  @@index([tenant_id, employee_profile_id, scheduled_start])
  @@index([tenant_id, status])
  @@index([tenant_id, scheduled_start])
  @@map("work_shift")
}
```

#### Model 6: `clock_session`

```prisma
model clock_session {
  id                               String               @id @default(uuid()) @db.VarChar(36)
  tenant_id                        String               @db.VarChar(36)
  employee_profile_id              String               @db.VarChar(36)
  work_shift_id                    String?              @db.VarChar(36)
  project_id                       String?              @db.VarChar(36)
  task_id                          String?              @db.VarChar(36)
  clockin_address_id               String?              @db.VarChar(36)
  status                           clock_session_status @default(active)
  clock_in_at                      DateTime
  clock_out_at                     DateTime?
  clock_in_latitude                Decimal?             @db.Decimal(10, 8)
  clock_in_longitude               Decimal?             @db.Decimal(11, 8)
  clock_in_location_source         location_source      @default(browser_gps)
  clock_in_geofence_status         geofence_status      @default(not_enforced)
  clock_out_latitude               Decimal?             @db.Decimal(10, 8)
  clock_out_longitude              Decimal?             @db.Decimal(11, 8)
  clock_out_location_source        location_source      @default(browser_gps)
  clock_out_geofence_status        geofence_status      @default(not_enforced)
  total_worked_minutes             Int?
  regular_minutes                  Int?
  overtime_minutes                 Int?
  is_manual_edit                   Boolean              @default(false)
  is_flagged                       Boolean              @default(false)
  flag_reason                      String?              @db.VarChar(255)
  labor_cost_posted                Boolean              @default(false)
  labor_cost_entry_id              String?              @db.VarChar(36)
  labor_cost_reconciliation_needed Boolean              @default(false)
  notes                            String?              @db.Text
  created_at                       DateTime             @default(now())
  updated_at                       DateTime             @updatedAt

  tenant           tenant            @relation("clock_session_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  employee_profile employee_profile  @relation("clock_session_employee", fields: [employee_profile_id], references: [id], onDelete: Restrict)
  work_shift       work_shift?       @relation("clock_session_work_shift", fields: [work_shift_id], references: [id], onDelete: SetNull)
  project          project?          @relation("clock_session_project", fields: [project_id], references: [id], onDelete: SetNull)
  task             project_task?     @relation("clock_session_task", fields: [task_id], references: [id], onDelete: SetNull)
  clockin_address  clockin_address?  @relation("clock_session_clockin_address", fields: [clockin_address_id], references: [id], onDelete: SetNull)
  break_entries    break_entry[]     @relation("break_entry_session")
  edit_logs        clock_session_edit_log[] @relation("clock_session_edit_log_session")
  disputes         time_dispute[]    @relation("time_dispute_session")
  location_logs    clock_session_location_log[] @relation("clock_session_location_log_session")

  @@index([tenant_id, employee_profile_id, clock_in_at])
  @@index([tenant_id, status])
  @@index([tenant_id, project_id])
  @@index([tenant_id, is_flagged])
  @@index([tenant_id, clock_in_at])
  @@index([tenant_id, labor_cost_posted])
  @@map("clock_session")
}
```

#### Model 7: `break_entry`

```prisma
model break_entry {
  id               String     @id @default(uuid()) @db.VarChar(36)
  tenant_id        String     @db.VarChar(36)
  clock_session_id String     @db.VarChar(36)
  break_type       break_type @default(unpaid)
  break_label      String?    @db.VarChar(50)
  started_at       DateTime
  ended_at         DateTime?
  duration_minutes Int?
  created_at       DateTime   @default(now())
  updated_at       DateTime   @updatedAt

  tenant        tenant        @relation("break_entry_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  clock_session clock_session @relation("break_entry_session", fields: [clock_session_id], references: [id], onDelete: Cascade)

  @@index([tenant_id, clock_session_id])
  @@map("break_entry")
}
```

#### Model 8: `clock_session_edit_log`

```prisma
model clock_session_edit_log {
  id                String   @id @default(uuid()) @db.VarChar(36)
  tenant_id         String   @db.VarChar(36)
  clock_session_id  String   @db.VarChar(36)
  edited_by_user_id String   @db.VarChar(36)
  field_changed     String   @db.VarChar(100)
  original_value    String?  @db.Text
  new_value         String?  @db.Text
  reason            String   @db.Text
  edited_at         DateTime @default(now())

  tenant        tenant        @relation("clock_session_edit_log_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  clock_session clock_session @relation("clock_session_edit_log_session", fields: [clock_session_id], references: [id], onDelete: Cascade)
  edited_by     user          @relation("clock_session_edit_log_editor", fields: [edited_by_user_id], references: [id], onDelete: Restrict)

  @@index([tenant_id, clock_session_id])
  @@map("clock_session_edit_log")
}
```

**NOTE:** This model has NO `updated_at` field — it is immutable. Once an edit log record is written, it must never be modified.

#### Model 9: `time_dispute`

```prisma
model time_dispute {
  id                    String         @id @default(uuid()) @db.VarChar(36)
  tenant_id             String         @db.VarChar(36)
  clock_session_id      String         @db.VarChar(36)
  submitted_by_user_id  String         @db.VarChar(36)
  dispute_type          dispute_type
  description           String         @db.Text
  proposed_clock_in_at  DateTime?
  proposed_clock_out_at DateTime?
  proposed_project_id   String?        @db.VarChar(36)
  proposed_task_id      String?        @db.VarChar(36)
  proposed_notes        String?        @db.Text
  status                dispute_status @default(pending)
  reviewed_by_user_id   String?        @db.VarChar(36)
  review_notes          String?        @db.Text
  reviewed_at           DateTime?
  created_at            DateTime       @default(now())
  updated_at            DateTime       @updatedAt

  tenant        tenant        @relation("time_dispute_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  clock_session clock_session @relation("time_dispute_session", fields: [clock_session_id], references: [id], onDelete: Cascade)
  submitted_by  user          @relation("time_dispute_submitter", fields: [submitted_by_user_id], references: [id], onDelete: Restrict)
  reviewed_by   user?         @relation("time_dispute_reviewer", fields: [reviewed_by_user_id], references: [id], onDelete: SetNull)

  @@index([tenant_id, clock_session_id])
  @@index([tenant_id, status])
  @@map("time_dispute")
}
```

#### Model 10: `clock_session_location_log` (Phase 2 placeholder — create table, NO data writes)

```prisma
model clock_session_location_log {
  id               String          @id @default(uuid()) @db.VarChar(36)
  tenant_id        String          @db.VarChar(36)
  clock_session_id String          @db.VarChar(36)
  captured_at      DateTime
  latitude         Decimal         @db.Decimal(10, 8)
  longitude        Decimal         @db.Decimal(11, 8)
  accuracy_meters  Decimal?        @db.Decimal(6, 2)
  geofence_status  geofence_status

  tenant        tenant        @relation("clock_session_location_log_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)
  clock_session clock_session @relation("clock_session_location_log_session", fields: [clock_session_id], references: [id], onDelete: Cascade)

  @@index([tenant_id, clock_session_id])
  @@map("clock_session_location_log")
}
```

**NOTE:** This model has NO `created_at` or `updated_at` fields. It is a Phase 2 placeholder — create the table structure but do NOT write any data to it in Phase 1.

**Acceptance:** `npx prisma validate` passes with all 10 models.

---

### Task 3 — Add Relation Fields to Existing Models

**What:** Add these relation fields to existing models in `schema.prisma`. Do NOT remove or modify any existing relation fields — only ADD new ones.

**In `model tenant`** (add alongside existing relation fields — 10 relations):
```prisma
  time_clock_settings              time_clock_settings?               @relation("time_clock_settings_tenant")
  employee_profiles                employee_profile[]                 @relation("employee_profile_tenant")
  clockin_addresses                clockin_address[]                  @relation("clockin_address_tenant")
  employee_project_assignments     employee_project_assignment[]      @relation("employee_project_assignment_tenant")
  work_shifts                      work_shift[]                       @relation("work_shift_tenant")
  clock_sessions                   clock_session[]                    @relation("clock_session_tenant")
  break_entries                    break_entry[]                      @relation("break_entry_tenant")
  clock_session_edit_logs          clock_session_edit_log[]           @relation("clock_session_edit_log_tenant")
  time_disputes                    time_dispute[]                     @relation("time_dispute_tenant")
  clock_session_location_logs      clock_session_location_log[]       @relation("clock_session_location_log_tenant")
```

**In `model user`** (add alongside existing relation fields — 7 relations):
```prisma
  employee_profiles                employee_profile[]                 @relation("employee_profile_user")
  clockin_addresses_created        clockin_address[]                  @relation("clockin_address_created_by")
  employee_project_assignments_by  employee_project_assignment[]      @relation("employee_project_assignment_assigned_by")
  work_shifts_created              work_shift[]                       @relation("work_shift_created_by")
  clock_session_edit_logs          clock_session_edit_log[]           @relation("clock_session_edit_log_editor")
  time_disputes_submitted          time_dispute[]                     @relation("time_dispute_submitter")
  time_disputes_reviewed           time_dispute[]                     @relation("time_dispute_reviewer")
```

**In `model crew_member`** (add alongside existing relation fields — 1 relation):
```prisma
  employee_profiles                employee_profile[]                 @relation("employee_profile_crew_member")
```

**In `model project`** (add alongside existing relation fields — 4 relations):
```prisma
  clockin_addresses                clockin_address[]                  @relation("clockin_address_project")
  employee_project_assignments     employee_project_assignment[]      @relation("employee_project_assignment_project")
  work_shifts                      work_shift[]                       @relation("work_shift_project")
  clock_sessions                   clock_session[]                    @relation("clock_session_project")
```

**In `model project_task`** (add alongside existing relation fields — 2 relations):
```prisma
  work_shifts                      work_shift[]                       @relation("work_shift_task")
  clock_sessions                   clock_session[]                    @relation("clock_session_task")
```

**Acceptance:** `npx prisma validate` passes.

---

### Task 4 — Breaking Change: Make `crew_hour_log.project_id` Nullable

**What:** In the existing `crew_hour_log` model, change `project_id` from required to optional:

```prisma
// BEFORE (current)
  project_id  String       @db.VarChar(36)
  project     project      @relation("crew_hour_log_project", fields: [project_id], references: [id], onDelete: Cascade)

// AFTER (new)
  project_id  String?      @db.VarChar(36)
  project     project?     @relation("crew_hour_log_project", fields: [project_id], references: [id], onDelete: Cascade)
```

**Why:** The time clock module may create `crew_hour_log` entries where project assignment is optional (e.g., an employee clocks in without selecting a project). All existing code always provides `project_id`, so it will continue to work without changes.

**Acceptance:** `npx prisma validate` passes. Existing `crew_hour_log` creation code is unaffected.

---

### Task 5 — Run Prisma Migration

**What:** Run the migration. **The user MUST approve this command before you execute it.**

```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name add_time_clock_module
npx prisma generate
```

**Post-migration verification:**
```bash
npx prisma validate
npx prisma migrate status
```

**Acceptance:** Migration applies cleanly. `npx prisma migrate status` shows no pending migrations. `npx prisma validate` passes.

**Do NOT:** Run migration without user approval.

---

## Acceptance Criteria
- [ ] All 12 enums added to schema.prisma
- [ ] All 10 models added to schema.prisma with exact field names, types, defaults, indexes
- [ ] Relation fields added to `tenant` (10), `user` (7), `crew_member` (1), `project` (4), `project_task` (2)
- [ ] `crew_hour_log.project_id` made nullable (`String?` and `project?`)
- [ ] `npx prisma validate` passes
- [ ] Migration applied successfully (`npx prisma migrate status` shows no pending)
- [ ] `npx prisma generate` runs clean
- [ ] No service or controller code created in this sprint
- [ ] No frontend code modified

---

## Gate Marker

**STOP** — Before Sprint 2 begins, verify:
1. `npx prisma validate` passes
2. `npx prisma migrate status` shows no pending migrations
3. All 12 enums exist in schema.prisma
4. All 10 models exist in schema.prisma with correct fields
5. All relation additions present on tenant, user, crew_member, project, project_task

---

## Handoff Notes
- Sprint 2 depends on this migration being complete — it will scaffold the NestJS module and register RBAC permissions
- The `employee_profile` model is the central entity linking `user` to time clock data
- The `clock_session` model has 30+ fields and 6 indexes — verify all are present
- `clock_session_location_log` is a Phase 2 placeholder — table exists but no code writes to it
- `clock_session_edit_log` has NO `updated_at` — it is immutable by design
