# Sprint 12 — Project Task Full Schema + Migration

## Sprint Goal
Finalize the `project_task` model with all fields per contract (status enum, assignee fields, date fields, is_delayed computation, dependency fields, soft delete) and create the `task_assignee` junction table.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 10 must be complete (reason: project_task model exists with minimal fields — this sprint adds all remaining fields)

## Codebase Reference
- Prisma schema: `api/prisma/schema.prisma`
- Existing project_task model from Sprint 10 (minimal fields)
- project_task_category enum from Sprint 05

## Tasks

### Task 12.1 — Finalize project_task model + Add task_assignee model
**Type**: Schema
**Complexity**: High
**Description**: Update the existing project_task model to include ALL fields. Create the task_assignee model. Create necessary enums.

**Enums to create**:

> **Note**: `project_task_status` enum already exists from Sprint 10. Sprint 12 does NOT need to create or convert this enum. Sprint 12 only adds the `task_assignee` and `task_dependency` models. The status field is already an enum — no conversion needed.

```
// project_task_status — ALREADY EXISTS from Sprint 10. Do not redefine.

enum task_assignee_type {
  crew_member
  subcontractor
  user
}

enum task_dependency_type {
  finish_to_start
  start_to_start
  finish_to_finish
}
```

**Updated project_task full field table**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | FK → tenant |
| project_id | String @db.VarChar(36) | no | — | FK → project |
| quote_item_id | String? @db.VarChar(36) | yes | null | FK → quote_item |
| title | String @db.VarChar(200) | no | — | |
| description | String? @db.Text | yes | null | |
| status | project_task_status | no | not_started | @default(not_started) |
| estimated_duration_days | Int? | yes | null | |
| estimated_start_date | DateTime? @db.Date | yes | null | |
| estimated_end_date | DateTime? @db.Date | yes | null | |
| actual_start_date | DateTime? @db.Date | yes | null | |
| actual_end_date | DateTime? @db.Date | yes | null | |
| is_delayed | Boolean | no | false | @default(false). Computed on read. |
| order_index | Int | no | — | Manual ordering |
| category | project_task_category? | yes | null | Reuse enum |
| notes | String? @db.Text | yes | null | |
| created_by_user_id | String @db.VarChar(36) | no | — | |
| deleted_at | DateTime? | yes | null | Soft delete |
| created_at | DateTime | no | @default(now()) | |
| updated_at | DateTime | no | @updatedAt | |

**Indexes**: @@index([tenant_id, project_id]), @@index([tenant_id, project_id, status]), @@index([tenant_id, project_id, order_index]), @@index([tenant_id, is_delayed]) — required for delayed task dashboard queries
**Map**: @@map("project_task")

**Update task_dependency model** (from Sprint 10) to use the enum:
- Change dependency_type from String to task_dependency_type enum

**Field Table — task_assignee**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | |
| task_id | String @db.VarChar(36) | no | — | FK → project_task |
| assignee_type | task_assignee_type | no | — | crew_member, subcontractor, user |
| crew_member_id | String? @db.VarChar(36) | yes | null | FK → crew_member |
| subcontractor_id | String? @db.VarChar(36) | yes | null | FK → subcontractor |
| user_id | String? @db.VarChar(36) | yes | null | FK → user |
| assigned_at | DateTime | no | @default(now()) | |
| assigned_by_user_id | String @db.VarChar(36) | no | — | |

**Indexes**: @@index([tenant_id, task_id]), @@index([tenant_id, crew_member_id]), @@index([tenant_id, subcontractor_id])
**Map**: @@map("task_assignee")

**Acceptance Criteria**:
- [ ] project_task model updated with all 20 fields
- [ ] task_assignee model created with all 9 fields
- [ ] All enums created
- [ ] task_dependency updated to use enum

**Files Expected**: api/prisma/schema.prisma (modified)
**Blocker**: NONE

---

### Task 12.2 — Run migration
**Acceptance Criteria**: Migration applied, all tables/columns exist
**Blocker**: Task 12.1

---

## Sprint Acceptance Criteria
- [ ] project_task model complete with all fields
- [ ] task_assignee model exists
- [ ] All enums created (project_task_status, task_assignee_type, task_dependency_type)
- [ ] Migration clean

## Gate Marker
NONE

## Handoff Notes
- project_task now has full field set for Sprint 13 service/controller
- task_assignee ready for Sprint 15 assignment logic
- task_dependency uses typed enum for Sprint 14 dependency logic
- is_delayed computed on read in service layer (Sprint 13/16)
