import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CommunicationProviderService } from './communication-provider.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { JsonSchemaValidatorService } from './json-schema-validator.service';

describe('CommunicationProviderService', () => {
  let service: CommunicationProviderService;
  let prismaService: jest.Mocked<PrismaService>;
  let validatorService: jest.Mocked<JsonSchemaValidatorService>;

  const mockProvider = {
    id: 'provider-123',
    provider_key: 'sendgrid',
    provider_name: 'SendGrid',
    provider_type: 'email',
    credentials_schema: {
      type: 'object',
      properties: {
        api_key: { type: 'string' },
      },
      required: ['api_key'],
    },
    config_schema: {
      type: 'object',
      properties: {
        click_tracking: { type: 'boolean' },
      },
    },
    default_config: { click_tracking: false },
    supports_webhooks: true,
    webhook_events: ['delivered', 'bounced'],
    webhook_verification_method: 'signature',
    documentation_url: 'https://docs.sendgrid.com',
    logo_url: null,
    is_active: true,
    is_system: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      communication_provider: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      platform_email_config: {
        count: jest.fn(),
      },
      tenant_email_config: {
        count: jest.fn(),
      },
      communication_event: {
        count: jest.fn(),
      },
    };

    const mockValidatorService = {
      validate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunicationProviderService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JsonSchemaValidatorService,
          useValue: mockValidatorService,
        },
      ],
    }).compile();

    service = module.get<CommunicationProviderService>(
      CommunicationProviderService,
    );
    prismaService = module.get(PrismaService);
    validatorService = module.get(JsonSchemaValidatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getActiveProviders', () => {
    it('should return all active providers', async () => {
      const providers = [mockProvider];
      (
        prismaService.communication_provider.findMany as jest.Mock
      ).mockResolvedValue(providers);

      const result = await service.getActiveProviders();

      expect(result).toEqual(providers);
      expect(
        prismaService.communication_provider.findMany,
      ).toHaveBeenCalledWith({
        where: { is_active: true },
        orderBy: { provider_name: 'asc' },
      });
    });

    it('should filter providers by type', async () => {
      const providers = [mockProvider];
      (
        prismaService.communication_provider.findMany as jest.Mock
      ).mockResolvedValue(providers);

      const result = await service.getActiveProviders('email');

      expect(result).toEqual(providers);
      expect(
        prismaService.communication_provider.findMany,
      ).toHaveBeenCalledWith({
        where: {
          is_active: true,
          provider_type: 'email',
        },
        orderBy: { provider_name: 'asc' },
      });
    });
  });

  describe('getProvider', () => {
    it('should return provider by key', async () => {
      (
        prismaService.communication_provider.findUnique as jest.Mock
      ).mockResolvedValue(mockProvider);

      const result = await service.getProvider('sendgrid');

      expect(result).toEqual(mockProvider);
      expect(
        prismaService.communication_provider.findUnique,
      ).toHaveBeenCalledWith({
        where: { provider_key: 'sendgrid' },
      });
    });

    it('should throw NotFoundException if provider not found', async () => {
      (
        prismaService.communication_provider.findUnique as jest.Mock
      ).mockResolvedValue(null);

      await expect(service.getProvider('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('validateProviderCredentials', () => {
    it('should validate credentials successfully', async () => {
      const credentials = { api_key: 'test-key' };
      (validatorService.validate as jest.Mock).mockReturnValue({ valid: true });

      const result = await service.validateProviderCredentials(
        mockProvider as any,
        credentials,
      );

      expect(result.valid).toBe(true);
      expect(validatorService.validate).toHaveBeenCalledWith(
        mockProvider.credentials_schema,
        credentials,
      );
    });

    it('should return validation errors', async () => {
      const credentials = {};
      const errors = [{ field: 'api_key', message: 'Required field' }];
      (validatorService.validate as jest.Mock).mockReturnValue({
        valid: false,
        errors,
      });

      const result = await service.validateProviderCredentials(
        mockProvider as any,
        credentials,
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(errors);
    });

    it('should throw BadRequestException if no credentials schema', async () => {
      const providerWithoutSchema = {
        ...mockProvider,
        credentials_schema: null,
      };

      await expect(
        service.validateProviderCredentials(providerWithoutSchema as any, {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('validateProviderConfig', () => {
    it('should validate config successfully', async () => {
      const config = { click_tracking: true };
      (validatorService.validate as jest.Mock).mockReturnValue({ valid: true });

      const result = await service.validateProviderConfig(
        mockProvider as any,
        config,
      );

      expect(result.valid).toBe(true);
    });

    it('should return valid if no config schema', async () => {
      const providerWithoutConfigSchema = {
        ...mockProvider,
        config_schema: null,
      };

      const result = await service.validateProviderConfig(
        providerWithoutConfigSchema as any,
        {},
      );

      expect(result.valid).toBe(true);
    });
  });

  describe('validateProviderSettings', () => {
    it('should validate both credentials and config', async () => {
      const credentials = { api_key: 'test-key' };
      const config = { click_tracking: true };
      (validatorService.validate as jest.Mock).mockReturnValue({ valid: true });

      const result = await service.validateProviderSettings(
        mockProvider as any,
        credentials,
        config,
      );

      expect(result.valid).toBe(true);
      expect(validatorService.validate).toHaveBeenCalledTimes(2);
    });

    it('should return combined errors from credentials and config', async () => {
      const credentials = {};
      const config = {};
      (validatorService.validate as jest.Mock)
        .mockReturnValueOnce({
          valid: false,
          errors: [{ field: 'api_key', message: 'Required' }],
        })
        .mockReturnValueOnce({
          valid: false,
          errors: [{ field: 'click_tracking', message: 'Invalid' }],
        });

      const result = await service.validateProviderSettings(
        mockProvider as any,
        credentials,
        config,
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual({
        'credentials.api_key': 'Required',
        'provider_config.click_tracking': 'Invalid',
      });
    });
  });

  describe('toggleProviderStatus', () => {
    it('should toggle provider active status', async () => {
      const userProvider = { ...mockProvider, is_system: false };
      (
        prismaService.communication_provider.findUnique as jest.Mock
      ).mockResolvedValue(userProvider);
      (
        prismaService.communication_provider.update as jest.Mock
      ).mockResolvedValue({
        ...userProvider,
        is_active: false,
      });

      const result = await service.toggleProviderStatus('custom');

      expect(result.is_active).toBe(false);
      expect(prismaService.communication_provider.update).toHaveBeenCalledWith({
        where: { provider_key: 'custom' },
        data: { is_active: false },
      });
    });

    it('should not allow deactivating system providers', async () => {
      const systemProvider = {
        ...mockProvider,
        is_system: true,
        is_active: true,
      };
      (
        prismaService.communication_provider.findUnique as jest.Mock
      ).mockResolvedValue(systemProvider);

      await expect(service.toggleProviderStatus('sendgrid')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('deleteProvider', () => {
    it('should not allow deleting system providers', async () => {
      (
        prismaService.communication_provider.findUnique as jest.Mock
      ).mockResolvedValue(mockProvider);

      await expect(service.deleteProvider('sendgrid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should not allow deleting providers in use', async () => {
      const userProvider = { ...mockProvider, is_system: false };
      (
        prismaService.communication_provider.findUnique as jest.Mock
      ).mockResolvedValue(userProvider);
      (
        prismaService.platform_email_config.count as jest.Mock
      ).mockResolvedValue(1);
      (prismaService.tenant_email_config.count as jest.Mock).mockResolvedValue(
        0,
      );

      await expect(service.deleteProvider('custom')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should delete provider if not system and not in use', async () => {
      const userProvider = { ...mockProvider, is_system: false };
      (
        prismaService.communication_provider.findUnique as jest.Mock
      ).mockResolvedValue(userProvider);
      (
        prismaService.platform_email_config.count as jest.Mock
      ).mockResolvedValue(0);
      (prismaService.tenant_email_config.count as jest.Mock).mockResolvedValue(
        0,
      );

      await service.deleteProvider('custom');

      expect(prismaService.communication_provider.delete).toHaveBeenCalledWith({
        where: { provider_key: 'custom' },
      });
    });
  });

  describe('getProviderStats', () => {
    it('should return provider statistics', async () => {
      (
        prismaService.communication_provider.findUnique as jest.Mock
      ).mockResolvedValue(mockProvider);
      (
        prismaService.platform_email_config.count as jest.Mock
      ).mockResolvedValue(1);
      (prismaService.tenant_email_config.count as jest.Mock).mockResolvedValue(
        5,
      );
      (prismaService.communication_event.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(10);

      const result = await service.getProviderStats('sendgrid');

      expect(result).toEqual({
        provider: mockProvider,
        platform_configs: 1,
        tenant_configs: 5,
        total_events: 100,
        events_last_24h: 10,
      });
    });
  });
});
