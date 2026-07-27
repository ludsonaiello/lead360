import { Test, TestingModule } from '@nestjs/testing';
import { LaborCostAttributionService } from './labor-cost-attribution.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { NotificationsService } from '../../communication/services/notifications.service';

const TENANT_ID = 'tenant-uuid-001';
const SESSION_ID = 'session-uuid-001';
const EMPLOYEE_PROFILE_ID = 'emp-uuid-001';
const USER_ID = 'user-uuid-001';
const CREW_MEMBER_ID = 'crew-uuid-001';
const PROJECT_ID = 'project-uuid-001';
const HOUR_LOG_ID = 'crew-hour-log-uuid-001';

const buildPrismaMock = () => ({
  crew_hour_log: {
    create: jest.fn(),
  },
  clock_session: {
    update: jest.fn(),
  },
  tenant: {
    findFirst: jest.fn(),
  },
  user_tenant_membership: {
    findMany: jest.fn(),
  },
});

type PrismaMock = ReturnType<typeof buildPrismaMock>;

const buildNotificationsMock = () => ({
  createNotification: jest.fn(),
});

type NotificationsMock = ReturnType<typeof buildNotificationsMock>;

const baseEmployee = (overrides: Record<string, unknown> = {}) => ({
  id: EMPLOYEE_PROFILE_ID,
  user_id: USER_ID,
  crew_member_id: CREW_MEMBER_ID,
  hourly_rate: 30,
  crew_member: {
    first_name: 'Jane',
    last_name: 'Doe',
    default_hourly_rate: 25,
  },
  user: {
    first_name: 'Jane',
    last_name: 'Doe',
  },
  ...overrides,
});

const baseSession = (overrides: Record<string, unknown> = {}) => ({
  id: SESSION_ID,
  project_id: PROJECT_ID,
  task_id: null,
  clock_in_at: new Date('2026-04-13T13:00:00.000Z'),
  regular_minutes: 420,
  overtime_minutes: 60,
  labor_cost_posted: false,
  ...overrides,
});

describe('LaborCostAttributionService', () => {
  let service: LaborCostAttributionService;
  let prisma: PrismaMock;
  let notifications: NotificationsMock;

  beforeEach(async () => {
    prisma = buildPrismaMock();
    notifications = buildNotificationsMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LaborCostAttributionService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get<LaborCostAttributionService>(
      LaborCostAttributionService,
    );

    prisma.tenant.findFirst.mockResolvedValue({
      timezone: 'America/New_York',
    });
    prisma.crew_hour_log.create.mockResolvedValue({ id: HOUR_LOG_ID });
    prisma.clock_session.update.mockResolvedValue({});
    prisma.user_tenant_membership.findMany.mockResolvedValue([
      { user_id: 'admin-uuid-1' },
      { user_id: 'admin-uuid-2' },
    ]);
  });

  it('skips when the session has no project_id', async () => {
    await service.postLaborCost(
      baseSession({ project_id: null }),
      baseEmployee(),
      TENANT_ID,
    );

    expect(prisma.crew_hour_log.create).not.toHaveBeenCalled();
    expect(prisma.clock_session.update).not.toHaveBeenCalled();
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });

  it('skips with warning when the employee has no crew_member_id', async () => {
    const warnSpy = jest
      .spyOn(service['logger'], 'warn')
      .mockImplementation(() => undefined);

    await service.postLaborCost(
      baseSession(),
      baseEmployee({ crew_member_id: null, crew_member: null }),
      TENANT_ID,
    );

    expect(prisma.crew_hour_log.create).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('no crew_member_id'),
    );
  });

  it('skips with warning when no hourly rate is available anywhere', async () => {
    const warnSpy = jest
      .spyOn(service['logger'], 'warn')
      .mockImplementation(() => undefined);

    await service.postLaborCost(
      baseSession(),
      baseEmployee({
        hourly_rate: null,
        crew_member: {
          first_name: 'Jane',
          last_name: 'Doe',
          default_hourly_rate: null,
        },
      }),
      TENANT_ID,
    );

    expect(prisma.crew_hour_log.create).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No hourly rate configured'),
    );
  });

  it('is idempotent: skips when labor_cost_posted is already true', async () => {
    await service.postLaborCost(
      baseSession({ labor_cost_posted: true }),
      baseEmployee(),
      TENANT_ID,
    );

    expect(prisma.crew_hour_log.create).not.toHaveBeenCalled();
    expect(prisma.clock_session.update).not.toHaveBeenCalled();
  });

  it('creates crew_hour_log with source=clockin_system and marks session posted', async () => {
    await service.postLaborCost(baseSession(), baseEmployee(), TENANT_ID);

    expect(prisma.crew_hour_log.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.crew_hour_log.create.mock.calls[0][0];
    expect(createArgs.data).toEqual(
      expect.objectContaining({
        tenant_id: TENANT_ID,
        crew_member_id: CREW_MEMBER_ID,
        project_id: PROJECT_ID,
        task_id: null,
        hours_regular: 7,
        hours_overtime: 1,
        source: 'clockin_system',
        clockin_event_id: SESSION_ID,
        created_by_user_id: USER_ID,
      }),
    );
    expect(createArgs.data.log_date).toBeInstanceOf(Date);

    expect(prisma.clock_session.update).toHaveBeenCalledWith({
      where: { id: SESSION_ID },
      data: {
        labor_cost_posted: true,
        labor_cost_entry_id: HOUR_LOG_ID,
      },
    });
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });

  it('uses the employee-level hourly_rate when present (still posts entry)', async () => {
    await service.postLaborCost(
      baseSession(),
      baseEmployee({
        hourly_rate: 42,
        crew_member: {
          first_name: 'Jane',
          last_name: 'Doe',
          default_hourly_rate: 20,
        },
      }),
      TENANT_ID,
    );

    expect(prisma.crew_hour_log.create).toHaveBeenCalledTimes(1);
  });

  it('falls back to crew_member.default_hourly_rate when employee rate is null', async () => {
    await service.postLaborCost(
      baseSession(),
      baseEmployee({
        hourly_rate: null,
        crew_member: {
          first_name: 'Jane',
          last_name: 'Doe',
          default_hourly_rate: 20,
        },
      }),
      TENANT_ID,
    );

    expect(prisma.crew_hour_log.create).toHaveBeenCalledTimes(1);
  });

  it('never throws when crew_hour_log.create fails — logs and notifies admins', async () => {
    prisma.crew_hour_log.create.mockRejectedValue(new Error('DB write failed'));
    const errorSpy = jest
      .spyOn(service['logger'], 'error')
      .mockImplementation(() => undefined);

    await expect(
      service.postLaborCost(baseSession(), baseEmployee(), TENANT_ID),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to post labor cost'),
      expect.any(String),
    );
    expect(prisma.clock_session.update).not.toHaveBeenCalled();
    expect(notifications.createNotification).toHaveBeenCalled();
  });

  it('notifies every tenant admin with the correct payload on failure', async () => {
    prisma.crew_hour_log.create.mockRejectedValue(new Error('boom'));

    await service.postLaborCost(baseSession(), baseEmployee(), TENANT_ID);

    expect(notifications.createNotification).toHaveBeenCalledTimes(2);
    for (const call of notifications.createNotification.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          type: 'timeclock_labor_cost_failed',
          title: 'Labor Cost Error',
          action_url: '/workforce/timesheets',
          related_entity_type: 'clock_session',
          related_entity_id: SESSION_ID,
        }),
      );
      expect(call[0].message).toContain('Jane Doe');
      expect(call[0].message).toContain('could not be posted');
    }
    expect(prisma.user_tenant_membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_id: TENANT_ID }),
      }),
    );
  });

  it('never throws when tenant.findFirst fails — notifies admins with a fallback date', async () => {
    prisma.tenant.findFirst.mockRejectedValue(
      new Error('tenant lookup failed'),
    );

    await expect(
      service.postLaborCost(baseSession(), baseEmployee(), TENANT_ID),
    ).resolves.toBeUndefined();

    expect(prisma.crew_hour_log.create).not.toHaveBeenCalled();
    expect(notifications.createNotification).toHaveBeenCalled();
    const first = notifications.createNotification.mock.calls[0][0];
    expect(first.message).toMatch(
      /Labor cost for Jane Doe on \d{4}-\d{2}-\d{2}/,
    );
  });

  it('never throws even when the admin notification path itself fails', async () => {
    prisma.crew_hour_log.create.mockRejectedValue(new Error('primary fail'));
    prisma.user_tenant_membership.findMany.mockRejectedValue(
      new Error('notify lookup fail'),
    );

    await expect(
      service.postLaborCost(baseSession(), baseEmployee(), TENANT_ID),
    ).resolves.toBeUndefined();
  });

  it('never throws when given a null session or employee profile', async () => {
    await expect(
      service.postLaborCost(
        null as unknown as Parameters<typeof service.postLaborCost>[0],
        baseEmployee(),
        TENANT_ID,
      ),
    ).resolves.toBeUndefined();

    await expect(
      service.postLaborCost(
        baseSession(),
        null as unknown as Parameters<typeof service.postLaborCost>[1],
        TENANT_ID,
      ),
    ).resolves.toBeUndefined();

    expect(prisma.crew_hour_log.create).not.toHaveBeenCalled();
  });
});
