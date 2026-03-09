import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { FileStorageService } from '../../../core/file-storage';
import { ConfigService } from '@nestjs/config';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { BusinessEntityType } from '../dto/create-tenant.dto';

/**
 * Unit Tests for TenantService - Sprint 02
 *
 * Tests the tenant creation lifecycle hook that auto-creates:
 * - Default "Quote Visit" appointment type
 * - 7 schedule rows (Monday-Sunday)
 * - Default schedule: Mon-Fri 9 AM - 5 PM
 */
describe('TenantService - Sprint 02: Appointment Type Lifecycle Hook', () => {
  let service: TenantService;
  let prisma: PrismaService;

  const mockTransaction = jest.fn();
  const mockAuditLogger = {
    logTenantChange: jest.fn(),
  };
  const mockFileStorage = {};
  const mockConfigService = {
    get: jest.fn().mockReturnValue('/var/www/lead360.app/uploads'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        {
          provide: PrismaService,
          useValue: {
            tenant: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            subscription_plan: {
              findFirst: jest.fn(),
            },
            tenant_business_hours: {
              create: jest.fn(),
            },
            appointment_type: {
              create: jest.fn(),
              count: jest.fn(),
            },
            appointment_type_schedule: {
              create: jest.fn(),
              findMany: jest.fn(),
            },
            $transaction: mockTransaction,
          },
        },
        {
          provide: FileStorageService,
          useValue: mockFileStorage,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AuditLoggerService,
          useValue: mockAuditLogger,
        },
      ],
    }).compile();

    service = module.get<TenantService>(TenantService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    it('should create tenant with default appointment type and 7 schedule rows', async () => {
      const createTenantDto = {
        subdomain: 'test-tenant',
        company_name: 'Test Company',
        legal_business_name: 'Test Company LLC',
        business_entity_type: BusinessEntityType.LLC,
        state_of_registration: 'NY',
        ein: '12-3456789',
        primary_contact_phone: '5551234567',
        primary_contact_email: 'test@example.com',
      };

      const mockSubscriptionPlan = {
        id: 'plan-123',
        is_default: true,
        is_active: true,
      };

      const mockTenant = {
        id: 'tenant-123',
        ...createTenantDto,
        timezone: 'America/New_York',
        is_active: true,
        subscription_status: 'trial',
      };

      const mockAppointmentType = {
        id: 'appt-type-123',
        tenant_id: 'tenant-123',
        name: 'Quote Visit',
        description:
          'Schedule a quote visit with the customer to assess the job',
        slot_duration_minutes: 60,
        max_lookahead_weeks: 8,
        reminder_24h_enabled: true,
        reminder_1h_enabled: true,
        is_active: true,
        is_default: true,
      };

      // Mock subscription plan lookup
      jest
        .spyOn(prisma.subscription_plan, 'findFirst')
        .mockResolvedValue(mockSubscriptionPlan as any);

      // Mock subdomain check
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue(null);

      // Mock transaction - simulate what happens inside the transaction
      mockTransaction.mockImplementation(async (callback) => {
        const mockTx = {
          tenant: {
            create: jest.fn().mockResolvedValue(mockTenant),
          },
          tenant_business_hours: {
            create: jest.fn().mockResolvedValue({}),
          },
          appointment_type: {
            create: jest.fn().mockResolvedValue(mockAppointmentType),
          },
          appointment_type_schedule: {
            create: jest.fn().mockResolvedValue({}),
          },
        };

        return callback(mockTx);
      });

      // Execute
      const result = await service.create(createTenantDto);

      // Verify tenant was created
      expect(result).toEqual(mockTenant);

      // Verify transaction was called
      expect(mockTransaction).toHaveBeenCalled();

      // Verify audit log was called
      expect(mockAuditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'tenant',
          entityId: 'tenant-123',
        }),
      );
    });

    it('should create appointment type with correct default values', async () => {
      const createTenantDto = {
        subdomain: 'test-tenant-2',
        company_name: 'Test Company 2',
        legal_business_name: 'Test Company 2 LLC',
        business_entity_type: BusinessEntityType.LLC,
        state_of_registration: 'CA',
        ein: '98-7654321',
        primary_contact_phone: '5559876543',
        primary_contact_email: 'test2@example.com',
      };

      let appointmentTypeData: any;

      jest.spyOn(prisma.subscription_plan, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue(null);

      mockTransaction.mockImplementation(async (callback) => {
        const mockTx = {
          tenant: {
            create: jest.fn().mockResolvedValue({ id: 'tenant-456' }),
          },
          tenant_business_hours: {
            create: jest.fn().mockResolvedValue({}),
          },
          appointment_type: {
            create: jest.fn().mockImplementation(({ data }) => {
              appointmentTypeData = data;
              return Promise.resolve({ id: 'appt-type-456', ...data });
            }),
          },
          appointment_type_schedule: {
            create: jest.fn().mockResolvedValue({}),
          },
        };

        return callback(mockTx);
      });

      await service.create(createTenantDto);

      // Verify appointment type has correct values
      expect(appointmentTypeData).toMatchObject({
        tenant_id: 'tenant-456',
        name: 'Quote Visit',
        description:
          'Schedule a quote visit with the customer to assess the job',
        slot_duration_minutes: 60,
        max_lookahead_weeks: 8,
        reminder_24h_enabled: true,
        reminder_1h_enabled: true,
        is_active: true,
        is_default: true,
        created_by_user_id: null,
      });
    });

    it('should create 7 schedule rows with correct default availability', async () => {
      const createTenantDto = {
        subdomain: 'test-tenant-3',
        company_name: 'Test Company 3',
        legal_business_name: 'Test Company 3 LLC',
        business_entity_type: BusinessEntityType.LLC,
        state_of_registration: 'TX',
        ein: '11-2233445',
        primary_contact_phone: '5551112222',
        primary_contact_email: 'test3@example.com',
      };

      const scheduleCreates: any[] = [];

      jest.spyOn(prisma.subscription_plan, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue(null);

      mockTransaction.mockImplementation(async (callback) => {
        const mockTx = {
          tenant: {
            create: jest.fn().mockResolvedValue({ id: 'tenant-789' }),
          },
          tenant_business_hours: {
            create: jest.fn().mockResolvedValue({}),
          },
          appointment_type: {
            create: jest.fn().mockResolvedValue({ id: 'appt-type-789' }),
          },
          appointment_type_schedule: {
            create: jest.fn().mockImplementation(({ data }) => {
              scheduleCreates.push(data);
              return Promise.resolve({
                id: `schedule-${scheduleCreates.length}`,
                ...data,
              });
            }),
          },
        };

        return callback(mockTx);
      });

      await service.create(createTenantDto);

      // Verify 7 schedule rows were created
      expect(scheduleCreates).toHaveLength(7);

      // Verify Sunday (0) is not available
      const sunday = scheduleCreates.find((s) => s.day_of_week === 0);
      expect(sunday).toMatchObject({
        day_of_week: 0,
        is_available: false,
        window1_start: null,
        window1_end: null,
      });

      // Verify Monday (1) is available 9 AM - 5 PM
      const monday = scheduleCreates.find((s) => s.day_of_week === 1);
      expect(monday).toMatchObject({
        day_of_week: 1,
        is_available: true,
        window1_start: '09:00',
        window1_end: '17:00',
      });

      // Verify Tuesday (2) is available 9 AM - 5 PM
      const tuesday = scheduleCreates.find((s) => s.day_of_week === 2);
      expect(tuesday).toMatchObject({
        day_of_week: 2,
        is_available: true,
        window1_start: '09:00',
        window1_end: '17:00',
      });

      // Verify Wednesday (3) is available 9 AM - 5 PM
      const wednesday = scheduleCreates.find((s) => s.day_of_week === 3);
      expect(wednesday).toMatchObject({
        day_of_week: 3,
        is_available: true,
        window1_start: '09:00',
        window1_end: '17:00',
      });

      // Verify Thursday (4) is available 9 AM - 5 PM
      const thursday = scheduleCreates.find((s) => s.day_of_week === 4);
      expect(thursday).toMatchObject({
        day_of_week: 4,
        is_available: true,
        window1_start: '09:00',
        window1_end: '17:00',
      });

      // Verify Friday (5) is available 9 AM - 5 PM
      const friday = scheduleCreates.find((s) => s.day_of_week === 5);
      expect(friday).toMatchObject({
        day_of_week: 5,
        is_available: true,
        window1_start: '09:00',
        window1_end: '17:00',
      });

      // Verify Saturday (6) is not available
      const saturday = scheduleCreates.find((s) => s.day_of_week === 6);
      expect(saturday).toMatchObject({
        day_of_week: 6,
        is_available: false,
        window1_start: null,
        window1_end: null,
      });
    });

    it('should use transaction to ensure atomic creation', async () => {
      const createTenantDto = {
        subdomain: 'test-atomic',
        company_name: 'Test Atomic',
        legal_business_name: 'Test Atomic LLC',
        business_entity_type: BusinessEntityType.LLC,
        state_of_registration: 'FL',
        ein: '55-6677889',
        primary_contact_phone: '5553334444',
        primary_contact_email: 'atomic@example.com',
      };

      jest.spyOn(prisma.subscription_plan, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue(null);

      mockTransaction.mockImplementation(async (callback) => {
        const mockTx = {
          tenant: {
            create: jest.fn().mockResolvedValue({ id: 'tenant-atomic' }),
          },
          tenant_business_hours: {
            create: jest.fn().mockResolvedValue({}),
          },
          appointment_type: {
            create: jest.fn().mockResolvedValue({ id: 'appt-type-atomic' }),
          },
          appointment_type_schedule: {
            create: jest.fn().mockResolvedValue({}),
          },
        };

        return callback(mockTx);
      });

      await service.create(createTenantDto);

      // Verify transaction was used
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should throw ConflictException if subdomain is already taken', async () => {
      const createTenantDto = {
        subdomain: 'existing-subdomain',
        company_name: 'Test Company',
        legal_business_name: 'Test Company LLC',
        business_entity_type: BusinessEntityType.LLC,
        state_of_registration: 'NY',
        ein: '12-3456789',
        primary_contact_phone: '5551234567',
        primary_contact_email: 'test@example.com',
      };

      // Mock existing tenant with same subdomain
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue({
        id: 'existing-tenant',
        subdomain: 'existing-subdomain',
      } as any);

      await expect(service.create(createTenantDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if EIN is already registered', async () => {
      const createTenantDto = {
        subdomain: 'new-subdomain',
        company_name: 'Test Company',
        legal_business_name: 'Test Company LLC',
        business_entity_type: BusinessEntityType.LLC,
        state_of_registration: 'NY',
        ein: '12-3456789',
        primary_contact_phone: '5551234567',
        primary_contact_email: 'test@example.com',
      };

      // Mock subdomain check (available)
      jest
        .spyOn(prisma.tenant, 'findUnique')
        .mockResolvedValueOnce(null) // subdomain check
        .mockResolvedValueOnce({
          id: 'existing-tenant',
          ein: '12-3456789',
        } as any); // EIN check

      await expect(service.create(createTenantDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
