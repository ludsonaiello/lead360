# Sprint 21 — Calendar Events per Task

## Sprint Goal
Implement task-level calendar event creation and listing with the `task_calendar_event` entity, supporting Google Calendar sync and local-only fallback.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 13 must be complete (reason: ProjectTaskService exists)
- Calendar module must exist (verified: api/src/modules/calendar/ and api/src/modules/calendar-integration/)

## Codebase Reference
- Calendar module: `api/src/modules/calendar/`
- Calendar integration: `api/src/modules/calendar-integration/`
- task_calendar_event model will be new

## Tasks

### Task 21.1 — Add task_calendar_event to Prisma schema
**Type**: Schema
**Complexity**: Medium

**Enum**:
```
enum calendar_sync_status {
  pending
  synced
  failed
  local_only
}
```

**Field Table — task_calendar_event**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | FK → tenant |
| task_id | String @db.VarChar(36) | no | — | FK → project_task |
| project_id | String @db.VarChar(36) | no | — | FK → project |
| title | String @db.VarChar(300) | no | — | |
| description | String? @db.Text | yes | null | |
| start_datetime | DateTime | no | — | |
| end_datetime | DateTime | no | — | |
| google_event_id | String? @db.VarChar(300) | yes | null | Google Calendar event ID |
| internal_calendar_id | String? @db.VarChar(36) | yes | null | FK → internal calendar event |
| sync_status | calendar_sync_status | no | pending | @default(pending) |
| created_by_user_id | String @db.VarChar(36) | no | — | |
| created_at | DateTime | no | @default(now()) | |

**Indexes**: @@index([tenant_id, task_id]), @@index([tenant_id, project_id]), @@index([tenant_id, sync_status])
**Map**: @@map("task_calendar_event")

**Relations** (with `@relation` decorators — all relations must be named to avoid Prisma ambiguity):
- tenant: `tenant @relation("task_calendar_event_tenant", fields: [tenant_id], references: [id], onDelete: Cascade)`
- task: `project_task @relation("task_calendar_event_task", fields: [task_id], references: [id], onDelete: Cascade)`
- project: `project @relation("task_calendar_event_project", fields: [project_id], references: [id], onDelete: Cascade)`
- created_by: `user @relation("task_calendar_event_created_by", fields: [created_by_user_id], references: [id], onDelete: SetNull)`

**Reverse relations to add**:
- `project_task` model: `calendar_events task_calendar_event[]`
- `project` model: `task_calendar_events task_calendar_event[]`

Run migration.

**Acceptance Criteria**:
- [ ] Model added, migration applied

**Files Expected**: api/prisma/schema.prisma (modified), migration file
**Blocker**: NONE

---

### Task 21.2 — TaskCalendarEventService + Controller + Tests + Docs
**Type**: Service + Controller + Test + Documentation
**Complexity**: High

**TaskCalendarEventService methods**:
1. **createEvent(tenantId, projectId, taskId, userId, dto: { title, description?, start_datetime, end_datetime })** — Create task_calendar_event using the VERIFIED CALENDAR INTEGRATION below.

**VERIFIED CALENDAR INTEGRATION:**
Module: `CalendarIntegrationModule`
Path: `api/src/modules/calendar-integration/`
Import in ProjectsModule: add `CalendarIntegrationModule` to `projects.module.ts` imports array.

Services to inject:
- `GoogleCalendarService`: `api/src/modules/calendar-integration/services/google-calendar.service.ts`
- `CalendarProviderConnectionService`: `api/src/modules/calendar-integration/services/calendar-provider-connection.service.ts`

Flow for createEvent():
1. Use `CalendarProviderConnectionService` to check if tenant has active Google Calendar connection.
   If no active connection: skip Google sync, set `sync_status = 'local_only'`. Done.
2. If active connection: get the tenant's access_token and calendarId from the connection.
3. Call `GoogleCalendarService.createEvent(accessToken, calendarId, {
     summary: dto.title,
     description: dto.description || '',
     start: { dateTime: dto.start_datetime.toISOString(), timeZone: 'UTC' },
     end: { dateTime: dto.end_datetime.toISOString(), timeZone: 'UTC' }
   });`
4. On success: set `google_event_id = result.eventId`, `sync_status = 'synced'`.
5. On failure (catch Error): set `sync_status = 'failed'`. DO NOT block the creation.
   Log the error. Queue a retry using the 'calendar-sync' BullMQ queue.

`internal_calendar_id` field: leave null in Phase 1. Reserved for future Lead360-native calendar integration. Do not attempt to populate it.
2. **listTaskEvents(tenantId, taskId)** — All events for a task.
3. **deleteEvent(tenantId, taskId, eventId, userId)** — Delete event record. If google_event_id exists, attempt Google Calendar delete. Events NOT auto-deleted when task is deleted.

**Endpoints**:
| Method | Path | Roles |
|--------|------|-------|
| POST | /projects/:projectId/tasks/:taskId/calendar-events | Owner, Admin, Manager |
| GET | /projects/:projectId/tasks/:taskId/calendar-events | Owner, Admin, Manager |
| DELETE | /projects/:projectId/tasks/:taskId/calendar-events/:eventId | Owner, Admin, Manager |
| PATCH | /projects/:projectId/tasks/:taskId/calendar-events/:eventId | Owner, Admin, Manager |

**PATCH endpoint**: Updates event title, description, start_datetime, end_datetime. If `google_event_id` is set: attempt to update the Google Calendar event via `GoogleCalendarService.updateEvent()`. On failure: log and continue (local update succeeds regardless).

**Event response**:
```json
{
  "id": "uuid",
  "task_id": "uuid",
  "project_id": "uuid",
  "title": "Roof Installation - Day 1",
  "description": "Start roof tear-off",
  "start_datetime": "2026-04-05T08:00:00.000Z",
  "end_datetime": "2026-04-05T17:00:00.000Z",
  "google_event_id": "google-cal-id-or-null",
  "sync_status": "synced",
  "created_by_user_id": "uuid",
  "created_at": "2026-03-15T10:00:00.000Z"
}
```

**Business Rules**:
- Multiple events per task allowed
- Events NOT deleted when task is deleted
- Google Calendar sync is best-effort (failure doesn't block creation)
- All queries include where: { tenant_id }

Unit tests, integration tests, update task REST docs.

**Files Expected**:
- api/src/modules/projects/dto/create-task-calendar-event.dto.ts (created)
- api/src/modules/projects/services/task-calendar-event.service.ts (created)
- api/src/modules/projects/controllers/project-task.controller.ts (modified)
- api/src/modules/projects/services/task-calendar-event.service.spec.ts (created)
- api/documentation/project_task_REST_API.md (modified)

**Blocker**: Task 21.1

---

## Sprint Acceptance Criteria
- [ ] Calendar events created per task
- [ ] Google Calendar sync attempted (graceful failure)
- [ ] Events not auto-deleted with tasks
- [ ] Tests and docs complete

## Gate Marker
NONE

## Handoff Notes
- Calendar events at POST/GET /projects/:projectId/tasks/:taskId/calendar-events
- sync_status tracks Google Calendar integration state
- local_only used when tenant has no calendar connection
