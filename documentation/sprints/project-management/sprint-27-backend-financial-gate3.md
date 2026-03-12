# Sprint 27 — Financial Gate 3: Crew Payments + Hour Logs + Subcontractor Payments + Invoices

## Sprint Goal
Deliver all Gate 3 financial entities: `crew_payment_record`, `crew_hour_log`, `subcontractor_payment_record`, `subcontractor_task_invoice` with services, API endpoints, and comprehensive tests. This opens Financial Gate 3.

## Phase
BACKEND

## Module
Financial (Project-Scoped)

## Gate Status
OPENS_FINANCIAL_GATE_3

## Prerequisites
- Sprint 06 must be complete (reason: FinancialModule exists)
- Sprint 02 must be complete (reason: crew_member entity exists)
- Sprint 04 must be complete (reason: subcontractor entity exists)
- Sprint 13 must be complete (reason: project_task entity exists)

## Codebase Reference
- Module path: `api/src/modules/financial/`
- FilesService for invoice file uploads (FileCategory: invoice)
- AuditLoggerService for all write operations
- Existing FinancialModule from Sprint 06

## Tasks

### Task 27.1 — Schema + Migration (all 4 entities)
**Type**: Schema + Migration
**Complexity**: High

**Enums**:

> **Note**: Use the existing `payment_method` enum defined in Sprint 01. Do not redefine it. The enum is the canonical payment method type for the entire platform.

```
// payment_method — ALREADY EXISTS from Sprint 01. Do not redefine.

enum hour_log_source {
  manual
  clockin_system
}

enum invoice_status {
  pending
  approved
  paid
}
```

Note: The `payment_method` enum is the canonical enum defined in Sprint 01. Reuse it directly. Do not create a duplicate.

**Field Table — crew_payment_record**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | |
| crew_member_id | String @db.VarChar(36) | no | — | FK → crew_member |
| project_id | String? @db.VarChar(36) | yes | null | FK → project (optional) |
| amount | Decimal @db.Decimal(12, 2) | no | — | Must be > 0. All monetary amounts on this platform use Decimal(12,2). Max value: $9,999,999,999.99. |
| payment_date | DateTime @db.Date | no | — | Cannot be future |
| payment_method | payment_method | no | — | |
| reference_number | String? @db.VarChar(200) | yes | null | |
| period_start_date | DateTime? @db.Date | yes | null | |
| period_end_date | DateTime? @db.Date | yes | null | |
| hours_paid | Decimal? @db.Decimal(6, 2) | yes | null | |
| notes | String? @db.Text | yes | null | |
| created_by_user_id | String @db.VarChar(36) | no | — | |
| created_at | DateTime | no | @default(now()) | |

**Indexes**: @@index([tenant_id, crew_member_id]), @@index([tenant_id, crew_member_id, payment_date]), @@index([tenant_id, project_id])

**Relations** (with `@relation` decorators):
- tenant: `tenant @relation(fields: [tenant_id], references: [id], onDelete: Cascade)`
- crew_member: `crew_member @relation(fields: [crew_member_id], references: [id], onDelete: Restrict)`
- project: `project? @relation(fields: [project_id], references: [id], onDelete: Cascade)`
- created_by: `user @relation(fields: [created_by_user_id], references: [id], onDelete: SetNull)`

**Field Table — crew_hour_log**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | |
| crew_member_id | String @db.VarChar(36) | no | — | FK → crew_member |
| project_id | String @db.VarChar(36) | no | — | FK → project (required) |
| task_id | String? @db.VarChar(36) | yes | null | FK → project_task |
| log_date | DateTime @db.Date | no | — | |
| hours_regular | Decimal @db.Decimal(5, 2) | no | — | Must be > 0 |
| hours_overtime | Decimal @db.Decimal(5, 2) | no | 0.00 | @default(0.00) |
| source | hour_log_source | no | manual | @default(manual) |
| clockin_event_id | String? @db.VarChar(36) | yes | null | RESERVED Phase 2 |
| notes | String? @db.Text | yes | null | |
| created_by_user_id | String @db.VarChar(36) | no | — | |
| created_at | DateTime | no | @default(now()) | |
| updated_at | DateTime | no | @updatedAt | |

**Indexes**: @@index([tenant_id, crew_member_id, log_date]), @@index([tenant_id, project_id]), @@index([tenant_id, task_id])

**Relations** (with `@relation` decorators):
- tenant: `tenant @relation(fields: [tenant_id], references: [id], onDelete: Cascade)`
- crew_member: `crew_member @relation(fields: [crew_member_id], references: [id], onDelete: Restrict)`
- project: `project @relation(fields: [project_id], references: [id], onDelete: Cascade)`
- task: `project_task? @relation(fields: [task_id], references: [id], onDelete: Cascade)`
- created_by: `user @relation(fields: [created_by_user_id], references: [id], onDelete: SetNull)`

**Field Table — subcontractor_payment_record**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | |
| subcontractor_id | String @db.VarChar(36) | no | — | FK → subcontractor |
| project_id | String? @db.VarChar(36) | yes | null | FK → project (optional) |
| amount | Decimal @db.Decimal(12, 2) | no | — | Must be > 0. All monetary amounts use Decimal(12,2). |
| payment_date | DateTime @db.Date | no | — | Cannot be future |
| payment_method | payment_method | no | — | |
| reference_number | String? @db.VarChar(200) | yes | null | |
| notes | String? @db.Text | yes | null | |
| created_by_user_id | String @db.VarChar(36) | no | — | |
| created_at | DateTime | no | @default(now()) | |

**Indexes**: @@index([tenant_id, subcontractor_id]), @@index([tenant_id, subcontractor_id, payment_date]), @@index([tenant_id, project_id])

**Relations** (with `@relation` decorators):
- tenant: `tenant @relation(fields: [tenant_id], references: [id], onDelete: Cascade)`
- subcontractor: `subcontractor @relation(fields: [subcontractor_id], references: [id], onDelete: Restrict)`
- project: `project? @relation(fields: [project_id], references: [id], onDelete: Cascade)`
- created_by: `user @relation(fields: [created_by_user_id], references: [id], onDelete: SetNull)`

**Field Table — subcontractor_task_invoice**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | |
| subcontractor_id | String @db.VarChar(36) | no | — | FK → subcontractor |
| task_id | String @db.VarChar(36) | no | — | FK → project_task |
| project_id | String @db.VarChar(36) | no | — | FK → project |
| invoice_number | String? @db.VarChar(100) | yes | null | |
| invoice_date | DateTime? @db.Date | yes | null | |
| amount | Decimal @db.Decimal(12, 2) | no | — | Must be > 0 |
| status | invoice_status | no | pending | @default(pending) |
| notes | String? @db.Text | yes | null | |
| file_id | String? @db.VarChar(36) | yes | null | FK → file (FilesService) |
| file_url | String? @db.VarChar(500) | yes | null | |
| file_name | String? @db.VarChar(255) | yes | null | |
| created_by_user_id | String @db.VarChar(36) | no | — | |
| created_at | DateTime | no | @default(now()) | |
| updated_at | DateTime | no | @updatedAt | |

**Indexes**: @@index([tenant_id, subcontractor_id]), @@index([tenant_id, task_id]), @@index([tenant_id, project_id]), @@index([tenant_id, status])
**Unique constraint**: `@@unique([tenant_id, invoice_number])` — `invoice_number` must be unique per tenant. If provided and already exists, throw `ConflictException`.

**Relations** (with `@relation` decorators):
- tenant: `tenant @relation(fields: [tenant_id], references: [id], onDelete: Cascade)`
- subcontractor: `subcontractor @relation(fields: [subcontractor_id], references: [id], onDelete: Restrict)`
- task: `project_task @relation(fields: [task_id], references: [id], onDelete: Cascade)`
- project: `project @relation(fields: [project_id], references: [id], onDelete: Cascade)`
- file: `file? @relation(fields: [file_id], references: [id], onDelete: SetNull)`
- created_by: `user @relation(fields: [created_by_user_id], references: [id], onDelete: SetNull)`

**Add all reverse relation arrays to parent models** (crew_member, subcontractor, project, project_task, tenant, user, file) in schema notes.

Run migration for all 4 tables.

**Acceptance Criteria**: All 4 tables created
**Blocker**: NONE

---

### Task 27.2 — CrewPaymentService + CrewHourLogService
**Type**: Service
**Complexity**: High

**CrewPaymentService**:
1. createPayment(tenantId, userId, crewMemberId, dto) — amount > 0, payment_date not future. Audit log.
2. getPaymentHistory(tenantId, crewMemberId, query: { page?, limit?, project_id? }) — Paginated.
3. getTotalPaid(tenantId, crewMemberId) — Sum of all payments.

**CrewHourLogService**:
1. logHours(tenantId, userId, dto: { crew_member_id, project_id, task_id?, log_date, hours_regular, hours_overtime?, notes? }) — source='manual', clockin_event_id=null. hours_regular > 0. Audit log.
2. getHoursForProject(tenantId, projectId, crewMemberId?) — List hours.
3. getHoursForCrew(tenantId, crewMemberId, dateRange?) — List hours with optional date filter.
4. updateHours(tenantId, hourLogId, userId, dto) — Audit log with before/after.

**Blocker**: Task 27.1

---

### Task 27.3 — SubcontractorPaymentService + SubcontractorInvoiceService
**Type**: Service
**Complexity**: High

**SubcontractorPaymentService**:
1. createPayment(tenantId, userId, subcontractorId, dto) — amount > 0, payment_date not future. Audit log.
2. getPaymentHistory(tenantId, subcontractorId, query: { page?, limit?, project_id? }) — Paginated.
3. getTotalPaid(tenantId, subcontractorId) — Sum of all payments.

**SubcontractorInvoiceService**:
1. createInvoice(tenantId, userId, dto: { subcontractor_id, task_id, project_id, amount, invoice_number?, invoice_date?, notes?, file? }) — If file: call FilesService.uploadFile with FileCategory 'invoice'. status='pending'. Audit log.
2. updateStatus(tenantId, invoiceId, userId, status: 'approved' | 'paid') — Forward-only (pending→approved→paid). Amount updatable before approved. After approved: Owner/Admin + audit log.
3. getTaskInvoices(tenantId, taskId) — List invoices for task.
4. getSubcontractorInvoices(tenantId, subcontractorId) — List invoices for sub.

**Blocker**: Task 27.1

---

### Task 27.4 — Controllers + Module Update
**Type**: Controller + Module
**Complexity**: Medium

**Endpoints**:
| Method | Path | Roles |
|--------|------|-------|
| POST | /financial/crew-payments | Owner, Admin, Bookkeeper |
| GET | /financial/crew-payments | Owner, Admin, Bookkeeper |
| GET | /crew/:crewMemberId/payment-history | Owner, Admin, Manager, Bookkeeper |
| POST | /financial/crew-hours | Owner, Admin, Manager |
| GET | /financial/crew-hours | Owner, Admin, Manager, Bookkeeper |
| PATCH | /financial/crew-hours/:id | Owner, Admin |
| POST | /financial/subcontractor-payments | Owner, Admin, Bookkeeper |
| GET | /financial/subcontractor-payments | Owner, Admin, Bookkeeper |
| GET | /subcontractors/:subcontractorId/payment-history | Owner, Admin, Manager, Bookkeeper |
| POST | /financial/subcontractor-invoices | Owner, Admin, Manager, Bookkeeper |
| GET | /financial/subcontractor-invoices | Owner, Admin, Manager, Bookkeeper |
| PATCH | /financial/subcontractor-invoices/:id | Owner, Admin, Bookkeeper |
| GET | /projects/:projectId/tasks/:taskId/invoices | Owner, Admin, Manager, Bookkeeper |

Update FinancialModule: import FilesModule, register all new services and controllers, export all services.

**Blocker**: Tasks 27.2, 27.3

---

### Task 27.5 — Tests + Documentation
**Type**: Test + Documentation
**Complexity**: High

Unit tests for all 4 services. Integration tests. REST docs at `api/documentation/financial_gate3_REST_API.md`.

**Blocker**: Task 27.4

---

## Sprint Acceptance Criteria
- [ ] All 4 financial tables exist
- [ ] Crew payments and hour logging working
- [ ] Subcontractor payments and invoicing working
- [ ] Invoice status flow enforced (pending→approved→paid)
- [ ] Invoice file upload via FilesService
- [ ] All queries include where: { tenant_id }
- [ ] Tests and docs complete

## Gate Marker
STOP — FINANCIAL GATE 3 IS NOW OPEN. All services exported from FinancialModule.

## Handoff Notes
- Crew payments at /api/v1/financial/crew-payments
- Crew hours at /api/v1/financial/crew-hours
- Sub payments at /api/v1/financial/subcontractor-payments
- Sub invoices at /api/v1/financial/subcontractor-invoices
- All services exported from FinancialModule for ProjectsModule consumption
