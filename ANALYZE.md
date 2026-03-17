# Codebase Audit Report

**Date**: 2026-03-16
**Purpose**: Pre-sprint audit for Sprint 04 (Subcontractor API)
**Scope**: 8 targeted audits across Prisma schema, services, and controllers

---

## AUDIT 1 — payment_method enum

**File**: `api/prisma/schema.prisma` (line 3209)

```prisma
enum payment_method {
  cash
  check
  bank_transfer
  venmo
  zelle
}
```

**Total values**: 5

---

## AUDIT 2 — financial_entry fields

**File**: `api/prisma/schema.prisma` (line 3418)

| Field | Type | Required/Optional |
|-------|------|-------------------|
| `id` | `String @id @default(uuid()) @db.VarChar(36)` | Required (auto-generated) |
| `tenant_id` | `String @db.VarChar(36)` | Required |
| `project_id` | `String @db.VarChar(36)` | **Required** (NOT nullable) |
| `task_id` | `String? @db.VarChar(36)` | Optional |
| `category_id` | `String @db.VarChar(36)` | Required |
| `entry_type` | `financial_entry_type @default(expense)` | Required (defaulted) |
| `amount` | `Decimal @db.Decimal(12, 2)` | Required |
| `entry_date` | `DateTime @db.Date` | Required |
| `vendor_name` | `String? @db.VarChar(200)` | Optional |
| `crew_member_id` | `String? @db.VarChar(36)` | Optional |
| `subcontractor_id` | `String? @db.VarChar(36)` | Optional |
| `notes` | `String? @db.Text` | Optional |
| `has_receipt` | `Boolean @default(false)` | Required (defaulted) |
| `created_by_user_id` | `String @db.VarChar(36)` | Required |
| `updated_by_user_id` | `String? @db.VarChar(36)` | Optional |
| `created_at` | `DateTime @default(now())` | Required (auto) |
| `updated_at` | `DateTime @updatedAt` | Required (auto) |

**Total fields**: 17

**Confirmation**: `project_id` is **required** (not nullable). There is no `?` suffix — it is `String @db.VarChar(36)`, not `String?`.

**Relations**:
- `tenant` → `tenant` (Cascade)
- `category` → `financial_category` (Restrict)
- `created_by` → `user` (Restrict)
- `updated_by` → `user?` (SetNull)
- `crew_member` → `crew_member?` (SetNull)
- `subcontractor` → `subcontractor?` (SetNull)
- `project` → `project` (Restrict)
- `receipts` → `receipt[]` (reverse)

**Indexes**:
- `[tenant_id, project_id]`
- `[tenant_id, task_id]`
- `[tenant_id, project_id, category_id]`
- `[tenant_id, entry_date]`
- `[tenant_id, crew_member_id]`
- `[tenant_id, subcontractor_id]`

---

## AUDIT 3 — financial_category_type enum & financial_category model

**File**: `api/prisma/schema.prisma`

### financial_category_type enum (line 3382)

```prisma
enum financial_category_type {
  labor
  material
  subcontractor
  equipment
  other
}
```

**Total values**: 5

### financial_category model (line 3395)

| Field | Type | Required/Optional |
|-------|------|-------------------|
| `id` | `String @id @default(uuid()) @db.VarChar(36)` | Required (auto) |
| `tenant_id` | `String @db.VarChar(36)` | Required |
| `name` | `String @db.VarChar(200)` | Required |
| `type` | `financial_category_type` | Required |
| `description` | `String? @db.Text` | Optional |
| `is_active` | `Boolean @default(true)` | Required (defaulted) |
| `is_system_default` | `Boolean @default(false)` | Required (defaulted) |
| `created_by_user_id` | `String? @db.VarChar(36)` | Optional |
| `created_at` | `DateTime @default(now())` | Required (auto) |
| `updated_at` | `DateTime @updatedAt` | Required (auto) |

**Does a field exist that distinguishes overhead categories from project-cost categories?**

**No.** There is no `classification`, `scope`, or similar field. The only distinguishing field is `type` (which maps to `financial_category_type`: labor, material, subcontractor, equipment, other). There is no overhead vs. project-cost distinction.

---

## AUDIT 4 — vendor.service.ts (quotes module)

**File**: `api/src/modules/quotes/services/vendor.service.ts`

### 1. Database table managed

`vendor` (Prisma model `vendor`)

### 2. Vendor table fields (from Prisma schema, line 2599)

| Field | Type |
|-------|------|
| `id` | `String @id @db.VarChar(36)` |
| `tenant_id` | `String @db.VarChar(36)` |
| `name` | `String @db.VarChar(200)` |
| `email` | `String @db.VarChar(255)` |
| `phone` | `String @db.VarChar(20)` |
| `address_line1` | `String @db.VarChar(255)` |
| `address_line2` | `String? @db.VarChar(255)` |
| `city` | `String @db.VarChar(100)` |
| `state` | `String @db.VarChar(2)` |
| `zip_code` | `String @db.VarChar(10)` |
| `latitude` | `Decimal @db.Decimal(10, 8)` |
| `longitude` | `Decimal @db.Decimal(11, 8)` |
| `google_place_id` | `String? @db.VarChar(255)` |
| `signature_file_id` | `String? @db.VarChar(36)` |
| `is_active` | `Boolean @default(true)` |
| `is_default` | `Boolean @default(false)` |
| `created_by_user_id` | `String? @db.VarChar(36)` |
| `created_at` | `DateTime @default(now())` |
| `updated_at` | `DateTime @updatedAt` |

### 3. Service methods

| Method | Purpose |
|--------|---------|
| `create(tenantId, userId, dto)` | Create a new vendor with Google Maps address validation, email uniqueness check, optional signature file, and is_default handling |
| `findAll(tenantId, filters)` | List vendors with pagination, optional is_active filter, ordered by is_default desc then name asc |
| `findOne(tenantId, vendorId)` | Get single vendor with signature file details, throws NotFoundException if not found |
| `update(tenantId, vendorId, userId, dto)` | Update vendor with email uniqueness recheck, address revalidation, is_default handling, signature update |
| `delete(tenantId, vendorId, userId)` | Hard delete vendor; blocks deletion if vendor is used in any quotes |
| `setDefault(tenantId, vendorId, userId)` | Set vendor as default (unsets all others first) |
| `uploadSignature(tenantId, vendorId, userId, fileId)` | Update vendor's signature_file_id reference (file must already be uploaded via FilesController) |
| `getStatistics(tenantId, vendorId)` | Get quote counts by status for this vendor |

**Total methods**: 8 (not counting private `generateUUID()`)

### 4. Is this vendor concept tied to quotes only, or general-purpose?

The vendor is a **general-purpose company entity** (name, email, phone, address, signature). However, it is currently **only tied to the quotes module**:
- Located in `api/src/modules/quotes/services/vendor.service.ts`
- The `vendor` model's only reverse relation is `quotes quote[]`
- `delete()` checks quote usage before allowing deletion
- `getStatistics()` only counts quotes
- No other module references vendors

---

## AUDIT 5 — ProjectFinancialSummaryController

**File**: `api/src/modules/financial/controllers/project-financial-summary.controller.ts`

### 1. Endpoints

| Method | Path | Roles |
|--------|------|-------|
| `GET` | `/projects/:projectId/financial-summary` | Owner, Admin, Manager |

**Total endpoints**: 1

### 2. Response data

The single endpoint calls `financialEntryService.getProjectCostSummary(tenantId, projectId)` which returns:

```json
{
  "project_id": "uuid",
  "total_actual_cost": 12500.50,
  "cost_by_category": {
    "labor": 5000.00,
    "material": 3000.00,
    "subcontractor": 2500.00,
    "equipment": 1500.50,
    "other": 500.00
  },
  "entry_count": 42
}
```

It fetches all `financial_entry` records for the project, groups amounts by `category.type`, and sums them.

### 3. Obvious gaps

- **No budget/estimated cost comparison**: The `project` model has `estimated_cost` and `contract_value` fields, but the summary does not include them or compute variance.
- **No profit margin calculation**: No comparison of actual cost vs. contract value.
- **No per-task cost breakdown**: Only aggregates at the category-type level, not per project_task.
- **No date-range filtering**: Cannot get cost summary for a specific period.
- **No revenue/income entries**: `entry_type` is hardcoded to `'expense'` in `createEntry()`, so only expenses are tracked.

---

## AUDIT 6 — financial-entry.service.ts

**File**: `api/src/modules/financial/services/financial-entry.service.ts`

### 1. Does create/update allow project_id to be null?

**No.** In `CreateFinancialEntryDto`:
```typescript
@ApiProperty({ description: 'Project ID' })
@IsString()
@IsUUID()
project_id: string;  // Required — no @IsOptional(), no ?
```

In `createEntry()`, `dto.project_id` is passed directly to `data.project_id` — there is no null fallback.

In `UpdateFinancialEntryDto`, `project_id` is **not present** as an updatable field (the update method does not allow changing project_id).

**Conclusion**: `project_id` is always required on creation and cannot be changed after creation.

### 2. Public methods

| Method | Signature |
|--------|-----------|
| `createEntry` | `(tenantId: string, userId: string, dto: CreateFinancialEntryDto)` |
| `getProjectEntries` | `(tenantId: string, query: ListFinancialEntriesDto)` |
| `getTaskEntries` | `(tenantId: string, taskId: string)` |
| `getEntryById` | `(tenantId: string, entryId: string)` |
| `updateEntry` | `(tenantId: string, entryId: string, userId: string, dto: UpdateFinancialEntryDto)` |
| `deleteEntry` | `(tenantId: string, entryId: string, userId: string)` |
| `getProjectCostSummary` | `(tenantId: string, projectId: string)` |
| `getTaskCostSummary` | `(tenantId: string, taskId: string)` |

**Total public methods**: 8

### 3. Existing validation blocking creation without project_id

The DTO's `@IsUUID()` and `@IsString()` validators (via class-validator) will reject the request if `project_id` is missing, null, or not a valid UUID. There is no additional explicit check in the service layer — the DTO validation is the sole guard.

---

## AUDIT 7 — draw-schedule.service.ts

**File**: `api/src/modules/quotes/services/draw-schedule.service.ts`

### 1. Database table(s) managed

`draw_schedule_entry` (Prisma model `draw_schedule_entry`, line 2961)

### 2. draw_schedule_entry fields

| Field | Type |
|-------|------|
| `id` | `String @id @db.VarChar(36)` |
| `quote_id` | `String @db.VarChar(36)` |
| `draw_number` | `Int` |
| `description` | `String @db.VarChar(255)` |
| `calculation_type` | `draw_calculation_type` (enum: `percentage`, `fixed_amount`) |
| `value` | `Decimal @db.Decimal(10, 2)` |
| `order_index` | `Int @default(0)` |
| `created_at` | `DateTime @default(now())` |

**Total fields**: 8

**Relations**: `quote` → `quote` (Cascade on delete)

### 3. Lifecycle/status flow

**There is no status field on `draw_schedule_entry`.** There is no lifecycle or status flow. Draw schedule entries are either present or deleted — they have no state machine (no draft/pending/paid/invoiced statuses).

The `draw_calculation_type` enum provides only the calculation method:
```prisma
enum draw_calculation_type {
  percentage
  fixed_amount
}
```

### 4. Link between draw schedules and invoice generation

**No.** There is no link to invoice generation. Confirmed:
- No `invoice_id` field on `draw_schedule_entry`
- No `invoice` model referenced in the draw schedule service
- No method in `DrawScheduleService` that creates, references, or triggers invoices
- The service only has: `create()`, `findByQuote()`, `update()`, `delete()`

---

## AUDIT 8 — Sprint 7 / Project Module completion check

### 1. Does quote.service.ts contain a method that creates a project when a quote is accepted?

**No.** Searched for `accept`, `createProject`, `convert` (case-insensitive) in `api/src/modules/quotes/services/quote.service.ts`:

- **No `accept` method** found
- **No `createProject` method** found
- The `updateStatus()` method handles "won" statuses (`approved`, `started`, `concluded`) but only converts the lead status to `'customer'` — it does **not** create a project

The relevant code (line 887-931):
```typescript
const wonStatuses = ['approved', 'started', 'concluded'];
// Convert to customer when quote is won
if (wonStatuses.includes(dto.status)) {
  await this.leadsService.updateStatus(tenantId, quote.lead_id, userId, { status: 'customer' });
}
```

**However**, project creation from quote exists in the **projects module**: `api/src/modules/projects/services/project.service.ts` has `createFromQuote(tenantId, userId, quoteId, dto)` which:
- Validates quote status (must be approved/started/concluded)
- Generates project number
- Creates project record with contract_value from quote.total
- Locks quote (deletion_locked = true)
- Updates lead status to 'customer'
- Seeds project tasks from quote items
- Optionally applies template tasks
- Creates portal account for the lead

### 2. Does api/src/modules/projects/ exist?

**Yes.** Contains 90+ files including:
- **DTOs**: create-project.dto.ts, create-project-from-quote.dto.ts, update-project.dto.ts, create-project-task.dto.ts, update-project-task.dto.ts, create-subcontractor.dto.ts, update-subcontractor.dto.ts, create-crew-member.dto.ts, update-crew-member.dto.ts, create-permit.dto.ts, update-permit.dto.ts, create-inspection.dto.ts, update-inspection.dto.ts, create-checklist-template.dto.ts, start-completion.dto.ts, add-punch-list-item.dto.ts, create-task-cost-entry.dto.ts, create-task-crew-hour.dto.ts, dashboard-query.dto.ts, and more
- **Services**: project.service.ts, project-task.service.ts, subcontractor.service.ts, crew-member.service.ts, permit.service.ts, inspection.service.ts, project-document.service.ts, project-photo.service.ts, project-log.service.ts, project-activity.service.ts, project-completion.service.ts, task-financial.service.ts, task-crew-hour.service.ts, task-dependency.service.ts, task-assignment.service.ts, task-communication.service.ts, task-calendar-event.service.ts, checklist-template.service.ts, project-number-generator.service.ts, project-dashboard.service.ts, gantt-data.service.ts
- **Controllers**: project.controller.ts, project-task.controller.ts, subcontractor.controller.ts, crew-member.controller.ts, permit.controller.ts, inspection.controller.ts, project-document.controller.ts, project-photo.controller.ts, project-log.controller.ts, project-completion.controller.ts, task-financial.controller.ts, task-crew-hour.controller.ts, checklist-template.controller.ts, project-dashboard.controller.ts
- **Processors**: insurance-expiry-check.processor.ts, task-delay-check.processor.ts
- **Schedulers**: insurance-expiry-check.scheduler.ts
- **Spec files**: 15+ test files

### 3. Does the project model exist in schema.prisma?

**Yes.** Found at line 3528. Fields:

| Field | Type | Required/Optional |
|-------|------|-------------------|
| `id` | `String @id @default(uuid()) @db.VarChar(36)` | Required (auto) |
| `tenant_id` | `String @db.VarChar(36)` | Required |
| `quote_id` | `String? @db.VarChar(36)` | Optional |
| `lead_id` | `String? @db.VarChar(36)` | Optional |
| `project_number` | `String @db.VarChar(50)` | Required |
| `name` | `String @db.VarChar(200)` | Required |
| `description` | `String? @db.Text` | Optional |
| `status` | `project_status @default(planned)` | Required (defaulted) |
| `start_date` | `DateTime? @db.Date` | Optional |
| `target_completion_date` | `DateTime? @db.Date` | Optional |
| `actual_completion_date` | `DateTime? @db.Date` | Optional |
| `permit_required` | `Boolean @default(false)` | Required (defaulted) |
| `assigned_pm_user_id` | `String? @db.VarChar(36)` | Optional |
| `contract_value` | `Decimal? @db.Decimal(12, 2)` | Optional |
| `estimated_cost` | `Decimal? @db.Decimal(12, 2)` | Optional |
| `progress_percent` | `Decimal @default(0.00) @db.Decimal(5, 2)` | Required (defaulted) |
| `is_standalone` | `Boolean @default(false)` | Required (defaulted) |
| `portal_enabled` | `Boolean @default(true)` | Required (defaulted) |
| `deletion_locked` | `Boolean @default(false)` | Required (defaulted) |
| `notes` | `String? @db.Text` | Optional |
| `created_by_user_id` | `String @db.VarChar(36)` | Required |
| `created_at` | `DateTime @default(now())` | Required (auto) |
| `updated_at` | `DateTime @updatedAt` | Required (auto) |

**Total fields**: 23

**Reverse relations** (children): financial_entries, tasks, project_activities, project_documents, project_photos, receipts, project_logs, task_calendar_events, permits, inspections, completion_checklists, punch_list_items, crew_payment_records, crew_hour_logs, subcontractor_payment_records, subcontractor_task_invoices

### 4. Is there a POST /quotes/:id/accept endpoint?

**No.** Searched all files in `api/src/modules/quotes/controllers/` for `accept`. No `POST /quotes/:id/accept` endpoint exists in any quotes controller.

The closest related functionality is:
- `PATCH /quotes/:id/status` in quote.controller.ts (updates status to approved/started/concluded, which triggers lead→customer conversion)
- `createFromQuote()` in `api/src/modules/projects/services/project.service.ts` (creates a project from an approved quote, called from the projects module, not quotes)

---

## End of Audit Report
