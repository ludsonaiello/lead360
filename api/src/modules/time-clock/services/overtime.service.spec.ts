import { Test, TestingModule } from '@nestjs/testing';
import { OvertimeService } from './overtime.service';
import { PrismaService } from '../../../core/database/prisma.service';

const TENANT_ID = 'tenant-uuid-001';
const EMPLOYEE_PROFILE_ID = 'emp-uuid-001';
const SESSION_ID = 'session-uuid-001';

const buildPrismaMock = () => ({
  employee_profile: {
    findFirst: jest.fn(),
  },
  time_clock_settings: {
    findFirst: jest.fn(),
  },
  tenant: {
    findFirst: jest.fn(),
  },
  clock_session: {
    findMany: jest.fn(),
  },
});

type PrismaMock = ReturnType<typeof buildPrismaMock>;

const defaultEmployee = (overrides: Record<string, unknown> = {}) => ({
  id: EMPLOYEE_PROFILE_ID,
  tenant_id: TENANT_ID,
  user_id: 'user-uuid-001',
  crew_member_id: 'crew-uuid-001',
  hourly_rate: 30,
  overtime_rule_override: false,
  overtime_daily_threshold_hours: null,
  overtime_weekly_threshold_hours: null,
  crew_member: { default_hourly_rate: 25 },
  ...overrides,
});

const defaultSettings = (overrides: Record<string, unknown> = {}) => ({
  id: 'settings-uuid-001',
  tenant_id: TENANT_ID,
  overtime_enabled: true,
  overtime_daily_threshold_hours: 8,
  overtime_weekly_threshold_hours: 40,
  pay_period_start_day: 0,
  ...overrides,
});

describe('OvertimeService', () => {
  let service: OvertimeService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = buildPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OvertimeService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<OvertimeService>(OvertimeService);

    prisma.tenant.findFirst.mockResolvedValue({
      timezone: 'America/New_York',
    });
    prisma.clock_session.findMany.mockResolvedValue([]);
  });

  const runCalc = (
    overrides: Partial<
      Parameters<OvertimeService['calculateOvertime']>[0]
    > = {},
  ) =>
    service.calculateOvertime({
      tenantId: TENANT_ID,
      employeeProfileId: EMPLOYEE_PROFILE_ID,
      sessionId: SESSION_ID,
      totalWorkedMinutes: 480,
      clockInAt: new Date('2026-04-13T13:00:00.000Z'),
      ...overrides,
    });

  it('returns all regular when overtime is disabled', async () => {
    prisma.employee_profile.findFirst.mockResolvedValue(defaultEmployee());
    prisma.time_clock_settings.findFirst.mockResolvedValue(
      defaultSettings({ overtime_enabled: false }),
    );

    const result = await runCalc({ totalWorkedMinutes: 600 });

    expect(result).toEqual({ regular_minutes: 600, overtime_minutes: 0 });
    expect(prisma.clock_session.findMany).not.toHaveBeenCalled();
  });

  it('keeps hours under daily threshold entirely regular', async () => {
    prisma.employee_profile.findFirst.mockResolvedValue(defaultEmployee());
    prisma.time_clock_settings.findFirst.mockResolvedValue(defaultSettings());

    const result = await runCalc({ totalWorkedMinutes: 360 });

    expect(result).toEqual({ regular_minutes: 360, overtime_minutes: 0 });
  });

  it('splits hours into overtime when daily threshold is exceeded', async () => {
    prisma.employee_profile.findFirst.mockResolvedValue(defaultEmployee());
    prisma.time_clock_settings.findFirst.mockResolvedValue(defaultSettings());

    const result = await runCalc({ totalWorkedMinutes: 600 });

    expect(result).toEqual({ regular_minutes: 480, overtime_minutes: 120 });
  });

  it('respects prior same-day sessions when computing remaining daily capacity', async () => {
    prisma.employee_profile.findFirst.mockResolvedValue(defaultEmployee());
    prisma.time_clock_settings.findFirst.mockResolvedValue(defaultSettings());

    prisma.clock_session.findMany
      .mockResolvedValueOnce([
        { regular_minutes: 240 },
        { regular_minutes: 120 },
      ])
      .mockResolvedValueOnce([
        { regular_minutes: 240 },
        { regular_minutes: 120 },
      ]);

    const result = await runCalc({ totalWorkedMinutes: 240 });

    expect(result).toEqual({ regular_minutes: 120, overtime_minutes: 120 });
  });

  it('respects weekly threshold when prior week hours exist', async () => {
    prisma.employee_profile.findFirst.mockResolvedValue(defaultEmployee());
    prisma.time_clock_settings.findFirst.mockResolvedValue(defaultSettings());

    prisma.clock_session.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { regular_minutes: 480 },
        { regular_minutes: 480 },
        { regular_minutes: 480 },
        { regular_minutes: 480 },
        { regular_minutes: 240 },
      ]);

    const result = await runCalc({ totalWorkedMinutes: 480 });

    expect(result).toEqual({ regular_minutes: 240, overtime_minutes: 240 });
  });

  it('takes the tightest remaining cap when daily and weekly both limit', async () => {
    prisma.employee_profile.findFirst.mockResolvedValue(defaultEmployee());
    prisma.time_clock_settings.findFirst.mockResolvedValue(defaultSettings());

    prisma.clock_session.findMany
      .mockResolvedValueOnce([{ regular_minutes: 420 }])
      .mockResolvedValueOnce([
        { regular_minutes: 480 },
        { regular_minutes: 480 },
        { regular_minutes: 480 },
        { regular_minutes: 480 },
        { regular_minutes: 420 },
      ]);

    const result = await runCalc({ totalWorkedMinutes: 240 });

    expect(result).toEqual({ regular_minutes: 60, overtime_minutes: 180 });
  });

  it('uses employee-specific thresholds when override is set', async () => {
    prisma.employee_profile.findFirst.mockResolvedValue(
      defaultEmployee({
        overtime_rule_override: true,
        overtime_daily_threshold_hours: 10,
        overtime_weekly_threshold_hours: 50,
      }),
    );
    prisma.time_clock_settings.findFirst.mockResolvedValue(defaultSettings());

    const result = await runCalc({ totalWorkedMinutes: 660 });

    expect(result).toEqual({ regular_minutes: 600, overtime_minutes: 60 });
  });

  it('uses tenant settings thresholds when employee override is false', async () => {
    prisma.employee_profile.findFirst.mockResolvedValue(
      defaultEmployee({
        overtime_rule_override: false,
        overtime_daily_threshold_hours: 12,
        overtime_weekly_threshold_hours: 60,
      }),
    );
    prisma.time_clock_settings.findFirst.mockResolvedValue(
      defaultSettings({
        overtime_daily_threshold_hours: 8,
        overtime_weekly_threshold_hours: 40,
      }),
    );

    const result = await runCalc({ totalWorkedMinutes: 600 });

    expect(result).toEqual({ regular_minutes: 480, overtime_minutes: 120 });
  });

  it('scopes prior session lookups to tenant, employee, and exclude current session', async () => {
    prisma.employee_profile.findFirst.mockResolvedValue(defaultEmployee());
    prisma.time_clock_settings.findFirst.mockResolvedValue(defaultSettings());

    await runCalc({ totalWorkedMinutes: 480 });

    const calls = prisma.clock_session.findMany.mock.calls;
    expect(calls.length).toBe(2);
    for (const [args] of calls) {
      expect(args.where.tenant_id).toBe(TENANT_ID);
      expect(args.where.employee_profile_id).toBe(EMPLOYEE_PROFILE_ID);
      expect(args.where.status).toBe('completed');
      expect(args.where.id).toEqual({ not: SESSION_ID });
    }
  });

  it('falls back to all-regular when employee profile is not found', async () => {
    prisma.employee_profile.findFirst.mockResolvedValue(null);
    prisma.time_clock_settings.findFirst.mockResolvedValue(defaultSettings());

    const result = await runCalc({ totalWorkedMinutes: 600 });

    expect(result).toEqual({ regular_minutes: 600, overtime_minutes: 0 });
    expect(prisma.clock_session.findMany).not.toHaveBeenCalled();
  });
});
