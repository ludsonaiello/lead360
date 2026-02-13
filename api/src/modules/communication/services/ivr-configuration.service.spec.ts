import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IvrConfigurationService } from './ivr-configuration.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { CreateIvrConfigDto } from '../dto/ivr/create-ivr-config.dto';

/**
 * IvrConfigurationService Unit Tests
 *
 * Test Coverage:
 * - ✅ Create/Update IVR configuration (upsert pattern)
 * - ✅ Get IVR configuration
 * - ✅ Delete (soft delete) IVR configuration
 * - ✅ Generate IVR menu TwiML
 * - ✅ Execute IVR action (valid digit)
 * - ✅ Execute IVR action (invalid digit)
 * - ✅ Execute default action
 * - ✅ Menu options validation (duplicates, invalid digits, invalid actions)
 * - ✅ Phone number validation (E.164 format)
 * - ✅ Webhook URL validation (HTTPS only)
 * - ✅ Error handling
 *
 * Mocking Strategy:
 * - PrismaService: Mocked for database operations
 * - ConfigService: Mocked for API_BASE_URL
 * - No external dependencies (Twilio SDK used internally)
 */
describe('IvrConfigurationService', () => {
  let service: IvrConfigurationService;
  let prisma: jest.Mocked<PrismaService>;
  let config: jest.Mocked<ConfigService>;

  // Mock tenant ID for testing
  const mockTenantId = 'tenant-123-456';

  // Mock IVR configuration data
  const mockIvrConfig = {
    id: 'ivr-config-123',
    tenant_id: mockTenantId,
    twilio_config_id: null,
    ivr_enabled: true,
    greeting_message: 'Thank you for calling ABC Company.',
    menu_options: [
      {
        digit: '1',
        action: 'route_to_number',
        label: 'Sales Department',
        config: { phone_number: '+19781234567' },
      },
      {
        digit: '2',
        action: 'voicemail',
        label: 'Leave a message',
        config: { max_duration_seconds: 180 },
      },
    ],
    default_action: {
      action: 'voicemail',
      config: { max_duration_seconds: 180 },
    },
    timeout_seconds: 10,
    max_retries: 3,
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    // Create mock Prisma service
    const mockPrismaService = {
      ivr_configuration: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    // Create mock Config service
    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'API_BASE_URL') {
          return 'https://api.lead360.app';
        }
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IvrConfigurationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<IvrConfigurationService>(IvrConfigurationService);
    prisma = module.get(PrismaService);
    config = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrUpdate', () => {
    const validDto: CreateIvrConfigDto = {
      ivr_enabled: true,
      greeting_message: 'Thank you for calling ABC Company.',
      menu_options: [
        {
          digit: '1',
          action: 'route_to_number',
          label: 'Sales Department',
          config: { phone_number: '+19781234567' },
        },
      ],
      default_action: {
        action: 'voicemail',
        config: { max_duration_seconds: 180 },
      },
      timeout_seconds: 10,
      max_retries: 3,
    };

    it('should create new IVR configuration if none exists', async () => {
      prisma.ivr_configuration.findUnique.mockResolvedValue(null);
      prisma.ivr_configuration.create.mockResolvedValue(mockIvrConfig);

      const result = await service.createOrUpdate(mockTenantId, validDto);

      expect(prisma.ivr_configuration.findUnique).toHaveBeenCalledWith({
        where: { tenant_id: mockTenantId },
      });
      expect(prisma.ivr_configuration.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: mockTenantId,
          ivr_enabled: validDto.ivr_enabled,
          greeting_message: validDto.greeting_message,
          status: 'active',
        }),
      });
      expect(result).toEqual(mockIvrConfig);
    });

    it('should update existing IVR configuration', async () => {
      prisma.ivr_configuration.findUnique.mockResolvedValue(mockIvrConfig);
      prisma.ivr_configuration.update.mockResolvedValue({
        ...mockIvrConfig,
        greeting_message: 'Updated greeting',
      });

      const updatedDto = { ...validDto, greeting_message: 'Updated greeting' };
      const result = await service.createOrUpdate(mockTenantId, updatedDto);

      expect(prisma.ivr_configuration.findUnique).toHaveBeenCalled();
      expect(prisma.ivr_configuration.update).toHaveBeenCalledWith({
        where: { tenant_id: mockTenantId },
        data: expect.objectContaining({
          greeting_message: 'Updated greeting',
        }),
      });
      expect(result.greeting_message).toBe('Updated greeting');
    });

    it('should reject duplicate digits in menu options', async () => {
      const dtoWithDuplicates: CreateIvrConfigDto = {
        ...validDto,
        menu_options: [
          {
            digit: '1',
            action: 'route_to_number',
            label: 'Sales',
            config: { phone_number: '+19781234567' },
          },
          {
            digit: '1', // Duplicate
            action: 'voicemail',
            label: 'Voicemail',
            config: { max_duration_seconds: 180 },
          },
        ],
      };

      await expect(
        service.createOrUpdate(mockTenantId, dtoWithDuplicates),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createOrUpdate(mockTenantId, dtoWithDuplicates),
      ).rejects.toThrow(/Duplicate digits found/);
    });

    it('should reject invalid phone number format', async () => {
      const dtoWithInvalidPhone: CreateIvrConfigDto = {
        ...validDto,
        menu_options: [
          {
            digit: '1',
            action: 'route_to_number',
            label: 'Sales',
            config: { phone_number: '9781234567' }, // Missing +1
          },
        ],
      };

      await expect(
        service.createOrUpdate(mockTenantId, dtoWithInvalidPhone),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createOrUpdate(mockTenantId, dtoWithInvalidPhone),
      ).rejects.toThrow(/E.164 format/);
    });

    it('should reject non-HTTPS webhook URLs', async () => {
      const dtoWithHttpWebhook: CreateIvrConfigDto = {
        ...validDto,
        menu_options: [
          {
            digit: '1',
            action: 'trigger_webhook',
            label: 'Webhook',
            config: { webhook_url: 'http://example.com/webhook' }, // HTTP not HTTPS
          },
        ],
      };

      await expect(
        service.createOrUpdate(mockTenantId, dtoWithHttpWebhook),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createOrUpdate(mockTenantId, dtoWithHttpWebhook),
      ).rejects.toThrow(/must use HTTPS/);
    });

    it('should reject menu options with > 10 items', async () => {
      const dtoWithTooManyOptions: CreateIvrConfigDto = {
        ...validDto,
        menu_options: Array.from({ length: 11 }, (_, i) => ({
          digit: String(i % 10),
          action: 'voicemail' as const,
          label: `Option ${i}`,
          config: { max_duration_seconds: 180 },
        })),
      };

      await expect(
        service.createOrUpdate(mockTenantId, dtoWithTooManyOptions),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createOrUpdate(mockTenantId, dtoWithTooManyOptions),
      ).rejects.toThrow(/between 1 and 10/);
    });

    it('should reject invalid digits (not 0-9)', async () => {
      const dtoWithInvalidDigit: CreateIvrConfigDto = {
        ...validDto,
        menu_options: [
          {
            digit: 'A', // Invalid
            action: 'voicemail',
            label: 'Option',
            config: { max_duration_seconds: 180 },
          },
        ],
      };

      await expect(
        service.createOrUpdate(mockTenantId, dtoWithInvalidDigit),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createOrUpdate(mockTenantId, dtoWithInvalidDigit),
      ).rejects.toThrow(/Digit must be 0-9/);
    });
  });

  describe('findByTenantId', () => {
    it('should return IVR configuration for tenant', async () => {
      prisma.ivr_configuration.findUnique.mockResolvedValue(mockIvrConfig);

      const result = await service.findByTenantId(mockTenantId);

      expect(prisma.ivr_configuration.findUnique).toHaveBeenCalledWith({
        where: { tenant_id: mockTenantId },
      });
      expect(result).toEqual(mockIvrConfig);
    });

    it('should throw NotFoundException if config does not exist', async () => {
      prisma.ivr_configuration.findUnique.mockResolvedValue(null);

      await expect(service.findByTenantId(mockTenantId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findByTenantId(mockTenantId)).rejects.toThrow(
        /not found/,
      );
    });
  });

  describe('delete', () => {
    it('should soft delete IVR configuration', async () => {
      prisma.ivr_configuration.findUnique.mockResolvedValue(mockIvrConfig);
      prisma.ivr_configuration.update.mockResolvedValue({
        ...mockIvrConfig,
        ivr_enabled: false,
        status: 'inactive',
      });

      const result = await service.delete(mockTenantId);

      expect(prisma.ivr_configuration.update).toHaveBeenCalledWith({
        where: { tenant_id: mockTenantId },
        data: {
          ivr_enabled: false,
          status: 'inactive',
        },
      });
      expect(result.ivr_enabled).toBe(false);
      expect(result.status).toBe('inactive');
    });

    it('should throw NotFoundException if config does not exist', async () => {
      prisma.ivr_configuration.findUnique.mockResolvedValue(null);

      await expect(service.delete(mockTenantId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('generateIvrMenuTwiML', () => {
    it('should generate valid TwiML with consent and menu options', async () => {
      prisma.ivr_configuration.findUnique.mockResolvedValue(mockIvrConfig);

      const twiml = await service.generateIvrMenuTwiML(mockTenantId);

      // Verify TwiML structure
      expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('This call will be recorded'); // Consent
      expect(twiml).toContain('Thank you for calling ABC Company'); // Greeting
      expect(twiml).toContain('Press 1 for Sales Department'); // Menu option
      expect(twiml).toContain('<Gather'); // Gather element
      expect(twiml).toContain('numDigits="1"'); // Single digit
      expect(twiml).toContain('twilio-ivr-input'); // Action URL
    });

    it('should throw BadRequestException if IVR is disabled', async () => {
      const disabledConfig = { ...mockIvrConfig, ivr_enabled: false };
      prisma.ivr_configuration.findUnique.mockResolvedValue(disabledConfig);

      await expect(service.generateIvrMenuTwiML(mockTenantId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.generateIvrMenuTwiML(mockTenantId)).rejects.toThrow(
        /not enabled/,
      );
    });

    it('should throw NotFoundException if config does not exist', async () => {
      prisma.ivr_configuration.findUnique.mockResolvedValue(null);

      await expect(service.generateIvrMenuTwiML(mockTenantId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('executeIvrAction', () => {
    it('should execute action for valid digit', async () => {
      prisma.ivr_configuration.findUnique.mockResolvedValue(mockIvrConfig);

      const twiml = await service.executeIvrAction(mockTenantId, '1');

      // Should route to number
      expect(twiml).toContain('<Dial');
      expect(twiml).toContain('+19781234567');
      expect(twiml).toContain('transfer your call');
    });

    it('should replay menu for invalid digit', async () => {
      prisma.ivr_configuration.findUnique.mockResolvedValue(mockIvrConfig);

      const twiml = await service.executeIvrAction(mockTenantId, '9'); // Invalid

      // Should say error and redirect to menu
      expect(twiml).toContain('Invalid option');
      expect(twiml).toContain('try again');
      expect(twiml).toContain('<Redirect');
      expect(twiml).toContain('twilio-ivr-menu');
    });

    it('should handle voicemail action', async () => {
      prisma.ivr_configuration.findUnique.mockResolvedValue(mockIvrConfig);

      const twiml = await service.executeIvrAction(mockTenantId, '2');

      // Should start recording
      expect(twiml).toContain('<Record');
      expect(twiml).toContain('leave a message');
      expect(twiml).toContain('maxLength="180"');
    });
  });

  describe('executeDefaultAction', () => {
    it('should execute default action on timeout', async () => {
      prisma.ivr_configuration.findUnique.mockResolvedValue(mockIvrConfig);

      const twiml = await service.executeDefaultAction(mockTenantId);

      // Default is voicemail
      expect(twiml).toContain('<Record');
      expect(twiml).toContain('leave a message');
    });

    it('should throw NotFoundException if config does not exist', async () => {
      prisma.ivr_configuration.findUnique.mockResolvedValue(null);

      await expect(service.executeDefaultAction(mockTenantId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('edge cases', () => {
    it('should handle all 10 digits (0-9)', async () => {
      const dtoWithAllDigits: CreateIvrConfigDto = {
        ivr_enabled: true,
        greeting_message: 'Test',
        menu_options: Array.from({ length: 10 }, (_, i) => ({
          digit: String(i),
          action: 'voicemail' as const,
          label: `Option ${i}`,
          config: { max_duration_seconds: 180 },
        })),
        default_action: {
          action: 'voicemail',
          config: { max_duration_seconds: 180 },
        },
        timeout_seconds: 10,
        max_retries: 3,
      };

      prisma.ivr_configuration.findUnique.mockResolvedValue(null);
      prisma.ivr_configuration.create.mockResolvedValue(mockIvrConfig);

      await expect(
        service.createOrUpdate(mockTenantId, dtoWithAllDigits),
      ).resolves.toBeDefined();
    });

    it('should accept HTTPS webhook URLs', async () => {
      const dtoWithHttpsWebhook: CreateIvrConfigDto = {
        ivr_enabled: true,
        greeting_message: 'Test',
        menu_options: [
          {
            digit: '1',
            action: 'trigger_webhook',
            label: 'Webhook',
            config: { webhook_url: 'https://example.com/webhook' },
          },
        ],
        default_action: {
          action: 'voicemail',
          config: { max_duration_seconds: 180 },
        },
        timeout_seconds: 10,
        max_retries: 3,
      };

      prisma.ivr_configuration.findUnique.mockResolvedValue(null);
      prisma.ivr_configuration.create.mockResolvedValue(mockIvrConfig);

      await expect(
        service.createOrUpdate(mockTenantId, dtoWithHttpsWebhook),
      ).resolves.toBeDefined();
    });

    it('should validate E.164 phone numbers strictly', async () => {
      const invalidPhones = [
        '123', // Too short
        '+1234567890123456', // Too long (> 15 digits)
        '+0123456789', // Starts with 0
        'not-a-phone',
      ];

      for (const invalidPhone of invalidPhones) {
        const dto: CreateIvrConfigDto = {
          ivr_enabled: true,
          greeting_message: 'Test',
          menu_options: [
            {
              digit: '1',
              action: 'route_to_number',
              label: 'Test',
              config: { phone_number: invalidPhone },
            },
          ],
          default_action: {
            action: 'voicemail',
            config: { max_duration_seconds: 180 },
          },
          timeout_seconds: 10,
          max_retries: 3,
        };

        await expect(service.createOrUpdate(mockTenantId, dto)).rejects.toThrow(
          BadRequestException,
        );
      }
    });
  });
});
