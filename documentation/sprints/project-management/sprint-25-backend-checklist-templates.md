# Sprint 25 — Completion Checklist Templates

## Sprint Goal
Deliver `completion_checklist_template` and `completion_checklist_template_item` entities with tenant-defined templates for project completion checklists, managed via Settings API.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 08 must be complete (reason: project entity exists — checklists reference projects)

## Codebase Reference
- Module path: `api/src/modules/projects/`

## Tasks

### Task 25.1 — Schema + Migration
**Type**: Schema + Migration
**Complexity**: Medium

**Field Table — completion_checklist_template**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | FK → tenant |
| name | String @db.VarChar(200) | no | — | |
| description | String? @db.Text | yes | null | |
| is_active | Boolean | no | true | @default(true) |
| created_by_user_id | String @db.VarChar(36) | no | — | FK → user |
| created_at | DateTime | no | @default(now()) | |

**Indexes**: @@index([tenant_id, is_active])
**Unique constraint**: `@@unique([tenant_id, name])` — prevent duplicate template names per tenant. Business rule: If a template with the same name already exists for this tenant, throw `ConflictException('A checklist template with this name already exists')`.
**Map**: @@map("completion_checklist_template")

**Relations** (with `@relation` decorators):
- tenant: `tenant @relation(fields: [tenant_id], references: [id], onDelete: Cascade)`
- created_by: `user @relation(fields: [created_by_user_id], references: [id], onDelete: SetNull)`

**Reverse relation**: template model must receive `items completion_checklist_template_item[]`

**Field Table — completion_checklist_template_item**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| template_id | String @db.VarChar(36) | no | — | FK → completion_checklist_template |
| tenant_id | String @db.VarChar(36) | no | — | Tenant isolation |
| title | String @db.VarChar(300) | no | — | |
| description | String? @db.Text | yes | null | |
| is_required | Boolean | no | true | @default(true) |
| order_index | Int | no | — | |
| created_at | DateTime | no | @default(now()) | Auto |
| updated_at | DateTime | no | @updatedAt | Auto |

**Indexes**: @@index([tenant_id, template_id])
**Map**: @@map("completion_checklist_template_item")

**Relations** (with `@relation` decorators):
- template: `completion_checklist_template @relation(fields: [template_id], references: [id], onDelete: Cascade)`
- tenant: `tenant @relation(fields: [tenant_id], references: [id], onDelete: Cascade)`

**Acceptance Criteria**: Both models added, migration applied
**Blocker**: NONE

---

### Task 25.2 — Service + Controller + Tests + Docs
**Type**: Service + Controller + Test + Documentation
**Complexity**: Medium

**ChecklistTemplateService methods**:
1. **create(tenantId, userId, dto: { name, description?, items: { title, description?, is_required?, order_index }[] })** — Create template with items in transaction.
2. **findAll(tenantId, query: { is_active?, page?, limit? })** — Paginated, include items ordered by order_index.
3. **findOne(tenantId, id)** — Include items.
4. **update(tenantId, id, userId, dto)** — Update template. If items provided, replace all items (transaction).
5. **delete(tenantId, id, userId)** — Hard delete template and cascade items.

**Controller** — `@Controller('api/v1/settings/checklist-templates')`:

> **Note**: Controller decorator must be: `@Controller('api/v1/settings/checklist-templates')`. All endpoints are under this path. Ensure the `api/v1/` prefix is included.
| Method | Path | Roles |
|--------|------|-------|
| POST | /settings/checklist-templates | Owner, Admin |
| GET | /settings/checklist-templates | Owner, Admin, Manager |
| GET | /settings/checklist-templates/:id | Owner, Admin, Manager |
| PATCH | /settings/checklist-templates/:id | Owner, Admin |
| DELETE | /settings/checklist-templates/:id | Owner, Admin |

**Template response**:
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "name": "Standard Roofing Completion",
  "description": "Checklist for residential roofing projects",
  "is_active": true,
  "items": [
    { "id": "uuid", "title": "Final inspection passed", "description": null, "is_required": true, "order_index": 0 },
    { "id": "uuid", "title": "Customer walkthrough completed", "description": "Walk customer through all work", "is_required": true, "order_index": 1 },
    { "id": "uuid", "title": "Debris cleanup", "description": null, "is_required": true, "order_index": 2 },
    { "id": "uuid", "title": "Warranty documentation provided", "description": null, "is_required": false, "order_index": 3 }
  ],
  "created_by_user_id": "uuid",
  "created_at": "2026-01-15T10:00:00.000Z"
}
```

Unit tests, integration tests, REST docs at `api/documentation/checklist_template_REST_API.md`.

**Acceptance Criteria**:
- [ ] Template CRUD with nested items
- [ ] Items replaced on update
- [ ] Tests and docs complete

**Blocker**: Task 25.1

---

## Sprint Acceptance Criteria
- [ ] Checklist templates operational
- [ ] Items ordered by order_index
- [ ] Tests and docs complete

## Gate Marker
NONE

## Handoff Notes
- Templates at /api/v1/settings/checklist-templates
- Used in Sprint 26 for project completion flow
