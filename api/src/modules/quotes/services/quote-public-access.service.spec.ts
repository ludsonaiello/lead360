import { Test, TestingModule } from '@nestjs/testing';
import { QuotePublicAccessService } from './quote-public-access.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { QuoteVersionService } from './quote-version.service';
import { QuoteService } from './quote.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('QuotePublicAccessService', () => {
  let service: QuotePublicAccessService;
  let prismaService: PrismaService;
  let versionService: QuoteVersionService;
  let quoteService: QuoteService;

  const mockPrismaService = {
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
    quote: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    quote_public_access: {
      findUnique: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    quote_view_log: {
      count: jest.fn(),
    },
  };

  const mockVersionService = {
    createVersion: jest.fn(),
  };

  const mockQuoteService = {
    updateStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotePublicAccessService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: QuoteVersionService,
          useValue: mockVersionService,
        },
        {
          provide: QuoteService,
          useValue: mockQuoteService,
        },
      ],
    }).compile();

    service = module.get<QuotePublicAccessService>(QuotePublicAccessService);
    prismaService = module.get<PrismaService>(PrismaService);
    versionService = module.get<QuoteVersionService>(QuoteVersionService);
    quoteService = module.get<QuoteService>(QuoteService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generatePublicUrl', () => {
    const tenantId = 'tenant-123';
    const quoteId = 'quote-123';
    const userId = 'user-123';
    const mockQuote = {
      id: quoteId,
      tenant_id: tenantId,
      status: 'ready',
      tenant: {
        id: tenantId,
        subdomain: 'testcompany',
      },
    };

    it('should generate public URL successfully for quote without password', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.quote_public_access.findUnique.mockResolvedValue(null);
      mockPrismaService.quote_public_access.updateMany.mockResolvedValue({
        count: 0,
      });
      mockPrismaService.quote_public_access.create.mockResolvedValue({
        id: 'public-access-123',
        access_token: 'abc123def456',
        password_hash: null,
        password_hint: null,
        expires_at: null,
        is_active: true,
        created_at: new Date('2026-01-23T10:00:00Z'),
      });
      mockPrismaService.quote.update.mockResolvedValue({
        ...mockQuote,
        status: 'sent',
      });
      mockVersionService.createVersion.mockResolvedValue(undefined);

      const result = await service.generatePublicUrl(
        tenantId,
        quoteId,
        {},
        userId,
      );

      expect(result).toMatchObject({
        public_url: expect.stringContaining(
          'https://testcompany.lead360.app/quotes/',
        ),
        access_token: expect.any(String),
        has_password: false,
      });
      expect(mockPrismaService.quote.findFirst).toHaveBeenCalledWith({
        where: { id: quoteId, tenant_id: tenantId },
        include: { tenant: true },
      });
      expect(mockPrismaService.quote.update).toHaveBeenCalledWith({
        where: { id: quoteId },
        data: { status: 'sent' },
      });
      expect(mockVersionService.createVersion).toHaveBeenCalledWith(
        quoteId,
        0.1,
        'Status changed to sent (public URL generated)',
        userId,
        expect.anything(),
      );
    });

    it('should generate public URL with password protection', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.quote_public_access.findUnique.mockResolvedValue(null);
      mockPrismaService.quote_public_access.updateMany.mockResolvedValue({
        count: 0,
      });
      mockPrismaService.quote_public_access.create.mockResolvedValue({
        id: 'public-access-123',
        access_token: 'abc123def456',
        password_hash: await bcrypt.hash('testpass123', 10),
        password_hint: 'Your favorite color',
        expires_at: null,
        is_active: true,
        created_at: new Date('2026-01-23T10:00:00Z'),
      });
      mockPrismaService.quote.update.mockResolvedValue({
        ...mockQuote,
        status: 'sent',
      });

      const result = await service.generatePublicUrl(
        tenantId,
        quoteId,
        { password: 'testpass123', password_hint: 'Your favorite color' },
        userId,
      );

      expect(result.has_password).toBe(true);
      expect(result.password_hint).toBe('Your favorite color');
    });

    it('should throw NotFoundException for non-existent quote', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue(null);

      await expect(
        service.generatePublicUrl(tenantId, 'invalid-quote', {}, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for draft quote', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue({
        ...mockQuote,
        status: 'draft',
      });

      await expect(
        service.generatePublicUrl(tenantId, quoteId, {}, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should not change status if quote is already sent', async () => {
      const sentQuote = { ...mockQuote, status: 'sent' };
      mockPrismaService.quote.findFirst.mockResolvedValue(sentQuote);
      mockPrismaService.quote_public_access.findUnique.mockResolvedValue(null);
      mockPrismaService.quote_public_access.updateMany.mockResolvedValue({
        count: 0,
      });
      mockPrismaService.quote_public_access.create.mockResolvedValue({
        id: 'public-access-123',
        access_token: 'abc123def456',
        password_hash: null,
        password_hint: null,
        expires_at: null,
        is_active: true,
        created_at: new Date('2026-01-23T10:00:00Z'),
      });

      await service.generatePublicUrl(tenantId, quoteId, {}, userId);

      expect(mockPrismaService.quote.update).not.toHaveBeenCalled();
    });
  });

  describe('validatePassword', () => {
    const token = 'abc123def456';
    const ipAddress = '192.168.1.1';
    const correctPassword = 'testpass123';
    const wrongPassword = 'wrongpass';

    it('should validate correct password successfully', async () => {
      const passwordHash = await bcrypt.hash(correctPassword, 10);
      mockPrismaService.quote_public_access.findUnique.mockResolvedValue({
        access_token: token,
        password_hash: passwordHash,
        is_active: true,
      });

      const result = await service.validatePassword(
        token,
        correctPassword,
        ipAddress,
      );

      expect(result.valid).toBe(true);
      expect(result.message).toBe('Password is correct');
    });

    it('should reject incorrect password', async () => {
      const passwordHash = await bcrypt.hash(correctPassword, 10);
      mockPrismaService.quote_public_access.findUnique.mockResolvedValue({
        access_token: token,
        password_hash: passwordHash,
        is_active: true,
      });

      const result = await service.validatePassword(
        token,
        wrongPassword,
        ipAddress,
      );

      expect(result.valid).toBe(false);
      expect(result.message).toBe('Incorrect password');
      expect(result.failed_attempts).toBe(1);
    });

    it('should return valid=true if no password is set', async () => {
      mockPrismaService.quote_public_access.findUnique.mockResolvedValue({
        access_token: token,
        password_hash: null,
        is_active: true,
      });

      const result = await service.validatePassword(
        token,
        'anypass',
        ipAddress,
      );

      expect(result.valid).toBe(true);
      expect(result.message).toBe('No password required');
    });

    it('should lock out after 3 failed attempts', async () => {
      const passwordHash = await bcrypt.hash(correctPassword, 10);
      mockPrismaService.quote_public_access.findUnique.mockResolvedValue({
        access_token: token,
        password_hash: passwordHash,
        is_active: true,
      });

      // First 2 failed attempts
      await service.validatePassword(token, wrongPassword, ipAddress);
      await service.validatePassword(token, wrongPassword, ipAddress);

      // Third attempt should trigger lockout
      const result = await service.validatePassword(
        token,
        wrongPassword,
        ipAddress,
      );

      expect(result.valid).toBe(false);
      expect(result.is_locked).toBe(true);
      expect(result.lockout_expires_at).toBeDefined();
      expect(result.message).toContain('Locked out for 15 minutes');
    });

    it('should throw NotFoundException for invalid token', async () => {
      mockPrismaService.quote_public_access.findUnique.mockResolvedValue(null);

      await expect(
        service.validatePassword('invalid-token', 'pass', ipAddress),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivatePublicUrl', () => {
    const tenantId = 'tenant-123';
    const quoteId = 'quote-123';

    it('should deactivate public URL successfully', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue({
        id: quoteId,
        tenant_id: tenantId,
      });
      mockPrismaService.quote_public_access.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.deactivatePublicUrl(tenantId, quoteId);

      expect(result.message).toContain('Successfully deactivated');
      expect(
        mockPrismaService.quote_public_access.updateMany,
      ).toHaveBeenCalledWith({
        where: { quote_id: quoteId, is_active: true },
        data: { is_active: false },
      });
    });

    it('should throw NotFoundException for non-existent quote', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue(null);

      await expect(
        service.deactivatePublicUrl(tenantId, 'invalid-quote'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if no active URL found', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue({
        id: quoteId,
        tenant_id: tenantId,
      });
      mockPrismaService.quote_public_access.updateMany.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.deactivatePublicUrl(tenantId, quoteId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('checkLockout', () => {
    const token = 'abc123def456';
    const ipAddress = '192.168.1.1';

    it('should return not locked for new IP', async () => {
      const result = await service.checkLockout(token, ipAddress);

      expect(result.is_locked).toBe(false);
      expect(result.failed_attempts).toBeUndefined();
    });

    it('should return lockout status if locked', async () => {
      // Simulate 3 failed password attempts to trigger lockout
      const passwordHash = await bcrypt.hash('correct', 10);
      mockPrismaService.quote_public_access.findUnique.mockResolvedValue({
        access_token: token,
        password_hash: passwordHash,
        is_active: true,
      });

      await service.validatePassword(token, 'wrong1', ipAddress);
      await service.validatePassword(token, 'wrong2', ipAddress);
      await service.validatePassword(token, 'wrong3', ipAddress);

      const result = await service.checkLockout(token, ipAddress);

      expect(result.is_locked).toBe(true);
      expect(result.lockout_expires_at).toBeDefined();
    });
  });

  describe('getByToken', () => {
    const token = 'abc123def456';

    it('should return public access record with quote data', async () => {
      const mockPublicAccess = {
        access_token: token,
        is_active: true,
        expires_at: null,
        quote: {
          id: 'quote-123',
          status: 'sent',
          title: 'Test Quote',
        },
      };
      mockPrismaService.quote_public_access.findUnique.mockResolvedValue(
        mockPublicAccess,
      );

      const result = await service.getByToken(token);

      expect(result).toEqual(mockPublicAccess);
    });

    it('should throw NotFoundException for invalid token', async () => {
      mockPrismaService.quote_public_access.findUnique.mockResolvedValue(null);

      await expect(service.getByToken('invalid-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException for inactive link', async () => {
      mockPrismaService.quote_public_access.findUnique.mockResolvedValue({
        access_token: token,
        is_active: false,
        quote: { status: 'sent' },
      });

      await expect(service.getByToken(token)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException for expired link', async () => {
      const pastDate = new Date('2020-01-01');
      mockPrismaService.quote_public_access.findUnique.mockResolvedValue({
        access_token: token,
        is_active: true,
        expires_at: pastDate,
        quote: { status: 'sent' },
      });

      await expect(service.getByToken(token)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException for draft quote', async () => {
      mockPrismaService.quote_public_access.findUnique.mockResolvedValue({
        access_token: token,
        is_active: true,
        expires_at: null,
        quote: { status: 'draft' },
      });

      await expect(service.getByToken(token)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
