# Sprint 10_5 — ExportService Part 2: Xero Exports

**Module:** Financial
**File:** ./documentation/sprints/financial/f10/sprint_10_5.md
**Type:** Backend — Service Layer
**Depends On:** Sprint 10_4 (ExportService core + QB methods must exist in the same file)
**Gate:** NONE
**Estimated Complexity:** Medium

> **You are a masterclass-level engineer who makes Google, Amazon, and Apple engineers jealous of the quality of your work.**

> ⚠️ **WARNING:** This platform is 85% production-ready. Never leave the server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

> ⚠️ **MySQL credentials are in the `.env` file at `/var/www/lead360.app/api/.env` — do NOT hardcode database credentials anywhere.**

---

## Objective

Add the two Xero export methods (`exportXeroExpenses` and `exportXeroInvoices`) to the existing `ExportService`. These methods reuse the core helpers from Sprint 10_4 but produce Xero-formatted CSV with different date formats, negative expense amounts, and Xero-specific column headers.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/export.service.ts` — confirm Sprint 10_4 methods exist: `formatDateQB`, `formatDateXero`, `loadAccountMappings`, `logExport`, `validateDateRange`, `escapeCsvField`, `exportQBExpenses`, `exportQBInvoices`
- [ ] Confirm `formatDateXero()` returns DD/MM/YYYY format
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/export-expense-query.dto.ts`
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/export-invoice-query.dto.ts`

---

## Dev Server

> ⚠️ This project does NOT use PM2. Do not reference or run PM2 commands.
> ⚠️ Do NOT use `pkill -f` — it does not work reliably. Always use `lsof` + `kill {PID}`.

```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :8000   ← must return nothing before proceeding

START the dev server:
  cd /var/www/lead360.app/api && npm run start:dev

WAIT — the server takes 60 to 120 seconds to compile and become ready.
Do NOT attempt to hit any endpoint until the health check passes:
  curl -s http://localhost:8000/health   ← must return 200 before proceeding

Keep retrying the health check every 10 seconds until it responds.

KEEP the server running for the entire duration of the sprint.
Do NOT stop and restart between tests — keep it open.

BEFORE marking the sprint COMPLETE:
  lsof -i :8000
  kill {PID}
  Confirm port is free: lsof -i :8000   ← must return nothing
```

---

## Tasks

### Task 1 — Add `exportXeroExpenses()` to ExportService

**What:** Add this public method to the existing `ExportService` class in:
`/var/www/lead360.app/api/src/modules/financial/services/export.service.ts`

**Do NOT create a new file. Add to the existing file.**

```typescript
async exportXeroExpenses(
  tenantId: string,
  userId: string,
  query: ExportExpenseQueryDto,
): Promise<{ csv: string; fileName: string; recordCount: number }> {
  // 1. Validate date range
  const { from, to } = this.validateDateRange(query.date_from, query.date_to);

  // 2. Load account mappings for Xero
  const accountMap = await this.loadAccountMappings(tenantId, 'xero');

  // 3. Build where clause — identical logic to QB expenses
  const where: any = {
    tenant_id: tenantId,
    entry_date: {
      gte: from,
      lte: to,
    },
  };

  if (!query.include_pending) {
    where.submission_status = 'confirmed';
  }
  if (!query.include_recurring) {
    where.is_recurring_instance = false;
  }
  if (query.category_id) {
    where.category_id = query.category_id;
  }
  if (query.project_id) {
    where.project_id = query.project_id;
  }
  if (query.classification) {
    where.category = { classification: query.classification };
  }

  // 4. Query entries
  const entries = await this.prisma.financial_entry.findMany({
    where,
    select: {
      id: true,
      entry_date: true,
      amount: true,
      notes: true,
      vendor_name: true,
      tax_amount: true,
      category_id: true,
      project_id: true,
      category: {
        select: { name: true },
      },
      supplier: {
        select: { name: true },
      },
      project: {
        select: { name: true },
      },
    },
    orderBy: { entry_date: 'asc' },
  });

  // 5. Check record count
  if (entries.length === 0) {
    throw new BadRequestException('No records match the selected filters');
  }
  if (entries.length > 50000) {
    throw new BadRequestException('Export too large. Apply tighter date filters or export by category.');
  }

  // 6. Build Xero CSV
  const header = 'Date,Amount,Payee,Description,Reference,Account Code,Tax Rate,Tracking Name 1';

  const rows = entries.map((entry) => {
    const accountInfo = accountMap.get(entry.category_id);
    const accountCode = accountInfo?.account_code || accountInfo?.account_name || (entry.category?.name || 'Uncategorized');
    const payeeName = entry.supplier?.name || entry.vendor_name || '';
    const description = entry.notes || entry.category?.name || '';
    const reference = entry.id.substring(0, 8); // Short form of UUID
    const trackingName = entry.project?.name || '';

    // Xero tax rate: derive from tax_amount/amount or "Tax Exempt"
    let taxRate = 'Tax Exempt';
    if (entry.tax_amount && Number(entry.tax_amount) > 0 && Number(entry.amount) > 0) {
      const pct = (Number(entry.tax_amount) / Number(entry.amount)) * 100;
      taxRate = `${pct.toFixed(1)}%`;
    }

    // CRITICAL: Xero uses NEGATIVE amounts for expenditure
    const xeroAmount = -Math.abs(Number(entry.amount));

    return [
      this.formatDateXero(new Date(entry.entry_date)),  // DD/MM/YYYY
      xeroAmount.toFixed(2),                             // NEGATIVE
      this.escapeCsvField(payeeName),
      this.escapeCsvField(description),
      reference,
      this.escapeCsvField(accountCode),
      taxRate,
      this.escapeCsvField(trackingName),
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');
  const fileName = `xero-expenses-${query.date_from}-to-${query.date_to}.csv`;

  // 7. Log export
  await this.logExport(tenantId, userId, 'xero_expenses', query, entries.length, fileName);

  // 8. Audit log
  await this.auditLogger.logTenantChange({
    action: 'accessed',
    entityType: 'financial_export',
    entityId: 'xero_expenses',
    tenantId,
    actorUserId: userId,
    metadata: { query, recordCount: entries.length, fileName },
    description: `Exported ${entries.length} expense records to Xero CSV`,
  });

  return { csv, fileName, recordCount: entries.length };
}
```

**KEY DIFFERENCES FROM QB EXPENSES:**
1. **Date format:** `DD/MM/YYYY` (uses `formatDateXero`)
2. **Amount sign:** NEGATIVE (`-Math.abs(...)`) — Xero convention for expenditure
3. **Column headers:** Different from QB — `Date,Amount,Payee,Description,Reference,Account Code,Tax Rate,Tracking Name 1`
4. **Account Code:** Uses `account_code` from mapping if available, falls back to `account_name`, then category name
5. **Tax Rate:** Derived as percentage from `tax_amount/amount`, or "Tax Exempt" if no tax
6. **Reference:** Short form of entry UUID (first 8 chars)
7. **Tracking Name 1:** Xero's version of QB's "Class" — maps to project name

**Acceptance:** Xero CSV has correct header. Dates DD/MM/YYYY. Amounts negative. Tax rate calculated or "Tax Exempt".

---

### Task 2 — Add `exportXeroInvoices()` to ExportService

**What:** Add this public method to the same `ExportService` class.

```typescript
async exportXeroInvoices(
  tenantId: string,
  userId: string,
  query: ExportInvoiceQueryDto,
): Promise<{ csv: string; fileName: string; recordCount: number }> {
  // 1. Validate date range
  const { from, to } = this.validateDateRange(query.date_from, query.date_to);

  // 2. Build where clause
  const where: any = {
    tenant_id: tenantId,
    created_at: {
      gte: from,
      lte: to,
    },
    status: { not: 'voided' },
  };

  if (query.status) {
    where.status = query.status as any;
  }

  // 3. Query invoices
  const invoices = await this.prisma.project_invoice.findMany({
    where,
    select: {
      id: true,
      invoice_number: true,
      amount: true,
      tax_amount: true,
      description: true,
      due_date: true,
      status: true,
      created_at: true,
      project: {
        select: {
          name: true,
          project_number: true,
        },
      },
    },
    orderBy: { created_at: 'asc' },
  });

  // 4. Check record count
  if (invoices.length === 0) {
    throw new BadRequestException('No records match the selected filters');
  }
  if (invoices.length > 50000) {
    throw new BadRequestException('Export too large. Apply tighter date filters.');
  }

  // 5. Xero status mapping
  const xeroStatusMap: Record<string, string> = {
    draft: 'DRAFT',
    sent: 'SUBMITTED',
    partial: 'AUTHORISED',
    paid: 'PAID',
  };

  // 6. Build Xero invoice CSV
  const header = 'ContactName,InvoiceNumber,InvoiceDate,DueDate,Description,Quantity,UnitAmount,TaxType,AccountCode,TaxAmount,InvoiceStatus';

  const rows = invoices.map((inv) => {
    const contactName = inv.project?.name || 'Unknown Project';
    const invoiceDate = this.formatDateXero(new Date(inv.created_at));  // DD/MM/YYYY
    const dueDate = inv.due_date ? this.formatDateXero(new Date(inv.due_date)) : '';
    const taxType = (inv.tax_amount && Number(inv.tax_amount) > 0) ? 'Tax Exclusive' : 'No Tax';
    const taxAmount = inv.tax_amount ? Number(inv.tax_amount).toFixed(2) : '';
    const status = xeroStatusMap[inv.status] || String(inv.status).toUpperCase();

    return [
      this.escapeCsvField(contactName),
      this.escapeCsvField(inv.invoice_number || ''),
      invoiceDate,
      dueDate,
      this.escapeCsvField(inv.description || ''),
      '1',
      Number(inv.amount).toFixed(2),
      taxType,
      '',  // AccountCode — configurable via category mapping, default empty for revenue
      taxAmount,
      status,
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');
  const fileName = `xero-invoices-${query.date_from}-to-${query.date_to}.csv`;

  // 7. Log export
  await this.logExport(tenantId, userId, 'xero_invoices', query, invoices.length, fileName);

  // 8. Audit log
  await this.auditLogger.logTenantChange({
    action: 'accessed',
    entityType: 'financial_export',
    entityId: 'xero_invoices',
    tenantId,
    actorUserId: userId,
    metadata: { query, recordCount: invoices.length, fileName },
    description: `Exported ${invoices.length} invoice records to Xero CSV`,
  });

  return { csv, fileName, recordCount: invoices.length };
}
```

**KEY DIFFERENCES FROM QB INVOICES:**
1. **Date format:** `DD/MM/YYYY` (uses `formatDateXero`)
2. **Column headers:** Xero format — `ContactName,InvoiceNumber,InvoiceDate,...`
3. **Status values:** UPPERCASE — `DRAFT`, `SUBMITTED`, `AUTHORISED`, `PAID`
4. **TaxType:** `"Tax Exclusive"` or `"No Tax"` (not a percentage like expense export)
5. **ContactName:** Just project name (no project_number in parens, unlike QB)
6. **AccountCode:** Empty by default for revenue — configurable via category mapping in future

**Acceptance:** Xero invoice CSV has correct header. Dates DD/MM/YYYY. Status values uppercase. Voided invoices excluded.

---

### Task 3 — Verify All Export Methods Compile

**What:** Start the dev server and verify the export service compiles without TypeScript errors.

```bash
cd /var/www/lead360.app/api && npx tsc --noEmit 2>&1 | grep -i "export.service"
```

If no errors, the service is clean. If there are errors, fix them.

Then stop the server:
```bash
lsof -i :8000
kill {PID}
```

**Acceptance:** Zero TypeScript errors in `export.service.ts`.

---

## Patterns to Apply

### Xero Amount Convention
```typescript
// CRITICAL: Xero uses NEGATIVE amounts for expenditure
const xeroAmount = -Math.abs(Number(entry.amount));
```

### Xero Date Format
```typescript
// DD/MM/YYYY — international format
this.formatDateXero(new Date(entry.entry_date))
```

### Xero Status Values (Invoices)
| Lead360 Status | Xero Status |
|----------------|-------------|
| `draft` | `DRAFT` |
| `sent` | `SUBMITTED` |
| `partial` | `AUTHORISED` |
| `paid` | `PAID` |

### Xero Tax Rate (Expenses)
```typescript
// Derived from tax_amount / amount as percentage, or "Tax Exempt"
let taxRate = 'Tax Exempt';
if (entry.tax_amount && Number(entry.tax_amount) > 0) {
  const pct = (Number(entry.tax_amount) / Number(entry.amount)) * 100;
  taxRate = `${pct.toFixed(1)}%`;
}
```

---

## Business Rules Enforced in This Sprint

- BR-07: Xero uses `DD/MM/YYYY` date format — the most common import failure cause when wrong.
- BR-08: Xero expense amounts must be NEGATIVE (expenditure convention).
- BR-03: Voided invoices NEVER exported.
- BR-06: Every export logged to `financial_export_log`.
- BR-05: Maximum 50,000 rows per export.

---

## Integration Points

None new — reuses the same PrismaService and AuditLoggerService already injected in Sprint 10_4.

---

## Acceptance Criteria

- [ ] `exportXeroExpenses()` added to existing `export.service.ts`
- [ ] `exportXeroInvoices()` added to existing `export.service.ts`
- [ ] Xero expense CSV header: `Date,Amount,Payee,Description,Reference,Account Code,Tax Rate,Tracking Name 1`
- [ ] Xero invoice CSV header: `ContactName,InvoiceNumber,InvoiceDate,DueDate,Description,Quantity,UnitAmount,TaxType,AccountCode,TaxAmount,InvoiceStatus`
- [ ] Xero expense dates formatted as DD/MM/YYYY
- [ ] Xero invoice dates formatted as DD/MM/YYYY
- [ ] Xero expense amounts are NEGATIVE
- [ ] Xero invoice amounts are POSITIVE (revenue, not expenditure)
- [ ] Xero invoice status values are UPPERCASE: DRAFT, SUBMITTED, AUTHORISED, PAID
- [ ] Tax rate derived from tax_amount/amount percentage or "Tax Exempt"
- [ ] Voided invoices always excluded
- [ ] All exports logged to `financial_export_log`
- [ ] All queries filter by tenant_id
- [ ] No existing ExportService methods modified (only new methods added)
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

NONE — Sprint 10_6 can proceed after this sprint completes.

---

## Handoff Notes

- `ExportService` now has 4 public export methods: `exportQBExpenses`, `exportQBInvoices`, `exportXeroExpenses`, `exportXeroInvoices`
- Sprint 10_6 adds `getQualityReport()` and `getExportHistory()` to the same file
- Module registration happens in Sprint 10_7
