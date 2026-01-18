import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TenantEmailConfigService } from './tenant-email-config.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { CommunicationProviderService } from './communication-provider.service';
import { EmailSenderService } from './email-sender.service';

describe('TenantEmailConfigService', () => {
  let service: TenantEmailConfigService;
  let prismaService: jest.Mocked<PrismaService>;
  let encryptionService: jest.Mocked<EncryptionService>;
  let providerService: jest.Mocked<CommunicationProviderService>;
  let emailSender: jest.Mocked<EmailSenderService>;

  const mockProvider = {
    id: 'provider-123',
    provider_key: 'sendgrid',
    provider_name: 'SendGrid',
    provider_type: 'email',
    is_active: true,
    credentials_schema: {},
    config_schema: {},
  };

  const mockConfig = {
    id: 'config-123',
    tenant_id: 'tenant-123',
    provider_id: 'provider-123',
    credentials: 'encrypted-credentials',
    provider_config: {},
    from_email: 'test@example.com',
    from_name: 'Test Company',
    reply_to_email: 'support@example.com',
    webhook_secret: 'secret-123',
    is_active: true,
    is_verified: false,
    created_at: new Date(),
    updated_at: new Date(),
    provider: {
      id: 'provider-123',
      provider_key: 'sendgrid',
      provider_name: 'SendGrid',
      provider_type: 'email',
    },
  };

  beforeEach(async () => {
    const mockPrismaService = {
      tenant_email_config: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn(),
      },
    };

    const mockEncryptionService = {
      encrypt: jest.fn().mockReturnValue('encrypted-data'),
      decrypt: jest.fn().mockReturnValue('decrypted-data'),
    };

    const mockProviderService = {
      getProvider: jest.fn(),
      validateProviderSettings: jest.fn(),
    };

    const mockEmailSender = {
      send: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantEmailConfigService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
        {
          provide: CommunicationProviderService,
          useValue: mockProviderService,
        },
        {
          provide: EmailSenderService,
          useValue: mockEmailSender,
        },
      ],
    }).compile();

    service = module.get<TenantEmailConfigService>(TenantEmailConfigService);
    prismaService = module.get(PrismaService);
    encryptionService = module.get(EncryptionService);
    providerService = module.get(CommunicationProviderService);
    emailSender = module.get(EmailSenderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('should return tenant email config without credentials', async () => {
      (prismaService.tenant_email_config.findUnique as jest.Mock).mockResolvedValue(mockConfig);

      const result = await service.get('tenant-123');

      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('credentials');
      expect(result.from_email).toBe('test@example.com');
    });

    it('should throw NotFoundException if config not found', async () => {
      (prismaService.tenant_email_config.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.get('tenant-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createOrUpdate', () => {
    const createDto = {
      provider_id: 'provider-123',
      credentials: { api_key: 'test-key' },
      provider_config: { click_tracking: false },
      from_email: 'new@example.com',
      from_name: 'New Company',
      reply_to_email: 'support@example.com',
      webhook_secret: 'secret-456',
    };

    it('should create new config if none exists', async () => {
      (providerService.getProvider as jest.Mock).mockResolvedValue(mockProvider);
      (providerService.validateProviderSettings as jest.Mock).mockResolvedValue({
        valid: true,
      });
      (prismaService.tenant_email_config.findUnique as jest.Mock).mockResolvedValue(null);
      (prismaService.tenant_email_config.create as jest.Mock).mockResolvedValue({
        ...mockConfig,
        ...createDto,
        credentials: 'encrypted-data',
      });

      const result = await service.createOrUpdate(
        'tenant-123',
        createDto,
        'user-123',
      );

      expect(result).toBeDefined();
      expect(prismaService.tenant_email_config.create).toHaveBeenCalled();
      expect(encryptionService.encrypt).toHaveBeenCalledWith(
        JSON.stringify(createDto.credentials),
      );
    });

    it('should update existing config', async () => {
      (providerService.getProvider as jest.Mock).mockResolvedValue(mockProvider);
      (providerService.validateProviderSettings as jest.Mock).mockResolvedValue({
        valid: true,
      });
      (prismaService.tenant_email_config.findUnique as jest.Mock).mockResolvedValue(mockConfig);
      (prismaService.tenant_email_config.update as jest.Mock).mockResolvedValue({
        ...mockConfig,
        ...createDto,
      });

      const result = await service.createOrUpdate(
        'tenant-123',
        createDto,
        'user-123',
      );

      expect(result).toBeDefined();
      expect(prismaService.tenant_email_config.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException if provider is not active', async () => {
      const inactiveProvider = { ...mockProvider, is_active: false };
      (providerService.getProvider as jest.Mock).mockResolvedValue(inactiveProvider);

      await expect(
        service.createOrUpdate('tenant-123', createDto, 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if provider is not email type', async () => {
      const smsProvider = { ...mockProvider, provider_type: 'sms' };
      (providerService.getProvider as jest.Mock).mockResolvedValue(smsProvider);

      await expect(
        service.createOrUpdate('tenant-123', createDto, 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if validation fails', async () => {
      (providerService.getProvider as jest.Mock).mockResolvedValue(mockProvider);
      (providerService.validateProviderSettings as jest.Mock).mockResolvedValue({
        valid: false,
        errors: { 'credentials.api_key': 'Invalid API key' },
      });

      await expect(
        service.createOrUpdate('tenant-123', createDto, 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reset is_verified to false on update', async () => {
      (providerService.getProvider as jest.Mock).mockResolvedValue(mockProvider);
      (providerService.validateProviderSettings as jest.Mock).mockResolvedValue({
        valid: true,
      });
      (prismaService.tenant_email_config.findUnique as jest.Mock).mockResolvedValue({
        ...mockConfig,
        is_verified: true,
      });
      (prismaService.tenant_email_config.update as jest.Mock).mockResolvedValue({
        ...mockConfig,
        is_verified: false,
      });

      await service.createOrUpdate('tenant-123', createDto, 'user-123');

      expect(prismaService.tenant_email_config.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            is_verified: false,
          }),
        }),
      );
    });
  });

  describe('sendTestEmail', () => {
    const mockTenant = {
      id: 'tenant-123',
      company_name: 'Test Company',
    };

    beforeEach(() => {
      (prismaService.tenant_email_config.findUnique as jest.Mock).mockResolvedValue({
        ...mockConfig,
        tenant: mockTenant,
      });
    });

    it('should send test email successfully', async () => {
      (emailSender.send as jest.Mock).mockResolvedValue({
        messageId: 'msg-123',
      });
      (prismaService.tenant_email_config.update as jest.Mock).mockResolvedValue(mockConfig);

      const result = await service.sendTestEmail(
        'tenant-123',
        'recipient@example.com',
        'user-123',
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain('successfully');
      expect(emailSender.send).toHaveBeenCalled();
      expect(prismaService.tenant_email_config.update).toHaveBeenCalledWith({
        where: { tenant_id: 'tenant-123' },
        data: { is_verified: true },
      });
    });

    it('should throw NotFoundException if config not found', async () => {
      (prismaService.tenant_email_config.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.sendTestEmail('tenant-123', 'test@example.com', 'user-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if config is not active', async () => {
      (prismaService.tenant_email_config.findUnique as jest.Mock).mockResolvedValue({
        ...mockConfig,
        is_active: false,
        tenant: mockTenant,
      });

      await expect(
        service.sendTestEmail('tenant-123', 'test@example.com', 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should mark as unverified on failure', async () => {
      (emailSender.send as jest.Mock).mockRejectedValue(
        new Error('SMTP connection failed'),
      );
      (prismaService.tenant_email_config.update as jest.Mock).mockResolvedValue(mockConfig);

      await expect(
        service.sendTestEmail('tenant-123', 'test@example.com', 'user-123'),
      ).rejects.toThrow(BadRequestException);

      expect(prismaService.tenant_email_config.update).toHaveBeenCalledWith({
        where: { tenant_id: 'tenant-123' },
        data: { is_verified: false },
      });
    });
  });

  describe('getActiveProvider', () => {
    it('should return active provider config', async () => {
      (prismaService.tenant_email_config.findUnique as jest.Mock).mockResolvedValue(mockConfig);

      const result = await service.getActiveProvider('tenant-123');

      expect(result).toEqual(mockConfig);
    });

    it('should throw NotFoundException if config not found', async () => {
      (prismaService.tenant_email_config.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getActiveProvider('tenant-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if config is inactive', async () => {
      (prismaService.tenant_email_config.findUnique as jest.Mock).mockResolvedValue({
        ...mockConfig,
        is_active: false,
      });

      await expect(service.getActiveProvider('tenant-123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
