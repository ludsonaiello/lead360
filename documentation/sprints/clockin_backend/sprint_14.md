# Sprint 14 — Background Jobs: Missed Shift Detector + Shift Reminder (2 Jobs)
**Module:** time-clock
**File:** ./documentation/sprints/clockin_backend/sprint_14.md
**Type:** Backend — Background Jobs
**Depends On:** Sprint 7 (Work Shifts CRUD)
**Gate:** NONE
**Estimated Complexity:** Medium

---

## Code Quality Standard

> You are a **Google / Amazon / Apple senior-level engineer**. Every file you produce must be production-grade: clean, safe, fully typed, zero lint errors, zero runtime errors. No TODO comments, no placeholder code, no shortcuts. Review your own output as if submitting a PR to a FAANG codebase.

---

## Objective

Implement 2 background jobs using BullMQ + `@nestjs/schedule`: a Missed Shift Detector (runs every 15 minutes, marks unattended shifts as `missed` and notifies admins + employees) and a Shift Reminder (runs every minute, sends upcoming-shift notifications to employees). Both jobs run per-tenant with error isolation so one tenant failure never blocks others.

---

## Pre-Sprint Checklist
- [ ] Verify Sprint 7 is complete (`work_shift` model populated, shift CRUD working)
- [ ] Read `api/src/modules/time-clock/time-clock.module.ts` — understand current providers and imports
- [ ] Read `api/prisma/schema.prisma` — verify `work_shift`, `clock_session`, `time_clock_settings` models
- [ ] Read `api/src/modules/communication/services/notifications.service.ts` — exact `createNotification()` signature
- [ ] Confirm `@nestjs/bullmq` and `bullmq` are installed: `npm ls @nestjs/bullmq bullmq`
- [ ] Confirm `@nestjs/schedule` is installed: `npm ls @nestjs/schedule`
- [ ] Verify `ScheduleModule.forRoot()` is registered (may be in AppModule — check first; if in AppModule, do NOT duplicate)
- [ ] Verify `BullModule.forRoot()` is registered with Redis connection in AppModule (or add if missing using Redis details from `.env`)

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

### Task 1 — TimeClockScheduler (BullMQ Job Producer)

**What:** Create `api/src/modules/time-clock/schedulers/time-clock.scheduler.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class TimeClockScheduler {
  constructor(
    @InjectQueue('time-clock') private readonly timeClockQueue: Queue,
  ) {}

  @Cron('*/15 * * * *')
  async missedShiftCheck() {
    await this.timeClockQueue.add('missed-shift-check', {}, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 },
    });
  }

  @Cron('* * * * *')
  async shiftReminder() {
    await this.timeClockQueue.add('shift-reminder', {}, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }
}
```

**Key Details:**
- `@InjectQueue('time-clock')` requires `BullModule.registerQueue({ name: 'time-clock' })` in the module imports
- Missed shift check runs every 15 minutes with 3 retry attempts and exponential backoff (10s base)
- Shift reminder runs every minute with 2 retry attempts and exponential backoff (5s base)
- Jobs are added with empty payload `{}` — the processor fetches fresh data from the database
- Import `Cron` from `@nestjs/schedule`, `InjectQueue` from `@nestjs/bullmq`, `Queue` from `bullmq`

---

### Task 2 — TimeClockProcessor (BullMQ Job Consumer)

**What:** Create `api/src/modules/time-clock/processors/time-clock.processor.ts`

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MissedShiftService } from '../services/missed-shift.service';
import { ShiftReminderService } from '../services/shift-reminder.service';

@Processor('time-clock')
export class TimeClockProcessor extends WorkerHost {
  private readonly logger = new Logger(TimeClockProcessor.name);

  constructor(
    private readonly missedShiftService: MissedShiftService,
    private readonly shiftReminderService: ShiftReminderService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing job: ${job.name} (ID: ${job.id})`);

    switch (job.name) {
      case 'missed-shift-check':
        await this.missedShiftService.detectMissedShifts();
        break;
      case 'shift-reminder':
        await this.shiftReminderService.sendReminders();
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }
}
```

**Key Details:**
- Extends `WorkerHost` from `@nestjs/bullmq`
- The `process()` method routes by `job.name`
- Delegates to dedicated services for each job type (separation of concerns)
- Uses NestJS `Logger` for structured logging

---

### Task 3 — MissedShiftService (BR-010)

**What:** Create `api/src/modules/time-clock/services/missed-shift.service.ts`

**Constructor dependencies:**
- `PrismaService`
- `NotificationsService`

**Method: `async detectMissedShifts(): Promise<void>`**

**Algorithm:**

1. **Get all active tenants:**
   ```typescript
   const tenants = await this.prisma.tenant.findMany({
     where: { is_active: true, deleted_at: null },
     select: { id: true },
   });
   ```

2. **Iterate tenants — one tenant failure must NOT stop others:**
   ```typescript
   for (const tenant of tenants) {
     try {
       await this.processTenantMissedShifts(tenant.id);
     } catch (error) {
       this.logger.error(`Missed shift check failed for tenant ${tenant.id}: ${error.message}`, error.stack);
     }
   }
   ```

3. **Per tenant (`processTenantMissedShifts`):**

   a. Get tenant settings:
   ```typescript
   const settings = await this.prisma.time_clock_settings.findFirst({
     where: { tenant_id: tenantId },
     select: { missed_shift_threshold_minutes: true },
   });
   if (!settings || !settings.missed_shift_threshold_minutes) return; // No threshold configured, skip
   ```

   b. Calculate threshold time:
   ```typescript
   const thresholdTime = new Date(Date.now() - settings.missed_shift_threshold_minutes * 60 * 1000);
   ```

   c. Find candidate missed shifts:
   ```typescript
   const shifts = await this.prisma.work_shift.findMany({
     where: {
       tenant_id: tenantId,
       status: 'scheduled',
       scheduled_start: { lt: thresholdTime },
     },
     include: {
       employee_profile: {
         include: { user: { select: { id: true, first_name: true, last_name: true } } },
       },
     },
   });
   ```

   d. For each shift, check if a matching clock session exists:
   ```typescript
   for (const shift of shifts) {
     const twoHoursBefore = new Date(shift.scheduled_start.getTime() - 2 * 60 * 60 * 1000);
     const twoHoursAfter = new Date(shift.scheduled_start.getTime() + 2 * 60 * 60 * 1000);

     const existingSession = await this.prisma.clock_session.findFirst({
       where: {
         tenant_id: tenantId,
         employee_profile_id: shift.employee_profile_id,
         OR: [
           { work_shift_id: shift.id },
           { clock_in_at: { gte: twoHoursBefore, lte: twoHoursAfter } },
         ],
       },
     });

     if (!existingSession) {
       // Mark shift as missed
       await this.prisma.work_shift.update({
         where: { id: shift.id },
         data: { status: 'missed' },
       });

       const employeeName = `${shift.employee_profile.user.first_name} ${shift.employee_profile.user.last_name}`;
       const minutesAgo = Math.round((Date.now() - shift.scheduled_start.getTime()) / 60000);
       const shiftDate = shift.scheduled_start.toLocaleDateString();
       const shiftTime = shift.scheduled_start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

       // Notify admins
       await this.notifyAdmins(tenantId, {
         type: 'timeclock_missed_shift',
         title: 'Missed Shift',
         message: `${employeeName} has not clocked in -- shift started ${minutesAgo} minutes ago`,
         action_url: '/workforce/timesheets',
       });

       // Notify employee
       await this.notifyEmployee(tenantId, shift.employee_profile.user.id, {
         type: 'timeclock_missed_shift',
         title: 'Missed Shift',
         message: `You were marked as missed for your shift on ${shiftDate} at ${shiftTime}`,
         action_url: '/workforce/my-shifts',
       });
     }
   }
   ```

**Private helper methods:**

- `private async notifyAdmins(tenantId: string, notification: { type: string; title: string; message: string; action_url: string })` — Query `user_tenant_membership` joined with `user_role` where `role.name IN ('Owner', 'Admin')` and `tenant_id = tenantId`. Call `NotificationsService.createNotification()` for each admin user.

- `private async notifyEmployee(tenantId: string, userId: string, notification: { type: string; title: string; message: string; action_url: string })` — Call `NotificationsService.createNotification()` for the specific employee user.

**CRITICAL:** Every Prisma query in this service MUST include `tenant_id` in the where clause. Even though we are iterating by tenant, always include it explicitly for defense in depth.

---

### Task 4 — ShiftReminderService

**What:** Create `api/src/modules/time-clock/services/shift-reminder.service.ts`

**Constructor dependencies:**
- `PrismaService`
- `NotificationsService`

**Method: `async sendReminders(): Promise<void>`**

**Algorithm:**

1. **Get all active tenants:**
   ```typescript
   const tenants = await this.prisma.tenant.findMany({
     where: { is_active: true, deleted_at: null },
     select: { id: true },
   });
   ```

2. **Iterate tenants — one tenant failure must NOT stop others:**
   ```typescript
   for (const tenant of tenants) {
     try {
       await this.processTenantReminders(tenant.id);
     } catch (error) {
       this.logger.error(`Shift reminder failed for tenant ${tenant.id}: ${error.message}`, error.stack);
     }
   }
   ```

3. **Per tenant (`processTenantReminders`):**

   a. Get tenant settings:
   ```typescript
   const settings = await this.prisma.time_clock_settings.findFirst({
     where: { tenant_id: tenantId },
     select: { shift_reminder_minutes: true },
   });
   if (!settings || !settings.shift_reminder_minutes) return; // No reminder configured, skip
   ```

   b. Calculate reminder window:
   ```typescript
   const now = new Date();
   const reminderWindow = new Date(now.getTime() + settings.shift_reminder_minutes * 60 * 1000);
   ```

   c. Find shifts needing reminders:
   ```typescript
   const shifts = await this.prisma.work_shift.findMany({
     where: {
       tenant_id: tenantId,
       status: 'scheduled',
       scheduled_start: { gte: now, lte: reminderWindow },
       reminder_sent_at: null,  // Not yet reminded
       published_at: { not: null },  // Only published shifts
     },
     include: {
       employee_profile: {
         include: { user: { select: { id: true, first_name: true, last_name: true } } },
       },
       project: { select: { name: true } },
     },
   });
   ```

   d. For each shift:
   ```typescript
   for (const shift of shifts) {
     // Set reminder_sent_at BEFORE sending to prevent double-send
     await this.prisma.work_shift.update({
       where: { id: shift.id },
       data: { reminder_sent_at: new Date() },
     });

     const minutesUntilShift = Math.round(
       (shift.scheduled_start.getTime() - Date.now()) / 60000
     );
     const projectName = shift.project?.name || 'Unassigned';

     // Notify employee only
     await this.notificationsService.createNotification({
       tenant_id: tenantId,
       user_id: shift.employee_profile.user.id,
       type: 'timeclock_shift_reminder',
       title: 'Upcoming Shift',
       message: `Your shift starts in ${minutesUntilShift} minutes -- ${projectName}`,
       action_url: '/workforce/my-shifts',
     });
   }
   ```

**CRITICAL:**
- `reminder_sent_at` is set BEFORE the notification is sent. This prevents double-sends if the notification call fails and the job retries. A missed notification is better than a duplicate.
- Only published shifts (`published_at IS NOT NULL`) receive reminders. Draft/unpublished shifts are excluded.
- Every Prisma query MUST include `tenant_id` in the where clause.

---

### Task 5 — Update Module Registration

**What:** Update `api/src/modules/time-clock/time-clock.module.ts` to register all new providers.

**Add to imports:**
- `BullModule.registerQueue({ name: 'time-clock' })` (from `@nestjs/bullmq`)
- Ensure `ScheduleModule.forRoot()` is registered (may already be in AppModule — check first; if in AppModule, do NOT duplicate)

**Add to providers:**
- `TimeClockScheduler`
- `TimeClockProcessor`
- `MissedShiftService`
- `ShiftReminderService`

**Verify existing providers are still registered:**
- All services and controllers from previous sprints must remain

**Check AppModule:** Verify that `BullModule.forRoot({ connection: { host: ..., port: ... } })` is registered in `AppModule` (or wherever the root BullMQ config lives). If not, add it using Redis connection details from `.env`.

---

### Task 6 — Verify Background Jobs

**Test the scheduler and processor are registered:**
1. Check server logs during startup for BullMQ queue registration
2. Check server logs for cron job registration (`TimeClockScheduler`)
3. Wait for the next cron tick (1 minute for shift-reminder, 15 minutes for missed-shift-check)
4. Verify logs show `Processing job: shift-reminder` and/or `Processing job: missed-shift-check`
5. If no shifts exist in the database, the jobs should complete without error (no shifts to process = success)

**Verify tenant isolation:**
- If you have multiple test tenants, verify that a failure processing one tenant does NOT prevent processing of subsequent tenants. Confirm via logs.

---

## Notification Events Summary

| Event Type | Recipients | Title | Trigger |
|---|---|---|---|
| `timeclock_missed_shift` | Admins + Owners AND Employee | Missed Shift | Shift past threshold with no clock-in |
| `timeclock_shift_reminder` | Employee only | Upcoming Shift | Shift starts within reminder window |

---

## Business Rules Enforced in This Sprint
- **BR-010**: Missed shift detection — automated check with configurable threshold per tenant (`missed_shift_threshold_minutes`)
- Shift reminder — sent once per shift, `reminder_sent_at` set before send to prevent duplicates
- Only published shifts (`published_at IS NOT NULL`) receive reminders
- Tenant isolation — every background job processes per-tenant with error isolation; one failure never blocks others

---

## Integration Points
- `PrismaService` — `api/src/core/database/prisma.service.ts`
- `NotificationsService` — `api/src/modules/communication/services/notifications.service.ts`
- `@nestjs/bullmq` + `bullmq` — BullMQ queue for background job processing
- `@nestjs/schedule` — Cron scheduling for job triggers
- Redis — BullMQ connection for job queue persistence

---

## Files Created in This Sprint

| File | Purpose |
|---|---|
| `api/src/modules/time-clock/schedulers/time-clock.scheduler.ts` | Cron job producer (missed shift + shift reminder) |
| `api/src/modules/time-clock/processors/time-clock.processor.ts` | BullMQ job consumer (routes by job name) |
| `api/src/modules/time-clock/services/missed-shift.service.ts` | Missed shift detection logic (BR-010) |
| `api/src/modules/time-clock/services/shift-reminder.service.ts` | Shift reminder notification logic |

---

## Acceptance Criteria
- [ ] TimeClockScheduler registers cron jobs (every 15 min for missed-shift-check, every 1 min for shift-reminder)
- [ ] TimeClockProcessor routes jobs by name to correct service
- [ ] MissedShiftService detects missed shifts per tenant, updates status to `'missed'`
- [ ] MissedShiftService notifies admins AND employee for each missed shift
- [ ] MissedShiftService matches sessions by `work_shift_id` OR by `clock_in_at` within +/-2h of `scheduled_start`
- [ ] ShiftReminderService sends reminders for upcoming shifts within configured window
- [ ] ShiftReminderService only processes published shifts (`published_at IS NOT NULL`)
- [ ] ShiftReminderService sets `reminder_sent_at` BEFORE sending notification (no double-send)
- [ ] Background jobs: one tenant failure does NOT stop processing of other tenants
- [ ] BullMQ queue `'time-clock'` registered in module with Redis connection
- [ ] All new providers registered in `time-clock.module.ts`
- [ ] `npm run lint` passes
- [ ] No frontend code modified
- [ ] Dev server shut down before sprint is marked complete

---

## Handoff Notes
- `MissedShiftService` depends on `work_shift` records from Sprint 7
- `ShiftReminderService` depends on `work_shift` records and `time_clock_settings.shift_reminder_minutes` from Sprint 7/Sprint 1
- The `timeclock_missed_shift` and `timeclock_shift_reminder` notification types should be added to any notification type enum or constants file if one exists
- Both services use `user.id` (not `user_id` on employee_profile) for notification recipient — verify the `createNotification()` signature expects `user_id`
- The MissedShiftService uses a +/-2 hour window for fuzzy matching — this accounts for employees who clock in early or the shift-session link not being explicitly set
