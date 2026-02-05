import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { AdminOperationsService } from './admin-operations.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CacheService } from '../../../core/cache/cache.service';
import { QuotePricingService } from './quote-pricing.service';
import { QuotePdfGeneratorService } from './quote-pdf-generator.service';
import { FilesService } from '../../files/files.service';

describe('AdminOperationsService', () => {
  let service: AdminOperationsService;
  let prisma: PrismaService;
  let auditLogger: AuditLoggerService;
  let cacheService: CacheService;
  let quotePricingService: QuotePricingService;

  const mockQuote = {
    id: 'quote-123',
    tenant_id: 'tenant-456',
    quote_number: 'Q-2024-001',
    title: 'Test Quote',
    status: 'draft',
    total: 1000.0,
    subtotal: 900.0,
    tax_amount: 100.0,
    discount_amount: 0,
    tenant: {
      id: 'tenant-456',
      company_name: 'Test Company',
    },
    items: [],
    groups: [],
  };

  const mockPrismaService = {
    quote: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    quote_tag_assignment: { deleteMany: jest.fn() },
    quote_attachment: { deleteMany: jest.fn() },
    quote_view_log: { deleteMany: jest.fn() },
    quote_download_log: { deleteMany: jest.fn() },
    quote_approval: { deleteMany: jest.fn() },
    quote_discount_rule: { deleteMany: jest.fn() },
    quote_version: { deleteMany: jest.fn() },
    draw_schedule_entry: { deleteMany: jest.fn() },
    quote_public_access: { deleteMany: jest.fn() },
    quote_note: { deleteMany: jest.fn() },
    quote_item: { deleteMany: jest.fn(), update: jest.fn() },
    quote_group: { deleteMany: jest.fn(), create: jest.fn() },
    email_queue: { count: jest.fn() },
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
  };

  const mockAuditLogger = {
    logTenantChange: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockQuotePricingService = {
    calculateQuoteFinancials: jest.fn(),
  };

  const mockQuotePdfGeneratorService = {};

  const mockFilesService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminOperationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLogger },
        { provide: CacheService, useValue: mockCacheService },
        { provide: QuotePricingService, useValue: mockQuotePricingService },
        {
          provide: QuotePdfGeneratorService,
          useValue: mockQuotePdfGeneratorService,
        },
        { provide: FilesService, useValue: mockFilesService },
      ],
    }).compile();

    service = module.get<AdminOperationsService>(AdminOperationsService);
    prisma = module.get<PrismaService>(PrismaService);
    auditLogger = module.get<AuditLoggerService>(AuditLoggerService);
    cacheService = module.get<CacheService>(CacheService);
    quotePricingService = module.get<QuotePricingService>(QuotePricingService);

    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('hardDeleteQuote', () => {
    it('should throw BadRequestException if confirm flag is false', async () => {
      await expect(
        service.hardDeleteQuote(
          'quote-123',
          'Test reason for deletion',
          false,
          'admin-789',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if quote does not exist', async () => {
      mockPrismaService.quote.findUnique.mockResolvedValue(null);

      await expect(
        service.hardDeleteQuote(
          'quote-123',
          'Test reason for deletion',
          true,
          'admin-789',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if child quotes exist', async () => {
      mockPrismaService.quote.findUnique.mockResolvedValue(mockQuote);
      mockPrismaService.quote.count.mockResolvedValue(2); // 2 child quotes

      await expect(
        service.hardDeleteQuote(
          'quote-123',
          'Test reason for deletion',
          true,
          'admin-789',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should successfully delete quote with all children', async () => {
      mockPrismaService.quote.findUnique.mockResolvedValue(mockQuote);
      mockPrismaService.quote.count.mockResolvedValue(0); // No child quotes
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return await callback(mockPrismaService);
      });
      mockCacheService.del.mockResolvedValue(undefined);

      const result = await service.hardDeleteQuote(
        'quote-123',
        'Test reason for deletion',
        true,
        'admin-789',
        '127.0.0.1',
      );

      expect(result).toEqual({
        message: 'Quote deleted permanently',
        quote_id: 'quote-123',
        tenant_id: 'tenant-456',
        deleted_at: expect.any(String),
        deleted_by: 'admin-789',
        reason: 'Test reason for deletion',
      });

      // Verify audit log was called
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalled();

      // Verify transaction was called
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('bulkUpdateQuoteStatus', () => {
    it('should update multiple quotes successfully', async () => {
      const quoteIds = ['quote-1', 'quote-2', 'quote-3'];
      mockPrismaService.quote.findUnique
        .mockResolvedValueOnce({
          ...mockQuote,
          id: 'quote-1',
          status: 'draft',
        })
        .mockResolvedValueOnce({
          ...mockQuote,
          id: 'quote-2',
          status: 'pending',
        })
        .mockResolvedValueOnce({
          ...mockQuote,
          id: 'quote-3',
          status: 'sent',
        });

      mockPrismaService.quote.update.mockResolvedValue(mockQuote);

      const result = await service.bulkUpdateQuoteStatus(
        quoteIds,
        'approved',
        'Bulk approval after review',
        'admin-789',
      );

      expect(result.updated_count).toBe(3);
      expect(result.failed_count).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockPrismaService.quote.update).toHaveBeenCalledTimes(3);
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure scenarios', async () => {
      const quoteIds = ['quote-1', 'quote-2', 'quote-3'];
      mockPrismaService.quote.findUnique
        .mockResolvedValueOnce({
          ...mockQuote,
          id: 'quote-1',
          status: 'draft',
        })
        .mockResolvedValueOnce(null) // Quote 2 not found
        .mockResolvedValueOnce({
          ...mockQuote,
          id: 'quote-3',
          status: 'sent',
        });

      mockPrismaService.quote.update.mockResolvedValue(mockQuote);

      const result = await service.bulkUpdateQuoteStatus(
        quoteIds,
        'approved',
        'Bulk approval after review',
        'admin-789',
      );

      expect(result.updated_count).toBe(2);
      expect(result.failed_count).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        quote_id: 'quote-2',
        error: 'Quote not found',
      });
    });
  });

  describe('repairQuote', () => {
    it('should throw NotFoundException if quote does not exist', async () => {
      mockPrismaService.quote.findUnique.mockResolvedValue(null);

      await expect(
        service.repairQuote(
          'quote-123',
          'recalculate_totals',
          'Totals are incorrect',
          'admin-789',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should recalculate totals successfully', async () => {
      mockPrismaService.quote.findUnique.mockResolvedValue(mockQuote);
      mockQuotePricingService.calculateQuoteFinancials.mockResolvedValue({
        itemSubtotal: 900.0,
        profitAmount: 50.0,
        overheadAmount: 0,
        contingencyAmount: 0,
        subtotalBeforeDiscounts: 950.0,
        discountAmount: 0,
        subtotalAfterDiscounts: 950.0,
        taxAmount: 95.0,
        total: 1045.0,
        effectivePercentages: {
          profit: 0,
          overhead: 0,
          contingency: 0,
          taxRate: 10,
        },
        discountBreakdown: [],
      });
      mockPrismaService.quote.update.mockResolvedValue({
        ...mockQuote,
        subtotal: 950.0,
        tax_amount: 95.0,
        total: 1045.0,
      });

      const result = await service.repairQuote(
        'quote-123',
        'recalculate_totals',
        'Totals were incorrect',
        'admin-789',
      );

      expect(result.message).toBe('Quote repaired successfully');
      expect(result.repairs_made).toContain('Recalculated subtotal');
      expect(result.repairs_made).toContain('Recalculated tax');
      expect(result.repairs_made).toContain('Recalculated total');
      expect(mockQuotePricingService.calculateQuoteFinancials).toHaveBeenCalled();
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalled();
    });

    it('should fix orphaned relationships', async () => {
      const quoteWithOrphanedItems = {
        ...mockQuote,
        items: [
          {
            id: 'item-1',
            quote_group_id: 'non-existent-group',
          },
        ],
        groups: [],
      };

      mockPrismaService.quote.findUnique.mockResolvedValue(
        quoteWithOrphanedItems,
      );
      mockPrismaService.quote_group.create.mockResolvedValue({
        id: 'default-group-id',
        name: 'Default',
      });
      mockPrismaService.quote_item.update.mockResolvedValue({});

      const result = await service.repairQuote(
        'quote-123',
        'fix_relationships',
        undefined,
        'admin-789',
      );

      expect(result.message).toBe('Quote repaired successfully');
      expect(result.repairs_made).toContain('Created default group');
      expect(mockPrismaService.quote_group.create).toHaveBeenCalled();
      expect(mockPrismaService.quote_item.update).toHaveBeenCalled();
    });
  });

  describe('runDiagnostics', () => {
    it('should run all diagnostic tests', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([]);
      mockCacheService.set.mockResolvedValue(undefined);
      mockCacheService.get.mockResolvedValue({ test: true });
      mockCacheService.del.mockResolvedValue(undefined);
      mockPrismaService.email_queue.count.mockResolvedValue(5);

      const result = await service.runDiagnostics('all');

      expect(result.test_suite).toBe('All Systems');
      expect(result.tests_run).toBeGreaterThan(0);
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
    });

    it('should run specific diagnostic test (database)', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([]);

      const result = await service.runDiagnostics('database');

      expect(result.test_suite).toBe('DATABASE');
      expect(result.tests_run).toBe(1);
      expect(result.results[0].test_name).toBe('Database Connectivity');
      expect(result.results[0].status).toBe('pass');
    });

    it('should handle failed diagnostic tests', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(
        new Error('Connection failed'),
      );

      const result = await service.runDiagnostics('database');

      expect(result.passed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.results[0].status).toBe('fail');
      expect(result.results[0].error_message).toBe('Connection failed');
    });
  });

  describe('cleanupOrphans', () => {
    it('should count orphans in dry run mode', async () => {
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([{ id: 'orphan-1' }, { id: 'orphan-2' }]) // items
        .mockResolvedValueOnce([{ id: 'orphan-3' }]) // groups
        .mockResolvedValueOnce([]); // attachments

      const result = await service.cleanupOrphans('all', true);

      expect(result.dry_run).toBe(true);
      expect(result.orphans_found).toBe(3);
      expect(result.orphans_deleted).toBe(0);
      expect(result.details).toHaveLength(3);
      expect(mockPrismaService.quote_item.deleteMany).not.toHaveBeenCalled();
    });

    it('should delete orphans when dry run is false', async () => {
      mockPrismaService.$queryRaw
        .mockResolvedValueOnce([{ id: 'orphan-1' }, { id: 'orphan-2' }]) // items
        .mockResolvedValueOnce([]) // groups
        .mockResolvedValueOnce([]); // attachments

      mockPrismaService.quote_item.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.cleanupOrphans('items', false);

      expect(result.dry_run).toBe(false);
      expect(result.orphans_found).toBe(2);
      expect(result.orphans_deleted).toBe(2);
      expect(mockPrismaService.quote_item.deleteMany).toHaveBeenCalled();
    });

    it('should handle specific entity type cleanup', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([
        { id: 'orphan-1' },
      ]);

      const result = await service.cleanupOrphans('groups', true);

      expect(result.details).toHaveLength(1);
      expect(result.details[0].entity_type).toBe('quote_group');
    });
  });

  describe('listQuotesCrossTenant', () => {
    const mockQuotes = [
      {
        id: 'quote-1',
        quote_number: 'Q-2024-001',
        title: 'Quote 1',
        status: 'approved',
        total: 1000.0,
        created_at: new Date('2024-01-15'),
        customer_name: 'Customer A',
        tenant: {
          id: 'tenant-1',
          company_name: 'Company A',
          subdomain: 'company-a',
        },
      },
      {
        id: 'quote-2',
        quote_number: 'Q-2024-002',
        title: 'Quote 2',
        status: 'sent',
        total: 2000.0,
        created_at: new Date('2024-01-16'),
        customer_name: 'Customer B',
        tenant: {
          id: 'tenant-2',
          company_name: 'Company B',
          subdomain: 'company-b',
        },
      },
    ];

    it('should list quotes from all tenants', async () => {
      mockPrismaService.quote.count.mockResolvedValue(2);
      mockPrismaService.quote.findMany.mockResolvedValue(mockQuotes);

      const result = await service.listQuotesCrossTenant(
        {},
        { page: 1, limit: 50 },
      );

      expect(result.quotes).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(result.quotes[0].tenant).toBeDefined();
    });

    it('should filter quotes by tenant_id', async () => {
      const filteredQuotes = [mockQuotes[0]];
      mockPrismaService.quote.count.mockResolvedValue(1);
      mockPrismaService.quote.findMany.mockResolvedValue(filteredQuotes);

      const result = await service.listQuotesCrossTenant(
        { tenantId: 'tenant-1' },
        { page: 1, limit: 50 },
      );

      expect(result.quotes).toHaveLength(1);
      expect(result.quotes[0].tenant.id).toBe('tenant-1');
    });

    it('should filter quotes by status', async () => {
      const filteredQuotes = [mockQuotes[0]];
      mockPrismaService.quote.count.mockResolvedValue(1);
      mockPrismaService.quote.findMany.mockResolvedValue(filteredQuotes);

      const result = await service.listQuotesCrossTenant(
        { status: 'approved' },
        { page: 1, limit: 50 },
      );

      expect(result.quotes).toHaveLength(1);
      expect(result.quotes[0].status).toBe('approved');
    });

    it('should search quotes by quote number or customer name', async () => {
      mockPrismaService.quote.count.mockResolvedValue(1);
      mockPrismaService.quote.findMany.mockResolvedValue([mockQuotes[0]]);

      const result = await service.listQuotesCrossTenant(
        { search: 'Q-2024-001' },
        { page: 1, limit: 50 },
      );

      expect(result.quotes).toHaveLength(1);
      expect(result.quotes[0].quote_number).toContain('2024-001');
    });

    it('should paginate results correctly', async () => {
      mockPrismaService.quote.count.mockResolvedValue(100);
      mockPrismaService.quote.findMany.mockResolvedValue(mockQuotes);

      const result = await service.listQuotesCrossTenant(
        {},
        { page: 2, limit: 50 },
      );

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(50);
      expect(result.pagination.total).toBe(100);
      expect(result.pagination.total_pages).toBe(2);
    });
  });
});
