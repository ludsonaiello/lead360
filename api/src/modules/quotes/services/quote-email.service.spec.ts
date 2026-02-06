import { Test, TestingModule } from '@nestjs/testing';
import { QuoteEmailService } from './quote-email.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { QuotePdfGeneratorService } from './quote-pdf-generator.service';
import { QuotePublicAccessService } from './quote-public-access.service';
import { QuoteVersionService } from './quote-version.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('QuoteEmailService', () => {
  let service: QuoteEmailService;
  let prisma: PrismaService;
  let pdfService: QuotePdfGeneratorService;
  let publicAccessService: QuotePublicAccessService;

  const mockPrismaService = {
    quote: {
      findFirst: jest.fn(),
    },
  };

  const mockPdfService = {
    generatePdf: jest.fn(),
  };

  const mockPublicAccessService = {
    generatePublicUrl: jest.fn(),
  };

  const mockVersionService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteEmailService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: QuotePdfGeneratorService, useValue: mockPdfService },
        {
          provide: QuotePublicAccessService,
          useValue: mockPublicAccessService,
        },
        { provide: QuoteVersionService, useValue: mockVersionService },
      ],
    }).compile();

    service = module.get<QuoteEmailService>(QuoteEmailService);
    prisma = module.get<PrismaService>(PrismaService);
    pdfService = module.get<QuotePdfGeneratorService>(QuotePdfGeneratorService);
    publicAccessService = module.get<QuotePublicAccessService>(
      QuotePublicAccessService,
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendQuoteEmail', () => {
    const tenantId = 'tenant-123';
    const userId = 'user-123';
    const quoteId = 'quote-123';
    const dto = {
      recipient_email: 'customer@example.com',
    };

    it('should send quote email successfully', async () => {
      const mockQuote = {
        id: quoteId,
        tenant_id: tenantId,
        status: 'ready',
        lead: {
          emails: [{ email: 'lead@example.com', is_primary: true }],
        },
        tenant: {
          company_name: 'Test Company',
        },
      };

      const mockPdfResult = {
        file_id: 'pdf-123',
        download_url: 'https://example.com/pdf',
      };

      const mockPublicUrlResult = {
        public_url: 'https://example.com/public/quote-123',
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPdfService.generatePdf.mockResolvedValue(mockPdfResult);
      mockPublicAccessService.generatePublicUrl.mockResolvedValue(
        mockPublicUrlResult,
      );

      const result = await service.sendQuoteEmail(
        tenantId,
        userId,
        quoteId,
        dto,
      );

      expect(result).toEqual({
        success: true,
        message: expect.stringContaining('prepared successfully'),
        public_url: mockPublicUrlResult.public_url,
        pdf_file_id: mockPdfResult.file_id,
        email_id: 'pending-integration',
      });

      expect(mockPrismaService.quote.findFirst).toHaveBeenCalledWith({
        where: {
          id: quoteId,
          tenant_id: tenantId,
        },
        include: expect.any(Object),
      });
      expect(mockPdfService.generatePdf).toHaveBeenCalledWith(
        tenantId,
        quoteId,
        userId,
      );
      expect(mockPublicAccessService.generatePublicUrl).toHaveBeenCalled();
    });

    it('should throw NotFoundException when quote not found', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue(null);

      await expect(
        service.sendQuoteEmail(tenantId, userId, quoteId, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when quote status is not ready', async () => {
      const mockQuote = {
        id: quoteId,
        tenant_id: tenantId,
        status: 'draft',
        lead: null,
        tenant: {},
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);

      await expect(
        service.sendQuoteEmail(tenantId, userId, quoteId, dto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use lead primary email when recipient_email not provided', async () => {
      const mockQuote = {
        id: quoteId,
        tenant_id: tenantId,
        status: 'ready',
        lead: {
          emails: [{ email: 'lead@example.com', is_primary: true }],
        },
        tenant: {},
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPdfService.generatePdf.mockResolvedValue({ file_id: 'pdf-123' });
      mockPublicAccessService.generatePublicUrl.mockResolvedValue({
        public_url: 'https://example.com/quote',
      });

      const dtoWithoutEmail = {};
      await service.sendQuoteEmail(tenantId, userId, quoteId, dtoWithoutEmail);

      // Should not throw - using lead email
      expect(mockPdfService.generatePdf).toHaveBeenCalled();
    });

    it('should throw BadRequestException when no recipient email found', async () => {
      const mockQuote = {
        id: quoteId,
        tenant_id: tenantId,
        status: 'ready',
        lead: null,
        tenant: {},
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);

      const dtoWithoutEmail = {};
      await expect(
        service.sendQuoteEmail(tenantId, userId, quoteId, dtoWithoutEmail),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('sendQuoteSms', () => {
    it('should return not available message', async () => {
      const result = await service.sendQuoteSms(
        'tenant-123',
        'user-123',
        'quote-123',
        {
          recipient_phone: '555-0000',
        },
      );

      expect(result).toEqual({
        error: 'SMS sending not yet available',
        planned_for: 'Phase 2',
      });
    });
  });
});
