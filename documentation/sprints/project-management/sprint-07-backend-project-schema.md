# Sprint 07 — Project Entity Schema + Migration

## Sprint Goal
Create the `project` database table with all fields per contract, including quote/lead foreign keys, project number sequence, status enum, financial fields, and portal flag.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 05 must be complete (reason: project_task_category enum exists)
- Sprint 06 must be complete (reason: financial_entry will reference project_id — relationship added here)

## Codebase Reference
- Module path: `api/src/modules/projects/`
- Prisma schema: `api/prisma/schema.prisma`
- Existing quote model at line 2528 of schema.prisma
- Existing lead model at line 1473 of schema.prisma

## Tasks

### Task 7.1 — Add project model to Prisma schema
**Type**: Schema
**Complexity**: High
**Description**: Add the `project` model with all fields. Create the `project_status` enum. Add relations to existing models (tenant, quote, lead, user). Update the financial_entry model to add a proper @relation to project.

**Enum to create**:
```
enum project_status {
  planned
  in_progress
  on_hold
  completed
  canceled
}
```

**Field Table — project**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | FK → tenant |
| quote_id | String? @db.VarChar(36) | yes | null | FK → quote. Null if standalone. |
| lead_id | String? @db.VarChar(36) | yes | null | FK → lead. Set when created from quote. |
| project_number | String @db.VarChar(50) | no | — | Auto-generated per tenant: PRJ-{year}-{0042} |
| name | String @db.VarChar(200) | no | — | |
| description | String? @db.Text | yes | null | Internal description |
| status | project_status | no | planned | @default(planned) |
| start_date | DateTime? @db.Date | yes | null | Scheduled start |
| target_completion_date | DateTime? @db.Date | yes | null | |
| actual_completion_date | DateTime? @db.Date | yes | null | Set when status → completed |
| permit_required | Boolean | no | false | @default(false) |
| assigned_pm_user_id | String? @db.VarChar(36) | yes | null | FK → user |
| contract_value | Decimal? @db.Decimal(12, 2) | yes | null | Copied from quote.total |
| estimated_cost | Decimal? @db.Decimal(12, 2) | yes | null | Reserved for margin calc |
| progress_percent | Decimal @db.Decimal(5, 2) | no | 0.00 | @default(0.00). Computed: done_tasks / total_tasks * 100 |
| is_standalone | Boolean | no | false | @default(false) |
| portal_enabled | Boolean | no | true | @default(true) |
| deletion_locked | Boolean | no | false | @default(false). Blocks quote deletion when true. |
| notes | String? @db.Text | yes | null | Internal PM notes |
| created_by_user_id | String @db.VarChar(36) | no | — | FK → user |
| created_at | DateTime | no | @default(now()) | Auto |
| updated_at | DateTime | no | @updatedAt | Auto |

**Indexes**:
- @@index([tenant_id, status])
- @@index([tenant_id, created_at])
- @@index([tenant_id, lead_id])
- @@index([tenant_id, assigned_pm_user_id])
- @@unique([tenant_id, project_number])
- @@map("project")

**Relations**:
- tenant → Cascade
- quote → Restrict (optional)
- lead → SetNull (optional)
- assigned_pm_user → SetNull (optional)
- created_by_user → Restrict
- Add reverse relations: quote model gets `projects project[]`, lead model gets `projects project[]`, tenant gets `projects project[]`, user gets appropriate relations

**Also update**:
- financial_entry model: add `project project? @relation(fields: [project_id], references: [id], onDelete: Restrict)` and reverse `financial_entries financial_entry[]` to project model
- Add `deletion_locked Boolean @default(false)` to the quote model if it doesn't exist already (check first)

**Expected Outcome**: Project model in schema with all 22 fields and proper relations.

**Acceptance Criteria**:
- [ ] project model with all 22 fields
- [ ] project_status enum created
- [ ] All relations defined including reverse
- [ ] financial_entry relation to project established
- [ ] Unique constraint on (tenant_id, project_number)
- [ ] Quote model has deletion_locked field

**Files Expected**:
- api/prisma/schema.prisma (modified)

**Blocker**: NONE

---

### Task 7.2 — Run Prisma migration
**Type**: Migration
**Complexity**: Low
**Description**: Generate and apply migration.

```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name add_project_entity
npx prisma generate
```

**Expected Outcome**: Migration applied, project table exists.

**Acceptance Criteria**:
- [ ] Migration applied successfully
- [ ] project table exists with all columns
- [ ] Unique constraint on tenant_id + project_number

**Files Expected**:
- api/prisma/migrations/[timestamp]_add_project_entity/migration.sql (created)

**Blocker**: Task 7.1

---

## Sprint Acceptance Criteria
- [ ] project table exists with all 22 columns
- [ ] project_status enum exists
- [ ] Relations to quote, lead, tenant, user established
- [ ] financial_entry → project relation established
- [ ] Migration clean

## Gate Marker
NONE

## Handoff Notes
- The project model is ready for Sprint 08 (creation logic, service, controller).
- project_number format: PRJ-{year}-{sequence padded to 4 digits} — sequence is per-tenant.
- Status transitions: planned → in_progress → on_hold → completed / canceled
- When status → completed: set actual_completion_date = today
- deletion_locked on quote prevents quote deletion when project exists
- contract_value and estimated_cost are reserved for financial summary display
