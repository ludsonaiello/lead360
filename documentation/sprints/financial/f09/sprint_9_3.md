# Sprint 9_3 — DashboardService — Forecast + Alerts + Overview

**Module:** Financial
**File:** `./documentation/sprints/financial/f09/sprint_9_3.md`
**Type:** Backend
**Depends On:** Sprint 9_2 must be complete (getAR() and getAP() exist)
**Gate:** STOP — All 6 DashboardService methods compile and return correct data structures
**Estimated Complexity:** High

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

Complete the DashboardService by adding the three remaining methods: `getForecast()` for cash flow forecasting, `getAlerts()` for automated financial health alerts, and `getOverview()` for the combined dashboard endpoint. After this sprint, all 6 public DashboardService methods will be implemented.

---

## Pre-Sprint Checklist

- [ ] Read `api/src/modules/financial/services/dashboard.service.ts` — confirm getPL(), getAR(), getAP() exist from previous sprints
- [ ] Read `api/src/modules/financial/services/recurring-expense.service.ts` — confirm `getPreview()` returns the shape used in getAP()
- [ ] Read `api/prisma/schema.prisma` — confirm:
  - `project_invoice`: `due_date`, `amount_due`, `status`, `invoice_number`, `tenant_id`
  - `recurring_expense_rule`: `id`, `name`, `next_due_date`, `status`, `amount`
  - `subcontractor_task_invoice`: `status`, `created_at`, `subcontractor_id`
  - `financial_entry`: `submission_status`
  - `project`: `status`, `progress_percent`, `name`, `project_number`
- [ ] Verify the `invoice_status_extended` enum values: `draft`, `sent`, `partial`, `paid`, `voided`
- [ ] Verify the `recurring_rule_status` enum values: `active`, `paused`, `completed`, `cancelled`
- [ ] Verify the `project_status` enum values: `planned`, `in_progress`, `on_hold`, `completed`, `canceled`

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

### Task 1 — Implement getForecast() Method

**What:** Add the `getForecast()` method for cash flow forecasting.

**File:** `api/src/modules/financial/services/dashboard.service.ts` (add to existing file)

**Method signature:**
```typescript
async getForecast(
  tenantId: string,
  days: number,  // Must be 30, 60, or 90 — validated by DTO
): Promise<ForecastResponse>
```

**Algorithm — step by step:**

**Step 1 — Calculate date range:**
```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);
const forecastEnd = new Date(today);
forecastEnd.setDate(forecastEnd.getDate() + days);
```

**Step 2 — Run inflow and outflow queries in parallel:**
```typescript
const [inflowInvoices, outflowPreview] = await Promise.all([
  // Expected inflows: invoices with due_date in period and amount_due > 0
  this.prisma.project_invoice.findMany({
    where: {
      tenant_id: tenantId,
      due_date: { gte: today, lte: forecastEnd },
      amount_due: { gt: 0 },
      status: { not: 'voided' },
    },
    include: {
      project: {
        select: { name: true },
      },
    },
    orderBy: { due_date: 'asc' },
  }),

  // Expected outflows: from recurring expense preview
  this.recurringExpenseService.getPreview(tenantId, days),
]);
```

**Step 3 — Process inflows:**
```typescript
const inflowItems = inflowInvoices.map(inv => {
  const dueDate = new Date(inv.due_date);
  const daysUntilDue = Math.ceil(
    (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  return {
    type: 'invoice_due' as const,
    invoice_id: inv.id,
    invoice_number: inv.invoice_number,
    project_name: inv.project?.name ?? '',
    amount_due: this.toNum(inv.amount_due),
    due_date: inv.due_date,
    days_until_due: daysUntilDue,
  };
});

const totalInflows = inflowItems.reduce((sum, item) => sum + item.amount_due, 0);
```

**Step 4 — Process outflows:**
```typescript
const outflowItems = outflowPreview.occurrences.map(occ => {
  const dueDate = new Date(occ.due_date);
  const daysUntilDue = Math.ceil(
    (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  return {
    type: 'recurring_expense' as const,
    rule_id: occ.rule_id,
    rule_name: occ.rule_name,
    amount: this.toNum(occ.amount),
    due_date: occ.due_date,
    days_until_due: daysUntilDue,
    supplier_name: occ.supplier_name ?? null,
    category_name: occ.category_name,
  };
});

const totalOutflows = outflowItems.reduce((sum, item) => sum + item.amount, 0);
```

**Step 5 — Calculate net forecast:**
```typescript
const netForecast = this.toNum(totalInflows - totalOutflows);

let netForecastLabel: 'Positive' | 'Negative' | 'Breakeven';
if (netForecast > 100) {
  netForecastLabel = 'Positive';
} else if (netForecast < -100) {
  netForecastLabel = 'Negative';
} else {
  netForecastLabel = 'Breakeven';
}
```

**Threshold logic:**
- `net_forecast > 100`: "Positive"
- `net_forecast < -100`: "Negative"
- `-100 <= net_forecast <= 100`: "Breakeven"

**Step 6 — Return response:**
```typescript
return {
  period_days: days,
  forecast_start: today,
  forecast_end: forecastEnd,
  expected_inflows: {
    total: this.toNum(totalInflows),
    items: inflowItems,
  },
  expected_outflows: {
    total: this.toNum(totalOutflows),
    items: outflowItems,
  },
  net_forecast: netForecast,
  net_forecast_label: netForecastLabel,
};
```

---

### Task 2 — Implement getAlerts() Method

**What:** Add the `getAlerts()` method that generates financial health alerts. This is the most complex alert system — 8 alert types, deduplication logic, severity ordering, and a 50-alert cap.

**Method signature:**
```typescript
async getAlerts(
  tenantId: string,
): Promise<AlertsResponse>
```

**CRITICAL — Alert Types Table:**

| Type | Severity | Condition | Title Template | entity_type |
|------|----------|-----------|----------------|-------------|
| `invoice_overdue` | critical | Invoice `due_date < TODAY` and `amount_due > 0` and NOT 30+ days overdue | "Invoice {invoice_number} is overdue" | `invoice` |
| `invoice_overdue_30` | warning | Invoice overdue 30-59 days | "Invoice {invoice_number} is 30+ days overdue" | `invoice` |
| `invoice_overdue_60` | critical | Invoice overdue 60+ days | "Invoice {invoice_number} is 60+ days overdue" | `invoice` |
| `sub_invoice_pending` | warning | `subcontractor_task_invoice` with `status = pending` older than 7 days | "Subcontractor invoice from {sub_name} awaiting approval" | `subcontractor_invoice` |
| `recurring_due_soon` | info | Recurring rule with `next_due_date <= TODAY + 3` and `next_due_date >= TODAY` and `status = active` | "{rule_name} is due in {n} days" | `recurring_rule` |
| `recurring_overdue` | critical | Recurring rule with `next_due_date < TODAY` and `status = active` | "{rule_name} recurring expense is overdue" | `recurring_rule` |
| `expense_pending_review` | info | More than 5 `financial_entry` with `submission_status = pending_review` | "{count} expenses awaiting your review" | N/A — use `tenant_id` as entity_id |
| `project_no_invoice` | warning | Project `status = in_progress` AND `progress_percent >= 50` AND zero non-voided invoices | "Project {name} is 50%+ complete with no invoice sent" | `project` |

**CRITICAL — Deduplication Rules:**
- An invoice that qualifies for `invoice_overdue_60` does NOT also generate `invoice_overdue_30` or `invoice_overdue`
- An invoice that qualifies for `invoice_overdue_30` does NOT also generate `invoice_overdue`
- Implementation: query 60+ first, collect IDs, then 30-59 excluding those IDs, then <30 excluding both sets

**Algorithm — step by step:**

**Step 1 — Compute today and threshold dates:**
```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);

const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

const sixtyDaysAgo = new Date(today);
sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

const sevenDaysAgo = new Date(today);
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

const threeDaysFromNow = new Date(today);
threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
```

**Step 2 — Run all 8 alert queries in parallel:**

Each alert type is generated by a private method. All run in `Promise.all()`:

```typescript
const [
  invoicesOverdue60,
  invoicesOverdue30,
  invoicesOverdue,
  subInvoicesPending,
  recurringDueSoon,
  recurringOverdue,
  expensesPendingReview,
  projectsNoInvoice,
] = await Promise.all([
  this.getInvoiceOverdue60Alerts(tenantId, today, sixtyDaysAgo),
  this.getInvoiceOverdue30Alerts(tenantId, today, thirtyDaysAgo, sixtyDaysAgo),
  this.getInvoiceOverdueAlerts(tenantId, today, thirtyDaysAgo),
  this.getSubInvoicePendingAlerts(tenantId, sevenDaysAgo),
  this.getRecurringDueSoonAlerts(tenantId, today, threeDaysFromNow),
  this.getRecurringOverdueAlerts(tenantId, today),
  this.getExpensePendingReviewAlerts(tenantId),
  this.getProjectNoInvoiceAlerts(tenantId),
]);
```

**But wait — deduplication requires sequential for invoice alerts.**

The 60+ query runs first, its IDs feed into the 30-59 exclusion, and those IDs feed into the <30 exclusion. So invoice alerts CANNOT be fully parallel. Instead:

```typescript
// Step 2a — Invoice overdue alerts (sequential for deduplication)
const invoicesOverdue60 = await this.getInvoiceOverdue60Alerts(tenantId, today, sixtyDaysAgo);
const ids60 = invoicesOverdue60.map(a => a.entity_id);

const invoicesOverdue30 = await this.getInvoiceOverdue30Alerts(tenantId, today, thirtyDaysAgo, sixtyDaysAgo, ids60);
const ids30 = invoicesOverdue30.map(a => a.entity_id);

const invoicesOverdue = await this.getInvoiceOverdueAlerts(tenantId, today, thirtyDaysAgo, [...ids60, ...ids30]);

// Step 2b — Non-invoice alerts (parallel)
const [
  subInvoicesPending,
  recurringDueSoon,
  recurringOverdue,
  expensesPendingReview,
  projectsNoInvoice,
] = await Promise.all([
  this.getSubInvoicePendingAlerts(tenantId, sevenDaysAgo),
  this.getRecurringDueSoonAlerts(tenantId, today, threeDaysFromNow),
  this.getRecurringOverdueAlerts(tenantId, today),
  this.getExpensePendingReviewAlerts(tenantId),
  this.getProjectNoInvoiceAlerts(tenantId),
]);
```

**ALTERNATIVE — more efficient approach: query all overdue invoices once, then split:**

```typescript
// Single query for ALL overdue invoices
const allOverdueInvoices = await this.prisma.project_invoice.findMany({
  where: {
    tenant_id: tenantId,
    due_date: { lt: today },
    amount_due: { gt: 0 },
    status: { notIn: ['voided', 'paid'] },
  },
  include: {
    project: { select: { name: true } },
  },
});

// Split by overdue duration
const overdue60 = [];
const overdue30 = [];
const overdueBasic = [];

for (const inv of allOverdueInvoices) {
  const dueDate = new Date(inv.due_date);
  const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysOverdue >= 60) {
    overdue60.push({ inv, daysOverdue });
  } else if (daysOverdue >= 30) {
    overdue30.push({ inv, daysOverdue });
  } else {
    overdueBasic.push({ inv, daysOverdue });
  }
}
```

**Use the ALTERNATIVE approach** — it's one query instead of three and handles deduplication naturally.

**Step 3 — Build alert objects from each source:**

**Alert object shape:**
```typescript
interface Alert {
  id: string;              // "{type}_{entity_id}"
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  entity_type: string;
  entity_id: string;
  entity_name: string;
  amount: number | null;
  action_url: string | null;
  created_at: Date;
}
```

**Alert builders for each type:**

**invoice_overdue_60:**
```typescript
overdue60.map(({ inv, daysOverdue }) => ({
  id: `invoice_overdue_60_${inv.id}`,
  type: 'invoice_overdue_60',
  severity: 'critical' as const,
  title: `Invoice ${inv.invoice_number} is 60+ days overdue`,
  message: `Invoice ${inv.invoice_number} for project "${inv.project?.name}" is ${daysOverdue} days past due with $${this.toNum(inv.amount_due)} outstanding.`,
  entity_type: 'invoice',
  entity_id: inv.id,
  entity_name: inv.invoice_number,
  amount: this.toNum(inv.amount_due),
  action_url: `/projects/${inv.project_id}/invoices/${inv.id}`,
  created_at: inv.due_date,
}))
```

**invoice_overdue_30:**
```typescript
overdue30.map(({ inv, daysOverdue }) => ({
  id: `invoice_overdue_30_${inv.id}`,
  type: 'invoice_overdue_30',
  severity: 'warning' as const,
  title: `Invoice ${inv.invoice_number} is 30+ days overdue`,
  message: `Invoice ${inv.invoice_number} is ${daysOverdue} days past due with $${this.toNum(inv.amount_due)} outstanding.`,
  entity_type: 'invoice',
  entity_id: inv.id,
  entity_name: inv.invoice_number,
  amount: this.toNum(inv.amount_due),
  action_url: `/projects/${inv.project_id}/invoices/${inv.id}`,
  created_at: inv.due_date,
}))
```

**invoice_overdue (basic — <30 days):**
```typescript
overdueBasic.map(({ inv, daysOverdue }) => ({
  id: `invoice_overdue_${inv.id}`,
  type: 'invoice_overdue',
  severity: 'critical' as const,
  title: `Invoice ${inv.invoice_number} is overdue`,
  message: `Invoice ${inv.invoice_number} is ${daysOverdue} days past due with $${this.toNum(inv.amount_due)} outstanding.`,
  entity_type: 'invoice',
  entity_id: inv.id,
  entity_name: inv.invoice_number,
  amount: this.toNum(inv.amount_due),
  action_url: `/projects/${inv.project_id}/invoices/${inv.id}`,
  created_at: inv.due_date,
}))
```

**sub_invoice_pending:**
```typescript
// Query: subcontractor_task_invoice where status = 'pending' and created_at < sevenDaysAgo
const pendingSubs = await this.prisma.subcontractor_task_invoice.findMany({
  where: {
    tenant_id: tenantId,
    status: 'pending',
    created_at: { lt: sevenDaysAgo },
  },
  include: {
    subcontractor: { select: { id: true, first_name: true, last_name: true } },
  },
});

pendingSubs.map(inv => ({
  id: `sub_invoice_pending_${inv.id}`,
  type: 'sub_invoice_pending',
  severity: 'warning' as const,
  title: `Subcontractor invoice from ${inv.subcontractor?.first_name} ${inv.subcontractor?.last_name} awaiting approval`,
  message: `Invoice for $${this.toNum(inv.amount)} has been pending for more than 7 days.`,
  entity_type: 'subcontractor_invoice',
  entity_id: inv.id,
  entity_name: `${inv.subcontractor?.first_name} ${inv.subcontractor?.last_name}`.trim(),
  amount: this.toNum(inv.amount),
  action_url: `/financial/subcontractor-invoices/${inv.id}`,
  created_at: inv.created_at,
}))
```

**recurring_due_soon:**
```typescript
// Query: recurring_expense_rule where status = 'active' and next_due_date BETWEEN today AND today+3
const dueSoon = await this.prisma.recurring_expense_rule.findMany({
  where: {
    tenant_id: tenantId,
    status: 'active',
    next_due_date: { gte: today, lte: threeDaysFromNow },
  },
});

dueSoon.map(rule => {
  const daysUntil = Math.ceil(
    (new Date(rule.next_due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  return {
    id: `recurring_due_soon_${rule.id}`,
    type: 'recurring_due_soon',
    severity: 'info' as const,
    title: `${rule.name} is due in ${daysUntil} days`,
    message: `Recurring expense "${rule.name}" for $${this.toNum(rule.amount)} is due on ${rule.next_due_date}.`,
    entity_type: 'recurring_rule',
    entity_id: rule.id,
    entity_name: rule.name,
    amount: this.toNum(rule.amount),
    action_url: `/financial/recurring-rules/${rule.id}`,
    created_at: rule.next_due_date,
  };
})
```

**recurring_overdue:**
```typescript
// Query: recurring_expense_rule where status = 'active' and next_due_date < today
const overdueRules = await this.prisma.recurring_expense_rule.findMany({
  where: {
    tenant_id: tenantId,
    status: 'active',
    next_due_date: { lt: today },
  },
});

overdueRules.map(rule => ({
  id: `recurring_overdue_${rule.id}`,
  type: 'recurring_overdue',
  severity: 'critical' as const,
  title: `${rule.name} recurring expense is overdue`,
  message: `Recurring expense "${rule.name}" for $${this.toNum(rule.amount)} was due on ${rule.next_due_date} and has not been processed.`,
  entity_type: 'recurring_rule',
  entity_id: rule.id,
  entity_name: rule.name,
  amount: this.toNum(rule.amount),
  action_url: `/financial/recurring-rules/${rule.id}`,
  created_at: rule.next_due_date,
}))
```

**expense_pending_review:**
```typescript
// Query: count of financial_entry with submission_status = 'pending_review'
const pendingCount = await this.prisma.financial_entry.count({
  where: {
    tenant_id: tenantId,
    submission_status: 'pending_review',
  },
});

// Only generate alert if count > 5
if (pendingCount > 5) {
  [{
    id: `expense_pending_review_${tenantId}`,
    type: 'expense_pending_review',
    severity: 'info' as const,
    title: `${pendingCount} expenses awaiting your review`,
    message: `There are ${pendingCount} expense entries with status "pending review" that need attention.`,
    entity_type: 'financial_entry' as any,
    entity_id: tenantId,
    entity_name: 'Pending Expenses',
    amount: null,
    action_url: '/financial/entries?status=pending_review',
    created_at: new Date(),
  }]
} else {
  []
}
```

**project_no_invoice:**
```typescript
// Query: projects with status = 'in_progress', progress_percent >= 50, and zero non-voided invoices
// This requires a subquery or a left join approach

const candidateProjects = await this.prisma.project.findMany({
  where: {
    tenant_id: tenantId,
    status: 'in_progress',
    progress_percent: { gte: 50 },
  },
  select: {
    id: true,
    name: true,
    project_number: true,
    progress_percent: true,
  },
});

// For each candidate, check if they have non-voided invoices
const projectsWithInvoices = await this.prisma.project_invoice.findMany({
  where: {
    tenant_id: tenantId,
    project_id: { in: candidateProjects.map(p => p.id) },
    status: { not: 'voided' },
  },
  select: { project_id: true },
  distinct: ['project_id'],
});

const projectIdsWithInvoices = new Set(projectsWithInvoices.map(p => p.project_id));
const projectsWithoutInvoices = candidateProjects.filter(
  p => !projectIdsWithInvoices.has(p.id)
);

projectsWithoutInvoices.map(proj => ({
  id: `project_no_invoice_${proj.id}`,
  type: 'project_no_invoice',
  severity: 'warning' as const,
  title: `Project ${proj.name} is 50%+ complete with no invoice sent`,
  message: `Project "${proj.name}" (${proj.project_number}) is ${Number(proj.progress_percent)}% complete but has no invoices.`,
  entity_type: 'project',
  entity_id: proj.id,
  entity_name: proj.name,
  amount: null,
  action_url: `/projects/${proj.id}`,
  created_at: new Date(),
}))
```

**Step 4 — Combine all alerts:**
```typescript
const allAlerts = [
  ...invoiceAlerts60,
  ...invoiceAlerts30,
  ...invoiceAlertsBasic,
  ...subInvoiceAlerts,
  ...recurringDueSoonAlerts,
  ...recurringOverdueAlerts,
  ...expensePendingAlerts,
  ...projectNoInvoiceAlerts,
];
```

**Step 5 — Sort by severity (critical first, then warning, then info), then by amount DESC:**
```typescript
const severityOrder = { critical: 0, warning: 1, info: 2 };

allAlerts.sort((a, b) => {
  const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
  if (sevDiff !== 0) return sevDiff;
  return (b.amount ?? 0) - (a.amount ?? 0);
});
```

**Step 6 — Apply 50-alert cap:**
```typescript
const totalAlertsTruncated = allAlerts.length > 50;
const alerts = allAlerts.slice(0, 50);
```

**Step 7 — Return response:**
```typescript
return {
  alert_count: alerts.length,
  alerts,
  ...(totalAlertsTruncated ? { total_alerts_truncated: true } : {}),
};
```

---

### Task 3 — Implement getOverview() Method

**What:** Add the `getOverview()` method that calls all 5 sub-methods in parallel and returns a combined response.

**Method signature:**
```typescript
async getOverview(
  tenantId: string,
  query: { date_from?: string; date_to?: string; forecast_days?: number },
): Promise<OverviewResponse>
```

**Implementation:**
```typescript
const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const currentMonth = currentDate.getMonth() + 1;

// Validate forecast_days to exactly 30, 60, or 90 — default to 30 if invalid
const validForecastDays = [30, 60, 90].includes(Number(query.forecast_days))
  ? Number(query.forecast_days) as 30 | 60 | 90
  : 30;

const [pl, ar, ap, forecast, alerts] = await Promise.all([
  this.getPL(tenantId, currentYear, currentMonth),
  this.getAR(tenantId, {}),
  this.getAP(tenantId, 30),
  this.getForecast(tenantId, validForecastDays),
  this.getAlerts(tenantId),
]);

return {
  pl_summary: pl,
  ar_summary: ar,
  ap_summary: ap,
  forecast,
  alerts: alerts.alerts,
  generated_at: new Date(),
};
```

**CRITICAL:** All 5 calls run in `Promise.all()` — they are completely independent. The overview endpoint's controller calls `getOverview()` — the controller does NOT orchestrate parallelism directly.

**For the P&L in overview:** Only the current month is returned (not full year). This is the `pl_summary` — a snapshot, not the full report.

---

## Patterns to Apply

### Alert ID Construction
Every alert ID is deterministic: `"{type}_{entity_id}"` where `entity_id` is the UUID of the entity (invoice ID, rule ID, project ID, etc.). The expense_pending_review alert uses `tenant_id` as entity_id since it's aggregate.

```typescript
const alertId = `${alertType}_${entityId}`;
```

### Private Methods for Each Alert Type
Each alert type should be computed in a separate private method for readability and testability. Name them consistently:
```typescript
private async getInvoiceOverdueAlerts(...)
private async getSubInvoicePendingAlerts(...)
private async getRecurringDueSoonAlerts(...)
// etc.
```

But the recommended approach (from Task 2) is to query all overdue invoices once and split in memory — this is more efficient than 3 separate invoice queries.

### Promise.all for Independent Queries
All non-invoice alert queries are independent and MUST run in parallel. Only the invoice queries have internal dependencies (deduplication).

---

## Business Rules Enforced in This Sprint

- **BR-F1:** Forecast inflows = invoices with `due_date` in the period and `amount_due > 0` and `status !== 'voided'`.
- **BR-F2:** Forecast outflows sourced from `RecurringExpenseService.getPreview()` — never by raw queries on the rule table.
- **BR-F3:** `net_forecast_label` thresholds: >100 = "Positive", <-100 = "Negative", -100 to 100 = "Breakeven".
- **BR-F4:** Only 30, 60, or 90 accepted for `days` param — DTO validation handles this (returns 400).
- **BR-A1:** `invoice_overdue_60` suppresses both `invoice_overdue_30` and `invoice_overdue` for the same invoice.
- **BR-A2:** `invoice_overdue_30` suppresses `invoice_overdue` for the same invoice.
- **BR-A3:** Alert IDs are deterministic and consistent across calls — same conditions always produce the same ID.
- **BR-A4:** Maximum 50 alerts. Critical and warning take priority over info.
- **BR-A5:** Alerts are computed fresh on every request — NOT cached or stored in the database.
- **BR-A6:** `expense_pending_review` fires only when count > 5 (not for 1-5 pending entries).
- **BR-A7:** `project_no_invoice` only fires for `status = 'in_progress'` projects with `progress_percent >= 50` and zero non-voided invoices.
- **BR-A8:** `recurring_due_soon` fires only for `active` rules with `next_due_date` between today and today+3 days (inclusive).
- **BR-A9:** `recurring_overdue` fires only for `active` rules with `next_due_date < today`.
- **BR-O1:** Overview calls all 5 methods in parallel via `Promise.all()`.
- **BR-O2:** Overview P&L returns current month only, not full year.

---

## Integration Points

| Dependency | Import Path | Usage |
|-----------|------------|-------|
| `PrismaService` | Already injected | All database queries |
| `RecurringExpenseService` | Already injected | `getPreview()` for forecast outflows |
| `project_invoice` table | Via Prisma | Forecast inflows + invoice alerts |
| `recurring_expense_rule` table | Via Prisma | Recurring alerts |
| `subcontractor_task_invoice` table | Via Prisma | Sub invoice alerts |
| `financial_entry` table | Via Prisma | Pending review count |
| `project` table | Via Prisma | No-invoice alert |

---

## Acceptance Criteria

- [ ] `getForecast()` returns correct inflows from invoices with due_date in period
- [ ] `getForecast()` returns correct outflows from `RecurringExpenseService.getPreview()`
- [ ] `net_forecast_label` is correct for positive, negative, and breakeven scenarios
- [ ] `getAlerts()` generates all 8 alert types correctly
- [ ] `invoice_overdue_60` suppresses both `invoice_overdue_30` and `invoice_overdue` for the same invoice
- [ ] `invoice_overdue_30` suppresses `invoice_overdue` for the same invoice
- [ ] Alert IDs are deterministic: `"{type}_{entity_id}"`
- [ ] Alerts sorted: critical first, then warning, then info; within severity by amount DESC
- [ ] Maximum 50 alerts, `total_alerts_truncated` flag when capped
- [ ] `expense_pending_review` only fires when count > 5
- [ ] `project_no_invoice` fires for in_progress projects with 50%+ progress and zero non-voided invoices
- [ ] `recurring_due_soon` fires for active rules due within 3 days
- [ ] `recurring_overdue` fires for active rules with past next_due_date
- [ ] `getOverview()` calls all 5 methods in parallel via `Promise.all()`
- [ ] Overview P&L returns current month only
- [ ] All Prisma queries include `tenant_id` filter
- [ ] No NaN, Infinity in any response field
- [ ] No existing code broken — only additions to DashboardService
- [ ] Dev server compiles cleanly
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — Before starting Sprint 9_4, verify:
1. All 6 DashboardService methods exist and compile: `getPL()`, `getAR()`, `getAP()`, `getForecast()`, `getAlerts()`, `getOverview()`
2. No compilation errors
3. The alert deduplication logic is implemented correctly

---

## Handoff Notes

**For Sprint 9_4:**
- DashboardService is now COMPLETE with all 6 public methods + private helpers
- Sprint 9_4 will add `exportPL()` method and create the DashboardController
- The DTOs were created in Sprint 9_1: `PlQueryDto`, `ArQueryDto`, `ApQueryDto`, `ForecastQueryDto`
- The controller needs 7 endpoints mapped to these methods

**All public DashboardService methods:**
1. `getPL(tenantId, year, month?, includePending?)` — Sprint 9_1
2. `getAR(tenantId, query)` — Sprint 9_2
3. `getAP(tenantId, daysAhead)` — Sprint 9_2
4. `getForecast(tenantId, days)` — Sprint 9_3
5. `getAlerts(tenantId)` — Sprint 9_3
6. `getOverview(tenantId, query)` — Sprint 9_3
7. `exportPL(tenantId, year, month?)` — Sprint 9_4 (to be added)
