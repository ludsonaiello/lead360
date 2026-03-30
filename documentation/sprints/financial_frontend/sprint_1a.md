# Sprint 1a — TypeScript Types (Core: Enums, Categories, Entries, Receipts, Payment Methods, Suppliers, Products)
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_1a.md
**Type:** Frontend — Foundation (Types Part 1 of 2)
**Depends On:** NONE
**Gate:** STOP — Sprint 1b depends on this file being written first
**Estimated Complexity:** Medium

---

## Objective

Create the first half of TypeScript type definitions for the financial module. This sprint covers all enum types, shared generics, and entity/DTO types for: Financial Categories, Financial Entries, Receipts & OCR, Payment Methods, Supplier Categories, Suppliers, and Supplier Products. Sprint 1b will add the remaining types (Recurring Rules, Milestones, Invoices, Dashboard, Exports).

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation at `/var/www/lead360.app/api/documentation/financial_REST_API.md` — Sections 1-11.
- **Follow the exact same patterns** already used in the codebase. Read existing files first.
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Pre-Sprint Checklist
- [ ] Read `/var/www/lead360.app/app/src/lib/types/financial.ts` — existing types (will be replaced)
- [ ] Read `/var/www/lead360.app/app/src/lib/types/projects.ts` — type patterns to follow
- [ ] Read `/var/www/lead360.app/api/documentation/financial_REST_API.md` — Sections 4-11 (Enums, Categories, Entries, Receipts, Payment Methods, Suppliers, Products)
- [ ] Backend server running on port 8000

---

## Dev Server (Backend — Read Only)

```
CHECK if port 8000 is already in use:
  lsof -i :8000

The backend must be running. If not running, start it:
  cd /var/www/lead360.app/api && npm run start:dev

WAIT for health check:
  curl -s http://localhost:8000/health   ← must return 200

Get an auth token for testing:
  curl -s -X POST http://localhost:8000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq '.access_token'

Save the token for endpoint verification.
```

---

## Tasks

### Task 1 — Verify Core Endpoints Against Real API

Hit these endpoints to verify response shapes BEFORE writing types:

```bash
TOKEN="your-token-here"

# Categories — verify classification field exists
curl -s http://localhost:8000/api/v1/settings/financial-categories -H "Authorization: Bearer $TOKEN" | jq '.[0]'

# Entries — verify all enriched fields
curl -s "http://localhost:8000/api/v1/financial/entries?limit=1" -H "Authorization: Bearer $TOKEN" | jq '.'

# Payment Methods — verify usage_count and last_used_date
curl -s http://localhost:8000/api/v1/financial/payment-methods -H "Authorization: Bearer $TOKEN" | jq '.[0]'

# Suppliers list (lightweight)
curl -s "http://localhost:8000/api/v1/financial/suppliers?limit=1" -H "Authorization: Bearer $TOKEN" | jq '.data[0]'

# Supplier Categories
curl -s http://localhost:8000/api/v1/financial/supplier-categories -H "Authorization: Bearer $TOKEN" | jq '.[0]'

# Receipts
curl -s "http://localhost:8000/api/v1/financial/receipts?project_id=f87e2a4c-a745-45c8-a47d-90f7fc4e8285" -H "Authorization: Bearer $TOKEN" | jq '.data[0]'
```

Use the LIVE response as source of truth. Document any differences from the API doc.

---

### Task 2 — Rewrite Financial Types File (Part 1)

**File:** `/var/www/lead360.app/app/src/lib/types/financial.ts`

Replace the ENTIRE file. Start with a header comment, then write ALL sections below. Sprint 1b will ADD to this file (not replace it).

**IMPORTANT:** Write ALL enum types in this sprint (even ones used by sections in Sprint 1b like recurring rules, milestones, invoices, dashboard, exports). This ensures Sprint 1b can reference them without re-declaring.

Write the following sections in this exact order. Copy the TypeScript code blocks below EXACTLY — every field name, type, and nullability has been verified against the live API:

---

**Section 1 — Enums (ALL enum union types for the entire module):**
```typescript
// Lead360 - Financial Module Type Definitions
// Complete types for all 109 endpoints
// Based on verified API responses from financial_REST_API.md

// ========== ENUM TYPES ==========

// API Section 4: payment_method
export type PaymentMethodType = 'cash' | 'check' | 'bank_transfer' | 'venmo' | 'zelle' | 'credit_card' | 'debit_card' | 'ACH';

// API Section 4: financial_category_type (12 values)
export type CategoryType = 'labor' | 'material' | 'subcontractor' | 'equipment' | 'insurance' | 'fuel' | 'utilities' | 'office' | 'marketing' | 'taxes' | 'tools' | 'other';

// API Section 4: financial_category_classification
export type CategoryClassification = 'cost_of_goods_sold' | 'operating_expense';

// API Section 4: financial_entry_type
export type EntryType = 'expense' | 'income';

// API Section 4: expense_submission_status
export type SubmissionStatus = 'pending_review' | 'confirmed';

// API Section 4: recurring_frequency
export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';

// API Section 4: recurring_rule_status
export type RecurringRuleStatus = 'active' | 'paused' | 'completed' | 'cancelled';

// API Section 4: receipt
export type OcrStatus = 'not_processed' | 'processing' | 'complete' | 'failed';
export type ReceiptFileType = 'photo' | 'pdf';

// API Section 4: milestone
export type MilestoneStatus = 'pending' | 'invoiced' | 'paid';
export type DrawCalculationType = 'percentage' | 'fixed_amount';

// API Section 4: invoice_status_extended
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'voided';

// API Section 4: subcontractor_invoice_status
export type SubcontractorInvoiceStatus = 'pending' | 'approved' | 'paid';

// API Section 4: export_type
export type ExportType = 'quickbooks_expenses' | 'quickbooks_invoices' | 'xero_expenses' | 'xero_invoices' | 'pl_csv' | 'entries_csv';

// API Section 4: accounting_platform
export type AccountingPlatform = 'quickbooks' | 'xero';

// Dashboard alert types (API Section 21.7)
export type AlertType = 'cost_overrun' | 'overdue_invoice' | 'upcoming_obligation' | 'budget_warning';
export type AlertSeverity = 'info' | 'warning' | 'error';
```

---

**Section 2 — Shared/Generic Types:**
```typescript
// ========== SHARED TYPES ==========

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages?: number;  // Used by: entries, pending, recurring rules, export history, project receipts
    pages?: number;        // Used by: suppliers, receipts, crew hours, crew payments, sub invoices, sub payments
    totalPages?: number;   // Used by: project invoices (camelCase!)
  };
}

// Helper to get page count from any meta format the API returns
export function getPageCount(meta: PaginatedResponse<unknown>['meta']): number {
  return meta.total_pages ?? meta.pages ?? meta.totalPages ?? 1;
}
```

---

**Sections 3-8** — Write the Financial Categories, Financial Entries (enriched), Receipts & OCR, Payment Method Registry, Suppliers (categories, list item, full detail, DTOs, statistics, map), and Supplier Products type blocks.

Copy them EXACTLY as shown in the sprint_1.md file sections 3 through 8. They have been verified against the API documentation. Key things to verify when writing:

**Financial Categories (Section 3):**
- MUST include `classification: CategoryClassification` field (missing from current types!)
- `CreateCategoryDto` has optional `classification` field
- `UpdateCategoryDto` has optional `classification` field (but BLOCKED for system defaults by backend)

**Financial Entries (Section 4) — CRITICAL CHANGES from current types:**
- The `FinancialEntry` interface is the ENRICHED response (38 fields, not the raw 17-field version)
- `amount` is `string` (NOT `number | string` as in current code)
- `category` is NOT a nested object anymore — it's flattened to `category_name`, `category_type`, `category_classification`
- All `_name` suffix fields are enriched human-readable labels from the backend
- `FinancialEntryListResponse` extends `PaginatedResponse` and adds a `summary` object
- `ListFinancialEntriesParams` has 20+ filter fields including `search`, `sort_by`, `sort_order`
- `ListPendingEntriesParams` has `submitted_by_user_id` filter (for approval queue)

**Receipts & OCR (Section 5):**
- `Receipt` interface includes optional `uploaded_by` nested object (present in list response but not upload response)
- `OcrStatusResponse` is a separate shape from `Receipt` — includes `has_suggestions` boolean
- `CreateEntryFromReceiptDto` has `project_id` (REQUIRED) and `category_id` (REQUIRED)
- `CreateEntryFromReceiptResponse` returns `{ entry, receipt }` composite

**Payment Method Registry (Section 6):**
- `usage_count` and `last_used_date` are computed/enriched fields from backend
- List response is a FLAT ARRAY (not paginated)

**Suppliers (Section 7):**
- `SupplierListItem` is the lightweight list version
- `Supplier` extends `SupplierListItem` with full detail + `products[]` array
- `total_spend` is a STRING (decimal) — must be parsed on frontend
- `ListSuppliersParams` supports 4 sort fields

**Supplier Products (Section 8):**
- `unit_price` is a STRING (decimal) — must be parsed
- `PriceHistoryEntry` has `previous_price` and `new_price` as strings

---

**Section 15 — Crew Hours & Payments (keep existing types, verify they match):**

Keep these existing types but verify field accuracy against API doc sections 17-20:
- `CrewMemberRef`, `ProjectRef`, `TaskRef`
- `CrewHourLog` — verify `hours_regular` and `hours_overtime` are `string` (decimal from API)
- `CreateCrewHourDto`, `UpdateCrewHourDto`
- `CrewMemberHourSummary`
- `CrewPayment`, `CreateCrewPaymentDto`
- `SubcontractorRef`, `SubcontractorPayment`, `CreateSubcontractorPaymentDto`
- `SubcontractorInvoice`, `CreateSubcontractorInvoiceDto`, `UpdateSubcontractorInvoiceDto`
- `SubcontractorPaymentSummary`
- `CrewMember`, `Subcontractor`

**IMPORTANT:** Update the `PaymentMethod` type alias to `PaymentMethodType` with all 8 values (current code only has 5).

---

### Task 3 — Verify Partial Compilation

```bash
cd /var/www/lead360.app/app
npx tsc --noEmit 2>&1 | grep "financial" | head -20
```

Fix any TypeScript errors in the types file. Some import errors in other files referencing old type names are expected and will be fixed when Sprint 1b completes.

---

## Acceptance Criteria
- [ ] All 21 enum union types written (covering the ENTIRE module)
- [ ] `PaginatedResponse<T>` generic with all 3 pagination field variants
- [ ] `getPageCount()` helper function
- [ ] Financial Categories with `classification` field (was missing)
- [ ] Financial Entries with all 38 enriched fields
- [ ] `FinancialEntryListResponse` with `summary` object
- [ ] All entry filter params (20+ fields including `search`, `sort_by`, `sort_order`)
- [ ] `ListPendingEntriesParams` with `submitted_by_user_id`
- [ ] Receipts with `OcrStatusResponse` and `CreateEntryFromReceiptDto` (requires `project_id` + `category_id`)
- [ ] Payment Methods with `usage_count` and `last_used_date`
- [ ] Suppliers (list item + full detail + statistics + map item)
- [ ] Supplier Products with `PriceHistoryEntry`
- [ ] Crew/Subcontractor types preserved and verified
- [ ] `PaymentMethodType` has all 8 values (was only 5)
- [ ] `CategoryType` has all 12 values (was only 5)
- [ ] No backend code modified
- [ ] File compiles (some downstream import errors acceptable)

---

## Gate Marker
**STOP** — Sprint 1b adds remaining types to this file. Do not proceed until this sprint passes compilation check.

---

## Handoff Notes
- Types file location: `/var/www/lead360.app/app/src/lib/types/financial.ts`
- Sprint 1b will ADD sections 9-14 (Recurring, Milestones, Invoices, Summary, Dashboard, Exports) to this file
- Sprint 1c will write the API client functions
- All amounts from API are strings — note in comments where `parseFloat()` needed
- Pagination uses 3 different field names — `getPageCount()` helper handles all 3
