# Sprint 16 — Delay Detection + Notification Hook

## Sprint Goal
Implement delay detection computation and a notification hook that flags delayed tasks to project managers, using on-read computation with optional scheduled recheck.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 13 must be complete (reason: ProjectTaskService with is_delayed computation exists)

## Codebase Reference
- ProjectTaskService: already computes is_delayed on read
- Notification system: check if existing NotificationModule exists in the codebase

## Tasks

### Task 16.1 — Enhance delay detection + optional BullMQ job
**Type**: Service
**Complexity**: Medium

**On-read computation** (already in Sprint 13): is_delayed computed on every task read. This sprint ensures the computed value is also persisted periodically for dashboard queries.

**BULLMQ CONFIGURATION SPECIFICATION (REQUIRED)**:

Queue name: `'project-management'`
Queue registration (in `projects.module.ts`):
  `BullModule.registerQueue({ name: 'project-management' })`

Job registration on module startup (OnModuleInit in ProjectsModule):
  Call `ScheduledJobService.registerScheduledJob({
    job_type: 'project-task-delay-check',
    name: 'Project Task Delay Check',
    description: 'Daily scan for overdue project tasks. Creates notifications for assigned project managers.',
    schedule: '0 6 * * *',
    timezone: 'UTC',
    max_retries: 3,
    timeout_seconds: 300
  });`
  Use upsert pattern: if job_type already registered, skip (idempotent).

Job processor file: `api/src/modules/projects/processors/task-delay-check.processor.ts`
Processor class: `@Processor('project-management')` — uses the shared queue

Job options (add to `.add()` call):
  `{ attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100, removeOnFail: 50 }`

Multi-tenant processing:
  The processor must query ALL active tenants and process each independently.
  If processing fails for one tenant, catch the error, log it, and continue to the next tenant.
  Job failure for one tenant must never stop processing for other tenants.

Logic: For each active project (status in_progress), query all tasks with estimated_end_date < today AND status != 'done'. Update is_delayed = true. For tasks where is_delayed was false and is now true: create notification for assigned_pm_user_id via NotificationsService.

Register in `scheduled_job` table via `ScheduledJobService.registerScheduledJob()` on OnModuleInit. This makes it visible and manageable in the Platform Admin UI at `/admin/jobs/schedules`.

ScheduledJobService import: `api/src/modules/jobs/services/scheduled-job.service.ts`

**NOTIFICATION INTEGRATION (REQUIRED)**:
Import path: `api/src/modules/communication/services/notifications.service.ts`
Import in ProjectsModule: import `CommunicationModule` in `projects.module.ts` imports array.

When a task transitions from `is_delayed=false` to `is_delayed=true`:
Call `NotificationsService.createNotification({
  tenant_id: task.tenant_id,
  user_id: project.assigned_pm_user_id,  // null = broadcast to all if no PM assigned
  type: 'task_delayed',
  title: 'Task Delayed',
  message: \`Task '${task.title}' in project '${project.name}' is past its estimated end date.\`,
  action_url: \`/projects/${project.id}/tasks/${task.id}\`,
  related_entity_type: 'project_task',
  related_entity_id: task.id
});`

If `project.assigned_pm_user_id` is null: set `user_id = null` (broadcast to all tenant users).

**Business Rules**:
- is_delayed computation is the source of truth (on-read)
- Scheduled job is supplementary for notifications and dashboard
- PM decides cascade — system only flags

**Files Expected**:
- api/src/modules/projects/processors/task-delay-check.processor.ts (created — if BullMQ approach)
- api/src/modules/projects/services/project-task.service.ts (modified — ensure is_delayed update)
- api/src/modules/projects/projects.module.ts (modified)
**Blocker**: NONE

---

### Task 16.2 — Dashboard delay counts endpoint
**Type**: Controller
**Complexity**: Low

Add to project controller or create dashboard endpoint:

**GET /api/v1/projects/dashboard/delays** — Returns count of delayed tasks per project for the tenant.

```json
{
  "total_delayed_tasks": 12,
  "projects_with_delays": [
    { "project_id": "uuid", "project_name": "Kitchen Remodel", "delayed_task_count": 3 },
    { "project_id": "uuid", "project_name": "Roof Repair", "delayed_task_count": 2 }
  ]
}
```

Unit tests. Integration tests. Add to project REST docs.

**Files Expected**: controllers and tests as needed
**Blocker**: Task 16.1

---

## Sprint Acceptance Criteria
- [ ] is_delayed computed correctly on every read
- [ ] Delayed tasks flagged for PM notification
- [ ] Dashboard delay counts endpoint working
- [ ] Tests and docs complete

## Gate Marker
NONE

## Handoff Notes
- Delay detection at `/api/v1/projects/dashboard/delays`
- is_delayed is still primarily computed on read
- Scheduled job provides periodic notification triggering
- PM cascade decisions not automated — flagging only
