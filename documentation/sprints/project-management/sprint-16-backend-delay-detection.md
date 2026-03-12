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
- **Notification System (VERIFIED — EXISTS in CommunicationModule)**:
  - Queue: `communication-notifications` (BullMQ)
  - To create notifications, inject the BullMQ queue and add a job:
    ```typescript
    @InjectQueue('communication-notifications') private notificationQueue: Queue

    await this.notificationQueue.add('create-notification', {
      event_type: 'task_delayed',
      tenant_id: tenantId,
      data: { task_title: task.title, project_name: project.name, task_id: task.id },
      entity_type: 'project_task',
      entity_id: task.id,
    });
    ```
  - The NotificationProcessor resolves recipients from notification_rule records for `event_type='task_delayed'`
  - Import: `import { BullModule } from '@nestjs/bull';` — register queue `communication-notifications` in ProjectsModule
  - **Notification rule seeding**: After implementing the job, seed a default notification_rule for event_type 'task_delayed' with recipient_type 'owner' and notify_in_app=true for each tenant

## Tasks

### Task 16.1 — Enhance delay detection + optional BullMQ job
**Type**: Service
**Complexity**: Medium

**On-read computation** (already in Sprint 13): is_delayed computed on every task read. This sprint ensures the computed value is also persisted periodically for dashboard queries.

**Add scheduled BullMQ job** (REQUIRED):
- Job name: 'project-task-delay-check'
- Schedule: daily at 6:00 AM UTC
- **Admin UI integration**: This job must be registered as a system job in the admin panel's job management system. The admin UI already has capability to manage scheduled jobs. Add a record to the `system_job` table (if it exists) or register via the existing job scheduling infrastructure in `api/src/modules/admin/jobs/`. Follow the pattern used by `notification-cleanup.job.ts` at `api/src/modules/admin/jobs/notification-cleanup.job.ts`.
- **BullMQ Configuration**:
  - Queue name: `project-tasks` (register in ProjectsModule)
  - Job options: `{ attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true, removeOnFail: false }`
  - Use `@Cron('0 6 * * *')` decorator or BullMQ repeatable job pattern
- Logic: For each active project (status in_progress), query all tasks with estimated_end_date < today AND status != 'done'. Update is_delayed = true. For tasks where is_delayed was false and is now true: create notification for assigned_pm_user_id.
- Use existing notification module if available, or create a simple in-app notification record.

**Notification on delay**:
- Create notification via the `communication-notifications` BullMQ queue (see Codebase Reference above)
- Notification type: 'task_delayed'
- Message format: "Task '{title}' in project '{project_name}' is delayed"
- action_url: `/projects/{project_id}/tasks/{task_id}`
- related_entity_type: 'project_task'
- related_entity_id: task_id

**Business Rules**:
- is_delayed computation is the source of truth (on-read)
- Scheduled job is supplementary for notifications and dashboard
- PM decides cascade — system only flags

**Files Expected**:
- api/src/modules/projects/processors/task-delay-check.processor.ts (created — if BullMQ approach)
- api/src/modules/projects/services/project-task.service.ts (modified — ensure is_delayed update)
- api/prisma/schema.prisma (modified — add @@index([tenant_id, is_delayed]) to project_task for delayed task dashboard queries)
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
