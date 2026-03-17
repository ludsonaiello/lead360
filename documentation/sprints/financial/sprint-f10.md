# Sprint F-10 — QuickBooks/Xero Export Readiness

**Module**: Financial  
**Sprint**: F-10  
**Status**: Ready for Development  
**Type**: New Feature — Export Layer + Data Validation  
**Estimated Complexity**: Medium  
**Prerequisites**:
- All preceding Financial Module sprints (F-01 through F-09) must be complete
- All financial data must be in its final structured form before export mappings are defined

---

## Purpose

Service businesses that use Lead360 still need their accountant to file taxes, reconcile books, and produce financial statements. Their accountant uses QuickBooks Online or Xero. Today there is no path from Lead360 to those tools — the business owner exports nothing, the accountant works from bank statements and receipts in a shoebox, and Lead360's financial data is an island.

F-10 builds the export bridge. It does not integrate with the QuickBooks or Xero APIs directly — that is a future sprint requiring OAuth flows and vendor approval processes. Instead, F-10 produces structured export files that match QuickBooks and Xero import formats exactly. The business owner downloads the file from Lead360, logs into QuickBooks, and imports it with one click. Zero manual re-entry.

F-10 also performs a data quality audit — it identifies any financial records in the system that are incomplete or ambiguous in ways that would cause an import to fail. The accountant gets clean data or a report of what needs fixing before export.

Three deliverables:

1. **QuickBooks Online CSV export** — expense transactions in QB's standard import format
2. **Xero CSV export** — expense transactions in Xero's standard import format
3. **Data quality report** — flags entries missing required fields for either format

---

## Scope

### In Scope

- QuickBooks Online CSV export for `financial_entry` records (expenses and income entries)
- Xero CSV export for `financial_entry` records
- QuickBooks Online CSV export for `project_invoice` records (as QB Sales Receipts)
- Xero CSV export for `project_invoice` records
- Chart of Accounts mapping: Lead360 `financial_category` → QuickBooks/Xero account names
- Tenant-configurable account name mappings (override defaults per category)
- Data quality report endpoint: flags entries missing fields required for clean export
- All exports filterable by date range, category, classification, project
- Export history log: records of what was exported and when (for accountant handoff tracking)
- 100% API documentation
- Full test coverage

### Out of Scope

- No live QuickBooks or Xero API integration (OAuth, real-time sync) — this is a future sprint
- No import from QuickBooks or Xero into Lead360
- No payroll export (separate module)
- No balance sheet or general ledger export (requires full double-entry bookkeeping — deferred)
- No frontend implementation
- No PDF financial statements

---

## Platform Architecture Patterns (Mandatory)

- **Tenant isolation**: All exports are scoped to `tenant_id`. A tenant can only export their own data.
- **TenantId decorator**: `@TenantId()` on all controller methods.
- **AuditLoggerService**: Every export action must be audit logged with: export type, date range filtered, record count exported, file name, requested by user. This is critical — the accountant and business owner need a record of what was sent when.
- **FilesService**: Not used — exports are generated in memory and streamed directly to the response. Do not store export files on disk.
- **No migrations**: One small new table for export history. All other data comes from existing tables.

---

## Data Model

### Table: `financial_export_log`

**Purpose:** Immutable record of every export performed. Provides accountability for what data was shared with the accountant and when.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `String @id @default(uuid()) @db.VarChar(36)` | Yes | auto | — |
| `tenant_id` | `String @db.VarChar(36)` | Yes | — | Tenant owner |
| `export_type` | `export_type` enum | Yes | — | `quickbooks_expenses` / `quickbooks_invoices` / `xero_expenses` / `xero_invoices` / `pl_csv` / `entries_csv` |
| `date_from` | `DateTime? @db.Date` | No | null | Filter applied |
| `date_to` | `DateTime? @db.Date` | No | null | Filter applied |
| `record_count` | `Int` | Yes | — | Number of records included in the export |
| `file_name` | `String @db.VarChar(255)` | Yes | — | Generated filename |
| `filters_applied` | `String? @db.Text` | No | null | JSON blob of all query params used |
| `exported_by_user_id` | `String @db.VarChar(36)` | Yes | — | — |
| `created_at` | `DateTime @default(now())` | Yes | auto | — |

**Indexes:**
- `@@index([tenant_id, export_type])`
- `@@index([tenant_id, created_at])`
- `@@index([tenant_id, exported_by_user_id])`

**Business rules:** Records are immutable — no update or delete. Export logs are permanent audit records.

---

### Table: `financial_category_account_mapping`

**Purpose:** Tenant-configurable mapping from Lead360 financial categories to QuickBooks/Xero chart of accounts names. Allows each tenant to match their own account naming convention.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `String @id @default(uuid()) @db.VarChar(36)` | Yes | auto | — |
| `tenant_id` | `String @db.VarChar(36)` | Yes | — | Tenant owner |
| `category_id` | `String @db.VarChar(36)` | Yes | — | FK to `financial_category` |
| `platform` | `accounting_platform` enum | Yes | — | `quickbooks` / `xero` |
| `account_name` | `String @db.VarChar(200)` | Yes | — | The exact account name as it appears in the tenant's QB/Xero chart of accounts |
| `account_code` | `String? @db.VarChar(50)` | No | null | QB/Xero account code (optional — some tenants use codes) |
| `created_by_user_id` | `String @db.VarChar(36)` | Yes | — | — |
| `updated_by_user_id` | `String? @db.VarChar(36)` | No | null | — |
| `created_at` | `DateTime @default(now())` | Yes | auto | — |
| `updated_at` | `DateTime @updatedAt` | Yes | auto | — |

**Indexes:**
- `@@index([tenant_id, platform])`
- `@@unique([tenant_id, category_id, platform])` — one mapping per category per platform per tenant

**Business rules:**
- If no mapping exists for a category, the export uses the Lead360 category `name` as the account name.
- This is the safe default — the accountant will see the Lead360 category name in QB/Xero and can map it manually the first time.

---

### New Enums

```
enum export_type {
  quickbooks_expenses
  quickbooks_invoices
  xero_expenses
  xero_invoices
  pl_csv
  entries_csv
}

enum accounting_platform {
  quickbooks
  xero
}
```

---

## QuickBooks Online CSV Format

### Expense Transactions (`financial_entry`)

QuickBooks Online accepts expenses via its standard import format. The CSV must match QuickBooks' column expectations exactly. The following columns are required by QB for expense import:

| QB Column | Source Field | Notes |
|-----------|-------------|-------|
| `Date` | `financial_entry.entry_date` | Format: MM/DD/YYYY |
| `Description` | `financial_entry.notes` or category name | If notes empty, use `financial_category.name` |
| `Amount` | `financial_entry.amount` | Positive for expenses, QB handles the sign |
| `Account` | Mapped account name from `financial_category_account_mapping` or `financial_category.name` | Must match QB Chart of Accounts |
| `Name` | `supplier.name` or `financial_entry.vendor_name` | Payee field in QB |
| `Class` | `project.name` if `project_id` set, else empty | QB Class tracking for project-level P&L |
| `Memo` | `financial_entry.notes` | Optional internal memo |
| `Payment Method` | `financial_entry.payment_method` enum value | Translated to QB payment method names |
| `Check No` | Empty | QB field — not applicable |
| `Tax Amount` | `financial_entry.tax_amount` | Optional |

**Payment method translation (Lead360 enum → QB display name):**
```
cash          → Cash
check         → Check
bank_transfer → Bank Transfer
venmo         → Venmo
zelle         → Zelle
credit_card   → Credit Card
debit_card    → Debit Card
ACH           → ACH
```

**Filters applied to expense export:**
- Only `submission_status = confirmed` entries
- Excludes `is_recurring_instance = true` entries by default (configurable via query param)
- Date range filter applied to `entry_date`

---

### Invoice / Sales Receipt Transactions (`project_invoice`)

QuickBooks treats customer payments as Sales Receipts or Payments depending on invoice status. For this sprint, export fully paid invoices as QB **Sales Receipts** and outstanding invoices as QB **Invoices**.

| QB Column | Source Field | Notes |
|-----------|-------------|-------|
| `Invoice No` | `project_invoice.invoice_number` | — |
| `Customer` | `project.name` + `project.project_number` | QB Customer field — use "Project Name (PRJ-001)" format |
| `Invoice Date` | `project_invoice.created_at` date | — |
| `Due Date` | `project_invoice.due_date` | Optional |
| `Item` | "Services" | Default line item name |
| `Description` | `project_invoice.description` | — |
| `Quantity` | 1 | Always 1 for service invoices |
| `Rate` | `project_invoice.amount` | Full amount as rate |
| `Amount` | `project_invoice.amount` | — |
| `Tax Amount` | `project_invoice.tax_amount` | Optional |
| `Status` | Derived from `invoice_status_extended` | draft→Draft, sent→Open, partial→Partial, paid→Paid |

---

## Xero CSV Format

### Expense Transactions

Xero's bank transaction import format. Xero expects a slightly different column structure from QuickBooks.

| Xero Column | Source Field | Notes |
|-------------|-------------|-------|
| `Date` | `financial_entry.entry_date` | Format: DD/MM/YYYY (different from QB) |
| `Amount` | `-financial_entry.amount` | Xero uses negative for expenditure |
| `Payee` | `supplier.name` or `financial_entry.vendor_name` | — |
| `Description` | `financial_entry.notes` or category name | — |
| `Reference` | `financial_entry.id` (short form) | Optional reference |
| `Account Code` | Mapped account code from `financial_category_account_mapping` | If no code, use account name |
| `Tax Rate` | Derived from `tax_amount/amount` percentage or "Tax Exempt" | — |
| `Tracking Name 1` | `project.name` if project-scoped | Xero tracking categories |

**Key difference from QB:** Xero uses `DD/MM/YYYY` date format and negative amounts for expenditure. The export service must apply these transformations.

---

### Invoice Transactions

| Xero Column | Source Field | Notes |
|-------------|-------------|-------|
| `ContactName` | Project name | Customer identifier |
| `InvoiceNumber` | `project_invoice.invoice_number` | — |
| `InvoiceDate` | `project_invoice.created_at` | DD/MM/YYYY format |
| `DueDate` | `project_invoice.due_date` | DD/MM/YYYY format |
| `Description` | `project_invoice.description` | — |
| `Quantity` | 1 | — |
| `UnitAmount` | `project_invoice.amount` | — |
| `TaxType` | "Tax Exclusive" or "No Tax" | Based on whether tax_amount is set |
| `AccountCode` | Default revenue account code | Configurable via category mapping |
| `TaxAmount` | `project_invoice.tax_amount` | — |
| `InvoiceStatus` | Derived | DRAFT / SUBMITTED / AUTHORISED / PAID |

---

## Data Quality Report

The data quality report identifies `financial_entry` records that are incomplete in ways that will cause QuickBooks or Xero import to fail or produce inaccurate records.

**Checks performed:**

| Check | Condition | Severity | Message |
|-------|-----------|----------|---------|
| Missing account mapping | Category has no `financial_category_account_mapping` for requested platform | Warning | "Category '{name}' has no QB/Xero account mapping — will use category name as account" |
| Missing vendor/supplier | `vendor_name` null AND `supplier_id` null | Warning | "Entry on {date} has no vendor or supplier — payee will be blank in export" |
| Missing project class | Entry is COGS type but `project_id` is null | Info | "Entry on {date} is a project cost but has no project — no Class tracking in QB" |
| Zero amount | `amount = 0` | Error | "Entry on {date} has zero amount — will be rejected by QB/Xero" |
| Future date | `entry_date > TODAY` | Warning | "Entry dated {date} is in the future — verify this is correct" |
| Missing payment method | `payment_method` null | Info | "Entry on {date} has no payment method — field will be blank in export" |
| Duplicate entry risk | Two or more entries with same `entry_date`, `amount`, `supplier_id` within 24 hours | Warning | "Possible duplicate: entries on {date} for {amount} from {supplier} — review before export" |

---

## API Specification

### Account Mapping Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| `GET` | `/financial/export/account-mappings` | List all mappings | Owner, Admin, Bookkeeper |
| `POST` | `/financial/export/account-mappings` | Create/update mapping | Owner, Admin, Bookkeeper |
| `DELETE` | `/financial/export/account-mappings/:id` | Delete mapping | Owner, Admin |
| `GET` | `/financial/export/account-mappings/defaults` | Preview default mappings for all categories | Owner, Admin, Bookkeeper |

---

#### `GET /financial/export/account-mappings`

**Query parameters:**
- `platform` — `accounting_platform` enum, optional. Filter by platform.

**Response:**
```
[
  {
    id
    category: { id, name, type, classification }
    platform
    account_name
    account_code
    created_at
    updated_at
  }
]
```

---

#### `POST /financial/export/account-mappings`

Creates or updates a mapping. If a mapping already exists for the given `category_id + platform`, it is updated (upsert behavior).

**Request body:**
```
category_id     UUID      required
platform        enum      required    quickbooks | xero
account_name    string    required    max 200 chars
account_code    string    optional    max 50 chars
```

**Response:** 200 OK (upsert) or 201 Created — full mapping object.

---

#### `GET /financial/export/account-mappings/defaults`

Returns a preview of what account name will be used for each category in exports — either the custom mapped name or the Lead360 category name as fallback.

**Query parameters:**
- `platform` — required.

**Response:**
```
[
  {
    category_id
    category_name
    category_type
    classification
    has_custom_mapping:   boolean
    account_name:         string    — custom mapping or fallback to category name
    account_code:         string | null
  }
]
```

---

### Export Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| `GET` | `/financial/export/quickbooks/expenses` | QB expense CSV | Owner, Admin, Bookkeeper |
| `GET` | `/financial/export/quickbooks/invoices` | QB invoice CSV | Owner, Admin, Bookkeeper |
| `GET` | `/financial/export/xero/expenses` | Xero expense CSV | Owner, Admin, Bookkeeper |
| `GET` | `/financial/export/xero/invoices` | Xero invoice CSV | Owner, Admin, Bookkeeper |
| `GET` | `/financial/export/quality-report` | Data quality report | Owner, Admin, Bookkeeper |
| `GET` | `/financial/export/history` | Export log history | Owner, Admin, Bookkeeper |

---

#### `GET /financial/export/quickbooks/expenses`

**Query parameters:**
- `date_from` — date, required. Start of export period.
- `date_to` — date, required. End of export period.
- `category_id` — UUID, optional. Filter to specific category.
- `classification` — enum, optional. `cost_of_goods_sold` or `operating_expense`.
- `project_id` — UUID, optional. Filter to project-linked entries.
- `include_recurring` — boolean, optional. Default false. Include recurring instance entries.
- `include_pending` — boolean, optional. Default false. Include `pending_review` entries.

**Response:**
- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="quickbooks-expenses-{date_from}-to-{date_to}.csv"`

**On success:** Logs the export to `financial_export_log`.

**Errors:**
- 400 — `date_from` or `date_to` missing
- 400 — date range exceeds 366 days (one year max per export — apply multiple exports for larger ranges)
- 400 — zero records match filters (return 400 with message "No records match the selected filters")

---

#### `GET /financial/export/quickbooks/invoices`

**Query parameters:**
- `date_from` — date, required.
- `date_to` — date, required. Applied to `project_invoice.created_at`.
- `status` — `invoice_status_extended` enum, optional.

**Response:** QB invoice CSV as described in format section above.

---

#### `GET /financial/export/xero/expenses`

Same query parameters as QB expenses. Response is Xero-formatted CSV with:
- `DD/MM/YYYY` date format
- Negative amounts for expenditure
- Xero column headers

---

#### `GET /financial/export/xero/invoices`

Same query parameters as QB invoices. Response is Xero-formatted CSV.

---

#### `GET /financial/export/quality-report`

**Query parameters:**
- `date_from` / `date_to` — optional. If omitted, checks all records.
- `platform` — `accounting_platform` enum, optional. If provided, includes platform-specific mapping checks.

**Response:**
```
{
  total_entries_checked:    integer
  total_issues:             integer
  errors:                   integer   — count of Error severity issues
  warnings:                 integer
  infos:                    integer

  issues: [
    {
      severity:             "error" | "warning" | "info"
      check_type:           string    — from the check table above
      entry_id:             string | null
      entry_date:           date | null
      amount:               decimal | null
      category_name:        string | null
      supplier_name:        string | null
      message:              string
    }
  ]

  export_readiness: {
    quickbooks:             "ready" | "warnings_present" | "errors_present"
    xero:                   "ready" | "warnings_present" | "errors_present"
  }
}
```

Issues ordered: `error` first, `warning` second, `info` last. Within each severity, ordered by `entry_date DESC`.

---

#### `GET /financial/export/history`

**Query parameters:**
- `export_type` — enum, optional.
- `page` — integer, default 1.
- `limit` — integer, default 20.

**Response:** Paginated list of `financial_export_log` records:
```
data: [
  {
    id
    export_type
    date_from
    date_to
    record_count
    file_name
    filters_applied   — parsed JSON object
    exported_by: { id, first_name, last_name }
    created_at
  }
]
meta: { total, page, limit, total_pages }
```

---

## Service Architecture

### `ExportService`

Location: `api/src/modules/financial/services/export.service.ts`

| Method | Signature | Notes |
|--------|-----------|-------|
| `exportQBExpenses` | `(tenantId, userId, query)` | Returns CSV buffer + logs export |
| `exportQBInvoices` | `(tenantId, userId, query)` | Returns CSV buffer + logs export |
| `exportXeroExpenses` | `(tenantId, userId, query)` | Returns CSV buffer + logs export |
| `exportXeroInvoices` | `(tenantId, userId, query)` | Returns CSV buffer + logs export |
| `getQualityReport` | `(tenantId, query)` | Returns quality report object |
| `getExportHistory` | `(tenantId, query)` | Paginated export log |
| `buildQBExpenseRow` | `(entry, mapping)` | Private — maps one entry to QB CSV row |
| `buildXeroExpenseRow` | `(entry, mapping)` | Private — maps one entry to Xero CSV row |
| `buildQBInvoiceRow` | `(invoice, project)` | Private — maps one invoice to QB CSV row |
| `buildXeroInvoiceRow` | `(invoice, project)` | Private — maps one invoice to Xero CSV row |
| `formatDateQB` | `(date)` | Private — `MM/DD/YYYY` |
| `formatDateXero` | `(date)` | Private — `DD/MM/YYYY` |
| `logExport` | `(tenantId, userId, type, query, count, filename)` | Private — writes to `financial_export_log` |

### `AccountMappingService`

Location: `api/src/modules/financial/services/account-mapping.service.ts`

| Method | Signature | Notes |
|--------|-----------|-------|
| `findAll` | `(tenantId, platform?)` | List mappings |
| `upsert` | `(tenantId, userId, dto)` | Create or update |
| `delete` | `(tenantId, mappingId, userId)` | Remove mapping |
| `getDefaults` | `(tenantId, platform)` | All categories with resolved account names |
| `resolveAccountName` | `(tenantId, categoryId, platform)` | Returns custom mapping or category name |

`resolveAccountName()` is called per-entry during export. For performance, the full mapping table is loaded once per export run (not per row) and cached in a local Map for the duration of the export.

---

## CSV Generation Strategy

All CSV files are built as string buffers in memory — no temp files, no disk writes.

**Pattern:**
1. Load account mapping table once into a `Map<categoryId, accountName>`.
2. Query financial entries using Prisma `findMany()` with `select` — only the columns needed for the CSV (do not load full joined objects).
3. Iterate records and call `buildQBExpenseRow()` or `buildXeroExpenseRow()` per row.
4. Concatenate header row + data rows into a single string buffer.
5. Set response headers and stream buffer.
6. After streaming, call `logExport()` to write the audit record.

**Maximum export size:** 50,000 rows. If the filtered result set exceeds 50,000 records, return 400 with message: "Export too large. Apply tighter date filters or export by category." Document this limit in API docs.

---

## Business Rules

1. Only `confirmed` (`submission_status = confirmed`) entries are exported by default. `include_pending = true` overrides this.
2. Voided invoices are never exported.
3. Export date range is capped at 366 days (one calendar year) per request.
4. Maximum 50,000 rows per export file.
5. Every export is logged to `financial_export_log` — logs are permanent and immutable.
6. If no `financial_category_account_mapping` exists for a category, the export uses the Lead360 `financial_category.name` as the QB/Xero account name. This is a valid fallback — the accountant will see the category name.
7. QuickBooks uses `MM/DD/YYYY` date format. Xero uses `DD/MM/YYYY`. The export service must apply the correct format per platform. This is the most common import failure cause — getting it wrong silently corrupts all dates.
8. Xero expense amounts must be negative (expenditure convention). QB amounts must be positive. The export service handles this sign transformation.
9. The quality report is read-only — it flags issues but does not fix them.
10. Export history is read-only — records cannot be deleted.
11. The `duplicate entry risk` check compares by `entry_date + amount + supplier_id` — not by entry ID. Two entries on the same day for the same amount from the same supplier are flagged as potential duplicates regardless of who created them.

---

## Acceptance Criteria

**Schema:**
- [ ] `financial_export_log` table exists with all fields
- [ ] `financial_category_account_mapping` table exists
- [ ] `export_type` and `accounting_platform` enums exist
- [ ] Migration runs cleanly

**Account Mappings:**
- [ ] `POST /financial/export/account-mappings` upserts correctly
- [ ] `GET /financial/export/account-mappings/defaults` returns all categories with resolved names
- [ ] Category with no mapping uses category name as fallback

**QuickBooks Export:**
- [ ] CSV header row exactly matches QB column names
- [ ] Dates formatted as `MM/DD/YYYY`
- [ ] Amounts are positive
- [ ] `Name` (payee) field uses supplier name when available, vendor_name as fallback
- [ ] `Class` field populated from project name when entry has project_id
- [ ] Payment method translated to QB display name
- [ ] Only confirmed entries included by default
- [ ] Export logged to `financial_export_log`

**Xero Export:**
- [ ] CSV header row exactly matches Xero column names
- [ ] Dates formatted as `DD/MM/YYYY`
- [ ] Expense amounts are negative
- [ ] `Tracking Name 1` populated from project name
- [ ] Export logged to `financial_export_log`

**Invoice Export:**
- [ ] QB invoice CSV uses correct QB columns
- [ ] Xero invoice CSV uses correct Xero columns
- [ ] Voided invoices excluded
- [ ] Invoice status mapped correctly to platform status values

**Quality Report:**
- [ ] All 7 check types implemented
- [ ] Duplicate entry risk detection works
- [ ] `export_readiness` correctly set to `errors_present` when any Error severity issues found
- [ ] Issues ordered: error → warning → info

**Export History:**
- [ ] Every successful export creates a `financial_export_log` record
- [ ] History endpoint returns correct paginated results
- [ ] Records are immutable — no delete endpoint exists

**Errors:**
- [ ] Missing date_from or date_to returns 400
- [ ] Date range > 366 days returns 400
- [ ] Zero records match returns 400
- [ ] Export > 50,000 rows returns 400

**Tests:**
- [ ] Unit test: `formatDateQB()` — correct MM/DD/YYYY output
- [ ] Unit test: `formatDateXero()` — correct DD/MM/YYYY output
- [ ] Unit test: Xero amount negation for expenses
- [ ] Unit test: account name resolution — custom mapping vs. fallback
- [ ] Unit test: `buildQBExpenseRow()` — all fields mapped correctly
- [ ] Unit test: `buildXeroExpenseRow()` — all fields mapped correctly
- [ ] Unit test: quality report — duplicate detection logic
- [ ] Unit test: quality report — missing vendor detection
- [ ] Integration test: full QB expense export with real data
- [ ] Integration test: export log created after successful export
- [ ] Tenant isolation: tenant A cannot export tenant B's data

**Documentation:**
- [ ] `api/documentation/financial_REST_API.md` updated with all endpoints
- [ ] QB and Xero column mappings documented as tables
- [ ] Date format difference documented prominently
- [ ] Amount sign convention documented
- [ ] Export limits (366 days, 50,000 rows) documented
- [ ] Instructions for how to import the CSV into QuickBooks Online documented
- [ ] Instructions for how to import the CSV into Xero documented

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| QB/Xero import column names change over time | High — imports fail silently | Low — both platforms have stable import formats | Document the QB/Xero version used for format definition. Test import against current QB/Xero sandbox before sprint closes. |
| Date format error (`MM/DD/YYYY` vs `DD/MM/YYYY`) causes wrong dates in import | High — all dates corrupted | Medium — easy to get wrong | Both format functions are unit-tested. Contract explicitly calls out this as "most common import failure cause." |
| 50,000 row buffer too large for memory at peak | Medium — OOM on large exports | Low — service businesses rarely have 50,000 entries | Use streaming CSV generation if buffer approach causes memory pressure. Document the streaming alternative in agent notes. |
| Duplicate entry check produces false positives for legitimate same-day same-amount purchases | Low — unnecessary warnings | Medium — common in construction (multiple trips to same supplier) | Severity is `warning` not `error`. Business owner reviews before export. False positives do not block export. |

---

## Dependencies

### Requires (must be complete)
- F-01 — `financial_category.classification` for export filtering
- F-02 — `supplier` table for payee names
- F-03 — `payment_method_registry` for payment method names
- F-04 — `submission_status` for confirmed-only filter
- F-08 — `project_invoice` table for invoice exports

### Blocks
- Nothing — F-10 is the final sprint in the Financial Module series

### Future sprint (not in scope)
- Live QuickBooks Online API integration (OAuth + real-time sync)
- Live Xero API integration
- Automated scheduled export emails to accountant

---

## File Change Summary

### Files Created
- `api/src/modules/financial/services/export.service.ts`
- `api/src/modules/financial/services/account-mapping.service.ts`
- `api/src/modules/financial/controllers/export.controller.ts`
- `api/src/modules/financial/controllers/account-mapping.controller.ts`
- `api/src/modules/financial/dto/create-account-mapping.dto.ts`
- `api/src/modules/financial/dto/export-query.dto.ts`
- `api/src/modules/financial/dto/quality-report-query.dto.ts`
- `api/prisma/migrations/[timestamp]_export_readiness/migration.sql`

### Files Modified
- `api/prisma/schema.prisma` — 2 new tables, 2 new enums
- `api/src/modules/financial/financial.module.ts` — register new services and controllers
- `api/documentation/financial_REST_API.md` — add all new endpoints + import instructions

### Files That Must NOT Be Modified
- Any file in `api/src/modules/projects/`
- Any file in `api/src/modules/quotes/`
- Any existing financial service
- Any frontend file

---

## Notes for Executing Agent

1. The date format difference between QuickBooks (`MM/DD/YYYY`) and Xero (`DD/MM/YYYY`) is the single most common cause of failed imports. Implement `formatDateQB()` and `formatDateXero()` as the very first step, unit-test them immediately with at least 10 date inputs each, and do not proceed until both pass.

2. Load the full `financial_category_account_mapping` table once per export into a `Map<string, string>` keyed on `category_id`. Do not call `resolveAccountName()` per row — this creates N+1 queries for large exports.

3. The CSV header rows must match the import column names of the target platform exactly — including capitalization and spacing. Do not invent column names. Use the exact column names defined in this contract. Test the output CSV by actually importing a sample into a QuickBooks or Xero sandbox (or developer account) before marking the sprint complete.

4. The `logExport()` call happens after the response is streamed — not before. The count is known after the query executes. Write the log record with `record_count` equal to the actual number of rows in the CSV (not including the header row).

5. The quality report's duplicate detection query must be efficient — use a Prisma `groupBy` on `entry_date + amount + supplier_id` with `_count > 1` to find duplicates in a single query, not by comparing all pairs.

6. Both the account-mappings `defaults` endpoint and the export `GET /account-mappings` endpoint must be registered before any parameterized routes in the controller to avoid NestJS treating `defaults` as an `:id` param.

7. Produce 100% API documentation before marking the sprint complete. The documentation must include step-by-step instructions for how to import the exported CSV into QuickBooks Online and Xero — this is what the business owner actually reads when they have the file in hand.