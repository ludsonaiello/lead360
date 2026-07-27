import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { EmployeeProfileService } from './employee-profile.service';

const TENANT_ID = 'tenant-uuid-001';
const PROFILE_ID = 'profile-uuid-001';
const USER_ID = 'user-uuid-001';

const baseProfileRecord = (overrides: Record<string, unknown> = {}) => ({
  id: PROFILE_ID,
  tenant_id: TENANT_ID,
  user_id: USER_ID,
  crew_member_id: null,
  hourly_rate: null,
  overtime_rule_override: false,
  overtime_daily_threshold_hours: null,
  overtime_weekly_threshold_hours: null,
  kiosk_pin_hash: '$bcrypt-hash$',
  kiosk_pin_failed_attempts: 0,
  kiosk_pin_locked_until: null,
  is_active: true,
  push_subscription_json: null,
  push_token_native: null,
  created_at: new Date('2026-04-12T10:00:00.000Z'),
  updated_at: new Date('2026-04-12T10:00:00.000Z'),
  user: {
    id: USER_ID,
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane@example.com',
  },
  crew_member: null,
  ...overrides,
});

const mockPrismaService = {
  employee_profile: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user_tenant_membership: {
    findFirst: jest.fn(),
  },
  crew_member: {
    findFirst: jest.fn(),
  },
};

const mockAuditLoggerService = {
  logTenantChange: jest.fn(),
};

describe('EmployeeProfileService — derived response fields', () => {
  let service: EmployeeProfileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeeProfileService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditLoggerService, useValue: mockAuditLoggerService },
      ],
    }).compile();

    service = module.get<EmployeeProfileService>(EmployeeProfileService);
    jest.clearAllMocks();
  });

  describe('findAll()', () => {
    it('should include has_pin and is_locked on every row and never leak kiosk_pin_hash', async () => {
      const records = [
        baseProfileRecord({
          id: 'p1',
          kiosk_pin_hash: '$bcrypt-hash-a$',
          kiosk_pin_locked_until: null,
        }),
        baseProfileRecord({
          id: 'p2',
          kiosk_pin_hash: null,
          kiosk_pin_locked_until: null,
        }),
        baseProfileRecord({
          id: 'p3',
          kiosk_pin_hash: '$bcrypt-hash-c$',
          kiosk_pin_locked_until: new Date(Date.now() + 60_000),
        }),
        baseProfileRecord({
          id: 'p4',
          kiosk_pin_hash: '$bcrypt-hash-d$',
          kiosk_pin_locked_until: new Date(Date.now() - 60_000),
        }),
      ];

      mockPrismaService.employee_profile.findMany.mockResolvedValue(records);
      mockPrismaService.employee_profile.count.mockResolvedValue(
        records.length,
      );

      const result = await service.findAll(TENANT_ID, {});

      expect(result.data).toHaveLength(4);

      result.data.forEach((row) => {
        expect(row).toHaveProperty('has_pin');
        expect(row).toHaveProperty('is_locked');
        expect(row).not.toHaveProperty('kiosk_pin_hash');
        expect(row).not.toHaveProperty('push_subscription_json');
      });

      const serialized = JSON.stringify(result.data);
      expect(serialized).not.toContain('kiosk_pin_hash');
      expect(serialized).not.toContain('$bcrypt-hash');

      const [p1, p2, p3, p4] = result.data as Array<{
        has_pin: boolean;
        is_locked: boolean;
      }>;

      expect(p1).toMatchObject({ has_pin: true, is_locked: false });
      expect(p2).toMatchObject({ has_pin: false, is_locked: false });
      expect(p3).toMatchObject({ has_pin: true, is_locked: true });
      expect(p4).toMatchObject({ has_pin: true, is_locked: false });

      expect(mockPrismaService.employee_profile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenant_id: TENANT_ID },
        }),
      );
    });
  });

  describe('findOne()', () => {
    it('should include has_pin and is_locked and never leak kiosk_pin_hash', async () => {
      mockPrismaService.employee_profile.findFirst.mockResolvedValue(
        baseProfileRecord({
          kiosk_pin_hash: '$bcrypt-hash$',
          kiosk_pin_locked_until: new Date(Date.now() + 5 * 60_000),
        }),
      );

      const result = await service.findOne(TENANT_ID, PROFILE_ID);

      expect(result).toHaveProperty('has_pin', true);
      expect(result).toHaveProperty('is_locked', true);
      expect(result).not.toHaveProperty('kiosk_pin_hash');
      expect(result).not.toHaveProperty('push_subscription_json');

      expect(JSON.stringify(result)).not.toContain('kiosk_pin_hash');
      expect(JSON.stringify(result)).not.toContain('$bcrypt-hash');

      expect(mockPrismaService.employee_profile.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PROFILE_ID, tenant_id: TENANT_ID },
        }),
      );
    });

    it('should report has_pin=false when kiosk_pin_hash is null and is_locked=false when lock is in the past', async () => {
      mockPrismaService.employee_profile.findFirst.mockResolvedValue(
        baseProfileRecord({
          kiosk_pin_hash: null,
          kiosk_pin_locked_until: new Date(Date.now() - 10 * 60_000),
        }),
      );

      const result = await service.findOne(TENANT_ID, PROFILE_ID);

      expect(result).toMatchObject({ has_pin: false, is_locked: false });
      expect(result).not.toHaveProperty('kiosk_pin_hash');
    });
  });
});
