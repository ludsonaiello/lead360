# Financial Export Module (F-10) — Complete REST API Documentation

**STATUS: VERIFIED BY DOCUMENTATION AGENT — 2026-03-25**

**Version**: 1.0
**Last Updated**: March 25, 2026
**Base URL**: `http://localhost:8000/api/v1` (local) / `https://api.lead360.app/api/v1` (production)
**Module**: Financial Export — QuickBooks & Xero CSV Export + Account Mapping + Data Quality

---

## Table of Contents

1. [Module Overview](#1-module-overview)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Account Mapping Endpoints](#3-account-mapping-endpoints)
4. [Export Endpoints](#4-export-endpoints)
5. [QuickBooks Expense CSV Column Mapping](#5-quickbooks-expense-csv-column-mapping)
6. [Xero Expense CSV Column Mapping](#6-xero-expense-csv-column-mapping)
7. [QuickBooks Invoice CSV Column Mapping](#7-quickbooks-invoice-csv-column-mapping)
8. [Xero Invoice CSV Column Mapping](#8-xero-invoice-csv-column-mapping)
9. [Date Format Reference](#9-date-format-reference)
10. [Amount Sign Convention](#10-amount-sign-convention)
11. [Payment Method Translation Table](#11-payment-method-translation-table)
12. [Invoice Status Translation Tables](#12-invoice-status-translation-tables)
13. [Data Quality Report](#13-data-quality-report)
14. [Export History](#14-export-history)
15. [Business Rules](#15-business-rules)
16. [Export Limits](#16-export-limits)
17. [How to Import into QuickBooks Online](#17-how-to-import-into-quickbooks-online)
18. [How to Import into Xero](#18-how-to-import-into-xero)

---

## 1. Module Overview

The Financial Export module (F-10) enables Lead360 tenants to export their financial data as CSV files compatible with **QuickBooks Online** and **Xero**. This provides a seamless handoff path for accountants who use either platform.

### New Database Tables

| Table | Purpose |
|-------|---------|
| `financial_export_log` | Immutable audit trail of every export performed. Records export type, date range, record count, filename, applied filters, and the user who triggered the export. |
| `financial_category_account_mapping` | Maps Lead360 financial categories to their corresponding account names/codes in QuickBooks or Xero chart of accounts. Has a unique constraint on `(tenant_id, category_id, platform)`. |

### New Enums

| Enum | Values |
|------|--------|
| `export_type` | `quickbooks_expenses`, `quickbooks_invoices`, `xero_expenses`, `xero_invoices`, `pl_csv`, `entries_csv` |
| `accounting_platform` | `quickbooks`, `xero` |

---

## 2. Authentication & Authorization

All endpoints in this module require a **JWT Bearer token**.

**Header Required**:
```
Authorization: Bearer <JWT_TOKEN>
```

**Obtaining a Token**:
```bash
curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token'
```

### RBAC Roles

| Action | Owner | Admin | Bookkeeper |
|--------|-------|-------|------------|
| List account mappings | Yes | Yes | Yes |
| Get default mappings | Yes | Yes | Yes |
| Create/update (upsert) mapping | Yes | Yes | Yes |
| **Delete** mapping | **Yes** | **Yes** | **No** |
| Export QuickBooks expenses | Yes | Yes | Yes |
| Export QuickBooks invoices | Yes | Yes | Yes |
| Export Xero expenses | Yes | Yes | Yes |
| Export Xero invoices | Yes | Yes | Yes |
| View quality report | Yes | Yes | Yes |
| View export history | Yes | Yes | Yes |

> **Important**: DELETE mapping requires **Owner or Admin only** — Bookkeeper cannot delete mappings.

---

## 3. Account Mapping Endpoints

Base path: `/financial/export/account-mappings`

### 3.1 List All Account Mappings

**`GET /financial/export/account-mappings`**

Returns all account mappings for the tenant, optionally filtered by platform.

**Roles**: Owner, Admin, Bookkeeper

**Query Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `platform` | string | No | Filter by platform: `quickbooks` or `xero` | `quickbooks` |

**Response** `200 OK`:
```json
[
  {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
    "category_id": "550e8400-e29b-41d4-a716-446655440000",
    "platform": "quickbooks",
    "account_name": "Job Materials",
    "account_code": "5100",
    "created_by_user_id": "user-uuid",
    "updated_by_user_id": null,
    "created_at": "2026-03-20T10:00:00.000Z",
    "updated_at": "2026-03-20T10:00:00.000Z",
    "category": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Materials",
      "type": "expense",
      "classification": "cost_of_goods_sold"
    }
  }
]
```

**Error Responses**:

| Status | Message |
|--------|---------|
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — insufficient role |

**Example curl**:
```bash
curl -s 'http://localhost:8000/api/v1/financial/export/account-mappings?platform=quickbooks' \
  -H "Authorization: Bearer $TOKEN"
```

---

### 3.2 Get Default Account Mappings (Preview)

**`GET /financial/export/account-mappings/defaults`**

Returns ALL active financial categories for the tenant with their resolved account name for the given platform. Categories with a custom mapping show that mapping; categories without a mapping fall back to using the Lead360 category name.

**Roles**: Owner, Admin, Bookkeeper

**Query Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `platform` | string | **Yes** | Target platform: `quickbooks` or `xero` | `quickbooks` |

**Response** `200 OK`:
```json
[
  {
    "category_id": "550e8400-e29b-41d4-a716-446655440000",
    "category_name": "Materials",
    "category_type": "expense",
    "classification": "cost_of_goods_sold",
    "has_custom_mapping": true,
    "account_name": "Job Materials",
    "account_code": "5100"
  },
  {
    "category_id": "660e8400-e29b-41d4-a716-446655440001",
    "category_name": "Office Supplies",
    "category_type": "expense",
    "classification": "operating_expense",
    "has_custom_mapping": false,
    "account_name": "Office Supplies",
    "account_code": null
  }
]
```

**Error Responses**:

| Status | Message |
|--------|---------|
| 400 | `platform must be quickbooks or xero` |
| 401 | Unauthorized |
| 403 | Forbidden |

**Example curl**:
```bash
curl -s 'http://localhost:8000/api/v1/financial/export/account-mappings/defaults?platform=quickbooks' \
  -H "Authorization: Bearer $TOKEN"
```

---

### 3.3 Create or Update Account Mapping (Upsert)

**`POST /financial/export/account-mappings`**

Creates a new mapping or updates an existing one if a mapping already exists for the same `(category_id, platform, tenant_id)` combination.

**Roles**: Owner, Admin, Bookkeeper

**Request Body** (`application/json`):

| Field | Type | Required | Validation | Example |
|-------|------|----------|------------|---------|
| `category_id` | string (UUID) | **Yes** | Must be a valid UUID; category must exist and belong to tenant | `"550e8400-e29b-41d4-a716-446655440000"` |
| `platform` | string | **Yes** | Must be `"quickbooks"` or `"xero"` | `"quickbooks"` |
| `account_name` | string | **Yes** | Max 200 characters | `"Job Materials"` |
| `account_code` | string | No | Max 50 characters | `"5100"` |

**Response** `201 Created` (new mapping):
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "category_id": "550e8400-e29b-41d4-a716-446655440000",
  "platform": "quickbooks",
  "account_name": "Job Materials",
  "account_code": "5100",
  "created_by_user_id": "user-uuid",
  "updated_by_user_id": null,
  "created_at": "2026-03-20T10:00:00.000Z",
  "updated_at": "2026-03-20T10:00:00.000Z"
}
```

**Response** `200 OK` (updated existing mapping):
Same shape as above, with `updated_by_user_id` populated and `updated_at` reflecting the update time.

**Error Responses**:

| Status | Message |
|--------|---------|
| 400 | Validation error (missing fields, invalid UUID, bad platform value) |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | `Category {id} not found for this tenant` |

**Example curl**:
```bash
curl -s -X POST http://localhost:8000/api/v1/financial/export/account-mappings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category_id": "550e8400-e29b-41d4-a716-446655440000",
    "platform": "quickbooks",
    "account_name": "Job Materials",
    "account_code": "5100"
  }'
```

---

### 3.4 Delete Account Mapping

**`DELETE /financial/export/account-mappings/:id`**

Deletes a single account mapping by its ID. Tenant-scoped.

**Roles**: Owner, Admin **only** (Bookkeeper excluded)

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | **Yes** | Mapping UUID |

**Response** `204 No Content` — empty body on success.

**Error Responses**:

| Status | Message |
|--------|---------|
| 400 | Invalid UUID format |
| 401 | Unauthorized |
| 403 | Forbidden — Bookkeeper role not permitted |
| 404 | `Account mapping {id} not found` |

**Example curl**:
```bash
curl -s -X DELETE http://localhost:8000/api/v1/financial/export/account-mappings/a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  -H "Authorization: Bearer $TOKEN"
```

---

## 4. Export Endpoints

Base path: `/financial/export`

### 4.1 Export QuickBooks Expenses CSV

**`GET /financial/export/quickbooks/expenses`**

Generates and downloads a CSV file of financial entries formatted for QuickBooks Online import.

**Roles**: Owner, Admin, Bookkeeper

**Query Parameters**:

| Parameter | Type | Required | Default | Description | Example |
|-----------|------|----------|---------|-------------|---------|
| `date_from` | string (ISO date) | **Yes** | — | Start of export period | `2026-01-01` |
| `date_to` | string (ISO date) | **Yes** | — | End of export period | `2026-03-31` |
| `category_id` | UUID | No | — | Filter to specific category | `550e8400-...` |
| `classification` | string | No | — | Filter by classification: `cost_of_goods_sold` or `operating_expense` | `cost_of_goods_sold` |
| `project_id` | UUID | No | — | Filter to entries linked to a specific project | `660e8400-...` |
| `include_recurring` | boolean | No | `false` | Include recurring instance entries | `true` |
| `include_pending` | boolean | No | `false` | Include `pending_review` entries (default: confirmed only) | `true` |

**Response** `200 OK`:
- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="quickbooks-expenses-2026-01-01-to-2026-03-31.csv"`
- Body: CSV content (see [Section 5](#5-quickbooks-expense-csv-column-mapping) for column mapping)

**Error Responses**:

| Status | Message |
|--------|---------|
| 400 | `date_from must be before or equal to date_to` |
| 400 | `Date range cannot exceed 366 days. Apply tighter date filters or export in smaller batches.` |
| 400 | `Invalid date format for date_from or date_to` |
| 400 | `No records match the selected filters` |
| 400 | `Export too large. Apply tighter date filters or export by category.` (> 50,000 rows) |
| 401 | Unauthorized |
| 403 | Forbidden |

**Example curl**:
```bash
curl -s 'http://localhost:8000/api/v1/financial/export/quickbooks/expenses?date_from=2026-01-01&date_to=2026-03-31' \
  -H "Authorization: Bearer $TOKEN" \
  -o quickbooks-expenses.csv
```

---

### 4.2 Export QuickBooks Invoices CSV

**`GET /financial/export/quickbooks/invoices`**

Generates and downloads a CSV file of project invoices formatted for QuickBooks Online import. Voided invoices are always excluded.

**Roles**: Owner, Admin, Bookkeeper

**Query Parameters**:

| Parameter | Type | Required | Default | Description | Example |
|-----------|------|----------|---------|-------------|---------|
| `date_from` | string (ISO date) | **Yes** | — | Start of export period | `2026-01-01` |
| `date_to` | string (ISO date) | **Yes** | — | End of export period | `2026-03-31` |
| `status` | string | No | — | Filter by invoice status: `draft`, `sent`, `partial`, `paid` | `sent` |

**Response** `200 OK`:
- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="quickbooks-invoices-2026-01-01-to-2026-03-31.csv"`
- Body: CSV content (see [Section 7](#7-quickbooks-invoice-csv-column-mapping) for column mapping)

**Error Responses**: Same as QB expenses (see 4.1).

**Example curl**:
```bash
curl -s 'http://localhost:8000/api/v1/financial/export/quickbooks/invoices?date_from=2026-01-01&date_to=2026-03-31' \
  -H "Authorization: Bearer $TOKEN" \
  -o quickbooks-invoices.csv
```

---

### 4.3 Export Xero Expenses CSV

**`GET /financial/export/xero/expenses`**

Generates and downloads a CSV file of financial entries formatted for Xero import. Amounts are **negative** (Xero expenditure convention).

**Roles**: Owner, Admin, Bookkeeper

**Query Parameters**: Same as QuickBooks expenses (see 4.1).

**Response** `200 OK`:
- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="xero-expenses-2026-01-01-to-2026-03-31.csv"`
- Body: CSV content (see [Section 6](#6-xero-expense-csv-column-mapping) for column mapping)

**Error Responses**: Same as QB expenses (see 4.1).

**Example curl**:
```bash
curl -s 'http://localhost:8000/api/v1/financial/export/xero/expenses?date_from=2026-01-01&date_to=2026-03-31' \
  -H "Authorization: Bearer $TOKEN" \
  -o xero-expenses.csv
```

---

### 4.4 Export Xero Invoices CSV

**`GET /financial/export/xero/invoices`**

Generates and downloads a CSV file of project invoices formatted for Xero import. Voided invoices are always excluded. Invoice amounts remain **positive** (revenue).

**Roles**: Owner, Admin, Bookkeeper

**Query Parameters**: Same as QuickBooks invoices (see 4.2).

**Response** `200 OK`:
- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename="xero-invoices-2026-01-01-to-2026-03-31.csv"`
- Body: CSV content (see [Section 8](#8-xero-invoice-csv-column-mapping) for column mapping)

**Error Responses**: Same as QB expenses (see 4.1).

**Example curl**:
```bash
curl -s 'http://localhost:8000/api/v1/financial/export/xero/invoices?date_from=2026-01-01&date_to=2026-03-31' \
  -H "Authorization: Bearer $TOKEN" \
  -o xero-invoices.csv
```

---

### 4.5 Data Quality Report

**`GET /financial/export/quality-report`**

Returns a structured data quality report with issues organized by severity. See [Section 13](#13-data-quality-report) for the full response shape and check types.

**Roles**: Owner, Admin, Bookkeeper

**Query Parameters**:

| Parameter | Type | Required | Default | Description | Example |
|-----------|------|----------|---------|-------------|---------|
| `date_from` | string (ISO date) | No | — | Start date filter (omit to check all records) | `2026-01-01` |
| `date_to` | string (ISO date) | No | — | End date filter (omit to check all records) | `2026-03-31` |
| `platform` | string | No | — | Target platform for platform-specific checks: `quickbooks` or `xero` | `quickbooks` |

**Response** `200 OK`: See [Section 13](#13-data-quality-report).

**Example curl**:
```bash
curl -s 'http://localhost:8000/api/v1/financial/export/quality-report?platform=quickbooks' \
  -H "Authorization: Bearer $TOKEN"
```

---

### 4.6 Export History (Paginated)

**`GET /financial/export/history`**

Returns the paginated, immutable log of all exports performed by this tenant.

**Roles**: Owner, Admin, Bookkeeper

**Query Parameters**:

| Parameter | Type | Required | Default | Description | Example |
|-----------|------|----------|---------|-------------|---------|
| `export_type` | string | No | — | Filter by type: `quickbooks_expenses`, `quickbooks_invoices`, `xero_expenses`, `xero_invoices`, `pl_csv`, `entries_csv` | `quickbooks_expenses` |
| `page` | number | No | `1` | Page number (min: 1) | `1` |
| `limit` | number | No | `20` | Items per page (min: 1, max: 100) | `20` |

**Response** `200 OK`: See [Section 14](#14-export-history).

**Example curl**:
```bash
curl -s 'http://localhost:8000/api/v1/financial/export/history?page=1&limit=10' \
  -H "Authorization: Bearer $TOKEN"
```

---

## 5. QuickBooks Expense CSV Column Mapping

CSV header: `Date,Description,Amount,Account,Name,Class,Memo,Payment Method,Check No,Tax Amount`

| # | QB Column | Lead360 Source Field | Notes |
|---|-----------|---------------------|-------|
| 1 | **Date** | `financial_entry.entry_date` | Formatted as `MM/DD/YYYY` (US format) |
| 2 | **Description** | `financial_entry.notes` → fallback `financial_category.name` | Entry notes; if null, uses category name |
| 3 | **Amount** | `financial_entry.amount` | Always **positive** — `.toFixed(2)` |
| 4 | **Account** | Custom mapping `account_name` → fallback `financial_category.name` | Resolved via `financial_category_account_mapping`; falls back to category name; last resort: `"Uncategorized"` |
| 5 | **Name** | `supplier.name` → fallback `financial_entry.vendor_name` | Supplier name preferred; vendor_name as legacy fallback; empty string if both null |
| 6 | **Class** | `project.name` | Project name when entry has `project_id`; empty string if no project |
| 7 | **Memo** | `financial_entry.notes` | Same as Description source; empty string if null |
| 8 | **Payment Method** | `financial_entry.payment_method` | Translated via QB display name map (see [Section 11](#11-payment-method-translation-table)) |
| 9 | **Check No** | — | Always empty string (not applicable) |
| 10 | **Tax Amount** | `financial_entry.tax_amount` | `.toFixed(2)` when present; empty string if null |

---

## 6. Xero Expense CSV Column Mapping

CSV header: `Date,Amount,Payee,Description,Reference,Account Code,Tax Rate,Tracking Name 1`

| # | Xero Column | Lead360 Source Field | Notes |
|---|-------------|---------------------|-------|
| 1 | **Date** | `financial_entry.entry_date` | Formatted as `DD/MM/YYYY` (international format) |
| 2 | **Amount** | `financial_entry.amount` | **NEGATIVE** — `-Math.abs(amount).toFixed(2)` |
| 3 | **Payee** | `supplier.name` → fallback `financial_entry.vendor_name` | Same logic as QB Name field |
| 4 | **Description** | `financial_entry.notes` → fallback `financial_category.name` | Same logic as QB Description |
| 5 | **Reference** | `financial_entry.id` | First 8 characters of the entry UUID |
| 6 | **Account Code** | `account_code` → fallback `account_name` → fallback `financial_category.name` | Prefers `account_code` from mapping; then `account_name`; last resort: category name or `"Uncategorized"` |
| 7 | **Tax Rate** | Derived from `tax_amount / amount * 100` | Format: `"8.0%"` — or `"Tax Exempt"` if tax_amount is null or zero |
| 8 | **Tracking Name 1** | `project.name` | Project name when entry has `project_id`; empty string if no project |

---

## 7. QuickBooks Invoice CSV Column Mapping

CSV header: `Invoice No,Customer,Invoice Date,Due Date,Item,Description,Quantity,Rate,Amount,Tax Amount,Status`

| # | QB Column | Lead360 Source | Notes |
|---|-----------|----------------|-------|
| 1 | **Invoice No** | `project_invoice.invoice_number` | Empty string if null |
| 2 | **Customer** | `project.name` + `project.project_number` | Format: `"Kitchen Remodel (PRJ-001)"` if project_number exists; just project name otherwise; `"Unknown Project"` if project is null |
| 3 | **Invoice Date** | `project_invoice.created_at` | Formatted as `MM/DD/YYYY` |
| 4 | **Due Date** | `project_invoice.due_date` | Formatted as `MM/DD/YYYY`; empty string if null |
| 5 | **Item** | — | Always `"Services"` (hard-coded) |
| 6 | **Description** | `project_invoice.description` | Empty string if null |
| 7 | **Quantity** | — | Always `"1"` |
| 8 | **Rate** | `project_invoice.amount` | `.toFixed(2)` — always positive |
| 9 | **Amount** | `project_invoice.amount` | `.toFixed(2)` — always positive |
| 10 | **Tax Amount** | `project_invoice.tax_amount` | `.toFixed(2)` when present; empty string if null |
| 11 | **Status** | `project_invoice.status` | Translated via QB status map (see [Section 12](#12-invoice-status-translation-tables)) |

---

## 8. Xero Invoice CSV Column Mapping

CSV header: `ContactName,InvoiceNumber,InvoiceDate,DueDate,Description,Quantity,UnitAmount,TaxType,AccountCode,TaxAmount,InvoiceStatus`

| # | Xero Column | Lead360 Source | Notes |
|---|-------------|----------------|-------|
| 1 | **ContactName** | `project.name` | Project name only (no project_number); `"Unknown Project"` if project is null |
| 2 | **InvoiceNumber** | `project_invoice.invoice_number` | Empty string if null |
| 3 | **InvoiceDate** | `project_invoice.created_at` | Formatted as `DD/MM/YYYY` |
| 4 | **DueDate** | `project_invoice.due_date` | Formatted as `DD/MM/YYYY`; empty string if null |
| 5 | **Description** | `project_invoice.description` | Empty string if null |
| 6 | **Quantity** | — | Always `"1"` |
| 7 | **UnitAmount** | `project_invoice.amount` | `.toFixed(2)` — always **positive** (revenue) |
| 8 | **TaxType** | Derived from `tax_amount` | `"Tax Exclusive"` if tax_amount > 0; `"No Tax"` if null or zero |
| 9 | **AccountCode** | — | Always empty string (revenue account not mapped via category system) |
| 10 | **TaxAmount** | `project_invoice.tax_amount` | `.toFixed(2)` when present; empty string if null |
| 11 | **InvoiceStatus** | `project_invoice.status` | Translated via Xero status map (see [Section 12](#12-invoice-status-translation-tables)) |

---

## 9. Date Format Reference

> **This is the #1 failure cause when importing into accounting platforms. Pay close attention.**

| Platform | Format | Pattern | Example (March 5, 2026) |
|----------|--------|---------|------------------------|
| **QuickBooks Online** | US format | `MM/DD/YYYY` | `03/05/2026` |
| **Xero** | International format | `DD/MM/YYYY` | `05/03/2026` |

**Implementation detail**: The formatter uses `getUTC*` methods (not local time) because Prisma returns Date objects in UTC. This prevents timezone-related off-by-one date errors.

```
QB:   formatDateQB(date)   → MM/DD/YYYY  (month first)
Xero: formatDateXero(date) → DD/MM/YYYY  (day first)
```

**Common mistake**: If you see `05/03/2026` in a QuickBooks file, that means **May 3rd**, not March 5th. The same string in Xero means **5th March**. Mixing up the platforms will cause every date to be wrong.

---

## 10. Amount Sign Convention

| Export Type | Platform | Sign | Reason |
|-------------|----------|------|--------|
| Expenses | **QuickBooks** | **POSITIVE** | QB treats bank transaction imports as debits by default |
| Expenses | **Xero** | **NEGATIVE** | Xero expenditure convention requires negative amounts for outflows |
| Invoices | **QuickBooks** | **POSITIVE** | Revenue — always positive |
| Invoices | **Xero** | **POSITIVE** | Revenue — always positive |

**Xero expense formula**: `-Math.abs(financial_entry.amount)` — ensures the sign is always negative regardless of what was stored.

---

## 11. Payment Method Translation Table

The payment method stored in `financial_entry.payment_method` (Lead360 enum) is translated to a human-readable display name for QuickBooks exports. Xero expense CSV does not include a payment method column.

| Lead360 Enum Value | QuickBooks Display Name |
|---------------------|------------------------|
| `cash` | Cash |
| `check` | Check |
| `bank_transfer` | Bank Transfer |
| `venmo` | Venmo |
| `zelle` | Zelle |
| `credit_card` | Credit Card |
| `debit_card` | Debit Card |
| `ACH` | ACH |

If the payment method is `null`, the field is left as an empty string in the CSV.
If the value doesn't match any key in the map, the raw enum value is used as-is via `String(payment_method)`.

---

## 12. Invoice Status Translation Tables

### Lead360 → QuickBooks Status

| Lead360 Status | QuickBooks Status |
|---------------|-------------------|
| `draft` | `Draft` |
| `sent` | `Open` |
| `partial` | `Partial` |
| `paid` | `Paid` |
| `voided` | **Never exported** — voided invoices are excluded from the query |

If the status doesn't match any key, the raw status string is used as-is.

### Lead360 → Xero Status

| Lead360 Status | Xero Status |
|---------------|-------------|
| `draft` | `DRAFT` |
| `sent` | `SUBMITTED` |
| `partial` | `AUTHORISED` |
| `paid` | `PAID` |
| `voided` | **Never exported** — voided invoices are excluded from the query |

If the status doesn't match any key, the raw status is uppercased via `String(status).toUpperCase()`.

---

## 13. Data Quality Report

### 13.1 Check Types

The quality report performs **7 distinct checks** on financial entries:

| # | Check Type | Severity | Condition | Message Format |
|---|-----------|----------|-----------|----------------|
| 1 | `missing_account_mapping` | `warning` | Category has no mapping for the specified platform (only checked when `platform` query param is provided) | `Category "{name}" has no QB/Xero account mapping — will use category name as account` |
| 2 | `missing_vendor` | `warning` | `vendor_name` is null AND `supplier_id` is null | `Entry on {date} has no vendor or supplier — payee will be blank in export` |
| 3 | `missing_project_class` | `info` | Category classification is `cost_of_goods_sold` AND entry has no `project_id` | `Entry on {date} is a project cost but has no project — no Class tracking in QB` |
| 4 | `zero_amount` | `error` | `amount` equals 0 | `Entry on {date} has zero amount — will be rejected by QB/Xero` |
| 5 | `future_date` | `warning` | `entry_date` is after today (end of day UTC) | `Entry dated {date} is in the future — verify this is correct` |
| 6 | `missing_payment_method` | `info` | `payment_method` is null | `Entry on {date} has no payment method — field will be blank in export` |
| 7 | `duplicate_entry_risk` | `warning` | Multiple entries with same `entry_date` + `amount` + `supplier_id` (supplier_id must not be null) | `Possible duplicate: {count} entries on {date} for ${amount} from {supplier} — review before export` |

**Note on Check 1**: The `missing_account_mapping` check is de-duplicated per category — it reports each unmapped category only once, not once per entry.

**Note on Check 7**: Duplicate detection uses Prisma `groupBy` with `having: { id: { _count: { gt: 1 } } }` — only groups with 2+ entries are flagged. Supplier name is resolved with a tenant-scoped query for security.

### 13.2 Response Shape

```json
{
  "total_entries_checked": 142,
  "total_issues": 5,
  "errors": 1,
  "warnings": 3,
  "infos": 1,
  "issues": [
    {
      "severity": "error",
      "check_type": "zero_amount",
      "entry_id": "entry-uuid-001",
      "entry_date": "2026-03-10",
      "amount": 0,
      "category_name": "Materials",
      "supplier_name": "Home Depot",
      "message": "Entry on 2026-03-10 has zero amount — will be rejected by QB/Xero"
    },
    {
      "severity": "warning",
      "check_type": "missing_vendor",
      "entry_id": "entry-uuid-002",
      "entry_date": "2026-03-08",
      "amount": 150.50,
      "category_name": "Office Supplies",
      "supplier_name": null,
      "message": "Entry on 2026-03-08 has no vendor or supplier — payee will be blank in export"
    },
    {
      "severity": "warning",
      "check_type": "duplicate_entry_risk",
      "entry_id": null,
      "entry_date": "2026-03-05",
      "amount": 250.00,
      "category_name": null,
      "supplier_name": "Staples Inc",
      "message": "Possible duplicate: 2 entries on 2026-03-05 for $250.00 from Staples Inc — review before export"
    }
  ],
  "export_readiness": {
    "quickbooks": "errors_present",
    "xero": "errors_present"
  }
}
```

### 13.3 Issue Sort Order

Issues are sorted by severity first (error → warning → info), then by `entry_date` descending within each severity level.

### 13.4 Export Readiness Logic

| Condition | Value |
|-----------|-------|
| Any `error` severity issues exist | `"errors_present"` |
| No errors, but `warning` severity issues exist | `"warnings_present"` |
| No errors and no warnings | `"ready"` |

Both `quickbooks` and `xero` readiness values are calculated identically (based on the same issues).

---

## 14. Export History

### 14.1 Response Shape

```json
{
  "data": [
    {
      "id": "log-uuid-001",
      "export_type": "quickbooks_expenses",
      "date_from": "2026-01-01T00:00:00.000Z",
      "date_to": "2026-03-31T00:00:00.000Z",
      "record_count": 87,
      "file_name": "quickbooks-expenses-2026-01-01-to-2026-03-31.csv",
      "filters_applied": {
        "date_from": "2026-01-01",
        "date_to": "2026-03-31"
      },
      "exported_by_user_id": "user-uuid",
      "created_at": "2026-03-20T14:30:00.000Z",
      "exported_by": {
        "id": "user-uuid",
        "first_name": "John",
        "last_name": "Smith"
      }
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

### 14.2 Pagination

| Field | Description |
|-------|-------------|
| `meta.total` | Total number of export log records matching the filter |
| `meta.page` | Current page number |
| `meta.limit` | Items per page |
| `meta.total_pages` | Total pages calculated as `Math.ceil(total / limit)` |

**Note**: `filters_applied` is stored as a JSON string in the database and parsed back to an object in the response. It records the exact query parameters that were used for the export.

**Note**: Records are sorted by `created_at` descending (most recent export first).

---

## 15. Business Rules

| Rule | Description |
|------|-------------|
| **BR-01: Confirmed-only default** | Expense exports include only `submission_status = 'confirmed'` entries by default. Set `include_pending=true` to override. |
| **BR-02: Recurring instance exclusion** | Entries with `is_recurring_instance = true` are excluded by default. Set `include_recurring=true` to override. |
| **BR-03: Voided invoice exclusion** | Invoices with `status = 'voided'` are **never** included in any invoice export. The query uses `status: { not: 'voided' }` — this cannot be overridden. |
| **BR-04: 366-day date range limit** | The difference between `date_from` and `date_to` must not exceed 366 days. Returns 400 if exceeded. |
| **BR-05: 50,000 row limit** | If a query returns more than 50,000 records, the export is rejected with a 400 error. User must apply tighter date or category filters. |
| **BR-06: Export logging** | Every successful CSV export creates an immutable record in `financial_export_log`. The log is written **after** CSV generation (not before), so it records the actual record count. |
| **BR-07: Platform-specific date formatting** | QuickBooks uses `MM/DD/YYYY`; Xero uses `DD/MM/YYYY`. Implemented via UTC-safe formatters. |
| **BR-08: Platform-specific amount signs** | QuickBooks expenses: positive. Xero expenses: negative. All invoices: positive. |
| **BR-09: Account mapping fallback** | If no custom mapping exists for a category, the category's own name is used as the account name. For Xero, the `account_code` field falls back to `account_name` if `account_code` is null, then to the category name. |
| **BR-10: Export history immutability** | Export log records cannot be deleted. There is no DELETE endpoint for export history. Records are immutable once created. |
| **BR-11: Duplicate detection** | Quality report groups entries by `(entry_date, amount, supplier_id)` where `supplier_id` is not null, and flags groups with count > 1. |
| **BR-12: Issue ordering** | Quality report issues are sorted: `error` first, then `warning`, then `info`. Within each severity, sorted by `entry_date` descending. |
| **BR-13: Export readiness** | `errors_present` if any error-severity issues; `warnings_present` if only warnings; `ready` if no errors or warnings. |

---

## 16. Export Limits

| Limit | Value | Error Message |
|-------|-------|---------------|
| Maximum date range | **366 days** | `Date range cannot exceed 366 days. Apply tighter date filters or export in smaller batches.` |
| Maximum rows per export | **50,000** | `Export too large. Apply tighter date filters or export by category.` |
| Export log records | **Immutable** — no delete endpoint exists | N/A |
| Pagination max limit | **100** items per page (export history) | Silently capped by DTO validation |
| Account name max length | **200** characters | DTO validation |
| Account code max length | **50** characters | DTO validation |

---

## 17. How to Import into QuickBooks Online

### Importing Expenses

1. Log into **QuickBooks Online**
2. Navigate to **Banking** → **Import bank transactions**
3. Click **Browse** and select the downloaded CSV file (e.g., `quickbooks-expenses-2026-01-01-to-2026-03-31.csv`)
4. QuickBooks will preview the data — verify:
   - Dates are in `MM/DD/YYYY` format (US dates)
   - Amounts are **positive**
   - Account names match your Chart of Accounts
5. Map any unrecognized columns if prompted
6. Click **Import**
7. Verify the imported transactions appear in the correct accounts

### Importing Invoices

1. Log into **QuickBooks Online**
2. Navigate to **Sales** → **Import invoices**
3. Click **Browse** and select the downloaded CSV file (e.g., `quickbooks-invoices-2026-01-01-to-2026-03-31.csv`)
4. QuickBooks will preview the data — verify:
   - Invoice dates are in `MM/DD/YYYY` format
   - Customer names match your Customer list
   - Amounts are correct
5. Map any unrecognized columns if prompted
6. Click **Import**
7. Verify the imported invoices appear under Sales → Invoices

---

## 18. How to Import into Xero

### Importing Expenses

1. Log into **Xero**
2. Navigate to **Accounting** → **Bank accounts** → **Import a statement**
3. Click **Browse** and select the downloaded CSV file (e.g., `xero-expenses-2026-01-01-to-2026-03-31.csv`)
4. Select the correct **bank account** for the import
5. Xero will preview the data — verify:
   - Dates are in `DD/MM/YYYY` format (international dates)
   - Amounts are **negative** for expenses (this is correct for Xero)
   - Account Codes match your Chart of Accounts
6. Click **Import**
7. Reconcile the imported transactions

### Importing Invoices

1. Log into **Xero**
2. Navigate to **Business** → **Invoices** → **Import**
3. Click **Browse** and select the downloaded CSV file (e.g., `xero-invoices-2026-01-01-to-2026-03-31.csv`)
4. Xero will preview the data — verify:
   - Dates are in `DD/MM/YYYY` format
   - Contact names match your Contacts list
   - Amounts are **positive** (revenue)
   - Invoice statuses are valid Xero statuses (DRAFT, SUBMITTED, AUTHORISED, PAID)
5. Click **Import**
6. Verify imported invoices appear under **Business** → **Invoices**

---

## Appendix: Database Schema

### financial_export_log

```sql
CREATE TABLE financial_export_log (
  id                  VARCHAR(36) NOT NULL PRIMARY KEY,
  tenant_id           VARCHAR(36) NOT NULL,        -- FK → tenant (CASCADE)
  export_type         ENUM('quickbooks_expenses','quickbooks_invoices','xero_expenses','xero_invoices','pl_csv','entries_csv') NOT NULL,
  date_from           DATE NULL,
  date_to             DATE NULL,
  record_count        INTEGER NOT NULL,
  file_name           VARCHAR(255) NOT NULL,
  filters_applied     TEXT NULL,                    -- JSON string of query params
  exported_by_user_id VARCHAR(36) NOT NULL,         -- FK → user (RESTRICT on delete)
  created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

-- Indexes:
-- (tenant_id, export_type)
-- (tenant_id, created_at)
-- (tenant_id, exported_by_user_id)
```

### financial_category_account_mapping

```sql
CREATE TABLE financial_category_account_mapping (
  id                  VARCHAR(36) NOT NULL PRIMARY KEY,
  tenant_id           VARCHAR(36) NOT NULL,         -- FK → tenant (CASCADE)
  category_id         VARCHAR(36) NOT NULL,         -- FK → financial_category (CASCADE)
  platform            ENUM('quickbooks','xero') NOT NULL,
  account_name        VARCHAR(200) NOT NULL,
  account_code        VARCHAR(50) NULL,
  created_by_user_id  VARCHAR(36) NOT NULL,         -- FK → user (RESTRICT)
  updated_by_user_id  VARCHAR(36) NULL,             -- FK → user (SET NULL)
  created_at          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at          DATETIME(3) NOT NULL,         -- managed by Prisma @updatedAt

  UNIQUE (tenant_id, category_id, platform)
);

-- Indexes:
-- (tenant_id, platform)
-- UNIQUE (tenant_id, category_id, platform)
```
