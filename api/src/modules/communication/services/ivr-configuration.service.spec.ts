import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IvrConfigurationService } from './ivr-configuration.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { VoiceAiSipService } from '../../voice-ai/services/voice-ai-sip.service';
import { IvrMenuOptionDto } from '../dto/ivr/create-ivr-config.dto';

/**
 * Integration Tests for Multi-Level IVR Navigation (Sprint IVR-2)
 *
 * Tests the path-based navigation system for multi-level IVR menus.
 * Validates:
 * - Root level navigation (no path)
 * - Single-level submenu navigation (path="1")
 * - Multi-level submenu navigation (path="1.2", "1.2.3")
 * - Error handling for invalid paths
 * - Error handling for non-submenu options in path
 * - TwiML generation with path parameters
 * - Submenu action redirects
 */
describe('IvrConfigurationService - Multi-Level Navigation', () => {
  let service: IvrConfigurationService;
  let prisma: PrismaService;

  // Mock data for multi-level menu structure
  const mockMultiLevelMenu: IvrMenuOptionDto[] = [
    {
      id: 'opt-1',
      digit: '1',
      action: 'submenu',
      label: 'Sales Department',
      config: {},
      submenu: {
        greeting_message: 'Welcome to Sales. Please select an option.',
        timeout_seconds: 15,
        options: [
          {
            id: 'opt-1-1',
            digit: '1',
            action: 'submenu',
            label: 'Customer Type',
            config: {},
            submenu: {
              greeting_message: 'Are you a new or existing customer?',
              options: [
                {
                  id: 'opt-1-1-1',
                  digit: '1',
                  action: 'voicemail',
                  label: 'New Customer',
                  config: { max_duration_seconds: 120 },
                },
                {
                  id: 'opt-1-1-2',
                  digit: '2',
                  action: 'route_to_number',
                  label: 'Existing Customer',
                  config: { phone_number: '+15551234567' },
                },
              ],
            },
          },
          {
            id: 'opt-1-2',
            digit: '2',
            action: 'route_to_number',
            label: 'Sales Manager',
            config: { phone_number: '+15559876543' },
          },
        ],
      },
    },
    {
      id: 'opt-2',
      digit: '2',
      action: 'route_to_number',
      label: 'Support',
      config: { phone_number: '+15551111111' },
    },
    {
      id: 'opt-3',
      digit: '3',
      action: 'voicemail',
      label: 'Leave a Message',
      config: { max_duration_seconds: 180 },
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IvrConfigurationService,
        {
          provide: PrismaService,
          useValue: {
            ivr_configuration: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            tenant: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'API_BASE_URL') return 'https://api.lead360.app';
              return null;
            }),
          },
        },
        {
          provide: VoiceAiSipService,
          useValue: {
            canHandleCall: jest.fn(),
            buildSipTwiml: jest.fn(),
            buildFallbackTwiml: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<IvrConfigurationService>(IvrConfigurationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('navigateToMenuLevel()', () => {
    it('should return root level when path is null', () => {
      const result = service['navigateToMenuLevel'](
        mockMultiLevelMenu,
        'Welcome to our company',
        null,
      );

      expect(result.greeting).toBe('Welcome to our company');
      expect(result.options).toEqual(mockMultiLevelMenu);
      expect(result.timeout).toBeUndefined();
    });

    it('should return root level when path is empty string', () => {
      const result = service['navigateToMenuLevel'](
        mockMultiLevelMenu,
        'Welcome to our company',
        '',
      );

      expect(result.greeting).toBe('Welcome to our company');
      expect(result.options).toEqual(mockMultiLevelMenu);
      expect(result.timeout).toBeUndefined();
    });

    it('should navigate to first-level submenu (path="1")', () => {
      const result = service['navigateToMenuLevel'](
        mockMultiLevelMenu,
        'Welcome to our company',
        '1',
      );

      expect(result.greeting).toBe(
        'Welcome to Sales. Please select an option.',
      );
      expect(result.options).toHaveLength(2);
      expect(result.options[0].digit).toBe('1');
      expect(result.options[1].digit).toBe('2');
      expect(result.timeout).toBe(15); // Submenu override timeout
    });

    it('should navigate to second-level submenu (path="1.1")', () => {
      const result = service['navigateToMenuLevel'](
        mockMultiLevelMenu,
        'Welcome to our company',
        '1.1',
      );

      expect(result.greeting).toBe('Are you a new or existing customer?');
      expect(result.options).toHaveLength(2);
      expect(result.options[0].digit).toBe('1');
      expect(result.options[0].label).toBe('New Customer');
      expect(result.options[1].digit).toBe('2');
      expect(result.options[1].label).toBe('Existing Customer');
      expect(result.timeout).toBeUndefined(); // No timeout override at this level
    });

    it('should throw NotFoundException for invalid digit in path (digit does not exist)', () => {
      expect(() =>
        service['navigateToMenuLevel'](mockMultiLevelMenu, 'Welcome', '9'),
      ).toThrow(NotFoundException);

      expect(() =>
        service['navigateToMenuLevel'](mockMultiLevelMenu, 'Welcome', '9'),
      ).toThrow('Invalid menu path: digit "9" not found at level 1');
    });

    it('should throw NotFoundException for invalid digit in nested path', () => {
      expect(() =>
        service['navigateToMenuLevel'](mockMultiLevelMenu, 'Welcome', '1.9'),
      ).toThrow(NotFoundException);

      expect(() =>
        service['navigateToMenuLevel'](mockMultiLevelMenu, 'Welcome', '1.9'),
      ).toThrow('Invalid menu path: digit "9" not found at level 2');
    });

    it('should throw BadRequestException when path points to non-submenu option', () => {
      // Digit "2" at root is "Support" (route_to_number), not a submenu
      expect(() =>
        service['navigateToMenuLevel'](mockMultiLevelMenu, 'Welcome', '2'),
      ).toThrow(BadRequestException);

      expect(() =>
        service['navigateToMenuLevel'](mockMultiLevelMenu, 'Welcome', '2'),
      ).toThrow('is not a submenu');
    });

    it('should throw BadRequestException when nested path points to terminal action', () => {
      // Path "1.2" points to "Sales Manager" (route_to_number), cannot go deeper
      expect(() =>
        service['navigateToMenuLevel'](mockMultiLevelMenu, 'Welcome', '1.2.1'),
      ).toThrow(BadRequestException);
    });

    it('should handle deep nesting correctly (3 levels deep)', () => {
      // Navigate to path "1.1" (second level submenu)
      const result = service['navigateToMenuLevel'](
        mockMultiLevelMenu,
        'Welcome',
        '1.1',
      );

      expect(result.greeting).toBe('Are you a new or existing customer?');
      expect(result.options).toHaveLength(2);

      // Verify we're at the correct level
      expect(result.options[0].action).toBe('voicemail'); // Terminal action
      expect(result.options[1].action).toBe('route_to_number'); // Terminal action
    });
  });

  describe('generateIvrMenuTwiML() with path parameter', () => {
    const mockTenant = {
      id: 'tenant-123',
      subdomain: 'testcompany',
    };

    const mockConfig = {
      id: 'config-123',
      tenant_id: 'tenant-123',
      ivr_enabled: true,
      greeting_message: 'Thank you for calling. Please select an option.',
      menu_options: mockMultiLevelMenu,
      default_action: {
        action: 'voicemail',
        config: { max_duration_seconds: 180 },
      },
      timeout_seconds: 10,
      max_retries: 3,
      max_depth: 4,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    };

    beforeEach(() => {
      jest
        .spyOn(prisma.ivr_configuration, 'findUnique')
        .mockResolvedValue(mockConfig as any);
      jest
        .spyOn(prisma.tenant, 'findUnique')
        .mockResolvedValue(mockTenant as any);
    });

    it('should generate root level TwiML with consent message (no path)', async () => {
      const twiml = await service.generateIvrMenuTwiML('tenant-123');

      // Should include consent message
      expect(twiml).toContain('This call will be recorded');

      // Should include greeting
      expect(twiml).toContain('Thank you for calling');

      // Should include menu options
      expect(twiml).toContain('Press 1 for Sales Department');
      expect(twiml).toContain('Press 2 for Support');
      expect(twiml).toContain('Press 3 for Leave a Message');

      // Action URL should NOT include path parameter
      expect(twiml).toContain(
        'https://testcompany.lead360.app/api/v1/twilio/ivr/input',
      );
      expect(twiml).not.toContain('?path=');

      // Should use config default timeout (10 seconds)
      expect(twiml).toContain('timeout="10"');
    });

    it('should generate submenu TwiML without consent message (path="1")', async () => {
      const twiml = await service.generateIvrMenuTwiML('tenant-123', '1');

      // Should NOT include consent message (not at root)
      expect(twiml).not.toContain('This call will be recorded');

      // Should include submenu greeting
      expect(twiml).toContain('Welcome to Sales');

      // Should include submenu options
      expect(twiml).toContain('Press 1 for Customer Type');
      expect(twiml).toContain('Press 2 for Sales Manager');

      // Action URL should include path parameter
      expect(twiml).toContain(
        'https://testcompany.lead360.app/api/v1/twilio/ivr/input?path=1',
      );

      // Should use submenu timeout override (15 seconds)
      expect(twiml).toContain('timeout="15"');
    });

    it('should generate deep submenu TwiML (path="1.1")', async () => {
      const twiml = await service.generateIvrMenuTwiML('tenant-123', '1.1');

      // Should NOT include consent message
      expect(twiml).not.toContain('This call will be recorded');

      // Should include second-level submenu greeting
      expect(twiml).toContain('Are you a new or existing customer?');

      // Should include second-level submenu options
      expect(twiml).toContain('Press 1 for New Customer');
      expect(twiml).toContain('Press 2 for Existing Customer');

      // Action URL should include path parameter
      expect(twiml).toContain(
        'https://testcompany.lead360.app/api/v1/twilio/ivr/input?path=1.1',
      );

      // Should use config default timeout (no override at this level)
      expect(twiml).toContain('timeout="10"');
    });

    it('should throw NotFoundException for invalid path', async () => {
      await expect(
        service.generateIvrMenuTwiML('tenant-123', '9.9.9'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('executeIvrAction() with path parameter', () => {
    const mockTenant = {
      id: 'tenant-123',
      subdomain: 'testcompany',
    };

    const mockConfig = {
      id: 'config-123',
      tenant_id: 'tenant-123',
      ivr_enabled: true,
      greeting_message: 'Thank you for calling',
      menu_options: mockMultiLevelMenu,
      default_action: {
        action: 'voicemail',
        config: { max_duration_seconds: 180 },
      },
      timeout_seconds: 10,
      max_retries: 3,
      max_depth: 4,
      status: 'active',
      created_at: new Date(),
      updated_at: new Date(),
    };

    beforeEach(() => {
      jest
        .spyOn(prisma.ivr_configuration, 'findUnique')
        .mockResolvedValue(mockConfig as any);
      jest
        .spyOn(prisma.tenant, 'findUnique')
        .mockResolvedValue(mockTenant as any);
    });

    it('should handle submenu action at root level and redirect with new path', async () => {
      const twiml = await service.executeIvrAction(
        'tenant-123',
        '1', // Press 1 (Sales Department - submenu)
        'CA1234567890',
        undefined, // At root level
      );

      // Should generate redirect TwiML to submenu
      expect(twiml).toContain('<Redirect');
      expect(twiml).toContain(
        'https://testcompany.lead360.app/api/v1/twilio/ivr/menu?path=1',
      );
    });

    it('should handle submenu action at nested level and accumulate path', async () => {
      const twiml = await service.executeIvrAction(
        'tenant-123',
        '1', // Press 1 (Customer Type - submenu)
        'CA1234567890',
        '1', // Currently at path "1" (Sales Department)
      );

      // Should generate redirect TwiML to deeper submenu
      expect(twiml).toContain('<Redirect');
      expect(twiml).toContain(
        'https://testcompany.lead360.app/api/v1/twilio/ivr/menu?path=1.1',
      );
    });

    it('should handle terminal action at any level', async () => {
      const twiml = await service.executeIvrAction(
        'tenant-123',
        '2', // Press 2 (Sales Manager - route_to_number)
        'CA1234567890',
        '1', // At path "1" (Sales Department submenu)
      );

      // Should generate dial TwiML (terminal action)
      expect(twiml).toContain('<Dial');
      expect(twiml).toContain('+15559876543'); // Sales Manager phone number
    });

    it('should handle invalid digit and redirect to current level', async () => {
      const twiml = await service.executeIvrAction(
        'tenant-123',
        '9', // Invalid digit
        'CA1234567890',
        '1', // At path "1"
      );

      // Should say error message
      expect(twiml).toContain('Invalid option');

      // Should redirect back to current menu level with path preserved
      expect(twiml).toContain('<Redirect');
      expect(twiml).toContain(
        'https://testcompany.lead360.app/api/v1/twilio/ivr/menu?path=1',
      );
    });

    it('should handle invalid digit at root level', async () => {
      const twiml = await service.executeIvrAction(
        'tenant-123',
        '9', // Invalid digit
        'CA1234567890',
        undefined, // At root level
      );

      // Should say error message
      expect(twiml).toContain('Invalid option');

      // Should redirect back to root menu (no path)
      expect(twiml).toContain('<Redirect');
      expect(twiml).toContain(
        'https://testcompany.lead360.app/api/v1/twilio/ivr/menu',
      );
      expect(twiml).not.toContain('?path=');
    });
  });
});
