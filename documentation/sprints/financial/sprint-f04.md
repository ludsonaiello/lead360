# Sprint F-04 — General Expense Entry Engine

**Module**: Financial  
**Sprint**: F-04  
**Status**: Ready for Development  
**Type**: Enhancement — Existing Service Rebuild + New Flows  
**Estimated Complexity**: High  
**Prerequisites**:
- Sprint F-01 must be complete (schema fields added, `project_id` nullable)
- Sprint F-02 must be complete (`supplier` table and FK relation wired)
- Sprint F-03 must be complete (`payment_method_registry` table and FK relation wired)

---

## Purpose

Sprints F-01 through F-03 laid the schema foundation. Sprint F-04 brings the expense recording engine to life — the full create, list, update, and delete flow for financial entries, now supporting both project-scoped expenses and business-level overhead expenses.

The three critical new behaviors this sprint delivers:

**1. Business-level expense recording.** Any expense not tied to a project — gas, insurance, tools, office supplies — can now be recorded. The form accepts a category (using the new overhead types from F-01), an optional supplier, a named payment method, and who bought it (user or crew member). No `project_id` required.

**2. Two-tier submit/post flow.** Employees and field workers can submit a receipt or expense for review. It lands as `pending_review`. An Owner, Admin, Manager, or Bookkeeper reviews it and posts it as `confirmed`. This gives the business owner financial control without blocking field workers from submitting expenses in real time. The role-based defaulting of `submission_status` is implemented here — it was stubbed in F-01.

**3. Pending expense review workflow.** New endpoints for listing, approving, and rejecting pending entries. A pending entry that is rejected returns to the submitter with a rejection reason. A pending entry that is approved becomes confirmed and enters the financial record.

This sprint also wires the supplier spend aggregation hook (calling `SupplierService.updateSpendTotals()` on create/delete) and the payment method auto-copy (registry type → entry enum field).

---

## Scope

### In Scope

- Full rebuild of `FinancialEntryService` to support all new fields from F-01 schema
- Role-based `submission_status` defaulting on create
- Pending expense review endpoints (list pending, approve, reject)
- Rejection reason field and flow
- `purchased_by_user_id` / `purchased_by_crew_member_id` validation and mutual-exclusion rule
- Auto-copy: when `payment_method_registry_id` provided, copy its `type` into `payment_method`
- Supplier spend totals update hook on create and delete
- Enhanced `ListFinancialEntriesDto` with all new filter fields
- Enhanced response shape for all `financial_entry` endpoints — include joined supplier name, payment method nickname, category name, purchased-by name
- Updated `UpdateFinancialEntryDto` — expose new editable fields
- Export endpoint: filtered financial entries as CSV
- 100% API documentation update
- Full test coverage

### Out of Scope

- No receipt OCR (Sprint F-05)
- No recurring entry creation (Sprint F-06)
- No project financial summary rebuild (Sprint F-07)
- No business P&L dashboard (Sprint F-09)
- No frontend implementation
- No changes to `crew_payment_record`, `crew_hour_log`, `subcontractor_payment_record`, or `subcontractor_task_invoice` — those Gate 3 tables are out of scope

---

## Platform Architecture Patterns (Mandatory)

- **Tenant isolation**: Every query must include `tenant_id`. Entries from tenant A are never visible to tenant B.
- **TenantId decorator**: `@TenantId()` on all controller methods. Never from request body.
- **AuditLoggerService**: All create, update, approve, reject, and delete operations must be audit logged with before/after payload.
- **FilesService**: Not directly used — receipt file linking is handled via the existing `receipt` table (Sprint F-05 wires OCR on top of that). This sprint does not handle file uploads.
- **EncryptionService**: Not applicable.
- **Two-tier role enforcement**: Use `@Roles()` decorator with role-specific guards already in the platform. The `submission_status` defaulting logic lives in the service, not in the guard.
- **Migrations**: No new migrations in this sprint — all schema changes were done in F-01/F-02/F-03. This sprint wires service logic only.

---

## Role-Based Behavior Matrix

This is the core business rule table for this sprint. Every role has a defined behavior on every operation.

| Role | Create Entry Default Status | Can Approve Pending | Can Reject Pending | Can View All Entries | Can Edit Confirmed Entry | Can Delete Entry |
|------|-----------------------------|---------------------|--------------------|-----------------------|--------------------------|-----------------|
| Owner | `confirmed` | Yes | Yes | Yes | Yes | Yes |
| Admin | `confirmed` | Yes | Yes | Yes | Yes | Yes |
| Manager | `confirmed` | Yes | Yes | Yes | Yes | No |
| Bookkeeper | `confirmed` | Yes | Yes | Yes | Yes | No |
| Employee | `pending_review` | No | No | Own submissions only | Own pending only | Own pending only |

**Rules derived from this table:**
- When an Employee creates an entry, `submission_status` is forced to `pending_review` regardless of what they send in the request body. The service overwrites it.
- When Owner/Admin/Manager/Bookkeeper creates an entry, `submission_status` defaults to `confirmed` but can be explicitly set to `pending_review` if they want to flag it for review.
- An Employee can only see entries they submitted (`created_by_user_id = their user id`). All other roles see all tenant entries.
- An Employee can edit or delete their own entries only while in `pending_review` status. Once confirmed, only Owner/Admin/Manager/Bookkeeper can edit.
- A confirmed entry can only be deleted by Owner or Admin.

---

## Enhanced `financial_entry` Response Shape

All list and single-record responses must return enriched data — no raw FK IDs without their human-readable labels.

```
id
tenant_id
project_id              string | null
project_name            string | null   — joined from project.name
task_id                 string | null
task_title              string | null   — joined from project_task.title
category_id
category_name           string          — joined from financial_category.name
category_type           enum            — financial_category_type value
category_classification enum            — cost_of_goods_sold | operating_expense
entry_type              enum            — expense | income
amount                  decimal
tax_amount              decimal | null
entry_date              date
entry_time              time | null
vendor_name             string | null   — free-text fallback
supplier_id             string | null
supplier_name           string | null   — joined from supplier.name
payment_method          enum | null     — raw enum value
payment_method_registry_id   string | null
payment_method_nickname      string | null   — joined from payment_method_registry.nickname
purchased_by_user_id         string | null
purchased_by_user_name       string | null   — joined: first_name + last_name
purchased_by_crew_member_id  string | null
purchased_by_crew_member_name string | null  — joined from crew_member.name
submission_status       enum            — pending_review | confirmed
is_recurring_instance   boolean
recurring_rule_id       string | null
has_receipt             boolean
notes                   string | null
created_by_user_id      string
created_by_name         string          — joined: first_name + last_name
created_at              datetime
updated_at              datetime
```

---

## API Specification

### Existing Endpoints — Updated Behavior

#### `POST /financial/entries`

**Request body (full, all fields):**

```
project_id                     string (UUID)   optional
task_id                        string (UUID)   optional
category_id                    string (UUID)   required
entry_type                     enum            required    expense | income
amount                         decimal         required    must be > 0
tax_amount                     decimal         optional    must be < amount if provided
entry_date                     date            required    YYYY-MM-DD
entry_time                     string          optional    HH:MM:SS
vendor_name                    string          optional    max 200 chars — free-text fallback
supplier_id                    string (UUID)   optional
payment_method                 enum            optional    ignored if payment_method_registry_id provided
payment_method_registry_id     string (UUID)   optional
purchased_by_user_id           string (UUID)   optional    mutually exclusive with purchased_by_crew_member_id
purchased_by_crew_member_id    string (UUID)   optional    mutually exclusive with purchased_by_user_id
submission_status              enum            optional    Owner/Admin/Manager/Bookkeeper only — Employee value is overridden
notes                          string          optional    max 2000 chars
```

**Service behavior on create:**

1. Validate `category_id` belongs to `tenantId` — throw 404 if not.
2. If `project_id` provided, validate it belongs to `tenantId` — throw 404 if not.
3. If `task_id` provided, validate it belongs to `tenantId` — throw 404 if not.
4. If `supplier_id` provided, validate it belongs to `tenantId` and is active — throw 404 if not.
5. If `payment_method_registry_id` provided:
   - Validate it belongs to `tenantId` — throw 404 if not.
   - Auto-copy its `type` value into `payment_method` field on the entry.
6. If both `purchased_by_user_id` and `purchased_by_crew_member_id` are provided — throw 400: "Cannot assign purchase to both a user and a crew member. Provide only one."
7. If `purchased_by_user_id` provided, validate user belongs to `tenantId`.
8. If `purchased_by_crew_member_id` provided, validate crew member belongs to `tenantId`.
9. Enforce `submission_status` by role:
   - If requester role is Employee → force `submission_status = pending_review` regardless of request body.
   - Otherwise → use provided value or default to `confirmed`.
10. Validate `tax_amount < amount` if both are provided.
11. Create entry record.
12. If `supplier_id` provided, call `SupplierService.updateSpendTotals(tenantId, supplier_id)` after create.
13. Audit log the creation.

**Response:** 201 Created — full enriched entry object (see Enhanced Response Shape above).

**Errors:**
- 400 — `amount` is zero or negative
- 400 — `tax_amount` >= `amount`
- 400 — both `purchased_by_user_id` and `purchased_by_crew_member_id` provided
- 404 — `category_id`, `project_id`, `task_id`, `supplier_id`, or `payment_method_registry_id` not found in tenant

---

#### `GET /financial/entries`

**Updated query parameters (full list):**

```
project_id              UUID        optional    filter to project
task_id                 UUID        optional    filter to task
category_id             UUID        optional    filter to category
category_type           enum        optional    filter by financial_category_type
classification          enum        optional    cost_of_goods_sold | operating_expense
entry_type              enum        optional    expense | income
supplier_id             UUID        optional    filter to supplier
payment_method          enum        optional    filter by payment type
submission_status       enum        optional    pending_review | confirmed
purchased_by_user_id    UUID        optional
purchased_by_crew_member_id  UUID   optional
date_from               date        optional    YYYY-MM-DD — entry_date >= date_from
date_to                 date        optional    YYYY-MM-DD — entry_date <= date_to
has_receipt             boolean     optional    filter entries with/without receipt
is_recurring_instance   boolean     optional    filter recurring instances
search                  string      optional    searches vendor_name and notes fields
page                    integer     default 1
limit                   integer     default 20, max 100
sort_by                 enum        optional    entry_date | amount | created_at — default entry_date
sort_order              enum        optional    asc | desc — default desc
```

**Role-based filter enforcement:**
- If requester is Employee, the query is automatically AND-filtered by `created_by_user_id = requester.user_id`. The Employee cannot bypass this by providing other `created_by` filters — the service enforces it silently.
- All other roles see all tenant entries matching their filters.

**Response:**
```
data: [ ...enriched entry objects ]
meta: { total, page, limit, total_pages }
summary: {
  total_expenses:   decimal   — sum of amount where entry_type = expense in this result set
  total_income:     decimal   — sum of amount where entry_type = income in this result set
  total_tax:        decimal   — sum of tax_amount in this result set
  entry_count:      integer
}
```

The `summary` block is computed from the full unfiltered count (not just current page) to give an accurate total.

---

#### `GET /financial/entries/:id`

**Role enforcement:** Employee can only fetch their own entries. Other roles fetch any tenant entry.

**Response:** Full enriched entry object.

**Errors:**
- 404 — not found or not in tenant
- 403 — Employee attempting to access another user's entry

---

#### `PATCH /financial/entries/:id`

**Editable fields (all optional):**

```
category_id                    UUID        optional
entry_type                     enum        optional
amount                         decimal     optional    must be > 0
tax_amount                     decimal     optional
entry_date                     date        optional
entry_time                     string      optional
vendor_name                    string      optional
supplier_id                    UUID        optional    set to null to unlink
payment_method                 enum        optional
payment_method_registry_id     UUID        optional    set to null to unlink
purchased_by_user_id           UUID        optional    set to null to unlink
purchased_by_crew_member_id    UUID        optional    set to null to unlink
notes                          string      optional
```

**NOT editable:** `project_id`, `task_id`, `submission_status` (use approve/reject endpoints), `is_recurring_instance`, `recurring_rule_id`, `created_by_user_id`.

**Role enforcement:**
- Employee can only edit their own entries while `submission_status = pending_review`. Confirmed entries are locked for Employees.
- Manager and Bookkeeper can edit any entry in any status.
- Owner and Admin can edit any entry in any status.

**Supplier spend update:** If `supplier_id` changes (old supplier unlinked, new supplier linked, or supplier removed), call `SupplierService.updateSpendTotals()` for both the old and new supplier IDs within the same transaction.

**Payment method auto-copy:** If `payment_method_registry_id` is updated, re-copy its `type` into `payment_method`.

**Response:** Updated enriched entry object.

**Errors:**
- 404 — not found or not in tenant
- 403 — Employee attempting to edit another user's entry, or attempting to edit a confirmed entry
- 400 — validation failures (same as create)

---

#### `DELETE /financial/entries/:id`

**Role enforcement:**
- Employee can only delete their own entries while `submission_status = pending_review`.
- Manager and Bookkeeper cannot delete (403).
- Owner and Admin can delete any entry.

**Supplier spend update:** If the deleted entry had a `supplier_id`, call `SupplierService.updateSpendTotals()` after deletion.

**Response:** 200 OK with `{ message: "Entry deleted successfully" }`.

**Errors:**
- 404 — not found or not in tenant
- 403 — insufficient role

---

### New Endpoints — Pending Review Workflow

#### `GET /financial/entries/pending`

**Purpose:** List all entries with `submission_status = pending_review` for review by Owner/Admin/Manager/Bookkeeper.

**Roles:** Owner, Admin, Manager, Bookkeeper only. Employee cannot access this endpoint.

**Query parameters:**
```
submitted_by_user_id    UUID     optional    filter by submitter
date_from               date     optional
date_to                 date     optional
page                    integer  default 1
limit                   integer  default 20
```

**Response:** Same paginated structure as `GET /financial/entries` but pre-filtered to `submission_status = pending_review`. Includes `summary` block.

**Note on routing:** This route must be registered BEFORE `GET /financial/entries/:id` in the controller to avoid NestJS treating `pending` as an `:id` parameter.

---

#### `POST /financial/entries/:id/approve`

**Purpose:** Mark a `pending_review` entry as `confirmed`.

**Roles:** Owner, Admin, Manager, Bookkeeper only.

**Request body:**
```
notes   string   optional   Internal note about the approval decision
```

**Service behavior:**
1. Fetch entry — verify it belongs to `tenantId`.
2. Verify `submission_status = pending_review` — throw 400 if already confirmed or already rejected.
3. Set `submission_status = confirmed`.
4. Set `updated_by_user_id` to approver's user ID.
5. Audit log with action `EXPENSE_APPROVED`, actor = approver, before/after payload.

**Response:** 200 OK — full enriched updated entry object.

**Errors:**
- 404 — entry not found
- 400 — entry is not in `pending_review` status
- 403 — insufficient role

---

#### `POST /financial/entries/:id/reject`

**Purpose:** Reject a `pending_review` entry and return it to the submitter with a reason.

**Roles:** Owner, Admin, Manager, Bookkeeper only.

**Request body:**
```
rejection_reason   string   required   max 500 chars — must explain why it was rejected
```

**Service behavior:**
1. Fetch entry — verify it belongs to `tenantId`.
2. Verify `submission_status = pending_review` — throw 400 if not pending.
3. Set `submission_status = pending_review` (it remains pending but now has a rejection reason).
4. Set `rejection_reason` on the entry record (new field — see schema note below).
5. Set `rejected_by_user_id` and `rejected_at` (new fields — see schema note below).
6. Audit log with action `EXPENSE_REJECTED`.

**Important — rejection does not delete the entry.** It remains as `pending_review` with a rejection reason attached. The submitting Employee can then edit and resubmit. This is the intended workflow: Employee submits → Reviewer rejects with reason → Employee corrects and the entry stays in pending → Reviewer approves.

**Response:** 200 OK — full enriched updated entry object including `rejection_reason`.

**Errors:**
- 404 — entry not found
- 400 — entry is not in `pending_review` status
- 400 — `rejection_reason` is empty or missing
- 403 — insufficient role

---

#### `POST /financial/entries/:id/resubmit`

**Purpose:** After a rejection, the Employee corrects their entry and marks it as ready for review again.

**Roles:** Employee (own entries only), Owner, Admin, Manager, Bookkeeper (any entry).

**Request body:** Optional partial update of entry fields — same as PATCH. If provided, updates those fields before resubmitting.

**Service behavior:**
1. Verify entry belongs to `tenantId`.
2. If Employee, verify `created_by_user_id = requester.user_id`.
3. Verify entry has a `rejected_at` timestamp — only rejected entries can be resubmitted.
4. Apply any field updates from request body.
5. Clear `rejection_reason`, `rejected_by_user_id`, `rejected_at`.
6. Keep `submission_status = pending_review`.
7. Audit log with action `EXPENSE_RESUBMITTED`.

**Response:** 200 OK — full enriched updated entry object.

---

### New Endpoint — Export

#### `GET /financial/entries/export`

**Purpose:** Export filtered financial entries as CSV for use in accounting software, bookkeeping, or analysis.

**Roles:** Owner, Admin, Bookkeeper only. Manager and Employee cannot export.

**Query parameters:** Same as `GET /financial/entries` (all filters apply to the export).

**Response:** `Content-Type: text/csv` with `Content-Disposition: attachment; filename="expenses-[date].csv"`.

**CSV columns:**
```
Date, Time, Type, Category, Classification, Project, Task, Supplier, Vendor Name, Amount, Tax Amount, Payment Method, Payment Account, Purchased By, Submitted By, Status, Notes, Created At
```

**Behavior:** No pagination — exports all matching records (up to 10,000 rows). If result set exceeds 10,000 rows, return 400 with message: "Export limit exceeded. Apply date filters to narrow the result set."

**Note on routing:** Register BEFORE `GET /financial/entries/:id` to avoid NestJS treating `export` as an `:id` param.

---

## Schema Additions (Minor — No New Migration File Needed)

Three new fields are needed on `financial_entry` for the reject/resubmit flow. These were not included in F-01 because the full reject flow design was finalized in this sprint. Add these to the F-01 migration or create a small addendum migration:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `rejection_reason` | `String? @db.VarChar(500)` | No | null | Populated on rejection, cleared on resubmit |
| `rejected_by_user_id` | `String? @db.VarChar(36)` | No | null | User who rejected |
| `rejected_at` | `DateTime?` | No | null | Timestamp of rejection |

**Migration name if addendum needed:** `npx prisma migrate dev --name financial_entry_rejection_fields`

**Relation to add:**
```
rejected_by   user?   @relation("financial_entry_rejected_by", fields: [rejected_by_user_id], references: [id], onDelete: SetNull)
```

---

## Service Architecture

### `FinancialEntryService` — Updated Method List

All existing methods are updated. New methods are added.

| Method | Signature | Notes |
|--------|-----------|-------|
| `createEntry` | `(tenantId, userId, userRole, dto)` | `userRole` added to enforce submission_status |
| `getEntries` | `(tenantId, userId, userRole, query)` | `userId` + `userRole` added for Employee scoping |
| `getEntryById` | `(tenantId, entryId, userId, userRole)` | Role + ownership check added |
| `updateEntry` | `(tenantId, entryId, userId, userRole, dto)` | Role + ownership + status check |
| `deleteEntry` | `(tenantId, entryId, userId, userRole)` | Role enforcement added |
| `getPendingEntries` | `(tenantId, query)` | New — list pending_review entries |
| `approveEntry` | `(tenantId, entryId, approverId, dto)` | New |
| `rejectEntry` | `(tenantId, entryId, rejectorId, dto)` | New |
| `resubmitEntry` | `(tenantId, entryId, userId, userRole, dto)` | New |
| `exportEntries` | `(tenantId, userId, userRole, query)` | New — returns CSV buffer |
| `getProjectEntries` | `(tenantId, query)` | Existing — no behavior change needed beyond base filter update |
| `getTaskEntries` | `(tenantId, taskId)` | Existing — no change |
| `getProjectCostSummary` | `(tenantId, projectId)` | Existing — no change |
| `getTaskCostSummary` | `(tenantId, taskId)` | Existing — no change |

**Note on `userRole` parameter:** The controller extracts the user's highest-priority role from the JWT and passes it to the service. The service does not re-query the database for roles — it trusts the JWT payload which is already validated by the auth guard.

---

## Business Rules Summary

1. `submission_status` for Employee creates is always `pending_review` — not negotiable, not overridable by client.
2. Employees see only their own entries across all list, get, update, and delete operations.
3. Only Owner and Admin can delete confirmed entries.
4. Manager and Bookkeeper cannot delete entries (any status).
5. `project_id` is immutable after creation.
6. `task_id` is immutable after creation.
7. `is_recurring_instance` is immutable after creation.
8. `recurring_rule_id` is immutable after creation.
9. When `payment_method_registry_id` is set, its `type` is auto-copied into `payment_method` — client does not need to provide both.
10. `purchased_by_user_id` and `purchased_by_crew_member_id` are mutually exclusive — both cannot be set simultaneously.
11. `tax_amount` must be less than `amount` when both are provided.
12. Rejected entries are not deleted — they remain as `pending_review` with a rejection reason for the employee to correct.
13. Only rejected entries (those with `rejected_at` populated) can be resubmitted.
14. Approval clears no rejection fields — rejection and approval are terminal states from review. Resubmission is the bridge back to pending.
15. CSV export is limited to 10,000 rows. Requests exceeding this must apply date filters.
16. Supplier `total_spend` and `last_purchase_date` are updated synchronously on create and delete of entries with a `supplier_id`.

---

## Acceptance Criteria

**Role-Based Behavior:**
- [ ] Employee creates entry → `submission_status` forced to `pending_review` regardless of request body
- [ ] Owner creates entry → `submission_status` defaults to `confirmed`
- [ ] Employee `GET /financial/entries` returns only their own entries
- [ ] Bookkeeper `GET /financial/entries` returns all tenant entries
- [ ] Employee PATCH on another user's entry returns 403
- [ ] Employee PATCH on own confirmed entry returns 403
- [ ] Manager DELETE on any entry returns 403
- [ ] Owner DELETE on confirmed entry returns 200

**Pending Workflow:**
- [ ] `GET /financial/entries/pending` returns only `pending_review` entries
- [ ] Employee cannot access `GET /financial/entries/pending` — returns 403
- [ ] `POST /financial/entries/:id/approve` sets status to confirmed
- [ ] Approving already-confirmed entry returns 400
- [ ] `POST /financial/entries/:id/reject` sets `rejection_reason`, `rejected_by_user_id`, `rejected_at`
- [ ] Rejecting non-pending entry returns 400
- [ ] Rejected entry remains in `pending_review` status — not deleted
- [ ] `POST /financial/entries/:id/resubmit` clears rejection fields, entry returns to clean pending state
- [ ] Resubmitting non-rejected entry returns 400

**Field Logic:**
- [ ] `payment_method_registry_id` provided → `payment_method` enum auto-populated from registry
- [ ] Both `purchased_by_user_id` and `purchased_by_crew_member_id` provided → 400
- [ ] `tax_amount >= amount` → 400
- [ ] Creating entry with `supplier_id` → `supplier.total_spend` updated
- [ ] Deleting entry with `supplier_id` → `supplier.total_spend` decremented

**List and Filter:**
- [ ] `GET /financial/entries` with `classification=operating_expense` returns only overhead entries
- [ ] `GET /financial/entries` with `date_from` and `date_to` filters correctly
- [ ] Response includes `summary` block with correct totals for full result set (not just current page)
- [ ] `search` parameter matches against `vendor_name` and `notes`

**Export:**
- [ ] `GET /financial/entries/export` returns CSV with correct headers
- [ ] Result set > 10,000 rows returns 400
- [ ] Employee cannot access export endpoint — 403

**Routing:**
- [ ] `GET /financial/entries/pending` does not conflict with `GET /financial/entries/:id`
- [ ] `GET /financial/entries/export` does not conflict with `GET /financial/entries/:id`

**Tests:**
- [ ] Unit tests for all new service methods
- [ ] Unit test: Employee submission_status override
- [ ] Unit test: mutual exclusion of purchased_by fields
- [ ] Unit test: payment method auto-copy
- [ ] Integration test: full pending → approve flow
- [ ] Integration test: full pending → reject → resubmit → approve flow
- [ ] Tenant isolation: entry from tenant A not visible to tenant B in any query
- [ ] RBAC tests for all role/operation combinations in the matrix

**Documentation:**
- [ ] `api/documentation/financial_REST_API.md` updated with all new and changed endpoints
- [ ] Role-based behavior matrix documented in API docs
- [ ] Rejection/resubmit flow documented with sequence diagram (text-based in docs is acceptable)

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `GET /financial/entries/pending` and `GET /financial/entries/export` routing conflicts with `:id` param | High — silent wrong behavior | High — this is a known NestJS trap | Explicitly document controller route registration order. Both static routes MUST be declared before the `/:id` parameterized route. |
| `userRole` extraction from JWT — role hierarchy (user may have multiple roles) | Medium — wrong role applied | Medium — RBAC system uses role arrays | Define role priority rule: Owner > Admin > Manager > Bookkeeper > Employee. Use highest-priority role for submission_status defaulting. |
| `supplier.total_spend` drift under concurrent creates | Low | Low | Documented as known denormalization tradeoff. Statistics endpoint always recomputes from raw data. |
| Rejection fields not in F-01 migration | Medium — requires addendum migration | Confirmed | F-04 contract explicitly documents the 3 new fields and provides migration name. Agent must create this migration before implementing the reject flow. |

---

## Dependencies

### Requires (must be complete)
- F-01 — all stub fields on `financial_entry` must exist
- F-02 — `supplier` table and FK must exist, `SupplierService.updateSpendTotals()` must be exported
- F-03 — `payment_method_registry` table and FK must exist, `PaymentMethodRegistryService.findDefault()` must be exported

### Blocks
- F-05 — receipt OCR hooks into the entry create flow
- F-07 — project financial summary uses enriched entry data
- F-09 — business dashboard aggregates from confirmed entries

---

## File Change Summary

### Files Created
- `api/src/modules/financial/dto/list-financial-entries-query.dto.ts` — full updated query DTO
- `api/src/modules/financial/dto/approve-entry.dto.ts`
- `api/src/modules/financial/dto/reject-entry.dto.ts`
- `api/src/modules/financial/dto/resubmit-entry.dto.ts`
- `api/prisma/migrations/[timestamp]_financial_entry_rejection_fields/migration.sql` — if rejection fields not added in F-01

### Files Modified
- `api/src/modules/financial/services/financial-entry.service.ts` — full rebuild of all methods + new methods
- `api/src/modules/financial/controllers/financial-entry.controller.ts` — add new routes, enforce routing order
- `api/src/modules/financial/dto/create-financial-entry.dto.ts` — finalize all optional fields from F-01
- `api/src/modules/financial/dto/update-financial-entry.dto.ts` — add new editable fields
- `api/src/modules/financial/dto/list-financial-entries.dto.ts` — add new filter params
- `api/prisma/schema.prisma` — rejection fields if not already added
- `api/documentation/financial_REST_API.md` — full update

### Files That Must NOT Be Modified
- Any file in `api/src/modules/quotes/`
- Any file in `api/src/modules/projects/`
- `api/src/modules/financial/services/crew-payment.service.ts`
- `api/src/modules/financial/services/subcontractor-payment.service.ts`
- Any frontend file

---

## Notes for Executing Agent

1. Read the current `financial-entry.service.ts` and `financial-entry.controller.ts` in full before making any changes. Understand all existing logic before modifying. Do not delete existing functionality — extend it.
2. The role hierarchy for `submission_status` defaulting is: Owner > Admin > Manager > Bookkeeper > Employee. If a user has multiple roles, use the highest one.
3. The `GET /financial/entries/pending` and `GET /financial/entries/export` routes MUST be registered in the controller BEFORE the `GET /financial/entries/:id` route. This is not optional — NestJS route matching is order-dependent and parameterized routes will capture static paths if registered first.
4. The CSV export should use a streaming or buffer approach — do not load 10,000 records into memory as full Prisma objects. Use `select` to fetch only the columns needed for the CSV output.
5. `SupplierService.updateSpendTotals()` is called after the entry is persisted — not inside the same Prisma transaction. This is an acceptable eventual-consistency tradeoff for the denormalized `total_spend` field.
6. Produce 100% API documentation. The role-based behavior matrix must be included in the documentation — not just the endpoint specs.