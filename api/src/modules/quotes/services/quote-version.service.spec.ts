import { Test, TestingModule } from '@nestjs/testing';
import { QuoteVersionService } from './quote-version.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('QuoteVersionService', () => {
  let service: QuoteVersionService;
  let prisma: PrismaService;

  const mockPrismaService = {
    quote: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    quote_version: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteVersionService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<QuoteVersionService>(QuoteVersionService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createInitialVersion', () => {
    it('should create version 1.0 for new quote', async () => {
      const quoteId = 'quote-123';
      const quoteData = { title: 'Test Quote' };

      const mockQuote = {
        id: quoteId,
        title: 'Test Quote',
        status: 'draft',
        subtotal: new Decimal(1000),
        tax_amount: new Decimal(80),
        total: new Decimal(1080),
        items: [],
        groups: [],
        discount_rules: [],
        draw_schedule: [],
      };

      mockPrismaService.quote.findUnique.mockResolvedValue(mockQuote);
      mockPrismaService.quote_version.create.mockResolvedValue({
        id: 'version-123',
        quote_id: quoteId,
        version_number: new Decimal(1.0),
      });

      await service.createInitialVersion(quoteId, quoteData);

      expect(mockPrismaService.quote_version.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          quote_id: quoteId,
          version_number: expect.any(Decimal),
          change_description: 'Initial version',
          snapshot_data: expect.any(String),
        }),
      });
    });

    it('should create snapshot with all quote data', async () => {
      const quoteId = 'quote-123';
      const quoteData = {};

      const mockQuote = {
        id: quoteId,
        title: 'Test Quote',
        jobsite_address: {
          address_line1: '123 Test St',
          city: 'Miami',
          state: 'FL',
        },
        items: [
          {
            id: 'item-1',
            title: 'Test Item',
            quantity: new Decimal(10),
          },
        ],
        groups: [],
        discount_rules: [],
        draw_schedule: [],
        subtotal: new Decimal(1000),
        tax_amount: new Decimal(80),
        total: new Decimal(1080),
      };

      mockPrismaService.quote.findUnique.mockResolvedValue(mockQuote);
      mockPrismaService.quote_version.create.mockResolvedValue({});

      await service.createInitialVersion(quoteId, quoteData);

      const createCall = mockPrismaService.quote_version.create.mock.calls[0][0];
      const snapshotData = JSON.parse(createCall.data.snapshot_data);

      expect(snapshotData.quote).toBeDefined();
      expect(snapshotData.quote.title).toBe('Test Quote');
      expect(snapshotData.jobsite_address).toBeDefined();
    });
  });

  describe('createVersion', () => {
    it('should create incremental version', async () => {
      const quoteId = 'quote-123';
      const userId = 'user-123';
      const increment = 0.1;
      const changeDescription = 'Updated pricing';

      const mockQuote = {
        id: quoteId,
        active_version_number: new Decimal(1.0),
        subtotal: new Decimal(1000),
        tax_amount: new Decimal(80),
        total: new Decimal(1080),
        items: [],
        groups: [],
        discount_rules: [],
        draw_schedule: [],
      };

      mockPrismaService.quote.findUnique.mockResolvedValue(mockQuote);
      mockPrismaService.quote_version.create.mockResolvedValue({});
      mockPrismaService.quote.update.mockResolvedValue({});

      await service.createVersion(quoteId, increment, changeDescription, userId);

      expect(mockPrismaService.quote_version.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          quote_id: quoteId,
          version_number: expect.any(Decimal),
          change_description: changeDescription,
        }),
      });

      expect(mockPrismaService.quote.update).toHaveBeenCalledWith({
        where: { id: quoteId },
        data: { active_version_number: expect.any(Decimal) },
      });
    });

    it('should increment version number correctly (minor)', async () => {
      const quoteId = 'quote-123';
      const mockQuote = {
        id: quoteId,
        active_version_number: new Decimal(1.0),
        items: [],
        groups: [],
        discount_rules: [],
        draw_schedule: [],
        subtotal: new Decimal(1000),
        tax_amount: new Decimal(80),
        total: new Decimal(1080),
      };

      mockPrismaService.quote.findUnique.mockResolvedValue(mockQuote);
      mockPrismaService.quote_version.create.mockResolvedValue({});
      mockPrismaService.quote.update.mockResolvedValue({});

      await service.createVersion(quoteId, 0.1, 'Minor change', 'user-123');

      const updateCall = mockPrismaService.quote.update.mock.calls[0][0];
      expect(Number(updateCall.data.active_version_number)).toBe(1.1);
    });

    it('should increment version number correctly (major)', async () => {
      const quoteId = 'quote-123';
      const mockQuote = {
        id: quoteId,
        active_version_number: new Decimal(1.5),
        items: [],
        groups: [],
        discount_rules: [],
        draw_schedule: [],
        subtotal: new Decimal(1000),
        tax_amount: new Decimal(80),
        total: new Decimal(1080),
      };

      mockPrismaService.quote.findUnique.mockResolvedValue(mockQuote);
      mockPrismaService.quote_version.create.mockResolvedValue({});
      mockPrismaService.quote.update.mockResolvedValue({});

      await service.createVersion(quoteId, 1.0, 'Major change', 'user-123');

      const updateCall = mockPrismaService.quote.update.mock.calls[0][0];
      expect(Number(updateCall.data.active_version_number)).toBe(3.0); // Rounds up to next major
    });

    it('should throw error when quote not found', async () => {
      mockPrismaService.quote.findUnique.mockResolvedValue(null);

      await expect(
        service.createVersion('invalid-id', 0.1, 'Change', 'user-123'),
      ).rejects.toThrow('Quote not found');
    });
  });

  describe('buildSnapshot', () => {
    it('should build complete snapshot with all relationships', async () => {
      const quoteId = 'quote-123';
      const mockQuote = {
        id: quoteId,
        title: 'Complete Quote',
        subtotal: new Decimal(5000),
        tax_amount: new Decimal(400),
        discount_amount: new Decimal(100),
        total: new Decimal(5300),
        active_version_number: new Decimal(1.0),
        jobsite_address: {
          address_line1: '123 Main St',
          city: 'Miami',
          state: 'FL',
        },
        vendor: {
          id: 'vendor-1',
          business_name: 'Test Vendor',
        },
        lead: {
          id: 'lead-1',
          first_name: 'John',
          last_name: 'Doe',
        },
        items: [
          {
            id: 'item-1',
            title: 'Item 1',
            quantity: new Decimal(10),
            total_cost: new Decimal(1000),
          },
        ],
        groups: [
          {
            id: 'group-1',
            name: 'Group 1',
            items: [],
          },
        ],
        discount_rules: [
          {
            id: 'discount-1',
            rule_type: 'percentage',
            value: new Decimal(10),
          },
        ],
        draw_schedule: [
          {
            id: 'draw-1',
            draw_number: 1,
            amount: new Decimal(1000),
          },
        ],
      };

      mockPrismaService.quote.findUnique.mockResolvedValue(mockQuote);

      const snapshot = await service.buildSnapshot(quoteId, mockPrismaService);

      expect(snapshot.quote).toBeDefined();
      expect(snapshot.quote.title).toBe('Complete Quote');
      expect(snapshot.jobsite_address).toBeDefined();
      expect(snapshot.vendor).toBeDefined();
      expect(snapshot.lead).toBeDefined();
      expect(snapshot.items).toHaveLength(1);
      expect(snapshot.groups).toHaveLength(1);
      expect(snapshot.discount_rules).toHaveLength(1);
      expect(snapshot.draw_schedule).toHaveLength(1);
    });

    it('should convert Decimal fields to numbers for JSON', async () => {
      const quoteId = 'quote-123';
      const mockQuote = {
        id: quoteId,
        subtotal: new Decimal(1000.50),
        tax_amount: new Decimal(80.04),
        total: new Decimal(1080.54),
        active_version_number: new Decimal(1.0),
        items: [],
        groups: [],
        discount_rules: [],
        draw_schedule: [],
      };

      mockPrismaService.quote.findUnique.mockResolvedValue(mockQuote);

      const snapshot = await service.buildSnapshot(quoteId, mockPrismaService);

      expect(typeof snapshot.quote.subtotal).toBe('number');
      expect(typeof snapshot.quote.tax_amount).toBe('number');
      expect(typeof snapshot.quote.total).toBe('number');
      expect(snapshot.quote.subtotal).toBe(1000.50);
    });
  });

  describe('getVersionHistory', () => {
    it('should retrieve all versions for a quote', async () => {
      const quoteId = 'quote-123';
      const mockVersions = [
        {
          id: 'version-1',
          version_number: new Decimal(1.0),
          change_description: 'Initial version',
          snapshot_data: JSON.stringify({ quote: { title: 'Test' }, items: [] }),
          created_at: new Date('2024-01-01'),
        },
        {
          id: 'version-2',
          version_number: new Decimal(1.1),
          change_description: 'Updated pricing',
          snapshot_data: JSON.stringify({ quote: { title: 'Test Updated' }, items: [] }),
          created_at: new Date('2024-01-02'),
        },
      ];

      mockPrismaService.quote_version.findMany.mockResolvedValue(mockVersions);

      const result = await service.getVersionHistory(quoteId);

      expect(result).toHaveLength(2);
      expect(result[0].snapshot_data).toBeDefined();
      expect(result[0].snapshot_data.quote).toBeDefined();
      expect(mockPrismaService.quote_version.findMany).toHaveBeenCalledWith({
        where: { quote_id: quoteId },
        orderBy: { created_at: 'desc' },
      });
    });
  });

  describe('calculateNewVersion', () => {
    it('should calculate minor version increment (0.1)', () => {
      const result = service['calculateNewVersion'](1.0, 0.1);
      expect(result).toBe(1.1);
    });

    it('should calculate major version increment (1.0)', () => {
      const result = service['calculateNewVersion'](1.5, 1.0);
      expect(result).toBe(3.0); // Rounds up to next major version
    });

    it('should handle decimal precision correctly', () => {
      const result = service['calculateNewVersion'](1.9, 0.1);
      expect(result).toBeCloseTo(2.0, 1);
    });

    it('should round to one decimal place', () => {
      const result = service['calculateNewVersion'](1.0, 0.15);
      expect(result).toBe(1.2); // Rounded to 1 decimal
    });
  });
});
