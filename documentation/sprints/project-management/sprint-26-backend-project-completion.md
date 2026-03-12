# Sprint 26 — Project Completion Checklist + Punch List

## Sprint Goal
Deliver the project completion flow: assign checklist from template, track checklist item completion, manage punch list items, and validate all required items before marking project complete.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 25 must be complete (reason: checklist templates exist)
- Sprint 08 must be complete (reason: ProjectService with status management exists)

## Codebase Reference
- ChecklistTemplateService from Sprint 25
- ProjectService from Sprint 08

## Tasks

### Task 26.1 — Schema + Migration
**Type**: Schema + Migration
**Complexity**: Medium

**Enum**:
```
enum punch_list_status {
  open
  in_progress
  resolved
}
```

**Field Table — project_completion_checklist**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | |
| project_id | String @db.VarChar(36) | no | — | FK → project |
| template_id | String? @db.VarChar(36) | yes | null | FK → checklist_template (null if manual) |
| completed_at | DateTime? | yes | null | Set when all required items done |
| created_by_user_id | String? @db.VarChar(36) | yes | null | FK → user |
| created_at | DateTime | no | @default(now()) | |

**Unique constraint**: `@@unique([tenant_id, project_id])` — one active checklist per project per tenant. Business rule: If a checklist already exists for this project, return HTTP 409. A project can only have one active completion checklist at a time.

**Relations** (with `@relation` decorators):
- tenant: `tenant @relation(fields: [tenant_id], references: [id], onDelete: Cascade)`
- project: `project @relation(fields: [project_id], references: [id], onDelete: Cascade)`
- template: `completion_checklist_template? @relation(fields: [template_id], references: [id], onDelete: SetNull)`
- created_by: `user? @relation(fields: [created_by_user_id], references: [id], onDelete: SetNull)`

**Reverse relations**: Add `items project_completion_checklist_item[]` and `punch_list_items punch_list_item[]` to this model.

**Field Table — project_completion_checklist_item**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | |
| checklist_id | String @db.VarChar(36) | no | — | FK → project_completion_checklist |
| title | String @db.VarChar(300) | no | — | |
| is_required | Boolean | no | — | Copied from template item |
| is_completed | Boolean | no | false | @default(false) |
| completed_at | DateTime? | yes | null | |
| completed_by_user_id | String? @db.VarChar(36) | yes | null | |
| notes | String? @db.Text | yes | null | |
| template_item_id | String? @db.VarChar(36) | yes | null | FK → completion_checklist_template_item (nullable → onDelete: SetNull) |
| order_index | Int | no | — | |
| updated_at | DateTime | no | @updatedAt | Auto |

**Relations** (with `@relation` decorators):
- checklist: `project_completion_checklist @relation(fields: [checklist_id], references: [id], onDelete: Cascade)`
- template_item: `completion_checklist_template_item? @relation(fields: [template_item_id], references: [id], onDelete: SetNull)`
- tenant: `tenant @relation(fields: [tenant_id], references: [id], onDelete: Cascade)`

**Field Table — punch_list_item**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | |
| checklist_id | String @db.VarChar(36) | no | — | FK → project_completion_checklist |
| project_id | String @db.VarChar(36) | no | — | FK → project |
| title | String @db.VarChar(300) | no | — | |
| description | String? @db.Text | yes | null | |
| status | punch_list_status | no | open | @default(open) |
| assigned_to_crew_id | String? @db.VarChar(36) | yes | null | FK → crew_member |
| resolved_at | DateTime? | yes | null | |
| reported_by_user_id | String? @db.VarChar(36) | yes | null | FK → user, onDelete: SetNull |
| resolved_by_user_id | String? @db.VarChar(36) | yes | null | |
| created_at | DateTime | no | @default(now()) | |
| updated_at | DateTime | no | @updatedAt | Auto |

**Relations** (with `@relation` decorators):
- tenant: `tenant @relation(fields: [tenant_id], references: [id], onDelete: Cascade)`
- checklist: `project_completion_checklist @relation(fields: [checklist_id], references: [id], onDelete: Cascade)`
- reported_by: `user? @relation("punch_list_item_reported_by", fields: [reported_by_user_id], references: [id], onDelete: SetNull)`

Run migration.
**Blocker**: NONE

---

### Task 26.2 — ProjectCompletionService + Controller + Tests + Docs
**Type**: Service + Controller + Test + Documentation
**Complexity**: High

**ProjectCompletionService methods**:
1. **startCompletion(tenantId, projectId, userId, dto: { template_id? })** — Create project_completion_checklist. If template_id: copy items from template. PM can add manual items later. One active checklist per project.
2. **completeItem(tenantId, projectId, itemId, userId, dto: { notes? })** — Set is_completed=true, completed_at=now(), completed_by_user_id. Audit log. If all required items complete: set checklist.completed_at.
3. **addManualItem(tenantId, projectId, checklistId, userId, dto: { title, is_required?, order_index })** — Add item not from template.
4. **addPunchListItem(tenantId, projectId, userId, dto: { title, description?, assigned_to_crew_id? })** — Create punch list item with status='open'.
5. **updatePunchListItem(tenantId, projectId, itemId, userId, dto: { status?, assigned_to_crew_id?, description? })** — Update punch list. If status → 'resolved': set resolved_at, resolved_by. Audit log.
6. **completeProject(tenantId, projectId, userId)** — Validate: all required checklist items completed, all punch list items resolved. If valid: update project.status = 'completed', project.actual_completion_date = today. If invalid: return 409 with list of incomplete/unresolved items.

**Controller**:
| Method | Path | Roles |
|--------|------|-------|
| POST | /projects/:projectId/completion | Owner, Admin, Manager |
| PATCH | /projects/:projectId/completion/items/:itemId | Owner, Admin, Manager |
| POST | /projects/:projectId/completion/items | Owner, Admin, Manager |
| POST | /projects/:projectId/completion/punch-list | Owner, Admin, Manager |
| PATCH | /projects/:projectId/completion/punch-list/:itemId | Owner, Admin, Manager |
| POST | /projects/:projectId/complete | Owner, Admin, Manager |

**Completion checklist response**:
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "template_id": "uuid",
  "completed_at": null,
  "items": [
    { "id": "uuid", "title": "Final inspection passed", "is_required": true, "is_completed": true, "completed_at": "2026-06-14T10:00:00Z", "completed_by_user_id": "uuid", "notes": null, "order_index": 0 },
    { "id": "uuid", "title": "Customer walkthrough", "is_required": true, "is_completed": false, "completed_at": null, "completed_by_user_id": null, "notes": null, "order_index": 1 }
  ],
  "punch_list": [
    { "id": "uuid", "title": "Touch up paint on trim", "description": null, "status": "open", "assigned_to_crew": { "id": "uuid", "first_name": "Mike" }, "resolved_at": null }
  ]
}
```

**Business Rules**:
- One active checklist per project
- All required items must be completed before project can be marked complete
- All punch list items must be resolved before completion
- Punch list items are separate from checklist items
- All queries include where: { tenant_id }

Unit tests, integration tests, REST docs at `api/documentation/project_completion_REST_API.md`.

**Blocker**: Task 26.1

---

## Sprint Acceptance Criteria
- [ ] Completion checklist from template
- [ ] Item completion tracking
- [ ] Punch list management
- [ ] Project completion validation
- [ ] Tests and docs complete

## Gate Marker
NONE

## Handoff Notes
- Completion at /api/v1/projects/:projectId/completion
- Complete project at POST /projects/:projectId/complete
- Validates all required items + punch list before allowing completion
