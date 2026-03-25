import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { RecurringExpenseService } from './recurring-expense.service';

// ============================================================================
// Constants
// ============================================================================
const TENANT_ID = 'tenant-test-001';
const INVOICE_ID_1 = 'inv-001';
const PROJECT_ID_1 = 'proj-001';
const RULE_ID_1 = 'rule-001';
const SUB_INVOICE_ID_1 = 'sub-inv-001';
const SUB_ID_1 = 'sub-001';

// ============================================================================
// Date helpers
// ============================================================================
const todayMidnight = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const daysAgo = (n: number) => {
  const d = todayMidnight();
  d.setDate(d.getDate() - n);
  return d;
};

const daysFromNow = (n: number) => {
  const d = todayMidnight();
  d.setDate(d.getDate() + n);
  return d;
};

// ============================================================================
// Mock factories
// ============================================================================
const mockInvoiceRecord = (overrides: any = {}) => ({
  id: INVOICE_ID_1,
  tenant_id: TENANT_ID,
  project_id: PROJECT_ID_1,
  invoice_number: 'INV-001',
  amount: 5000,
  amount_paid: 0,
  amount_due: 5000,
  status: 'sent',
  due_date: daysFromNow(15),
  sent_at: daysAgo(5),
  created_at: daysAgo(10),
  project: { name: 'Test Project' },
  ...overrides,
});

const mockRecurringRule = (overrides: any = {}) => ({
  id: RULE_ID_1,
  tenant_id: TENANT_ID,
  name: 'Monthly Rent',
  amount: 2000,
  status: 'active',
  next_due_date: daysFromNow(2),
  created_at: daysAgo(30),
  ...overrides,
});

const mockSubInvoice = (overrides: any = {}) => ({
  id: SUB_INVOICE_ID_1,
  tenant_id: TENANT_ID,
  subcontractor_id: SUB_ID_1,
  amount: 1500,
  status: 'pending',
  created_at: daysAgo(10),
  subcontractor: { id: SUB_ID_1, business_name: 'ABC Plumbing' },
  ...overrides,
});

const mockProject = (overrides: any = {}) => ({
  id: PROJECT_ID_1,
  tenant_id: TENANT_ID,
  name: 'Kitchen Renovation',
  project_number: 'P-001',
  progress_percent: 75,
  status: 'in_progress',
  ...overrides,
});

// ============================================================================
// Mock services
// ============================================================================
const mockPrismaService = {
  project_invoice: {
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
  subcontractor_task_invoice: {
    findMany: jest.fn(),
  },
  recurring_expense_rule: {
    findMany: jest.fn(),
  },
  financial_entry: {
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
    findMany: jest.fn(),
  },
  project: {
    findMany: jest.fn(),
  },
  project_invoice_payment: {
    aggregate: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  financial_category: {
    findMany: jest.fn(),
  },
  crew_hour_log: {
    aggregate: jest.fn(),
    findMany: jest.fn(),
  },
};

const mockRecurringExpenseService = {
  getPreview: jest.fn(),
};

// ============================================================================
// Tests
// ============================================================================
describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: RecurringExpenseService,
          useValue: mockRecurringExpenseService,
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    prisma = module.get(PrismaService);
    jest.clearAllMocks();
  });

  // =========================================================================
  // Helper — set up zero/empty mocks for calculateMonthPL queries
  // =========================================================================
  function setupZeroPLMocks() {
    prisma.project_invoice_payment.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });
    prisma.project_invoice_payment.findMany.mockResolvedValue([]);
    prisma.project_invoice_payment.groupBy.mockResolvedValue([]);
    prisma.financial_entry.aggregate.mockResolvedValue({
      _sum: { amount: null, tax_amount: null },
    });
    prisma.financial_entry.groupBy.mockResolvedValue([]);
  }

  // =========================================================================
  // getPL()
  // =========================================================================
  describe('getPL', () => {
    it('should compute income from payment_date (cash basis), not invoice date', async () => {
      prisma.project_invoice_payment.aggregate.mockResolvedValue({
        _sum: { amount: 5000 },
      });
      prisma.project_invoice_payment.findMany.mockResolvedValue([
        { invoice_id: 'inv-1' },
      ]);
      prisma.project_invoice_payment.groupBy.mockResolvedValue([]);
      prisma.financial_entry.aggregate.mockResolvedValue({
        _sum: { amount: null, tax_amount: null },
      });
      prisma.financial_entry.groupBy.mockResolvedValue([]);
      prisma.project_invoice.aggregate.mockResolvedValue({
        _sum: { tax_amount: null },
      });

      const result = await service.getPL(TENANT_ID, 2026, 3);

      expect(result.months[0].income.total).toBe(5000);
      expect(result.months[0].income.invoice_count).toBe(1);
    });

    it('should return all 12 months for full year even with zero activity', async () => {
      setupZeroPLMocks();

      const result = await service.getPL(TENANT_ID, 2026);

      expect(result.months).toHaveLength(12);
      expect(result.months[0].month).toBe(1);
      expect(result.months[11].month).toBe(12);
      expect(result.months[0].income.total).toBe(0);
      expect(result.months[0].expenses.total).toBe(0);
      expect(result.period).toBe('monthly');
      expect(result.year).toBe(2026);
      expect(result.currency).toBe('USD');
    });

    it('should calculate gross_profit = income - COGS', async () => {
      prisma.project_invoice_payment.aggregate.mockResolvedValue({
        _sum: { amount: 10000 },
      });
      prisma.project_invoice_payment.findMany.mockResolvedValue([
        { invoice_id: 'inv-1' },
      ]);
      prisma.project_invoice_payment.groupBy.mockResolvedValue([]);
      prisma.project_invoice.aggregate.mockResolvedValue({
        _sum: { tax_amount: null },
      });
      prisma.financial_entry.groupBy.mockResolvedValue([]);

      // financial_entry.aggregate is called 4 times when includePending is falsy:
      // Call 1: total expenses (confirmed) → 5000
      // (Query 5 skipped — includePending not set)
      // Call 2: tax paid → 0
      // Call 3: COGS → 3000
      // Call 4: OpEx → 2000
      prisma.financial_entry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 5000 } })
        .mockResolvedValueOnce({ _sum: { tax_amount: 0 } })
        .mockResolvedValueOnce({ _sum: { amount: 3000 } })
        .mockResolvedValueOnce({ _sum: { amount: 2000 } });

      const result = await service.getPL(TENANT_ID, 2026, 3);

      expect(result.months[0].gross_profit).toBe(7000);
      expect(result.months[0].operating_profit).toBe(5000);
      expect(result.months[0].net_profit).toBe(5000);
    });

    it('should return null for gross_margin_percent when income is zero', async () => {
      setupZeroPLMocks();

      const result = await service.getPL(TENANT_ID, 2026, 3);

      expect(result.months[0].gross_margin_percent).toBeNull();
    });

    it('should populate total_with_pending when include_pending is true', async () => {
      prisma.project_invoice_payment.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });
      prisma.project_invoice_payment.findMany.mockResolvedValue([]);
      prisma.project_invoice_payment.groupBy.mockResolvedValue([]);
      prisma.financial_entry.groupBy.mockResolvedValue([]);

      // Call 1: confirmed → 5000
      // Call 2: confirmed + pending → 7000
      // Call 3: tax → 0
      // Call 4: COGS → 0
      // Call 5: OpEx → 0
      prisma.financial_entry.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 5000 } })
        .mockResolvedValueOnce({ _sum: { amount: 7000 } })
        .mockResolvedValueOnce({ _sum: { tax_amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } })
        .mockResolvedValueOnce({ _sum: { amount: null } });

      const result = await service.getPL(TENANT_ID, 2026, 3, true);

      expect(result.months[0].expenses.total).toBe(5000);
      expect(result.months[0].expenses.total_with_pending).toBe(7000);
    });

    it('should compute totals correctly across all months', async () => {
      const makeMonthResult = (
        month: number,
        income: number,
        cogs: number,
        opex: number,
      ) => ({
        year: 2026,
        month,
        month_label: `M${month} 2026`,
        income: {
          total: income,
          invoice_count: income > 0 ? 1 : 0,
          by_project: [],
        },
        expenses: {
          total: cogs + opex,
          total_with_pending: cogs + opex,
          total_tax_paid: 0,
          by_classification: {
            cost_of_goods_sold: cogs,
            operating_expense: opex,
          },
          by_category: [],
          top_suppliers: [],
        },
        gross_profit: income - cogs,
        operating_profit: income - cogs - opex,
        net_profit: income - cogs - opex,
        gross_margin_percent:
          income > 0
            ? Number((((income - cogs) / income) * 100).toFixed(2))
            : null,
        tax: { tax_collected: 0, tax_paid: 0, net_tax_position: 0 },
      });

      const spy = jest.spyOn(service as any, 'calculateMonthPL');
      // Month 1: income=10000, COGS=2000, OpEx=1000 → net=7000
      spy.mockResolvedValueOnce(makeMonthResult(1, 10000, 2000, 1000));
      for (let m = 2; m <= 5; m++) {
        spy.mockResolvedValueOnce(makeMonthResult(m, 0, 0, 0));
      }
      // Month 6: income=5000, COGS=5000, OpEx=3000 → net=-3000 (worst)
      spy.mockResolvedValueOnce(makeMonthResult(6, 5000, 5000, 3000));
      for (let m = 7; m <= 11; m++) {
        spy.mockResolvedValueOnce(makeMonthResult(m, 0, 0, 0));
      }
      // Month 12: income=20000, COGS=3000, OpEx=2000 → net=15000 (best)
      spy.mockResolvedValueOnce(makeMonthResult(12, 20000, 3000, 2000));

      const result = await service.getPL(TENANT_ID, 2026);

      expect(result.months).toHaveLength(12);
      expect(result.totals.total_income).toBe(35000);
      expect(result.totals.total_expenses).toBe(16000);
      expect(result.totals.best_month.month_label).toBe('M12 2026');
      expect(result.totals.best_month.net_profit).toBe(15000);
      expect(result.totals.worst_month.month_label).toBe('M6 2026');
      expect(result.totals.worst_month.net_profit).toBe(-3000);
    });

    it('should include tenant_id in all Prisma queries', async () => {
      setupZeroPLMocks();

      await service.getPL(TENANT_ID, 2026, 1);

      for (const call of prisma.project_invoice_payment.aggregate.mock.calls) {
        expect(call[0].where.tenant_id).toBe(TENANT_ID);
      }
      for (const call of prisma.project_invoice_payment.findMany.mock.calls) {
        expect(call[0].where.tenant_id).toBe(TENANT_ID);
      }
      for (const call of prisma.project_invoice_payment.groupBy.mock.calls) {
        expect(call[0].where.tenant_id).toBe(TENANT_ID);
      }
      for (const call of prisma.financial_entry.aggregate.mock.calls) {
        expect(call[0].where.tenant_id).toBe(TENANT_ID);
      }
      for (const call of prisma.financial_entry.groupBy.mock.calls) {
        expect(call[0].where.tenant_id).toBe(TENANT_ID);
      }
    });
  });

  // =========================================================================
  // getAR()
  // =========================================================================
  describe('getAR', () => {
    it('should assign invoices to correct aging buckets', async () => {
      const today = todayMidnight();

      const invoices = [
        mockInvoiceRecord({
          id: '1',
          invoice_number: 'INV-A1',
          amount: 1000,
          amount_paid: 0,
          amount_due: 1000,
          due_date: daysFromNow(1),
          project: { id: 'p1', name: 'P1', project_number: 'PRJ-001' },
        }),
        mockInvoiceRecord({
          id: '2',
          invoice_number: 'INV-A2',
          amount: 2000,
          amount_paid: 0,
          amount_due: 2000,
          due_date: daysAgo(15),
          sent_at: daysAgo(30),
          project: { id: 'p2', name: 'P2', project_number: 'PRJ-002' },
        }),
        mockInvoiceRecord({
          id: '3',
          invoice_number: 'INV-A3',
          amount: 3000,
          amount_paid: 0,
          amount_due: 3000,
          due_date: daysAgo(45),
          sent_at: daysAgo(60),
          project: { id: 'p3', name: 'P3', project_number: 'PRJ-003' },
        }),
        mockInvoiceRecord({
          id: '4',
          invoice_number: 'INV-A4',
          amount: 4000,
          amount_paid: 0,
          amount_due: 4000,
          due_date: daysAgo(75),
          sent_at: daysAgo(90),
          project: { id: 'p4', name: 'P4', project_number: 'PRJ-004' },
        }),
        mockInvoiceRecord({
          id: '5',
          invoice_number: 'INV-A5',
          amount: 5000,
          amount_paid: 0,
          amount_due: 5000,
          due_date: daysAgo(120),
          sent_at: daysAgo(150),
          project: { id: 'p5', name: 'P5', project_number: 'PRJ-005' },
        }),
      ];

      prisma.project_invoice.findMany.mockResolvedValue(invoices);

      const result = await service.getAR(TENANT_ID, {});

      expect(result.aging_buckets.current).toBe(1000);
      expect(result.aging_buckets.days_1_30).toBe(2000);
      expect(result.aging_buckets.days_31_60).toBe(3000);
      expect(result.aging_buckets.days_61_90).toBe(4000);
      expect(result.aging_buckets.days_over_90).toBe(5000);
    });

    it('should classify invoice without due_date as current', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([
        mockInvoiceRecord({
          amount: 1000,
          amount_paid: 0,
          amount_due: 1000,
          due_date: null,
        }),
      ]);

      const result = await service.getAR(TENANT_ID, {});

      expect(result.aging_buckets.current).toBe(1000);
      expect(result.invoices[0].is_overdue).toBe(false);
      expect(result.invoices[0].days_overdue).toBeNull();
    });

    it('should exclude voided invoices from AR query', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([]);

      await service.getAR(TENANT_ID, {});

      expect(prisma.project_invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            status: { not: 'voided' },
          }),
        }),
      );
    });

    it('should sort invoices by days_overdue DESC then amount_due DESC', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([
        // 5 days overdue, $5000
        mockInvoiceRecord({
          id: 'a',
          amount: 5000,
          amount_paid: 0,
          amount_due: 5000,
          due_date: daysAgo(5),
          sent_at: daysAgo(20),
        }),
        // 30 days overdue, $2000
        mockInvoiceRecord({
          id: 'b',
          amount: 2000,
          amount_paid: 0,
          amount_due: 2000,
          due_date: daysAgo(30),
          sent_at: daysAgo(60),
        }),
        // 5 days overdue, $1000
        mockInvoiceRecord({
          id: 'c',
          amount: 1000,
          amount_paid: 0,
          amount_due: 1000,
          due_date: daysAgo(5),
          sent_at: daysAgo(15),
        }),
      ]);

      const result = await service.getAR(TENANT_ID, {});

      // b (30d overdue) first, then a (5d, $5000), then c (5d, $1000)
      expect(result.invoices[0].invoice_id).toBe('b');
      expect(result.invoices[1].invoice_id).toBe('a');
      expect(result.invoices[2].invoice_id).toBe('c');
    });

    it('should include tenant_id in AR query', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([]);

      await service.getAR(TENANT_ID, {});

      expect(prisma.project_invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });
  });

  // =========================================================================
  // getAP()
  // =========================================================================
  describe('getAP', () => {
    function setupEmptyAPMocks() {
      prisma.subcontractor_task_invoice.findMany.mockResolvedValue([]);
      mockRecurringExpenseService.getPreview.mockResolvedValue({
        period_days: 30,
        total_obligations: 0,
        occurrences: [],
      });
      prisma.crew_hour_log.aggregate.mockResolvedValue({
        _sum: { hours_regular: null, hours_overtime: null },
      });
      prisma.crew_hour_log.findMany.mockResolvedValue([]);
    }

    it('should group subcontractor invoices by subcontractor and sum amounts', async () => {
      prisma.subcontractor_task_invoice.findMany.mockResolvedValue([
        mockSubInvoice({
          id: 'si-1',
          subcontractor_id: 'sub-1',
          amount: 1000,
          status: 'pending',
          subcontractor: { id: 'sub-1', business_name: 'Smith Plumbing LLC' },
        }),
        mockSubInvoice({
          id: 'si-2',
          subcontractor_id: 'sub-1',
          amount: 2000,
          status: 'approved',
          subcontractor: { id: 'sub-1', business_name: 'Smith Plumbing LLC' },
        }),
        mockSubInvoice({
          id: 'si-3',
          subcontractor_id: 'sub-2',
          amount: 3000,
          status: 'pending',
          subcontractor: { id: 'sub-2', business_name: 'Doe Electric Co' },
        }),
      ]);
      mockRecurringExpenseService.getPreview.mockResolvedValue({
        period_days: 30,
        total_obligations: 0,
        occurrences: [],
      });
      prisma.crew_hour_log.aggregate.mockResolvedValue({
        _sum: { hours_regular: null, hours_overtime: null },
      });
      prisma.crew_hour_log.findMany.mockResolvedValue([]);

      const result = await service.getAP(TENANT_ID, 30);

      expect(result.subcontractor_invoices.total_pending).toBe(4000);
      expect(result.subcontractor_invoices.total_approved).toBe(2000);
      expect(result.subcontractor_invoices.total_outstanding).toBe(6000);
      expect(result.subcontractor_invoices.by_subcontractor).toHaveLength(2);
    });

    it('should set crew_unpaid_estimate to 0 with note about hourly rates', async () => {
      prisma.subcontractor_task_invoice.findMany.mockResolvedValue([]);
      mockRecurringExpenseService.getPreview.mockResolvedValue({
        period_days: 30,
        total_obligations: 0,
        occurrences: [],
      });
      prisma.crew_hour_log.aggregate.mockResolvedValue({
        _sum: { hours_regular: 40, hours_overtime: 5 },
      });
      prisma.crew_hour_log.findMany.mockResolvedValue([
        { crew_member_id: 'cm-1' },
      ]);

      const result = await service.getAP(TENANT_ID, 30);

      expect(result.summary.crew_unpaid_estimate).toBe(0);
      expect(result.crew_hours_summary.note).toContain('hourly rates');
      expect(result.crew_hours_summary.total_regular_hours_this_month).toBe(40);
      expect(result.crew_hours_summary.total_overtime_hours_this_month).toBe(5);
      expect(result.crew_hours_summary.crew_member_count).toBe(1);
    });

    it('should call getPreview with correct daysAhead value', async () => {
      setupEmptyAPMocks();
      mockRecurringExpenseService.getPreview.mockResolvedValue({
        period_days: 60,
        total_obligations: 0,
        occurrences: [],
      });

      await service.getAP(TENANT_ID, 60);

      expect(mockRecurringExpenseService.getPreview).toHaveBeenCalledWith(
        TENANT_ID,
        60,
      );
    });

    it('should include tenant_id in all AP queries', async () => {
      setupEmptyAPMocks();

      await service.getAP(TENANT_ID, 30);

      expect(prisma.subcontractor_task_invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
      for (const call of prisma.crew_hour_log.aggregate.mock.calls) {
        expect(call[0].where.tenant_id).toBe(TENANT_ID);
      }
      for (const call of prisma.crew_hour_log.findMany.mock.calls) {
        expect(call[0].where.tenant_id).toBe(TENANT_ID);
      }
    });
  });

  // =========================================================================
  // exportPL()
  // =========================================================================
  describe('exportPL', () => {
    it('should return a Buffer with CSV content containing both sections', async () => {
      jest.spyOn(service, 'getPL').mockResolvedValue({
        year: 2026,
        period: 'single_month',
        currency: 'USD',
        months: [
          {
            year: 2026,
            month: 3,
            month_label: 'Mar 2026',
            income: { total: 5000, invoice_count: 2, by_project: [] },
            expenses: {
              total: 2000,
              total_with_pending: 2500,
              total_tax_paid: 100,
              by_classification: {
                cost_of_goods_sold: 1200,
                operating_expense: 800,
              },
              by_category: [],
              top_suppliers: [],
            },
            gross_profit: 3800,
            operating_profit: 3000,
            net_profit: 3000,
            gross_margin_percent: 76,
            tax: {
              tax_collected: 200,
              tax_paid: 100,
              net_tax_position: 100,
            },
          },
        ],
        totals: {} as any,
      } as any);

      prisma.financial_entry.findMany.mockResolvedValue([]);

      const result = await service.exportPL(TENANT_ID, 2026, 3);

      expect(Buffer.isBuffer(result)).toBe(true);
      const csv = result.toString('utf-8');
      // Section 1 header
      expect(csv).toContain('Month,Total Income');
      // Section 1 data
      expect(csv).toContain('Mar 2026,5000');
      // Section 2 header
      expect(csv).toContain('Month,Date,Category');
    });

    it('should escape CSV fields containing commas and quotes', async () => {
      jest.spyOn(service, 'getPL').mockResolvedValue({
        year: 2026,
        period: 'single_month',
        currency: 'USD',
        months: [
          {
            year: 2026,
            month: 1,
            month_label: 'Jan 2026',
            income: { total: 0, invoice_count: 0, by_project: [] },
            expenses: {
              total: 0,
              total_with_pending: 0,
              total_tax_paid: 0,
              by_classification: {
                cost_of_goods_sold: 0,
                operating_expense: 0,
              },
              by_category: [],
              top_suppliers: [],
            },
            gross_profit: 0,
            operating_profit: 0,
            net_profit: 0,
            gross_margin_percent: null,
            tax: { tax_collected: 0, tax_paid: 0, net_tax_position: 0 },
          },
        ],
        totals: {} as any,
      } as any);

      prisma.financial_entry.findMany.mockResolvedValue([
        {
          entry_date: new Date('2026-01-15'),
          amount: 500,
          tax_amount: 25,
          payment_method: 'check',
          vendor_name: 'Smith, Jones & Co',
          notes: 'Payment for "supplies"',
          category: {
            name: 'Materials',
            classification: 'cost_of_goods_sold',
          },
          project: { name: 'Project A' },
        },
      ]);

      const result = await service.exportPL(TENANT_ID, 2026, 1);
      const csv = result.toString('utf-8');

      // Vendor with comma should be quoted
      expect(csv).toContain('"Smith, Jones & Co"');
      // Notes with double quotes should be double-escaped
      expect(csv).toContain('"Payment for ""supplies"""');
    });

    it('should include tenant_id in expense detail query', async () => {
      jest.spyOn(service, 'getPL').mockResolvedValue({
        year: 2026,
        period: 'single_month',
        currency: 'USD',
        months: [
          {
            year: 2026,
            month: 1,
            month_label: 'Jan 2026',
            income: { total: 0, invoice_count: 0, by_project: [] },
            expenses: {
              total: 0,
              total_with_pending: 0,
              total_tax_paid: 0,
              by_classification: {
                cost_of_goods_sold: 0,
                operating_expense: 0,
              },
              by_category: [],
              top_suppliers: [],
            },
            gross_profit: 0,
            operating_profit: 0,
            net_profit: 0,
            gross_margin_percent: null,
            tax: { tax_collected: 0, tax_paid: 0, net_tax_position: 0 },
          },
        ],
        totals: {} as any,
      } as any);

      prisma.financial_entry.findMany.mockResolvedValue([]);

      await service.exportPL(TENANT_ID, 2026, 1);

      expect(prisma.financial_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            submission_status: 'confirmed',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // getForecast()
  // =========================================================================
  describe('getForecast', () => {
    const emptyPreview = {
      period_days: 30,
      total_obligations: 0,
      occurrences: [],
    };

    it('should return forecast with inflows and outflows', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([
        mockInvoiceRecord({ due_date: daysFromNow(15) }),
      ]);
      mockRecurringExpenseService.getPreview.mockResolvedValue({
        period_days: 30,
        total_obligations: 2000,
        occurrences: [
          {
            rule_id: RULE_ID_1,
            rule_name: 'Monthly Rent',
            amount: 2000,
            tax_amount: null,
            category_name: 'Rent',
            due_date: '2026-04-15',
            frequency: 'monthly',
            supplier_name: 'Landlord Inc',
            payment_method_nickname: null,
          },
        ],
      });

      const result = await service.getForecast(TENANT_ID, 30);

      expect(result.period_days).toBe(30);
      expect(result.expected_inflows.total).toBe(5000);
      expect(result.expected_inflows.items).toHaveLength(1);
      expect(result.expected_inflows.items[0].type).toBe('invoice_due');
      expect(result.expected_inflows.items[0].invoice_id).toBe(INVOICE_ID_1);
      expect(result.expected_outflows.total).toBe(2000);
      expect(result.expected_outflows.items).toHaveLength(1);
      expect(result.expected_outflows.items[0].type).toBe('recurring_expense');
      expect(result.net_forecast).toBe(3000);
      expect(result.net_forecast_label).toBe('Positive');
    });

    it('should include tenant_id in invoice query', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([]);
      mockRecurringExpenseService.getPreview.mockResolvedValue(emptyPreview);

      await service.getForecast(TENANT_ID, 30);

      expect(prisma.project_invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    it('should pass tenant_id and days to getPreview', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([]);
      mockRecurringExpenseService.getPreview.mockResolvedValue(emptyPreview);

      await service.getForecast(TENANT_ID, 60);

      expect(mockRecurringExpenseService.getPreview).toHaveBeenCalledWith(
        TENANT_ID,
        60,
      );
    });

    it('should return Negative label when net_forecast < -100', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([]);
      mockRecurringExpenseService.getPreview.mockResolvedValue({
        period_days: 30,
        total_obligations: 5000,
        occurrences: [
          {
            rule_id: RULE_ID_1,
            rule_name: 'Big Expense',
            amount: 5000,
            tax_amount: null,
            category_name: 'Ops',
            due_date: '2026-04-01',
            frequency: 'monthly',
            supplier_name: null,
            payment_method_nickname: null,
          },
        ],
      });

      const result = await service.getForecast(TENANT_ID, 30);

      expect(result.net_forecast).toBe(-5000);
      expect(result.net_forecast_label).toBe('Negative');
    });

    it('should return Breakeven label when |net_forecast| <= 100', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([
        mockInvoiceRecord({ amount_due: 50, due_date: daysFromNow(5) }),
      ]);
      mockRecurringExpenseService.getPreview.mockResolvedValue(emptyPreview);

      const result = await service.getForecast(TENANT_ID, 30);

      expect(result.net_forecast_label).toBe('Breakeven');
    });

    it('should exclude voided invoices from inflows', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([]);
      mockRecurringExpenseService.getPreview.mockResolvedValue(emptyPreview);

      await service.getForecast(TENANT_ID, 30);

      expect(prisma.project_invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { not: 'voided' },
          }),
        }),
      );
    });

    it('should return no NaN or Infinity in response fields when no data', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([]);
      mockRecurringExpenseService.getPreview.mockResolvedValue(emptyPreview);

      const result = await service.getForecast(TENANT_ID, 30);

      expect(Number.isFinite(result.expected_inflows.total)).toBe(true);
      expect(Number.isFinite(result.expected_outflows.total)).toBe(true);
      expect(Number.isFinite(result.net_forecast)).toBe(true);
    });
  });

  // =========================================================================
  // getAlerts()
  // =========================================================================
  describe('getAlerts', () => {
    const setupEmptyMocks = () => {
      prisma.project_invoice.findMany.mockResolvedValue([]);
      prisma.subcontractor_task_invoice.findMany.mockResolvedValue([]);
      prisma.recurring_expense_rule.findMany.mockResolvedValue([]);
      prisma.financial_entry.count.mockResolvedValue(0);
      prisma.project.findMany.mockResolvedValue([]);
    };

    it('should return empty alerts when no conditions are met', async () => {
      setupEmptyMocks();

      const result = await service.getAlerts(TENANT_ID);

      expect(result.alert_count).toBe(0);
      expect(result.alerts).toHaveLength(0);
    });

    // -----------------------------------------------------------------------
    // Invoice overdue deduplication (BR-A1, BR-A2)
    // -----------------------------------------------------------------------
    it('should generate invoice_overdue_60 for 60+ day overdue invoices', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([
        mockInvoiceRecord({ due_date: daysAgo(65), status: 'sent' }),
      ]);
      prisma.subcontractor_task_invoice.findMany.mockResolvedValue([]);
      prisma.recurring_expense_rule.findMany.mockResolvedValue([]);
      prisma.financial_entry.count.mockResolvedValue(0);
      prisma.project.findMany.mockResolvedValue([]);

      const result = await service.getAlerts(TENANT_ID);

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].type).toBe('invoice_overdue_60');
      expect(result.alerts[0].severity).toBe('critical');
      expect(result.alerts[0].id).toBe(`invoice_overdue_60_${INVOICE_ID_1}`);
    });

    it('should deduplicate: 60+ day invoice should NOT generate 30-day or basic alert', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([
        mockInvoiceRecord({ due_date: daysAgo(65), status: 'sent' }),
      ]);
      prisma.subcontractor_task_invoice.findMany.mockResolvedValue([]);
      prisma.recurring_expense_rule.findMany.mockResolvedValue([]);
      prisma.financial_entry.count.mockResolvedValue(0);
      prisma.project.findMany.mockResolvedValue([]);

      const result = await service.getAlerts(TENANT_ID);

      const types = result.alerts.map((a) => a.type);
      expect(types).toContain('invoice_overdue_60');
      expect(types).not.toContain('invoice_overdue_30');
      expect(types).not.toContain('invoice_overdue');
    });

    it('should generate invoice_overdue_30 for 30-59 day overdue invoices', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([
        mockInvoiceRecord({ due_date: daysAgo(45), status: 'sent' }),
      ]);
      prisma.subcontractor_task_invoice.findMany.mockResolvedValue([]);
      prisma.recurring_expense_rule.findMany.mockResolvedValue([]);
      prisma.financial_entry.count.mockResolvedValue(0);
      prisma.project.findMany.mockResolvedValue([]);

      const result = await service.getAlerts(TENANT_ID);

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].type).toBe('invoice_overdue_30');
      expect(result.alerts[0].severity).toBe('warning');
    });

    it('should generate invoice_overdue for <30 day overdue invoices', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([
        mockInvoiceRecord({ due_date: daysAgo(10), status: 'sent' }),
      ]);
      prisma.subcontractor_task_invoice.findMany.mockResolvedValue([]);
      prisma.recurring_expense_rule.findMany.mockResolvedValue([]);
      prisma.financial_entry.count.mockResolvedValue(0);
      prisma.project.findMany.mockResolvedValue([]);

      const result = await service.getAlerts(TENANT_ID);

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].type).toBe('invoice_overdue');
      expect(result.alerts[0].severity).toBe('critical');
    });

    it('should properly split multiple invoices into correct overdue buckets', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([
        mockInvoiceRecord({
          id: 'inv-60',
          invoice_number: 'INV-60',
          due_date: daysAgo(70),
        }),
        mockInvoiceRecord({
          id: 'inv-30',
          invoice_number: 'INV-30',
          due_date: daysAgo(40),
        }),
        mockInvoiceRecord({
          id: 'inv-basic',
          invoice_number: 'INV-BASIC',
          due_date: daysAgo(5),
        }),
      ]);
      prisma.subcontractor_task_invoice.findMany.mockResolvedValue([]);
      prisma.recurring_expense_rule.findMany.mockResolvedValue([]);
      prisma.financial_entry.count.mockResolvedValue(0);
      prisma.project.findMany.mockResolvedValue([]);

      const result = await service.getAlerts(TENANT_ID);

      expect(result.alerts).toHaveLength(3);
      const types = result.alerts.map((a) => a.type);
      expect(types).toContain('invoice_overdue_60');
      expect(types).toContain('invoice_overdue_30');
      expect(types).toContain('invoice_overdue');
    });

    // -----------------------------------------------------------------------
    // Subcontractor invoice pending
    // -----------------------------------------------------------------------
    it('should generate sub_invoice_pending for invoices pending > 7 days', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([]);
      prisma.subcontractor_task_invoice.findMany.mockResolvedValue([
        mockSubInvoice(),
      ]);
      prisma.recurring_expense_rule.findMany.mockResolvedValue([]);
      prisma.financial_entry.count.mockResolvedValue(0);
      prisma.project.findMany.mockResolvedValue([]);

      const result = await service.getAlerts(TENANT_ID);

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].type).toBe('sub_invoice_pending');
      expect(result.alerts[0].severity).toBe('warning');
      expect(result.alerts[0].entity_name).toBe('ABC Plumbing');
    });

    // -----------------------------------------------------------------------
    // Recurring alerts
    // -----------------------------------------------------------------------
    it('should generate recurring_due_soon for active rules due within 3 days', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([]);
      prisma.subcontractor_task_invoice.findMany.mockResolvedValue([]);
      prisma.recurring_expense_rule.findMany
        .mockResolvedValueOnce([
          mockRecurringRule({ next_due_date: daysFromNow(2) }),
        ])
        .mockResolvedValueOnce([]);
      prisma.financial_entry.count.mockResolvedValue(0);
      prisma.project.findMany.mockResolvedValue([]);

      const result = await service.getAlerts(TENANT_ID);

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].type).toBe('recurring_due_soon');
      expect(result.alerts[0].severity).toBe('info');
    });

    it('should generate recurring_overdue for active rules past due', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([]);
      prisma.subcontractor_task_invoice.findMany.mockResolvedValue([]);
      prisma.recurring_expense_rule.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          mockRecurringRule({ next_due_date: daysAgo(5) }),
        ]);
      prisma.financial_entry.count.mockResolvedValue(0);
      prisma.project.findMany.mockResolvedValue([]);

      const result = await service.getAlerts(TENANT_ID);

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].type).toBe('recurring_overdue');
      expect(result.alerts[0].severity).toBe('critical');
    });

    // -----------------------------------------------------------------------
    // Expense pending review (BR-A6)
    // -----------------------------------------------------------------------
    it('should generate expense_pending_review when count > 5', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([]);
      prisma.subcontractor_task_invoice.findMany.mockResolvedValue([]);
      prisma.recurring_expense_rule.findMany.mockResolvedValue([]);
      prisma.financial_entry.count.mockResolvedValue(10);
      prisma.project.findMany.mockResolvedValue([]);

      const result = await service.getAlerts(TENANT_ID);

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].type).toBe('expense_pending_review');
      expect(result.alerts[0].title).toContain('10 expenses');
      expect(result.alerts[0].entity_id).toBe(TENANT_ID);
    });

    it('should NOT generate expense_pending_review when count <= 5', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([]);
      prisma.subcontractor_task_invoice.findMany.mockResolvedValue([]);
      prisma.recurring_expense_rule.findMany.mockResolvedValue([]);
      prisma.financial_entry.count.mockResolvedValue(3);
      prisma.project.findMany.mockResolvedValue([]);

      const result = await service.getAlerts(TENANT_ID);

      const types = result.alerts.map((a) => a.type);
      expect(types).not.toContain('expense_pending_review');
    });

    // -----------------------------------------------------------------------
    // Project no invoice (BR-A7)
    // -----------------------------------------------------------------------
    it('should generate project_no_invoice for eligible projects with no invoices', async () => {
      prisma.project_invoice.findMany
        .mockResolvedValueOnce([]) // overdue invoices
        .mockResolvedValueOnce([]); // project invoice check — none found
      prisma.subcontractor_task_invoice.findMany.mockResolvedValue([]);
      prisma.recurring_expense_rule.findMany.mockResolvedValue([]);
      prisma.financial_entry.count.mockResolvedValue(0);
      prisma.project.findMany.mockResolvedValue([mockProject()]);

      const result = await service.getAlerts(TENANT_ID);

      expect(result.alerts).toHaveLength(1);
      expect(result.alerts[0].type).toBe('project_no_invoice');
      expect(result.alerts[0].severity).toBe('warning');
      expect(result.alerts[0].title).toContain('Kitchen Renovation');
    });

    it('should NOT generate project_no_invoice when project has invoices', async () => {
      prisma.project_invoice.findMany
        .mockResolvedValueOnce([]) // overdue invoices
        .mockResolvedValueOnce([{ project_id: PROJECT_ID_1 }]); // project HAS invoices
      prisma.subcontractor_task_invoice.findMany.mockResolvedValue([]);
      prisma.recurring_expense_rule.findMany.mockResolvedValue([]);
      prisma.financial_entry.count.mockResolvedValue(0);
      prisma.project.findMany.mockResolvedValue([mockProject()]);

      const result = await service.getAlerts(TENANT_ID);

      const types = result.alerts.map((a) => a.type);
      expect(types).not.toContain('project_no_invoice');
    });

    // -----------------------------------------------------------------------
    // Sorting and capping
    // -----------------------------------------------------------------------
    it('should sort alerts: critical first, then warning, then info', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([
        mockInvoiceRecord({ due_date: daysAgo(10), status: 'sent' }),
      ]);
      prisma.subcontractor_task_invoice.findMany.mockResolvedValue([
        mockSubInvoice(),
      ]);
      prisma.recurring_expense_rule.findMany
        .mockResolvedValueOnce([
          mockRecurringRule({ next_due_date: daysFromNow(2) }),
        ])
        .mockResolvedValueOnce([]);
      prisma.financial_entry.count.mockResolvedValue(0);
      prisma.project.findMany.mockResolvedValue([]);

      const result = await service.getAlerts(TENANT_ID);

      expect(result.alerts.length).toBeGreaterThanOrEqual(3);
      const severities = result.alerts.map((a) => a.severity);
      const criticalIdx = severities.indexOf('critical');
      const warningIdx = severities.indexOf('warning');
      const infoIdx = severities.indexOf('info');

      if (criticalIdx >= 0 && warningIdx >= 0) {
        expect(criticalIdx).toBeLessThan(warningIdx);
      }
      if (warningIdx >= 0 && infoIdx >= 0) {
        expect(warningIdx).toBeLessThan(infoIdx);
      }
    });

    it('should cap alerts at 50 and set total_alerts_truncated flag', async () => {
      const manyInvoices = Array.from({ length: 55 }, (_, i) =>
        mockInvoiceRecord({
          id: `inv-${i}`,
          invoice_number: `INV-${String(i).padStart(3, '0')}`,
          due_date: daysAgo(10),
          amount_due: 100 + i,
          status: 'sent',
        }),
      );
      prisma.project_invoice.findMany.mockResolvedValue(manyInvoices);
      prisma.subcontractor_task_invoice.findMany.mockResolvedValue([]);
      prisma.recurring_expense_rule.findMany.mockResolvedValue([]);
      prisma.financial_entry.count.mockResolvedValue(0);
      prisma.project.findMany.mockResolvedValue([]);

      const result = await service.getAlerts(TENANT_ID);

      expect(result.alert_count).toBe(50);
      expect(result.alerts).toHaveLength(50);
      expect(result.total_alerts_truncated).toBe(true);
    });

    it('should NOT set total_alerts_truncated when alerts <= 50', async () => {
      setupEmptyMocks();

      const result = await service.getAlerts(TENANT_ID);

      expect(result).not.toHaveProperty('total_alerts_truncated');
    });

    // -----------------------------------------------------------------------
    // Tenant isolation
    // -----------------------------------------------------------------------
    it('should include tenant_id in all queries', async () => {
      setupEmptyMocks();

      await service.getAlerts(TENANT_ID);

      expect(prisma.project_invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
      expect(prisma.financial_entry.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    // -----------------------------------------------------------------------
    // Deterministic IDs (BR-A3)
    // -----------------------------------------------------------------------
    it('should produce deterministic alert IDs', async () => {
      prisma.project_invoice.findMany.mockResolvedValue([
        mockInvoiceRecord({ due_date: daysAgo(10), status: 'sent' }),
      ]);
      prisma.subcontractor_task_invoice.findMany.mockResolvedValue([]);
      prisma.recurring_expense_rule.findMany.mockResolvedValue([]);
      prisma.financial_entry.count.mockResolvedValue(0);
      prisma.project.findMany.mockResolvedValue([]);

      const result = await service.getAlerts(TENANT_ID);

      expect(result.alerts[0].id).toBe(`invoice_overdue_${INVOICE_ID_1}`);
    });
  });

  // =========================================================================
  // getOverview()
  // =========================================================================
  describe('getOverview', () => {
    const mockResults = () => {
      jest.spyOn(service, 'getPL').mockResolvedValue({
        year: 2026,
        period: 'single_month',
        months: [],
        totals: {},
      } as any);
      jest.spyOn(service, 'getAR').mockResolvedValue({
        summary: {},
        aging_buckets: {},
        invoices: [],
      } as any);
      jest.spyOn(service, 'getAP').mockResolvedValue({
        summary: {},
        subcontractor_invoices: {},
      } as any);
      jest.spyOn(service, 'getForecast').mockResolvedValue({
        period_days: 30,
        net_forecast: 0,
      } as any);
      jest.spyOn(service, 'getAlerts').mockResolvedValue({
        alert_count: 0,
        alerts: [],
      } as any);
    };

    it('should call all 5 methods and return combined response', async () => {
      mockResults();

      const result = await service.getOverview(TENANT_ID, {});

      expect(service.getPL).toHaveBeenCalled();
      expect(service.getAR).toHaveBeenCalledWith(TENANT_ID, {});
      expect(service.getAP).toHaveBeenCalledWith(TENANT_ID, 30);
      expect(service.getForecast).toHaveBeenCalledWith(TENANT_ID, 30);
      expect(service.getAlerts).toHaveBeenCalledWith(TENANT_ID);

      expect(result).toHaveProperty('pl_summary');
      expect(result).toHaveProperty('ar_summary');
      expect(result).toHaveProperty('ap_summary');
      expect(result).toHaveProperty('forecast');
      expect(result).toHaveProperty('alerts');
      expect(result).toHaveProperty('generated_at');
      expect(result.generated_at).toBeInstanceOf(Date);
    });

    it('should use current month for PL (BR-O2)', async () => {
      mockResults();

      const now = new Date();
      await service.getOverview(TENANT_ID, {});

      expect(service.getPL).toHaveBeenCalledWith(
        TENANT_ID,
        now.getFullYear(),
        now.getMonth() + 1,
      );
    });

    it('should default forecast_days to 30 when not provided', async () => {
      mockResults();

      await service.getOverview(TENANT_ID, {});

      expect(service.getForecast).toHaveBeenCalledWith(TENANT_ID, 30);
    });

    it('should use valid forecast_days when provided (90)', async () => {
      mockResults();

      await service.getOverview(TENANT_ID, { forecast_days: 90 });

      expect(service.getForecast).toHaveBeenCalledWith(TENANT_ID, 90);
    });

    it('should default to 30 when invalid forecast_days is provided', async () => {
      mockResults();

      await service.getOverview(TENANT_ID, { forecast_days: 45 });

      expect(service.getForecast).toHaveBeenCalledWith(TENANT_ID, 30);
    });

    it('should return alerts array (not the full alerts response)', async () => {
      mockResults();

      const result = await service.getOverview(TENANT_ID, {});

      expect(result.alerts).toEqual([]);
    });
  });
});
