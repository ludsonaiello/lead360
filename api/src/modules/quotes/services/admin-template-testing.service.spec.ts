import { Test, TestingModule } from '@nestjs/testing';
import { AdminTemplateTestingService } from './admin-template-testing.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { QuoteTemplateService } from './quote-template.service';
import { QuotePdfGeneratorService } from './quote-pdf-generator.service';
import { PreviewType } from '../dto/template';

describe('AdminTemplateTestingService', () => {
  let service: AdminTemplateTestingService;
  let prismaService: PrismaService;
  let cacheService: CacheService;
  let templateService: QuoteTemplateService;

  const mockPrismaService = {
    quote_template: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    quote_template_version: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    quote: {
      findUnique: jest.fn(),
    },
  };

  const mockCacheService = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };

  const mockAuditLoggerService = {
    logTenantChange: jest.fn(),
  };

  const mockTemplateService = {
    findOneAdmin: jest.fn(),
  };

  const mockPdfGeneratorService = {
    generatePdf: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminTemplateTestingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
        {
          provide: AuditLoggerService,
          useValue: mockAuditLoggerService,
        },
        {
          provide: QuoteTemplateService,
          useValue: mockTemplateService,
        },
        {
          provide: QuotePdfGeneratorService,
          useValue: mockPdfGeneratorService,
        },
      ],
    }).compile();

    service = module.get<AdminTemplateTestingService>(
      AdminTemplateTestingService,
    );
    prismaService = module.get<PrismaService>(PrismaService);
    cacheService = module.get<CacheService>(CacheService);
    templateService = module.get<QuoteTemplateService>(QuoteTemplateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSampleQuoteData', () => {
    it('should generate minimal sample data', () => {
      const data = service.generateSampleQuoteData(PreviewType.MINIMAL);

      expect(data).toBeDefined();
      expect(data.quote).toBeDefined();
      expect(data.customer).toBeDefined();
      expect(data.vendor).toBeDefined();
      expect(data.items).toHaveLength(3);
      expect(data.totals.total).toBe(10200);
    });

    it('should generate standard sample data', () => {
      const data = service.generateSampleQuoteData(PreviewType.STANDARD);

      expect(data).toBeDefined();
      expect(data.items.length).toBeGreaterThanOrEqual(9);
      expect(data.totals.discount_amount).toBe(500);
      expect(data.totals.total).toBe(13500);
    });

    it('should generate complex sample data', () => {
      const data = service.generateSampleQuoteData(PreviewType.COMPLEX);

      expect(data).toBeDefined();
      expect(data.totals.total).toBe(19000);
    });
  });

  describe('previewTemplate', () => {
    const mockTemplate = {
      id: 'template-123',
      name: 'Test Template',
      html_content: '<div>{{quote.quote_number}}</div>',
      is_global: true,
    };

    beforeEach(() => {
      mockTemplateService.findOneAdmin.mockResolvedValue(mockTemplate);
      mockCacheService.set.mockResolvedValue(undefined);
    });

    it('should preview template with sample data', async () => {
      const result = await service.previewTemplate(
        'template-123',
        PreviewType.MINIMAL,
      );

      expect(result).toBeDefined();
      expect(result.rendered_html).toBeDefined();
      expect(result.preview_url).toContain('template:preview:');
      expect(result.expires_at).toBeDefined();
      expect(mockTemplateService.findOneAdmin).toHaveBeenCalledWith(
        'template-123',
      );
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it('should store preview in cache with 15 minute TTL', async () => {
      await service.previewTemplate('template-123', PreviewType.MINIMAL);

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        900, // 15 minutes in seconds
      );
    });
  });

  describe('validateTemplateSyntax', () => {
    const validTemplate = {
      id: 'template-123',
      name: 'Valid Template',
      html_content:
        '<div>{{quote.quote_number}} {{customer.first_name}} {{vendor.name}} {{totals.total}}</div>',
    };

    const invalidTemplate = {
      id: 'template-456',
      name: 'Invalid Template',
      html_content: '<div>{{#each items}}<span>{{title}</div>{{/each}}', // Unclosed span tag
    };

    beforeEach(() => {
      mockTemplateService.findOneAdmin.mockResolvedValue(validTemplate);
    });

    it('should validate template syntax successfully', async () => {
      const result = await service.validateTemplateSyntax('template-123');

      expect(result).toBeDefined();
      expect(result.is_valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.missing_required_variables).toHaveLength(0);
    });

    it('should detect missing required variables', async () => {
      const templateMissingVars = {
        ...validTemplate,
        html_content: '<div>Some content</div>',
      };
      mockTemplateService.findOneAdmin.mockResolvedValue(templateMissingVars);

      const result = await service.validateTemplateSyntax('template-123');

      expect(result.missing_required_variables.length).toBeGreaterThan(0);
    });
  });

  describe('getTemplateVersionHistory', () => {
    const mockVersions = [
      {
        id: 'version-1',
        template_id: 'template-123',
        version_number: 2,
        html_content: '<div>Version 2</div>',
        changes_summary: 'Updated header',
        created_at: new Date(),
        created_by_user: {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
        },
      },
      {
        id: 'version-2',
        template_id: 'template-123',
        version_number: 1,
        html_content: '<div>Version 1</div>',
        changes_summary: 'Initial version',
        created_at: new Date(),
        created_by_user: {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
        },
      },
    ];

    beforeEach(() => {
      mockTemplateService.findOneAdmin.mockResolvedValue({
        id: 'template-123',
        name: 'Test Template',
      });
      mockPrismaService.quote_template_version.findMany.mockResolvedValue(
        mockVersions,
      );
    });

    it('should return template version history', async () => {
      const result = await service.getTemplateVersionHistory('template-123');

      expect(result).toBeDefined();
      expect(result.template_id).toBe('template-123');
      expect(result.current_version).toBe(2);
      expect(result.versions).toHaveLength(2);
      expect(result.versions[0].version).toBe(2);
      expect(result.versions[1].version).toBe(1);
    });
  });

  describe('createTemplateSnapshot', () => {
    const mockTemplate = {
      id: 'template-123',
      name: 'Test Template',
      html_content: '<div>Template content</div>',
    };

    beforeEach(() => {
      mockPrismaService.quote_template_version.aggregate.mockResolvedValue({
        _max: { version_number: 2 },
      });
      mockPrismaService.quote_template_version.create.mockResolvedValue({
        id: 'version-3',
        template_id: 'template-123',
        version_number: 3,
        html_content: mockTemplate.html_content,
        changes_summary: 'Test snapshot',
      });
    });

    it('should create template version snapshot', async () => {
      const result = await service.createTemplateSnapshot(
        mockTemplate,
        'user-123',
        'Test snapshot',
      );

      expect(result).toBeDefined();
      expect(result.version_number).toBe(3);
      expect(
        mockPrismaService.quote_template_version.create,
      ).toHaveBeenCalled();
    });

    it('should increment version number', async () => {
      await service.createTemplateSnapshot(
        mockTemplate,
        'user-123',
        'Test snapshot',
      );

      expect(
        mockPrismaService.quote_template_version.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            version_number: 3,
          }),
        }),
      );
    });
  });

  describe('restoreTemplateVersion', () => {
    const mockTemplate = {
      id: 'template-123',
      name: 'Test Template',
      html_content: '<div>Current version</div>',
    };

    const mockVersionToRestore = {
      id: 'version-1',
      template_id: 'template-123',
      version_number: 1,
      html_content: '<div>Old version</div>',
    };

    beforeEach(() => {
      mockTemplateService.findOneAdmin.mockResolvedValue(mockTemplate);
      mockPrismaService.quote_template_version.findFirst.mockResolvedValue(
        mockVersionToRestore,
      );
      mockPrismaService.quote_template.update.mockResolvedValue({
        ...mockTemplate,
        html_content: mockVersionToRestore.html_content,
      });
      mockPrismaService.quote_template_version.count.mockResolvedValue(3);
      mockPrismaService.quote_template_version.aggregate.mockResolvedValue({
        _max: { version_number: 2 },
      });
      mockPrismaService.quote_template_version.create.mockResolvedValue({
        id: 'version-3',
        version_number: 3,
      });
    });

    it('should restore template to previous version', async () => {
      const result = await service.restoreTemplateVersion(
        'template-123',
        'user-123',
        1,
        false,
      );

      expect(result).toBeDefined();
      expect(result.message).toContain('restored to version 1');
      expect(result.backup_created).toBe(false);
      expect(mockPrismaService.quote_template.update).toHaveBeenCalledWith({
        where: { id: 'template-123' },
        data: { html_content: '<div>Old version</div>' },
      });
    });

    it('should create backup if requested', async () => {
      const result = await service.restoreTemplateVersion(
        'template-123',
        'user-123',
        1,
        true,
      );

      expect(result.backup_created).toBe(true);
      // First snapshot call for backup, second for restore
      expect(
        mockPrismaService.quote_template_version.create,
      ).toHaveBeenCalledTimes(2);
    });
  });
});
