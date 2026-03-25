# Sprint 9_5 — Unit Tests — DashboardService

**Module:** Financial
**File:** `./documentation/sprints/financial/f09/sprint_9_5.md`
**Type:** Backend — Tests
**Depends On:** Sprint 9_4 must be complete (all service methods and controller endpoints working)
**Gate:** STOP — All tests pass, >80% service coverage, no existing tests broken
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

Write comprehensive unit tests for `DashboardService`. The test file must cover all 7 public methods (getPL, getAR, getAP, getForecast, getAlerts, getOverview, exportPL) with focus on business logic correctness, edge cases, and the specific acceptance criteria from the F-09 contract.

---

## Pre-Sprint Checklist

- [ ] Read `api/src/modules/financial/services/dashboard.service.ts` — understand all methods, private helpers, and their dependencies
- [ ] Read `api/src/modules/financial/services/financial-entry.service.spec.ts` — observe the existing test pattern: how PrismaService is mocked, test structure, describe/it naming
- [ ] Read `api/src/modules/financial/services/subcontractor-invoice.service.spec.ts` — observe how complex service logic is tested
- [ ] Confirm Jest is the test runner: check `api/package.json` for jest config
- [ ] Confirm how to run a single test file: `cd /var/www/lead360.app/api && npx jest --testPathPattern=dashboard.service.spec`

---

## Dev Server

**For tests, the dev server is NOT needed.** Run tests directly:

```bash
cd /var/www/lead360.app/api

# Run only the dashboard service test file:
npx jest --testPathPattern=dashboard.service.spec --verbose

# If you need to run all financial tests to confirm nothing broke:
npx jest --testPathPattern=financial --verbose
```

**BEFORE marking the sprint COMPLETE, confirm no existing tests are broken:**
```bash
cd /var/www/lead360.app/api && npx jest --testPathPattern=financial --verbose
```

Also confirm port 8000 is NOT in use (you should not have started the dev server):
```
lsof -i :8000   ← must return nothing
```

---

## Tasks

**CRITICAL WARNING:** Some test cases below show `it()` blocks with only comments describing what to test. You MUST implement the full test body with mocks, assertions, and expectations. An `it()` block with only comments will PASS silently in Jest, giving a false green. Every `it()` block MUST have at least one `expect()` assertion. If you see a comment like `// ... set up mocks`, that means YOU write the mock setup — do not leave it as a comment.

### Task 1 — Create Test File with Mock Setup

**What:** Create the test file with proper mock setup for PrismaService and RecurringExpenseService.

**File:** `api/src/modules/financial/services/dashboard.service.spec.ts`

**Mock setup pattern (follow existing test patterns in the same directory):**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
// Import PrismaService from the same path used in dashboard.service.ts
// Import RecurringExpenseService

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: any;
  let recurringExpenseService: any;

  const mockTenantId = 'test-tenant-id-uuid';

  beforeEach(async () => {
    // Create mock PrismaService with all Prisma model methods used by DashboardService
    prisma = {
      project_invoice_payment: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      project_invoice: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      financial_entry: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
        count: jest.fn(),
      },
      financial_category: {
        findMany: jest.fn(),
      },
      project: {
        findMany: jest.fn(),
      },
      subcontractor_task_invoice: {
        findMany: jest.fn(),
      },
      crew_hour_log: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      recurring_expense_rule: {
        findMany: jest.fn(),
      },
    };

    recurringExpenseService = {
      getPreview: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
        { provide: RecurringExpenseService, useValue: recurringExpenseService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
```

---

### Task 2 — P&L Tests

**Required test cases:**

**2a — P&L cash basis income:**
```typescript
describe('getPL', () => {
  it('should compute income from payment_date (cash basis), not invoice date', async () => {
    // Mock: payment in March for an invoice created in February
    // Expect: income appears in March, not February
    prisma.project_invoice_payment.aggregate.mockResolvedValue({ _sum: { amount: 5000 } });
    prisma.project_invoice_payment.findMany.mockResolvedValue([{ invoice_id: 'inv-1' }]);
    prisma.project_invoice_payment.groupBy.mockResolvedValue([]);
    prisma.financial_entry.aggregate.mockResolvedValue({ _sum: { amount: null, tax_amount: null } });
    prisma.financial_entry.groupBy.mockResolvedValue([]);
    prisma.project_invoice.aggregate.mockResolvedValue({ _sum: { tax_amount: null } });

    const result = await service.getPL(mockTenantId, 2026, 3);
    expect(result.months[0].income.total).toBe(5000);
  });
});
```

**2b — P&L zero activity months included:**
```typescript
it('should return all 12 months for full year even with zero activity', async () => {
  // Mock all queries to return zero/empty
  // ... (set up all mocks to return null/empty)

  const result = await service.getPL(mockTenantId, 2026);
  expect(result.months).toHaveLength(12);
  expect(result.months[0].month).toBe(1);
  expect(result.months[11].month).toBe(12);
  expect(result.months[0].income.total).toBe(0);
  expect(result.months[0].expenses.total).toBe(0);
});
```

**2c — Gross profit calculation:**
```typescript
it('should calculate gross_profit = income - COGS', async () => {
  // Mock income = 10000, COGS = 3000, OpEx = 2000
  // Expect: gross_profit = 7000, operating_profit = 5000

  // ... set up mocks

  const result = await service.getPL(mockTenantId, 2026, 3);
  expect(result.months[0].gross_profit).toBe(7000);
  expect(result.months[0].operating_profit).toBe(5000);
  expect(result.months[0].net_profit).toBe(5000);
});
```

**2d — Gross margin percent null when income = 0:**
```typescript
it('should return null for gross_margin_percent when income is zero', async () => {
  // Mock income = 0
  // ... set up mocks

  const result = await service.getPL(mockTenantId, 2026, 3);
  expect(result.months[0].gross_margin_percent).toBeNull();
});
```

**2e — include_pending flag:**
```typescript
it('should populate total_with_pending when include_pending is true', async () => {
  // Mock: confirmed total = 5000, confirmed + pending = 7000
  // ... set up mocks

  const result = await service.getPL(mockTenantId, 2026, 3, true);
  expect(result.months[0].expenses.total).toBe(5000);        // confirmed only
  expect(result.months[0].expenses.total_with_pending).toBe(7000); // confirmed + pending
});
```

**2f — Totals block correctness:**
```typescript
it('should compute totals correctly across all months', async () => {
  // Mock 3 months with different values
  // Expect totals to sum correctly
  // Expect best_month and worst_month identified correctly
});
```

---

### Task 3 — AR Tests

**Required test cases:**

**3a — Aging bucket assignment (all 5 buckets):**
```typescript
describe('getAR', () => {
  it('should assign invoices to correct aging buckets', async () => {
    const today = new Date();
    const invoices = [
      // Current: due tomorrow
      { id: '1', amount: 1000, amount_paid: 0, amount_due: 1000, due_date: addDays(today, 1), status: 'sent', sent_at: addDays(today, -10), project: { id: 'p1', name: 'P1', project_number: 'PRJ-001' } },
      // 1-30 days overdue
      { id: '2', amount: 2000, amount_paid: 0, amount_due: 2000, due_date: addDays(today, -15), status: 'sent', sent_at: addDays(today, -30), project: { id: 'p2', name: 'P2', project_number: 'PRJ-002' } },
      // 31-60 days overdue
      { id: '3', amount: 3000, amount_paid: 0, amount_due: 3000, due_date: addDays(today, -45), status: 'sent', sent_at: addDays(today, -60), project: { id: 'p3', name: 'P3', project_number: 'PRJ-003' } },
      // 61-90 days overdue
      { id: '4', amount: 4000, amount_paid: 0, amount_due: 4000, due_date: addDays(today, -75), status: 'sent', sent_at: addDays(today, -90), project: { id: 'p4', name: 'P4', project_number: 'PRJ-004' } },
      // 90+ days overdue
      { id: '5', amount: 5000, amount_paid: 0, amount_due: 5000, due_date: addDays(today, -120), status: 'sent', sent_at: addDays(today, -150), project: { id: 'p5', name: 'P5', project_number: 'PRJ-005' } },
    ];

    prisma.project_invoice.findMany.mockResolvedValue(invoices);

    const result = await service.getAR(mockTenantId, {});

    expect(result.aging_buckets.current).toBe(1000);
    expect(result.aging_buckets.days_1_30).toBe(2000);
    expect(result.aging_buckets.days_31_60).toBe(3000);
    expect(result.aging_buckets.days_61_90).toBe(4000);
    expect(result.aging_buckets.days_over_90).toBe(5000);
  });
});
```

**3b — Invoice without due_date classified as current:**
```typescript
it('should classify invoice without due_date as current', async () => {
  prisma.project_invoice.findMany.mockResolvedValue([
    { id: '1', amount: 1000, amount_paid: 0, amount_due: 1000, due_date: null, status: 'sent', sent_at: new Date(), project: { id: 'p1', name: 'P1', project_number: 'PRJ-001' } },
  ]);

  const result = await service.getAR(mockTenantId, {});
  expect(result.aging_buckets.current).toBe(1000);
  expect(result.invoices[0].is_overdue).toBe(false);
  expect(result.invoices[0].days_overdue).toBeNull();
});
```

**3c — Voided invoices excluded:**
```typescript
it('should exclude voided invoices', async () => {
  // The Prisma query should have status: { not: 'voided' }
  // Verify the mock is called with correct where clause
});
```

**3d — Sort order: days_overdue DESC, amount_due DESC:**
```typescript
it('should sort invoices by days_overdue DESC then amount_due DESC', async () => {
  // Provide invoices in wrong order, verify sorted correctly
});
```

---

### Task 3b — AP Tests

**Required test cases:**

**3e — Subcontractor grouping:**
```typescript
describe('getAP', () => {
  it('should group subcontractor invoices by subcontractor and sum amounts', async () => {
    prisma.subcontractor_task_invoice.findMany.mockResolvedValue([
      { subcontractor_id: 'sub-1', amount: 1000, status: 'pending', invoice_date: new Date(), created_at: new Date(),
        subcontractor: { id: 'sub-1', first_name: 'John', last_name: 'Smith' } },
      { subcontractor_id: 'sub-1', amount: 2000, status: 'approved', invoice_date: new Date(), created_at: new Date(),
        subcontractor: { id: 'sub-1', first_name: 'John', last_name: 'Smith' } },
      { subcontractor_id: 'sub-2', amount: 3000, status: 'pending', invoice_date: new Date(), created_at: new Date(),
        subcontractor: { id: 'sub-2', first_name: 'Jane', last_name: 'Doe' } },
    ]);
    recurringExpenseService.getPreview.mockResolvedValue({
      period_days: 30, total_obligations: 0, occurrences: [],
    });
    prisma.crew_hour_log.aggregate.mockResolvedValue({ _sum: { hours_regular: null, hours_overtime: null } });
    prisma.crew_hour_log.findMany.mockResolvedValue([]);

    const result = await service.getAP(mockTenantId, 30);

    expect(result.subcontractor_invoices.total_pending).toBe(4000);   // 1000 + 3000
    expect(result.subcontractor_invoices.total_approved).toBe(2000);
    expect(result.subcontractor_invoices.total_outstanding).toBe(6000);
    expect(result.subcontractor_invoices.by_subcontractor).toHaveLength(2);
  });

  it('should set crew_unpaid_estimate to 0 with note', async () => {
    prisma.subcontractor_task_invoice.findMany.mockResolvedValue([]);
    recurringExpenseService.getPreview.mockResolvedValue({
      period_days: 30, total_obligations: 0, occurrences: [],
    });
    prisma.crew_hour_log.aggregate.mockResolvedValue({ _sum: { hours_regular: 40, hours_overtime: 5 } });
    prisma.crew_hour_log.findMany.mockResolvedValue([{ crew_member_id: 'cm-1' }]);

    const result = await service.getAP(mockTenantId, 30);

    expect(result.summary.crew_unpaid_estimate).toBe(0);
    expect(result.crew_hours_summary.note).toContain('hourly rates');
    expect(result.crew_hours_summary.total_regular_hours_this_month).toBe(40);
    expect(result.crew_hours_summary.crew_member_count).toBe(1);
  });

  it('should call getPreview with correct daysAhead value', async () => {
    prisma.subcontractor_task_invoice.findMany.mockResolvedValue([]);
    recurringExpenseService.getPreview.mockResolvedValue({
      period_days: 60, total_obligations: 0, occurrences: [],
    });
    prisma.crew_hour_log.aggregate.mockResolvedValue({ _sum: { hours_regular: null, hours_overtime: null } });
    prisma.crew_hour_log.findMany.mockResolvedValue([]);

    await service.getAP(mockTenantId, 60);

    expect(recurringExpenseService.getPreview).toHaveBeenCalledWith(mockTenantId, 60);
  });
});
```

---

### Task 3c — Export P&L Tests

**Required test cases:**

```typescript
describe('exportPL', () => {
  it('should return a Buffer with CSV content', async () => {
    // Mock getPL to return a known structure
    jest.spyOn(service, 'getPL').mockResolvedValue({
      year: 2026, period: 'single_month', currency: 'USD',
      months: [{
        year: 2026, month: 3, month_label: 'Mar 2026',
        income: { total: 5000, invoice_count: 2, by_project: [] },
        expenses: { total: 2000, total_with_pending: 2500, total_tax_paid: 100,
          by_classification: { cost_of_goods_sold: 1200, operating_expense: 800 },
          by_category: [], top_suppliers: [] },
        gross_profit: 3800, operating_profit: 3000, net_profit: 3000,
        gross_margin_percent: 76, tax: { tax_collected: 200, tax_paid: 100, net_tax_position: 100 },
      }],
      totals: {} as any,
    } as any);

    // Mock the expense detail query
    prisma.financial_entry.findMany.mockResolvedValue([]);

    const result = await service.exportPL(mockTenantId, 2026, 3);

    expect(Buffer.isBuffer(result)).toBe(true);
    const csv = result.toString('utf-8');
    expect(csv).toContain('Month,Total Income');         // Section 1 header
    expect(csv).toContain('Mar 2026,5000');               // Section 1 data
    expect(csv).toContain('Month,Date,Category');          // Section 2 header
  });

  it('should escape CSV fields containing commas', async () => {
    jest.spyOn(service, 'getPL').mockResolvedValue({
      year: 2026, period: 'single_month', currency: 'USD',
      months: [{ year: 2026, month: 1, month_label: 'Jan 2026',
        income: { total: 0, invoice_count: 0, by_project: [] },
        expenses: { total: 0, total_with_pending: 0, total_tax_paid: 0,
          by_classification: { cost_of_goods_sold: 0, operating_expense: 0 },
          by_category: [], top_suppliers: [] },
        gross_profit: 0, operating_profit: 0, net_profit: 0,
        gross_margin_percent: null, tax: { tax_collected: 0, tax_paid: 0, net_tax_position: 0 },
      }],
      totals: {} as any,
    } as any);

    prisma.financial_entry.findMany.mockResolvedValue([{
      entry_date: new Date('2026-01-15'),
      amount: 500, tax_amount: 25, payment_method: 'check',
      vendor_name: 'Smith, Jones & Co',   // Contains comma — must be escaped
      notes: 'Payment for "supplies"',     // Contains quotes — must be escaped
      category: { name: 'Materials', classification: 'cost_of_goods_sold' },
      project: { name: 'Project A' },
    }]);

    const result = await service.exportPL(mockTenantId, 2026, 1);
    const csv = result.toString('utf-8');

    // Vendor with comma should be quoted
    expect(csv).toContain('"Smith, Jones & Co"');
    // Notes with quotes should be double-escaped
    expect(csv).toContain('"Payment for ""supplies"""');
  });
});
```

---

### Task 4 — Forecast Tests

**Required test cases:**

**4a — net_forecast_label thresholds:**
```typescript
describe('getForecast', () => {
  it('should return "Positive" when net_forecast > 100', async () => {
    // Inflows = 5000, Outflows = 1000 → net = 4000 → "Positive"
    prisma.project_invoice.findMany.mockResolvedValue([
      { id: '1', invoice_number: 'INV-001', amount_due: 5000, due_date: addDays(new Date(), 15), project: { name: 'P1' } },
    ]);
    recurringExpenseService.getPreview.mockResolvedValue({
      period_days: 30,
      total_obligations: 1000,
      occurrences: [{ rule_id: 'r1', rule_name: 'Rent', amount: 1000, due_date: addDays(new Date(), 20), frequency: 'monthly', supplier_name: null, category_name: 'Rent' }],
    });

    const result = await service.getForecast(mockTenantId, 30);
    expect(result.net_forecast_label).toBe('Positive');
  });

  it('should return "Negative" when net_forecast < -100', async () => {
    // Inflows = 0, Outflows = 5000 → net = -5000 → "Negative"
  });

  it('should return "Breakeven" when -100 <= net_forecast <= 100', async () => {
    // Inflows = 1000, Outflows = 950 → net = 50 → "Breakeven"
  });
});
```

**4b — Only valid days values:**
```typescript
it('should accept 30, 60, 90 as valid days', async () => {
  // This is validated by the DTO, not the service
  // But test that the service correctly passes days to getPreview()
  recurringExpenseService.getPreview.mockResolvedValue({
    period_days: 60,
    total_obligations: 0,
    occurrences: [],
  });
  prisma.project_invoice.findMany.mockResolvedValue([]);

  await service.getForecast(mockTenantId, 60);
  expect(recurringExpenseService.getPreview).toHaveBeenCalledWith(mockTenantId, 60);
});
```

---

### Task 5 — Alert Tests

**Required test cases:**

**5a — Alert deduplication (most critical test):**
```typescript
describe('getAlerts', () => {
  it('should generate invoice_overdue_30 and NOT invoice_overdue for same invoice overdue 35 days', async () => {
    const today = new Date();
    const overdue35 = addDays(today, -35);

    prisma.project_invoice.findMany.mockResolvedValue([
      {
        id: 'inv-1',
        invoice_number: 'INV-001',
        amount_due: 5000,
        due_date: overdue35,
        status: 'sent',
        project_id: 'proj-1',
        project: { name: 'Test Project' },
      },
    ]);

    // Mock other queries to return empty
    prisma.subcontractor_task_invoice.findMany.mockResolvedValue([]);
    prisma.recurring_expense_rule.findMany.mockResolvedValue([]);
    prisma.financial_entry.count.mockResolvedValue(0);
    prisma.project.findMany.mockResolvedValue([]);

    const result = await service.getAlerts(mockTenantId);

    const alertTypes = result.alerts.map(a => a.type);
    expect(alertTypes).toContain('invoice_overdue_30');
    expect(alertTypes).not.toContain('invoice_overdue');
    expect(alertTypes).not.toContain('invoice_overdue_60');
  });

  it('should generate invoice_overdue_60 and NOT invoice_overdue_30 or invoice_overdue for 65-day overdue', async () => {
    // Similar test with 65-day overdue invoice
    // Expect ONLY invoice_overdue_60, not the lesser alerts
  });
});
```

**5b — expense_pending_review fires only when count > 5:**
```typescript
it('should generate expense_pending_review alert when count > 5', async () => {
  prisma.financial_entry.count.mockResolvedValue(10);
  // ... mock other queries empty

  const result = await service.getAlerts(mockTenantId);
  const pendingAlert = result.alerts.find(a => a.type === 'expense_pending_review');
  expect(pendingAlert).toBeDefined();
  expect(pendingAlert!.title).toContain('10 expenses');
});

it('should NOT generate expense_pending_review alert when count <= 5', async () => {
  prisma.financial_entry.count.mockResolvedValue(3);
  // ... mock other queries empty

  const result = await service.getAlerts(mockTenantId);
  const pendingAlert = result.alerts.find(a => a.type === 'expense_pending_review');
  expect(pendingAlert).toBeUndefined();
});
```

**5c — project_no_invoice alert:**
```typescript
it('should alert for in_progress projects at 50%+ with no invoices', async () => {
  prisma.project.findMany.mockResolvedValue([
    { id: 'p1', name: 'Big Job', project_number: 'PRJ-001', progress_percent: 75 },
  ]);
  prisma.project_invoice.findMany.mockResolvedValue([]); // No invoices

  // ... mock other queries empty

  const result = await service.getAlerts(mockTenantId);
  const noInvoiceAlert = result.alerts.find(a => a.type === 'project_no_invoice');
  expect(noInvoiceAlert).toBeDefined();
  expect(noInvoiceAlert!.entity_id).toBe('p1');
});
```

**5d — Alert deterministic IDs:**
```typescript
it('should produce deterministic alert IDs', async () => {
  // Run getAlerts twice with same data
  // Verify alert IDs are identical
  // ... set up identical mocks for both calls

  const result1 = await service.getAlerts(mockTenantId);
  const result2 = await service.getAlerts(mockTenantId);

  expect(result1.alerts.map(a => a.id)).toEqual(result2.alerts.map(a => a.id));
});
```

**5e — Severity ordering and 50-alert cap:**
```typescript
it('should sort alerts: critical first, then warning, then info', async () => {
  // Set up data that produces at least one of each severity
  // Verify ordering
});

it('should cap alerts at 50 and set total_alerts_truncated', async () => {
  // Mock data that would produce > 50 alerts
  // Verify only 50 returned and flag is set
});
```

---

### Task 6 — Overview Test

**Required test case:**

```typescript
describe('getOverview', () => {
  it('should call all 5 sub-methods in parallel', async () => {
    // Spy on all 5 methods
    const plSpy = jest.spyOn(service, 'getPL').mockResolvedValue({} as any);
    const arSpy = jest.spyOn(service, 'getAR').mockResolvedValue({} as any);
    const apSpy = jest.spyOn(service, 'getAP').mockResolvedValue({} as any);
    const forecastSpy = jest.spyOn(service, 'getForecast').mockResolvedValue({} as any);
    const alertsSpy = jest.spyOn(service, 'getAlerts').mockResolvedValue({ alert_count: 0, alerts: [] } as any);

    await service.getOverview(mockTenantId, {});

    expect(plSpy).toHaveBeenCalledTimes(1);
    expect(arSpy).toHaveBeenCalledTimes(1);
    expect(apSpy).toHaveBeenCalledTimes(1);
    expect(forecastSpy).toHaveBeenCalledTimes(1);
    expect(alertsSpy).toHaveBeenCalledTimes(1);
  });
});
```

---

### Task 7 — Tenant Isolation Test

```typescript
describe('Tenant Isolation', () => {
  it('should include tenant_id in all Prisma queries for getPL', async () => {
    // Set up mocks to return empty results
    // ... set up all mocks

    await service.getPL(mockTenantId, 2026, 1);

    // Verify every Prisma call includes tenant_id
    for (const call of prisma.project_invoice_payment.aggregate.mock.calls) {
      expect(call[0].where.tenant_id).toBe(mockTenantId);
    }
    for (const call of prisma.financial_entry.aggregate.mock.calls) {
      expect(call[0].where.tenant_id).toBe(mockTenantId);
    }
    // ... verify for all other Prisma calls
  });
});
```

---

### Task 8 — Run Tests and Verify

```bash
# Run only dashboard tests
cd /var/www/lead360.app/api && npx jest --testPathPattern=dashboard.service.spec --verbose

# Verify all tests pass
# Fix any failures

# Run ALL financial tests to confirm nothing broke
cd /var/www/lead360.app/api && npx jest --testPathPattern=financial --verbose

# All existing tests must still pass
```

---

## Patterns to Apply

### Test File Pattern (from existing financial tests)
Follow the exact pattern used in `financial-entry.service.spec.ts`:
- `describe()` blocks per method
- `it()` blocks per behavior
- `beforeEach()` for mock setup
- `afterEach()` for mock cleanup
- Use `jest.fn()` for mock methods
- Use `mockResolvedValue()` for async returns

### Date Helper for Tests
```typescript
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
```

### Decimal Mocking
Prisma returns `Prisma.Decimal` objects. In tests, mock them as plain numbers or objects with a `toNumber()` method:
```typescript
// Option 1: Plain numbers (if toNum() handles it)
prisma.project_invoice_payment.aggregate.mockResolvedValue({
  _sum: { amount: 5000 },
});

// Option 2: Decimal-like objects
prisma.project_invoice_payment.aggregate.mockResolvedValue({
  _sum: { amount: { toNumber: () => 5000 } },
});
```

Check how the `toNum()` helper in DashboardService handles the conversion and mock accordingly.

---

## Business Rules Verified by Tests

- Cash-basis income recognition (payment date, not invoice date)
- Aging bucket assignment (all 5 buckets + null due_date → current)
- Subcontractor invoice grouping by subcontractor (pending + approved)
- crew_unpaid_estimate = 0 with note field
- RecurringExpenseService.getPreview() called with correct daysAhead
- CSV export: two sections, correct escaping of commas/quotes
- Alert deduplication (60 suppresses 30, 30 suppresses basic)
- net_forecast_label thresholds (>100, <-100, between)
- P&L zero months included
- Gross/operating/net profit calculations
- Gross margin null when income = 0
- include_pending flag behavior
- Max 50 alerts with truncation flag
- expense_pending_review threshold (>5)
- Tenant isolation on all queries

---

## Acceptance Criteria

- [ ] Test file created at `api/src/modules/financial/services/dashboard.service.spec.ts`
- [ ] P&L tests: cash basis, zero months, profit calculations, margin null, include_pending, totals
- [ ] AR tests: all 5 aging buckets, null due_date, voided excluded, sort order
- [ ] AP tests: subcontractor grouping, crew_unpaid_estimate=0 with note, getPreview called with correct daysAhead
- [ ] Export tests: returns Buffer, CSV contains both sections, CSV escaping for commas and quotes
- [ ] Forecast tests: net_forecast_label all 3 thresholds, days param passed to getPreview
- [ ] Alert tests: deduplication (60→30→basic), pending_review threshold, project_no_invoice, deterministic IDs, severity ordering, 50-cap
- [ ] Overview test: all 5 methods called
- [ ] Tenant isolation test: tenant_id in all queries
- [ ] All tests pass: `npx jest --testPathPattern=dashboard.service.spec`
- [ ] No existing financial tests broken: `npx jest --testPathPattern=financial`
- [ ] Port 8000 not in use when sprint completes

---

## Gate Marker

**STOP** — Before starting Sprint 9_6, verify:
1. All DashboardService unit tests pass
2. All existing financial module tests still pass
3. No regressions introduced

---

## Handoff Notes

**For Sprint 9_6:**
- All implementation and tests are complete
- Sprint 9_6 is documentation + final verification
- The developer needs to update the API documentation and run end-to-end verification of all acceptance criteria from the F-09 contract
