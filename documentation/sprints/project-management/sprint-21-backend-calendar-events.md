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
- **Calendar Integration Module** (VERIFIED):
  - File: `api/src/modules/calendar-integration/services/google-calendar-sync.service.ts`
  - Import: `import { GoogleCalendarSyncService } from '../../calendar-integration/services/google-calendar-sync.service';`
  - Import: `import { CalendarProviderConnectionService } from '../../calendar-integration/services/calendar-provider-connection.service';`
  - Module import: `import { CalendarIntegrationModule } from '../calendar-integration/calendar-integration.module';`

  **Key method for creating Google Calendar events**:
  ```typescript
  // GoogleCalendarService.createEvent (low-level Google API wrapper):
  async createEvent(
    accessToken: string,
    calendarId: string,
    eventData: {
      summary: string;        // Event title
      location?: string;      // Address
      description?: string;   // Event description
      start: { dateTime: string; timeZone: string };
      end: { dateTime: string; timeZone: string };
    }
  ): Promise<{ eventId: string; htmlLink: string; }>
  ```

  **How to sync task calendar events to Google Calendar**:
  1. Check if tenant has active calendar connection: `CalendarProviderConnectionService.getActiveConnection(tenantId)`
  2. If connection exists and `isActive=true`:
     - Get access token (refresh if expired via `CalendarProviderConnectionService.needsTokenRefresh()`)
     - Call `GoogleCalendarService.createEvent(accessToken, connection.connectedCalendarId, eventData)`
     - Store returned `eventId` as `google_event_id` on task_calendar_event
     - Set `sync_status = 'synced'`
  3. If no connection: set `sync_status = 'local_only'`
  4. If sync fails: set `sync_status = 'failed'`, log error, do NOT block creation

  **For deletion**: Call `GoogleCalendarService.deleteEvent(accessToken, calendarId, eventId)` if `google_event_id` exists

  **`internal_calendar_id`**: This field is reserved for linking to the `appointment` model if the event is also an appointment. For task-level events, this will typically be null. It allows future cross-referencing with the appointment system.
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
| updated_at | DateTime | no | @updatedAt | |

**Indexes**: @@index([tenant_id, task_id]), @@index([tenant_id, project_id]), @@index([tenant_id, sync_status])
**Map**: @@map("task_calendar_event")

**Relations**:
- tenant: `tenant @relation(fields: [tenant_id], references: [id], onDelete: Cascade)`
- task: `project_task @relation(fields: [task_id], references: [id], onDelete: Cascade)`
- project: `project @relation(fields: [project_id], references: [id], onDelete: Cascade)`
- created_by: `user @relation("task_calendar_event_created_by", fields: [created_by_user_id], references: [id], onDelete: Restrict)`
- Add reverse relations to project_task, project, tenant, user models
- Add `updated_at DateTime @updatedAt` to the field table

**Note**: Events are NOT auto-deleted when tasks are soft-deleted (deleted_at set). The task relation uses onDelete: Cascade only for hard deletes.

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
1. **createEvent(tenantId, projectId, taskId, userId, dto: { title, description?, start_datetime, end_datetime })** — Create task_calendar_event record. Then attempt Google Calendar sync:
   - Import `CalendarProviderConnectionService` from `../../calendar-integration/services/calendar-provider-connection.service`
   - Import `GoogleCalendarSyncService` from `../../calendar-integration/services/google-calendar-sync.service`
   - Import `GoogleCalendarService` from `../../calendar-integration/services/google-calendar.service`
   - Call `calendarProviderConnectionService.getActiveConnection(tenantId)` to check if tenant has a connected calendar
   - If connection exists and is active:
     - Get access token from connection (refresh if needed via `googleCalendarService.refreshAccessToken(connection.refresh_token)`)
     - Call `googleCalendarService.createEvent(accessToken, connection.connected_calendar_id, { summary: dto.title, description: dto.description, start: { dateTime: dto.start_datetime, timeZone: 'UTC' }, end: { dateTime: dto.end_datetime, timeZone: 'UTC' } })`
     - If success: set `google_event_id = result.eventId`, `sync_status = 'synced'`
     - If failure: set `sync_status = 'failed'`, log error
   - If no connection: set `sync_status = 'local_only'`
   - Calendar sync is best-effort — failure does NOT block event creation
2. **listTaskEvents(tenantId, taskId)** — All events for a task.
3. **deleteEvent(tenantId, taskId, eventId, userId)** — Delete event record. If google_event_id exists, attempt Google Calendar delete via `googleCalendarService.deleteEvent(accessToken, calendarId, google_event_id)`. Events NOT auto-deleted when task is deleted. Audit log.

**Endpoints**:
| Method | Path | Roles |
|--------|------|-------|
| POST | /projects/:projectId/tasks/:taskId/calendar-events | Owner, Admin, Manager |
| GET | /projects/:projectId/tasks/:taskId/calendar-events | Owner, Admin, Manager |
| DELETE | /projects/:projectId/tasks/:taskId/calendar-events/:eventId | Owner, Admin, Manager |

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
