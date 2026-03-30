# Sprint 22 — Accounting Exports (QuickBooks & Xero)
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_22.md
**Type:** Frontend — Export Page
**Depends On:** Sprint 1, Sprint 2, Sprint 21
**Gate:** NONE
**Estimated Complexity:** Medium

---

## Objective

Build the Accounting Exports page at `/financial/exports`. Users can export their financial data as CSV files for import into QuickBooks or Xero, run quality reports before exporting, and view export history.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Section 23 (Accounting Exports).
- **Always use modal prompts, never system prompts.**
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Dev Server

```
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# Quality report
curl -s "http://localhost:8000/api/v1/financial/export/quality-report" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Export history
curl -s "http://localhost:8000/api/v1/financial/export/history" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# Export QuickBooks expenses (returns CSV)
curl -s "http://localhost:8000/api/v1/financial/export/quickbooks/expenses?date_from=2026-01-01&date_to=2026-12-31" \
  -H "Authorization: Bearer $TOKEN" --output qb-expenses.csv
```

---

## Tasks

### Task 1 — Exports Page with Tabs

**Path:** `/var/www/lead360.app/app/src/app/(dashboard)/financial/exports/page.tsx`

**Tabs:**
| Tab | Description |
|-----|-------------|
| Export | Generate new exports |
| Quality Report | Check data quality before exporting |
| History | View past exports |
| Account Mappings | Configure category-to-account mappings (Sprint 21 — link) |

---

### Task 2 — Export Tab

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Export Financial Data                                 │
│                                                       │
│  [Export] [Quality Report] [History] [Mappings →]      │
│                                                       │
│  ── Choose Export Type ──                              │
│                                                       │
│  ┌─────────────────────┐  ┌─────────────────────┐    │
│  │ 📊 QuickBooks        │  │ 📊 Xero              │    │
│  │                      │  │                      │    │
│  │ [Export Expenses]    │  │ [Export Expenses]    │    │
│  │ [Export Invoices]    │  │ [Export Invoices]    │    │
│  └─────────────────────┘  └─────────────────────┘    │
│                                                       │
│  When you click an export button, configure the       │
│  date range and filters below.                        │
└──────────────────────────────────────────────────────┘
```

### Task 3 — Export Configuration Modal

When clicking any of the 4 export buttons, open a configuration modal:

**Title:** "Export {Platform} {Type}" (e.g., "Export QuickBooks Expenses")

**For Expense Exports:**
| Field | Component | Required | Notes |
|-------|-----------|----------|-------|
| Date From | DatePicker | Yes | ISO format |
| Date To | DatePicker | Yes | ISO format, max 366 days range |
| Category | Select with search | No | Filter by category |
| Classification | Select | No | COGS / OpEx |
| Project | Select with search | No | Filter by project |
| Include Recurring | Checkbox | No | Default: unchecked |
| Include Pending | Checkbox | No | Default: unchecked |

**For Invoice Exports:**
| Field | Component | Required | Notes |
|-------|-----------|----------|-------|
| Date From | DatePicker | Yes | ISO format |
| Date To | DatePicker | Yes | ISO format |
| Status | Select | No | draft, sent, partial, paid (NOT voided) |

**Validation:**
- Date range required
- Max 366 days between dates
- Show warning if range is very large (>180 days)

**Export flow:**
1. User fills in form, clicks "Export"
2. Show loading spinner
3. Call appropriate API: `exportQuickbooksExpenses()`, `exportQuickbooksInvoices()`, `exportXeroExpenses()`, `exportXeroInvoices()`
4. Receive Blob
5. Trigger download with correct filename
6. Toast: "Export downloaded — {X} records"
7. If API returns 400 (no matching records), toast error: "No records match your filters"

**Download helper:**
```typescript
const triggerDownload = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};
```

---

### Task 4 — Quality Report Tab

**API:** `getQualityReport({ date_from?, date_to?, platform? })`

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Data Quality Report                                  │
│                                                       │
│  [Date From] [Date To] [Platform: QuickBooks ▼]       │
│                                   [Run Report]        │
│                                                       │
│  ── Summary ──                                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│
│  │ Entries  │ │ Errors   │ │ Warnings │ │ Info     ││
│  │ Checked  │ │          │ │          │ │          ││
│  │ 42       │ │ 0        │ │ 6        │ │ 4        ││
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘│
│                                                       │
│  ── Issues ──                                         │
│  ┌──────────────────────────────────────────────────┐│
│  │ ⚠️ WARNING — Missing Vendor                      ││
│  │ Entry on 2026-03-17 | $542 | Miscellaneous       ││
│  │ "Payee will be blank in export"                   ││
│  ├──────────────────────────────────────────────────┤│
│  │ ℹ️ INFO — No Account Mapping                     ││
│  │ Entry on 2026-03-16 | $1,500 | Labor - General  ││
│  │ "Category name will be used as account name"      ││
│  └──────────────────────────────────────────────────┘│
│                                                       │
│  ✅ No errors found — safe to export!                 │
│  ⚠️ 6 warnings — entries may have blank fields       │
└──────────────────────────────────────────────────────┘
```

**Features:**
- Date range + platform filters
- "Run Report" button to execute
- Summary cards: entries checked, errors, warnings, infos
- Issue list with severity icons and color
- Each issue shows: severity, check type, entry date, amount, category, message
- Overall assessment: if errors > 0, show red warning; if only warnings/info, show green

**Issue severity styling:**
- `error` → red card border + red icon
- `warning` → yellow card border + warning icon
- `info` → blue card border + info icon

---

### Task 5 — Export History Tab

**API:** `getExportHistory({ export_type?, page?, limit? })`

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│  Export History                                        │
│                                                       │
│  Filter: [Export Type ▼]                              │
│                                                       │
│  ┌──────────────────────────────────────────────────┐│
│  │ 📤 xero-expenses-2026-01-01-to-2026-12-31.csv   ││
│  │ Type: Xero Expenses | Records: 6                 ││
│  │ Date Range: Jan 1 — Dec 31, 2026                 ││
│  │ Exported by: Ludson Menezes | Mar 25, 2026       ││
│  │ Filters: No recurring, no pending                ││
│  ├──────────────────────────────────────────────────┤│
│  │ 📤 quickbooks-expenses-2026-01-01-to-2026-12.csv ││
│  │ Type: QuickBooks Expenses | Records: 6            ││
│  │ Date Range: Jan 1 — Dec 31, 2026                 ││
│  │ Exported by: Ludson Menezes | Mar 25, 2026       ││
│  └──────────────────────────────────────────────────┘│
│                                                       │
│  [← Previous]  Page 1 of 1  [Next →]                │
└──────────────────────────────────────────────────────┘
```

**Features:**
- Filter by export type (6 types)
- Pagination
- Each entry shows: filename, type badge, record count, date range, who exported, when, filters used
- Export type badges with colors:
  - quickbooks_expenses → green
  - quickbooks_invoices → blue
  - xero_expenses → teal
  - xero_invoices → purple
  - pl_csv → orange
  - entries_csv → gray

**Export type labels:**
```
quickbooks_expenses → "QuickBooks Expenses"
quickbooks_invoices → "QuickBooks Invoices"
xero_expenses → "Xero Expenses"
xero_invoices → "Xero Invoices"
pl_csv → "P&L Report"
entries_csv → "Entries CSV"
```

---

## Acceptance Criteria
- [ ] Export page with 4 tabs
- [ ] 4 export buttons (QB/Xero x Expenses/Invoices)
- [ ] Configuration modal with date range and filters
- [ ] CSV downloads with correct filenames
- [ ] Error handling for no matching records
- [ ] Quality report runs with date/platform filters
- [ ] Quality summary cards show counts
- [ ] Issues listed with severity styling
- [ ] Export history with type filter and pagination
- [ ] History shows all export metadata
- [ ] RBAC: Owner, Admin, Bookkeeper
- [ ] Mobile responsive, dark mode
- [ ] No backend code modified

---

## Handoff Notes
- All export endpoints return `Content-Type: text/csv` blobs
- QuickBooks uses MM/DD/YYYY dates; Xero uses DD/MM/YYYY — handled by backend
- Export returns 400 if no records match — handle as user-friendly error
- Max 50,000 rows per export
- Max 366 days date range
- Every export is logged — appears in history automatically
- Voided invoices are NEVER included in exports
- Quality report `check_type` values: missing_vendor, no_account_mapping, zero_amount, etc.
