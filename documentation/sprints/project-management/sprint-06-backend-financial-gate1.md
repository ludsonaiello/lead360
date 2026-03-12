# Sprint 06 — Financial Gate 1: financial_category + financial_entry + Services + API + Tests + Docs

## Sprint Goal
Deliver the foundational financial infrastructure: `financial_category` (with tenant seeding) and `financial_entry` entities, services, API endpoints, project cost summary, and comprehensive tests. This opens Financial Gate 1, unblocking task cost logging.

## Phase
BACKEND

## Module
Financial (Project-Scoped)

## Gate Status
OPENS_FINANCIAL_GATE_1

## Prerequisites
- Sprint 02 must be complete (reason: ProjectsModule registered in AppModule — FinancialModule will be a separate module)

## Codebase Reference
- New module path: `api/src/modules/financial/`
- AuditLoggerService: `import { AuditLoggerService } from '../../audit/services/audit-logger.service';`
- AuditModule: `import { AuditModule } from '../audit/audit.module';`
- TenantId: `import { TenantId } from '../../auth/decorators/tenant-id.decorator';`
- Tenant creation hook: locate in `api/src/modules/tenant/services/tenant.service.ts` — add financial category seeding call
- Existing tenant model in Prisma: schema.prisma line 296

## Tasks

### Task 6.1 — Add financial_category and financial_entry to Prisma schema
**Type**: Schema
**Complexity**: High
**Description**: Create both models with enums. Create the FinancialModule directory structure.

**Enums to create**:
```
enum financial_category_type {
  labor
  material
  subcontractor
  equipment
  other
}

enum financial_entry_type {
  expense
  income
}
```

**Field Table — financial_category**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | FK → tenant |
| name | String @db.VarChar(200) | no | — | e.g. "Labor - General", "Materials - Lumber" |
| type | financial_category_type | no | — | labor, material, subcontractor, equipment, other |
| description | String? @db.Text | yes | null | |
| is_active | Boolean | no | true | @default(true) |
| is_system_default | Boolean | no | false | @default(false). true for seeded. Cannot be deleted. |
| created_by_user_id | String? @db.VarChar(36) | yes | null | null for system-seeded records |
| created_at | DateTime | no | @default(now()) | Auto |
| updated_at | DateTime | no | @updatedAt | Auto |

**Indexes**: @@index([tenant_id, type]), @@index([tenant_id, is_active])
**Map**: @@map("financial_category")

**Field Table — financial_entry**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | FK → tenant |
| project_id | String @db.VarChar(36) | no | — | FK → project (required in Phase 1) |
| task_id | String? @db.VarChar(36) | yes | null | FK → project_task (optional) |
| category_id | String @db.VarChar(36) | no | — | FK → financial_category |
| entry_type | financial_entry_type | no | expense | @default(expense). Phase 1: expense only. |
| amount | Decimal @db.Decimal(12, 2) | no | — | Must be > 0 |
| entry_date | DateTime @db.Date | no | — | Cannot be future date |
| vendor_name | String? @db.VarChar(200) | yes | null | |
| crew_member_id | String? @db.VarChar(36) | yes | null | FK → crew_member |
| subcontractor_id | String? @db.VarChar(36) | yes | null | FK → subcontractor |
| notes | String? @db.Text | yes | null | |
| has_receipt | Boolean | no | false | @default(false). Set true when receipt linked. |
| created_by_user_id | String @db.VarChar(36) | no | — | FK → user |
| updated_by_user_id | String? @db.VarChar(36) | yes | null | Set on updates |
| created_at | DateTime | no | @default(now()) | Auto |
| updated_at | DateTime | no | @updatedAt | Auto |

**Indexes**: @@index([tenant_id, project_id]), @@index([tenant_id, task_id]), @@index([tenant_id, project_id, category_id]), @@index([tenant_id, entry_date]), @@index([tenant_id, crew_member_id]), @@index([tenant_id, subcontractor_id])
**Map**: @@map("financial_entry")

**Relations**:
- financial_category → tenant (Cascade), created_by_user (SetNull), entries (one-to-many)
- financial_entry → tenant (Cascade), category (Restrict), created_by (Restrict), updated_by (SetNull)
- Note: project_id and task_id relations will be added when project and project_task models are created (Sprint 07/12). For now, store as plain String FK fields without @relation.
- crew_member and subcontractor relations: add when those entities exist. For now, plain FK fields.
- Add reverse relations to tenant and user models.

**Expected Outcome**: Both models in schema with all fields.

**Acceptance Criteria**:
- [ ] financial_category model with all 10 fields
- [ ] financial_entry model with all 17 fields
- [ ] Both enums created
- [ ] All indexes defined

**Files Expected**:
- api/prisma/schema.prisma (modified)

**Blocker**: NONE

---

### Task 6.2 — Run Prisma migration
**Type**: Migration
**Complexity**: Low
**Description**: Generate and apply migration.

**Expected Outcome**: Tables created.

**Acceptance Criteria**:
- [ ] Migration applied successfully
- [ ] Both tables exist in database

**Files Expected**:
- api/prisma/migrations/[timestamp]_add_financial_entities/migration.sql (created)

**Blocker**: Task 6.1

---

### Task 6.3 — Create DTOs
**Type**: DTO
**Complexity**: Medium
**Description**: Create financial DTOs.

**CreateFinancialCategoryDto**:
- name: string (required, max 200)
- type: enum (required: labor, material, subcontractor, equipment, other)
- description: string (optional)

**UpdateFinancialCategoryDto**: PartialType — name, description updatable. type NOT updatable (business rule).

**CreateFinancialEntryDto**:
- project_id: string (required, UUID)
- task_id: string (optional, UUID)
- category_id: string (required, UUID)
- amount: number (required, > 0)
- entry_date: string (required, ISO date, not future)
- vendor_name: string (optional, max 200)
- crew_member_id: string (optional, UUID)
- subcontractor_id: string (optional, UUID)
- notes: string (optional)

**UpdateFinancialEntryDto**: PartialType — all fields except project_id updatable.

**Category response**:
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "name": "Labor - General",
  "type": "labor",
  "description": "Default labor category",
  "is_active": true,
  "is_system_default": true,
  "created_by_user_id": null,
  "created_at": "2026-01-15T10:30:00.000Z",
  "updated_at": "2026-01-15T10:30:00.000Z"
}
```

**Entry response**:
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "project_id": "uuid",
  "task_id": null,
  "category_id": "uuid",
  "category": { "id": "uuid", "name": "Materials - Lumber", "type": "material" },
  "entry_type": "expense",
  "amount": 450.00,
  "entry_date": "2026-03-10",
  "vendor_name": "Home Depot",
  "crew_member_id": null,
  "subcontractor_id": null,
  "notes": "2x4 studs for framing",
  "has_receipt": false,
  "created_by_user_id": "uuid",
  "updated_by_user_id": null,
  "created_at": "2026-03-10T14:00:00.000Z",
  "updated_at": "2026-03-10T14:00:00.000Z"
}
```

**Project cost summary response** (GET /projects/:projectId/financial-summary):
```json
{
  "project_id": "uuid",
  "total_actual_cost": 12500.00,
  "cost_by_category": {
    "labor": 5000.00,
    "material": 4500.00,
    "subcontractor": 2000.00,
    "equipment": 800.00,
    "other": 200.00
  },
  "entry_count": 15
}
```

**Expected Outcome**: All DTOs created.

**Acceptance Criteria**:
- [ ] All DTOs with proper validation
- [ ] Category type not updatable
- [ ] Entry amount > 0 validated
- [ ] Entry date not future validated

**Files Expected**:
- api/src/modules/financial/dto/create-financial-category.dto.ts (created)
- api/src/modules/financial/dto/update-financial-category.dto.ts (created)
- api/src/modules/financial/dto/create-financial-entry.dto.ts (created)
- api/src/modules/financial/dto/update-financial-entry.dto.ts (created)

**Blocker**: NONE

---

### Task 6.4 — Create FinancialCategoryService
**Type**: Service
**Complexity**: Medium
**Description**: Create `api/src/modules/financial/services/financial-category.service.ts`.

**Methods**:
1. **findAllForTenant(tenantId)** — Returns all active categories ordered by type then name. WHERE: { tenant_id, is_active: true }.
2. **createCategory(tenantId, userId, dto)** — Create custom category. is_system_default = false. Audit log.
3. **updateCategory(tenantId, categoryId, userId, dto)** — Cannot change type. Audit log with before/after.
4. **deactivateCategory(tenantId, categoryId, userId)** — Set is_active = false. System defaults (is_system_default = true) CANNOT be deactivated — throw BadRequestException. Audit log.
5. **seedDefaultCategories(tenantId)** — Creates the 9 system default categories. Called during tenant creation.

**System Default Categories** (seeded per tenant):
| Name | Type |
|------|------|
| Labor - General | labor |
| Labor - Crew Overtime | labor |
| Materials - General | material |
| Materials - Tools | equipment |
| Materials - Safety Equipment | equipment |
| Subcontractor - General | subcontractor |
| Equipment Rental | equipment |
| Fuel & Transportation | other |
| Miscellaneous | other |

All seeded with is_system_default = true, created_by_user_id = null.

**Business Rules**:
- type cannot be changed after creation
- System default categories cannot be deactivated
- Deactivated categories still appear on existing entries (historical integrity)
- All queries include where: { tenant_id }

**Expected Outcome**: FinancialCategoryService fully operational.

**Acceptance Criteria**:
- [ ] All 5 methods implemented
- [ ] All queries include where: { tenant_id }
- [ ] type immutable after creation
- [ ] System defaults cannot be deactivated
- [ ] Seed method creates 9 default categories

**Files Expected**:
- api/src/modules/financial/services/financial-category.service.ts (created)

**Blocker**: Task 6.3

---

### Task 6.5 — Create FinancialEntryService
**Type**: Service
**Complexity**: High
**Description**: Create `api/src/modules/financial/services/financial-entry.service.ts`.

**Methods**:
1. **createEntry(tenantId, userId, dto)** — Validate: category_id belongs to tenant, amount > 0, entry_date not future. Create entry. Audit log.
2. **getProjectEntries(tenantId, projectId, query: { page?, limit?, category_id?, date_from?, date_to? })** — Paginated. Include category relation. WHERE: { tenant_id, project_id }.
3. **getTaskEntries(tenantId, taskId)** — All entries for a specific task. WHERE: { tenant_id, task_id }.
4. **getEntryById(tenantId, entryId)** — Single entry with category. WHERE: { id, tenant_id }.
5. **updateEntry(tenantId, entryId, userId, dto)** — Audit log with before/after. Set updated_by_user_id.
6. **deleteEntry(tenantId, entryId, userId)** — Hard delete. Audit log.
7. **getProjectCostSummary(tenantId, projectId)** — Aggregate: group by category.type, sum amounts. Returns { total_actual_cost, cost_by_category: { labor, material, subcontractor, equipment, other }, entry_count }.
8. **getTaskCostSummary(tenantId, taskId)** — Returns { total_actual_cost, entry_count }.

**Business Rules**:
- project_id is required in Phase 1
- amount must be > 0
- entry_date cannot be future
- category_id must belong to same tenant
- Editing creates audit log with before/after values
- All queries include where: { tenant_id }

**Expected Outcome**: FinancialEntryService fully operational with cost summary computation.

**Acceptance Criteria**:
- [ ] All 8 methods implemented
- [ ] All queries include where: { tenant_id }
- [ ] category_id validated against tenant
- [ ] Amount and date validation enforced
- [ ] Cost summary groups by category type

**Files Expected**:
- api/src/modules/financial/services/financial-entry.service.ts (created)

**Blocker**: Task 6.4

---

### Task 6.6 — Create Controllers
**Type**: Controller
**Complexity**: Medium
**Description**: Create two controllers.

**FinancialCategoryController** — `@Controller('api/v1/settings/financial-categories')`:
| Method | Path | Roles |
|--------|------|-------|
| POST | /settings/financial-categories | Owner, Admin, Manager |
| GET | /settings/financial-categories | Owner, Admin, Manager, Bookkeeper |
| PATCH | /settings/financial-categories/:id | Owner, Admin |
| DELETE | /settings/financial-categories/:id | Owner, Admin |

**FinancialEntryController** — `@Controller('api/v1/financial')`:
| Method | Path | Roles |
|--------|------|-------|
| POST | /financial/entries | Owner, Admin, Manager, Bookkeeper |
| GET | /financial/entries | Owner, Admin, Manager, Bookkeeper |
| GET | /financial/entries/:id | Owner, Admin, Manager, Bookkeeper |
| PATCH | /financial/entries/:id | Owner, Admin, Manager, Bookkeeper |
| DELETE | /financial/entries/:id | Owner, Admin, Bookkeeper |

**ProjectFinancialSummaryController** — `@Controller('api/v1/projects')`:
| Method | Path | Roles |
|--------|------|-------|
| GET | /projects/:projectId/financial-summary | Owner, Admin, Manager, Bookkeeper |

> **CANONICAL ENDPOINT NOTE**: `GET /projects/:projectId/financial-summary` is the **canonical** financial summary endpoint for projects, owned and implemented by the **FinancialModule**. Other modules (e.g., ProjectsModule in Sprint 08) must NOT duplicate this endpoint. If a project overview endpoint is needed elsewhere, it should defer financial data to this endpoint.

Note: The Bookkeeper role may not yet exist in the roles table. If not, use Owner, Admin, Manager for now and document that Bookkeeper role needs to be added.

**Query params for GET /financial/entries**: page, limit, project_id (required), task_id, category_id, date_from, date_to

**Expected Outcome**: All endpoints operational.

**Acceptance Criteria**:
- [ ] All financial category endpoints working
- [ ] All financial entry endpoints working
- [ ] Project financial summary endpoint working
- [ ] Guards and roles on every endpoint

**Files Expected**:
- api/src/modules/financial/controllers/financial-category.controller.ts (created)
- api/src/modules/financial/controllers/financial-entry.controller.ts (created)

**Blocker**: Task 6.5

---

### Task 6.7 — Create FinancialModule + Tenant Seeding Hook
**Type**: Module
**Complexity**: Medium
**Description**:
1. Create `api/src/modules/financial/financial.module.ts` — imports PrismaModule, AuditModule. Registers controllers and services. Exports FinancialCategoryService, FinancialEntryService.
2. Register FinancialModule in AppModule.
3. Add financial category seeding to tenant creation flow. Locate the existing tenant creation service (`api/src/modules/tenant/services/tenant.service.ts`). After tenant is created, call `financialCategoryService.seedDefaultCategories(tenantId)`. This must run in the same transaction or immediately after tenant creation.

**Expected Outcome**: FinancialModule registered. Default categories seeded on new tenant creation.

**Acceptance Criteria**:
- [ ] FinancialModule created and registered in AppModule
- [ ] Services exported
- [ ] Default categories seeded for existing test tenant
- [ ] New tenant creation seeds 9 default categories

**Files Expected**:
- api/src/modules/financial/financial.module.ts (created)
- api/src/app.module.ts (modified)
- api/src/modules/tenant/services/tenant.service.ts (modified — add seeding call)

**Blocker**: Task 6.6

---

### Task 6.8 — Seed Default Categories for Existing Tenants
**Type**: Migration (data)
**Complexity**: Low
**Description**: Write a one-time seed script or migration that seeds the 9 default financial categories for all existing tenants that don't already have them. This ensures the test tenant (contact@honeydo4you.com) has categories available.

Run as a Prisma seed or standalone script.

**Expected Outcome**: All existing tenants have 9 default financial categories.

**Acceptance Criteria**:
- [ ] Test tenant has all 9 default categories
- [ ] Script is idempotent (safe to run multiple times)

**Files Expected**:
- api/prisma/seed-financial-categories.ts (created) or added to existing seed file

**Blocker**: Task 6.7

---

### Task 6.9 — Unit Tests + Integration Tests + Documentation
**Type**: Test + Documentation
**Complexity**: High
**Description**:
1. Unit tests for FinancialCategoryService at `api/src/modules/financial/services/financial-category.service.spec.ts`
2. Unit tests for FinancialEntryService at `api/src/modules/financial/services/financial-entry.service.spec.ts`
3. Integration tests at `api/test/financial.e2e-spec.ts`
4. REST API docs at `api/documentation/financial_gate1_REST_API.md`

**Unit test cases for FinancialCategoryService**:
- findAllForTenant returns active categories ordered by type then name
- createCategory creates custom category
- updateCategory cannot change type
- deactivateCategory cannot deactivate system defaults
- seedDefaultCategories creates 9 records

**Unit test cases for FinancialEntryService**:
- createEntry validates category belongs to tenant
- createEntry validates amount > 0
- createEntry validates entry_date not future
- getProjectEntries returns paginated with category included
- getProjectCostSummary groups by category type correctly
- updateEntry logs audit with before/after
- deleteEntry creates audit log

**Integration test cases**:
- POST /settings/financial-categories — creates category (201)
- GET /settings/financial-categories — returns list with system defaults
- DELETE /settings/financial-categories/:id — blocks deletion of system default (400)
- POST /financial/entries — creates entry (201)
- GET /financial/entries?project_id=... — returns paginated entries
- GET /projects/:projectId/financial-summary — returns cost summary

**Documentation**: Cover all endpoints with request/response examples.

**Expected Outcome**: All tests pass, documentation complete.

**Acceptance Criteria**:
- [ ] Unit tests >80% coverage for both services
- [ ] Integration tests passing
- [ ] API documentation complete at api/documentation/financial_gate1_REST_API.md

**Files Expected**:
- api/src/modules/financial/services/financial-category.service.spec.ts (created)
- api/src/modules/financial/services/financial-entry.service.spec.ts (created)
- api/test/financial.e2e-spec.ts (created)
- api/documentation/financial_gate1_REST_API.md (created)

**Blocker**: Task 6.7

---

## Sprint Acceptance Criteria
- [ ] financial_category table exists with correct fields
- [ ] financial_entry table exists with correct fields
- [ ] 9 system default categories seeded for all tenants
- [ ] New tenant creation auto-seeds categories
- [ ] Category type immutable after creation
- [ ] System defaults cannot be deactivated
- [ ] Financial entries validated (amount > 0, date not future, category belongs to tenant)
- [ ] Project cost summary returns correct aggregation
- [ ] All queries include where: { tenant_id }
- [ ] Unit tests >80% coverage
- [ ] Integration tests passing
- [ ] REST API documentation complete

## Gate Marker
STOP — FINANCIAL GATE 1 IS NOW OPEN. The following services are exported from FinancialModule and available for import by ProjectsModule:
- FinancialCategoryService.findAllForTenant(tenantId)
- FinancialEntryService.createEntry(tenantId, userId, dto)
- FinancialEntryService.getProjectCostSummary(tenantId, projectId)
- FinancialEntryService.getTaskCostSummary(tenantId, taskId)

Project Module sprints that depend on Gate 1 can now proceed.

## Handoff Notes
- Financial categories at `/api/v1/settings/financial-categories`
- Financial entries at `/api/v1/financial/entries`
- Project cost summary at `/api/v1/projects/:projectId/financial-summary`
- FinancialModule exports: FinancialCategoryService, FinancialEntryService
- 9 system default categories seeded per tenant
- category_id must reference a category belonging to the same tenant
