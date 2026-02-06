import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OfficeBypassService } from './office-bypass.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AddWhitelistDto } from '../dto/office-bypass/add-whitelist.dto';

/**
 * OfficeBypassService Unit Tests
 *
 * Test Coverage:
 * - ✅ Check if phone number is whitelisted
 * - ✅ Add phone number to whitelist
 * - ✅ Add duplicate phone number (conflict detection)
 * - ✅ Reactivate inactive whitelist entry
 * - ✅ List all whitelisted numbers
 * - ✅ Remove (soft delete) whitelist entry
 * - ✅ Update whitelist entry label
 * - ✅ Handle bypass call (prompt TwiML)
 * - ✅ Initiate bypass outbound call (valid format)
 * - ✅ Initiate bypass outbound call (10-digit US number)
 * - ✅ Initiate bypass outbound call (invalid format)
 * - ✅ Error handling
 *
 * Mocking Strategy:
 * - PrismaService: Mocked for database operations
 * - ConfigService: Mocked for API_BASE_URL
 * - No external dependencies (Twilio SDK used internally)
 */
describe('OfficeBypassService', () => {
  let service: OfficeBypassService;
  let prisma: jest.Mocked<PrismaService>;
  let config: jest.Mocked<ConfigService>;

  // Mock tenant ID for testing
  const mockTenantId = 'tenant-123-456';
  const mockPhoneNumber = '+19781234567';

  // Mock whitelist entry
  const mockWhitelist = {
    id: 'whitelist-123',
    tenant_id: mockTenantId,
    phone_number: mockPhoneNumber,
    label: "John Doe - Sales Manager's Mobile",
    status: 'active',
    created_at: new Date(),
    updated_at: new Date(),
  };

  // Mock tenant
  const mockTenant = {
    id: mockTenantId,
    name: 'ABC Company',
  };

  beforeEach(async () => {
    // Create mock Prisma service
    const mockPrismaService = {
      office_number_whitelist: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      tenant: {
        findUnique: jest.fn(),
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
        OfficeBypassService,
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

    service = module.get<OfficeBypassService>(OfficeBypassService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    config = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isWhitelisted', () => {
    it('should return true if phone number is whitelisted and active', async () => {
      prisma.office_number_whitelist.findFirst.mockResolvedValue(mockWhitelist);

      const result = await service.isWhitelisted(mockTenantId, mockPhoneNumber);

      expect(prisma.office_number_whitelist.findFirst).toHaveBeenCalledWith({
        where: {
          tenant_id: mockTenantId,
          phone_number: mockPhoneNumber,
          status: 'active',
        },
      });
      expect(result).toBe(true);
    });

    it('should return false if phone number is not whitelisted', async () => {
      prisma.office_number_whitelist.findFirst.mockResolvedValue(null);

      const result = await service.isWhitelisted(
        mockTenantId,
        '+19999999999',
      );

      expect(result).toBe(false);
    });

    it('should return false if phone number is inactive', async () => {
      const inactiveWhitelist = { ...mockWhitelist, status: 'inactive' };
      prisma.office_number_whitelist.findFirst.mockResolvedValue(
        inactiveWhitelist,
      );

      // Service filters by status: 'active', so should not find it
      prisma.office_number_whitelist.findFirst.mockResolvedValue(null);

      const result = await service.isWhitelisted(mockTenantId, mockPhoneNumber);

      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      prisma.office_number_whitelist.findFirst.mockRejectedValue(
        new Error('Database error'),
      );

      // Should return false on error (safe default)
      const result = await service.isWhitelisted(mockTenantId, mockPhoneNumber);

      expect(result).toBe(false);
    });
  });

  describe('addToWhitelist', () => {
    const validDto: AddWhitelistDto = {
      phone_number: mockPhoneNumber,
      label: "John Doe - Sales Manager's Mobile",
    };

    it('should add phone number to whitelist if not exists', async () => {
      prisma.office_number_whitelist.findFirst.mockResolvedValue(null);
      prisma.office_number_whitelist.create.mockResolvedValue(mockWhitelist);

      const result = await service.addToWhitelist(mockTenantId, validDto);

      expect(prisma.office_number_whitelist.findFirst).toHaveBeenCalledWith({
        where: {
          tenant_id: mockTenantId,
          phone_number: validDto.phone_number,
        },
      });
      expect(prisma.office_number_whitelist.create).toHaveBeenCalledWith({
        data: {
          tenant_id: mockTenantId,
          phone_number: validDto.phone_number,
          label: validDto.label,
          status: 'active',
        },
      });
      expect(result).toEqual(mockWhitelist);
    });

    it('should throw ConflictException if phone number already whitelisted (active)', async () => {
      prisma.office_number_whitelist.findFirst.mockResolvedValue(mockWhitelist);

      await expect(
        service.addToWhitelist(mockTenantId, validDto),
      ).rejects.toThrow(ConflictException);
      await expect(
        service.addToWhitelist(mockTenantId, validDto),
      ).rejects.toThrow(/already whitelisted/);
    });

    it('should reactivate inactive whitelist entry', async () => {
      const inactiveWhitelist = { ...mockWhitelist, status: 'inactive' };
      prisma.office_number_whitelist.findFirst.mockResolvedValue(
        inactiveWhitelist,
      );
      prisma.office_number_whitelist.update.mockResolvedValue({
        ...inactiveWhitelist,
        status: 'active',
        label: validDto.label,
      });

      const result = await service.addToWhitelist(mockTenantId, validDto);

      expect(prisma.office_number_whitelist.update).toHaveBeenCalledWith({
        where: { id: inactiveWhitelist.id },
        data: {
          status: 'active',
          label: validDto.label,
        },
      });
      expect(result.status).toBe('active');
    });
  });

  describe('findAll', () => {
    it('should return all whitelist entries (active and inactive)', async () => {
      const mockEntries = [
        mockWhitelist,
        { ...mockWhitelist, id: 'whitelist-456', status: 'inactive' },
      ];
      prisma.office_number_whitelist.findMany.mockResolvedValue(mockEntries);

      const result = await service.findAll(mockTenantId);

      expect(prisma.office_number_whitelist.findMany).toHaveBeenCalledWith({
        where: { tenant_id: mockTenantId },
        orderBy: { created_at: 'desc' },
      });
      expect(result).toEqual(mockEntries);
      expect(result.length).toBe(2);
    });

    it('should return empty array if no entries', async () => {
      prisma.office_number_whitelist.findMany.mockResolvedValue([]);

      const result = await service.findAll(mockTenantId);

      expect(result).toEqual([]);
    });
  });

  describe('removeFromWhitelist', () => {
    it('should soft delete whitelist entry', async () => {
      prisma.office_number_whitelist.findFirst.mockResolvedValue(mockWhitelist);
      prisma.office_number_whitelist.update.mockResolvedValue({
        ...mockWhitelist,
        status: 'inactive',
      });

      const result = await service.removeFromWhitelist(
        mockTenantId,
        mockWhitelist.id,
      );

      expect(prisma.office_number_whitelist.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockWhitelist.id,
          tenant_id: mockTenantId,
        },
      });
      expect(prisma.office_number_whitelist.update).toHaveBeenCalledWith({
        where: { id: mockWhitelist.id },
        data: { status: 'inactive' },
      });
      expect(result.status).toBe('inactive');
    });

    it('should throw NotFoundException if entry does not exist', async () => {
      prisma.office_number_whitelist.findFirst.mockResolvedValue(null);

      await expect(
        service.removeFromWhitelist(mockTenantId, 'non-existent-id'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.removeFromWhitelist(mockTenantId, 'non-existent-id'),
      ).rejects.toThrow(/not found/);
    });

    it('should throw NotFoundException if entry belongs to different tenant', async () => {
      const otherTenantWhitelist = {
        ...mockWhitelist,
        tenant_id: 'other-tenant',
      };
      prisma.office_number_whitelist.findFirst.mockResolvedValue(null);

      await expect(
        service.removeFromWhitelist(mockTenantId, mockWhitelist.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateLabel', () => {
    const newLabel = 'John Doe - VP of Sales';

    it('should update whitelist entry label', async () => {
      prisma.office_number_whitelist.findFirst.mockResolvedValue(mockWhitelist);
      prisma.office_number_whitelist.update.mockResolvedValue({
        ...mockWhitelist,
        label: newLabel,
      });

      const result = await service.updateLabel(
        mockTenantId,
        mockWhitelist.id,
        newLabel,
      );

      expect(prisma.office_number_whitelist.update).toHaveBeenCalledWith({
        where: { id: mockWhitelist.id },
        data: { label: newLabel },
      });
      expect(result.label).toBe(newLabel);
    });

    it('should throw NotFoundException if entry does not exist', async () => {
      prisma.office_number_whitelist.findFirst.mockResolvedValue(null);

      await expect(
        service.updateLabel(mockTenantId, 'non-existent-id', newLabel),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('handleBypassCall', () => {
    it('should generate prompt TwiML with company name', async () => {
      prisma.tenant.findUnique.mockResolvedValue(mockTenant);

      const twiml = await service.handleBypassCall(
        mockTenantId,
        mockPhoneNumber,
      );

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: mockTenantId },
        select: { name: true },
      });

      // Verify TwiML structure
      expect(twiml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(twiml).toContain('<Response>');
      expect(twiml).toContain('ABC Company'); // Company name
      expect(twiml).toContain('office bypass system');
      expect(twiml).toContain('ten digit phone number');
      expect(twiml).toContain('<Gather');
      expect(twiml).toContain('numDigits="10"');
      expect(twiml).toContain('twilio-bypass-dial');
    });

    it('should use default company name if tenant not found', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);

      const twiml = await service.handleBypassCall(
        mockTenantId,
        mockPhoneNumber,
      );

      expect(twiml).toContain('Lead360'); // Default name
    });

    it('should handle error gracefully and return error TwiML', async () => {
      prisma.tenant.findUnique.mockRejectedValue(new Error('Database error'));

      const twiml = await service.handleBypassCall(
        mockTenantId,
        mockPhoneNumber,
      );

      expect(twiml).toContain('error occurred');
      expect(twiml).toContain('<Hangup');
    });
  });

  describe('initiateBypassOutboundCall', () => {
    const callSid = 'CA123456789';

    it('should generate dial TwiML for E.164 number', async () => {
      const twiml = await service.initiateBypassOutboundCall(
        mockTenantId,
        callSid,
        '+14155551234',
      );

      // Verify TwiML structure
      expect(twiml).toContain('<Dial');
      expect(twiml).toContain('+14155551234');
      expect(twiml).toContain('connect your call');
      expect(twiml).toContain('This call will be recorded'); // Consent
      expect(twiml).toContain('record="record-from-ringing"');
    });

    it('should format 10-digit US number to E.164', async () => {
      const twiml = await service.initiateBypassOutboundCall(
        mockTenantId,
        callSid,
        '4155551234', // 10 digits, no +1
      );

      // Should prepend +1
      expect(twiml).toContain('+14155551234');
    });

    it('should reject invalid phone number format', async () => {
      const twiml = await service.initiateBypassOutboundCall(
        mockTenantId,
        callSid,
        '123', // Too short
      );

      // Should say error and redirect to prompt
      expect(twiml).toContain('Invalid phone number');
      expect(twiml).toContain('try again');
      expect(twiml).toContain('<Redirect');
      expect(twiml).toContain('twilio-bypass-prompt');
    });

    it('should reject phone numbers starting with 0', async () => {
      const twiml = await service.initiateBypassOutboundCall(
        mockTenantId,
        callSid,
        '+0123456789',
      );

      expect(twiml).toContain('Invalid phone number');
    });

    it('should reject phone numbers longer than 15 digits', async () => {
      const twiml = await service.initiateBypassOutboundCall(
        mockTenantId,
        callSid,
        '+1234567890123456', // 16 digits
      );

      expect(twiml).toContain('Invalid phone number');
    });

    it('should include recording status callback', async () => {
      const twiml = await service.initiateBypassOutboundCall(
        mockTenantId,
        callSid,
        '+14155551234',
      );

      expect(twiml).toContain('recordingStatusCallback');
      expect(twiml).toContain('twilio-recording-ready');
    });

    it('should include failure message', async () => {
      const twiml = await service.initiateBypassOutboundCall(
        mockTenantId,
        callSid,
        '+14155551234',
      );

      // After dial fails
      expect(twiml).toContain('could not be completed');
      expect(twiml).toContain('check the number');
    });
  });

  describe('edge cases', () => {
    it('should handle very long labels', async () => {
      const longLabel = 'A'.repeat(100); // Max length
      const dto: AddWhitelistDto = {
        phone_number: mockPhoneNumber,
        label: longLabel,
      };

      prisma.office_number_whitelist.findFirst.mockResolvedValue(null);
      prisma.office_number_whitelist.create.mockResolvedValue({
        ...mockWhitelist,
        label: longLabel,
      });

      await expect(
        service.addToWhitelist(mockTenantId, dto),
      ).resolves.toBeDefined();
    });

    it('should handle international phone numbers', async () => {
      const ukNumber = '+442071234567';
      const brazilNumber = '+5511987654321';

      const twiml1 = await service.initiateBypassOutboundCall(
        mockTenantId,
        'CA123',
        ukNumber,
      );
      expect(twiml1).toContain(ukNumber);

      const twiml2 = await service.initiateBypassOutboundCall(
        mockTenantId,
        'CA456',
        brazilNumber,
      );
      expect(twiml2).toContain(brazilNumber);
    });

    it('should handle concurrent whitelist checks', async () => {
      prisma.office_number_whitelist.findFirst.mockResolvedValue(mockWhitelist);

      // Simulate concurrent checks
      const promises = Array.from({ length: 10 }, () =>
        service.isWhitelisted(mockTenantId, mockPhoneNumber),
      );

      const results = await Promise.all(promises);

      expect(results.every((r) => r === true)).toBe(true);
      expect(prisma.office_number_whitelist.findFirst).toHaveBeenCalledTimes(
        10,
      );
    });
  });
});
