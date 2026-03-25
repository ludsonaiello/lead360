# Sprint 9_2 — DashboardService — Accounts Receivable + Accounts Payable

**Module:** Financial
**File:** `./documentation/sprints/financial/f09/sprint_9_2.md`
**Type:** Backend
**Depends On:** Sprint 9_1 must be complete (DashboardService exists with getPL())
**Gate:** STOP — getAR() and getAP() return correct data structures, no compilation errors
**Estimated Complexity:** Medium-High

---

## Engineer Standards

You are a masterclass-level backend engineer whose work makes Google, Amazon, and Apple engineers jealous of the quality of your code. Every line you write is precise, efficient, and production-ready.

**CRITICAL WARNINGS:**
- This platform is **85% production-ready**. Never break existing code. Not a single comma may break existing business logic.
- Never leave the dev server running in the background when you finish.
- Read the codebase thoroughly before touching anything. Implement with surgical precision.
- MySQL credentials are in the `.env` file at `/var/www/lead360.app/api/.env` — never hardcode credentials.
- This project does **NOT** use PM2. Do not reference or run any PM2 command.
- Never use `pkill -f` — always use `lsof -i :8000` + `kill {PID}`.

---

## Objective

Add `getAR()` and `getAP()` methods to the existing `DashboardService`. The AR method provides a complete accounts receivable summary with aging buckets and an invoice list. The AP method provides accounts payable awareness — outstanding subcontractor invoices, upcoming recurring expenses, and crew hours summary.

---

## Pre-Sprint Checklist

- [ ] Read `api/src/modules/financial/services/dashboard.service.ts` — confirm it exists from Sprint 9_1 with getPL() and the `toNum()` helper
- [ ] Read `api/src/modules/financial/services/recurring-expense.service.ts` — confirm `getPreview()` method signature and return type
- [ ] Read `api/prisma/schema.prisma` — confirm these models and fields:
  - `project_invoice`: `id`, `tenant_id`, `project_id`, `invoice_number`, `amount`, `tax_amount`, `amount_paid`, `amount_due`, `status` (enum `invoice_status_extended`: draft, sent, partial, paid, voided), `due_date`, `sent_at`, `created_at`
  - `subcontractor_task_invoice`: `id`, `tenant_id`, `subcontractor_id`, `task_id`, `project_id`, `amount`, `status` (enum `invoice_status`: pending, approved, paid), `invoice_date`, `created_at`
  - `subcontractor`: `id`, `tenant_id`, `first_name`, `last_name` (or check actual name fields)
  - `crew_hour_log`: `id`, `tenant_id`, `crew_member_id`, `hours_regular`, `hours_overtime`, `log_date`
  - `recurring_expense_rule`: confirm fields `id`, `name`, `amount`, `next_due_date`, `frequency`, `status`, `vendor_name`
- [ ] Confirm `RecurringExpenseService.getPreview()` is callable from DashboardService (both in same module)

---

## Dev Server

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

### Task 1 — Implement getAR() Method

**What:** Add the `getAR()` method to `DashboardService` that returns accounts receivable summary with aging buckets and invoice list.

**File:** `api/src/modules/financial/services/dashboard.service.ts` (add to existing file)

**Method signature:**
```typescript
async getAR(
  tenantId: string,
  query: { status?: string; overdue_only?: boolean },
): Promise<ARResponse>
```

**Algorithm — step by step:**

**Step 1 — Build the where clause:**
```typescript
const where: any = {
  tenant_id: tenantId,
  status: { not: 'voided' },  // ALWAYS exclude voided — this is non-negotiable
};

// If status filter is provided, apply it BUT never allow 'voided'
if (query.status && query.status !== 'voided') {
  where.status = query.status;  // Override with specific status (e.g., 'sent', 'partial')
}
// If query.status is 'voided' or undefined, the default { not: 'voided' } remains
```

**CRITICAL:** The voided exclusion must NEVER be overridden. If someone passes `?status=voided`, ignore it and keep the default `{ not: 'voided' }` filter.

**Step 2 — Fetch all matching invoices with project details:**
```typescript
const invoices = await this.prisma.project_invoice.findMany({
  where,
  include: {
    project: {
      select: { id: true, name: true, project_number: true },
    },
  },
  orderBy: [
    { due_date: 'asc' },
  ],
});
```

**Note:** We need `findMany` here (not aggregate) because we need per-invoice details for the invoice list and aging bucket assignment. This is acceptable because invoices per tenant are typically in the hundreds, not millions.

**Step 3 — Compute today's date:**
```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);
```

**Step 4 — Map invoices to processed array with computed fields:**

**CRITICAL:** Create a `processedInvoices` array by mapping each raw invoice to include computed fields. This array is used in Steps 5-9.

```typescript
const processedInvoices = invoices.map(invoice => {
  const amountDue = this.toNum(invoice.amount_due);
  const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;

  // days_outstanding: days since sent (null if not sent)
  const daysOutstanding = invoice.sent_at
    ? Math.floor((today.getTime() - new Date(invoice.sent_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // is_overdue: past due_date and has amount_due > 0
  const isOverdue = dueDate !== null && dueDate < today && amountDue > 0;

  // days_overdue: null if not overdue
  const daysOverdue = isOverdue
    ? Math.floor((today.getTime() - dueDate!.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    ...invoice,                // All original Prisma fields (id, invoice_number, project, etc.)
    amountDue,                 // Computed: number (not Prisma.Decimal)
    dueDate,                   // Computed: Date | null
    daysOutstanding,           // Computed: number | null
    isOverdue,                 // Computed: boolean
    daysOverdue,               // Computed: number | null
  };
});
```

**Note:** The spread `...invoice` preserves all original fields. The computed fields are added on top. This `processedInvoices` array is used in ALL subsequent steps.

**Step 5 — Assign aging buckets:**

Initialize:
```typescript
const agingBuckets = {
  current: 0,
  days_1_30: 0,
  days_31_60: 0,
  days_61_90: 0,
  days_over_90: 0,
};
```

Loop over `processedInvoices` and assign each to a bucket:
```typescript
for (const inv of processedInvoices) {
  if (inv.amountDue <= 0) continue;

  if (inv.dueDate === null || inv.dueDate >= today) {
    agingBuckets.current += inv.amountDue;
  } else if (inv.daysOverdue! <= 30) {
    agingBuckets.days_1_30 += inv.amountDue;
  } else if (inv.daysOverdue! <= 60) {
    agingBuckets.days_31_60 += inv.amountDue;
  } else if (inv.daysOverdue! <= 90) {
    agingBuckets.days_61_90 += inv.amountDue;
  } else {
    agingBuckets.days_over_90 += inv.amountDue;
  }
}
```

**Step 6 — Compute summary (using processedInvoices from Step 4):**
```typescript
const invoicesWithBalance = processedInvoices.filter(i => i.amountDue > 0);
const overdueInvoices = processedInvoices.filter(i => i.isOverdue);

const summary = {
  total_invoiced: this.toNum(processedInvoices.reduce((sum, i) => sum + this.toNum(i.amount), 0)),
  total_collected: this.toNum(processedInvoices.reduce((sum, i) => sum + this.toNum(i.amount_paid), 0)),
  total_outstanding: this.toNum(invoicesWithBalance.reduce((sum, i) => sum + i.amountDue, 0)),
  total_overdue: this.toNum(overdueInvoices.reduce((sum, i) => sum + i.amountDue, 0)),
  invoice_count: invoicesWithBalance.length,
  overdue_count: overdueInvoices.length,
  avg_days_outstanding: (() => {
    const withDaysOutstanding = invoicesWithBalance.filter(i => i.daysOutstanding !== null);
    if (withDaysOutstanding.length === 0) return 0;
    const totalDays = withDaysOutstanding.reduce((sum, i) => sum + i.daysOutstanding!, 0);
    return this.toNum(totalDays / withDaysOutstanding.length);
  })(),
};
```

**Note:** `total_invoiced` and `total_collected` sum across ALL non-voided invoices (the full `processedInvoices` array), not just those with a balance. This gives the complete picture of total billing activity.

**Step 7 — Apply overdue_only filter (AFTER computing summary):**

**IMPORTANT:** Use the computed field names from Step 4 (`amountDue`, `isOverdue`) — NOT the original Prisma field names.
```typescript
let invoiceList = processedInvoices.filter(i => i.amountDue > 0);
if (query.overdue_only) {
  invoiceList = invoiceList.filter(i => i.isOverdue);
}
```

**Step 8 — Sort invoice list:**
Sort by `daysOverdue DESC` (most overdue first, nulls last), then `amountDue DESC`:

**IMPORTANT:** Use the computed field names (`daysOverdue`, `amountDue`) — NOT the original Prisma Decimal fields.
```typescript
invoiceList.sort((a, b) => {
  const aOverdue = a.daysOverdue ?? -1;
  const bOverdue = b.daysOverdue ?? -1;
  if (bOverdue !== aOverdue) return bOverdue - aOverdue;
  return b.amountDue - a.amountDue;
});
```

**Step 9 — Return response:**

```typescript
return {
  summary,
  aging_buckets: {
    current: this.toNum(agingBuckets.current),
    days_1_30: this.toNum(agingBuckets.days_1_30),
    days_31_60: this.toNum(agingBuckets.days_31_60),
    days_61_90: this.toNum(agingBuckets.days_61_90),
    days_over_90: this.toNum(agingBuckets.days_over_90),
  },
  invoices: invoiceList.map(inv => ({
    invoice_id: inv.id,
    invoice_number: inv.invoice_number,
    project_id: inv.project_id,
    project_name: inv.project?.name ?? '',
    project_number: inv.project?.project_number ?? '',
    amount: this.toNum(inv.amount),
    amount_paid: this.toNum(inv.amount_paid),
    amount_due: this.toNum(inv.amount_due),
    status: inv.status,
    due_date: inv.due_date,
    days_outstanding: inv.daysOutstanding,
    days_overdue: inv.daysOverdue,
    is_overdue: inv.isOverdue,
  })),
};
```

---

### Task 2 — Implement getAP() Method

**What:** Add the `getAP()` method to `DashboardService` that returns accounts payable awareness.

**Method signature:**
```typescript
async getAP(
  tenantId: string,
  daysAhead: number = 30,
): Promise<APResponse>
```

**Algorithm — step by step:**

**Step 1 — Run all independent queries in parallel:**

```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);
const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

const [
  subInvoicesRaw,
  recurringPreview,
  crewHoursData,
  crewMemberCount,
] = await Promise.all([
  // Subcontractor invoices (pending + approved)
  this.prisma.subcontractor_task_invoice.findMany({
    where: {
      tenant_id: tenantId,
      status: { in: ['pending', 'approved'] },
    },
    include: {
      subcontractor: {
        select: { id: true, first_name: true, last_name: true },
      },
    },
  }),

  // Recurring expense preview
  this.recurringExpenseService.getPreview(tenantId, daysAhead),

  // Crew hours this month
  this.prisma.crew_hour_log.aggregate({
    _sum: {
      hours_regular: true,
      hours_overtime: true,
    },
    where: {
      tenant_id: tenantId,
      log_date: { gte: currentMonthStart, lt: currentMonthEnd },
    },
  }),

  // Unique crew members with hours this month
  this.prisma.crew_hour_log.findMany({
    where: {
      tenant_id: tenantId,
      log_date: { gte: currentMonthStart, lt: currentMonthEnd },
    },
    select: { crew_member_id: true },
    distinct: ['crew_member_id'],
  }),
]);
```

**Step 2 — Process subcontractor invoices by subcontractor:**

```typescript
const subByContractor = new Map<string, {
  subcontractor_id: string;
  subcontractor_name: string;
  pending_amount: number;
  approved_amount: number;
  outstanding: number;
  oldest_invoice_date: Date | null;
}>();

for (const inv of subInvoicesRaw) {
  const subId = inv.subcontractor_id;
  const existing = subByContractor.get(subId) || {
    subcontractor_id: subId,
    subcontractor_name: `${inv.subcontractor?.first_name ?? ''} ${inv.subcontractor?.last_name ?? ''}`.trim(),
    pending_amount: 0,
    approved_amount: 0,
    outstanding: 0,
    oldest_invoice_date: null,
  };

  const amount = this.toNum(inv.amount);
  if (inv.status === 'pending') {
    existing.pending_amount += amount;
  } else if (inv.status === 'approved') {
    existing.approved_amount += amount;
  }
  existing.outstanding = existing.pending_amount + existing.approved_amount;

  // Track oldest invoice date
  if (inv.invoice_date || inv.created_at) {
    const invoiceDate = inv.invoice_date ? new Date(inv.invoice_date) : new Date(inv.created_at);
    if (!existing.oldest_invoice_date || invoiceDate < existing.oldest_invoice_date) {
      existing.oldest_invoice_date = invoiceDate;
    }
  }

  subByContractor.set(subId, existing);
}
```

**Step 3 — Compute subcontractor summary:**
```typescript
const subValues = Array.from(subByContractor.values());
const subInvoices = {
  total_pending: subValues.reduce((sum, s) => sum + s.pending_amount, 0),
  total_approved: subValues.reduce((sum, s) => sum + s.approved_amount, 0),
  total_outstanding: subValues.reduce((sum, s) => sum + s.outstanding, 0),
  invoice_count: subInvoicesRaw.length,
  by_subcontractor: subValues,
};
```

**Step 4 — Process recurring preview:**

Map the recurring preview occurrences to the response format:
```typescript
const recurringUpcoming = recurringPreview.occurrences.map(occ => {
  const dueDate = new Date(occ.due_date);
  const daysUntilDue = Math.ceil(
    (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  return {
    rule_id: occ.rule_id,
    rule_name: occ.rule_name,
    amount: this.toNum(occ.amount),
    due_date: occ.due_date,
    frequency: occ.frequency,
    supplier_name: occ.supplier_name ?? null,
    category_name: occ.category_name,
    days_until_due: daysUntilDue,
  };
});
```

**Note:** The `getPreview()` return shape from F-06 is:
```typescript
{
  period_days: number,
  total_obligations: Decimal,
  occurrences: Array<{
    rule_id: string,
    rule_name: string,
    amount: Decimal,
    tax_amount: Decimal | null,
    category_name: string,
    due_date: Date,
    frequency: string,
    supplier_name: string | null,
    payment_method_nickname: string | null,
  }>
}
```

If `getPreview()` method signature differs from the above (check in Pre-Sprint Checklist), adapt accordingly. The key data needed is: rule_id, rule_name, amount, due_date, frequency, supplier_name, category_name.

**Step 5 — Build summary:**
```typescript
const summary = {
  subcontractor_outstanding: subInvoices.total_outstanding,
  crew_unpaid_estimate: 0,  // Always 0 — no hourly rate data available yet
  recurring_upcoming: this.toNum(recurringPreview.total_obligations),
  total_ap_estimate: this.toNum(subInvoices.total_outstanding + this.toNum(recurringPreview.total_obligations)),
};
```

**Step 6 — Return response:**
```typescript
return {
  summary,
  subcontractor_invoices: {
    total_pending: this.toNum(subInvoices.total_pending),
    total_approved: this.toNum(subInvoices.total_approved),
    total_outstanding: this.toNum(subInvoices.total_outstanding),
    invoice_count: subInvoices.invoice_count,
    by_subcontractor: subInvoices.by_subcontractor.map(s => ({
      subcontractor_id: s.subcontractor_id,
      subcontractor_name: s.subcontractor_name,
      pending_amount: this.toNum(s.pending_amount),
      approved_amount: this.toNum(s.approved_amount),
      outstanding: this.toNum(s.outstanding),
      oldest_invoice_date: s.oldest_invoice_date,
    })),
  },
  recurring_upcoming: recurringUpcoming,
  crew_hours_summary: {
    note: 'Crew payment estimates require hourly rates to be configured. This section shows hours only.',
    total_regular_hours_this_month: this.toNum(crewHoursData._sum.hours_regular),
    total_overtime_hours_this_month: this.toNum(crewHoursData._sum.hours_overtime),
    crew_member_count: crewMemberCount.length,
  },
};
```

---

## Patterns to Apply

### Multi-Tenant Enforcement
Every Prisma query MUST include `tenant_id` in the `where` clause. Especially critical in AP where we query multiple tables.

### RecurringExpenseService Integration
`getPreview()` is called directly as a service method — NOT as an HTTP call. Both services are in the same module:
```typescript
const preview = await this.recurringExpenseService.getPreview(tenantId, daysAhead);
```

### Decimal Handling
Reuse the `toNum()` helper from Sprint 9_1:
```typescript
private toNum(val: any): number {
  if (val === null || val === undefined) return 0;
  return Number(Number(val).toFixed(2));
}
```

### Date Calculations
For aging buckets and days calculations:
```typescript
const daysBetween = (from: Date, to: Date): number => {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
};
```

---

## Business Rules Enforced in This Sprint

- **BR-AR1:** Aging buckets are based on `due_date`, NOT invoice creation date.
- **BR-AR2:** Invoices without a `due_date` are classified as `current` in aging buckets — regardless of age.
- **BR-AR3:** Voided invoices are ALWAYS excluded from AR (`status !== 'voided'`).
- **BR-AR4:** Invoice list contains only invoices with `amount_due > 0`.
- **BR-AR5:** Invoice list ordered by `days_overdue DESC` (most overdue first), then `amount_due DESC`.
- **BR-AR6:** `days_outstanding` is days since `sent_at` — null if invoice was never sent.
- **BR-AR7:** `days_overdue` is null for non-overdue invoices.
- **BR-AP1:** Subcontractor outstanding = sum of invoiced amounts where `status IN ('pending', 'approved')`.
- **BR-AP2:** `crew_unpaid_estimate` is ALWAYS 0 — hourly rates don't exist on crew_member yet.
- **BR-AP3:** The `note` field in `crew_hours_summary` MUST be included with the exact text shown above.
- **BR-AP4:** `recurring_upcoming` is sourced from `RecurringExpenseService.getPreview()` — never by directly querying the `recurring_expense_rule` table.
- **BR-AP5:** `total_ap_estimate = subcontractor_outstanding + recurring_upcoming`.

---

## Integration Points

| Dependency | Import Path | Usage |
|-----------|------------|-------|
| `PrismaService` | Already injected from Sprint 9_1 | All database queries |
| `RecurringExpenseService` | Already injected from Sprint 9_1 | `getPreview()` for AP recurring |
| `project_invoice` table | Via Prisma | AR queries |
| `subcontractor_task_invoice` table | Via Prisma | AP subcontractor queries |
| `crew_hour_log` table | Via Prisma | AP crew hours |

---

## Acceptance Criteria

- [ ] `getAR()` returns correct summary (total_invoiced, total_collected, total_outstanding, total_overdue, invoice_count, overdue_count, avg_days_outstanding)
- [ ] Aging buckets assign correctly: current, 1-30, 31-60, 61-90, over 90
- [ ] Invoice without `due_date` classified as `current`
- [ ] `days_overdue` is null for non-overdue invoices
- [ ] Voided invoices excluded from all AR calculations
- [ ] Invoice list ordered by `days_overdue DESC`, then `amount_due DESC`
- [ ] `overdue_only` filter works correctly
- [ ] `getAP()` returns correct subcontractor_outstanding
- [ ] Subcontractor aggregation groups correctly by subcontractor
- [ ] `recurring_upcoming` sourced from `RecurringExpenseService.getPreview()`
- [ ] `crew_unpaid_estimate = 0` with correct note text
- [ ] `crew_member_count` reflects unique crew members with hours this month
- [ ] All Prisma queries include `tenant_id` filter
- [ ] All monetary values use `toNum()` — no NaN or Infinity
- [ ] No existing code broken — only additions to DashboardService
- [ ] Dev server compiles cleanly
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — Before starting Sprint 9_3, verify:
1. `getAR()` and `getAP()` both compile and return the correct data shapes
2. No compilation errors in the project
3. RecurringExpenseService.getPreview() call works correctly within DashboardService

---

## Handoff Notes

**For Sprint 9_3:**
- DashboardService now has 3 methods: `getPL()`, `getAR()`, `getAP()`
- The `toNum()` and date helper patterns are established — reuse them
- RecurringExpenseService integration is proven working (tested in getAP)
- Sprint 9_3 will add: `getForecast()`, `getAlerts()`, `getOverview()`

**Method signatures added in this sprint:**
- `getAR(tenantId: string, query: { status?: string; overdue_only?: boolean })` — public
- `getAP(tenantId: string, daysAhead: number)` — public
