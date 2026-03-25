# Sprint 10_4 — ExportService Part 1: Core Helpers + QuickBooks Exports

**Module:** Financial
**File:** ./documentation/sprints/financial/f10/sprint_10_4.md
**Type:** Backend — Service Layer
**Depends On:** Sprint 10_1 (schema), Sprint 10_2 (DTOs), Sprint 10_3 (AccountMappingService)
**Gate:** STOP — Date formatter methods must be verified correct. QB export methods must generate valid CSV.
**Estimated Complexity:** High

> **You are a masterclass-level engineer who makes Google, Amazon, and Apple engineers jealous of the quality of your work.**

> ⚠️ **WARNING:** This platform is 85% production-ready. Never leave the server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

> ⚠️ **MySQL credentials are in the `.env` file at `/var/www/lead360.app/api/.env` — do NOT hardcode database credentials anywhere.**

---

## Objective

Build the first part of the `ExportService` — the core helper methods (date formatters, payment method translation, CSV generation, export logging) and the two QuickBooks export methods (expenses and invoices). This is the most complex service in F-10.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/prisma/schema.prisma` — confirm all F-10 tables and all prerequisite models exist
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/account-mapping.service.ts` (Sprint 10_3 output)
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/export-expense-query.dto.ts`
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/export-invoice-query.dto.ts`
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.ts` — understand the existing entry query patterns

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

### Task 1 — Create `ExportService` file with constructor and imports

**What:** Create the file:
`/var/www/lead360.app/api/src/modules/financial/services/export.service.ts`

```typescript
import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { ExportExpenseQueryDto } from '../dto/export-expense-query.dto';
import { ExportInvoiceQueryDto } from '../dto/export-invoice-query.dto';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  // Payment method translation: Lead360 enum → QuickBooks display name
  private readonly PAYMENT_METHOD_QB_MAP: Record<string, string> = {
    cash: 'Cash',
    check: 'Check',
    bank_transfer: 'Bank Transfer',
    venmo: 'Venmo',
    zelle: 'Zelle',
    credit_card: 'Credit Card',
    debit_card: 'Debit Card',
    ACH: 'ACH',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  // Methods defined in Tasks 2–8 below
}
```

**Acceptance:** File exists, imports are correct, class compiles.

---

### Task 2 — Implement `formatDateQB()` and `formatDateXero()`

**CRITICAL: This is the single most common cause of failed imports. Implement first, verify immediately.**

```typescript
/**
 * Format date as MM/DD/YYYY for QuickBooks Online import.
 * QuickBooks uses US date format.
 */
private formatDateQB(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${month}/${day}/${year}`;
}

/**
 * Format date as DD/MM/YYYY for Xero import.
 * Xero uses international date format.
 */
private formatDateXero(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}
```

**IMPORTANT — Use `getUTC*` methods, NOT `getMonth`/`getDate`.** Prisma returns Date objects in UTC. Using non-UTC methods would apply the server timezone and potentially shift dates by one day.

**Test verification (manual — paste into a quick test or console):**
```
Input: new Date('2026-01-15')  → QB: "01/15/2026"   Xero: "15/01/2026"
Input: new Date('2026-12-31')  → QB: "12/31/2026"   Xero: "31/12/2026"
Input: new Date('2026-03-05')  → QB: "03/05/2026"   Xero: "05/03/2026"
Input: new Date('2026-02-28')  → QB: "02/28/2026"   Xero: "28/02/2026"
Input: new Date('2026-09-09')  → QB: "09/09/2026"   Xero: "09/09/2026"   ← same for single-digit months/days (must be zero-padded)
```

**Acceptance:** Both methods produce correct output with zero-padded month/day. Uses UTC methods.

**Do NOT:** Use `toLocaleDateString()` or any locale-dependent formatting. Do not use moment.js or date-fns — keep it simple with native Date methods.

---

### Task 3 — Implement `loadAccountMappings()`

**What:** Private helper that loads the full account mapping table for a tenant + platform into a `Map<string, { account_name: string; account_code: string | null }>` for fast per-row lookups during export.

```typescript
/**
 * Load all account mappings for a tenant+platform into a Map keyed by category_id.
 * Called once per export — NOT per row.
 */
private async loadAccountMappings(
  tenantId: string,
  platform: string,
): Promise<Map<string, { account_name: string; account_code: string | null }>> {
  const mappings = await this.prisma.financial_category_account_mapping.findMany({
    where: { tenant_id: tenantId, platform: platform as any },
  });

  const map = new Map<string, { account_name: string; account_code: string | null }>();
  for (const m of mappings) {
    map.set(m.category_id, {
      account_name: m.account_name,
      account_code: m.account_code,
    });
  }
  return map;
}
```

**Why:** This avoids N+1 queries. For an export of 10,000 rows, we do ONE query for all mappings instead of 10,000 individual lookups.

**Acceptance:** Returns a Map keyed by category_id. One Prisma query total.

---

### Task 4 — Implement `logExport()`

**What:** Private helper that writes an immutable record to `financial_export_log` after a successful export.

```typescript
private async logExport(
  tenantId: string,
  userId: string,
  exportType: string,
  query: any,
  recordCount: number,
  fileName: string,
): Promise<void> {
  await this.prisma.financial_export_log.create({
    data: {
      tenant_id: tenantId,
      export_type: exportType as any,
      date_from: query.date_from ? new Date(query.date_from) : null,
      date_to: query.date_to ? new Date(query.date_to) : null,
      record_count: recordCount,
      file_name: fileName,
      filters_applied: JSON.stringify(query),
      exported_by_user_id: userId,
    },
  });
}
```

**Why:** Every export is logged. The log is written AFTER the CSV is generated (not before), because we need the actual `record_count`.

**Acceptance:** Creates immutable log record. Stores all query params as JSON in `filters_applied`.

---

### Task 5 — Implement `validateDateRange()`

**What:** Private helper to validate the 366-day limit and return parsed dates.

```typescript
private validateDateRange(dateFrom: string, dateTo: string): { from: Date; to: Date } {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);

  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    throw new BadRequestException('Invalid date format for date_from or date_to');
  }

  if (from > to) {
    throw new BadRequestException('date_from must be before or equal to date_to');
  }

  const diffMs = to.getTime() - from.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays > 366) {
    throw new BadRequestException('Date range cannot exceed 366 days. Apply tighter date filters or export in smaller batches.');
  }

  return { from, to };
}
```

**Acceptance:** Throws 400 if dates invalid, date_from > date_to, or range > 366 days.

---

### Task 6 — Implement `escapeCsvField()`

**What:** Private helper to escape CSV field values that contain commas, quotes, or newlines.

```typescript
private escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
```

**Why:** CSV fields with commas or quotes must be wrapped in double quotes, and internal quotes must be doubled. Without this, a vendor name like `"Smith, Jones & Co."` would break the CSV structure.

**Acceptance:** Handles null/undefined, escapes commas and quotes, doubles internal quotes.

---

### Task 7 — Implement `exportQBExpenses()`

**What:** Public method that generates a QuickBooks expense CSV.

```typescript
async exportQBExpenses(
  tenantId: string,
  userId: string,
  query: ExportExpenseQueryDto,
): Promise<{ csv: string; fileName: string; recordCount: number }> {
  // 1. Validate date range
  const { from, to } = this.validateDateRange(query.date_from, query.date_to);

  // 2. Load account mappings for QuickBooks
  const accountMap = await this.loadAccountMappings(tenantId, 'quickbooks');

  // 3. Build Prisma where clause
  const where: any = {
    tenant_id: tenantId,
    entry_date: {
      gte: from,
      lte: to,
    },
  };

  // Default: only confirmed entries
  if (!query.include_pending) {
    where.submission_status = 'confirmed';
  }

  // Default: exclude recurring instances
  if (!query.include_recurring) {
    where.is_recurring_instance = false;
  }

  // Optional filters
  if (query.category_id) {
    where.category_id = query.category_id;
  }
  if (query.project_id) {
    where.project_id = query.project_id;
  }
  if (query.classification) {
    where.category = { classification: query.classification };
  }

  // 4. Query entries with only needed fields
  const entries = await this.prisma.financial_entry.findMany({
    where,
    select: {
      id: true,
      entry_date: true,
      amount: true,
      notes: true,
      vendor_name: true,
      tax_amount: true,
      payment_method: true,
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

  // 6. Build CSV
  const header = 'Date,Description,Amount,Account,Name,Class,Memo,Payment Method,Check No,Tax Amount';

  const rows = entries.map((entry) => {
    const accountInfo = accountMap.get(entry.category_id);
    const accountName = accountInfo ? accountInfo.account_name : (entry.category?.name || 'Uncategorized');
    const payeeName = entry.supplier?.name || entry.vendor_name || '';
    const description = entry.notes || entry.category?.name || '';
    const projectClass = entry.project?.name || '';
    const paymentMethod = entry.payment_method
      ? (this.PAYMENT_METHOD_QB_MAP[entry.payment_method] || String(entry.payment_method))
      : '';
    const taxAmount = entry.tax_amount ? Number(entry.tax_amount) : '';

    return [
      this.formatDateQB(new Date(entry.entry_date)),
      this.escapeCsvField(description),
      Number(entry.amount).toFixed(2),
      this.escapeCsvField(accountName),
      this.escapeCsvField(payeeName),
      this.escapeCsvField(projectClass),
      this.escapeCsvField(entry.notes || ''),
      this.escapeCsvField(paymentMethod),
      '', // Check No — not applicable
      taxAmount !== '' ? Number(taxAmount).toFixed(2) : '',
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');
  const fileName = `quickbooks-expenses-${query.date_from}-to-${query.date_to}.csv`;

  // 7. Log export
  await this.logExport(tenantId, userId, 'quickbooks_expenses', query, entries.length, fileName);

  // 8. Audit log
  await this.auditLogger.logTenantChange({
    action: 'accessed',
    entityType: 'financial_export',
    entityId: 'quickbooks_expenses',
    tenantId,
    actorUserId: userId,
    metadata: { query, recordCount: entries.length, fileName },
    description: `Exported ${entries.length} expense records to QuickBooks CSV`,
  });

  return { csv, fileName, recordCount: entries.length };
}
```

**CRITICAL NOTES:**
1. `entry.amount` must be POSITIVE for QuickBooks. Prisma returns Decimal — convert with `Number(entry.amount).toFixed(2)`.
2. The `supplier` relation on `financial_entry` comes from F-02. If F-02 is not yet implemented, the `supplier` select will fail. In that case, remove the `supplier` select and use only `vendor_name`.
3. The `submission_status`, `is_recurring_instance`, `tax_amount`, and `payment_method` fields on `financial_entry` come from F-01/F-04. If they don't exist yet, the query will fail. This is why Sprint 10_1 has a prerequisite check.
4. The `classification` filter uses a nested `where` on `category.classification` — this requires the field from F-01.

**Acceptance:** Returns CSV string with correct QB header. Amounts are positive. Dates are MM/DD/YYYY. Export logged. 400 on zero records. 400 on >50,000 records.

---

### Task 8 — Implement `exportQBInvoices()`

**What:** Public method that generates a QuickBooks invoice CSV.

```typescript
async exportQBInvoices(
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
    // Never export voided invoices
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

  // 5. Status mapping: Lead360 → QB
  const statusMap: Record<string, string> = {
    draft: 'Draft',
    sent: 'Open',
    partial: 'Partial',
    paid: 'Paid',
  };

  // 6. Build CSV
  const header = 'Invoice No,Customer,Invoice Date,Due Date,Item,Description,Quantity,Rate,Amount,Tax Amount,Status';

  const rows = invoices.map((inv) => {
    const customerName = inv.project
      ? (inv.project.project_number
          ? `${inv.project.name} (${inv.project.project_number})`
          : inv.project.name)
      : 'Unknown Project';
    const invoiceDate = this.formatDateQB(new Date(inv.created_at));
    const dueDate = inv.due_date ? this.formatDateQB(new Date(inv.due_date)) : '';
    const status = statusMap[inv.status] || String(inv.status);
    const taxAmount = inv.tax_amount ? Number(inv.tax_amount).toFixed(2) : '';

    return [
      this.escapeCsvField(inv.invoice_number || ''),
      this.escapeCsvField(customerName),
      invoiceDate,
      dueDate,
      'Services',
      this.escapeCsvField(inv.description || ''),
      '1',
      Number(inv.amount).toFixed(2),
      Number(inv.amount).toFixed(2),
      taxAmount,
      status,
    ].join(',');
  });

  const csv = [header, ...rows].join('\n');
  const fileName = `quickbooks-invoices-${query.date_from}-to-${query.date_to}.csv`;

  // 7. Log export
  await this.logExport(tenantId, userId, 'quickbooks_invoices', query, invoices.length, fileName);

  // 8. Audit log
  await this.auditLogger.logTenantChange({
    action: 'accessed',
    entityType: 'financial_export',
    entityId: 'quickbooks_invoices',
    tenantId,
    actorUserId: userId,
    metadata: { query, recordCount: invoices.length, fileName },
    description: `Exported ${invoices.length} invoice records to QuickBooks CSV`,
  });

  return { csv, fileName, recordCount: invoices.length };
}
```

**CRITICAL NOTES:**
1. The `project_invoice` model comes from F-08. If F-08 is not complete, this method cannot be implemented. The prerequisite check in Sprint 10_1 must verify this.
2. Customer field format: `"Project Name (PRJ-001)"` — uses project name + project_number.
3. Voided invoices are ALWAYS excluded: `status: { not: 'voided' }`.
4. QB status mapping: `draft→Draft`, `sent→Open`, `partial→Partial`, `paid→Paid`.
5. Quantity is always `1` for service invoices.

**Acceptance:** Returns CSV with correct QB invoice header. Voided invoices excluded. Status mapped correctly. Dates MM/DD/YYYY.

---

## Patterns to Apply

### CSV Generation Pattern
1. Load account mapping table once into `Map<categoryId, accountName>`.
2. Query entries using Prisma `findMany()` with `select` — only needed columns.
3. Iterate records and build CSV rows.
4. Concatenate header + data rows into a single string.
5. Log export after CSV is built.

### Multi-Tenant Enforcement
Every Prisma query MUST include `where: { tenant_id: tenantId }`.

### Import Paths
```typescript
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { ExportExpenseQueryDto } from '../dto/export-expense-query.dto';
import { ExportInvoiceQueryDto } from '../dto/export-invoice-query.dto';
```

---

## Business Rules Enforced in This Sprint

- BR-01: Only `confirmed` entries exported by default. `include_pending = true` overrides.
- BR-02: Recurring instances excluded by default. `include_recurring = true` overrides.
- BR-03: Voided invoices NEVER exported.
- BR-04: Date range capped at 366 days.
- BR-05: Maximum 50,000 rows per export.
- BR-06: Every export logged to `financial_export_log`.
- BR-07: QuickBooks uses MM/DD/YYYY dates.
- BR-08: QuickBooks expense amounts must be POSITIVE.
- BR-09: If no account mapping exists, category name used as fallback.

---

## Integration Points

| Module | Import Path | What It Provides |
|--------|-------------|------------------|
| `core/database` | `../../../core/database/prisma.service` | `PrismaService` |
| `audit` | `../../audit/services/audit-logger.service` | `AuditLoggerService` |

---

## Acceptance Criteria

- [ ] `export.service.ts` created at correct path
- [ ] `formatDateQB()` returns MM/DD/YYYY with zero-padded month/day using UTC methods
- [ ] `formatDateXero()` returns DD/MM/YYYY with zero-padded month/day using UTC methods
- [ ] `loadAccountMappings()` returns Map from single Prisma query
- [ ] `logExport()` writes immutable record to `financial_export_log`
- [ ] `validateDateRange()` throws 400 for invalid dates, inverted range, and >366 days
- [ ] `escapeCsvField()` handles commas, quotes, newlines, null/undefined
- [ ] `exportQBExpenses()` generates valid CSV with correct header row
- [ ] `exportQBExpenses()` — amounts are positive, dates are MM/DD/YYYY
- [ ] `exportQBExpenses()` — only confirmed entries by default
- [ ] `exportQBExpenses()` — recurring instances excluded by default
- [ ] `exportQBExpenses()` — throws 400 on zero records and >50,000 records
- [ ] `exportQBInvoices()` generates valid CSV with correct header row
- [ ] `exportQBInvoices()` — voided invoices always excluded
- [ ] `exportQBInvoices()` — status mapped correctly (draft→Draft, sent→Open, etc.)
- [ ] Payment method translated via PAYMENT_METHOD_QB_MAP
- [ ] All queries filter by tenant_id
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — The `formatDateQB()` and `formatDateXero()` methods must produce correct output for at least 5 test dates. The QB export methods must generate syntactically valid CSV with the exact header columns specified. Sprint 10_5 extends this service file with Xero methods.

---

## Handoff Notes

- `ExportService` is at: `/var/www/lead360.app/api/src/modules/financial/services/export.service.ts`
- Public methods so far: `exportQBExpenses()`, `exportQBInvoices()`
- Private helpers: `formatDateQB()`, `formatDateXero()`, `loadAccountMappings()`, `logExport()`, `validateDateRange()`, `escapeCsvField()`, `PAYMENT_METHOD_QB_MAP`
- Sprint 10_5 adds Xero export methods to the SAME file
- Sprint 10_6 adds quality report and export history methods to the SAME file
- Module registration happens in Sprint 10_7
