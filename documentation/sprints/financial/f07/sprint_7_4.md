# Sprint 7_4 — Service Part 2: getTaskBreakdown + getTimeline + getReceipts + getWorkforceSummary

**Module:** Financial
**File:** ./documentation/sprints/financial/f07/sprint_7_4.md
**Type:** Backend — Service Layer
**Depends On:** Sprint 7_3 (service file exists with getFullSummary)
**Gate:** STOP — All 6 public methods must exist on ProjectFinancialSummaryService. Service must compile.
**Estimated Complexity:** High

---

## Developer Standard

You are a masterclass-level engineer whose work makes Google, Amazon, and Apple engineers jealous of the quality. Every line you write is deliberate, precise, and production-grade.

---

## Critical Warnings

- **This platform is 85% production-ready.** Never break existing code. Never leave the server running in the background.
- **Read the codebase before touching anything.** Implement with surgical precision — not a single comma may break existing business logic.
- **MySQL credentials are in the `.env` file** at `/var/www/lead360.app/api/.env`. Do NOT hardcode credentials anywhere.
- **Never use `pkill -f`.** Always use `lsof -i :8000` + `kill {PID}`.
- **Never use PM2.** This project does NOT use PM2.

---

## Objective

Add 4 remaining public methods to the `ProjectFinancialSummaryService` created in Sprint 7_3:

1. `getTaskBreakdown()` — per-task cost breakdown with expenses, sub invoices, crew hours
2. `getTimeline()` — monthly cost timeline with zero-fill for missing months
3. `getReceipts()` — paginated receipt list with task title joins
4. `getWorkforceSummary()` — crew hours by member, crew payments by member, subcontractor invoices by sub

All methods are added to the EXISTING file at:
`/var/www/lead360.app/api/src/modules/financial/services/project-financial-summary.service.ts`

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/project-financial-summary.service.ts` — the file from Sprint 7_3. Understand the existing methods and patterns.
- [ ] Read `/var/www/lead360.app/api/src/modules/financial/dto/project-financial-query.dto.ts` — the DTOs from Sprint 7_2 (you'll use `ProjectTaskBreakdownQueryDto`, `ProjectDateFilterDto`, `ProjectReceiptsQueryDto`)
- [ ] Read `/var/www/lead360.app/api/prisma/schema.prisma` — verify the `project_task` model structure (fields: `id`, `title`, `status`, `order_index`, `deleted_at`)
- [ ] Confirm Sprint 7_3 is complete (service file exists and compiles)

---

## Dev Server

```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :8000   <- must return nothing before proceeding

START the dev server:
  cd /var/www/lead360.app/api && npm run start:dev

WAIT — the server takes 60 to 120 seconds to compile and become ready.
Do NOT attempt to hit any endpoint until the health check passes:
  curl -s http://localhost:8000/health   <- must return 200 before proceeding

Keep retrying the health check every 10 seconds until it responds.

KEEP the server running for the entire duration of the sprint.
Do NOT stop and restart between tests — keep it open.

BEFORE marking the sprint COMPLETE:
  lsof -i :8000
  kill {PID}
  Confirm port is free: lsof -i :8000   <- must return nothing
```

---

## Tasks

### Task 1 — Add Imports for New DTOs

**What:** Add missing imports to the top of `project-financial-summary.service.ts`.

```typescript
import {
  ProjectDateFilterDto,
  ProjectTaskBreakdownQueryDto,
  ProjectReceiptsQueryDto,
  TaskBreakdownSortBy,
  SortOrder,
} from '../dto/project-financial-query.dto';
```

**Note:** `ProjectDateFilterDto` should already be imported from Sprint 7_3. Add the others.

---

### Task 2 — Implement `getTaskBreakdown()`

**What:** Per-task cost breakdown. Shows where money is being spent at the task level.

**Signature:**
```typescript
async getTaskBreakdown(
  tenantId: string,
  projectId: string,
  query: ProjectTaskBreakdownQueryDto,
)
```

**Implementation strategy — 6 parallel queries, NOT N+1:**

1. Fetch ALL project tasks (including those with zero activity)
2. groupBy `task_id` on `financial_entry` → per-task expense totals
3. groupBy `[task_id, category_id]` on `financial_entry` → per-task by_category breakdown
4. groupBy `task_id` on `subcontractor_task_invoice` → per-task invoice totals
5. groupBy `task_id` on `crew_hour_log` → per-task hour totals
6. Fetch category details for name/type/classification lookup
7. Map results back to tasks. Tasks not found in any groupBy get zero values.

```typescript
async getTaskBreakdown(
  tenantId: string,
  projectId: string,
  query: ProjectTaskBreakdownQueryDto,
) {
  await this.validateProjectAccess(tenantId, projectId);

  // Build date filter for financial entries
  const entryDateFilter: any = {};
  if (query.date_from) entryDateFilter.gte = new Date(query.date_from);
  if (query.date_to) entryDateFilter.lte = new Date(query.date_to);
  const hasDateFilter = Object.keys(entryDateFilter).length > 0;

  const entryWhere: any = {
    tenant_id: tenantId,
    project_id: projectId,
    task_id: { not: null },
  };
  if (hasDateFilter) entryWhere.entry_date = entryDateFilter;

  // Run 6 independent queries in parallel (NOT N+1)
  const [tasks, expenseGroups, taskCategoryBreakdown, invoiceGroups, hourGroups, categories] =
    await Promise.all([
      // 1. All project tasks (non-deleted)
      this.prisma.project_task.findMany({
        where: { tenant_id: tenantId, project_id: projectId, deleted_at: null },
        select: {
          id: true,
          title: true,
          status: true,
          order_index: true,
        },
        orderBy: { order_index: 'asc' },
      }),
      // 2. Expenses grouped by task_id (for totals)
      this.prisma.financial_entry.groupBy({
        by: ['task_id'],
        where: entryWhere,
        _sum: { amount: true },
        _count: true,
      }),
      // 3. Expenses grouped by task_id + category_id (for by_category breakdown)
      this.prisma.financial_entry.groupBy({
        by: ['task_id', 'category_id'],
        where: entryWhere,
        _sum: { amount: true },
      }),
      // 4. Subcontractor invoices grouped by task_id
      this.prisma.subcontractor_task_invoice.groupBy({
        by: ['task_id'],
        where: { tenant_id: tenantId, project_id: projectId },
        _sum: { amount: true },
        _count: true,
      }),
      // 5. Crew hours grouped by task_id
      this.prisma.crew_hour_log.groupBy({
        by: ['task_id'],
        where: {
          tenant_id: tenantId,
          project_id: projectId,
          task_id: { not: null },
        },
        _sum: { hours_regular: true, hours_overtime: true },
      }),
      // 6. Category details for by_category breakdown
      this.prisma.financial_category.findMany({
        where: { tenant_id: tenantId },
        select: { id: true, name: true, type: true, classification: true },
      }),
    ]);

  // Build lookup maps
  const expenseMap = new Map(
    expenseGroups.map((g) => [g.task_id, g]),
  );
  const invoiceMap = new Map(
    invoiceGroups.map((g) => [g.task_id, g]),
  );
  const hourMap = new Map(
    hourGroups.map((g) => [g.task_id, g]),
  );
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  // Group category breakdown by task_id
  const taskCatMap = new Map<string, Array<{ category_id: string; total: number }>>();
  for (const row of taskCategoryBreakdown) {
    if (!row.task_id) continue;
    if (!taskCatMap.has(row.task_id)) taskCatMap.set(row.task_id, []);
    taskCatMap.get(row.task_id)!.push({
      category_id: row.category_id,
      total: Number(row._sum.amount ?? 0),
    });
  }

  // Assemble per-task results
  let totalTaskCost = 0;
  const taskResults = tasks.map((task) => {
    const expense = expenseMap.get(task.id);
    const invoice = invoiceMap.get(task.id);
    const hours = hourMap.get(task.id);
    const catBreakdown = taskCatMap.get(task.id) ?? [];

    const expenseTotal = Number(expense?._sum.amount ?? 0);
    totalTaskCost += expenseTotal;

    const regularHours = Number(hours?._sum.hours_regular ?? 0);
    const overtimeHours = Number(hours?._sum.hours_overtime ?? 0);

    return {
      task_id: task.id,
      task_title: task.title,
      task_status: task.status,
      task_order_index: task.order_index,
      expenses: {
        total: expenseTotal,
        by_category: catBreakdown.map((cb) => {
          const cat = categoryMap.get(cb.category_id);
          return {
            category_name: cat?.name ?? 'Unknown',
            category_type: cat?.type ?? 'other',
            classification: cat?.classification ?? 'cost_of_goods_sold',
            total: cb.total,
          };
        }),
        entry_count: expense?._count ?? 0,
      },
      subcontractor_invoices: {
        total_invoiced: Number(invoice?._sum.amount ?? 0),
        invoice_count: invoice?._count ?? 0,
      },
      crew_hours: {
        total_regular_hours: regularHours,
        total_overtime_hours: overtimeHours,
        total_hours: Math.round((regularHours + overtimeHours) * 100) / 100,
      },
    };
  });

  // Sort
  const sortBy = query.sort_by ?? TaskBreakdownSortBy.TOTAL_COST;
  const sortOrder = query.sort_order ?? SortOrder.DESC;

  taskResults.sort((a, b) => {
    let comparison = 0;
    if (sortBy === TaskBreakdownSortBy.TOTAL_COST) {
      comparison = a.expenses.total - b.expenses.total;
    } else {
      comparison = a.task_title.localeCompare(b.task_title);
    }
    return sortOrder === SortOrder.DESC ? -comparison : comparison;
  });

  return {
    project_id: projectId,
    total_task_cost: Math.round(totalTaskCost * 100) / 100,
    tasks: taskResults,
  };
}
```

**Business rules enforced:**
- ALL project tasks returned including those with zero costs
- Each task includes expenses, subcontractor invoices, and crew hours
- `sort_by=total_cost` orders by expense total (not combined total)
- Default sort: `total_cost DESC` (highest cost tasks first)
- `deleted_at: null` excludes soft-deleted tasks

---

### Task 3 — Implement `getTimeline()`

**What:** Monthly cost trend. Shows how spending has tracked over time with zero-fill for months without expenses.

**Signature:**
```typescript
async getTimeline(
  tenantId: string,
  projectId: string,
  dateFilter?: ProjectDateFilterDto,
)
```

**Implementation:**

```typescript
async getTimeline(
  tenantId: string,
  projectId: string,
  dateFilter?: ProjectDateFilterDto,
) {
  await this.validateProjectAccess(tenantId, projectId);

  // Get project dates for range boundaries
  const project = await this.prisma.project.findFirst({
    where: { id: projectId, tenant_id: tenantId },
    select: { start_date: true, actual_completion_date: true },
  });

  // Determine date range
  let rangeStart: Date;
  let rangeEnd: Date;

  if (dateFilter?.date_from) {
    rangeStart = new Date(dateFilter.date_from);
  } else if (project?.start_date) {
    rangeStart = new Date(project.start_date);
  } else {
    // Fallback: find earliest entry date
    const earliest = await this.prisma.financial_entry.findFirst({
      where: { tenant_id: tenantId, project_id: projectId },
      orderBy: { entry_date: 'asc' },
      select: { entry_date: true },
    });
    rangeStart = earliest?.entry_date ?? new Date();
  }

  if (dateFilter?.date_to) {
    rangeEnd = new Date(dateFilter.date_to);
  } else if (project?.actual_completion_date) {
    rangeEnd = new Date(project.actual_completion_date);
  } else {
    rangeEnd = new Date(); // today
  }

  // Build where clause for entries
  const entryWhere: any = {
    tenant_id: tenantId,
    project_id: projectId,
    entry_date: {
      gte: rangeStart,
      lte: rangeEnd,
    },
  };

  // Fetch all entries within range (with category info)
  // Note: Prisma groupBy cannot group by YEAR/MONTH expressions,
  // so we fetch entries and aggregate in JavaScript.
  const entries = await this.prisma.financial_entry.findMany({
    where: entryWhere,
    select: {
      entry_date: true,
      amount: true,
      category: {
        select: { name: true, type: true },
      },
    },
  });

  // Generate all months in range (zero-fill)
  const months: Array<{
    year: number;
    month: number;
    month_label: string;
    total_expenses: number;
    by_category: Array<{ category_name: string; category_type: string; total: number }>;
  }> = [];

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  // IMPORTANT: Use UTC methods because Prisma returns @db.Date fields as midnight UTC.
  // Using local timezone methods (getFullYear/getMonth) would shift dates to the wrong
  // month on servers not running in UTC.
  const startYear = rangeStart.getUTCFullYear();
  const startMonth = rangeStart.getUTCMonth(); // 0-indexed
  const endYear = rangeEnd.getUTCFullYear();
  const endMonth = rangeEnd.getUTCMonth();

  // Build month slots
  let currentYear = startYear;
  let currentMonth = startMonth;
  while (
    currentYear < endYear ||
    (currentYear === endYear && currentMonth <= endMonth)
  ) {
    months.push({
      year: currentYear,
      month: currentMonth + 1, // 1-indexed for response
      month_label: `${monthNames[currentMonth]} ${currentYear}`,
      total_expenses: 0,
      by_category: [],
    });
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
  }

  // Build month index map for O(1) lookup
  const monthIndexMap = new Map<string, number>();
  months.forEach((m, idx) => {
    monthIndexMap.set(`${m.year}-${m.month}`, idx);
  });

  // Aggregate entries into month slots
  const categoryTotals = new Map<string, Map<string, { name: string; type: string; total: number }>>();

  for (const entry of entries) {
    const d = new Date(entry.entry_date);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1; // 1-indexed, UTC to match range generation
    const key = `${year}-${month}`;
    const monthIdx = monthIndexMap.get(key);
    if (monthIdx === undefined) continue;

    const amount = Number(entry.amount);
    months[monthIdx].total_expenses += amount;

    // Track by_category per month
    if (!categoryTotals.has(key)) categoryTotals.set(key, new Map());
    const catMap = categoryTotals.get(key)!;
    const catName = entry.category.name;
    if (!catMap.has(catName)) {
      catMap.set(catName, {
        name: entry.category.name,
        type: entry.category.type,
        total: 0,
      });
    }
    catMap.get(catName)!.total += amount;
  }

  // Attach by_category to each month + round totals
  let cumulativeTotal = 0;
  for (const m of months) {
    m.total_expenses = Math.round(m.total_expenses * 100) / 100;
    cumulativeTotal += m.total_expenses;

    const key = `${m.year}-${m.month}`;
    const catMap = categoryTotals.get(key);
    if (catMap) {
      m.by_category = Array.from(catMap.values()).map((c) => ({
        category_name: c.name,
        category_type: c.type,
        total: Math.round(c.total * 100) / 100,
      }));
    }
  }

  return {
    project_id: projectId,
    months,
    cumulative_total: Math.round(cumulativeTotal * 100) / 100,
  };
}
```

**Business rules enforced:**
- Months with zero expenses ARE included within the date range (no gaps)
- Each month includes `by_category` breakdown
- `cumulative_total` is the running sum across ALL months in the response
- Date range defaults: project `start_date` to `actual_completion_date` (or today)
- If no project start_date, falls back to earliest entry date

**Why fetch entries + JS aggregate instead of raw SQL?**
Prisma's `groupBy` cannot group by computed expressions (YEAR/MONTH). Raw SQL would work but would bypass Prisma's type safety. For most projects (hundreds of entries, not millions), JS aggregation is fast enough and safer.

---

### Task 4 — Implement `getReceipts()`

**What:** Paginated list of all receipts attached to the project or its tasks.

**Signature:**
```typescript
async getReceipts(
  tenantId: string,
  projectId: string,
  query: ProjectReceiptsQueryDto,
)
```

**Implementation:**

```typescript
async getReceipts(
  tenantId: string,
  projectId: string,
  query: ProjectReceiptsQueryDto,
) {
  await this.validateProjectAccess(tenantId, projectId);

  const page = query.page ?? 1;
  const limit = Math.min(query.limit ?? 20, 100);
  const skip = (page - 1) * limit;

  // Get task IDs for this project
  const projectTasks = await this.prisma.project_task.findMany({
    where: { tenant_id: tenantId, project_id: projectId, deleted_at: null },
    select: { id: true, title: true },
  });
  const taskIds = projectTasks.map((t) => t.id);
  const taskTitleMap = new Map(projectTasks.map((t) => [t.id, t.title]));

  // Build where clause
  const where: any = {
    tenant_id: tenantId,
    OR: [
      { project_id: projectId },
      ...(taskIds.length > 0 ? [{ task_id: { in: taskIds } }] : []),
    ],
  };

  // Apply optional filters
  if (query.is_categorized !== undefined) {
    where.is_categorized = query.is_categorized;
  }
  if (query.ocr_status) {
    where.ocr_status = query.ocr_status;
  }

  const [data, total] = await Promise.all([
    this.prisma.receipt.findMany({
      where,
      select: {
        id: true,
        project_id: true,
        task_id: true,
        file_url: true,
        file_name: true,
        file_type: true,
        vendor_name: true,
        amount: true,
        receipt_date: true,
        ocr_status: true,
        ocr_vendor: true,
        ocr_amount: true,
        ocr_date: true,
        is_categorized: true,
        financial_entry_id: true,
        uploaded_by_user: {
          select: { id: true, first_name: true, last_name: true },
        },
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit,
    }),
    this.prisma.receipt.count({ where }),
  ]);

  // Map response — add task_title from lookup
  const receipts = data.map((r) => ({
    id: r.id,
    project_id: r.project_id,
    task_id: r.task_id,
    task_title: r.task_id ? (taskTitleMap.get(r.task_id) ?? null) : null,
    file_url: r.file_url,
    file_name: r.file_name,
    file_type: r.file_type,
    vendor_name: r.vendor_name,
    amount: r.amount !== null ? Number(r.amount) : null,
    receipt_date: r.receipt_date,
    ocr_status: r.ocr_status,
    ocr_vendor: r.ocr_vendor,
    ocr_amount: r.ocr_amount !== null ? Number(r.ocr_amount) : null,
    ocr_date: r.ocr_date,
    is_categorized: r.is_categorized,
    financial_entry_id: r.financial_entry_id,
    uploaded_by: r.uploaded_by_user
      ? {
          id: r.uploaded_by_user.id,
          first_name: r.uploaded_by_user.first_name,
          last_name: r.uploaded_by_user.last_name,
        }
      : null,
    created_at: r.created_at,
  }));

  return {
    data: receipts,
    meta: {
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    },
  };
}
```

**Business rules enforced:**
- Returns receipts for project AND receipts linked to project's tasks
- `task_title` joined from task lookup when `task_id` is present
- Pagination: default page=1, limit=20, max limit=100
- `uploaded_by` mapped from `uploaded_by_user` relation
- Decimal fields converted to Number

---

### Task 5 — Implement `getWorkforceSummary()`

**What:** Consolidated workforce view — crew hours by member, crew payments by member, subcontractor invoices by subcontractor.

**Signature:**
```typescript
async getWorkforceSummary(
  tenantId: string,
  projectId: string,
  dateFilter?: ProjectDateFilterDto,
)
```

**Implementation:**

```typescript
async getWorkforceSummary(
  tenantId: string,
  projectId: string,
  dateFilter?: ProjectDateFilterDto,
) {
  await this.validateProjectAccess(tenantId, projectId);

  // Date filters apply to respective date fields per sub-section
  const hourDateFilter: any = {};
  const paymentDateFilter: any = {};
  if (dateFilter?.date_from) {
    hourDateFilter.gte = new Date(dateFilter.date_from);
    paymentDateFilter.gte = new Date(dateFilter.date_from);
  }
  if (dateFilter?.date_to) {
    hourDateFilter.lte = new Date(dateFilter.date_to);
    paymentDateFilter.lte = new Date(dateFilter.date_to);
  }
  const hasHourDateFilter = Object.keys(hourDateFilter).length > 0;
  const hasPaymentDateFilter = Object.keys(paymentDateFilter).length > 0;

  // Build where clauses
  const hourWhere: any = { tenant_id: tenantId, project_id: projectId };
  if (hasHourDateFilter) hourWhere.log_date = hourDateFilter;

  const crewPaymentWhere: any = { tenant_id: tenantId, project_id: projectId };
  if (hasPaymentDateFilter) crewPaymentWhere.payment_date = paymentDateFilter;

  const subInvoiceWhere: any = { tenant_id: tenantId, project_id: projectId };
  // Subcontractor invoices don't have date_from/date_to filtering in this endpoint
  // (the contract applies date filters to log_date and payment_date only)

  const subPaymentWhere: any = { tenant_id: tenantId, project_id: projectId };
  if (hasPaymentDateFilter) subPaymentWhere.payment_date = paymentDateFilter;

  // Fetch all data in parallel
  const [
    hourLogs,
    crewPayments,
    subInvoices,
    subPayments,
  ] = await Promise.all([
    // Crew hour logs with crew member info
    this.prisma.crew_hour_log.findMany({
      where: hourWhere,
      select: {
        crew_member_id: true,
        hours_regular: true,
        hours_overtime: true,
        crew_member: {
          select: { id: true, first_name: true, last_name: true },
        },
      },
    }),
    // Crew payments with crew member info
    this.prisma.crew_payment_record.findMany({
      where: crewPaymentWhere,
      select: {
        crew_member_id: true,
        amount: true,
        payment_date: true,
        crew_member: {
          select: { id: true, first_name: true, last_name: true },
        },
      },
    }),
    // Subcontractor invoices with subcontractor info
    this.prisma.subcontractor_task_invoice.findMany({
      where: subInvoiceWhere,
      select: {
        subcontractor_id: true,
        amount: true,
        status: true,
        subcontractor: {
          select: { id: true, business_name: true },
        },
      },
    }),
    // Subcontractor payments with subcontractor info
    this.prisma.subcontractor_payment_record.findMany({
      where: subPaymentWhere,
      select: {
        subcontractor_id: true,
        amount: true,
        subcontractor: {
          select: { id: true, business_name: true },
        },
      },
    }),
  ]);

  // ── Aggregate crew hours by member ──
  const crewHourMap = new Map<string, {
    crew_member_id: string;
    crew_member_name: string;
    regular_hours: number;
    overtime_hours: number;
    log_count: number;
  }>();

  let totalRegularHours = 0;
  let totalOvertimeHours = 0;

  for (const log of hourLogs) {
    const memberId = log.crew_member_id;
    const regular = Number(log.hours_regular);
    const overtime = Number(log.hours_overtime);
    totalRegularHours += regular;
    totalOvertimeHours += overtime;

    if (!crewHourMap.has(memberId)) {
      crewHourMap.set(memberId, {
        crew_member_id: memberId,
        crew_member_name: `${log.crew_member.first_name} ${log.crew_member.last_name}`,
        regular_hours: 0,
        overtime_hours: 0,
        log_count: 0,
      });
    }
    const entry = crewHourMap.get(memberId)!;
    entry.regular_hours += regular;
    entry.overtime_hours += overtime;
    entry.log_count += 1;
  }

  const crewHoursByMember = Array.from(crewHourMap.values()).map((m) => ({
    ...m,
    regular_hours: Math.round(m.regular_hours * 100) / 100,
    overtime_hours: Math.round(m.overtime_hours * 100) / 100,
    total_hours: Math.round((m.regular_hours + m.overtime_hours) * 100) / 100,
  }));

  // ── Aggregate crew payments by member ──
  const crewPaymentMap = new Map<string, {
    crew_member_id: string;
    crew_member_name: string;
    total_paid: number;
    payment_count: number;
    last_payment_date: Date | null;
  }>();

  let totalCrewPaid = 0;

  for (const payment of crewPayments) {
    const memberId = payment.crew_member_id;
    const amount = Number(payment.amount);
    totalCrewPaid += amount;

    if (!crewPaymentMap.has(memberId)) {
      crewPaymentMap.set(memberId, {
        crew_member_id: memberId,
        crew_member_name: `${payment.crew_member.first_name} ${payment.crew_member.last_name}`,
        total_paid: 0,
        payment_count: 0,
        last_payment_date: null,
      });
    }
    const entry = crewPaymentMap.get(memberId)!;
    entry.total_paid += amount;
    entry.payment_count += 1;
    if (!entry.last_payment_date || payment.payment_date > entry.last_payment_date) {
      entry.last_payment_date = payment.payment_date;
    }
  }

  const crewPaymentsByMember = Array.from(crewPaymentMap.values()).map((m) => ({
    ...m,
    total_paid: Math.round(m.total_paid * 100) / 100,
  }));

  // ── Aggregate subcontractor invoices + payments by subcontractor ──
  const subMap = new Map<string, {
    subcontractor_id: string;
    subcontractor_name: string;
    invoiced: number;
    paid: number;
    invoice_count: number;
    pending_invoices: number;
    approved_invoices: number;
    paid_invoices: number;
  }>();

  let totalSubInvoiced = 0;

  for (const inv of subInvoices) {
    const subId = inv.subcontractor_id;
    const amount = Number(inv.amount);
    totalSubInvoiced += amount;

    if (!subMap.has(subId)) {
      subMap.set(subId, {
        subcontractor_id: subId,
        subcontractor_name: inv.subcontractor.business_name,
        invoiced: 0,
        paid: 0,
        invoice_count: 0,
        pending_invoices: 0,
        approved_invoices: 0,
        paid_invoices: 0,
      });
    }
    const entry = subMap.get(subId)!;
    entry.invoiced += amount;
    entry.invoice_count += 1;

    // Count by invoice status
    if (inv.status === 'pending') entry.pending_invoices += 1;
    else if (inv.status === 'approved') entry.approved_invoices += 1;
    else if (inv.status === 'paid') entry.paid_invoices += 1;
  }

  let totalSubPaid = 0;

  for (const pay of subPayments) {
    const subId = pay.subcontractor_id;
    const amount = Number(pay.amount);
    totalSubPaid += amount;

    if (!subMap.has(subId)) {
      subMap.set(subId, {
        subcontractor_id: subId,
        subcontractor_name: pay.subcontractor.business_name,
        invoiced: 0,
        paid: 0,
        invoice_count: 0,
        pending_invoices: 0,
        approved_invoices: 0,
        paid_invoices: 0,
      });
    }
    subMap.get(subId)!.paid += amount;
  }

  const subByContractor = Array.from(subMap.values()).map((s) => ({
    ...s,
    invoiced: Math.round(s.invoiced * 100) / 100,
    paid: Math.round(s.paid * 100) / 100,
    outstanding: Math.round((s.invoiced - s.paid) * 100) / 100,
  }));

  return {
    project_id: projectId,
    crew_hours: {
      total_regular_hours: Math.round(totalRegularHours * 100) / 100,
      total_overtime_hours: Math.round(totalOvertimeHours * 100) / 100,
      total_hours: Math.round((totalRegularHours + totalOvertimeHours) * 100) / 100,
      by_crew_member: crewHoursByMember,
    },
    crew_payments: {
      total_paid: Math.round(totalCrewPaid * 100) / 100,
      payment_count: crewPayments.length,
      by_crew_member: crewPaymentsByMember,
    },
    subcontractor_invoices: {
      total_invoiced: Math.round(totalSubInvoiced * 100) / 100,
      total_paid: Math.round(totalSubPaid * 100) / 100,
      outstanding: Math.round((totalSubInvoiced - totalSubPaid) * 100) / 100,
      by_subcontractor: subByContractor,
    },
  };
}
```

**Business rules enforced:**
- Date filters apply to `log_date` for crew hours, `payment_date` for crew/sub payments
- `crew_member_name` = `first_name + ' ' + last_name` from `crew_member` model
- `subcontractor_name` = `business_name` from `subcontractor` model
- `outstanding` = invoiced − paid per subcontractor
- `pending_invoices`, `approved_invoices`, `paid_invoices` counted from `subcontractor_task_invoice.status`
- Uses `findMany` + JS aggregation (not groupBy) because Prisma groupBy cannot include cross-relation joins

---

### Task 6 — Verify Compilation

**What:** Start the dev server and verify all 6 public methods compile.

```bash
cd /var/www/lead360.app/api && npm run start:dev
```

Wait for compilation. Verify no TypeScript errors.

```bash
curl -s http://localhost:8000/health
```

**After confirming, shut down:**
```bash
lsof -i :8000
kill {PID}
lsof -i :8000
```

---

## Acceptance Criteria

- [ ] `getTaskBreakdown()` method exists with correct signature
- [ ] `getTimeline()` method exists with correct signature
- [ ] `getReceipts()` method exists with correct signature
- [ ] `getWorkforceSummary()` method exists with correct signature
- [ ] All 4 methods call `validateProjectAccess()` first
- [ ] Task breakdown includes ALL project tasks (including zero-activity)
- [ ] Task breakdown supports `sort_by=total_cost` and `sort_by=task_title` with `sort_order`
- [ ] Timeline includes zero-expense months within project date range
- [ ] Timeline has `by_category` breakdown per month
- [ ] Timeline has `cumulative_total` (running sum)
- [ ] Receipts returns items for project AND its tasks
- [ ] Receipts has `task_title` joined from task lookup
- [ ] Receipts pagination works (page, limit, total, total_pages)
- [ ] Workforce `crew_hours.by_crew_member` aggregates correctly
- [ ] Workforce `crew_member_name` is `first_name + ' ' + last_name`
- [ ] Workforce `subcontractor_name` is `business_name`
- [ ] Workforce `outstanding` = invoiced − paid per subcontractor
- [ ] Workforce date filters applied to correct date fields (log_date, payment_date)
- [ ] All Prisma Decimal values converted to Number()
- [ ] Application compiles without errors
- [ ] Dev server shut down

---

## Gate Marker

**STOP** — All 6 public methods must exist on `ProjectFinancialSummaryService`:
1. `getFullSummary()` (from Sprint 7_3)
2. `getTaskBreakdown()`
3. `getTimeline()`
4. `getReceipts()`
5. `getWorkforceSummary()`
6. `validateProjectAccess()` (private)

Dev server must compile without errors.

---

## Handoff Notes

**For Sprint 7_5 (Controller):**
- All 5 public methods are ready to be called from the controller
- Method signatures:
  - `getFullSummary(tenantId: string, projectId: string, dateFilter?: ProjectDateFilterDto)`
  - `getTaskBreakdown(tenantId: string, projectId: string, query: ProjectTaskBreakdownQueryDto)`
  - `getTimeline(tenantId: string, projectId: string, dateFilter?: ProjectDateFilterDto)`
  - `getReceipts(tenantId: string, projectId: string, query: ProjectReceiptsQueryDto)`
  - `getWorkforceSummary(tenantId: string, projectId: string, dateFilter?: ProjectDateFilterDto)`
- The controller passes `req.user.tenant_id` as `tenantId` (following existing financial module pattern)
- Each endpoint passes the projectId from `@Param('projectId', ParseUUIDPipe)`
- Query DTOs are validated via `@Query()` with NestJS validation pipe
