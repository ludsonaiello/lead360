# Sprint 05 — Project Templates Schema + API + Tests + Docs

## Sprint Goal
Deliver the project template system: `project_template` and `project_template_task` entities with full CRUD, enabling tenants to define reusable task lists that can be applied to projects later.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 02 must be complete (reason: ProjectsModule exists and is registered in AppModule)

## Codebase Reference
- Module path: `api/src/modules/projects/`
- Prisma schema: `api/prisma/schema.prisma`
- TenantId: `import { TenantId } from '../../auth/decorators/tenant-id.decorator';`
- AuditModule: `import { AuditModule } from '../audit/audit.module';`

## Tasks

### Task 5.1 — Add project_template and project_template_task to Prisma schema
**Type**: Schema
**Complexity**: Medium
**Description**: Add both models with enums and relations.

**Field Table — project_template**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | FK → tenant |
| name | String @db.VarChar(200) | no | — | |
| description | String? @db.Text | yes | null | |
| industry_type | String? @db.VarChar(100) | yes | null | e.g. Roofing, Painting, Remodeling |
| is_active | Boolean | no | true | @default(true) |
| created_by_user_id | String @db.VarChar(36) | no | — | FK → user |
| created_at | DateTime | no | @default(now()) | Auto |
| updated_at | DateTime | no | @updatedAt | Auto |

**Indexes**: @@index([tenant_id, is_active]), @@index([tenant_id, industry_type])
**Map**: @@map("project_template")

**Enum to create**:
```
enum project_task_category {
  labor
  material
  subcontractor
  equipment
  other
}
```

**Field Table — project_template_task**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| template_id | String @db.VarChar(36) | no | — | FK → project_template |
| tenant_id | String @db.VarChar(36) | no | — | Tenant isolation |
| title | String @db.VarChar(200) | no | — | |
| description | String? @db.Text | yes | null | |
| estimated_duration_days | Int? | yes | null | |
| category | project_task_category? | yes | null | labor, material, subcontractor, equipment, other |
| order_index | Int | no | — | Task sequence in template |
| depends_on_order_index | Int? | yes | null | References order_index of prerequisite task in same template |

**Indexes**: @@index([tenant_id, template_id]), @@index([template_id, order_index])
**Map**: @@map("project_template_task")

**Relations**:
- project_template → tenant (Cascade), created_by_user (Restrict), tasks (one-to-many to project_template_task)
- project_template_task → template (Cascade), tenant (Cascade)
- Add reverse relations to tenant and user models

**Expected Outcome**: Both models exist in schema with all fields and relations.

**Acceptance Criteria**:
- [ ] project_template model added with all 9 fields
- [ ] project_template_task model added with all 9 fields
- [ ] project_task_category enum created
- [ ] All indexes and relations defined

**Files Expected**:
- api/prisma/schema.prisma (modified)

**Blocker**: NONE

---

### Task 5.2 — Run Prisma migration
**Type**: Migration
**Complexity**: Low
**Description**: Generate and apply migration.

```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name add_project_templates
npx prisma generate
```

**Expected Outcome**: Tables created, Prisma Client regenerated.

**Acceptance Criteria**:
- [ ] Migration applied successfully
- [ ] Both tables exist in database

**Files Expected**:
- api/prisma/migrations/[timestamp]_add_project_templates/migration.sql (created)

**Blocker**: Task 5.1

---

### Task 5.3 — Create DTOs
**Type**: DTO
**Complexity**: Low
**Description**: Create template DTOs.

**CreateProjectTemplateDto**:
- name: string (required, max 200)
- description: string (optional)
- industry_type: string (optional, max 100)
- tasks: CreateTemplateTaskDto[] (optional array — allows creating template with tasks in one call)

**CreateTemplateTaskDto** (nested):
- title: string (required, max 200)
- description: string (optional)
- estimated_duration_days: number (optional, integer, > 0)
- category: enum (optional: labor, material, subcontractor, equipment, other)
- order_index: number (required, integer, >= 0)
- depends_on_order_index: number (optional, integer, >= 0)

**UpdateProjectTemplateDto**: PartialType of CreateProjectTemplateDto + is_active: boolean (optional)

**Response shape**:
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "name": "Standard Roofing Project",
  "description": "Complete roof replacement template",
  "industry_type": "Roofing",
  "is_active": true,
  "tasks": [
    {
      "id": "uuid",
      "title": "Remove existing shingles",
      "description": "Strip old roofing material",
      "estimated_duration_days": 2,
      "category": "labor",
      "order_index": 0,
      "depends_on_order_index": null
    },
    {
      "id": "uuid",
      "title": "Install underlayment",
      "description": null,
      "estimated_duration_days": 1,
      "category": "material",
      "order_index": 1,
      "depends_on_order_index": 0
    }
  ],
  "created_by_user_id": "uuid",
  "created_at": "2026-01-15T10:30:00.000Z",
  "updated_at": "2026-01-15T10:30:00.000Z"
}
```

**List response**: Standard pagination with template objects (tasks included).

**Expected Outcome**: All DTO files created.

**Acceptance Criteria**:
- [ ] CreateProjectTemplateDto with nested tasks array
- [ ] Validation on all required fields

**Files Expected**:
- api/src/modules/projects/dto/create-project-template.dto.ts (created)
- api/src/modules/projects/dto/update-project-template.dto.ts (created)

**Blocker**: NONE

---

### Task 5.4 — Create ProjectTemplateService
**Type**: Service
**Complexity**: Medium
**Description**: Create `api/src/modules/projects/services/project-template.service.ts`.

**Methods**:
1. **create(tenantId, userId, dto)** — Create template. If dto.tasks provided, create template_task records in same transaction. Validate depends_on_order_index references valid order_index within the same template. Audit log.
2. **findAll(tenantId, query: { page?, limit?, is_active?, industry_type? })** — Paginated. Include tasks ordered by order_index.
3. **findOne(tenantId, id)** — Include tasks ordered by order_index.
4. **update(tenantId, id, userId, dto)** — Update template fields. If dto.tasks provided, replace all tasks (delete existing, insert new — within transaction). Audit log.
5. **delete(tenantId, id, userId)** — Hard delete template and cascade tasks. Audit log. (Templates can be hard deleted since they are not linked to active projects — active checklists copy data, not reference.)

**Business Rules**:
- All queries include where: { tenant_id }
- depends_on_order_index must reference an existing order_index within the same template
- Tasks are always returned ordered by order_index ASC
- Template deletion cascades to template tasks

**Expected Outcome**: Service fully operational.

**Acceptance Criteria**:
- [ ] All 5 methods implemented
- [ ] All queries include where: { tenant_id }
- [ ] depends_on_order_index validated
- [ ] Tasks ordered by order_index

**Files Expected**:
- api/src/modules/projects/services/project-template.service.ts (created)

**Blocker**: Task 5.3

---

### Task 5.5 — Create ProjectTemplateController
**Type**: Controller
**Complexity**: Low
**Description**: Create controller with @Controller('api/v1/project-templates').

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | /project-templates | Owner, Admin | Create template (with optional tasks) |
| GET | /project-templates | Owner, Admin, Manager | List templates |
| GET | /project-templates/:id | Owner, Admin, Manager | Get template detail |
| PATCH | /project-templates/:id | Owner, Admin | Update template |
| DELETE | /project-templates/:id | Owner, Admin | Delete template |

**Expected Outcome**: All 5 endpoints operational.

**Acceptance Criteria**:
- [ ] All endpoints created with correct roles
- [ ] TenantId extracted on every endpoint

**Files Expected**:
- api/src/modules/projects/controllers/project-template.controller.ts (created)

**Blocker**: Task 5.4

---

### Task 5.6 — Register in ProjectsModule + Tests + Documentation
**Type**: Module + Test + Documentation
**Complexity**: Medium
**Description**:
1. Add ProjectTemplateService and ProjectTemplateController to ProjectsModule. Export ProjectTemplateService.
2. Write unit tests at `api/src/modules/projects/services/project-template.service.spec.ts` — test create with tasks, depends_on validation, findAll pagination, update replaces tasks, delete cascades.
3. Write integration tests at `api/test/project-template.e2e-spec.ts`.
4. Write REST API docs at `api/documentation/project_template_REST_API.md`.

**Expected Outcome**: Template system fully tested and documented.

**Acceptance Criteria**:
- [ ] Module updated
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] API docs complete

**Files Expected**:
- api/src/modules/projects/projects.module.ts (modified)
- api/src/modules/projects/services/project-template.service.spec.ts (created)
- api/test/project-template.e2e-spec.ts (created)
- api/documentation/project_template_REST_API.md (created)

**Blocker**: Task 5.5

---

## Sprint Acceptance Criteria
- [ ] Project template CRUD operational
- [ ] Template tasks created with dependency references
- [ ] All queries include where: { tenant_id }
- [ ] Tests passing, documentation complete
- [ ] Templates ready for Sprint 10 (apply template to project)

## Gate Marker
NONE

## Handoff Notes
- Template CRUD at `/api/v1/project-templates`
- ProjectTemplateService exported for use in project creation (Sprint 08/10)
- project_task_category enum will be reused by project_task entity (Sprint 12)
- depends_on_order_index resolves to real task_dependency records when template is applied to a project (Sprint 10)
