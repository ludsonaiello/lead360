# Sprint 2 — RBAC Seed + Module Scaffold + AppModule Registration
**Module:** time-clock
**File:** ./documentation/sprints/clockin_backend/sprint_2.md
**Type:** Backend — Infrastructure
**Depends On:** Sprint 1
**Gate:** STOP — Dev server must compile with zero errors, seed must run clean.
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

## Objective

Update RBAC permissions for the time-clock module, create the full NestJS module directory structure with placeholder stubs for all controllers/services, implement the TimeClockModule, and register it in AppModule.

---

## Pre-Sprint Checklist
- [ ] Verify Sprint 1 is complete (migration applied, `npx prisma validate` passes)
- [ ] Read `api/prisma/seeds/rbac.seed.ts` — understand permission upsert pattern and existing timeclock permissions
- [ ] Read `api/src/app.module.ts` — understand module registration pattern
- [ ] Read an existing module file (e.g., `api/src/modules/financial/financial.module.ts`) — understand `@Module` structure

---

## Tasks

### Task 1 — Update RBAC Seed

**What:** Update `api/prisma/seeds/rbac.seed.ts`.

The `timeclock` module already exists (sort_order: 11) with these **5 existing permissions**: `view`, `clock_in`, `clock_out`, `edit`, `delete`.

**ADD these 12 NEW permission actions** to the `timeclock` module's permission array (KEEP the existing 5 — do NOT remove them):

```typescript
{ action: 'manage_settings', display_name: 'Manage Time Clock Settings', description: 'Configure time clock tenant settings' },
{ action: 'manage_employees', display_name: 'Manage Employee Profiles', description: 'Create and manage employee time clock profiles' },
{ action: 'manage_addresses', display_name: 'Manage Clock-In Addresses', description: 'Create and manage geofence clock-in locations' },
{ action: 'manage_shifts', display_name: 'Manage Work Shifts', description: 'Create and manage scheduled work shifts' },
{ action: 'view_own', display_name: 'View Own Time Data', description: 'View own clock sessions and hours' },
{ action: 'view_all', display_name: 'View All Time Data', description: 'View all employee clock sessions and hours' },
{ action: 'edit_session', display_name: 'Edit Clock Sessions', description: 'Manually edit clock session times' },
{ action: 'submit_dispute', display_name: 'Submit Time Disputes', description: 'Submit time correction disputes' },
{ action: 'review_disputes', display_name: 'Review Time Disputes', description: 'Approve or reject time correction disputes' },
{ action: 'view_reports', display_name: 'View Time Reports', description: 'Access time clock reports and analytics' },
{ action: 'export_payroll', display_name: 'Export Payroll', description: 'Export payroll data to CSV' },
{ action: 'manage_kiosk', display_name: 'Manage Kiosk', description: 'Configure and manage kiosk mode' },
```

**Add role template permissions for these roles:**

**Project Manager** — add to existing permissions array:
```typescript
'timeclock:view', 'timeclock:clock_in', 'timeclock:clock_out',
'timeclock:manage_shifts', 'timeclock:view_own', 'timeclock:view_all',
'timeclock:submit_dispute', 'timeclock:view_reports',
```

**Bookkeeper** — add to existing permissions array:
```typescript
'timeclock:view', 'timeclock:view_all', 'timeclock:view_reports', 'timeclock:export_payroll',
```

**Employee** — add to existing permissions array:
```typescript
'timeclock:view', 'timeclock:clock_in', 'timeclock:clock_out',
'timeclock:view_own', 'timeclock:submit_dispute',
```

**Owner** and **Admin** get ALL permissions automatically (no changes needed for them).

**Acceptance:** Seed runs without errors. Total timeclock permissions = 17 (5 existing + 12 new).

---

### Task 2 — Create Module Directory Structure

**What:** Create the complete directory tree under `api/src/modules/time-clock/`:

```
api/src/modules/time-clock/
├── time-clock.module.ts
├── controllers/
│   ├── time-clock-settings.controller.ts        (stub)
│   ├── employee-profile.controller.ts           (stub)
│   ├── clockin-address.controller.ts            (stub)
│   ├── employee-project-assignment.controller.ts (stub)
│   ├── work-shift.controller.ts                 (stub)
│   ├── clock-session.controller.ts              (stub)
│   ├── break-entry.controller.ts                (stub)
│   ├── time-dispute.controller.ts               (stub)
│   ├── kiosk.controller.ts                      (stub)
│   ├── time-clock-dashboard.controller.ts       (stub)
│   └── time-clock-reports.controller.ts         (stub)
├── services/
│   ├── time-clock-settings.service.ts           (stub)
│   ├── employee-profile.service.ts              (stub)
│   ├── clockin-address.service.ts               (stub)
│   ├── employee-project-assignment.service.ts   (stub)
│   ├── work-shift.service.ts                    (stub)
│   ├── clock-session.service.ts                 (stub)
│   ├── break-entry.service.ts                   (stub)
│   ├── clock-session-edit.service.ts            (stub)
│   ├── time-dispute.service.ts                  (stub)
│   ├── kiosk.service.ts                         (stub)
│   ├── geofence.service.ts                      (stub)
│   ├── overtime.service.ts                      (stub)
│   ├── labor-cost-attribution.service.ts        (stub)
│   ├── time-clock-dashboard.service.ts          (stub)
│   └── time-clock-reports.service.ts            (stub)
├── processors/
│   └── time-clock.processor.ts                  (stub)
├── schedulers/
│   └── time-clock.scheduler.ts                  (stub)
├── guards/
│   └── kiosk-token.guard.ts                     (stub)
└── dto/
    └── (empty — DTOs created in their respective sprints)
```

**11 controller stubs** — each file:
```typescript
import { Controller } from '@nestjs/common';

@Controller('time-clock')
export class XxxController {}
```

**15 service stubs** — each file:
```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class XxxService {}
```

**1 processor stub:**
```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class TimeClockProcessor {}
```

**1 scheduler stub:**
```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class TimeClockScheduler {}
```

**1 guard stub:**
```typescript
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class KioskTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    return true; // Placeholder — implemented in Sprint 7
  }
}
```

**Acceptance:** All files exist. Each has a valid TypeScript class.

---

### Task 3 — Implement TimeClockModule

**What:** Create `api/src/modules/time-clock/time-clock.module.ts` with all stubs registered:

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../../core/database';
import { AuditModule } from '../audit/audit.module';
import { CommunicationModule } from '../communication/communication.module';
import { LeadsModule } from '../leads/leads.module';

// Import ALL 11 controllers
import { TimeClockSettingsController } from './controllers/time-clock-settings.controller';
import { EmployeeProfileController } from './controllers/employee-profile.controller';
import { ClockinAddressController } from './controllers/clockin-address.controller';
import { EmployeeProjectAssignmentController } from './controllers/employee-project-assignment.controller';
import { WorkShiftController } from './controllers/work-shift.controller';
import { ClockSessionController } from './controllers/clock-session.controller';
import { BreakEntryController } from './controllers/break-entry.controller';
import { TimeDisputeController } from './controllers/time-dispute.controller';
import { KioskController } from './controllers/kiosk.controller';
import { TimeClockDashboardController } from './controllers/time-clock-dashboard.controller';
import { TimeClockReportsController } from './controllers/time-clock-reports.controller';

// Import ALL 15 services
import { TimeClockSettingsService } from './services/time-clock-settings.service';
import { EmployeeProfileService } from './services/employee-profile.service';
import { ClockinAddressService } from './services/clockin-address.service';
import { EmployeeProjectAssignmentService } from './services/employee-project-assignment.service';
import { WorkShiftService } from './services/work-shift.service';
import { ClockSessionService } from './services/clock-session.service';
import { BreakEntryService } from './services/break-entry.service';
import { ClockSessionEditService } from './services/clock-session-edit.service';
import { TimeDisputeService } from './services/time-dispute.service';
import { KioskService } from './services/kiosk.service';
import { GeofenceService } from './services/geofence.service';
import { OvertimeService } from './services/overtime.service';
import { LaborCostAttributionService } from './services/labor-cost-attribution.service';
import { TimeClockDashboardService } from './services/time-clock-dashboard.service';
import { TimeClockReportsService } from './services/time-clock-reports.service';
import { RBACModule } from '../rbac/rbac.module';

// Import processor, scheduler, guard
import { TimeClockProcessor } from './processors/time-clock.processor';
import { TimeClockScheduler } from './schedulers/time-clock.scheduler';
import { KioskTokenGuard } from './guards/kiosk-token.guard';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    CommunicationModule,
    LeadsModule,
    RBACModule,   // Required for @Roles() decorator and RolesGuard in all controllers
    BullModule.registerQueue({ name: 'time-clock' }),
  ],
  controllers: [
    TimeClockSettingsController,
    EmployeeProfileController,
    ClockinAddressController,
    EmployeeProjectAssignmentController,
    WorkShiftController,
    ClockSessionController,
    BreakEntryController,
    TimeDisputeController,
    KioskController,
    TimeClockDashboardController,
    TimeClockReportsController,
  ],
  providers: [
    TimeClockSettingsService,
    EmployeeProfileService,
    ClockinAddressService,
    EmployeeProjectAssignmentService,
    WorkShiftService,
    ClockSessionService,
    BreakEntryService,
    ClockSessionEditService,
    TimeDisputeService,
    KioskService,
    GeofenceService,
    OvertimeService,
    LaborCostAttributionService,
    TimeClockDashboardService,
    TimeClockReportsService,
    TimeClockProcessor,
    TimeClockScheduler,
    KioskTokenGuard,
  ],
  exports: [
    ClockSessionService,
    EmployeeProfileService,
    GeofenceService,
    OvertimeService,
  ],
})
export class TimeClockModule {}
```

**Acceptance:** Module compiles with no errors.

---

### Task 4 — Register TimeClockModule in AppModule

**What:** Update `api/src/app.module.ts`:

```typescript
import { TimeClockModule } from './modules/time-clock/time-clock.module';
```

Add `TimeClockModule` to the `imports` array **AFTER** `PortalModule`.

**Acceptance:** Dev server compiles with no errors.

---

### Task 5 — Verify Compilation and Health Check

**What:** Start the dev server and confirm everything works.

1. Start server: `cd /var/www/lead360.app/api && npm run start:dev`
2. Wait for compilation (60-120 seconds)
3. Verify: `curl -s http://localhost:8000/health` returns 200
4. Verify: No compilation errors in terminal output
5. Verify: `npm run lint` passes

**Test credentials:**
- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant user: `contact@honeydo4you.com` / `978@F32c`

**Acceptance:** Health check returns 200. Zero compilation errors. Lint passes.

---

## Acceptance Criteria
- [ ] 12 new permissions added to `timeclock` module in RBAC seed (total 17)
- [ ] Role template permissions added for Project Manager, Bookkeeper, Employee
- [ ] All 11 controller stubs created in `controllers/`
- [ ] All 15 service stubs created in `services/`
- [ ] Processor, scheduler, guard stubs created
- [ ] `time-clock.module.ts` registers all controllers/providers
- [ ] `TimeClockModule` registered in `app.module.ts` after PortalModule
- [ ] Dev server compiles with zero errors
- [ ] `curl http://localhost:8000/health` returns 200
- [ ] `npm run lint` passes
- [ ] No frontend code modified
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — Before Sprint 3 begins, verify:
1. Dev server compiles with zero errors
2. Health check returns 200
3. RBAC seed runs without errors
4. All stub files exist and are importable
5. `npm run lint` passes

---

## Handoff Notes
- Sprint 3 will replace the `TimeClockSettingsService` and `TimeClockSettingsController` stubs with real implementations
- Sprint 4 will replace the `EmployeeProfileService` and `EmployeeProfileController` stubs with real implementations
- All other stubs remain placeholders until their respective sprints
- The module structure is now complete — future sprints only need to replace stub content, not create new files
- `LeadsModule` is imported to enable access to `GoogleMapsService` for address geocoding in later sprints
