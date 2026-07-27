import {
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../core/database/prisma.service';

jest.mock('bcrypt', () => ({
  __esModule: true,
  compare: jest.fn(),
}));

const bcryptCompareMock = bcrypt.compare as unknown as jest.Mock;
import { NotificationsService } from '../../communication/services/notifications.service';
import { LocationSourceEnum } from '../dto/clock-session.dto';
import { ClockSessionService } from './clock-session.service';
import { KioskService } from './kiosk.service';

const TENANT_ID = 'tenant-uuid-0000';
const OTHER_TENANT_ID = 'tenant-uuid-9999';
const EMPLOYEE_ID = 'profile-uuid-0000';
const USER_ID = 'user-uuid-0000';
const PIN_HASH = '$bcrypt-hash$';
const KIOSK_TOKEN_HASH = '$bcrypt-kiosk-hash$';

const buildPrismaMock = () => ({
  employee_profile: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  clock_session: {
    findMany: jest.fn(),
  },
  user_tenant_membership: {
    findMany: jest.fn(),
  },
});

type PrismaMock = ReturnType<typeof buildPrismaMock>;

const buildEmployee = (
  overrides: Partial<{
    failedAttempts: number;
    lockedUntil: Date | null;
    pinHash: string | null;
  }> = {},
) => ({
  id: EMPLOYEE_ID,
  user_id: USER_ID,
  kiosk_pin_hash:
    overrides.pinHash === undefined ? PIN_HASH : overrides.pinHash,
  kiosk_pin_failed_attempts: overrides.failedAttempts ?? 0,
  kiosk_pin_locked_until:
    overrides.lockedUntil === undefined ? null : overrides.lockedUntil,
  user: { first_name: 'John', last_name: 'Doe' },
});

describe('KioskService', () => {
  let service: KioskService;
  let prisma: PrismaMock;
  let clockSessionService: { clockIn: jest.Mock; clockOut: jest.Mock };
  let notificationsService: { createNotification: jest.Mock };

  beforeEach(async () => {
    bcryptCompareMock.mockReset();
    prisma = buildPrismaMock();
    clockSessionService = {
      clockIn: jest.fn().mockResolvedValue({ id: 'session-1' }),
      clockOut: jest.fn().mockResolvedValue({ id: 'session-1' }),
    };
    notificationsService = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KioskService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockSessionService, useValue: clockSessionService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = module.get<KioskService>(KioskService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────
  describe('getEmployees', () => {
    it('returns empty array when no kiosk-eligible employees', async () => {
      prisma.employee_profile.findMany.mockResolvedValue([]);

      const result = await service.getEmployees(TENANT_ID);

      expect(result).toEqual({ data: [] });
      expect(prisma.employee_profile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            is_active: true,
            kiosk_pin_hash: { not: null },
          }),
        }),
      );
    });

    it('truncates last name to initial + period and flags clocked-in employees', async () => {
      prisma.employee_profile.findMany.mockResolvedValue([
        { id: 'emp-1', user: { first_name: 'Jane', last_name: 'Smith' } },
        { id: 'emp-2', user: { first_name: 'Bob', last_name: 'Jones' } },
      ]);
      prisma.clock_session.findMany.mockResolvedValue([
        { employee_profile_id: 'emp-1' },
      ]);

      const result = await service.getEmployees(TENANT_ID);

      expect(result.data).toEqual([
        {
          id: 'emp-1',
          user: { first_name: 'Jane', last_name: 'S.' },
          has_pin: true,
          is_clocked_in: true,
        },
        {
          id: 'emp-2',
          user: { first_name: 'Bob', last_name: 'J.' },
          has_pin: true,
          is_clocked_in: false,
        },
      ]);
      expect(prisma.clock_session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            employee_profile_id: { in: ['emp-1', 'emp-2'] },
            status: { in: ['active', 'on_break'] },
          }),
        }),
      );
    });
  });

  // ──────────────────────────────────────────────────────────────
  describe('clockIn', () => {
    const dto = { employee_profile_id: EMPLOYEE_ID, pin: '1234' };

    it('rejects cross-tenant employee lookup with NotFoundException', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(null);

      await expect(
        service.clockIn(OTHER_TENANT_ID, dto, KIOSK_TOKEN_HASH),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.employee_profile.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: EMPLOYEE_ID,
            tenant_id: OTHER_TENANT_ID,
            is_active: true,
          }),
        }),
      );
      expect(clockSessionService.clockIn).not.toHaveBeenCalled();
    });

    it('blocks locked-out employees with HTTP 423', async () => {
      const future = new Date(Date.now() + 60_000);
      prisma.employee_profile.findFirst.mockResolvedValue(
        buildEmployee({ lockedUntil: future }),
      );

      await expect(
        service.clockIn(TENANT_ID, dto, KIOSK_TOKEN_HASH),
      ).rejects.toMatchObject({
        status: HttpStatus.LOCKED,
      });
    });

    it('rejects wrong PIN with remaining_attempts payload', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(
        buildEmployee({ failedAttempts: 0 }),
      );
      prisma.employee_profile.update.mockResolvedValue({});
      bcryptCompareMock.mockResolvedValue(false);

      await expect(
        service.clockIn(TENANT_ID, dto, KIOSK_TOKEN_HASH),
      ).rejects.toMatchObject({
        response: { message: 'Invalid PIN', remaining_attempts: 4 },
      });

      expect(prisma.employee_profile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: EMPLOYEE_ID },
          data: expect.objectContaining({ kiosk_pin_failed_attempts: 1 }),
        }),
      );
      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });

    it('locks account and notifies admins on the 5th failed PIN attempt', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(
        buildEmployee({ failedAttempts: 4 }),
      );
      prisma.employee_profile.update.mockResolvedValue({});
      prisma.user_tenant_membership.findMany.mockResolvedValue([
        { user_id: 'admin-1' },
        { user_id: 'admin-2' },
      ]);
      bcryptCompareMock.mockResolvedValue(false);

      await expect(
        service.clockIn(TENANT_ID, dto, KIOSK_TOKEN_HASH),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      const updateCall = prisma.employee_profile.update.mock.calls[0][0];
      expect(updateCall.data.kiosk_pin_failed_attempts).toBe(5);
      expect(updateCall.data.kiosk_pin_locked_until).toBeInstanceOf(Date);

      expect(notificationsService.createNotification).toHaveBeenCalledTimes(2);
      expect(notificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          type: 'timeclock_kiosk_lockout',
          title: 'Kiosk Account Locked',
          action_url: '/settings/time-clock',
        }),
      );
      expect(prisma.user_tenant_membership.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            status: 'ACTIVE',
            role: { name: { in: ['Owner', 'Admin'] } },
          }),
        }),
      );
    });

    it('delegates to ClockSessionService.clockIn with kiosk location source on success', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(
        buildEmployee({ failedAttempts: 0 }),
      );
      prisma.employee_profile.update.mockResolvedValue({});
      bcryptCompareMock.mockResolvedValue(true);

      await service.clockIn(
        TENANT_ID,
        {
          employee_profile_id: EMPLOYEE_ID,
          pin: '1234',
          project_id: 'project-1',
          task_id: 'task-1',
          notes: 'Starting morning shift',
        },
        KIOSK_TOKEN_HASH,
      );

      expect(clockSessionService.clockIn).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        expect.objectContaining({
          project_id: 'project-1',
          task_id: 'task-1',
          notes: 'Starting morning shift',
          location_source: LocationSourceEnum.KIOSK,
        }),
      );
    });

    it('resets failed attempts counter only when previously non-zero', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(
        buildEmployee({ failedAttempts: 0 }),
      );
      bcryptCompareMock.mockResolvedValue(true);

      await service.clockIn(TENANT_ID, dto, KIOSK_TOKEN_HASH);

      expect(prisma.employee_profile.update).not.toHaveBeenCalled();
    });

    it('clears lockout when previously failed attempts > 0 on successful PIN', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(
        buildEmployee({ failedAttempts: 3 }),
      );
      prisma.employee_profile.update.mockResolvedValue({});
      bcryptCompareMock.mockResolvedValue(true);

      await service.clockIn(TENANT_ID, dto, KIOSK_TOKEN_HASH);

      expect(prisma.employee_profile.update).toHaveBeenCalledWith({
        where: { id: EMPLOYEE_ID },
        data: { kiosk_pin_failed_attempts: 0, kiosk_pin_locked_until: null },
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  describe('clockOut', () => {
    const dto = { employee_profile_id: EMPLOYEE_ID, pin: '1234' };

    it('delegates to ClockSessionService.clockOut with kiosk location source', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(
        buildEmployee({ failedAttempts: 0 }),
      );
      bcryptCompareMock.mockResolvedValue(true);

      await service.clockOut(
        TENANT_ID,
        { employee_profile_id: EMPLOYEE_ID, pin: '1234', notes: 'Done' },
        KIOSK_TOKEN_HASH,
      );

      expect(clockSessionService.clockOut).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        expect.objectContaining({
          notes: 'Done',
          location_source: LocationSourceEnum.KIOSK,
        }),
      );
    });

    it('rejects locked employee', async () => {
      const future = new Date(Date.now() + 60_000);
      prisma.employee_profile.findFirst.mockResolvedValue(
        buildEmployee({ lockedUntil: future }),
      );

      await expect(
        service.clockOut(TENANT_ID, dto, KIOSK_TOKEN_HASH),
      ).rejects.toMatchObject({ status: HttpStatus.LOCKED });
      expect(clockSessionService.clockOut).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────
  describe('rate limiting', () => {
    const dto = { employee_profile_id: EMPLOYEE_ID, pin: '1234' };

    it('blocks 11th attempt within 60s window', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(
        buildEmployee({ failedAttempts: 0 }),
      );
      bcryptCompareMock.mockResolvedValue(true);

      // 10 successful calls in tight window
      for (let i = 0; i < 10; i += 1) {
        await service.clockIn(TENANT_ID, dto, KIOSK_TOKEN_HASH);
      }

      await expect(
        service.clockIn(TENANT_ID, dto, KIOSK_TOKEN_HASH),
      ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    });

    it('throws HttpException with status 429 on rate limit', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(
        buildEmployee({ failedAttempts: 0 }),
      );
      bcryptCompareMock.mockResolvedValue(true);

      for (let i = 0; i < 10; i += 1) {
        await service.clockIn(TENANT_ID, dto, 'token-burst');
      }

      try {
        await service.clockIn(TENANT_ID, dto, 'token-burst');
        fail('expected rate limit to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    });

    it('isolates rate limits by token', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(
        buildEmployee({ failedAttempts: 0 }),
      );
      bcryptCompareMock.mockResolvedValue(true);

      for (let i = 0; i < 10; i += 1) {
        await service.clockIn(TENANT_ID, dto, 'token-A');
      }

      // Different token should still succeed
      await expect(
        service.clockIn(TENANT_ID, dto, 'token-B'),
      ).resolves.toBeDefined();
    });
  });

  // ──────────────────────────────────────────────────────────────
  describe('multi-tenant isolation', () => {
    it('always passes tenantId from guard, never from DTO', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(null);

      await expect(
        service.clockIn(
          TENANT_ID,
          { employee_profile_id: EMPLOYEE_ID, pin: '1234' },
          KIOSK_TOKEN_HASH,
        ),
      ).rejects.toThrow(NotFoundException);

      const findCall = prisma.employee_profile.findFirst.mock.calls[0][0];
      expect(findCall.where.tenant_id).toBe(TENANT_ID);
    });
  });
});
