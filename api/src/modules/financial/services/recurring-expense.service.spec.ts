import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RecurringExpenseService } from './recurring-expense.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { FinancialEntryService } from './financial-entry.service';
import { getQueueToken } from '@nestjs/bullmq';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-001';
const USER_ID = 'user-uuid-001';
const RULE_ID = 'rule-uuid-001';
const CATEGORY_ID = 'category-uuid-001';
const ENTRY_ID = 'entry-uuid-001';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const mockRule = (overrides: any = {}) => ({
  id: RULE_ID,
  tenant_id: TENANT_ID,
  name: 'Monthly Insurance',
  description: null,
  category_id: CATEGORY_ID,
  amount: 1850,
  tax_amount: null,
  frequency: 'monthly',
  interval: 1,
  day_of_month: null,
  day_of_week: null,
  start_date: new Date(2026, 0, 1),
  end_date: null,
  next_due_date: new Date(2026, 2, 1), // March 1
  recurrence_count: null,
  occurrences_generated: 0,
  auto_confirm: true,
  status: 'active',
  vendor_name: 'Insurance Co',
  supplier_id: null,
  payment_method_registry_id: null,
  notes: null,
  created_by_user_id: USER_ID,
  updated_by_user_id: null,
  last_generated_at: null,
  last_generated_entry_id: null,
  created_at: new Date(2026, 0, 1),
  updated_at: new Date(2026, 0, 1),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mock services
// ---------------------------------------------------------------------------

const mockPrismaService = {
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
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn().mockResolvedValue(undefined),
};

const mockFinancialEntryService = {
  createEntry: jest.fn(),
};

const mockQueue = {
  add: jest.fn().mockResolvedValue(undefined),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RecurringExpenseService', () => {
  let service: RecurringExpenseService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringExpenseService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
        { provide: FinancialEntryService, useValue: mockFinancialEntryService },
        {
          provide: getQueueToken('recurring-expense-generation'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<RecurringExpenseService>(RecurringExpenseService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  // =========================================================================
  // calculateNextDueDate — Pure function tests
  // =========================================================================

  describe('calculateNextDueDate', () => {
    // -----------------------------------------------------------------------
    // DAILY
    // -----------------------------------------------------------------------
    describe('daily frequency', () => {
      it('should add 1 day for daily interval=1', () => {
        const result = service.calculateNextDueDate(
          'daily',
          1,
          new Date(2026, 2, 1), // March 1
        );
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(2); // March
        expect(result.getDate()).toBe(2);
      });

      it('should add 3 days for daily interval=3', () => {
        const result = service.calculateNextDueDate(
          'daily',
          3,
          new Date(2026, 2, 1), // March 1
        );
        expect(result.getFullYear()).toBe(2026);
        expect(result.getMonth()).toBe(2);
        expect(result.getDate()).toBe(4);
      });

      it('should cross month boundary', () => {
        const result = service.calculateNextDueDate(
          'daily',
          1,
          new Date(2026, 2, 31), // March 31
        );
        expect(result.getMonth()).toBe(3); // April
        expect(result.getDate()).toBe(1);
      });

      it('should cross year boundary', () => {
        const result = service.calculateNextDueDate(
          'daily',
          1,
          new Date(2026, 11, 31), // Dec 31
        );
        expect(result.getFullYear()).toBe(2027);
        expect(result.getMonth()).toBe(0); // January
        expect(result.getDate()).toBe(1);
      });
    });

    // -----------------------------------------------------------------------
    // WEEKLY
    // -----------------------------------------------------------------------
    describe('weekly frequency', () => {
      it('should add 7 days for weekly interval=1', () => {
        const result = service.calculateNextDueDate(
          'weekly',
          1,
          new Date(2026, 2, 1), // March 1 (Sunday)
        );
        expect(result.getMonth()).toBe(2);
        expect(result.getDate()).toBe(8);
      });

      it('should add 14 days for weekly interval=2', () => {
        const result = service.calculateNextDueDate(
          'weekly',
          2,
          new Date(2026, 2, 1), // March 1
        );
        expect(result.getMonth()).toBe(2);
        expect(result.getDate()).toBe(15);
      });

      it('should handle dayOfWeek adjustment — land on Monday', () => {
        // March 1, 2026 is a Sunday (day 0). Weekly interval=1.
        // After adding 7 days → March 8 (Sunday). dayOfWeek=1 (Monday) → March 9.
        const result = service.calculateNextDueDate(
          'weekly',
          1,
          new Date(2026, 2, 1), // Sunday
          null,
          1, // Monday
        );
        expect(result.getDay()).toBe(1); // Monday
        expect(result.getMonth()).toBe(2); // March
        expect(result.getDate()).toBe(9);
      });

      it('should not adjust if already on the target day', () => {
        // March 2, 2026 is a Monday. dayOfWeek=1 (Monday).
        // After adding 7 days → March 9 (Monday). Already on target day.
        const result = service.calculateNextDueDate(
          'weekly',
          1,
          new Date(2026, 2, 2), // Monday
          null,
          1, // Monday
        );
        expect(result.getDay()).toBe(1); // Monday
        expect(result.getDate()).toBe(9);
      });
    });

    // -----------------------------------------------------------------------
    // MONTHLY
    // -----------------------------------------------------------------------
    describe('monthly frequency', () => {
      it('should add 1 month for monthly interval=1', () => {
        const result = service.calculateNextDueDate(
          'monthly',
          1,
          new Date(2026, 2, 15), // March 15
        );
        expect(result.getMonth()).toBe(3); // April
        expect(result.getDate()).toBe(15);
      });

      it('should add 2 months for monthly interval=2', () => {
        const result = service.calculateNextDueDate(
          'monthly',
          2,
          new Date(2026, 0, 15), // Jan 15
        );
        expect(result.getMonth()).toBe(2); // March
        expect(result.getDate()).toBe(15);
      });

      it('should snap January 31 to February 28 in non-leap year', () => {
        // 2027 is NOT a leap year
        const result = service.calculateNextDueDate(
          'monthly',
          1,
          new Date(2027, 0, 31), // Jan 31, 2027
          31,
        );
        expect(result.getMonth()).toBe(1); // February
        expect(result.getDate()).toBe(28);
      });

      it('should snap January 31 to February 29 in leap year', () => {
        // 2028 IS a leap year
        const result = service.calculateNextDueDate(
          'monthly',
          1,
          new Date(2028, 0, 31), // Jan 31, 2028
          31,
        );
        expect(result.getMonth()).toBe(1); // February
        expect(result.getDate()).toBe(29);
      });

      it('should use dayOfMonth=15 even if current date is different', () => {
        const result = service.calculateNextDueDate(
          'monthly',
          1,
          new Date(2026, 2, 1), // March 1
          15,
        );
        expect(result.getMonth()).toBe(3); // April
        expect(result.getDate()).toBe(15);
      });

      it('should snap dayOfMonth=31 to April 30', () => {
        // March 31 + 1 month = April. April has 30 days → snap to 30.
        const result = service.calculateNextDueDate(
          'monthly',
          1,
          new Date(2026, 2, 31), // March 31
          31,
        );
        expect(result.getMonth()).toBe(3); // April
        expect(result.getDate()).toBe(30);
      });

      it('should not overflow to next month when dayOfMonth exceeds target month days', () => {
        // Jan 31 → Feb (28 days in 2026). Must stay in February, NOT March.
        const result = service.calculateNextDueDate(
          'monthly',
          1,
          new Date(2026, 0, 31), // Jan 31
          31,
        );
        expect(result.getMonth()).toBe(1); // February, NOT March
        expect(result.getDate()).toBe(28);
      });

      it('should handle dayOfMonth=28 for every month consistently', () => {
        const result = service.calculateNextDueDate(
          'monthly',
          1,
          new Date(2026, 0, 28), // Jan 28
          28,
        );
        expect(result.getMonth()).toBe(1); // February
        expect(result.getDate()).toBe(28);
      });

      it('should use currentDueDate.getDate() as fallback when dayOfMonth is null', () => {
        // When dayOfMonth is null, implementation uses currentDueDate.getDate()
        const result = service.calculateNextDueDate(
          'monthly',
          1,
          new Date(2026, 2, 10), // March 10
          null,
        );
        expect(result.getMonth()).toBe(3); // April
        expect(result.getDate()).toBe(10);
      });
    });

    // -----------------------------------------------------------------------
    // QUARTERLY
    // -----------------------------------------------------------------------
    describe('quarterly frequency', () => {
      it('should add 3 months for quarterly interval=1', () => {
        const result = service.calculateNextDueDate(
          'quarterly',
          1,
          new Date(2026, 0, 15), // Jan 15
        );
        expect(result.getMonth()).toBe(3); // April
        expect(result.getDate()).toBe(15);
      });

      it('should add 6 months for quarterly interval=2', () => {
        const result = service.calculateNextDueDate(
          'quarterly',
          2,
          new Date(2026, 0, 15), // Jan 15
        );
        expect(result.getMonth()).toBe(6); // July
        expect(result.getDate()).toBe(15);
      });

      it('should snap dayOfMonth in quarterly like monthly', () => {
        // Jan 31 + 3 months = April. April has 30 days → snap to 30.
        const result = service.calculateNextDueDate(
          'quarterly',
          1,
          new Date(2026, 0, 31), // Jan 31
          31,
        );
        expect(result.getMonth()).toBe(3); // April
        expect(result.getDate()).toBe(30);
      });

      it('should handle quarterly crossing year boundary', () => {
        const result = service.calculateNextDueDate(
          'quarterly',
          1,
          new Date(2026, 9, 15), // Oct 15
        );
        expect(result.getFullYear()).toBe(2027);
        expect(result.getMonth()).toBe(0); // January
        expect(result.getDate()).toBe(15);
      });
    });

    // -----------------------------------------------------------------------
    // ANNUAL
    // -----------------------------------------------------------------------
    describe('annual frequency', () => {
      it('should add 1 year for annual interval=1', () => {
        const result = service.calculateNextDueDate(
          'annual',
          1,
          new Date(2026, 2, 15), // March 15
        );
        expect(result.getFullYear()).toBe(2027);
        expect(result.getMonth()).toBe(2); // March
        expect(result.getDate()).toBe(15);
      });

      it('should add 2 years for annual interval=2', () => {
        const result = service.calculateNextDueDate(
          'annual',
          2,
          new Date(2026, 2, 15), // March 15
        );
        expect(result.getFullYear()).toBe(2028);
        expect(result.getMonth()).toBe(2); // March
        expect(result.getDate()).toBe(15);
      });

      it('should handle Feb 29 in leap year → Feb 28 in non-leap year', () => {
        // 2028 is leap year, 2029 is NOT
        const result = service.calculateNextDueDate(
          'annual',
          1,
          new Date(2028, 1, 29), // Feb 29, 2028
          29,
        );
        expect(result.getFullYear()).toBe(2029);
        expect(result.getMonth()).toBe(1); // February
        expect(result.getDate()).toBe(28);
      });

      it('should handle Feb 29 → Feb 29 in next leap year with interval=4', () => {
        const result = service.calculateNextDueDate(
          'annual',
          4,
          new Date(2028, 1, 29), // Feb 29, 2028
          29,
        );
        expect(result.getFullYear()).toBe(2032);
        expect(result.getMonth()).toBe(1); // February
        expect(result.getDate()).toBe(29); // 2032 is also a leap year
      });
    });

    // -----------------------------------------------------------------------
    // UNSUPPORTED FREQUENCY
    // -----------------------------------------------------------------------
    describe('unsupported frequency', () => {
      it('should throw BadRequestException for unknown frequency', () => {
        expect(() =>
          service.calculateNextDueDate('biweekly', 1, new Date(2026, 2, 1)),
        ).toThrow(BadRequestException);
      });
    });
  });

  // =========================================================================
  // processRule — Entry generation engine
  // =========================================================================

  describe('processRule', () => {
    it('should return undefined if rule is not found', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(null);

      const result = await service.processRule(RULE_ID, TENANT_ID);

      expect(result).toBeUndefined();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should return undefined if rule status is paused', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ status: 'paused' }),
      );

      const result = await service.processRule(RULE_ID, TENANT_ID);

      expect(result).toBeUndefined();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should return undefined if rule status is cancelled', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ status: 'cancelled' }),
      );

      const result = await service.processRule(RULE_ID, TENANT_ID);

      expect(result).toBeUndefined();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should return undefined if rule is not yet due', async () => {
      // next_due_date is far in the future
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ next_due_date: futureDate }),
      );

      const result = await service.processRule(RULE_ID, TENANT_ID);

      expect(result).toBeUndefined();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should return undefined if duplicate entry exists for the due date', async () => {
      // Set next_due_date to today (so it IS due)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ next_due_date: today }),
      );
      prisma.financial_entry.findFirst.mockResolvedValue({
        id: 'existing-entry-id',
      });

      const result = await service.processRule(RULE_ID, TENANT_ID);

      expect(result).toBeUndefined();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should create entry and update rule in a transaction', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const rule = mockRule({
        next_due_date: today,
        amount: 1850,
        auto_confirm: true,
      });

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(rule);
      prisma.financial_entry.findFirst.mockResolvedValue(null); // No duplicate

      const mockEntry = { id: ENTRY_ID, amount: 1850 };
      const mockTx = {
        financial_entry: {
          create: jest.fn().mockResolvedValue(mockEntry),
        },
        recurring_expense_rule: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      const result = await service.processRule(RULE_ID, TENANT_ID);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.financial_entry.create).toHaveBeenCalledTimes(1);
      expect(mockTx.recurring_expense_rule.update).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockEntry);
    });

    it('should set submission_status to confirmed when auto_confirm is true', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ next_due_date: today, auto_confirm: true }),
      );
      prisma.financial_entry.findFirst.mockResolvedValue(null);

      const mockTx = {
        financial_entry: {
          create: jest.fn().mockResolvedValue({ id: ENTRY_ID }),
        },
        recurring_expense_rule: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      await service.processRule(RULE_ID, TENANT_ID);

      const createCall = mockTx.financial_entry.create.mock.calls[0][0];
      expect(createCall.data.submission_status).toBe('confirmed');
      expect(createCall.data.is_recurring_instance).toBe(true);
      expect(createCall.data.recurring_rule_id).toBe(RULE_ID);
    });

    it('should set submission_status to pending_review when auto_confirm is false', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ next_due_date: today, auto_confirm: false }),
      );
      prisma.financial_entry.findFirst.mockResolvedValue(null);

      const mockTx = {
        financial_entry: {
          create: jest.fn().mockResolvedValue({ id: ENTRY_ID }),
        },
        recurring_expense_rule: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      await service.processRule(RULE_ID, TENANT_ID);

      const createCall = mockTx.financial_entry.create.mock.calls[0][0];
      expect(createCall.data.submission_status).toBe('pending_review');
    });

    it('should set status to completed when recurrence_count is reached', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({
          next_due_date: today,
          occurrences_generated: 11, // 12th occurrence completes it
          recurrence_count: 12,
        }),
      );
      prisma.financial_entry.findFirst.mockResolvedValue(null);

      const mockTx = {
        financial_entry: {
          create: jest.fn().mockResolvedValue({ id: ENTRY_ID }),
        },
        recurring_expense_rule: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      await service.processRule(RULE_ID, TENANT_ID);

      const updateCall = mockTx.recurring_expense_rule.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('completed');
      expect(updateCall.data.occurrences_generated).toBe(12);
    });

    it('should set status to completed when next_due_date exceeds end_date', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // end_date is today, so after generating, next due date will be past end_date
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({
          next_due_date: today,
          end_date: today, // entry generated today; next due > end_date
        }),
      );
      prisma.financial_entry.findFirst.mockResolvedValue(null);

      const mockTx = {
        financial_entry: {
          create: jest.fn().mockResolvedValue({ id: ENTRY_ID }),
        },
        recurring_expense_rule: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      await service.processRule(RULE_ID, TENANT_ID);

      const updateCall = mockTx.recurring_expense_rule.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('completed');
    });

    it('should increment occurrences_generated by 1', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ next_due_date: today, occurrences_generated: 5 }),
      );
      prisma.financial_entry.findFirst.mockResolvedValue(null);

      const mockTx = {
        financial_entry: {
          create: jest.fn().mockResolvedValue({ id: ENTRY_ID }),
        },
        recurring_expense_rule: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      await service.processRule(RULE_ID, TENANT_ID);

      const updateCall = mockTx.recurring_expense_rule.update.mock.calls[0][0];
      expect(updateCall.data.occurrences_generated).toBe(6);
    });

    it('should set last_generated_entry_id to the created entry id', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ next_due_date: today }),
      );
      prisma.financial_entry.findFirst.mockResolvedValue(null);

      const mockTx = {
        financial_entry: {
          create: jest.fn().mockResolvedValue({ id: 'new-entry-xyz' }),
        },
        recurring_expense_rule: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      await service.processRule(RULE_ID, TENANT_ID);

      const updateCall = mockTx.recurring_expense_rule.update.mock.calls[0][0];
      expect(updateCall.data.last_generated_entry_id).toBe('new-entry-xyz');
    });

    it('should set entry_type to expense', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ next_due_date: today }),
      );
      prisma.financial_entry.findFirst.mockResolvedValue(null);

      const mockTx = {
        financial_entry: {
          create: jest.fn().mockResolvedValue({ id: ENTRY_ID }),
        },
        recurring_expense_rule: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      await service.processRule(RULE_ID, TENANT_ID);

      const createCall = mockTx.financial_entry.create.mock.calls[0][0];
      expect(createCall.data.entry_type).toBe('expense');
      expect(createCall.data.tenant_id).toBe(TENANT_ID);
      expect(createCall.data.category_id).toBe(CATEGORY_ID);
      expect(createCall.data.has_receipt).toBe(false);
    });

    // -----------------------------------------------------------------------
    // Manual trigger (manualTrigger=true) vs automatic trigger
    // -----------------------------------------------------------------------

    it('should process rule even when next_due_date is in the future if manualTrigger=true', async () => {
      // Scenario: Rule due April 1, manually triggered on March 28
      const april1 = new Date(2026, 3, 1); // April 1, 2026

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ next_due_date: april1, frequency: 'monthly', interval: 1, day_of_month: 1 }),
      );
      prisma.financial_entry.findFirst.mockResolvedValue(null);

      const mockTx = {
        financial_entry: {
          create: jest.fn().mockResolvedValue({ id: ENTRY_ID }),
        },
        recurring_expense_rule: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      const result = await service.processRule(RULE_ID, TENANT_ID, true);

      // Should NOT skip — manualTrigger bypasses date guard
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ id: ENTRY_ID });
    });

    it('should skip rule when next_due_date is in the future and manualTrigger is NOT set', async () => {
      // Scenario: Same rule (April 1), auto-scheduler runs on March 28
      const april1 = new Date(2026, 3, 1);

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ next_due_date: april1 }),
      );

      const result = await service.processRule(RULE_ID, TENANT_ID);

      // Should skip — not yet due
      expect(result).toBeUndefined();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should skip rule when next_due_date is in the future and manualTrigger=false', async () => {
      const april1 = new Date(2026, 3, 1);

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ next_due_date: april1 }),
      );

      const result = await service.processRule(RULE_ID, TENANT_ID, false);

      expect(result).toBeUndefined();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should use today as entry_date when manualTrigger=true (not the rule next_due_date)', async () => {
      // Scenario: Rule due April 1, triggered March 28 — entry should be dated today
      const april1 = new Date(2026, 3, 1);

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ next_due_date: april1, frequency: 'monthly', interval: 1, day_of_month: 1 }),
      );
      prisma.financial_entry.findFirst.mockResolvedValue(null);

      const mockTx = {
        financial_entry: {
          create: jest.fn().mockResolvedValue({ id: ENTRY_ID }),
        },
        recurring_expense_rule: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      const beforeCall = new Date();
      await service.processRule(RULE_ID, TENANT_ID, true);
      const afterCall = new Date();

      const createCall = mockTx.financial_entry.create.mock.calls[0][0];
      const entryDate = new Date(createCall.data.entry_date);

      // entry_date should be approximately "now", not April 1
      expect(entryDate.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(entryDate.getTime()).toBeLessThanOrEqual(afterCall.getTime());
      expect(entryDate.getMonth()).not.toBe(3); // NOT April (month index 3)
    });

    it('should use next_due_date as entry_date when auto-triggered (not manualTrigger)', async () => {
      // Scenario: Scheduler triggers when rule is due today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayOfMonth = today.getDate();

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ next_due_date: today, frequency: 'monthly', interval: 1, day_of_month: dayOfMonth }),
      );
      prisma.financial_entry.findFirst.mockResolvedValue(null);

      const mockTx = {
        financial_entry: {
          create: jest.fn().mockResolvedValue({ id: ENTRY_ID }),
        },
        recurring_expense_rule: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      await service.processRule(RULE_ID, TENANT_ID); // no manualTrigger flag

      const createCall = mockTx.financial_entry.create.mock.calls[0][0];
      const entryDate = new Date(createCall.data.entry_date);

      // entry_date should be the rule's next_due_date (today), not some other date
      expect(entryDate.getFullYear()).toBe(today.getFullYear());
      expect(entryDate.getMonth()).toBe(today.getMonth());
      expect(entryDate.getDate()).toBe(today.getDate());
    });

    it('should advance next_due_date from rule schedule (not from today) on manual trigger', async () => {
      // Scenario: Monthly rule due April 1, day_of_month=1, triggered March 28
      // Next due should be May 1 (from April 1), NOT April 28 (from today)
      const april1 = new Date(2026, 3, 1);

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({
          next_due_date: april1,
          frequency: 'monthly',
          interval: 1,
          day_of_month: 1,
          occurrences_generated: 3,
        }),
      );
      prisma.financial_entry.findFirst.mockResolvedValue(null);

      const mockTx = {
        financial_entry: {
          create: jest.fn().mockResolvedValue({ id: ENTRY_ID }),
        },
        recurring_expense_rule: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      await service.processRule(RULE_ID, TENANT_ID, true);

      const updateCall = mockTx.recurring_expense_rule.update.mock.calls[0][0];
      const nextDue = new Date(updateCall.data.next_due_date);

      // Next due should be May 1 — calculated from April 1, not from March 28
      expect(nextDue.getFullYear()).toBe(2026);
      expect(nextDue.getMonth()).toBe(4); // May
      expect(nextDue.getDate()).toBe(1);
    });

    it('should advance next_due_date from rule schedule on auto trigger', async () => {
      // Scenario: Monthly rule due today, day_of_month=1, scheduler triggers
      // Next due should be 1st of next month
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Use a past date that is <= today so the date guard passes
      const dueDate = new Date(today);
      dueDate.setDate(1); // 1st of current month

      // If 1st of current month is in the future (today < 1st), use last month
      if (dueDate > today) {
        dueDate.setMonth(dueDate.getMonth() - 1);
      }

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({
          next_due_date: dueDate,
          frequency: 'monthly',
          interval: 1,
          day_of_month: 1,
          occurrences_generated: 3,
        }),
      );
      prisma.financial_entry.findFirst.mockResolvedValue(null);

      const mockTx = {
        financial_entry: {
          create: jest.fn().mockResolvedValue({ id: ENTRY_ID }),
        },
        recurring_expense_rule: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      await service.processRule(RULE_ID, TENANT_ID);

      const updateCall = mockTx.recurring_expense_rule.update.mock.calls[0][0];
      const nextDue = new Date(updateCall.data.next_due_date);

      // Next due should be 1st of the month AFTER dueDate
      const expectedNext = new Date(dueDate);
      expectedNext.setMonth(expectedNext.getMonth() + 1);
      expectedNext.setDate(1);

      expect(nextDue.getFullYear()).toBe(expectedNext.getFullYear());
      expect(nextDue.getMonth()).toBe(expectedNext.getMonth());
      expect(nextDue.getDate()).toBe(1);
    });
  });

  // =========================================================================
  // pause — Lifecycle
  // =========================================================================

  describe('pause', () => {
    it('should throw NotFoundException if rule does not exist', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(null);

      await expect(
        service.pause(TENANT_ID, RULE_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if rule is not active', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ status: 'paused' }),
      );

      await expect(
        service.pause(TENANT_ID, RULE_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.pause(TENANT_ID, RULE_ID, USER_ID),
      ).rejects.toThrow('Only active rules can be paused');
    });

    it('should throw if rule is completed', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ status: 'completed' }),
      );

      await expect(
        service.pause(TENANT_ID, RULE_ID, USER_ID),
      ).rejects.toThrow('Only active rules can be paused');
    });

    it('should update status to paused and audit log when active', async () => {
      const rule = mockRule({ status: 'active' });
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(rule);
      prisma.recurring_expense_rule.update.mockResolvedValue({
        ...rule,
        status: 'paused',
      });

      const result = await service.pause(TENANT_ID, RULE_ID, USER_ID);

      expect(prisma.recurring_expense_rule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: RULE_ID },
          data: expect.objectContaining({
            status: 'paused',
            updated_by_user_id: USER_ID,
          }),
        }),
      );
      expect(result.status).toBe('paused');
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // resume — Lifecycle
  // =========================================================================

  describe('resume', () => {
    it('should throw NotFoundException if rule does not exist', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(null);

      await expect(
        service.resume(TENANT_ID, RULE_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if rule is not paused', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ status: 'active' }),
      );

      await expect(
        service.resume(TENANT_ID, RULE_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resume(TENANT_ID, RULE_ID, USER_ID),
      ).rejects.toThrow('Only paused rules can be resumed');
    });

    it('should advance next_due_date to future when resuming after long pause', async () => {
      // Rule was paused with next_due_date in the past
      const pastDate = new Date(2025, 0, 1); // Jan 1, 2025
      const rule = mockRule({
        status: 'paused',
        next_due_date: pastDate,
        frequency: 'monthly',
        interval: 1,
        day_of_month: 1,
      });

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(rule);
      prisma.recurring_expense_rule.update.mockResolvedValue({
        ...rule,
        status: 'active',
      });

      await service.resume(TENANT_ID, RULE_ID, USER_ID);

      const updateCall = (prisma.recurring_expense_rule.update as jest.Mock)
        .mock.calls[0][0];
      const newNextDate = new Date(updateCall.data.next_due_date);

      // The new next_due_date should be today or in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expect(newNextDate >= today).toBe(true);
    });

    it('should keep next_due_date unchanged if already in the future', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      futureDate.setHours(0, 0, 0, 0);

      const rule = mockRule({
        status: 'paused',
        next_due_date: futureDate,
        frequency: 'monthly',
        interval: 1,
        day_of_month: futureDate.getDate(),
      });

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(rule);
      prisma.recurring_expense_rule.update.mockResolvedValue({
        ...rule,
        status: 'active',
      });

      await service.resume(TENANT_ID, RULE_ID, USER_ID);

      const updateCall = (prisma.recurring_expense_rule.update as jest.Mock)
        .mock.calls[0][0];
      const newNextDate = new Date(updateCall.data.next_due_date);
      expect(newNextDate.getTime()).toBe(futureDate.getTime());
    });

    it('should set status back to active', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const rule = mockRule({
        status: 'paused',
        next_due_date: futureDate,
      });
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(rule);
      prisma.recurring_expense_rule.update.mockResolvedValue({
        ...rule,
        status: 'active',
      });

      await service.resume(TENANT_ID, RULE_ID, USER_ID);

      expect(prisma.recurring_expense_rule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'active' }),
        }),
      );
    });
  });

  // =========================================================================
  // skipNext — Lifecycle
  // =========================================================================

  describe('skipNext', () => {
    it('should throw NotFoundException if rule does not exist', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(null);

      await expect(
        service.skipNext(TENANT_ID, RULE_ID, USER_ID, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if rule is not active', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ status: 'paused' }),
      );

      await expect(
        service.skipNext(TENANT_ID, RULE_ID, USER_ID, {}),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.skipNext(TENANT_ID, RULE_ID, USER_ID, {}),
      ).rejects.toThrow('Only active rules can skip occurrences');
    });

    it('should increment occurrences_generated by 1', async () => {
      const rule = mockRule({
        status: 'active',
        next_due_date: new Date(2026, 3, 1), // April 1
        frequency: 'monthly',
        interval: 1,
        day_of_month: 1,
        occurrences_generated: 5,
      });

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(rule);
      prisma.recurring_expense_rule.update.mockResolvedValue({});

      await service.skipNext(TENANT_ID, RULE_ID, USER_ID, {});

      const updateCall = (prisma.recurring_expense_rule.update as jest.Mock)
        .mock.calls[0][0];
      expect(updateCall.data.occurrences_generated).toBe(6);
    });

    it('should advance next_due_date by one occurrence', async () => {
      const rule = mockRule({
        status: 'active',
        next_due_date: new Date(2026, 3, 1), // April 1
        frequency: 'monthly',
        interval: 1,
        day_of_month: 1,
        occurrences_generated: 0,
      });

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(rule);
      prisma.recurring_expense_rule.update.mockResolvedValue({});

      await service.skipNext(TENANT_ID, RULE_ID, USER_ID, {});

      const updateCall = (prisma.recurring_expense_rule.update as jest.Mock)
        .mock.calls[0][0];
      const newNextDate = new Date(updateCall.data.next_due_date);
      expect(newNextDate.getMonth()).toBe(4); // May
      expect(newNextDate.getDate()).toBe(1);
    });

    it('should set status to completed if skip reaches recurrence_count', async () => {
      const rule = mockRule({
        status: 'active',
        next_due_date: new Date(2026, 3, 1),
        frequency: 'monthly',
        interval: 1,
        day_of_month: 1,
        occurrences_generated: 11, // 12th occurrence reached on skip
        recurrence_count: 12,
      });

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(rule);
      prisma.recurring_expense_rule.update.mockResolvedValue({});

      await service.skipNext(TENANT_ID, RULE_ID, USER_ID, {});

      const updateCall = (prisma.recurring_expense_rule.update as jest.Mock)
        .mock.calls[0][0];
      expect(updateCall.data.status).toBe('completed');
      expect(updateCall.data.occurrences_generated).toBe(12);
    });

    it('should set status to completed if next_due_date exceeds end_date', async () => {
      const rule = mockRule({
        status: 'active',
        next_due_date: new Date(2026, 11, 1), // Dec 1
        frequency: 'monthly',
        interval: 1,
        day_of_month: 1,
        occurrences_generated: 5,
        end_date: new Date(2026, 11, 15), // Dec 15 → next (Jan 1) > Dec 15
      });

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(rule);
      prisma.recurring_expense_rule.update.mockResolvedValue({});

      await service.skipNext(TENANT_ID, RULE_ID, USER_ID, {});

      const updateCall = (prisma.recurring_expense_rule.update as jest.Mock)
        .mock.calls[0][0];
      expect(updateCall.data.status).toBe('completed');
    });

    it('should remain active if neither termination condition is met', async () => {
      const rule = mockRule({
        status: 'active',
        next_due_date: new Date(2026, 3, 1), // April 1
        frequency: 'monthly',
        interval: 1,
        day_of_month: 1,
        occurrences_generated: 2,
        recurrence_count: null,
        end_date: null,
      });

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(rule);
      prisma.recurring_expense_rule.update.mockResolvedValue({});

      await service.skipNext(TENANT_ID, RULE_ID, USER_ID, {});

      const updateCall = (prisma.recurring_expense_rule.update as jest.Mock)
        .mock.calls[0][0];
      expect(updateCall.data.status).toBe('active');
    });

    it('should call audit logger with skip metadata', async () => {
      const rule = mockRule({
        status: 'active',
        next_due_date: new Date(2026, 3, 1),
        frequency: 'monthly',
        interval: 1,
        day_of_month: 1,
        occurrences_generated: 0,
      });

      prisma.recurring_expense_rule.findFirst.mockResolvedValue(rule);
      prisma.recurring_expense_rule.update.mockResolvedValue({});

      await service.skipNext(TENANT_ID, RULE_ID, USER_ID, {
        reason: 'Holiday month',
      });

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'recurring_expense_rule',
          entityId: RULE_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          metadata: expect.objectContaining({
            reason: 'Holiday month',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // getPreview — Read-only forecast
  // =========================================================================

  describe('getPreview', () => {
    it('should return correct occurrence for monthly rule in 30-day window', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const rule = {
        id: RULE_ID,
        name: 'Monthly Insurance',
        frequency: 'monthly',
        interval: 1,
        amount: 1850,
        tax_amount: null,
        day_of_month: today.getDate(),
        day_of_week: null,
        next_due_date: today, // Due today
        occurrences_generated: 0,
        recurrence_count: null,
        end_date: null,
        category: { id: CATEGORY_ID, name: 'Insurance' },
        supplier: null,
        payment_method: null,
      };

      prisma.recurring_expense_rule.findMany.mockResolvedValue([rule]);

      const result = await service.getPreview(TENANT_ID, 30);

      // Monthly rule in 30-day window: due today → 1 occurrence
      expect(result.occurrences.length).toBe(1);
      expect(result.total_obligations).toBe(1850);
      expect(result.period_days).toBe(30);
    });

    it('should return multiple occurrences for monthly rule in 90-day window', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const rule = {
        id: RULE_ID,
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
        category: { id: CATEGORY_ID, name: 'Insurance' },
        supplier: null,
        payment_method: null,
      };

      prisma.recurring_expense_rule.findMany.mockResolvedValue([rule]);

      const result = await service.getPreview(TENANT_ID, 90);

      // Monthly in 90 days: ~3 occurrences (today, +30d, +60d)
      expect(result.occurrences.length).toBeGreaterThanOrEqual(2);
      expect(result.occurrences.length).toBeLessThanOrEqual(4);
    });

    it('should never create any entries (read-only)', async () => {
      prisma.recurring_expense_rule.findMany.mockResolvedValue([]);

      await service.getPreview(TENANT_ID, 30);

      expect(prisma.financial_entry.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should respect recurrence_count boundary', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const rule = {
        id: RULE_ID,
        name: 'Limited Rule',
        frequency: 'daily',
        interval: 1,
        amount: 100,
        tax_amount: null,
        day_of_month: null,
        day_of_week: null,
        next_due_date: today,
        occurrences_generated: 9, // 10 total allowed, 1 remaining
        recurrence_count: 10,
        end_date: null,
        category: { id: CATEGORY_ID, name: 'Test' },
        supplier: null,
        payment_method: null,
      };

      prisma.recurring_expense_rule.findMany.mockResolvedValue([rule]);

      const result = await service.getPreview(TENANT_ID, 90);

      // Only 1 occurrence because 9 already generated + max is 10
      expect(result.occurrences.length).toBe(1);
      expect(result.total_obligations).toBe(100);
    });

    it('should respect end_date boundary', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 5); // 5 days from now

      const rule = {
        id: RULE_ID,
        name: 'Short-lived Rule',
        frequency: 'daily',
        interval: 1,
        amount: 50,
        tax_amount: null,
        day_of_month: null,
        day_of_week: null,
        next_due_date: today,
        occurrences_generated: 0,
        recurrence_count: null,
        end_date: endDate,
        category: { id: CATEGORY_ID, name: 'Test' },
        supplier: null,
        payment_method: null,
      };

      prisma.recurring_expense_rule.findMany.mockResolvedValue([rule]);

      const result = await service.getPreview(TENANT_ID, 90);

      // Daily for 5 days → 6 occurrences (today + 5 more days until end_date)
      expect(result.occurrences.length).toBeLessThanOrEqual(6);
      expect(result.occurrences.length).toBeGreaterThanOrEqual(5);
    });

    it('should sort occurrences by due_date', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const rules = [
        {
          id: 'rule-b',
          name: 'Rule B',
          frequency: 'monthly',
          interval: 1,
          amount: 200,
          tax_amount: null,
          day_of_month: tomorrow.getDate(),
          day_of_week: null,
          next_due_date: tomorrow, // starts tomorrow
          occurrences_generated: 0,
          recurrence_count: 1, // Only 1 occurrence allowed
          end_date: null,
          category: { id: 'cat-b', name: 'Cat B' },
          supplier: null,
          payment_method: null,
        },
        {
          id: 'rule-a',
          name: 'Rule A',
          frequency: 'monthly',
          interval: 1,
          amount: 100,
          tax_amount: null,
          day_of_month: today.getDate(),
          day_of_week: null,
          next_due_date: today, // starts today
          occurrences_generated: 0,
          recurrence_count: 1, // Only 1 occurrence allowed
          end_date: null,
          category: { id: 'cat-a', name: 'Cat A' },
          supplier: null,
          payment_method: null,
        },
      ];

      prisma.recurring_expense_rule.findMany.mockResolvedValue(rules);

      const result = await service.getPreview(TENANT_ID, 30);

      // Rule A (today) should come before Rule B (tomorrow)
      expect(result.occurrences.length).toBe(2);
      expect(result.occurrences[0].rule_name).toBe('Rule A');
      expect(result.occurrences[1].rule_name).toBe('Rule B');
    });
  });

  // =========================================================================
  // triggerNow — Manual trigger
  // =========================================================================

  describe('triggerNow', () => {
    it('should throw NotFoundException if rule does not exist', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(null);

      await expect(
        service.triggerNow(TENANT_ID, RULE_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if rule is cancelled', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ status: 'cancelled' }),
      );

      await expect(
        service.triggerNow(TENANT_ID, RULE_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if rule is completed', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ status: 'completed' }),
      );

      await expect(
        service.triggerNow(TENANT_ID, RULE_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('should enqueue a high-priority job for active rule', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ status: 'active' }),
      );

      const result = await service.triggerNow(TENANT_ID, RULE_ID, USER_ID);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'recurring-expense-generate',
        { ruleId: RULE_ID, tenantId: TENANT_ID, manualTrigger: true },
        expect.objectContaining({ priority: 1 }),
      );
      expect(result).toEqual({
        message: 'Entry generation triggered',
        rule_id: RULE_ID,
      });
    });

    it('should allow triggering a paused rule', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ status: 'paused' }),
      );

      const result = await service.triggerNow(TENANT_ID, RULE_ID, USER_ID);

      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(result.rule_id).toBe(RULE_ID);
    });
  });

  // =========================================================================
  // create — CRUD
  // =========================================================================

  describe('create', () => {
    const validDto = {
      name: 'Monthly Insurance',
      category_id: CATEGORY_ID,
      amount: 1850,
      frequency: 'monthly' as any,
      start_date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // tomorrow
    };

    it('should throw if max active rules (100) exceeded', async () => {
      prisma.recurring_expense_rule.count.mockResolvedValue(100);

      await expect(
        service.create(TENANT_ID, USER_ID, validDto),
      ).rejects.toThrow('Maximum of 100 active recurring rules per tenant');
    });

    it('should throw if category not found or inactive', async () => {
      prisma.recurring_expense_rule.count.mockResolvedValue(0);
      prisma.financial_category.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, USER_ID, validDto),
      ).rejects.toThrow('Category not found or inactive');
    });

    it('should throw if supplier_id is invalid', async () => {
      prisma.recurring_expense_rule.count.mockResolvedValue(0);
      prisma.financial_category.findFirst.mockResolvedValue({ id: CATEGORY_ID });
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, USER_ID, {
          ...validDto,
          supplier_id: 'bad-supplier',
        }),
      ).rejects.toThrow('Supplier not found in tenant');
    });

    it('should throw if payment_method_registry_id is invalid', async () => {
      prisma.recurring_expense_rule.count.mockResolvedValue(0);
      prisma.financial_category.findFirst.mockResolvedValue({ id: CATEGORY_ID });
      prisma.payment_method_registry.findFirst.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, USER_ID, {
          ...validDto,
          payment_method_registry_id: 'bad-pm',
        }),
      ).rejects.toThrow('Payment method not found in tenant');
    });

    it('should throw if start_date is in the past', async () => {
      prisma.recurring_expense_rule.count.mockResolvedValue(0);
      prisma.financial_category.findFirst.mockResolvedValue({ id: CATEGORY_ID });

      await expect(
        service.create(TENANT_ID, USER_ID, {
          ...validDto,
          start_date: '2020-01-01',
        }),
      ).rejects.toThrow('start_date must be today or in the future');
    });

    it('should throw if end_date is before start_date', async () => {
      prisma.recurring_expense_rule.count.mockResolvedValue(0);
      prisma.financial_category.findFirst.mockResolvedValue({ id: CATEGORY_ID });

      const tomorrow = new Date(Date.now() + 86400000)
        .toISOString()
        .split('T')[0];
      const dayAfter = new Date(Date.now() + 2 * 86400000)
        .toISOString()
        .split('T')[0];

      await expect(
        service.create(TENANT_ID, USER_ID, {
          ...validDto,
          start_date: dayAfter,
          end_date: tomorrow,
        }),
      ).rejects.toThrow('end_date must be after start_date');
    });

    it('should throw if tax_amount >= amount', async () => {
      prisma.recurring_expense_rule.count.mockResolvedValue(0);
      prisma.financial_category.findFirst.mockResolvedValue({ id: CATEGORY_ID });

      await expect(
        service.create(TENANT_ID, USER_ID, {
          ...validDto,
          tax_amount: 2000,
        }),
      ).rejects.toThrow('tax_amount must be less than amount');
    });

    it('should create rule successfully and return it', async () => {
      prisma.recurring_expense_rule.count.mockResolvedValue(0);
      prisma.financial_category.findFirst.mockResolvedValue({ id: CATEGORY_ID });

      const createdRule = mockRule({ name: validDto.name });
      prisma.recurring_expense_rule.create.mockResolvedValue(createdRule);

      const result = await service.create(TENANT_ID, USER_ID, validDto);

      expect(prisma.recurring_expense_rule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            name: validDto.name,
            amount: validDto.amount,
            frequency: validDto.frequency,
            status: 'active',
            created_by_user_id: USER_ID,
          }),
        }),
      );
      expect(result).toEqual(createdRule);
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledTimes(1);
    });

    it('should auto-populate day_of_month for monthly frequency', async () => {
      prisma.recurring_expense_rule.count.mockResolvedValue(0);
      prisma.financial_category.findFirst.mockResolvedValue({ id: CATEGORY_ID });
      prisma.recurring_expense_rule.create.mockResolvedValue(mockRule());

      const futureDate = new Date(Date.now() + 86400000);
      const expectedDay = futureDate.getDate();

      await service.create(TENANT_ID, USER_ID, {
        ...validDto,
        start_date: futureDate.toISOString().split('T')[0],
      });

      const createCall = prisma.recurring_expense_rule.create.mock.calls[0][0];
      expect(createCall.data.day_of_month).toBe(expectedDay);
    });

    it('should auto-populate day_of_week for weekly frequency', async () => {
      prisma.recurring_expense_rule.count.mockResolvedValue(0);
      prisma.financial_category.findFirst.mockResolvedValue({ id: CATEGORY_ID });
      prisma.recurring_expense_rule.create.mockResolvedValue(mockRule());

      const futureDate = new Date(Date.now() + 86400000);
      const expectedDayOfWeek = futureDate.getDay();

      await service.create(TENANT_ID, USER_ID, {
        ...validDto,
        frequency: 'weekly' as any,
        start_date: futureDate.toISOString().split('T')[0],
      });

      const createCall = prisma.recurring_expense_rule.create.mock.calls[0][0];
      expect(createCall.data.day_of_week).toBe(expectedDayOfWeek);
    });
  });

  // =========================================================================
  // findAll — CRUD
  // =========================================================================

  describe('findAll', () => {
    it('should return paginated results with default filters', async () => {
      const rules = [mockRule()];
      prisma.recurring_expense_rule.findMany
        .mockResolvedValueOnce(rules) // paginated query
        .mockResolvedValueOnce(rules); // monthly obligation query
      prisma.recurring_expense_rule.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT_ID, {});

      expect(result.data).toEqual(rules);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.summary).toBeDefined();
      expect(result.summary.total_active_rules).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.recurring_expense_rule.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      prisma.recurring_expense_rule.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, { status: 'paused' as any });

      const findManyCall =
        prisma.recurring_expense_rule.findMany.mock.calls[0][0];
      expect(findManyCall.where.status).toBe('paused');
    });

    it('should filter by category_id and frequency', async () => {
      prisma.recurring_expense_rule.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      prisma.recurring_expense_rule.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, {
        category_id: CATEGORY_ID,
        frequency: 'monthly' as any,
      });

      const findManyCall =
        prisma.recurring_expense_rule.findMany.mock.calls[0][0];
      expect(findManyCall.where.category_id).toBe(CATEGORY_ID);
      expect(findManyCall.where.frequency).toBe('monthly');
    });

    it('should calculate monthly obligation correctly for different frequencies', async () => {
      const activeRules = [
        { amount: 300, frequency: 'monthly', interval: 1 },
        { amount: 70, frequency: 'weekly', interval: 1 },
        { amount: 10, frequency: 'daily', interval: 1 },
      ];

      prisma.recurring_expense_rule.findMany
        .mockResolvedValueOnce([]) // paginated
        .mockResolvedValueOnce(activeRules); // obligation calc
      prisma.recurring_expense_rule.count.mockResolvedValue(0);

      const result = await service.findAll(TENANT_ID, {});

      // monthly: 300/1 = 300
      // weekly: 70 * (30/7) ≈ 300
      // daily: 10 * 30 / 1 = 300
      expect(result.summary.monthly_obligation).toBeGreaterThan(800);
    });

    it('should always include tenant_id in query', async () => {
      prisma.recurring_expense_rule.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      prisma.recurring_expense_rule.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, {});

      const findManyCall =
        prisma.recurring_expense_rule.findMany.mock.calls[0][0];
      expect(findManyCall.where.tenant_id).toBe(TENANT_ID);
    });
  });

  // =========================================================================
  // findOne — CRUD
  // =========================================================================

  describe('findOne', () => {
    it('should throw NotFoundException if rule not found', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(null);

      await expect(service.findOne(TENANT_ID, RULE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return enriched rule with next occurrence preview', async () => {
      const rule = mockRule({
        frequency: 'monthly',
        interval: 1,
        day_of_month: 15,
        next_due_date: new Date(2026, 2, 15),
        last_generated_entry_id: null,
        occurrences_generated: 0,
        recurrence_count: null,
        end_date: null,
      });
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(rule);

      const result = await service.findOne(TENANT_ID, RULE_ID);

      expect(result.next_occurrence_preview).toBeDefined();
      expect(result.next_occurrence_preview.length).toBe(3); // next 3 dates
      expect(result.last_generated_entry).toBeNull();
    });

    it('should fetch last_generated_entry when id is set', async () => {
      const rule = mockRule({
        last_generated_entry_id: ENTRY_ID,
        next_due_date: new Date(2026, 5, 15),
        frequency: 'monthly',
        interval: 1,
        day_of_month: 15,
      });
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(rule);
      prisma.financial_entry.findFirst.mockResolvedValue({
        id: ENTRY_ID,
        amount: 1850,
        entry_date: new Date(2026, 2, 15),
        submission_status: 'confirmed',
      });

      const result = await service.findOne(TENANT_ID, RULE_ID);

      expect(result.last_generated_entry).not.toBeNull();
      expect(result.last_generated_entry!.id).toBe(ENTRY_ID);
    });

    it('should respect recurrence_count in preview', async () => {
      const rule = mockRule({
        frequency: 'monthly',
        interval: 1,
        day_of_month: 15,
        next_due_date: new Date(2026, 2, 15),
        occurrences_generated: 11, // Only 1 more allowed
        recurrence_count: 12,
        last_generated_entry_id: null,
      });
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(rule);

      const result = await service.findOne(TENANT_ID, RULE_ID);

      // Only 1 occurrence (the next_due_date itself) since 11+1=12 hits limit
      expect(result.next_occurrence_preview.length).toBe(1);
    });

    it('should include tenant_id in the query', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(null);

      try {
        await service.findOne(TENANT_ID, RULE_ID);
      } catch {
        // Expected NotFoundException
      }

      expect(prisma.recurring_expense_rule.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            id: RULE_ID,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // update — CRUD
  // =========================================================================

  describe('update', () => {
    it('should throw NotFoundException if rule not found', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, RULE_ID, USER_ID, { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if rule is cancelled', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ status: 'cancelled' }),
      );

      await expect(
        service.update(TENANT_ID, RULE_ID, USER_ID, { name: 'New Name' }),
      ).rejects.toThrow('Cannot update a cancelled rule');
    });

    it('should throw if rule is completed', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ status: 'completed' }),
      );

      await expect(
        service.update(TENANT_ID, RULE_ID, USER_ID, { name: 'New Name' }),
      ).rejects.toThrow('Cannot update a completed rule');
    });

    it('should throw if updated category_id is invalid', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ status: 'active' }),
      );
      prisma.financial_category.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, RULE_ID, USER_ID, {
          category_id: 'bad-cat',
        }),
      ).rejects.toThrow('Category not found or inactive');
    });

    it('should throw if updated supplier_id is invalid', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ status: 'active' }),
      );
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, RULE_ID, USER_ID, {
          supplier_id: 'bad-sup',
        }),
      ).rejects.toThrow('Supplier not found in tenant');
    });

    it('should throw if updated payment_method_registry_id is invalid', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ status: 'active' }),
      );
      prisma.payment_method_registry.findFirst.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, RULE_ID, USER_ID, {
          payment_method_registry_id: 'bad-pm',
        }),
      ).rejects.toThrow('Payment method not found in tenant');
    });

    it('should throw if end_date is before start_date', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ start_date: new Date(2026, 2, 1) }),
      );

      await expect(
        service.update(TENANT_ID, RULE_ID, USER_ID, {
          end_date: '2026-01-01',
        }),
      ).rejects.toThrow('end_date must be after start_date');
    });

    it('should throw if updated tax_amount >= amount', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ amount: 100 }),
      );

      await expect(
        service.update(TENANT_ID, RULE_ID, USER_ID, { tax_amount: 200 }),
      ).rejects.toThrow('tax_amount must be less than amount');
    });

    it('should update name-only without recalculating next_due_date', async () => {
      const existing = mockRule({ status: 'active' });
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(existing);
      prisma.recurring_expense_rule.update.mockResolvedValue({
        ...existing,
        name: 'New Name',
      });

      await service.update(TENANT_ID, RULE_ID, USER_ID, {
        name: 'New Name',
      });

      const updateCall = prisma.recurring_expense_rule.update.mock.calls[0][0];
      expect(updateCall.data.name).toBe('New Name');
      // next_due_date should NOT be in the update data since no schedule fields changed
      expect(updateCall.data.next_due_date).toBeUndefined();
    });

    it('should recalculate next_due_date when frequency changes', async () => {
      const existing = mockRule({
        status: 'active',
        next_due_date: new Date(2026, 2, 1),
        frequency: 'monthly',
        interval: 1,
      });
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(existing);
      prisma.recurring_expense_rule.update.mockResolvedValue({
        ...existing,
        frequency: 'weekly',
      });

      await service.update(TENANT_ID, RULE_ID, USER_ID, {
        frequency: 'weekly' as any,
      });

      const updateCall = prisma.recurring_expense_rule.update.mock.calls[0][0];
      expect(updateCall.data.next_due_date).toBeDefined();
    });

    it('should audit log the update', async () => {
      const existing = mockRule({ status: 'active' });
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(existing);
      prisma.recurring_expense_rule.update.mockResolvedValue({
        ...existing,
        name: 'Updated',
      });

      await service.update(TENANT_ID, RULE_ID, USER_ID, {
        name: 'Updated',
      });

      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'recurring_expense_rule',
          entityId: RULE_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
        }),
      );
    });
  });

  // =========================================================================
  // getHistory — History of generated entries
  // =========================================================================

  describe('getHistory', () => {
    it('should throw NotFoundException if rule not found', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(null);

      await expect(
        service.getHistory(TENANT_ID, RULE_ID, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return paginated entries for the rule', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(mockRule());

      const entries = [
        { id: 'entry-1', amount: 1850, entry_date: new Date(2026, 2, 1) },
        { id: 'entry-2', amount: 1850, entry_date: new Date(2026, 1, 1) },
      ];
      prisma.financial_entry.findMany.mockResolvedValue(entries);
      prisma.financial_entry.count.mockResolvedValue(2);

      const result = await service.getHistory(TENANT_ID, RULE_ID, {});

      expect(result.data).toEqual(entries);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
    });

    it('should filter by date_from and date_to', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(mockRule());
      prisma.financial_entry.findMany.mockResolvedValue([]);
      prisma.financial_entry.count.mockResolvedValue(0);

      await service.getHistory(TENANT_ID, RULE_ID, {
        date_from: '2026-01-01',
        date_to: '2026-03-31',
      });

      const findManyCall = prisma.financial_entry.findMany.mock.calls[0][0];
      expect(findManyCall.where.entry_date).toBeDefined();
      expect(findManyCall.where.entry_date.gte).toEqual(
        new Date('2026-01-01'),
      );
      expect(findManyCall.where.entry_date.lte).toEqual(
        new Date('2026-03-31'),
      );
    });

    it('should include tenant_id and recurring_rule_id in the query', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(mockRule());
      prisma.financial_entry.findMany.mockResolvedValue([]);
      prisma.financial_entry.count.mockResolvedValue(0);

      await service.getHistory(TENANT_ID, RULE_ID, {});

      const findManyCall = prisma.financial_entry.findMany.mock.calls[0][0];
      expect(findManyCall.where.tenant_id).toBe(TENANT_ID);
      expect(findManyCall.where.recurring_rule_id).toBe(RULE_ID);
    });
  });

  // =========================================================================
  // cancel — Lifecycle
  // =========================================================================

  describe('cancel', () => {
    it('should throw NotFoundException if rule does not exist', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(null);

      await expect(
        service.cancel(TENANT_ID, RULE_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if rule is already cancelled', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ status: 'cancelled' }),
      );

      await expect(
        service.cancel(TENANT_ID, RULE_ID, USER_ID),
      ).rejects.toThrow('Rule is already cancelled');
    });

    it('should throw BadRequestException if rule is completed', async () => {
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(
        mockRule({ status: 'completed' }),
      );

      await expect(
        service.cancel(TENANT_ID, RULE_ID, USER_ID),
      ).rejects.toThrow('Cannot cancel a completed rule');
    });

    it('should update status to cancelled for active rule', async () => {
      const rule = mockRule({ status: 'active' });
      prisma.recurring_expense_rule.findFirst.mockResolvedValue(rule);
      prisma.recurring_expense_rule.update.mockResolvedValue({
        ...rule,
        status: 'cancelled',
      });

      const result = await service.cancel(TENANT_ID, RULE_ID, USER_ID);

      expect(prisma.recurring_expense_rule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: RULE_ID },
          data: expect.objectContaining({
            status: 'cancelled',
            updated_by_user_id: USER_ID,
          }),
        }),
      );
      expect(result.status).toBe('cancelled');
      expect(mockAuditLoggerService.logTenantChange).toHaveBeenCalledTimes(1);
    });
  });
});
