import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { LeadPhonesService } from './lead-phones.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { LeadActivitiesService } from './lead-activities.service';

describe('LeadPhonesService', () => {
  let service: LeadPhonesService;
  let prismaService: jest.Mocked<PrismaService>;
  let activitiesService: jest.Mocked<LeadActivitiesService>;

  const mockTenantId = 'tenant-uuid';
  const mockLeadId = 'lead-uuid';
  const mockUserId = 'user-uuid';

  beforeEach(async () => {
    const mockPrismaService = {
      lead: {
        findFirst: jest.fn(),
      },
      lead_phone: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      lead_email: {
        count: jest.fn(),
      },
    };

    const mockActivitiesService = {
      logActivity: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadPhonesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LeadActivitiesService, useValue: mockActivitiesService },
      ],
    }).compile();

    service = module.get<LeadPhonesService>(LeadPhonesService);
    prismaService = module.get(PrismaService);
    activitiesService = module.get(LeadActivitiesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkPhoneUniqueness - CRITICAL TENANT-SCOPED', () => {
    it('should return false when phone is unique within tenant', async () => {
      (prismaService.lead_phone.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.checkPhoneUniqueness(
        mockTenantId,
        '5551234567',
      );

      expect(result).toBe(false);
      expect(prismaService.lead_phone.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            phone: '5551234567',
            lead: expect.objectContaining({
              tenant_id: mockTenantId,
            }),
          }),
        }),
      );
    });

    it('should return true when phone exists in same tenant', async () => {
      (prismaService.lead_phone.findFirst as jest.Mock).mockResolvedValue({
        id: 'phone-uuid',
        phone: '5551234567',
        lead: {
          id: 'other-lead-uuid',
          tenant_id: mockTenantId,
          first_name: 'John',
          last_name: 'Doe',
        },
      });

      const result = await service.checkPhoneUniqueness(
        mockTenantId,
        '5551234567',
      );

      expect(result).toBe(true);
    });

    it('should exclude specific lead when checking uniqueness (for updates)', async () => {
      (prismaService.lead_phone.findFirst as jest.Mock).mockResolvedValue(null);

      await service.checkPhoneUniqueness(
        mockTenantId,
        '5551234567',
        'exclude-lead-uuid',
      );

      expect(prismaService.lead_phone.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            lead: expect.objectContaining({
              id: { not: 'exclude-lead-uuid' },
            }),
          }),
        }),
      );
    });

    it('should sanitize phone number before checking', async () => {
      (prismaService.lead_phone.findFirst as jest.Mock).mockResolvedValue(null);

      await service.checkPhoneUniqueness(mockTenantId, '(555) 123-4567');

      expect(prismaService.lead_phone.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            phone: '5551234567', // Sanitized
          }),
        }),
      );
    });
  });

  describe('create', () => {
    it('should create phone successfully', async () => {
      const mockLead = {
        id: mockLeadId,
        tenant_id: mockTenantId,
        first_name: 'John',
        last_name: 'Doe',
      };

      (prismaService.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
      (prismaService.lead_phone.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.lead_phone.count as jest.Mock).mockResolvedValue(1);
      (prismaService.lead_phone.create as jest.Mock).mockResolvedValue({
        id: 'phone-uuid',
        lead_id: mockLeadId,
        phone: '5551234567',
        phone_type: 'mobile',
        is_primary: false,
      });

      const result = await service.create(mockTenantId, mockLeadId, mockUserId, {
        phone: '555-123-4567',
        phone_type: 'mobile',
        is_primary: false,
      });

      expect(result.phone).toBe('5551234567');
      expect(activitiesService.logActivity).toHaveBeenCalled();
    });

    it('should throw ConflictException when phone exists in tenant', async () => {
      const mockLead = {
        id: mockLeadId,
        tenant_id: mockTenantId,
      };

      (prismaService.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
      (prismaService.lead_phone.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-phone-uuid',
        phone: '5551234567',
        lead: { id: 'other-lead', tenant_id: mockTenantId },
      });

      await expect(
        service.create(mockTenantId, mockLeadId, mockUserId, {
          phone: '5551234567',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for invalid phone format', async () => {
      const mockLead = { id: mockLeadId, tenant_id: mockTenantId };
      (prismaService.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);

      await expect(
        service.create(mockTenantId, mockLeadId, mockUserId, {
          phone: '12345', // Invalid - not 10 digits
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set as primary if first phone', async () => {
      const mockLead = { id: mockLeadId, tenant_id: mockTenantId };

      (prismaService.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
      (prismaService.lead_phone.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.lead_phone.count as jest.Mock).mockResolvedValue(0);
      (prismaService.lead_phone.create as jest.Mock).mockResolvedValue({
        id: 'phone-uuid',
        phone: '5551234567',
        is_primary: true,
      });

      await service.create(mockTenantId, mockLeadId, mockUserId, {
        phone: '5551234567',
        is_primary: false, // Requested false, but should be auto-set to true
      });

      expect(prismaService.lead_phone.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            is_primary: true, // Auto-set
          }),
        }),
      );
    });

    it('should unset other primary phones when setting new primary', async () => {
      const mockLead = { id: mockLeadId, tenant_id: mockTenantId };

      (prismaService.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
      (prismaService.lead_phone.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.lead_phone.count as jest.Mock).mockResolvedValue(2);
      (prismaService.lead_phone.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prismaService.lead_phone.create as jest.Mock).mockResolvedValue({
        id: 'phone-uuid',
        phone: '5551234567',
        is_primary: true,
      });

      await service.create(mockTenantId, mockLeadId, mockUserId, {
        phone: '5551234567',
        is_primary: true,
      });

      expect(prismaService.lead_phone.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            lead_id: mockLeadId,
            is_primary: true,
          }),
          data: { is_primary: false },
        }),
      );
    });
  });

  describe('update', () => {
    it('should update phone successfully', async () => {
      const mockPhone = {
        id: 'phone-uuid',
        lead_id: mockLeadId,
        phone: '5551234567',
        phone_type: 'mobile',
        is_primary: false,
        lead: { tenant_id: mockTenantId },
      };

      (prismaService.lead_phone.findFirst as jest.Mock).mockResolvedValue(
        mockPhone,
      );
      (prismaService.lead_phone.update as jest.Mock).mockResolvedValue({
        ...mockPhone,
        phone_type: 'home',
      });

      const result = await service.update(
        mockTenantId,
        mockLeadId,
        'phone-uuid',
        mockUserId,
        { phone_type: 'home' },
      );

      expect(result.phone_type).toBe('home');
      expect(activitiesService.logActivity).toHaveBeenCalled();
    });

    it('should check uniqueness when changing phone number', async () => {
      const mockPhone = {
        id: 'phone-uuid',
        lead_id: mockLeadId,
        phone: '5551234567',
        lead: { tenant_id: mockTenantId },
      };

      (prismaService.lead_phone.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockPhone) // First call - find existing phone
        .mockResolvedValueOnce(null); // Second call - check new phone uniqueness

      (prismaService.lead_phone.update as jest.Mock).mockResolvedValue({
        ...mockPhone,
        phone: '5559876543',
      });

      await service.update(
        mockTenantId,
        mockLeadId,
        'phone-uuid',
        mockUserId,
        { phone: '555-987-6543' },
      );

      expect(prismaService.lead_phone.findFirst).toHaveBeenCalledTimes(2);
    });

    it('should throw ConflictException when new phone exists', async () => {
      const mockPhone = {
        id: 'phone-uuid',
        lead_id: mockLeadId,
        phone: '5551234567',
        lead: { tenant_id: mockTenantId },
      };

      (prismaService.lead_phone.findFirst as jest.Mock)
        .mockResolvedValueOnce(mockPhone)
        .mockResolvedValueOnce({
          id: 'other-phone',
          phone: '5559876543',
          lead: {
            id: 'other-lead',
            tenant_id: mockTenantId,
            first_name: 'Other',
            last_name: 'Lead',
          },
        }); // Phone exists

      await expect(
        service.update(mockTenantId, mockLeadId, 'phone-uuid', mockUserId, {
          phone: '5559876543',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('should delete phone successfully', async () => {
      const mockPhone = {
        id: 'phone-uuid',
        lead_id: mockLeadId,
        phone: '5551234567',
        phone_type: 'mobile',
        is_primary: false,
        lead: { tenant_id: mockTenantId },
      };

      (prismaService.lead_phone.findFirst as jest.Mock).mockResolvedValue(
        mockPhone,
      );
      (prismaService.lead_email.count as jest.Mock).mockResolvedValue(1);
      (prismaService.lead_phone.count as jest.Mock).mockResolvedValue(2);
      (prismaService.lead_phone.delete as jest.Mock).mockResolvedValue(
        mockPhone,
      );

      await service.delete(mockTenantId, mockLeadId, 'phone-uuid', mockUserId);

      expect(prismaService.lead_phone.delete).toHaveBeenCalled();
      expect(activitiesService.logActivity).toHaveBeenCalled();
    });

    it('should throw BadRequestException when deleting last contact method', async () => {
      const mockPhone = {
        id: 'phone-uuid',
        lead_id: mockLeadId,
        phone: '5551234567',
        is_primary: true,
        lead: { tenant_id: mockTenantId },
      };

      (prismaService.lead_phone.findFirst as jest.Mock).mockResolvedValue(
        mockPhone,
      );
      (prismaService.lead_email.count as jest.Mock).mockResolvedValue(0); // No emails
      (prismaService.lead_phone.count as jest.Mock).mockResolvedValue(1); // Only 1 phone

      await expect(
        service.delete(mockTenantId, mockLeadId, 'phone-uuid', mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when phone not found', async () => {
      (prismaService.lead_phone.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.delete(mockTenantId, mockLeadId, 'invalid-phone', mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createMultiple', () => {
    it('should create multiple phones successfully', async () => {
      (prismaService.lead_phone.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.lead_phone.create as jest.Mock).mockResolvedValue({
        id: 'phone-uuid',
        phone: '5551234567',
      });

      const phones = [
        { phone: '555-123-4567', phone_type: 'mobile', is_primary: true },
        { phone: '555-987-6543', phone_type: 'home', is_primary: false },
      ];

      const result = await service.createMultiple(
        mockTenantId,
        mockLeadId,
        phones,
      );

      expect(result).toHaveLength(2);
      expect(prismaService.lead_phone.create).toHaveBeenCalledTimes(2);
    });

    it('should auto-set first phone as primary if none specified', async () => {
      (prismaService.lead_phone.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.lead_phone.create as jest.Mock).mockResolvedValue({
        id: 'phone-uuid',
      });

      const phones = [
        { phone: '5551234567', is_primary: false },
        { phone: '5559876543', is_primary: false },
      ];

      await service.createMultiple(mockTenantId, mockLeadId, phones);

      // First phone should be auto-set as primary
      expect(phones[0].is_primary).toBe(true);
    });

    it('should throw error if multiple phones marked as primary', async () => {
      const phones = [
        { phone: '5551234567', is_primary: true },
        { phone: '5559876543', is_primary: true }, // Two primaries - invalid
      ];

      await expect(
        service.createMultiple(mockTenantId, mockLeadId, phones),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate all phones and throw on duplicate', async () => {
      (prismaService.lead_phone.findFirst as jest.Mock).mockResolvedValue({
        id: 'existing-phone',
        phone: '5551234567',
        lead: { tenant_id: mockTenantId },
      });

      const phones = [{ phone: '5551234567', is_primary: true }];

      await expect(
        service.createMultiple(mockTenantId, mockLeadId, phones),
      ).rejects.toThrow(ConflictException);
    });
  });
});
