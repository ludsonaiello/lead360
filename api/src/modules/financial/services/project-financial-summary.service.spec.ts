import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProjectFinancialSummaryService } from './project-financial-summary.service';
import { PrismaService } from '../../../core/database/prisma.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-uuid-001';
const OTHER_TENANT_ID = 'tenant-uuid-002';
const PROJECT_ID = 'project-uuid-001';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

/**
 * Creates a mock project record matching the shape returned by fetchProjectData.
 * Uses 'in' check (NOT ??) so explicit null overrides are preserved.
 */
const mockProject = (
  overrides: {
    contract_value?: number | null;
    estimated_cost?: number | null;
  } = {},
) => ({
  id: PROJECT_ID,
  project_number: 'P-001',
  name: 'Test Project',
  status: 'in_progress',
  progress_percent: 50.0,
  start_date: new Date('2025-01-01'),
  target_completion_date: new Date('2025-12-31'),
  actual_completion_date: null,
  contract_value:
    'contract_value' in overrides ? overrides.contract_value : 100000,
  estimated_cost:
    'estimated_cost' in overrides ? overrides.estimated_cost : 80000,
  assigned_pm_user: { id: 'user-1', first_name: 'John', last_name: 'Doe' },
});

// ---------------------------------------------------------------------------
// Mock PrismaService — every model + method the service touches
// ---------------------------------------------------------------------------

const mockPrismaService = {
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
  project_invoice: {
    aggregate: jest.fn(),
    count: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sets up all aggregation/count/groupBy/findMany mocks used by getFullSummary
 * to return zero/empty results. Prevents "mock not set up" noise in tests
 * that only care about a specific part of the response.
 *
 * Call AFTER setting up project.findFirst for the specific test.
 */
const setupEmptyAggregationMocks = () => {
  // fetchCostData: 3× aggregate (confirmed, pending, tax) + count + groupBy + category lookup
  // Using mockResolvedValue (not Once) — returns same shape for all 3 aggregate calls.
  // Service reads _sum.amount on calls 1-2 and _sum.tax_amount on call 3;
  // both fields present → Number(null ?? 0) = 0 for all.
  mockPrismaService.financial_entry.aggregate.mockResolvedValue({
    _sum: { amount: null, tax_amount: null },
  });
  mockPrismaService.financial_entry.count.mockResolvedValue(0);
  mockPrismaService.financial_entry.groupBy.mockResolvedValue([]);
  mockPrismaService.financial_category.findMany.mockResolvedValue([]);

  // fetchSubcontractorData: 2× aggregate (invoices + payments)
  mockPrismaService.subcontractor_task_invoice.aggregate.mockResolvedValue({
    _sum: { amount: null },
    _count: 0,
  });
  mockPrismaService.subcontractor_payment_record.aggregate.mockResolvedValue({
    _sum: { amount: null },
    _count: 0,
  });

  // fetchCrewData: 2× aggregate + 2× findMany (distinct members)
  mockPrismaService.crew_hour_log.aggregate.mockResolvedValue({
    _sum: { hours_regular: null, hours_overtime: null },
  });
  mockPrismaService.crew_hour_log.findMany.mockResolvedValue([]);
  mockPrismaService.crew_payment_record.aggregate.mockResolvedValue({
    _sum: { amount: null },
  });
  mockPrismaService.crew_payment_record.findMany.mockResolvedValue([]);

  // fetchReceiptData: project_task.findMany → receipt.count ×2 (total + categorized)
  mockPrismaService.project_task.findMany.mockResolvedValue([]);
  mockPrismaService.receipt.count.mockResolvedValue(0);

  // fetchRevenueData: 1× aggregate + 4× count (total, paid, partial, draft)
  mockPrismaService.project_invoice.aggregate.mockResolvedValue({
    _sum: { amount: null, amount_paid: null },
  });
  mockPrismaService.project_invoice.count.mockResolvedValue(0);
};

/**
 * Sets up cost-related mocks with specific confirmed/pending amounts.
 * Uses mockResolvedValueOnce for the 3 aggregate calls (order-dependent).
 * All other queries return zero/empty.
 */
const setupCostMocks = (costs: { confirmed: number; pending: number }) => {
  // fetchCostData: 3× aggregate — order matches Promise.all in the service:
  //   1. confirmed (submission_status='confirmed')
  //   2. pending (submission_status='pending_review')
  //   3. tax (all statuses)
  mockPrismaService.financial_entry.aggregate
    .mockResolvedValueOnce({ _sum: { amount: costs.confirmed } })
    .mockResolvedValueOnce({ _sum: { amount: costs.pending } })
    .mockResolvedValueOnce({ _sum: { tax_amount: 0 } });

  mockPrismaService.financial_entry.count.mockResolvedValue(10);
  mockPrismaService.financial_entry.groupBy.mockResolvedValue([]);
  mockPrismaService.financial_category.findMany.mockResolvedValue([]);

  // fetchSubcontractorData
  mockPrismaService.subcontractor_task_invoice.aggregate.mockResolvedValue({
    _sum: { amount: null },
    _count: 0,
  });
  mockPrismaService.subcontractor_payment_record.aggregate.mockResolvedValue({
    _sum: { amount: null },
    _count: 0,
  });

  // fetchCrewData
  mockPrismaService.crew_hour_log.aggregate.mockResolvedValue({
    _sum: { hours_regular: null, hours_overtime: null },
  });
  mockPrismaService.crew_hour_log.findMany.mockResolvedValue([]);
  mockPrismaService.crew_payment_record.aggregate.mockResolvedValue({
    _sum: { amount: null },
  });
  mockPrismaService.crew_payment_record.findMany.mockResolvedValue([]);

  // fetchReceiptData
  mockPrismaService.project_task.findMany.mockResolvedValue([]);
  mockPrismaService.receipt.count.mockResolvedValue(0);

  // fetchRevenueData
  mockPrismaService.project_invoice.aggregate.mockResolvedValue({
    _sum: { amount: null, amount_paid: null },
  });
  mockPrismaService.project_invoice.count.mockResolvedValue(0);
};

// ===========================================================================
// Test Suite
// ===========================================================================

describe('ProjectFinancialSummaryService', () => {
  let service: ProjectFinancialSummaryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectFinancialSummaryService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ProjectFinancialSummaryService>(
      ProjectFinancialSummaryService,
    );
    jest.clearAllMocks();
  });

  // ── validateProjectAccess (tenant isolation) ──────────────────────────

  describe('validateProjectAccess', () => {
    it('should throw NotFoundException when project does not exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getFullSummary(TENANT_ID, 'nonexistent-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when project belongs to different tenant', async () => {
      // findFirst with { id: PROJECT_ID, tenant_id: OTHER_TENANT_ID } returns null
      mockPrismaService.project.findFirst.mockResolvedValue(null);

      await expect(
        service.getFullSummary(OTHER_TENANT_ID, PROJECT_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('should proceed when project belongs to requesting tenant', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      setupEmptyAggregationMocks();

      const result = await service.getFullSummary(TENANT_ID, PROJECT_ID);

      expect(result).toBeDefined();
      expect(result.project.id).toBe(PROJECT_ID);
    });
  });

  // ── Margin analysis ────────────────────────────────────────────────────

  describe('margin analysis', () => {
    it('should return null margins when contract_value is null', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProject({ contract_value: null, estimated_cost: 50000 }),
      );
      setupEmptyAggregationMocks();

      const result = await service.getFullSummary(TENANT_ID, PROJECT_ID);

      expect(result.margin_analysis.contract_value).toBeNull();
      expect(result.margin_analysis.estimated_margin).toBeNull();
      expect(result.margin_analysis.actual_margin).toBeNull();
      expect(result.margin_analysis.margin_percent).toBeNull();
    });

    it('should return null margin_percent when contract_value is zero', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProject({ contract_value: 0, estimated_cost: 50000 }),
      );
      setupEmptyAggregationMocks();

      const result = await service.getFullSummary(TENANT_ID, PROJECT_ID);

      expect(result.margin_analysis.margin_percent).toBeNull();
      // margin_percent must NEVER be NaN — guards against division by zero
      expect(result.margin_analysis.margin_percent).not.toBeNaN();
    });

    it('should calculate margins correctly with valid values', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProject({ contract_value: 100000, estimated_cost: 80000 }),
      );
      setupCostMocks({ confirmed: 75000, pending: 5000 });

      const result = await service.getFullSummary(TENANT_ID, PROJECT_ID);

      expect(result.margin_analysis.contract_value).toBe(100000);
      expect(result.margin_analysis.estimated_cost).toBe(80000);
      expect(result.margin_analysis.actual_cost_confirmed).toBe(75000);
      expect(result.margin_analysis.actual_cost_total).toBe(80000); // 75000 + 5000
      expect(result.margin_analysis.estimated_margin).toBe(20000); // 100000 - 80000
      expect(result.margin_analysis.actual_margin).toBe(25000); // 100000 - 75000
      expect(result.margin_analysis.cost_variance).toBe(-5000); // 75000 - 80000
      expect(result.margin_analysis.margin_percent).toBe(25); // (25000/100000)*100
    });

    it('should return null cost_variance when estimated_cost is null', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProject({ contract_value: 100000, estimated_cost: null }),
      );
      setupEmptyAggregationMocks();

      const result = await service.getFullSummary(TENANT_ID, PROJECT_ID);

      expect(result.margin_analysis.cost_variance).toBeNull();
      expect(result.margin_analysis.estimated_margin).toBeNull();
    });
  });

  // ── Confirmed vs pending entries ──────────────────────────────────────

  describe('confirmed vs pending entries', () => {
    it('should separate confirmed and pending expenses', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProject({ contract_value: 100000 }),
      );
      setupCostMocks({ confirmed: 60000, pending: 15000 });

      const result = await service.getFullSummary(TENANT_ID, PROJECT_ID);

      expect(result.cost_summary.total_expenses).toBe(60000);
      expect(result.cost_summary.total_expenses_pending).toBe(15000);
      expect(result.margin_analysis.actual_cost_confirmed).toBe(60000);
      expect(result.margin_analysis.actual_cost_total).toBe(75000); // 60000 + 15000
    });
  });

  // ── Timeline ──────────────────────────────────────────────────────────

  describe('timeline', () => {
    it('should include zero-expense months within project date range', async () => {
      // validateProjectAccess → 1st findFirst → { id } (truthy → passes)
      // getTimeline's own project fetch → 2nd findFirst → { start_date, actual_completion_date }
      mockPrismaService.project.findFirst
        .mockResolvedValueOnce({ id: PROJECT_ID })
        .mockResolvedValueOnce({
          start_date: new Date('2025-01-01'),
          actual_completion_date: new Date('2025-04-30'),
        });

      mockPrismaService.financial_entry.findMany.mockResolvedValue([]);

      const result = await service.getTimeline(TENANT_ID, PROJECT_ID);

      // Should have 4 months: Jan, Feb, Mar, Apr 2025
      expect(result.months).toHaveLength(4);
      expect(result.months[0].month_label).toBe('Jan 2025');
      expect(result.months[0].total_expenses).toBe(0);
      expect(result.months[3].month_label).toBe('Apr 2025');
      expect(result.cumulative_total).toBe(0);
    });

    it('should include by_category breakdown per month', async () => {
      mockPrismaService.project.findFirst
        .mockResolvedValueOnce({ id: PROJECT_ID })
        .mockResolvedValueOnce({
          start_date: new Date('2025-03-01'),
          actual_completion_date: new Date('2025-03-31'),
        });

      mockPrismaService.financial_entry.findMany.mockResolvedValue([
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

  // ── Task breakdown ────────────────────────────────────────────────────

  describe('task breakdown', () => {
    it('should include tasks with zero financial activity', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue({
        id: PROJECT_ID,
      });

      mockPrismaService.project_task.findMany.mockResolvedValue([
        { id: 'task-1', title: 'Foundation', status: 'done', order_index: 1 },
        {
          id: 'task-2',
          title: 'Framing',
          status: 'in_progress',
          order_index: 2,
        },
        {
          id: 'task-3',
          title: 'Cleanup',
          status: 'not_started',
          order_index: 3,
        },
      ]);

      // financial_entry.groupBy called twice in Promise.all:
      //   1. by ['task_id'] → expense totals per task
      //   2. by ['task_id','category_id'] → per-category breakdown
      mockPrismaService.financial_entry.groupBy
        .mockResolvedValueOnce([
          { task_id: 'task-1', _sum: { amount: 5000 }, _count: 3 },
        ])
        .mockResolvedValueOnce([]);

      mockPrismaService.subcontractor_task_invoice.groupBy.mockResolvedValue(
        [],
      );
      mockPrismaService.crew_hour_log.groupBy.mockResolvedValue([]);
      mockPrismaService.financial_category.findMany.mockResolvedValue([]);

      const result = await service.getTaskBreakdown(TENANT_ID, PROJECT_ID, {});

      // ALL 3 tasks returned — including those with zero activity
      expect(result.tasks).toHaveLength(3);
      expect(
        result.tasks.find((t) => t.task_id === 'task-1')!.expenses.total,
      ).toBe(5000);
      expect(
        result.tasks.find((t) => t.task_id === 'task-2')!.expenses.total,
      ).toBe(0);
      expect(
        result.tasks.find((t) => t.task_id === 'task-3')!.expenses.total,
      ).toBe(0);
    });
  });

  // ── Revenue data ─────────────────────────────────────────────────────

  describe('revenue', () => {
    it('should return zeroed revenue block when no invoices exist', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      setupEmptyAggregationMocks();

      const result = await service.getFullSummary(TENANT_ID, PROJECT_ID);

      expect(result.revenue).toEqual({
        total_invoiced: 0,
        total_collected: 0,
        outstanding: 0,
        invoice_count: 0,
        paid_invoices: 0,
        partial_invoices: 0,
        draft_invoices: 0,
      });
    });

    it('should aggregate revenue from non-voided invoices', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      setupCostMocks({ confirmed: 50000, pending: 0 });

      // Override revenue mocks with actual data
      mockPrismaService.project_invoice.aggregate.mockResolvedValue({
        _sum: { amount: 75000, amount_paid: 45000 },
      });
      // count calls: total=5, paid=2, partial=1, draft=2
      mockPrismaService.project_invoice.count
        .mockResolvedValueOnce(5)   // total non-voided
        .mockResolvedValueOnce(2)   // paid
        .mockResolvedValueOnce(1)   // partial
        .mockResolvedValueOnce(2);  // draft

      const result = await service.getFullSummary(TENANT_ID, PROJECT_ID);

      expect(result.revenue.total_invoiced).toBe(75000);
      expect(result.revenue.total_collected).toBe(45000);
      expect(result.revenue.outstanding).toBe(30000);
      expect(result.revenue.invoice_count).toBe(5);
      expect(result.revenue.paid_invoices).toBe(2);
      expect(result.revenue.partial_invoices).toBe(1);
      expect(result.revenue.draft_invoices).toBe(2);
    });

    it('should not include revenue_note in response', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(mockProject());
      setupEmptyAggregationMocks();

      const result = await service.getFullSummary(TENANT_ID, PROJECT_ID);

      expect((result as any).revenue_note).toBeUndefined();
    });
  });

  // ── Billing coverage & gross revenue margin ────────────────────────

  describe('billing_coverage and gross_margin', () => {
    it('should return null billing_coverage when contract_value is null', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProject({ contract_value: null }),
      );
      setupEmptyAggregationMocks();

      const result = await service.getFullSummary(TENANT_ID, PROJECT_ID);

      expect(result.margin_analysis.billing_coverage).toBeNull();
      expect(result.margin_analysis.gross_margin).toBeNull();
    });

    it('should return null billing_coverage when contract_value is zero', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProject({ contract_value: 0 }),
      );
      setupEmptyAggregationMocks();

      const result = await service.getFullSummary(TENANT_ID, PROJECT_ID);

      expect(result.margin_analysis.billing_coverage).toBeNull();
      // billing_coverage must NEVER be NaN — guards against division by zero
      expect(result.margin_analysis.billing_coverage).not.toBeNaN();
    });

    it('should return null gross_margin when total_collected is zero', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProject({ contract_value: 100000 }),
      );
      setupEmptyAggregationMocks();

      const result = await service.getFullSummary(TENANT_ID, PROJECT_ID);

      expect(result.margin_analysis.gross_margin).toBeNull();
    });

    it('should calculate billing_coverage and gross_margin correctly', async () => {
      mockPrismaService.project.findFirst.mockResolvedValue(
        mockProject({ contract_value: 100000 }),
      );
      setupCostMocks({ confirmed: 60000, pending: 5000 });

      // Override revenue mocks: invoiced 80000, collected 50000
      mockPrismaService.project_invoice.aggregate.mockResolvedValue({
        _sum: { amount: 80000, amount_paid: 50000 },
      });
      mockPrismaService.project_invoice.count
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(2);

      const result = await service.getFullSummary(TENANT_ID, PROJECT_ID);

      // billing_coverage = (80000 / 100000) * 100 = 80%
      expect(result.margin_analysis.billing_coverage).toBe(80);
      // gross_margin = 100000 - 50000 = 50000
      expect(result.margin_analysis.gross_margin).toBe(50000);
    });
  });
});
