# Sprint 08 — Project Creation + CRUD + Quote Conversion + API + Tests + Docs

## Sprint Goal
Deliver complete project CRUD API including creation from accepted quote (with quote lock, lead status update, portal account generation, optional task seeding), standalone project creation, project number generation, and comprehensive tests.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 07 must be complete (reason: project table must exist)
- Sprint 06 must be complete (reason: FinancialEntryService.getProjectCostSummary needed for summary endpoint)
- Sprint 05 must be complete (reason: ProjectTemplateService needed for optional template application on creation)

## Codebase Reference
- Module path: `api/src/modules/projects/`
- QuoteService/QuoteModule: locate in `api/src/modules/quotes/` — need to import for quote data retrieval and lock
- LeadsService: `api/src/modules/leads/services/leads.service.ts` — for status update to 'customer'
- FinancialEntryService: from FinancialModule (Sprint 06) — for project cost summary
- AuditLoggerService, TenantId, Guards — standard paths

## Tasks

### Task 8.1 — Create Project DTOs
**Type**: DTO
**Complexity**: Medium
**Description**: Create project DTOs.

**CreateProjectDto** (standalone):
- name: string (required, max 200)
- description: string (optional)
- start_date: string (optional, ISO date)
- target_completion_date: string (optional, ISO date)
- permit_required: boolean (optional, default false)
- assigned_pm_user_id: string (optional, UUID)
- estimated_cost: number (optional, > 0)
- notes: string (optional)
- template_id: string (optional, UUID — if provided, apply template tasks on creation)

**CreateProjectFromQuoteDto**:
- name: string (optional — defaults to quote.title if not provided)
- description: string (optional)
- start_date: string (optional, ISO date)
- target_completion_date: string (optional, ISO date)
- permit_required: boolean (optional, default false)
- assigned_pm_user_id: string (optional, UUID)
- notes: string (optional)
- template_id: string (optional, UUID — apply template tasks in addition to quote item tasks)

**UpdateProjectDto**:
- name: string (optional)
- description: string (optional)
- status: enum (optional: planned, in_progress, on_hold, completed, canceled)
- start_date: string (optional)
- target_completion_date: string (optional)
- permit_required: boolean (optional)
- assigned_pm_user_id: string (optional, UUID, nullable)
- portal_enabled: boolean (optional)
- notes: string (optional)

**Project response shape**:
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "quote_id": "uuid-or-null",
  "lead_id": "uuid-or-null",
  "project_number": "PRJ-2026-0001",
  "name": "Kitchen Remodel - Smith Residence",
  "description": "Full kitchen renovation",
  "status": "planned",
  "start_date": "2026-04-01",
  "target_completion_date": "2026-06-15",
  "actual_completion_date": null,
  "permit_required": true,
  "assigned_pm_user_id": "uuid",
  "assigned_pm": { "id": "uuid", "first_name": "Jane", "last_name": "Admin" },
  "contract_value": 45000.00,
  "estimated_cost": 32000.00,
  "progress_percent": 0.00,
  "is_standalone": false,
  "portal_enabled": true,
  "deletion_locked": true,
  "notes": null,
  "task_count": 8,
  "completed_task_count": 0,
  "quote": { "id": "uuid", "quote_number": "Q-2026-0015", "title": "Kitchen Remodel" },
  "lead": { "id": "uuid", "first_name": "John", "last_name": "Smith" },
  "created_by_user_id": "uuid",
  "created_at": "2026-03-10T10:00:00.000Z",
  "updated_at": "2026-03-10T10:00:00.000Z"
}
```

**List response**: Standard pagination.

**Expected Outcome**: All DTOs created.

**Acceptance Criteria**:
- [ ] CreateProjectDto with template_id option
- [ ] CreateProjectFromQuoteDto for quote conversion
- [ ] UpdateProjectDto with status transitions

**Files Expected**:
- api/src/modules/projects/dto/create-project.dto.ts (created)
- api/src/modules/projects/dto/create-project-from-quote.dto.ts (created)
- api/src/modules/projects/dto/update-project.dto.ts (created)

**Blocker**: NONE

---

### Task 8.2 — Create ProjectService
**Type**: Service
**Complexity**: High (most complex service in the module)
**Description**: Create `api/src/modules/projects/services/project.service.ts`.

**Dependencies**: PrismaService, AuditLoggerService, FinancialEntryService (from FinancialModule), ProjectTemplateService

**Methods**:

1. **createFromQuote(tenantId, userId, quoteId, dto)** — The primary project creation flow:
   a. Fetch quote with items. Validate: quote.tenant_id === tenantId, quote.status in ['approved', 'started', 'concluded'].
   b. Generate project_number: query max existing project_number for tenant, increment. Format: PRJ-{year}-{sequence padded to 4}.
   c. Create project record: name = dto.name || quote.title, contract_value = quote.total, lead_id = quote.lead_id, quote_id = quoteId, is_standalone = false, status = 'planned'.
   d. Lock quote: update quote.deletion_locked = true (or add the field if using a separate mechanism).
   e. Update lead status: if quote.lead_id exists, update lead.status = 'customer' (use LeadsService or direct Prisma update).
   f. Create project_task records from quote items: for each quote_item → create project_task with title = item.title, description = item.description, status = 'not_started', order_index = item.order_index, quote_item_id = item.id.
   g. If dto.template_id provided: also apply template tasks (append after quote item tasks).
   h. Create portal_account if none exists for this lead+tenant (Sprint 31 handles full portal — here just reserve the field/skip if portal_account model doesn't exist yet).
   i. Audit log.
   j. Return full project response.

2. **createStandalone(tenantId, userId, dto)** — Create project without quote:
   a. Generate project_number (same sequence).
   b. is_standalone = true, quote_id = null, lead_id = null.
   c. If dto.template_id provided: apply template tasks.
   d. Audit log.
   e. Return project response.

3. **findAll(tenantId, query: { page?, limit?, status?, assigned_pm_user_id?, search? })** — Paginated list. Include task_count and completed_task_count (aggregated). Include quote and lead basic info.

4. **findOne(tenantId, id)** — Full detail with quote, lead, assigned_pm relations. Include task_count and completed_task_count.

5. **update(tenantId, id, userId, dto)** — Update project fields. If status changes to 'completed': set actual_completion_date = today. Audit log with before/after.

6. **softDelete(tenantId, id, userId)** — Only if project has no active tasks (or allow with warning). Audit log.

7. ~~getFinancialSummary~~ — **REMOVED**: Financial summary is served by Sprint 06's `GET /projects/:projectId/financial-summary` in FinancialModule. Do NOT implement this method in ProjectService.

8. **recomputeProgress(tenantId, projectId)** — Count total tasks and done tasks. Update progress_percent = (done / total) * 100. Called internally after task status changes.

**Private helper**:
- `generateProjectNumber(tenantId: string): Promise<string>` — Query max project_number for tenant in current year. Parse sequence. Increment. Return formatted string.

**Business Rules**:
- Quote status must be 'approved', 'started', or 'concluded' to create project from it
- project_number is unique per tenant, auto-generated: PRJ-{year}-{0001}
- Quote is locked (deletion_locked = true) after project creation
- Lead status updated to 'customer' on project creation from quote
- When status → 'completed': actual_completion_date set automatically
- All queries include where: { tenant_id }
- progress_percent is recomputed when tasks change status

**Expected Outcome**: ProjectService handles all creation flows and CRUD.

**Acceptance Criteria**:
- [ ] createFromQuote validates quote status, creates tasks from items
- [ ] createStandalone creates without quote
- [ ] project_number auto-generated correctly
- [ ] Quote locked after project creation
- [ ] Lead status updated to 'customer'
- [ ] findAll returns paginated with task counts
- [ ] Financial summary deferred to FinancialModule (Sprint 06) — not duplicated here
- [ ] All queries include where: { tenant_id }

**Files Expected**:
- api/src/modules/projects/services/project.service.ts (created)

**Blocker**: Task 8.1

---

### Task 8.3 — Create ProjectController
**Type**: Controller
**Complexity**: Medium
**Description**: Create `api/src/modules/projects/controllers/project.controller.ts` with `@Controller('api/v1/projects')`.

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | /projects | Owner, Admin, Manager | Create standalone project |
| POST | /projects/from-quote/:quoteId | Owner, Admin, Manager | Create from accepted quote |
| GET | /projects | Owner, Admin, Manager, Field (own) | List projects (paginated) |
| GET | /projects/:id | Owner, Admin, Manager, Field (assigned) | Project detail |
| PATCH | /projects/:id | Owner, Admin, Manager | Update project |
| DELETE | /projects/:id | Owner, Admin | Soft delete |


> **Financial summary is provided by Sprint 06's `GET /projects/:projectId/financial-summary` endpoint in FinancialModule. Do NOT duplicate this endpoint in ProjectController. If a project overview endpoint is needed, it should NOT include financial data — defer to the FinancialModule endpoint.**

**Query params for GET /projects**: page, limit, status, assigned_pm_user_id, search (name, project_number)

**Expected Outcome**: All 6 endpoints operational.

**Acceptance Criteria**:
- [ ] All endpoints created with correct paths and roles
- [ ] Quote conversion endpoint validates quote status

**Files Expected**:
- api/src/modules/projects/controllers/project.controller.ts (created)

**Blocker**: Task 8.2

---

### Task 8.4 — Update ProjectsModule
**Type**: Module
**Complexity**: Medium
**Description**: Update ProjectsModule to:
1. Import QuotesModule (for quote data access)
2. Import LeadsModule (for lead status update) — or import PrismaService directly for simpler approach
3. Import FinancialModule (for cost summary)
4. Add ProjectService and ProjectController
5. Export ProjectService

**Expected Outcome**: All project endpoints accessible, cross-module dependencies resolved.

**Acceptance Criteria**:
- [ ] All dependencies imported
- [ ] Application starts without errors
- [ ] All project endpoints accessible

**Files Expected**:
- api/src/modules/projects/projects.module.ts (modified)

**Blocker**: Task 8.3

---

### Task 8.5 — Unit Tests + Integration Tests + Documentation
**Type**: Test + Documentation
**Complexity**: High
**Description**:
1. Unit tests at `api/src/modules/projects/services/project.service.spec.ts`:
   - createFromQuote: validates quote status, generates project_number, creates tasks from items, locks quote, updates lead
   - createStandalone: no quote/lead, generates number
   - findAll: paginated with task counts
   - update: status → completed sets actual_completion_date
   - recomputeProgress: calculates correctly
   - generateProjectNumber: increments correctly, pads to 4 digits

2. Integration tests at `api/test/project.e2e-spec.ts`:
   - POST /projects — standalone creation
   - POST /projects/from-quote/:quoteId — validates and creates
   - GET /projects — paginated list
   - GET /projects/:id — detail with relations
   - PATCH /projects/:id — status update
   - (Financial summary covered by Sprint 06's FinancialModule endpoint — not duplicated here)

3. REST API docs at `api/documentation/project_REST_API.md`

**Expected Outcome**: All tests pass, docs complete.

**Acceptance Criteria**:
- [ ] Unit tests >80% coverage
- [ ] Integration tests passing
- [ ] API documentation covers all 6 endpoints with examples

**Files Expected**:
- api/src/modules/projects/services/project.service.spec.ts (created)
- api/test/project.e2e-spec.ts (created)
- api/documentation/project_REST_API.md (created)

**Blocker**: Task 8.4

---

## Sprint Acceptance Criteria
- [ ] Project creation from quote: validates status, copies data, locks quote, updates lead
- [ ] Standalone project creation works
- [ ] project_number auto-generated per tenant (PRJ-2026-0001 format)
- [ ] Tasks seeded from quote items on creation
- [ ] Financial summary deferred to Sprint 06's FinancialModule (`GET /projects/:projectId/financial-summary`) — not duplicated in ProjectController
- [ ] All queries include where: { tenant_id }
- [ ] Tests passing, documentation complete

## Gate Marker
NONE

## Handoff Notes
- Project CRUD at `/api/v1/projects`
- Project from quote at `/api/v1/projects/from-quote/:quoteId`
- ProjectService.recomputeProgress(tenantId, projectId) — call after task status changes
- project_number sequence is per-tenant per-year
- project_task records created from quote_items have quote_item_id set
- Portal account creation is deferred to Sprint 31 — placeholder logic acceptable here
