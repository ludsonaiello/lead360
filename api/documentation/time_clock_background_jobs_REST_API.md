# Time Clock Background Jobs

**Module:** `time-clock`
**Sprint:** 14 — Background Jobs (Missed Shift Detector + Shift Reminder)
**Type:** Internal background workers (no HTTP endpoints)
**Queue:** BullMQ — `time-clock`
**Scheduler:** `@nestjs/schedule` cron triggers

> This sprint adds **no public HTTP endpoints**. It registers two cron-triggered
> BullMQ jobs that run inside the API process. Frontend agents do not need to
> integrate with these jobs directly — they consume the resulting in-app
> notifications via the existing `/api/v1/notifications` endpoints.

---

## Overview

| Job | Cron | Purpose | Service | Retries | Backoff |
|---|---|---|---|---|---|
| `missed-shift-check` | `*/15 * * * *` | Detect scheduled shifts past threshold without a clock-in (BR-010). Mark as `missed`, notify admins + employee. | `MissedShiftService` | 3 | exponential, 10s base |
| `shift-reminder` | `* * * * *` | Send upcoming-shift in-app reminders to employees. | `ShiftReminderService` | 2 | exponential, 5s base |

Both jobs are **per-tenant** with **error isolation** — a failure processing
one tenant never blocks subsequent tenants in the same job run.

---

## Architecture

```
@Cron (TimeClockScheduler)
        │  enqueue empty payload
        ▼
BullMQ queue: "time-clock"  ◀── connection: Redis (REDIS_HOST/PORT/PASSWORD)
        │
        ▼
TimeClockProcessor (WorkerHost)
        │  routes by job.name
        ├─► MissedShiftService.detectMissedShifts()
        └─► ShiftReminderService.sendReminders()
```

**Files added in this sprint:**

| File | Purpose |
|---|---|
| `src/modules/time-clock/schedulers/time-clock.scheduler.ts` | Cron job producer |
| `src/modules/time-clock/processors/time-clock.processor.ts` | BullMQ job consumer (job-name router) |
| `src/modules/time-clock/services/missed-shift.service.ts` | Missed shift detection + notification (BR-010) |
| `src/modules/time-clock/services/shift-reminder.service.ts` | Shift reminder notification |

All four classes are registered as providers in
`src/modules/time-clock/time-clock.module.ts`. The BullMQ queue
`time-clock` is registered there via `BullModule.registerQueue`. Root
configuration (`BullModule.forRootAsync`, `ScheduleModule.forRoot`) lives in
`AppModule` and was already present prior to this sprint — no changes were
required there.

---

## Job 1 — `missed-shift-check`

### Trigger
- Cron: `*/15 * * * *` (every 15 minutes, server time)
- Producer: `TimeClockScheduler.missedShiftCheck()`
- Job options: `attempts: 3`, `backoff: { type: 'exponential', delay: 10000 }`,
  `removeOnComplete: { count: 100 }`, `removeOnFail: { count: 500 }`
- Payload: `{}` (the processor fetches fresh state from the DB)

### Algorithm

For every active, non-deleted tenant (`tenant.is_active = true AND tenant.deleted_at IS NULL`):

1. **Read tenant settings.** Look up `time_clock_settings.missed_shift_threshold_minutes`. If absent or `0`/falsy, skip the tenant.
2. **Compute threshold.** `thresholdTime = now − missed_shift_threshold_minutes`.
3. **Find candidate shifts.**
   ```sql
   SELECT * FROM work_shift
   WHERE tenant_id = :tenantId
     AND status = 'scheduled'
     AND scheduled_start < :thresholdTime
   ```
   Each row is loaded with its `employee_profile` and that profile's `user`
   (id, first_name, last_name).
4. **For each candidate, attempt to match a clock_session.**
   ```sql
   SELECT id FROM clock_session
   WHERE tenant_id = :tenantId
     AND employee_profile_id = :shift.employee_profile_id
     AND (
       work_shift_id = :shift.id
       OR clock_in_at BETWEEN :scheduled_start − 2h AND :scheduled_start + 2h
     )
   LIMIT 1
   ```
   The ±2h window absorbs early clock-ins or sessions where the explicit
   `work_shift_id` link was never set.
5. **If no session was found:**
   - `UPDATE work_shift SET status = 'missed' WHERE id = :shift.id`
   - Notify all Owners + Admins of the tenant (`timeclock_missed_shift`)
   - Notify the assigned employee (`timeclock_missed_shift`)

### Tenant Isolation

Each tenant is processed inside its own try/catch. Any error is logged at
`error` level with stack trace and the loop continues to the next tenant.

### Notifications Emitted

| Recipient | Title | Message Template | `action_url` |
|---|---|---|---|
| Owners + Admins | `Missed Shift` | `{firstName} {lastName} has not clocked in — shift started {N} minute(s) ago` | `/workforce/timesheets` |
| Assigned employee | `Missed Shift` | `You were marked as missed for your shift on {Month D, YYYY} at {hh:mm AM/PM}` | `/workforce/my-shifts` |

Both notifications carry:
- `type`: `timeclock_missed_shift`
- `related_entity_type`: `work_shift`
- `related_entity_id`: the shift `id`

The Owner / Admin set is resolved via:
```ts
prisma.user.findMany({
  where: {
    is_active: true,
    deleted_at: null,
    memberships: { some: { tenant_id, status: 'ACTIVE' } },
    user_role_user_role_user_idTouser: {
      some: { tenant_id, role: { name: { in: ['Owner', 'Admin'] } } },
    },
  },
});
```

This matches the same pattern used in
`src/modules/projects/processors/insurance-expiry-check.processor.ts`.

---

## Job 2 — `shift-reminder`

### Trigger
- Cron: `* * * * *` (every minute, server time)
- Producer: `TimeClockScheduler.shiftReminder()`
- Job options: `attempts: 2`, `backoff: { type: 'exponential', delay: 5000 }`,
  `removeOnComplete: { count: 100 }`, `removeOnFail: { count: 500 }`
- Payload: `{}`

### Algorithm

For every active, non-deleted tenant:

1. **Read tenant settings.** Look up `time_clock_settings.shift_reminder_minutes`. If absent or `0`/falsy, skip the tenant.
2. **Compute reminder window.** `[now, now + shift_reminder_minutes]`.
3. **Find candidate shifts.**
   ```sql
   SELECT * FROM work_shift
   WHERE tenant_id = :tenantId
     AND status = 'scheduled'
     AND scheduled_start BETWEEN :now AND :reminderWindowEnd
     AND reminder_sent_at IS NULL
     AND published_at IS NOT NULL
   ```
   Loaded with `employee_profile.user (id, first_name, last_name)` and
   `project.name`.
4. **For each candidate (atomic at-most-once dispatch):**
   ```sql
   UPDATE work_shift
   SET reminder_sent_at = NOW()
   WHERE id = :shift.id
     AND tenant_id = :tenantId
     AND reminder_sent_at IS NULL
   ```
   - If `affectedRows = 0`, another worker (or a previous retry) already
     stamped the row — skip it.
   - If `affectedRows = 1`, dispatch the in-app notification to the assigned
     employee.

### Why stamp before send?

`reminder_sent_at` is written **before** the notification is dispatched.
If the notification call (or the entire job) fails afterward, the BullMQ retry
will re-query and the shift will already be excluded by the
`reminder_sent_at IS NULL` filter, so it will not be reminded twice.

> By design, a missed reminder is preferred over a duplicate notification.

### Notifications Emitted

| Recipient | Title | Message Template | `action_url` |
|---|---|---|---|
| Assigned employee | `Upcoming Shift` | `Your shift starts in {N} minute(s) — {projectName}` | `/workforce/my-shifts` |

`projectName` falls back to `Unassigned` when `work_shift.project_id IS NULL`.

The notification carries:
- `type`: `timeclock_shift_reminder`
- `related_entity_type`: `work_shift`
- `related_entity_id`: the shift `id`

---

## Configuration

### Tenant settings (`time_clock_settings`)

| Column | Type | Default | Effect |
|---|---|---|---|
| `missed_shift_threshold_minutes` | `Int` | `30` | Minutes past `scheduled_start` after which an unattended shift becomes `missed`. Set `0` to disable for the tenant. |
| `shift_reminder_minutes` | `Int` | `30` | Lead-time window for shift reminders. Set `0` to disable for the tenant. |

### Environment (`.env`)

| Variable | Used by | Purpose |
|---|---|---|
| `REDIS_HOST` | `BullModule.forRootAsync` (AppModule) | BullMQ Redis host |
| `REDIS_PORT` | `BullModule.forRootAsync` (AppModule) | BullMQ Redis port |
| `REDIS_PASSWORD` | `BullModule.forRootAsync` (AppModule) | BullMQ Redis password |

No new environment variables were introduced by this sprint.

### Schema

No Prisma schema changes were required. All referenced columns
(`work_shift.status`, `work_shift.reminder_sent_at`, `work_shift.published_at`,
`time_clock_settings.missed_shift_threshold_minutes`,
`time_clock_settings.shift_reminder_minutes`) already exist from prior sprints.

---

## Notification Type Reference

| `notification.type` | Trigger | Recipients | Title |
|---|---|---|---|
| `timeclock_missed_shift` | `missed-shift-check` job marks a shift as `missed` | Tenant Owners + Admins **and** assigned employee | `Missed Shift` |
| `timeclock_shift_reminder` | `shift-reminder` job dispatches an upcoming-shift reminder | Assigned employee only | `Upcoming Shift` |

Both types are stored in the existing `notification` table via
`NotificationsService.createNotification()` and consumed by the existing
`/api/v1/notifications` endpoints. No changes are needed in the notifications
read API.

---

## Operational Notes

- **At-least-once vs at-most-once:** the `missed-shift-check` job is
  idempotent because `work_shift.status = 'scheduled'` is the entry filter —
  re-running the job will not re-mark a shift that was already moved to
  `missed`. The `shift-reminder` job uses a stamp-before-send strategy on
  `reminder_sent_at` to enforce at-most-once semantics under retry.
- **Empty job payload:** both jobs are enqueued with `{}`. The processor reads
  fresh state from the DB on every execution. There is no payload schema to
  document.
- **Retention:** completed jobs are kept for the last 100, failed jobs for the
  last 500 (set via `removeOnComplete` / `removeOnFail`).
- **Tenant scaling:** loops are sequential `for...of` to keep DB connection
  pressure predictable; if the tenant count grows large enough that this
  becomes a bottleneck, the loops can be parallelized with bounded
  concurrency without changing the public contract.

---

## Verification

- **Build:** `npm run build` — clean, zero TypeScript errors.
- **Lint:** `npx eslint` (this sprint's files only) — clean.
- **Unit tests:** `npx jest modules/time-clock/services/missed-shift.service modules/time-clock/services/shift-reminder.service`
  - 16 tests passing.
  - Coverage: `missed-shift.service.ts` 92.45% statements / 100% functions;
    `shift-reminder.service.ts` 94.73% statements / 100% functions.
- **Health check:** `GET /api/v1/health` returns 200 with all four new
  providers wired into `TimeClockModule`.
