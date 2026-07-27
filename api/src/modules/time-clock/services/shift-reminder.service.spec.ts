import { Test, TestingModule } from '@nestjs/testing';
import { ShiftReminderService } from './shift-reminder.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { NotificationsService } from '../../communication/services/notifications.service';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const SHIFT_ID = '33333333-3333-3333-3333-333333333333';
const EMPLOYEE_PROFILE_ID = '44444444-4444-4444-4444-444444444444';
const EMPLOYEE_USER_ID = '55555555-5555-5555-5555-555555555555';

const buildShift = (overrides: Record<string, unknown> = {}) => ({
  id: SHIFT_ID,
  tenant_id: TENANT_A,
  employee_profile_id: EMPLOYEE_PROFILE_ID,
  scheduled_start: new Date(Date.now() + 15 * 60 * 1000),
  reminder_sent_at: null,
  published_at: new Date(Date.now() - 60 * 60 * 1000),
  status: 'scheduled',
  employee_profile: {
    id: EMPLOYEE_PROFILE_ID,
    user: {
      id: EMPLOYEE_USER_ID,
      first_name: 'Jane',
      last_name: 'Doe',
    },
  },
  project: { name: 'Roof Replacement' },
  ...overrides,
});

const buildPrismaMock = () => ({
  tenant: { findMany: jest.fn() },
  time_clock_settings: { findFirst: jest.fn() },
  work_shift: { findMany: jest.fn(), updateMany: jest.fn() },
});

const buildNotificationsMock = () => ({
  createNotification: jest.fn().mockResolvedValue({ id: 'notif-id' }),
});

describe('ShiftReminderService', () => {
  let service: ShiftReminderService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let notifications: ReturnType<typeof buildNotificationsMock>;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    notifications = buildNotificationsMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShiftReminderService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(ShiftReminderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendReminders', () => {
    it('skips tenants without time_clock_settings', async () => {
      prisma.tenant.findMany.mockResolvedValue([{ id: TENANT_A }]);
      prisma.time_clock_settings.findFirst.mockResolvedValue(null);

      await service.sendReminders();

      expect(prisma.work_shift.findMany).not.toHaveBeenCalled();
    });

    it('skips tenants whose reminder lead time is null/zero', async () => {
      prisma.tenant.findMany.mockResolvedValue([{ id: TENANT_A }]);
      prisma.time_clock_settings.findFirst.mockResolvedValue({
        shift_reminder_minutes: 0,
      });

      await service.sendReminders();

      expect(prisma.work_shift.findMany).not.toHaveBeenCalled();
    });

    it('queries only published, non-reminded scheduled shifts within the window', async () => {
      prisma.tenant.findMany.mockResolvedValue([{ id: TENANT_A }]);
      prisma.time_clock_settings.findFirst.mockResolvedValue({
        shift_reminder_minutes: 30,
      });
      prisma.work_shift.findMany.mockResolvedValue([]);

      await service.sendReminders();

      const findManyArgs = prisma.work_shift.findMany.mock.calls[0][0];
      expect(findManyArgs.where).toEqual(
        expect.objectContaining({
          tenant_id: TENANT_A,
          status: 'scheduled',
          reminder_sent_at: null,
          published_at: { not: null },
        }),
      );
      expect(findManyArgs.where.scheduled_start).toBeDefined();
    });

    it('stamps reminder_sent_at BEFORE sending notification (at-most-once)', async () => {
      prisma.tenant.findMany.mockResolvedValue([{ id: TENANT_A }]);
      prisma.time_clock_settings.findFirst.mockResolvedValue({
        shift_reminder_minutes: 30,
      });
      prisma.work_shift.findMany.mockResolvedValue([buildShift()]);
      prisma.work_shift.updateMany.mockResolvedValue({ count: 1 });

      const callOrder: string[] = [];
      prisma.work_shift.updateMany.mockImplementation(async () => {
        callOrder.push('updateMany');
        return { count: 1 };
      });
      notifications.createNotification.mockImplementation(async () => {
        callOrder.push('notify');
        return { id: 'notif-id' };
      });

      await service.sendReminders();

      expect(callOrder).toEqual(['updateMany', 'notify']);
      expect(prisma.work_shift.updateMany).toHaveBeenCalledWith({
        where: {
          id: SHIFT_ID,
          tenant_id: TENANT_A,
          reminder_sent_at: null,
        },
        data: { reminder_sent_at: expect.any(Date) },
      });
    });

    it('does not send notification when another worker already stamped the row', async () => {
      prisma.tenant.findMany.mockResolvedValue([{ id: TENANT_A }]);
      prisma.time_clock_settings.findFirst.mockResolvedValue({
        shift_reminder_minutes: 30,
      });
      prisma.work_shift.findMany.mockResolvedValue([buildShift()]);
      prisma.work_shift.updateMany.mockResolvedValue({ count: 0 });

      await service.sendReminders();

      expect(notifications.createNotification).not.toHaveBeenCalled();
    });

    it('sends a single reminder per shift to the assigned employee', async () => {
      prisma.tenant.findMany.mockResolvedValue([{ id: TENANT_A }]);
      prisma.time_clock_settings.findFirst.mockResolvedValue({
        shift_reminder_minutes: 30,
      });
      prisma.work_shift.findMany.mockResolvedValue([buildShift()]);
      prisma.work_shift.updateMany.mockResolvedValue({ count: 1 });

      await service.sendReminders();

      expect(notifications.createNotification).toHaveBeenCalledTimes(1);
      const payload = notifications.createNotification.mock.calls[0][0];
      expect(payload).toEqual(
        expect.objectContaining({
          tenant_id: TENANT_A,
          user_id: EMPLOYEE_USER_ID,
          type: 'timeclock_shift_reminder',
          title: 'Upcoming Shift',
          related_entity_type: 'work_shift',
          related_entity_id: SHIFT_ID,
        }),
      );
      expect(payload.message).toContain('Roof Replacement');
    });

    it('uses "Unassigned" project label when shift has no project', async () => {
      prisma.tenant.findMany.mockResolvedValue([{ id: TENANT_A }]);
      prisma.time_clock_settings.findFirst.mockResolvedValue({
        shift_reminder_minutes: 30,
      });
      prisma.work_shift.findMany.mockResolvedValue([
        buildShift({ project: null }),
      ]);
      prisma.work_shift.updateMany.mockResolvedValue({ count: 1 });

      await service.sendReminders();

      const payload = notifications.createNotification.mock.calls[0][0];
      expect(payload.message).toContain('Unassigned');
    });

    it('continues processing remaining tenants when one tenant throws', async () => {
      prisma.tenant.findMany.mockResolvedValue([
        { id: TENANT_A },
        { id: TENANT_B },
      ]);
      prisma.time_clock_settings.findFirst
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ shift_reminder_minutes: 30 });
      prisma.work_shift.findMany.mockResolvedValue([]);

      await expect(service.sendReminders()).resolves.not.toThrow();

      expect(prisma.work_shift.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.work_shift.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_B }),
        }),
      );
    });

    it('only loads ACTIVE non-deleted tenants', async () => {
      prisma.tenant.findMany.mockResolvedValue([]);

      await service.sendReminders();

      expect(prisma.tenant.findMany).toHaveBeenCalledWith({
        where: { is_active: true, deleted_at: null },
        select: { id: true },
      });
    });
  });
});
