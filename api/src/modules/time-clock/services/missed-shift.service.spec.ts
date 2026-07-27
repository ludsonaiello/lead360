import { Test, TestingModule } from '@nestjs/testing';
import { MissedShiftService } from './missed-shift.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { NotificationsService } from '../../communication/services/notifications.service';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const SHIFT_ID = '33333333-3333-3333-3333-333333333333';
const EMPLOYEE_PROFILE_ID = '44444444-4444-4444-4444-444444444444';
const EMPLOYEE_USER_ID = '55555555-5555-5555-5555-555555555555';
const ADMIN_USER_ID_1 = '66666666-6666-6666-6666-666666666666';
const ADMIN_USER_ID_2 = '77777777-7777-7777-7777-777777777777';

const buildShift = (overrides: Record<string, unknown> = {}) => ({
  id: SHIFT_ID,
  tenant_id: TENANT_A,
  employee_profile_id: EMPLOYEE_PROFILE_ID,
  scheduled_start: new Date(Date.now() - 60 * 60 * 1000),
  status: 'scheduled',
  employee_profile: {
    id: EMPLOYEE_PROFILE_ID,
    user: {
      id: EMPLOYEE_USER_ID,
      first_name: 'Jane',
      last_name: 'Doe',
    },
  },
  ...overrides,
});

const buildPrismaMock = () => ({
  tenant: { findMany: jest.fn() },
  time_clock_settings: { findFirst: jest.fn() },
  work_shift: { findMany: jest.fn(), update: jest.fn() },
  clock_session: { findFirst: jest.fn() },
  user: { findMany: jest.fn() },
});

const buildNotificationsMock = () => ({
  createNotification: jest.fn().mockResolvedValue({ id: 'notif-id' }),
});

describe('MissedShiftService', () => {
  let service: MissedShiftService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let notifications: ReturnType<typeof buildNotificationsMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    notifications = buildNotificationsMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MissedShiftService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(MissedShiftService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectMissedShifts', () => {
    it('skips tenants without time_clock_settings', async () => {
      prisma.tenant.findMany.mockResolvedValue([{ id: TENANT_A }]);
      prisma.time_clock_settings.findFirst.mockResolvedValue(null);

      await service.detectMissedShifts();

      expect(prisma.work_shift.findMany).not.toHaveBeenCalled();
      expect(prisma.work_shift.update).not.toHaveBeenCalled();
    });

    it('skips tenants whose threshold is null/zero', async () => {
      prisma.tenant.findMany.mockResolvedValue([{ id: TENANT_A }]);
      prisma.time_clock_settings.findFirst.mockResolvedValue({
        missed_shift_threshold_minutes: 0,
      });

      await service.detectMissedShifts();

      expect(prisma.work_shift.findMany).not.toHaveBeenCalled();
    });

    it('marks shift as missed and notifies admins + employee when no session exists', async () => {
      prisma.tenant.findMany.mockResolvedValue([{ id: TENANT_A }]);
      prisma.time_clock_settings.findFirst.mockResolvedValue({
        missed_shift_threshold_minutes: 30,
      });
      prisma.work_shift.findMany.mockResolvedValue([buildShift()]);
      prisma.clock_session.findFirst.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([
        { id: ADMIN_USER_ID_1 },
        { id: ADMIN_USER_ID_2 },
      ]);

      await service.detectMissedShifts();

      expect(prisma.work_shift.update).toHaveBeenCalledWith({
        where: { id: SHIFT_ID },
        data: { status: 'missed' },
      });

      // 2 admin notifications + 1 employee notification = 3
      expect(notifications.createNotification).toHaveBeenCalledTimes(3);

      const calls = notifications.createNotification.mock.calls.map(
        (c) => c[0],
      );
      expect(calls.every((c) => c.tenant_id === TENANT_A)).toBe(true);
      expect(calls.every((c) => c.type === 'timeclock_missed_shift')).toBe(
        true,
      );
      expect(calls.find((c) => c.user_id === ADMIN_USER_ID_1)).toBeDefined();
      expect(calls.find((c) => c.user_id === ADMIN_USER_ID_2)).toBeDefined();
      expect(calls.find((c) => c.user_id === EMPLOYEE_USER_ID)).toBeDefined();
    });

    it('does NOT mark shift as missed when a session is matched by work_shift_id', async () => {
      prisma.tenant.findMany.mockResolvedValue([{ id: TENANT_A }]);
      prisma.time_clock_settings.findFirst.mockResolvedValue({
        missed_shift_threshold_minutes: 30,
      });
      prisma.work_shift.findMany.mockResolvedValue([buildShift()]);
      prisma.clock_session.findFirst.mockResolvedValue({ id: 'session-1' });
      prisma.user.findMany.mockResolvedValue([{ id: ADMIN_USER_ID_1 }]);

      await service.detectMissedShifts();

      expect(prisma.work_shift.update).not.toHaveBeenCalled();
      expect(notifications.createNotification).not.toHaveBeenCalled();
    });

    it('always passes tenant_id when querying clock_session and work_shift', async () => {
      prisma.tenant.findMany.mockResolvedValue([{ id: TENANT_A }]);
      prisma.time_clock_settings.findFirst.mockResolvedValue({
        missed_shift_threshold_minutes: 30,
      });
      prisma.work_shift.findMany.mockResolvedValue([buildShift()]);
      prisma.clock_session.findFirst.mockResolvedValue(null);
      prisma.user.findMany.mockResolvedValue([]);

      await service.detectMissedShifts();

      expect(prisma.work_shift.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_A }),
        }),
      );
      expect(prisma.clock_session.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_A }),
        }),
      );
    });

    it('continues processing remaining tenants when one tenant fails', async () => {
      prisma.tenant.findMany.mockResolvedValue([
        { id: TENANT_A },
        { id: TENANT_B },
      ]);
      prisma.time_clock_settings.findFirst
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ missed_shift_threshold_minutes: 30 });
      prisma.work_shift.findMany.mockResolvedValue([]);

      await expect(service.detectMissedShifts()).resolves.not.toThrow();

      expect(prisma.time_clock_settings.findFirst).toHaveBeenCalledTimes(2);
      expect(prisma.work_shift.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.work_shift.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_B }),
        }),
      );
    });

    it('only loads ACTIVE non-deleted tenants', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);

      await service.detectMissedShifts();

      expect(prisma.tenant.findMany).toHaveBeenCalledWith({
        where: { is_active: true, deleted_at: null },
        select: { id: true },
      });
    });
  });
});
