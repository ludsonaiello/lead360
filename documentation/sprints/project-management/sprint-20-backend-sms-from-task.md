# Sprint 20 — SMS from Task Context

## Sprint Goal
Implement SMS sending from task context using the existing CommunicationsModule, ensuring messages appear on both the task activity and lead communication timeline.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 13 must be complete (reason: ProjectTaskService and task endpoints exist)
- CommunicationsModule must exist in the codebase (verified: api/src/modules/communication/)

## Codebase Reference

**VERIFIED SMS INTEGRATION:**
Service class: `SmsSendingService`
Service file: `api/src/modules/communication/services/sms-sending.service.ts`
Import in ProjectsModule: add `CommunicationModule` to `projects.module.ts` imports array.

Exact call:
```
await smsSendingService.sendSms(tenantId, userId, {
  to_phone: resolvedPhone,         // E.164, e.g. '+19781234567'. Optional if lead_id provided.
  text_body: dto.text_body,        // Max 1600 chars. Required.
  lead_id: resolvedLeadId,         // project.lead_id. Null if standalone project.
  related_entity_type: 'project_task',
  related_entity_id: taskId
});
```

**Phone resolution logic:**
1. If `dto.to_phone` is provided: use it directly.
2. If `dto.to_phone` is null: fetch `lead.phones` where `is_primary=true` AND `lead.id = project.lead_id`.
3. If no primary phone found: throw `BadRequestException('No phone number available for this lead')`.
4. If `project.lead_id` is null (standalone project): `to_phone` from dto is required. Throw `BadRequestException('Standalone projects require an explicit to_phone')` if `dto.to_phone` is null.

The CommunicationsModule automatically logs the event in `communication_event` table.
No additional logging needed.

- ProjectTaskService from Sprint 13

## Tasks

### Task 20.1 — Create SendTaskSmsDto + Service method + Controller endpoint
**Type**: DTO + Service + Controller
**Complexity**: Medium

**SendTaskSmsDto**:
- to_phone: string (optional, E.164 format — if not provided, resolve from project's lead)
- text_body: string (required, max 1600)
- lead_id: string (optional, UUID — auto-resolved from project.lead_id if not provided)

**Add method to ProjectTaskService** (or a new TaskCommunicationService):

**sendSmsFromTask(tenantId, projectId, taskId, userId, dto)**:
1. Fetch task and project (validate tenant ownership)
2. Resolve lead_id: dto.lead_id || project.lead_id
3. Resolve to_phone: dto.to_phone || (fetch lead's primary phone)
4. Call smsSendingService.sendSms(tenantId, userId, { to_phone, text_body: dto.text_body, lead_id, related_entity_type: 'project_task', related_entity_id: taskId })
5. The existing CommunicationsModule automatically logs the event in communication_event table
6. Return the SMS response

**Endpoint**:
| Method | Path | Roles |
|--------|------|-------|
| POST | /projects/:projectId/tasks/:taskId/sms | Owner, Admin, Manager |

**Request**:
```json
{
  "to_phone": "+19781234567",
  "text_body": "Hi John, your roof installation starts tomorrow at 8 AM."
}
```

**Response**:
```json
{
  "message": "SMS sent successfully",
  "communication_event_id": "uuid",
  "to_phone": "+19781234567",
  "status": "sent"
}
```

**Business Rules**:
- SMS appears on task activity via related_entity_type/related_entity_id
- SMS appears on lead timeline via lead_id
- to_phone resolved from lead if not explicitly provided
- All queries include where: { tenant_id }

Import CommunicationsModule (or the specific SMS service module) into ProjectsModule.

Unit tests: sendSmsFromTask resolves phone from lead, sendSmsFromTask passes correct metadata, integration test for endpoint. Update task REST API docs.

**Files Expected**:
- api/src/modules/projects/dto/send-task-sms.dto.ts (created)
- api/src/modules/projects/services/project-task.service.ts (modified) or api/src/modules/projects/services/task-communication.service.ts (created)
- api/src/modules/projects/controllers/project-task.controller.ts (modified)
- api/src/modules/projects/projects.module.ts (modified — import CommunicationsModule)
- api/src/modules/projects/services/task-communication.service.spec.ts (created)
- api/documentation/project_task_REST_API.md (modified)

**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] SMS sent from task context
- [ ] Message linked to both task and lead
- [ ] Phone resolved from lead when not provided
- [ ] Tests and docs complete

## Gate Marker
NONE

## Handoff Notes
- SMS from task at POST /projects/:projectId/tasks/:taskId/sms
- Uses existing CommunicationsModule — no new SMS infrastructure
- related_entity_type: 'project_task' ensures task-level linking
