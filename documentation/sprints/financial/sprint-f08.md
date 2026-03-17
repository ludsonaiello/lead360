# Sprint F-08 — Draw Schedule → Invoice Automation

**Module**: Financial  
**Sprint**: F-08  
**Status**: Ready for Development  
**Type**: New Feature — New Tables + Cross-Module Bridge  
**Estimated Complexity**: High  
**Prerequisites**:
- Sprint F-01 must be complete
- Sprint F-04 must be complete
- Project Management Module backend must be complete (project and quote records must exist)

---

## Purpose

A draw schedule defines how a project's contract value is billed — typically in milestone-based installments: a deposit before work begins, a progress payment at a defined milestone, and a final payment on completion. The draw schedule already exists in the codebase as a quote-level calculation tool (`draw_schedule_entry` table), but it has no connection to project execution and no connection to invoicing. It is an inert template.

This sprint activates the draw schedule as the billing engine for projects. It accomplishes three things:

**1. Defines the invoice data model.** The Invoicing Module (TODO Sprint 9) is not yet built. F-08 creates the `project_invoice` table — the foundation of customer billing. This is not the full invoicing module (which will handle PDF generation, email delivery, credits, and the invoice cap rule) — it is the schema and basic CRUD that draw schedule automation requires to function.

**2. Links draw schedules to projects.** When a quote is accepted and a project is created, the quote's draw schedule entries are copied to the project as `project_draw_milestone` records with a lifecycle (pending → invoiced → paid). They are no longer inert — they track billing status.

**3. Automates invoice generation from milestones.** When a project milestone is manually triggered (a PM marks a milestone as ready to invoice), the system generates a `project_invoice` record pre-populated from the milestone's amount and description. This closes the loop: estimate → quote → draw schedule → project milestone → invoice.

**Scope boundary:** Full invoice lifecycle (PDF generation, email delivery, customer portal, credits, invoice cap enforcement, payment recording) is deferred to TODO Sprint 9. This sprint creates the foundation — the data model and the draw-schedule-to-invoice bridge — so that Sprint 9 can build on top of it rather than starting from zero.

---

## Scope

### In Scope

- New `project_draw_milestone` table — project-scoped copy of draw schedule entries with lifecycle tracking
- New `project_invoice` table — foundational invoice record (amount, status, project link, milestone link)
- New `project_invoice_payment` table — basic payment recording against an invoice (amount, date, method)
- Migration of draw schedule entries to project milestones on project creation (service-level — no schema change to quotes module)
- Full CRUD for `project_draw_milestone`
- Full CRUD for `project_invoice`
- Invoice generation endpoint: create invoice from milestone
- Payment recording endpoint: record payment against invoice
- Invoice status lifecycle: `draft` → `sent` → `partial` → `paid` → `voided`
- Milestone status lifecycle: `pending` → `invoiced` → `paid`
- Update `ProjectFinancialSummaryService` in F-07 with revenue data — add invoiced/collected totals now that the tables exist (addendum to F-07 summary endpoint)
- 100% API documentation
- Full test coverage

### Out of Scope

- No PDF generation for invoices (Sprint 9)
- No email delivery of invoices (Sprint 9)
- No customer portal invoice view (Sprint 9)
- No invoice cap enforcement rule (Sprint 9) — the cap rule requires change orders to be wired in; this sprint focuses on draw-schedule-based invoicing only
- No credit notes (Sprint 9)
- No changes to `draw_schedule_entry` table in quotes module — that table remains as the quote-level template
- No frontend implementation
- No automatic milestone triggering — milestones are manually triggered by PM action

---

## Platform Architecture Patterns (Mandatory)

- **Tenant isolation**: All tables must include `tenant_id`. All queries must filter by `tenant_id`.
- **TenantId decorator**: `@TenantId()` on all controller methods.
- **AuditLoggerService**: All creates, updates, status transitions, and payments must be audit logged.
- **FilesService**: Not required in this sprint — no file attachments.
- **Cross-module write boundary**: This sprint writes to `project_draw_milestone` when a project is created from a quote. The write must happen inside `ProjectsModule`'s `createFromQuote()` method. The agent must modify `api/src/modules/projects/services/project.service.ts` to call `DrawMilestoneService.seedFromQuote()` after project creation. This is the only permitted modification to the Projects module in this sprint.
- **Migrations**: Run `npx prisma migrate dev --name draw_milestone_invoice_foundation` after all schema additions.

---

## Data Model

### Table 1: `project_draw_milestone`

**Purpose:** Project-level copy of the quote draw schedule, with billing lifecycle tracking. Created when a project is created from a quote. Can also be created manually for standalone projects.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `String @id @default(uuid()) @db.VarChar(36)` | Yes | auto | — |
| `tenant_id` | `String @db.VarChar(36)` | Yes | — | Tenant owner |
| `project_id` | `String @db.VarChar(36)` | Yes | — | FK to project |
| `quote_draw_entry_id` | `String? @db.VarChar(36)` | No | null | FK to source `draw_schedule_entry` — null for manually created milestones |
| `draw_number` | `Int` | Yes | — | Order of this milestone (1, 2, 3...) |
| `description` | `String @db.VarChar(255)` | Yes | — | Milestone description, e.g. "Deposit", "Progress Payment", "Final Payment" |
| `calculation_type` | `draw_calculation_type` | Yes | — | Reuses existing enum: `percentage` or `fixed_amount` |
| `value` | `Decimal @db.Decimal(10, 2)` | Yes | — | The percentage or fixed amount from the original draw schedule |
| `calculated_amount` | `Decimal @db.Decimal(12, 2)` | Yes | — | Resolved dollar amount — computed from `value` and `project.contract_value` at time of milestone creation |
| `status` | `milestone_status` enum | Yes | `pending` | `pending` / `invoiced` / `paid` |
| `invoice_id` | `String? @db.VarChar(36)` | No | null | FK to `project_invoice` — set when invoice is generated from this milestone |
| `invoiced_at` | `DateTime?` | No | null | Timestamp when invoice was generated |
| `paid_at` | `DateTime?` | No | null | Timestamp when milestone was fully paid |
| `notes` | `String? @db.Text` | No | null | Internal notes |
| `created_by_user_id` | `String @db.VarChar(36)` | Yes | — | — |
| `created_at` | `DateTime @default(now())` | Yes | auto | — |
| `updated_at` | `DateTime @updatedAt` | Yes | auto | — |

**Indexes:**
- `@@index([tenant_id, project_id])`
- `@@index([tenant_id, project_id, status])`
- `@@index([tenant_id, status])`
- `@@unique([project_id, draw_number])` — milestone numbers unique per project

**Relations:**
- Belongs to: `project`, `draw_schedule_entry?`, `project_invoice?`
- Has one: `project_invoice` (reverse)

**Business rules:**
- `calculated_amount` is computed at seed time: if `calculation_type = percentage`, `calculated_amount = (value / 100) * project.contract_value`. If `calculation_type = fixed_amount`, `calculated_amount = value`.
- If `project.contract_value` is null at seed time, `calculated_amount` is set to `value` and flagged for manual update.
- A milestone in `invoiced` or `paid` status cannot be deleted.
- A milestone's `calculated_amount` cannot be changed after an invoice has been generated from it.

---

### Table 2: `project_invoice`

**Purpose:** Foundation invoice record. Represents a billing event issued to the project customer.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `String @id @default(uuid()) @db.VarChar(36)` | Yes | auto | — |
| `tenant_id` | `String @db.VarChar(36)` | Yes | — | Tenant owner |
| `project_id` | `String @db.VarChar(36)` | Yes | — | FK to project |
| `invoice_number` | `String @db.VarChar(50)` | Yes | — | Auto-generated sequential number per tenant (e.g., INV-0001) |
| `milestone_id` | `String? @db.VarChar(36)` | No | null | FK to `project_draw_milestone` — null for manually created invoices |
| `description` | `String @db.VarChar(500)` | Yes | — | Invoice line description |
| `amount` | `Decimal @db.Decimal(12, 2)` | Yes | — | Invoice total amount |
| `tax_amount` | `Decimal? @db.Decimal(10, 2)` | No | null | Tax amount if applicable |
| `amount_paid` | `Decimal @default(0.00) @db.Decimal(12, 2)` | Yes | 0.00 | Running total of payments received — updated on each payment |
| `amount_due` | `Decimal @db.Decimal(12, 2)` | Yes | — | `amount + tax_amount - amount_paid` — computed and stored |
| `status` | `invoice_status_extended` enum | Yes | `draft` | `draft` / `sent` / `partial` / `paid` / `voided` |
| `due_date` | `DateTime? @db.Date` | No | null | Optional payment due date |
| `sent_at` | `DateTime?` | No | null | When invoice was marked as sent |
| `paid_at` | `DateTime?` | No | null | When invoice reached `paid` status (fully paid) |
| `voided_at` | `DateTime?` | No | null | When invoice was voided |
| `voided_reason` | `String? @db.VarChar(500)` | No | null | Required when voiding |
| `notes` | `String? @db.Text` | No | null | Internal notes |
| `created_by_user_id` | `String @db.VarChar(36)` | Yes | — | — |
| `updated_by_user_id` | `String? @db.VarChar(36)` | No | null | — |
| `created_at` | `DateTime @default(now())` | Yes | auto | — |
| `updated_at` | `DateTime @updatedAt` | Yes | auto | — |

**Indexes:**
- `@@index([tenant_id, project_id])`
- `@@index([tenant_id, project_id, status])`
- `@@index([tenant_id, status])`
- `@@index([tenant_id, created_at])`
- `@@unique([tenant_id, invoice_number])` — invoice numbers unique per tenant

**Relations:**
- Belongs to: `project`, `project_draw_milestone?`
- Has many: `project_invoice_payment`

**Note on enum name:** The existing `invoice_status` enum on `subcontractor_task_invoice` has values `pending`, `approved`, `paid`. The new enum for `project_invoice` must be named `invoice_status_extended` to avoid collision, with values: `draft`, `sent`, `partial`, `paid`, `voided`.

---

### Table 3: `project_invoice_payment`

**Purpose:** Individual payment recorded against a project invoice.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `String @id @default(uuid()) @db.VarChar(36)` | Yes | auto | — |
| `tenant_id` | `String @db.VarChar(36)` | Yes | — | Tenant owner |
| `invoice_id` | `String @db.VarChar(36)` | Yes | — | FK to `project_invoice` |
| `project_id` | `String @db.VarChar(36)` | Yes | — | Denormalized for query performance |
| `amount` | `Decimal @db.Decimal(12, 2)` | Yes | — | Payment amount — must be > 0 |
| `payment_date` | `DateTime @db.Date` | Yes | — | Date payment was received |
| `payment_method` | `payment_method` | Yes | — | Reuses existing expanded enum from F-01 |
| `payment_method_registry_id` | `String? @db.VarChar(36)` | No | null | FK to `payment_method_registry` — optional named account |
| `reference_number` | `String? @db.VarChar(200)` | No | null | Check number, transaction ID, etc. |
| `notes` | `String? @db.Text` | No | null | — |
| `created_by_user_id` | `String @db.VarChar(36)` | Yes | — | — |
| `created_at` | `DateTime @default(now())` | Yes | auto | — |

**Indexes:**
- `@@index([tenant_id, invoice_id])`
- `@@index([tenant_id, project_id])`
- `@@index([tenant_id, payment_date])`

**Business rules:**
- A payment cannot exceed `invoice.amount_due` at time of recording. Service validates: `payment.amount <= invoice.amount_due`.
- After each payment is recorded, update `invoice.amount_paid` and recompute `invoice.amount_due` within the same Prisma transaction.
- When `invoice.amount_due = 0`, automatically set `invoice.status = paid` and `invoice.paid_at = NOW()`.
- When `invoice.amount_paid > 0` but `amount_due > 0`, set `invoice.status = partial`.
- Payments are immutable — no update or delete once created. If a payment was recorded in error, the invoice can be voided.

---

## Invoice Number Generation

Invoice numbers follow the pattern `INV-{NNNN}` where `NNNN` is a zero-padded sequential integer per tenant, starting at 0001.

A new service `InvoiceNumberGeneratorService` handles this — same pattern as `ProjectNumberGeneratorService` already in the projects module. Read that service before implementing.

The generator must be atomic — use a Prisma transaction with a counter table or a `SELECT MAX + 1` approach with row-level locking to prevent duplicate numbers under concurrent invoice creation.

---

## Draw Schedule Seed Flow

When `ProjectService.createFromQuote()` is called (in `api/src/modules/projects/services/project.service.ts`), after the project record is created, the service must call `DrawMilestoneService.seedFromQuote(tenantId, projectId, quoteId)`.

**`seedFromQuote()` behavior:**
1. Fetch all `draw_schedule_entry` records for the given `quoteId`, ordered by `draw_number`.
2. If the quote has no draw schedule entries, return without creating milestones — standalone projects may not have draw schedules.
3. Fetch `project.contract_value`.
4. For each `draw_schedule_entry`, create a `project_draw_milestone` record:
   - Copy `draw_number`, `description`, `calculation_type`, `value`, `order_index`
   - Set `quote_draw_entry_id = draw_schedule_entry.id`
   - Compute `calculated_amount`:
     - If `calculation_type = percentage`: `(value / 100) * contract_value` — if `contract_value` is null, use `value` as-is and flag with a note
     - If `calculation_type = fixed_amount`: use `value` directly
   - Set `status = pending`
   - Set `project_id = new project id`
   - Set `tenant_id`
   - Set `created_by_user_id = userId` from project creation
5. All milestone records are created in a single Prisma `createMany()` call for efficiency.

**This is the only modification to `api/src/modules/projects/services/project.service.ts`** — a single call to `DrawMilestoneService.seedFromQuote()` inserted after the existing project creation logic. Do not modify any other logic in that method.

---

## API Specification

### Draw Milestone Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| `GET` | `/projects/:projectId/milestones` | List milestones for project | Owner, Admin, Manager, Bookkeeper |
| `POST` | `/projects/:projectId/milestones` | Create milestone manually | Owner, Admin, Manager |
| `PATCH` | `/projects/:projectId/milestones/:id` | Update milestone | Owner, Admin, Manager |
| `DELETE` | `/projects/:projectId/milestones/:id` | Delete pending milestone | Owner, Admin |
| `POST` | `/projects/:projectId/milestones/:id/invoice` | Generate invoice from milestone | Owner, Admin, Manager |

---

#### `GET /projects/:projectId/milestones`

**Response:**
```
[
  {
    id
    draw_number
    description
    calculation_type
    value
    calculated_amount
    status                — pending | invoiced | paid
    invoice_id            — null if not yet invoiced
    invoice_number        — joined if invoice exists
    invoiced_at
    paid_at
    notes
    created_at
  }
]
```

Ordered by `draw_number ASC`.

---

#### `POST /projects/:projectId/milestones`

For standalone projects without a quote draw schedule — allows manual milestone creation.

**Request body:**
```
draw_number           integer   required    must not conflict with existing draw_number on this project
description           string    required    max 255 chars
calculation_type      enum      required    percentage | fixed_amount
value                 decimal   required    > 0; if percentage: 1–100
calculated_amount     decimal   optional    if not provided, computed from value and project.contract_value
notes                 string    optional
```

**Errors:**
- 409 Conflict — `draw_number` already exists for this project
- 400 — percentage value > 100

---

#### `PATCH /projects/:projectId/milestones/:id`

**Not editable:** `status`, `invoice_id`, `invoiced_at`, `paid_at`, `draw_number` (immutable after creation), `calculated_amount` (if invoice already generated).

**Editable:** `description`, `notes`, `calculated_amount` (only if `status = pending`), `due_date`.

**Errors:**
- 404 — not found
- 400 — attempt to edit `calculated_amount` on invoiced milestone

---

#### `DELETE /projects/:projectId/milestones/:id`

**Restriction:** Only `pending` milestones can be deleted. Milestones with `status = invoiced` or `paid` cannot be deleted.

**Errors:**
- 400 — milestone is not in pending status

---

#### `POST /projects/:projectId/milestones/:id/invoice`

**Purpose:** Generate a `project_invoice` from a milestone. This is the core automation action.

**Roles:** Owner, Admin, Manager.

**Request body:**
```
description     string    optional    defaults to milestone.description if not provided
due_date        date      optional
tax_amount      decimal   optional
notes           string    optional
```

**Service behavior:**
1. Verify milestone belongs to project and tenant.
2. Verify `milestone.status = pending` — throw 400 if already invoiced.
3. Generate invoice number via `InvoiceNumberGeneratorService`.
4. Create `project_invoice` record with:
   - `amount = milestone.calculated_amount`
   - `description` from request or milestone
   - `status = draft`
   - `milestone_id = milestone.id`
   - `project_id`
   - `tenant_id`
5. Update milestone within same transaction:
   - `status = invoiced`
   - `invoice_id = new invoice id`
   - `invoiced_at = NOW()`
6. Audit log the invoice generation.

**Response:** 201 Created — the created `project_invoice` object with milestone reference.

**Errors:**
- 404 — milestone not found
- 400 — milestone already invoiced

---

### Project Invoice Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| `GET` | `/projects/:projectId/invoices` | List invoices for project | Owner, Admin, Manager, Bookkeeper |
| `POST` | `/projects/:projectId/invoices` | Create invoice manually | Owner, Admin, Manager |
| `GET` | `/projects/:projectId/invoices/:id` | Get single invoice | Owner, Admin, Manager, Bookkeeper |
| `PATCH` | `/projects/:projectId/invoices/:id` | Update draft invoice | Owner, Admin, Manager |
| `POST` | `/projects/:projectId/invoices/:id/send` | Mark invoice as sent | Owner, Admin, Manager |
| `POST` | `/projects/:projectId/invoices/:id/void` | Void invoice | Owner, Admin |
| `POST` | `/projects/:projectId/invoices/:id/payments` | Record payment | Owner, Admin, Manager, Bookkeeper |
| `GET` | `/projects/:projectId/invoices/:id/payments` | List payments for invoice | Owner, Admin, Manager, Bookkeeper |

---

#### `GET /projects/:projectId/invoices`

**Query parameters:**
- `status` — `invoice_status_extended` enum, optional.
- `date_from` / `date_to` — filter by `created_at`.

**Response:** Array of invoice objects:
```
[
  {
    id
    invoice_number
    milestone_id          — null if manually created
    milestone_description — joined if milestone exists
    description
    amount
    tax_amount
    amount_paid
    amount_due
    status
    due_date
    sent_at
    paid_at
    voided_at
    payment_count         — count of payment records
    created_at
  }
]
```

---

#### `POST /projects/:projectId/invoices`

Manual invoice creation (not from a milestone).

**Request body:**
```
description     string    required
amount          decimal   required    > 0
tax_amount      decimal   optional
due_date        date      optional
notes           string    optional
```

**Response:** 201 Created — invoice object with `status = draft`.

---

#### `PATCH /projects/:projectId/invoices/:id`

Only `draft` invoices are editable.

**Editable:** `description`, `amount`, `tax_amount`, `due_date`, `notes`.

**Restriction:** Once `status = sent`, `partial`, or `paid`, the invoice is locked. Only `voided_reason` can be set via the void endpoint.

**Errors:**
- 400 — invoice is not in draft status

---

#### `POST /projects/:projectId/invoices/:id/send`

Marks invoice as sent. Transitions `status: draft → sent`. Sets `sent_at = NOW()`.

**No request body.**

**Errors:**
- 400 — invoice is already sent, paid, or voided

---

#### `POST /projects/:projectId/invoices/:id/void`

**Request body:**
```
voided_reason   string   required   max 500 chars
```

**Behavior:**
1. Set `status = voided`, `voided_at = NOW()`, `voided_reason`.
2. If the invoice was linked to a milestone (`milestone_id` not null), reset the milestone:
   - Set `milestone.status = pending`
   - Set `milestone.invoice_id = null`
   - Set `milestone.invoiced_at = null`
   This allows the milestone to be re-invoiced after voiding.
3. Payments already recorded against this invoice are NOT reversed — they remain in the system. The business owner must manually handle refunds.

**Errors:**
- 400 — invoice is already voided
- 400 — `voided_reason` missing or empty

---

#### `POST /projects/:projectId/invoices/:id/payments`

**Request body:**
```
amount                        decimal   required    must be > 0 and <= invoice.amount_due
payment_date                  date      required
payment_method                enum      required
payment_method_registry_id    UUID      optional
reference_number              string    optional
notes                         string    optional
```

**Service behavior:**
1. Validate `amount <= invoice.amount_due` — throw 400 if overpayment.
2. Create `project_invoice_payment` record.
3. Within same Prisma transaction:
   - Increment `invoice.amount_paid += payment.amount`
   - Recompute `invoice.amount_due = invoice.amount + invoice.tax_amount - invoice.amount_paid`
   - If `invoice.amount_due = 0`: set `status = paid`, `paid_at = NOW()`
   - Else if `invoice.amount_paid > 0`: set `status = partial`
4. If `invoice.status = paid` AND `invoice.milestone_id` is set: update milestone `status = paid`, `paid_at = NOW()`.

**Response:** 201 Created — the payment record.

**Errors:**
- 400 — payment amount exceeds amount due
- 400 — invoice is voided

---

#### `GET /projects/:projectId/invoices/:id/payments`

**Response:** List of payment records for this invoice, ordered by `payment_date ASC`.

---

## F-07 Summary Addendum

Now that `project_invoice` and `project_invoice_payment` tables exist, the `ProjectFinancialSummaryService.getFullSummary()` method from F-07 must be updated to include revenue-side data. The `revenue_note` field is replaced with actual data.

**Add to the `summary` response:**

```
revenue: {
  total_invoiced      decimal   — sum of project_invoice.amount where status != voided
  total_collected     decimal   — sum of project_invoice.amount_paid where status != voided
  outstanding         decimal   — total_invoiced - total_collected
  invoice_count       integer   — count of non-voided invoices
  paid_invoices       integer
  partial_invoices    integer
  draft_invoices      integer
}

margin_analysis additions:
  gross_margin        decimal | null   — contract_value - total_collected (realized revenue)
  billing_coverage    decimal | null   — (total_invoiced / contract_value) * 100
```

Remove the `revenue_note` static string from the summary response — it is no longer needed.

**This addendum modifies `project-financial-summary.service.ts` from F-07.** The agent must add the revenue aggregation queries to `getFullSummary()` using `Promise.all()` alongside the existing cost queries.

---

## Service Architecture

### New Services

**`DrawMilestoneService`**
| Method | Signature | Notes |
|--------|-----------|-------|
| `seedFromQuote` | `(tenantId, projectId, quoteId, userId)` | Called by ProjectService on project creation |
| `findByProject` | `(tenantId, projectId)` | List all milestones |
| `create` | `(tenantId, projectId, userId, dto)` | Manual milestone creation |
| `update` | `(tenantId, projectId, milestoneId, userId, dto)` | With status guard |
| `delete` | `(tenantId, projectId, milestoneId, userId)` | Pending only |
| `generateInvoice` | `(tenantId, projectId, milestoneId, userId, dto)` | Core automation action |

**`ProjectInvoiceService`**
| Method | Signature | Notes |
|--------|-----------|-------|
| `create` | `(tenantId, projectId, userId, dto)` | Manual invoice |
| `findByProject` | `(tenantId, projectId, query)` | Filtered list |
| `findOne` | `(tenantId, projectId, invoiceId)` | With payments |
| `update` | `(tenantId, projectId, invoiceId, userId, dto)` | Draft only |
| `markSent` | `(tenantId, projectId, invoiceId, userId)` | Status transition |
| `void` | `(tenantId, projectId, invoiceId, userId, dto)` | With milestone reset |
| `recordPayment` | `(tenantId, projectId, invoiceId, userId, dto)` | Atomic with invoice update |
| `getPayments` | `(tenantId, projectId, invoiceId)` | Payment list |

**`InvoiceNumberGeneratorService`**
Single method: `generate(tenantId)` — returns next sequential invoice number string.

---

## Business Rules Summary

1. A milestone in `invoiced` or `paid` status cannot be deleted.
2. A milestone's `calculated_amount` is locked once an invoice has been generated from it.
3. Only one invoice can be generated per milestone. The `invoice` endpoint returns 400 if milestone is not `pending`.
4. Voiding an invoice resets its linked milestone to `pending` — the milestone can be re-invoiced.
5. Invoice payments are immutable — recorded in error requires voiding the invoice.
6. A payment cannot exceed `invoice.amount_due` at time of recording.
7. When a payment brings `amount_due` to zero, invoice automatically transitions to `paid` and the linked milestone (if any) transitions to `paid`.
8. Invoice numbers are sequential per tenant, never reused, never skipped.
9. Only `draft` invoices are editable via PATCH.
10. Milestones seeded from a quote draw schedule carry `quote_draw_entry_id` for traceability.
11. Standalone projects (no quote) can have milestones created manually.
12. All draw schedule milestone amounts are computed at seed time using the project's `contract_value` — not recalculated dynamically. If `contract_value` changes later, milestones are not automatically updated.

---

## Acceptance Criteria

**Schema:**
- [ ] `project_draw_milestone` table exists with all fields
- [ ] `project_invoice` table exists with `invoice_status_extended` enum
- [ ] `project_invoice_payment` table exists
- [ ] `invoice_status_extended` enum does not collide with existing `invoice_status` enum
- [ ] Migration runs cleanly

**Draw Milestone Seeding:**
- [ ] Creating project from quote seeds milestones from draw schedule entries
- [ ] Quote with no draw schedule entries creates project with no milestones (no error)
- [ ] `calculated_amount` correct for both `percentage` and `fixed_amount` calculation types
- [ ] `quote_draw_entry_id` set correctly on seeded milestones

**Milestone CRUD:**
- [ ] Manual milestone creation works for standalone projects
- [ ] Duplicate `draw_number` returns 409
- [ ] PATCH blocked on `invoiced` milestone's `calculated_amount`
- [ ] DELETE blocked on `invoiced` milestone

**Invoice Generation:**
- [ ] `POST /milestones/:id/invoice` creates invoice and transitions milestone to `invoiced` atomically
- [ ] Invoice number auto-generated sequentially
- [ ] Second invoice attempt on same milestone returns 400

**Invoice Lifecycle:**
- [ ] `POST /invoices/:id/send` transitions `draft → sent`
- [ ] `POST /invoices/:id/void` transitions to `voided` and resets linked milestone to `pending`
- [ ] Editing non-draft invoice returns 400
- [ ] Voided invoice cannot be voided again

**Payment Recording:**
- [ ] Payment creates record and updates `amount_paid` and `amount_due` atomically
- [ ] Payment exceeding `amount_due` returns 400
- [ ] Full payment transitions invoice to `paid` and milestone to `paid`
- [ ] Partial payment transitions invoice to `partial`
- [ ] Payment on voided invoice returns 400

**F-07 Addendum:**
- [ ] `getFullSummary` includes `revenue` block with correct aggregations
- [ ] `revenue_note` field removed from summary response
- [ ] Voided invoices excluded from revenue totals

**Tests:**
- [ ] Unit test: `seedFromQuote` — percentage calculation correct
- [ ] Unit test: `seedFromQuote` — null contract_value handling
- [ ] Unit test: payment atomicity — invoice update rolls back if payment creation fails
- [ ] Unit test: void — milestone reset to pending
- [ ] Unit test: full payment — invoice + milestone both transition to paid
- [ ] Integration test: project creation from quote with draw schedule
- [ ] Integration test: full billing cycle — milestone → invoice → send → payment → paid
- [ ] Tenant isolation: cannot access another tenant's invoices

**Documentation:**
- [ ] `api/documentation/financial_REST_API.md` updated with all new endpoints
- [ ] Invoice number generation strategy documented
- [ ] Draw schedule seed flow documented
- [ ] Known deferred items documented: PDF, email, cap enforcement, credits

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| `invoice_status_extended` enum conflicts with existing `invoice_status` enum in schema | High — migration fails | Confirmed risk | Use distinct name. Agent must search schema for existing `invoice_status` before naming. |
| `ProjectService.createFromQuote()` is complex — modification risk | Medium — breaks project creation | Medium | The only change is adding one method call after existing logic. Agent reads the full method before touching it and adds the call at the very end of the success path. |
| Invoice number generation race condition under concurrent invoice creation | Medium — duplicate numbers | Low — single-server deployment | Use atomic counter approach. Read `project-number-generator.service.ts` for the existing pattern. |
| `calculated_amount` computed from `contract_value` that may be null | Low — zero amounts on milestones | Low — most projects have contract values | Handle null case explicitly: use raw `value` and add a note. Never crash or skip milestone creation. |

---

## Dependencies

### Requires (must be complete)
- F-01 — `payment_method` enum expansion for invoice payments
- F-03 — `payment_method_registry` for payment recording
- F-07 — `ProjectFinancialSummaryService` must exist to receive the F-07 addendum

### Blocks
- F-09 — Business dashboard uses invoice/payment aggregations for AR summary

### Future Sprint 9 (Invoicing Module) will add on top of this foundation
- PDF invoice generation
- Email delivery
- Customer portal invoice view
- Credits and credit notes
- Invoice cap enforcement (quote total + change orders − credits)
- Bulk invoice operations

---

## File Change Summary

### Files Created
- `api/src/modules/financial/services/draw-milestone.service.ts`
- `api/src/modules/financial/services/project-invoice.service.ts`
- `api/src/modules/financial/services/invoice-number-generator.service.ts`
- `api/src/modules/financial/controllers/draw-milestone.controller.ts`
- `api/src/modules/financial/controllers/project-invoice.controller.ts`
- `api/src/modules/financial/dto/create-draw-milestone.dto.ts`
- `api/src/modules/financial/dto/update-draw-milestone.dto.ts`
- `api/src/modules/financial/dto/create-project-invoice.dto.ts`
- `api/src/modules/financial/dto/update-project-invoice.dto.ts`
- `api/src/modules/financial/dto/record-invoice-payment.dto.ts`
- `api/src/modules/financial/dto/void-invoice.dto.ts`
- `api/prisma/migrations/[timestamp]_draw_milestone_invoice_foundation/migration.sql`

### Files Modified
- `api/prisma/schema.prisma` — 3 new tables, 1 new enum
- `api/src/modules/financial/financial.module.ts` — register new services and controllers
- `api/src/modules/financial/services/project-financial-summary.service.ts` — F-07 addendum: add revenue block
- `api/src/modules/projects/services/project.service.ts` — add `DrawMilestoneService.seedFromQuote()` call after project creation (**only permitted modification to projects module**)
- `api/src/modules/projects/projects.module.ts` — export or import as needed to make `DrawMilestoneService` injectable in project.service.ts
- `api/documentation/financial_REST_API.md` — add all new endpoints

### Files That Must NOT Be Modified
- Any other file in `api/src/modules/projects/` beyond the two listed above
- Any file in `api/src/modules/quotes/`
- `api/src/modules/financial/services/financial-entry.service.ts`
- Any frontend file

---

## Notes for Executing Agent

1. Read `api/src/modules/projects/services/project-number-generator.service.ts` before writing `InvoiceNumberGeneratorService`. Replicate the same sequential generation pattern — including the atomic locking approach.

2. Read `api/src/modules/projects/services/project.service.ts` `createFromQuote()` method in full before modifying it. Understand its complete flow. The `DrawMilestoneService.seedFromQuote()` call goes at the end of the success path, after the project record is confirmed created. If `createFromQuote()` uses a Prisma transaction internally, the seed call must be inside the same transaction to maintain atomicity.

3. The `invoice_status_extended` enum — before naming, search `api/prisma/schema.prisma` for the string `invoice_status` to confirm the exact name of the existing enum on `subcontractor_task_invoice`. Use a name that cannot be confused with it.

4. The `POST /projects/:projectId/invoices/:id/payments` endpoint has a strict atomicity requirement: payment record creation and invoice `amount_paid`/`amount_due`/`status` update must be in a single Prisma transaction. If either fails, both roll back.

5. The `void` endpoint resets the linked milestone to `pending`. This is the critical behavior that allows re-invoicing. Test this path explicitly.

6. Produce 100% API documentation before marking the sprint complete. Include the deferred items section to set expectations for Sprint 9.