# Sprint 7_6 — Unit Tests

**Module:** Financial
**File:** ./documentation/sprints/financial/f07/sprint_7_6.md
**Type:** Backend — Unit Tests
**Depends On:** Sprint 7_5 (all endpoints accessible)
**Gate:** STOP — All tests must pass. Coverage must meet requirements.
**Estimated Complexity:** Medium

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

Write comprehensive unit tests for `ProjectFinancialSummaryService`. Tests must cover:
1. Tenant isolation — cross-tenant access returns 404
2. Margin calculations — null contract_value, zero contract_value, normal values
3. Confirmed vs pending entry separation
4. Timeline zero-fill months
5. Task breakdown with zero-activity tasks
6. Receipt pagination and filtering
7. Workforce aggregation correctness

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/financial/services/project-financial-summary.service.ts` — understand all methods
- [ ] Read existing test files for patterns:
  - `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.spec.ts`
  - `/var/www/lead360.app/api/src/modules/financial/services/crew-hour-log.service.spec.ts`
  - `/var/www/lead360.app/api/src/modules/financial/services/subcontractor-invoice.service.spec.ts`
- [ ] Understand the test setup pattern: NestJS `Test.createTestingModule` with mocked `PrismaService`

---

## Dev Server

> Unit tests do NOT require the dev server to be running. The test runner uses mocked services.

```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}

Run tests:
  cd /var/www/lead360.app/api && npx jest src/modules/financial/services/project-financial-summary.service.spec.ts --verbose

BEFORE marking the sprint COMPLETE:
  lsof -i :8000
  kill {PID}   (if running)
  Confirm port is free: lsof -i :8000   <- must return nothing
```

---

## Tasks

### Task 1 — Read Existing Test Patterns

**What:** Read at least 2 existing spec files to understand the project's testing conventions before writing new tests.

**Read these files:**
- `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.spec.ts`
- `/var/www/lead360.app/api/src/modules/financial/services/crew-hour-log.service.spec.ts`

**Learn:**
- How `PrismaService` is mocked
- How test module is set up
- How assertions are structured
- What utilities are used (jest.fn, mockResolvedValue, etc.)

**Follow the exact same patterns.** Do NOT invent a new test setup — match the existing project conventions.

---

### Task 2 — Create Test File

**What:** Create the unit test file.

**File:** `/var/www/lead360.app/api/src/modules/financial/services/project-financial-summary.service.spec.ts`

**Test Structure (describe blocks):**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProjectFinancialSummaryService } from './project-financial-summary.service';
import { PrismaService } from '../../../core/database/prisma.service';

describe('ProjectFinancialSummaryService', () => {
  let service: ProjectFinancialSummaryService;
  let prisma: PrismaService;

  // Mock data constants
  const TENANT_ID = 'tenant-uuid-1';
  const OTHER_TENANT_ID = 'tenant-uuid-2';
  const PROJECT_ID = 'project-uuid-1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectFinancialSummaryService,
        {
          provide: PrismaService,
          useValue: {
            project: {
              findFirst: jest.fn(),
            },
            financial_entry: {
              aggregate: jest.fn(),
              count: jest.fn(),
              groupBy: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
            },
            financial_category: {
              findMany: jest.fn(),
            },
            project_task: {
              findMany: jest.fn(),
            },
            subcontractor_task_invoice: {
              aggregate: jest.fn(),
              groupBy: jest.fn(),
              findMany: jest.fn(),
            },
            subcontractor_payment_record: {
              aggregate: jest.fn(),
              findMany: jest.fn(),
            },
            crew_hour_log: {
              aggregate: jest.fn(),
              findMany: jest.fn(),
              groupBy: jest.fn(),
            },
            crew_payment_record: {
              aggregate: jest.fn(),
              findMany: jest.fn(),
            },
            receipt: {
              count: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get(ProjectFinancialSummaryService);
    prisma = module.get(PrismaService);
  });

  // ── Test groups follow ──
});
```

---

### Task 3 — Write Test Group: validateProjectAccess (Tenant Isolation)

```typescript
describe('validateProjectAccess', () => {
  it('should throw NotFoundException when project does not exist', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.getFullSummary(TENANT_ID, 'nonexistent-uuid'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException when project belongs to different tenant', async () => {
    // Project exists but belongs to OTHER_TENANT_ID
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.getFullSummary(OTHER_TENANT_ID, PROJECT_ID),
    ).rejects.toThrow(NotFoundException);
  });

  it('should proceed when project belongs to requesting tenant', async () => {
    // Setup: mock project exists
    (prisma.project.findFirst as jest.Mock).mockResolvedValue({
      id: PROJECT_ID,
      project_number: 'P-001',
      name: 'Test Project',
      status: 'in_progress',
      progress_percent: 50.00,
      start_date: null,
      target_completion_date: null,
      actual_completion_date: null,
      contract_value: null,
      estimated_cost: null,
      assigned_pm_user: null,
    });

    // Setup: mock all aggregation queries to return empty/zero
    setupEmptyAggregationMocks(prisma);

    const result = await service.getFullSummary(TENANT_ID, PROJECT_ID);
    expect(result).toBeDefined();
    expect(result.project.id).toBe(PROJECT_ID);
  });
});
```

**Note:** `setupEmptyAggregationMocks` is a helper function you should create at the top of the test file to mock all Prisma aggregate/count/groupBy calls with zero/empty results. This prevents test noise.

---

### Task 4 — Write Test Group: Margin Analysis

```typescript
describe('margin analysis', () => {
  it('should return null margins when contract_value is null', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(
      mockProject({ contract_value: null, estimated_cost: 50000 }),
    );
    setupEmptyAggregationMocks(prisma);

    const result = await service.getFullSummary(TENANT_ID, PROJECT_ID);

    expect(result.margin_analysis.contract_value).toBeNull();
    expect(result.margin_analysis.estimated_margin).toBeNull();
    expect(result.margin_analysis.actual_margin).toBeNull();
    expect(result.margin_analysis.margin_percent).toBeNull();
  });

  it('should return null margin_percent when contract_value is zero', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(
      mockProject({ contract_value: 0, estimated_cost: 50000 }),
    );
    setupEmptyAggregationMocks(prisma);

    const result = await service.getFullSummary(TENANT_ID, PROJECT_ID);

    expect(result.margin_analysis.margin_percent).toBeNull();
    // margin_percent must NEVER be NaN
    expect(result.margin_analysis.margin_percent).not.toBeNaN();
  });

  it('should calculate margins correctly with valid values', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(
      mockProject({ contract_value: 100000, estimated_cost: 80000 }),
    );
    // Mock confirmed expenses = 75000
    setupCostMocks(prisma, { confirmed: 75000, pending: 5000 });

    const result = await service.getFullSummary(TENANT_ID, PROJECT_ID);

    expect(result.margin_analysis.contract_value).toBe(100000);
    expect(result.margin_analysis.estimated_cost).toBe(80000);
    expect(result.margin_analysis.actual_cost_confirmed).toBe(75000);
    expect(result.margin_analysis.actual_cost_total).toBe(80000); // 75000 + 5000
    expect(result.margin_analysis.estimated_margin).toBe(20000); // 100000 - 80000
    expect(result.margin_analysis.actual_margin).toBe(25000); // 100000 - 75000
    expect(result.margin_analysis.cost_variance).toBe(-5000); // 75000 - 80000 (under budget)
    expect(result.margin_analysis.margin_percent).toBe(25); // (25000/100000)*100
  });

  it('should return null cost_variance when estimated_cost is null', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(
      mockProject({ contract_value: 100000, estimated_cost: null }),
    );
    setupEmptyAggregationMocks(prisma);

    const result = await service.getFullSummary(TENANT_ID, PROJECT_ID);

    expect(result.margin_analysis.cost_variance).toBeNull();
    expect(result.margin_analysis.estimated_margin).toBeNull();
  });
});
```

---

### Task 5 — Write Test Group: Confirmed vs Pending Entry Separation

```typescript
describe('confirmed vs pending entries', () => {
  it('should separate confirmed and pending expenses', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(
      mockProject({ contract_value: 100000 }),
    );

    // Mock: confirmed = 60000, pending = 15000
    (prisma.financial_entry.aggregate as jest.Mock)
      .mockResolvedValueOnce({ _sum: { amount: 60000 } }) // confirmed
      .mockResolvedValueOnce({ _sum: { amount: 15000 } }) // pending
      .mockResolvedValueOnce({ _sum: { tax_amount: 5000 } }); // tax

    // Mock remaining queries that getFullSummary calls (non-aggregate)
    (prisma.financial_entry.count as jest.Mock).mockResolvedValue(10);
    (prisma.financial_entry.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.financial_category.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.project_task.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.subcontractor_task_invoice.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: null }, _count: 0 });
    (prisma.subcontractor_payment_record.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: null }, _count: 0 });
    (prisma.crew_hour_log.aggregate as jest.Mock).mockResolvedValue({ _sum: { hours_regular: null, hours_overtime: null } });
    (prisma.crew_hour_log.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.crew_payment_record.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: null } });
    (prisma.crew_payment_record.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.receipt.count as jest.Mock).mockResolvedValue(0);

    const result = await service.getFullSummary(TENANT_ID, PROJECT_ID);

    expect(result.cost_summary.total_expenses).toBe(60000);
    expect(result.cost_summary.total_expenses_pending).toBe(15000);
    expect(result.margin_analysis.actual_cost_confirmed).toBe(60000);
    expect(result.margin_analysis.actual_cost_total).toBe(75000); // 60000 + 15000
  });
});
```

---

### Task 6 — Write Test Group: Timeline Zero-Fill

```typescript
describe('timeline', () => {
  it('should include zero-expense months within project date range', async () => {
    (prisma.project.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: PROJECT_ID }) // validateProjectAccess
      .mockResolvedValueOnce({ // getTimeline project fetch
        start_date: new Date('2025-01-01'),
        actual_completion_date: new Date('2025-04-30'),
      });

    // No entries at all
    (prisma.financial_entry.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.getTimeline(TENANT_ID, PROJECT_ID);

    // Should have 4 months: Jan, Feb, Mar, Apr 2025
    expect(result.months).toHaveLength(4);
    expect(result.months[0].month_label).toBe('Jan 2025');
    expect(result.months[0].total_expenses).toBe(0);
    expect(result.months[3].month_label).toBe('Apr 2025');
    expect(result.cumulative_total).toBe(0);
  });

  it('should include by_category breakdown per month', async () => {
    (prisma.project.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: PROJECT_ID })
      .mockResolvedValueOnce({
        start_date: new Date('2025-03-01'),
        actual_completion_date: new Date('2025-03-31'),
      });

    (prisma.financial_entry.findMany as jest.Mock).mockResolvedValue([
      {
        entry_date: new Date('2025-03-15'),
        amount: 500,
        category: { name: 'Materials', type: 'material' },
      },
      {
        entry_date: new Date('2025-03-20'),
        amount: 300,
        category: { name: 'Labor', type: 'labor' },
      },
    ]);

    const result = await service.getTimeline(TENANT_ID, PROJECT_ID);

    expect(result.months).toHaveLength(1);
    expect(result.months[0].total_expenses).toBe(800);
    expect(result.months[0].by_category).toHaveLength(2);
    expect(result.cumulative_total).toBe(800);
  });
});
```

---

### Task 7 — Write Test Group: Task Breakdown

```typescript
describe('task breakdown', () => {
  it('should include tasks with zero financial activity', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: PROJECT_ID });

    // 3 tasks
    (prisma.project_task.findMany as jest.Mock).mockResolvedValue([
      { id: 'task-1', title: 'Foundation', status: 'done', order_index: 1 },
      { id: 'task-2', title: 'Framing', status: 'in_progress', order_index: 2 },
      { id: 'task-3', title: 'Cleanup', status: 'not_started', order_index: 3 },
    ]);

    // Only task-1 has expenses
    (prisma.financial_entry.groupBy as jest.Mock)
      .mockResolvedValueOnce([
        { task_id: 'task-1', _sum: { amount: 5000 }, _count: 3 },
      ])
      .mockResolvedValueOnce([]); // task+category breakdown

    // No invoices or hours
    (prisma.subcontractor_task_invoice.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.crew_hour_log.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.financial_category.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.getTaskBreakdown(TENANT_ID, PROJECT_ID, {});

    expect(result.tasks).toHaveLength(3); // ALL tasks returned
    expect(result.tasks.find((t) => t.task_id === 'task-1')!.expenses.total).toBe(5000);
    expect(result.tasks.find((t) => t.task_id === 'task-2')!.expenses.total).toBe(0);
    expect(result.tasks.find((t) => t.task_id === 'task-3')!.expenses.total).toBe(0);
  });
});
```

---

### Task 8 — Write Test Group: Revenue Note

```typescript
describe('revenue_note', () => {
  it('should always include revenue_note in summary response', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(
      mockProject({ contract_value: null }),
    );
    setupEmptyAggregationMocks(prisma);

    const result = await service.getFullSummary(TENANT_ID, PROJECT_ID);

    expect(result.revenue_note).toBe(
      'Revenue data (invoiced amount, collected amount) will be available after the Invoicing Module is implemented.',
    );
  });
});
```

---

### Task 9 — Create Helper Functions

**What:** Create helper functions at the bottom of the test file (before the closing `});`) for reusable mock setup.

```typescript
// ── Test Helpers ──

function mockProject(overrides: {
  contract_value?: number | null;
  estimated_cost?: number | null;
} = {}) {
  return {
    id: PROJECT_ID,
    project_number: 'P-001',
    name: 'Test Project',
    status: 'in_progress',
    progress_percent: 50.00,
    start_date: new Date('2025-01-01'),
    target_completion_date: new Date('2025-12-31'),
    actual_completion_date: null,
    // IMPORTANT: Use 'in' check, NOT ?? operator. The ?? operator treats null as nullish
    // and would replace null with the default — breaking tests that need null values.
    contract_value: 'contract_value' in overrides ? overrides.contract_value : 100000,
    estimated_cost: 'estimated_cost' in overrides ? overrides.estimated_cost : 80000,
    assigned_pm_user: { id: 'user-1', first_name: 'John', last_name: 'Doe' },
  };
}

function setupEmptyAggregationMocks(prisma: any) {
  (prisma.financial_entry.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: null, tax_amount: null } });
  (prisma.financial_entry.count as jest.Mock).mockResolvedValue(0);
  (prisma.financial_entry.groupBy as jest.Mock).mockResolvedValue([]);
  (prisma.financial_category.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.project_task.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.subcontractor_task_invoice.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: null }, _count: 0 });
  (prisma.subcontractor_payment_record.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: null }, _count: 0 });
  (prisma.crew_hour_log.aggregate as jest.Mock).mockResolvedValue({ _sum: { hours_regular: null, hours_overtime: null } });
  (prisma.crew_hour_log.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.crew_payment_record.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: null } });
  (prisma.crew_payment_record.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.receipt.count as jest.Mock).mockResolvedValue(0);
}

function setupCostMocks(prisma: any, costs: { confirmed: number; pending: number }) {
  (prisma.financial_entry.aggregate as jest.Mock)
    .mockResolvedValueOnce({ _sum: { amount: costs.confirmed } })
    .mockResolvedValueOnce({ _sum: { amount: costs.pending } })
    .mockResolvedValueOnce({ _sum: { tax_amount: 0 } });
  (prisma.financial_entry.count as jest.Mock).mockResolvedValue(10);
  (prisma.financial_entry.groupBy as jest.Mock).mockResolvedValue([]);
  (prisma.financial_category.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.project_task.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.subcontractor_task_invoice.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: null }, _count: 0 });
  (prisma.subcontractor_payment_record.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: null }, _count: 0 });
  (prisma.crew_hour_log.aggregate as jest.Mock).mockResolvedValue({ _sum: { hours_regular: null, hours_overtime: null } });
  (prisma.crew_hour_log.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.crew_payment_record.aggregate as jest.Mock).mockResolvedValue({ _sum: { amount: null } });
  (prisma.crew_payment_record.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.receipt.count as jest.Mock).mockResolvedValue(0);
}
```

**Adapt these helpers as needed based on the actual service implementation and the mock patterns used in existing spec files.**

---

### Task 10 — Run Tests

```bash
cd /var/www/lead360.app/api
npx jest src/modules/financial/services/project-financial-summary.service.spec.ts --verbose
```

**All tests must pass.** If any fail, fix them. Do NOT leave failing tests.

---

## Acceptance Criteria

- [ ] Test file created: `project-financial-summary.service.spec.ts`
- [ ] Test: validateProjectAccess — cross-tenant returns NotFoundException
- [ ] Test: validateProjectAccess — nonexistent project returns NotFoundException
- [ ] Test: margin calculation with null contract_value — all margin fields null
- [ ] Test: margin calculation with zero contract_value — margin_percent is null, NOT NaN
- [ ] Test: margin calculation with valid values — correct arithmetic
- [ ] Test: cost_variance with null estimated_cost — returns null
- [ ] Test: confirmed vs pending entry separation
- [ ] Test: timeline includes zero-expense months in range
- [ ] Test: timeline by_category populated correctly
- [ ] Test: task breakdown includes zero-activity tasks
- [ ] Test: revenue_note present in every summary response
- [ ] All tests pass: `npx jest ... --verbose` shows green
- [ ] Test file follows existing project test conventions
- [ ] No existing test files modified
- [ ] Dev server shut down (if started)

---

## Gate Marker

**STOP** — All tests must pass before Sprint 7_7 begins:
```bash
npx jest src/modules/financial/services/project-financial-summary.service.spec.ts --verbose
```
All tests green. Zero failures.

---

## Handoff Notes

**For Sprint 7_7 (API Documentation + Final Verification):**
- All tests passing
- All 5 endpoints accessible and returning correct data
- Ready for final documentation and acceptance criteria verification
