# Sprint 10_6 — ExportService Part 3: Quality Report + Export History

**Module:** Financial
**File:** ./documentation/sprints/financial/f10/sprint_10_6.md
**Type:** Backend — Service Layer
**Depends On:** Sprint 10_5 (all export methods must exist in export.service.ts)
**Gate:** STOP — Quality report must implement all 7 check types. Export history must return paginated results.
**Estimated Complexity:** High

> **You are a masterclass-level engineer who makes Google, Amazon, and Apple engineers jealous of the quality of your work.**

> ⚠️ **WARNING:** This platform is 85% production-ready. Never leave the server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

> ⚠️ **MySQL credentials are in the `.env` file at `/var/www/lead360.app/api/.env` — do NOT hardcode database credentials anywhere.**

---

## Objective

Complete the `ExportService` by adding the data quality report and export history methods. The quality report is the most logic-intensive piece — it performs 7 distinct data quality checks and produces a structured report with severity-ranked issues and per-platform export readiness scores.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/export.service.ts` — confirm all 4 export methods and core helpers exist
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/quality-report-query.dto.ts`
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/export-history-query.dto.ts`
- [ ] Read `/var/www/lead360.app/api/prisma/schema.prisma` — confirm `financial_export_log` table exists

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

### Task 1 — Add `QualityReportQueryDto` import to ExportService

**What:** Add this import to the top of the existing `export.service.ts`:

```typescript
import { QualityReportQueryDto } from '../dto/quality-report-query.dto';
import { ExportHistoryQueryDto } from '../dto/export-history-query.dto';
```

**Acceptance:** Imports added, no compilation errors.

---

### Task 2 — Implement `getQualityReport()`

**What:** Add this public method to the existing `ExportService` class. This is the most complex method — it performs 7 distinct data quality checks.

```typescript
async getQualityReport(tenantId: string, query: QualityReportQueryDto) {
  // 1. Build where clause for entries to check
  const where: any = { tenant_id: tenantId };
  if (query.date_from) {
    where.entry_date = { ...where.entry_date, gte: new Date(query.date_from) };
  }
  if (query.date_to) {
    where.entry_date = { ...where.entry_date, lte: new Date(query.date_to) };
  }

  // 2. Load all entries to check
  const entries = await this.prisma.financial_entry.findMany({
    where,
    select: {
      id: true,
      entry_date: true,
      amount: true,
      vendor_name: true,
      supplier_id: true,
      payment_method: true,
      project_id: true,
      category_id: true,
      category: {
        select: {
          name: true,
          type: true,
          classification: true,
        },
      },
      supplier: {
        select: { name: true },
      },
    },
  });

  const issues: Array<{
    severity: 'error' | 'warning' | 'info';
    check_type: string;
    entry_id: string | null;
    entry_date: string | null;
    amount: number | null;
    category_name: string | null;
    supplier_name: string | null;
    message: string;
  }> = [];

  // ====================
  // CHECK 1: Missing account mapping
  // ====================
  if (query.platform) {
    const accountMap = await this.loadAccountMappings(tenantId, query.platform);
    const categoryNamesChecked = new Set<string>();

    for (const entry of entries) {
      if (!accountMap.has(entry.category_id) && !categoryNamesChecked.has(entry.category_id)) {
        categoryNamesChecked.add(entry.category_id);
        const catName = entry.category?.name || 'Unknown';
        issues.push({
          severity: 'warning',
          check_type: 'missing_account_mapping',
          entry_id: null,
          entry_date: null,
          amount: null,
          category_name: catName,
          supplier_name: null,
          message: `Category "${catName}" has no ${query.platform === 'quickbooks' ? 'QB' : 'Xero'} account mapping — will use category name as account`,
        });
      }
    }
  }

  // ====================
  // CHECK 2: Missing vendor/supplier
  // ====================
  for (const entry of entries) {
    if (!entry.vendor_name && !entry.supplier_id) {
      const entryDate = entry.entry_date instanceof Date
        ? entry.entry_date.toISOString().split('T')[0]
        : String(entry.entry_date).split('T')[0];
      issues.push({
        severity: 'warning',
        check_type: 'missing_vendor',
        entry_id: entry.id,
        entry_date: entryDate,
        amount: Number(entry.amount),
        category_name: entry.category?.name || null,
        supplier_name: null,
        message: `Entry on ${entryDate} has no vendor or supplier — payee will be blank in export`,
      });
    }
  }

  // ====================
  // CHECK 3: Missing project class (COGS type without project)
  // ====================
  for (const entry of entries) {
    const classification = (entry.category as any)?.classification;
    if (classification === 'cost_of_goods_sold' && !entry.project_id) {
      const entryDate = entry.entry_date instanceof Date
        ? entry.entry_date.toISOString().split('T')[0]
        : String(entry.entry_date).split('T')[0];
      issues.push({
        severity: 'info',
        check_type: 'missing_project_class',
        entry_id: entry.id,
        entry_date: entryDate,
        amount: Number(entry.amount),
        category_name: entry.category?.name || null,
        supplier_name: entry.supplier?.name || entry.vendor_name || null,
        message: `Entry on ${entryDate} is a project cost but has no project — no Class tracking in QB`,
      });
    }
  }

  // ====================
  // CHECK 4: Zero amount
  // ====================
  for (const entry of entries) {
    if (Number(entry.amount) === 0) {
      const entryDate = entry.entry_date instanceof Date
        ? entry.entry_date.toISOString().split('T')[0]
        : String(entry.entry_date).split('T')[0];
      issues.push({
        severity: 'error',
        check_type: 'zero_amount',
        entry_id: entry.id,
        entry_date: entryDate,
        amount: 0,
        category_name: entry.category?.name || null,
        supplier_name: entry.supplier?.name || entry.vendor_name || null,
        message: `Entry on ${entryDate} has zero amount — will be rejected by QB/Xero`,
      });
    }
  }

  // ====================
  // CHECK 5: Future date
  // ====================
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999); // End of today UTC

  for (const entry of entries) {
    const entryDate = new Date(entry.entry_date);
    if (entryDate > today) {
      const dateStr = entryDate.toISOString().split('T')[0];
      issues.push({
        severity: 'warning',
        check_type: 'future_date',
        entry_id: entry.id,
        entry_date: dateStr,
        amount: Number(entry.amount),
        category_name: entry.category?.name || null,
        supplier_name: entry.supplier?.name || entry.vendor_name || null,
        message: `Entry dated ${dateStr} is in the future — verify this is correct`,
      });
    }
  }

  // ====================
  // CHECK 6: Missing payment method
  // ====================
  for (const entry of entries) {
    if (!entry.payment_method) {
      const entryDate = entry.entry_date instanceof Date
        ? entry.entry_date.toISOString().split('T')[0]
        : String(entry.entry_date).split('T')[0];
      issues.push({
        severity: 'info',
        check_type: 'missing_payment_method',
        entry_id: entry.id,
        entry_date: entryDate,
        amount: Number(entry.amount),
        category_name: entry.category?.name || null,
        supplier_name: entry.supplier?.name || entry.vendor_name || null,
        message: `Entry on ${entryDate} has no payment method — field will be blank in export`,
      });
    }
  }

  // ====================
  // CHECK 7: Duplicate entry risk
  // ====================
  // Use Prisma groupBy to find duplicates in a single query
  const duplicateGroups = await this.prisma.financial_entry.groupBy({
    by: ['entry_date', 'amount', 'supplier_id'],
    where: {
      ...where,
      supplier_id: { not: null },
    },
    _count: { id: true },
    having: {
      id: { _count: { gt: 1 } },
    },
  });

  for (const group of duplicateGroups) {
    const dateStr = group.entry_date instanceof Date
      ? group.entry_date.toISOString().split('T')[0]
      : String(group.entry_date).split('T')[0];

    // Get supplier name for the message (MUST filter by tenant_id for isolation)
    let supplierName = 'Unknown';
    if (group.supplier_id) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: group.supplier_id, tenant_id: tenantId },
        select: { name: true },
      });
      supplierName = supplier?.name || 'Unknown';
    }

    issues.push({
      severity: 'warning',
      check_type: 'duplicate_entry_risk',
      entry_id: null,
      entry_date: dateStr,
      amount: Number(group.amount),
      category_name: null,
      supplier_name: supplierName,
      message: `Possible duplicate: ${group._count.id} entries on ${dateStr} for $${Number(group.amount).toFixed(2)} from ${supplierName} — review before export`,
    });
  }

  // ====================
  // Sort issues: error first, warning second, info last
  // Within each severity, order by entry_date DESC
  // ====================
  const severityOrder = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    // Within same severity, sort by date descending
    const dateA = a.entry_date || '';
    const dateB = b.entry_date || '';
    return dateB.localeCompare(dateA);
  });

  // ====================
  // Calculate summary
  // ====================
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  const getReadiness = (hasErrors: boolean, hasWarnings: boolean): string => {
    if (hasErrors) return 'errors_present';
    if (hasWarnings) return 'warnings_present';
    return 'ready';
  };

  return {
    total_entries_checked: entries.length,
    total_issues: issues.length,
    errors: errorCount,
    warnings: warningCount,
    infos: infoCount,
    issues,
    export_readiness: {
      quickbooks: getReadiness(errorCount > 0, warningCount > 0),
      xero: getReadiness(errorCount > 0, warningCount > 0),
    },
  };
}
```

**CRITICAL IMPLEMENTATION NOTES:**

1. **Duplicate detection efficiency:** The `groupBy` query finds all duplicate groups in ONE query — it does NOT compare all pairs. This is the efficient approach specified in the contract.

2. **Duplicate detection scope:** Only entries with `supplier_id` set (not null) are checked for duplicates. Two entries without a supplier cannot be compared by supplier.

3. **`classification` field access:** The `classification` field on `financial_category` comes from F-01. If the Prisma type doesn't include it yet, use `(entry.category as any)?.classification` to access it safely.

4. **`supplier_id` field access:** The `supplier_id` field on `financial_entry` comes from F-02. If it doesn't exist yet, Check 2 (missing vendor) should only check `vendor_name`, and Check 7 (duplicates) should be skipped or simplified.

5. **`payment_method` field access:** The `payment_method` field on `financial_entry` comes from F-04. If it doesn't exist yet, Check 6 should be skipped.

6. **`supplier` relation access:** The `supplier` relation on `financial_entry` comes from F-02. If it doesn't exist yet, remove the `supplier` select from the query.

**Acceptance:** All 7 checks implemented. Issues sorted: error → warning → info. Duplicate detection uses `groupBy`. Export readiness correctly reflects severity.

---

### Task 3 — Implement `getExportHistory()`

**What:** Add this public method to the existing `ExportService` class.

```typescript
async getExportHistory(tenantId: string, query: ExportHistoryQueryDto) {
  const where: any = { tenant_id: tenantId };

  if (query.export_type) {
    where.export_type = query.export_type as any;
  }

  const page = query.page || 1;
  const limit = query.limit || 20;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    this.prisma.financial_export_log.findMany({
      where,
      select: {
        id: true,
        export_type: true,
        date_from: true,
        date_to: true,
        record_count: true,
        file_name: true,
        filters_applied: true,
        exported_by_user_id: true,
        created_at: true,
        exported_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    this.prisma.financial_export_log.count({ where }),
  ]);

  // Parse filters_applied JSON for each record
  const parsedData = data.map((record) => ({
    ...record,
    filters_applied: record.filters_applied
      ? JSON.parse(record.filters_applied as string)
      : null,
  }));

  return {
    data: parsedData,
    meta: {
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    },
  };
}
```

**IMPORTANT:** The `exported_by` relation uses the `user` model. Check that the `user` model has `first_name` and `last_name` fields. If these fields are named differently (e.g., `firstName`, `lastName`), adjust the select accordingly. Read the `user` model in `schema.prisma` before implementing.

**Response shape:**
```json
{
  "data": [
    {
      "id": "uuid",
      "export_type": "quickbooks_expenses",
      "date_from": "2026-01-01",
      "date_to": "2026-03-31",
      "record_count": 142,
      "file_name": "quickbooks-expenses-2026-01-01-to-2026-03-31.csv",
      "filters_applied": { "date_from": "2026-01-01", "date_to": "2026-03-31", "include_recurring": false },
      "exported_by": { "id": "uuid", "first_name": "John", "last_name": "Smith" },
      "created_at": "2026-03-17T..."
    }
  ],
  "meta": { "total": 15, "page": 1, "limit": 20, "total_pages": 1 }
}
```

**Acceptance:** Returns paginated list. `filters_applied` parsed from JSON. Export history sorted by `created_at` descending (most recent first). Filtered by tenant_id.

---

### Task 4 — Verify Complete ExportService Compiles

**What:** Verify the complete `export.service.ts` compiles with all methods:

Public methods:
1. `exportQBExpenses(tenantId, userId, query)` — from Sprint 10_4
2. `exportQBInvoices(tenantId, userId, query)` — from Sprint 10_4
3. `exportXeroExpenses(tenantId, userId, query)` — from Sprint 10_5
4. `exportXeroInvoices(tenantId, userId, query)` — from Sprint 10_5
5. `getQualityReport(tenantId, query)` — this sprint
6. `getExportHistory(tenantId, query)` — this sprint

Private methods:
- `formatDateQB(date)`, `formatDateXero(date)`, `loadAccountMappings(tenantId, platform)`, `logExport(...)`, `validateDateRange(dateFrom, dateTo)`, `escapeCsvField(value)`

```bash
cd /var/www/lead360.app/api && npx tsc --noEmit 2>&1 | grep -i "export.service"
```

Then stop the server:
```bash
lsof -i :8000
kill {PID}
```

**Acceptance:** Zero TypeScript errors in the complete export service.

---

## Patterns to Apply

### List Response Envelope
```json
{
  "data": [],
  "meta": { "total": 0, "page": 1, "limit": 20, "total_pages": 0 }
}
```

### Prisma GroupBy for Duplicate Detection
```typescript
const duplicateGroups = await this.prisma.financial_entry.groupBy({
  by: ['entry_date', 'amount', 'supplier_id'],
  where: { tenant_id: tenantId, supplier_id: { not: null } },
  _count: { id: true },
  having: { id: { _count: { gt: 1 } } },
});
```

### Multi-Tenant Enforcement
Every Prisma query MUST include `where: { tenant_id: tenantId }`.

---

## Business Rules Enforced in This Sprint

- BR-09: Quality report is read-only — it flags issues but does not fix them.
- BR-10: Export history is read-only — records cannot be deleted. No delete endpoint exists.
- BR-11: Duplicate entry risk compares by `entry_date + amount + supplier_id` — not by entry ID.
- BR-12: Issues ordered: `error` first, `warning` second, `info` last. Within each severity, ordered by `entry_date DESC`.
- BR-13: `export_readiness` is `errors_present` if ANY error-severity issues, `warnings_present` if any warnings, `ready` otherwise.

---

## Integration Points

| Module | Import Path | What It Provides |
|--------|-------------|------------------|
| `core/database` | `../../../core/database/prisma.service` | `PrismaService` — database access |
| `audit` | `../../audit/services/audit-logger.service` | `AuditLoggerService` |

---

## Quality Report Check Reference

| # | Check | Condition | Severity | Message Template |
|---|-------|-----------|----------|------------------|
| 1 | Missing account mapping | Category has no mapping for requested platform | Warning | `Category "{name}" has no QB/Xero account mapping — will use category name as account` |
| 2 | Missing vendor/supplier | `vendor_name` null AND `supplier_id` null | Warning | `Entry on {date} has no vendor or supplier — payee will be blank in export` |
| 3 | Missing project class | Entry is COGS type but `project_id` is null | Info | `Entry on {date} is a project cost but has no project — no Class tracking in QB` |
| 4 | Zero amount | `amount = 0` | Error | `Entry on {date} has zero amount — will be rejected by QB/Xero` |
| 5 | Future date | `entry_date > TODAY` | Warning | `Entry dated {date} is in the future — verify this is correct` |
| 6 | Missing payment method | `payment_method` null | Info | `Entry on {date} has no payment method — field will be blank in export` |
| 7 | Duplicate entry risk | Same `entry_date + amount + supplier_id` count > 1 | Warning | `Possible duplicate: {count} entries on {date} for ${amount} from {supplier} — review before export` |

---

## Acceptance Criteria

- [ ] `getQualityReport()` added to existing `export.service.ts`
- [ ] `getExportHistory()` added to existing `export.service.ts`
- [ ] All 7 quality check types implemented with correct severity and message format
- [ ] Check 1 (missing account mapping) only runs when `platform` query param is provided
- [ ] Check 3 (missing project class) checks `classification === 'cost_of_goods_sold'`
- [ ] Check 7 (duplicate detection) uses `groupBy` — single efficient query, not O(n²) comparison
- [ ] Issues sorted: error → warning → info, then by entry_date DESC within severity
- [ ] `export_readiness` correctly set for both `quickbooks` and `xero`
- [ ] `getExportHistory()` returns paginated results with correct `meta` envelope
- [ ] `filters_applied` parsed from JSON string to object in history response
- [ ] All queries filter by `tenant_id`
- [ ] ExportService compiles with all 6 public methods
- [ ] No existing ExportService methods modified (only new methods added)
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — The complete `ExportService` must compile with all 6 public methods. All 7 quality report checks must be implemented. `getExportHistory()` must return paginated results. Sprint 10_7 (controllers) depends on all service methods being available.

---

## Handoff Notes

- `ExportService` is now COMPLETE with 6 public methods:
  1. `exportQBExpenses(tenantId, userId, query)` → `{ csv, fileName, recordCount }`
  2. `exportQBInvoices(tenantId, userId, query)` → `{ csv, fileName, recordCount }`
  3. `exportXeroExpenses(tenantId, userId, query)` → `{ csv, fileName, recordCount }`
  4. `exportXeroInvoices(tenantId, userId, query)` → `{ csv, fileName, recordCount }`
  5. `getQualityReport(tenantId, query)` → quality report object
  6. `getExportHistory(tenantId, query)` → paginated list with meta

- `AccountMappingService` (Sprint 10_3) has 5 public methods:
  1. `findAll(tenantId, platform?)`
  2. `upsert(tenantId, userId, dto)`
  3. `delete(tenantId, mappingId, userId)`
  4. `getDefaults(tenantId, platform)`
  5. `resolveAccountName(tenantId, categoryId, platform)`

- Sprint 10_7 creates the controllers that wire these services to HTTP endpoints.
