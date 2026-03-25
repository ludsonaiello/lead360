# Sprint 6_7 — Unit Tests for Recurring Expense Engine

**Module:** Financial
**File:** ./documentation/sprints/financial/f06/sprint_6_7.md
**Type:** Backend — Tests
**Depends On:** Sprint 6_6 (all code complete and compiling)
**Gate:** NONE — Tests should pass, but Sprint 6_8 can begin even if test refinements are ongoing.
**Estimated Complexity:** High

---

> **You are a masterclass-level backend engineer.** Your code quality makes engineers at Google, Amazon, and Apple jealous. Every line you write is precise, intentional, and production-grade.

> **WARNING:** This platform is 85% production-ready. Never leave the server running in the background. Never break existing code. Read the codebase before touching anything. Implement with surgical precision — not a single comma may break existing business logic.

> **MySQL credentials** are in the `.env` file at `/var/www/lead360.app/api/.env`. Do NOT hardcode credentials anywhere.

---

## Objective

Write comprehensive unit tests for the `RecurringExpenseService`, focusing on `calculateNextDueDate()` edge cases, `processRule()` transaction behavior, preview calculations, and lifecycle methods (pause/resume/skip).

---

## Pre-Sprint Checklist

- [ ] Read the complete `RecurringExpenseService` implementation (created in Sprints 6_3 and 6_4)
- [ ] Check for existing test files in `/var/www/lead360.app/api/src/modules/financial/` — understand the test structure and patterns used
- [ ] Check for test utilities: look for `PrismaService` mocking patterns in existing tests
- [ ] Verify testing framework: check `package.json` for `jest` configuration
- [ ] Read at least one existing `.spec.ts` file to understand the test pattern used

---

## Dev Server

> This project does NOT use PM2. Do not reference or run PM2 commands.
> Do NOT use `pkill -f` — it does not work reliably. Always use `lsof` + `kill {PID}`.

```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :8000   ← must return nothing before proceeding

DO NOT start the dev server for this sprint — tests run independently.

Run tests with:
  cd /var/www/lead360.app/api && npx jest --testPathPattern="recurring-expense" --verbose

Or for a specific test file:
  cd /var/www/lead360.app/api && npx jest src/modules/financial/services/recurring-expense.service.spec.ts --verbose

BEFORE marking the sprint COMPLETE:
  Confirm no background processes are running:
  lsof -i :8000   ← must return nothing
```

---

## Tasks

### Task 1 — Create Test File for `calculateNextDueDate()`

**File:** `/var/www/lead360.app/api/src/modules/financial/services/recurring-expense.service.spec.ts`

**TIMEZONE WARNING:** JavaScript's `new Date('2026-03-01')` parses as **UTC midnight**, but `.getMonth()` / `.getDate()` return values in **local time**. On non-UTC servers, assertions like `expect(result.getMonth()).toBe(2)` will fail. Use the local-time constructor `new Date(2026, 2, 1)` (month is 0-indexed: 2 = March) to create test dates, OR use UTC methods (`.getUTCMonth()`, `.getUTCDate()`). Be consistent with whichever approach the `calculateNextDueDate` implementation uses.

**Test structure:**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { RecurringExpenseService } from './recurring-expense.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { FinancialEntryService } from './financial-entry.service';

describe('RecurringExpenseService', () => {
  let service: RecurringExpenseService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringExpenseService,
        {
          provide: PrismaService,
          useValue: {
            recurring_expense_rule: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
            financial_entry: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              count: jest.fn(),
            },
            financial_category: {
              findFirst: jest.fn(),
            },
            supplier: {
              findFirst: jest.fn(),
            },
            payment_method_registry: {
              findFirst: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: AuditLoggerService,
          useValue: {
            logTenantChange: jest.fn(),
          },
        },
        {
          provide: FinancialEntryService,
          useValue: {
            createEntry: jest.fn(),
          },
        },
        // Queue mock — for @InjectQueue('recurring-expense-generation')
        {
          provide: 'BullQueue_recurring-expense-generation',
          useValue: {
            add: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RecurringExpenseService>(RecurringExpenseService);
    prisma = module.get<PrismaService>(PrismaService);
  });
```

**Note on queue mock:** The `@InjectQueue('recurring-expense-generation')` token in NestJS BullMQ is `getQueueToken('recurring-expense-generation')`. Check the actual token by reading how BullMQ registers the queue. The mock key might need to be:
```typescript
import { getQueueToken } from '@nestjs/bullmq';
// ...
{ provide: getQueueToken('recurring-expense-generation'), useValue: { add: jest.fn() } },
```

---

### Task 2 — `calculateNextDueDate()` Tests

**Required test cases (all must pass):**

```typescript
describe('calculateNextDueDate', () => {
  // DAILY
  describe('daily frequency', () => {
    it('should add 1 day for daily interval=1', () => {
      const result = service.calculateNextDueDate('daily', 1, new Date('2026-03-01'));
      expect(result).toEqual(new Date('2026-03-02'));
    });

    it('should add 3 days for daily interval=3', () => {
      const result = service.calculateNextDueDate('daily', 3, new Date('2026-03-01'));
      expect(result).toEqual(new Date('2026-03-04'));
    });

    it('should cross month boundary', () => {
      const result = service.calculateNextDueDate('daily', 1, new Date('2026-03-31'));
      expect(result).toEqual(new Date('2026-04-01'));
    });
  });

  // WEEKLY
  describe('weekly frequency', () => {
    it('should add 7 days for weekly interval=1', () => {
      const result = service.calculateNextDueDate('weekly', 1, new Date('2026-03-01'));
      expect(result).toEqual(new Date('2026-03-08'));
    });

    it('should add 14 days for weekly interval=2', () => {
      const result = service.calculateNextDueDate('weekly', 2, new Date('2026-03-01'));
      expect(result).toEqual(new Date('2026-03-15'));
    });

    it('should handle dayOfWeek adjustment', () => {
      // 2026-03-01 is a Sunday (0). Set dayOfWeek=1 (Monday).
      // After adding 7 days (2026-03-08, also Sunday), next Monday is 2026-03-09
      const result = service.calculateNextDueDate('weekly', 1, new Date('2026-03-01'), null, 1);
      // Verify the result falls on a Monday (day 1)
      expect(result.getDay()).toBe(1);
    });
  });

  // MONTHLY
  describe('monthly frequency', () => {
    it('should add 1 month for monthly interval=1', () => {
      const result = service.calculateNextDueDate('monthly', 1, new Date('2026-03-15'));
      expect(result.getMonth()).toBe(3); // April (0-indexed)
      expect(result.getDate()).toBe(15);
    });

    it('should add 2 months for monthly interval=2', () => {
      const result = service.calculateNextDueDate('monthly', 2, new Date('2026-01-15'));
      expect(result.getMonth()).toBe(2); // March
      expect(result.getDate()).toBe(15);
    });

    it('should snap January 31 to February 28 in non-leap year', () => {
      // 2027 is not a leap year
      const result = service.calculateNextDueDate('monthly', 1, new Date('2027-01-31'), 31);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(28);
    });

    it('should snap January 31 to February 29 in leap year', () => {
      // 2028 IS a leap year
      const result = service.calculateNextDueDate('monthly', 1, new Date('2028-01-31'), 31);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(29);
    });

    it('should use dayOfMonth=15 even if current date is different', () => {
      const result = service.calculateNextDueDate('monthly', 1, new Date('2026-03-01'), 15);
      expect(result.getMonth()).toBe(3); // April
      expect(result.getDate()).toBe(15);
    });

    it('should snap dayOfMonth=31 to April 30', () => {
      // March 31 + 1 month = April 30 (April has 30 days)
      const result = service.calculateNextDueDate('monthly', 1, new Date('2026-03-31'), 31);
      expect(result.getMonth()).toBe(3); // April
      expect(result.getDate()).toBe(30);
    });

    it('should not overflow to next month when dayOfMonth exceeds target month days', () => {
      const result = service.calculateNextDueDate('monthly', 1, new Date('2026-01-31'), 31);
      expect(result.getMonth()).toBe(1); // Must be February, NOT March
    });

    it('should handle dayOfMonth=28 for every month', () => {
      const result = service.calculateNextDueDate('monthly', 1, new Date('2026-01-28'), 28);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(28);
    });
  });

  // QUARTERLY
  describe('quarterly frequency', () => {
    it('should add 3 months for quarterly interval=1', () => {
      const result = service.calculateNextDueDate('quarterly', 1, new Date('2026-01-15'));
      expect(result.getMonth()).toBe(3); // April
      expect(result.getDate()).toBe(15);
    });

    it('should add 6 months for quarterly interval=2', () => {
      const result = service.calculateNextDueDate('quarterly', 2, new Date('2026-01-15'));
      expect(result.getMonth()).toBe(6); // July
      expect(result.getDate()).toBe(15);
    });

    it('should snap dayOfMonth in quarterly like monthly', () => {
      // Jan 31 + 3 months = April 30 (no April 31)
      const result = service.calculateNextDueDate('quarterly', 1, new Date('2026-01-31'), 31);
      expect(result.getMonth()).toBe(3); // April
      expect(result.getDate()).toBe(30);
    });
  });

  // ANNUAL
  describe('annual frequency', () => {
    it('should add 1 year for annual interval=1', () => {
      const result = service.calculateNextDueDate('annual', 1, new Date('2026-03-15'));
      expect(result.getFullYear()).toBe(2027);
      expect(result.getMonth()).toBe(2); // March
      expect(result.getDate()).toBe(15);
    });

    it('should add 2 years for annual interval=2', () => {
      const result = service.calculateNextDueDate('annual', 2, new Date('2026-03-15'));
      expect(result.getFullYear()).toBe(2028);
    });

    it('should handle Feb 29 in leap year → Feb 28 in non-leap year', () => {
      // 2028 is leap, 2029 is not
      const result = service.calculateNextDueDate('annual', 1, new Date('2028-02-29'), 29);
      expect(result.getFullYear()).toBe(2029);
      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(28);
    });
  });
});
```

**Adjust date assertions as needed** — the key invariants are:
- Never overflow to the next month
- End-of-month snapping works for all edge cases
- Intervals multiply correctly

---

### Task 3 — `processRule()` Tests

```typescript
describe('processRule', () => {
  it('should skip if rule is not found', async () => {
    jest.spyOn(prisma.recurring_expense_rule, 'findFirst').mockResolvedValue(null);
    const result = await service.processRule('rule-id', 'tenant-id');
    expect(result).toBeUndefined();
  });

  it('should skip if rule is paused', async () => {
    jest.spyOn(prisma.recurring_expense_rule, 'findFirst').mockResolvedValue({
      id: 'rule-id',
      tenant_id: 'tenant-id',
      status: 'paused',
      next_due_date: new Date('2026-01-01'),
      // ... other fields
    } as any);
    const result = await service.processRule('rule-id', 'tenant-id');
    expect(result).toBeUndefined();
  });

  it('should skip if duplicate entry exists for today', async () => {
    jest.spyOn(prisma.recurring_expense_rule, 'findFirst').mockResolvedValue({
      id: 'rule-id',
      tenant_id: 'tenant-id',
      status: 'active',
      next_due_date: new Date('2026-03-01'),
      // ... other fields
    } as any);
    jest.spyOn(prisma.financial_entry, 'findFirst').mockResolvedValue({
      id: 'existing-entry',
    } as any);

    const result = await service.processRule('rule-id', 'tenant-id');
    expect(result).toBeUndefined();
  });

  it('should create entry and update rule in transaction', async () => {
    const mockRule = {
      id: 'rule-id',
      tenant_id: 'tenant-id',
      status: 'active',
      next_due_date: new Date('2026-03-01'),
      frequency: 'monthly',
      interval: 1,
      day_of_month: null,
      day_of_week: null,
      category_id: 'cat-id',
      amount: 1850,
      tax_amount: null,
      vendor_name: 'Insurance Co',
      supplier_id: null,
      payment_method_registry_id: null,
      notes: null,
      auto_confirm: true,
      created_by_user_id: 'user-id',
      occurrences_generated: 0,
      recurrence_count: null,
      end_date: null,
    };

    jest.spyOn(prisma.recurring_expense_rule, 'findFirst').mockResolvedValue(mockRule as any);
    jest.spyOn(prisma.financial_entry, 'findFirst').mockResolvedValue(null);

    const mockEntry = { id: 'new-entry-id', amount: 1850 };
    const mockTx = {
      financial_entry: { create: jest.fn().mockResolvedValue(mockEntry) },
      recurring_expense_rule: { update: jest.fn().mockResolvedValue({}) },
    };
    jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(mockTx));

    const result = await service.processRule('rule-id', 'tenant-id');

    expect(mockTx.financial_entry.create).toHaveBeenCalled();
    expect(mockTx.recurring_expense_rule.update).toHaveBeenCalled();
    expect(result).toEqual(mockEntry);
  });

  it('should set status to completed when recurrence_count reached', async () => {
    const mockRule = {
      id: 'rule-id',
      tenant_id: 'tenant-id',
      status: 'active',
      next_due_date: new Date('2026-03-01'),
      frequency: 'monthly',
      interval: 1,
      day_of_month: null,
      day_of_week: null,
      category_id: 'cat-id',
      amount: 100,
      tax_amount: null,
      vendor_name: null,
      supplier_id: null,
      payment_method_registry_id: null,
      notes: null,
      auto_confirm: true,
      created_by_user_id: 'user-id',
      occurrences_generated: 11,  // 12th occurrence will complete it
      recurrence_count: 12,
      end_date: null,
    };

    jest.spyOn(prisma.recurring_expense_rule, 'findFirst').mockResolvedValue(mockRule as any);
    jest.spyOn(prisma.financial_entry, 'findFirst').mockResolvedValue(null);

    const mockTx = {
      financial_entry: { create: jest.fn().mockResolvedValue({ id: 'entry-id' }) },
      recurring_expense_rule: { update: jest.fn().mockResolvedValue({}) },
    };
    jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(mockTx));

    await service.processRule('rule-id', 'tenant-id');

    const updateCall = mockTx.recurring_expense_rule.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('completed');
    expect(updateCall.data.occurrences_generated).toBe(12);
  });

  it('should set submission_status based on auto_confirm', async () => {
    const mockRule = {
      id: 'rule-id',
      tenant_id: 'tenant-id',
      status: 'active',
      next_due_date: new Date('2026-03-01'),
      frequency: 'monthly',
      interval: 1,
      day_of_month: null,
      day_of_week: null,
      category_id: 'cat-id',
      amount: 100,
      tax_amount: null,
      vendor_name: null,
      supplier_id: null,
      payment_method_registry_id: null,
      notes: null,
      auto_confirm: false,  // Should create pending_review entry
      created_by_user_id: 'user-id',
      occurrences_generated: 0,
      recurrence_count: null,
      end_date: null,
    };

    jest.spyOn(prisma.recurring_expense_rule, 'findFirst').mockResolvedValue(mockRule as any);
    jest.spyOn(prisma.financial_entry, 'findFirst').mockResolvedValue(null);

    const mockTx = {
      financial_entry: { create: jest.fn().mockResolvedValue({ id: 'entry-id' }) },
      recurring_expense_rule: { update: jest.fn().mockResolvedValue({}) },
    };
    jest.spyOn(prisma, '$transaction').mockImplementation(async (fn: any) => fn(mockTx));

    await service.processRule('rule-id', 'tenant-id');

    const createCall = mockTx.financial_entry.create.mock.calls[0][0];
    expect(createCall.data.submission_status).toBe('pending_review');
    expect(createCall.data.is_recurring_instance).toBe(true);
    expect(createCall.data.recurring_rule_id).toBe('rule-id');
  });
});
```

---

### Task 4 — Lifecycle Method Tests

```typescript
describe('pause', () => {
  it('should throw if rule is not active', async () => {
    jest.spyOn(prisma.recurring_expense_rule, 'findFirst').mockResolvedValue({
      id: 'rule-id', status: 'paused', tenant_id: 'tenant-id',
    } as any);

    await expect(service.pause('tenant-id', 'rule-id', 'user-id'))
      .rejects.toThrow('Only active rules can be paused');
  });
});

describe('resume', () => {
  it('should throw if rule is not paused', async () => {
    jest.spyOn(prisma.recurring_expense_rule, 'findFirst').mockResolvedValue({
      id: 'rule-id', status: 'active', tenant_id: 'tenant-id',
    } as any);

    await expect(service.resume('tenant-id', 'rule-id', 'user-id'))
      .rejects.toThrow('Only paused rules can be resumed');
  });

  it('should advance next_due_date to future when resuming after long pause', async () => {
    // Rule was paused since January, next_due_date is Feb 1, today is March 17
    const mockRule = {
      id: 'rule-id',
      tenant_id: 'tenant-id',
      status: 'paused',
      next_due_date: new Date('2026-02-01'),
      frequency: 'monthly',
      interval: 1,
      day_of_month: 1,
      day_of_week: null,
    };

    jest.spyOn(prisma.recurring_expense_rule, 'findFirst').mockResolvedValue(mockRule as any);
    jest.spyOn(prisma.recurring_expense_rule, 'update').mockResolvedValue({} as any);

    await service.resume('tenant-id', 'rule-id', 'user-id');

    const updateCall = (prisma.recurring_expense_rule.update as jest.Mock).mock.calls[0][0];
    const newNextDate = new Date(updateCall.data.next_due_date);
    // The new next_due_date should be in the future (after today)
    expect(newNextDate >= new Date()).toBe(true);
  });
});

describe('skipNext', () => {
  it('should increment occurrences_generated on skip', async () => {
    const mockRule = {
      id: 'rule-id',
      tenant_id: 'tenant-id',
      status: 'active',
      next_due_date: new Date('2026-04-01'),
      frequency: 'monthly',
      interval: 1,
      day_of_month: 1,
      day_of_week: null,
      occurrences_generated: 5,
      recurrence_count: null,
      end_date: null,
    };

    jest.spyOn(prisma.recurring_expense_rule, 'findFirst').mockResolvedValue(mockRule as any);
    jest.spyOn(prisma.recurring_expense_rule, 'update').mockResolvedValue({} as any);

    await service.skipNext('tenant-id', 'rule-id', 'user-id', {});

    const updateCall = (prisma.recurring_expense_rule.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.occurrences_generated).toBe(6);
  });

  it('should set status to completed if skip reaches recurrence_count', async () => {
    const mockRule = {
      id: 'rule-id',
      tenant_id: 'tenant-id',
      status: 'active',
      next_due_date: new Date('2026-04-01'),
      frequency: 'monthly',
      interval: 1,
      day_of_month: 1,
      day_of_week: null,
      occurrences_generated: 11,
      recurrence_count: 12,
      end_date: null,
    };

    jest.spyOn(prisma.recurring_expense_rule, 'findFirst').mockResolvedValue(mockRule as any);
    jest.spyOn(prisma.recurring_expense_rule, 'update').mockResolvedValue({} as any);

    await service.skipNext('tenant-id', 'rule-id', 'user-id', {});

    const updateCall = (prisma.recurring_expense_rule.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.status).toBe('completed');
  });
});
```

---

### Task 5 — Preview Tests

```typescript
describe('getPreview', () => {
  it('should return correct occurrences for 30-day window', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rule = {
      id: 'rule-id',
      name: 'Monthly Insurance',
      frequency: 'monthly',
      interval: 1,
      amount: 1850,
      tax_amount: null,
      day_of_month: null,
      day_of_week: null,
      next_due_date: today,  // Due today
      occurrences_generated: 0,
      recurrence_count: null,
      end_date: null,
      category: { id: 'cat-id', name: 'Insurance' },
      supplier: null,
      payment_method: null,
    };

    jest.spyOn(prisma.recurring_expense_rule, 'findMany').mockResolvedValue([rule] as any);

    const result = await service.getPreview('tenant-id', 30);

    // Monthly rule in 30-day window should appear once
    expect(result.occurrences.length).toBe(1);
    expect(result.total_obligations).toBe(1850);
    expect(result.period_days).toBe(30);
  });

  it('should return 3 occurrences for monthly rule in 90-day window', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rule = {
      id: 'rule-id',
      name: 'Monthly Insurance',
      frequency: 'monthly',
      interval: 1,
      amount: 500,
      tax_amount: null,
      day_of_month: today.getDate(),
      day_of_week: null,
      next_due_date: today,
      occurrences_generated: 0,
      recurrence_count: null,
      end_date: null,
      category: { id: 'cat-id', name: 'Insurance' },
      supplier: null,
      payment_method: null,
    };

    jest.spyOn(prisma.recurring_expense_rule, 'findMany').mockResolvedValue([rule] as any);

    const result = await service.getPreview('tenant-id', 90);

    // Monthly rule in 90-day window should appear ~3 times
    expect(result.occurrences.length).toBeGreaterThanOrEqual(2);
    expect(result.occurrences.length).toBeLessThanOrEqual(4);
  });

  it('should not create any entries (read-only)', async () => {
    jest.spyOn(prisma.recurring_expense_rule, 'findMany').mockResolvedValue([]);
    await service.getPreview('tenant-id', 30);
    expect(prisma.financial_entry.create).not.toHaveBeenCalled();
  });
});
```

---

### Task 6 — Run Tests

```bash
cd /var/www/lead360.app/api && npx jest src/modules/financial/services/recurring-expense.service.spec.ts --verbose
```

**Expected:** All tests pass. If some tests fail due to implementation differences (date boundary issues, mock shape mismatches), fix the tests to match the actual implementation — the tests must verify correct behavior, not dictate implementation details.

**Coverage target:** >80% of `recurring-expense.service.ts` lines covered.

To check coverage:
```bash
cd /var/www/lead360.app/api && npx jest src/modules/financial/services/recurring-expense.service.spec.ts --coverage --verbose
```

---

## Acceptance Criteria

- [ ] Test file created at correct path
- [ ] `calculateNextDueDate()` tests cover all 5 frequencies
- [ ] Monthly end-of-month snapping tests pass (Jan 31 → Feb 28)
- [ ] Leap year test passes (Feb 29 → Feb 28 in non-leap year)
- [ ] `processRule()` tests verify entry creation with correct fields
- [ ] `processRule()` tests verify transaction behavior
- [ ] `processRule()` tests verify duplicate prevention
- [ ] `processRule()` tests verify termination on recurrence_count
- [ ] `processRule()` tests verify auto_confirm → submission_status mapping
- [ ] Pause/resume lifecycle tests pass
- [ ] Resume after past next_due_date advances to future
- [ ] Skip increments occurrences_generated
- [ ] Skip triggers completion when recurrence_count reached
- [ ] Preview returns correct occurrence count
- [ ] Preview never creates entries
- [ ] All tests pass with `npx jest`
- [ ] No existing test files modified

---

## Gate Marker

**NONE** — Proceed to Sprint 6_8 after tests are written. If test refinements are needed, they can continue alongside Sprint 6_8.

---

## Handoff Notes

- Test file: `/var/www/lead360.app/api/src/modules/financial/services/recurring-expense.service.spec.ts`
- Tests mock PrismaService, AuditLoggerService, FinancialEntryService, and the BullMQ queue
- `calculateNextDueDate()` tests are pure function tests — no mocks needed
- `processRule()` tests mock the Prisma transaction using `jest.spyOn(prisma, '$transaction').mockImplementation()`
