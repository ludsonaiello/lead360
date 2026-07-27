import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../core/database/prisma.service';
import { NotificationsService } from '../../communication/services/notifications.service';
import { ClockInDto, LocationSourceEnum } from '../dto/clock-session.dto';
import { ClockSessionService } from './clock-session.service';
import { GeofenceService } from './geofence.service';
import { LaborCostAttributionService } from './labor-cost-attribution.service';
import { OvertimeService } from './overtime.service';
import { TimeClockSettingsService } from './time-clock-settings.service';

const TENANT_ID = 'tenant-uuid-0000';
const OTHER_TENANT_ID = 'tenant-uuid-9999';
const USER_ID = 'user-uuid-0000';
const PROFILE_ID = 'profile-uuid-0000';
const SESSION_ID = 'session-uuid-0000';

const buildPrismaMock = () => ({
  employee_profile: { findFirst: jest.fn() },
  clock_session: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  work_shift: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  break_entry: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  user_tenant_membership: {
    findMany: jest.fn(),
  },
  project: {
    findMany: jest.fn(),
  },
  employee_project_assignment: {
    findMany: jest.fn(),
  },
  task_assignee: {
    findMany: jest.fn(),
  },
});

type PrismaMock = ReturnType<typeof buildPrismaMock>;

const defaultSettings = (overrides: Record<string, unknown> = {}) => ({
  clock_in_mode: 'anywhere',
  geofence_violation_action: 'warn_only',
  gps_required: false,
  gps_unavailable_action: 'allow_flagged',
  require_job_tag: false,
  require_task_tag: false,
  ...overrides,
});

const defaultProfile = (overrides: Record<string, unknown> = {}) => ({
  id: PROFILE_ID,
  tenant_id: TENANT_ID,
  user_id: USER_ID,
  crew_member_id: null,
  hourly_rate: 25,
  is_active: true,
  user: { id: USER_ID, first_name: 'Jane', last_name: 'Doe' },
  crew_member: null,
  ...overrides,
});

const defaultSession = (overrides: Record<string, unknown> = {}) => ({
  id: SESSION_ID,
  tenant_id: TENANT_ID,
  employee_profile_id: PROFILE_ID,
  work_shift_id: null,
  project_id: null,
  task_id: null,
  clockin_address_id: null,
  status: 'active',
  clock_in_at: new Date('2026-04-13T14:00:00.000Z'),
  clock_out_at: null,
  clock_in_latitude: null,
  clock_in_longitude: null,
  clock_in_location_source: 'browser_gps',
  clock_in_geofence_status: 'not_enforced',
  clock_out_latitude: null,
  clock_out_longitude: null,
  clock_out_location_source: 'browser_gps',
  clock_out_geofence_status: 'not_enforced',
  total_worked_minutes: null,
  regular_minutes: null,
  overtime_minutes: null,
  is_manual_edit: false,
  is_flagged: false,
  flag_reason: null,
  labor_cost_posted: false,
  labor_cost_entry_id: null,
  notes: null,
  ...overrides,
});

describe('ClockSessionService', () => {
  let service: ClockSessionService;
  let prisma: PrismaMock;
  let geofence: { checkGeofence: jest.Mock };
  let overtime: { calculateOvertime: jest.Mock };
  let laborCost: { postLaborCost: jest.Mock };
  let notifications: { createNotification: jest.Mock };
  let settingsService: { getSettings: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    geofence = { checkGeofence: jest.fn() };
    overtime = {
      calculateOvertime: jest
        .fn()
        .mockResolvedValue({ regular_minutes: 60, overtime_minutes: 0 }),
    };
    laborCost = { postLaborCost: jest.fn().mockResolvedValue(undefined) };
    notifications = { createNotification: jest.fn().mockResolvedValue({}) };
    settingsService = {
      getSettings: jest.fn().mockResolvedValue(defaultSettings()),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ClockSessionService,
        { provide: PrismaService, useValue: prisma },
        { provide: GeofenceService, useValue: geofence },
        { provide: OvertimeService, useValue: overtime },
        { provide: LaborCostAttributionService, useValue: laborCost },
        { provide: NotificationsService, useValue: notifications },
        { provide: TimeClockSettingsService, useValue: settingsService },
      ],
    }).compile();

    service = moduleRef.get(ClockSessionService);
  });

  // ────────────────── clockIn ──────────────────
  describe('clockIn', () => {
    const dto: ClockInDto = {
      latitude: 40.7128,
      longitude: -74.006,
      location_source: LocationSourceEnum.BROWSER_GPS,
    };

    it('throws 404 when employee profile is missing', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(null);
      await expect(service.clockIn(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws 409 when an active session already exists (BR-001)', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(defaultProfile());
      prisma.clock_session.findFirst.mockResolvedValue({ id: 'existing' });
      await expect(service.clockIn(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws 400 when require_job_tag and project missing', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(defaultProfile());
      prisma.clock_session.findFirst.mockResolvedValue(null);
      settingsService.getSettings.mockResolvedValue(
        defaultSettings({ require_job_tag: true }),
      );
      await expect(service.clockIn(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws 400 when require_task_tag and task missing', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(defaultProfile());
      prisma.clock_session.findFirst.mockResolvedValue(null);
      settingsService.getSettings.mockResolvedValue(
        defaultSettings({ require_task_tag: true }),
      );
      await expect(
        service.clockIn(TENANT_ID, USER_ID, {
          ...dto,
          project_id: 'p1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 403 when GPS is required and missing with block action', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(defaultProfile());
      prisma.clock_session.findFirst.mockResolvedValue(null);
      settingsService.getSettings.mockResolvedValue(
        defaultSettings({
          gps_required: true,
          gps_unavailable_action: 'block',
        }),
      );
      await expect(
        service.clockIn(TENANT_ID, USER_ID, {
          location_source: LocationSourceEnum.BROWSER_GPS,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('flags the session when GPS is missing and action is allow_flagged', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(defaultProfile());
      prisma.clock_session.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(defaultSession({ is_flagged: true }));
      settingsService.getSettings.mockResolvedValue(
        defaultSettings({
          gps_required: true,
          gps_unavailable_action: 'allow_flagged',
        }),
      );
      prisma.work_shift.findMany.mockResolvedValue([]);
      prisma.clock_session.create.mockResolvedValue(
        defaultSession({ is_flagged: true }),
      );
      prisma.user_tenant_membership.findMany.mockResolvedValue([]);

      await service.clockIn(TENANT_ID, USER_ID, {});

      expect(prisma.clock_session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            is_flagged: true,
            flag_reason: expect.stringContaining('GPS location unavailable'),
            clock_in_geofence_status: 'unavailable',
          }),
        }),
      );
    });

    it('blocks clock-in when outside geofence with block action (BR-003)', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(defaultProfile());
      prisma.clock_session.findFirst.mockResolvedValue(null);
      settingsService.getSettings.mockResolvedValue(
        defaultSettings({
          clock_in_mode: 'specific_addresses',
          geofence_violation_action: 'block',
          gps_required: true,
        }),
      );
      geofence.checkGeofence.mockResolvedValue({
        geofence_status: 'outside',
        clockin_address_id: null,
        nearest_distance_meters: 250,
        flag_reason: 'Outside all configured locations — 250m from nearest',
      });
      prisma.user_tenant_membership.findMany.mockResolvedValue([]);

      await expect(service.clockIn(TENANT_ID, USER_ID, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('creates a flagged session when outside geofence with warn_only action', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(defaultProfile());
      prisma.clock_session.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(defaultSession({ is_flagged: true }));
      settingsService.getSettings.mockResolvedValue(
        defaultSettings({
          clock_in_mode: 'specific_addresses',
          geofence_violation_action: 'warn_only',
          gps_required: true,
        }),
      );
      geofence.checkGeofence.mockResolvedValue({
        geofence_status: 'outside',
        clockin_address_id: null,
        nearest_distance_meters: 250,
        flag_reason: 'Outside all configured locations — 250m from nearest',
      });
      prisma.work_shift.findMany.mockResolvedValue([]);
      prisma.clock_session.create.mockResolvedValue(
        defaultSession({ is_flagged: true }),
      );
      prisma.user_tenant_membership.findMany.mockResolvedValue([]);

      await service.clockIn(TENANT_ID, USER_ID, dto);

      expect(prisma.clock_session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            is_flagged: true,
            clock_in_geofence_status: 'outside',
          }),
        }),
      );
    });

    it('auto-matches the closest scheduled shift and marks it in_progress', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(defaultProfile());
      prisma.clock_session.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(defaultSession());
      settingsService.getSettings.mockResolvedValue(defaultSettings());
      prisma.work_shift.findMany.mockResolvedValue([
        {
          id: 'shift-far',
          scheduled_start: new Date(Date.now() + 90 * 60 * 1000),
        },
        {
          id: 'shift-near',
          scheduled_start: new Date(Date.now() + 5 * 60 * 1000),
        },
      ]);
      prisma.work_shift.update.mockResolvedValue({});
      prisma.clock_session.create.mockResolvedValue(defaultSession());

      await service.clockIn(TENANT_ID, USER_ID, dto);

      expect(prisma.work_shift.update).toHaveBeenCalledWith({
        where: { id: 'shift-near' },
        data: { status: 'in_progress' },
      });
      expect(prisma.clock_session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ work_shift_id: 'shift-near' }),
        }),
      );
    });

    it('skips geofence entirely when gps_required is false, even with coords and non-anywhere mode', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(defaultProfile());
      prisma.clock_session.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(defaultSession());
      settingsService.getSettings.mockResolvedValue(
        defaultSettings({
          gps_required: false,
          clock_in_mode: 'specific_addresses',
          geofence_violation_action: 'block',
        }),
      );
      prisma.work_shift.findMany.mockResolvedValue([]);
      prisma.clock_session.create.mockResolvedValue(defaultSession());

      await service.clockIn(TENANT_ID, USER_ID, dto);

      expect(geofence.checkGeofence).not.toHaveBeenCalled();
      expect(prisma.clock_session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            is_flagged: false,
            flag_reason: null,
            clock_in_geofence_status: 'not_enforced',
          }),
        }),
      );
    });

    it('creates a session scoped to the caller tenant_id', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(defaultProfile());
      prisma.clock_session.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(defaultSession());
      settingsService.getSettings.mockResolvedValue(defaultSettings());
      prisma.work_shift.findMany.mockResolvedValue([]);
      prisma.clock_session.create.mockResolvedValue(defaultSession());

      await service.clockIn(TENANT_ID, USER_ID, dto);

      expect(prisma.employee_profile.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            user_id: USER_ID,
            is_active: true,
          }),
        }),
      );
      expect(prisma.clock_session.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });
  });

  // ────────────────── clockOut ──────────────────
  describe('clockOut', () => {
    it('throws 404 when no active session exists', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(defaultProfile());
      prisma.clock_session.findFirst.mockResolvedValue(null);
      await expect(service.clockOut(TENANT_ID, USER_ID, {})).rejects.toThrow(
        NotFoundException,
      );
    });

    it('auto-ends an open break when session is on_break', async () => {
      const clockInAt = new Date(Date.now() - 60 * 60 * 1000);
      prisma.employee_profile.findFirst.mockResolvedValue(defaultProfile());
      prisma.clock_session.findFirst
        .mockResolvedValueOnce(
          defaultSession({ status: 'on_break', clock_in_at: clockInAt }),
        )
        .mockResolvedValueOnce(defaultSession({ status: 'completed' }));
      prisma.break_entry.findFirst.mockResolvedValue({
        id: 'break-1',
        started_at: new Date(Date.now() - 15 * 60 * 1000),
      });
      prisma.break_entry.findMany.mockResolvedValue([]);
      prisma.clock_session.update.mockResolvedValue(
        defaultSession({ status: 'completed' }),
      );

      await service.clockOut(TENANT_ID, USER_ID, {});

      expect(prisma.break_entry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'break-1' },
          data: expect.objectContaining({
            ended_at: expect.any(Date),
            duration_minutes: expect.any(Number),
          }),
        }),
      );
    });

    it('subtracts only unpaid break minutes from total worked minutes', async () => {
      const clockInAt = new Date(Date.now() - 4 * 60 * 60 * 1000); // 4 hours ago
      prisma.employee_profile.findFirst.mockResolvedValue(defaultProfile());
      prisma.clock_session.findFirst
        .mockResolvedValueOnce(defaultSession({ clock_in_at: clockInAt }))
        .mockResolvedValueOnce(defaultSession({ status: 'completed' }));
      prisma.break_entry.findMany.mockResolvedValue([{ duration_minutes: 30 }]);
      prisma.clock_session.update.mockResolvedValue(
        defaultSession({ status: 'completed' }),
      );

      await service.clockOut(TENANT_ID, USER_ID, {});

      const callArg = (overtime.calculateOvertime as jest.Mock).mock
        .calls[0][0];
      expect(callArg.totalWorkedMinutes).toBeGreaterThanOrEqual(209);
      expect(callArg.totalWorkedMinutes).toBeLessThanOrEqual(211);
    });

    it('never fails clock-out when labor cost attribution throws', async () => {
      const clockInAt = new Date(Date.now() - 60 * 60 * 1000);
      prisma.employee_profile.findFirst.mockResolvedValue(defaultProfile());
      prisma.clock_session.findFirst
        .mockResolvedValueOnce(defaultSession({ clock_in_at: clockInAt }))
        .mockResolvedValueOnce(defaultSession({ status: 'completed' }));
      prisma.break_entry.findMany.mockResolvedValue([]);
      prisma.clock_session.update.mockResolvedValue(
        defaultSession({ status: 'completed' }),
      );
      laborCost.postLaborCost.mockRejectedValue(new Error('db down'));

      await expect(
        service.clockOut(TENANT_ID, USER_ID, {}),
      ).resolves.not.toThrow();
    });

    it('runs the full on_break → auto-end → compute → overtime → persist flow in the correct order', async () => {
      const clockInAt = new Date(Date.now() - 8 * 60 * 60 * 1000); // 8h ago
      const breakStartedAt = new Date(Date.now() - 30 * 60 * 1000); // 30m ago

      prisma.employee_profile.findFirst.mockResolvedValue(defaultProfile());
      prisma.clock_session.findFirst
        .mockResolvedValueOnce(
          defaultSession({
            status: 'on_break',
            clock_in_at: clockInAt,
            work_shift_id: 'shift-9',
          }),
        )
        .mockResolvedValueOnce(defaultSession({ status: 'completed' }));

      // Auto-end returns the open break with the pre-end state
      prisma.break_entry.findFirst.mockResolvedValue({
        id: 'brk-open',
        started_at: breakStartedAt,
      });

      // After auto-end, unpaid sum = the ~30min break we just closed
      prisma.break_entry.findMany.mockResolvedValue([
        { duration_minutes: 30 },
      ]);

      overtime.calculateOvertime.mockResolvedValue({
        regular_minutes: 450,
        overtime_minutes: 0,
      });

      prisma.clock_session.update.mockResolvedValue(
        defaultSession({
          status: 'completed',
          regular_minutes: 450,
          overtime_minutes: 0,
          total_worked_minutes: 450,
        }),
      );

      await service.clockOut(TENANT_ID, USER_ID, {});

      // 1. open break was auto-ended
      expect(prisma.break_entry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'brk-open' },
          data: expect.objectContaining({
            ended_at: expect.any(Date),
            duration_minutes: expect.any(Number),
          }),
        }),
      );

      // 2. overtime was called BEFORE clock_session.update, with subtracted total
      const overtimeCall = overtime.calculateOvertime.mock.invocationCallOrder[0];
      const sessionUpdateCall =
        prisma.clock_session.update.mock.invocationCallOrder[0];
      expect(overtimeCall).toBeLessThan(sessionUpdateCall);

      const overtimeArg = overtime.calculateOvertime.mock.calls[0][0];
      // 8h - ~30m unpaid break ≈ 450 min (±1 for floor rounding)
      expect(overtimeArg.totalWorkedMinutes).toBeGreaterThanOrEqual(449);
      expect(overtimeArg.totalWorkedMinutes).toBeLessThanOrEqual(451);

      // 3. work_shift was marked completed
      expect(prisma.work_shift.update).toHaveBeenCalledWith({
        where: { id: 'shift-9' },
        data: { status: 'completed' },
      });

      // 4. clock_session.update wrote the totals
      expect(prisma.clock_session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SESSION_ID },
          data: expect.objectContaining({
            status: 'completed',
            regular_minutes: 450,
            overtime_minutes: 0,
            total_worked_minutes: expect.any(Number),
          }),
        }),
      );

      // 5. labor cost was posted AFTER the session update
      const laborCostCall = laborCost.postLaborCost.mock.invocationCallOrder[0];
      expect(laborCostCall).toBeGreaterThan(sessionUpdateCall);
    });

    it('marks the matched work shift completed on clock-out', async () => {
      const clockInAt = new Date(Date.now() - 60 * 60 * 1000);
      prisma.employee_profile.findFirst.mockResolvedValue(defaultProfile());
      prisma.clock_session.findFirst
        .mockResolvedValueOnce(
          defaultSession({ clock_in_at: clockInAt, work_shift_id: 'shift-1' }),
        )
        .mockResolvedValueOnce(defaultSession({ status: 'completed' }));
      prisma.break_entry.findMany.mockResolvedValue([]);
      prisma.clock_session.update.mockResolvedValue(
        defaultSession({ status: 'completed' }),
      );

      await service.clockOut(TENANT_ID, USER_ID, {});

      expect(prisma.work_shift.update).toHaveBeenCalledWith({
        where: { id: 'shift-1' },
        data: { status: 'completed' },
      });
    });
  });

  // ────────────────── findAll ──────────────────
  describe('findAll', () => {
    it('scopes every query to tenant_id', async () => {
      prisma.clock_session.findMany.mockResolvedValue([]);
      prisma.clock_session.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, { page: 1, limit: 20 });

      expect(prisma.clock_session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
      expect(prisma.clock_session.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });

    it('builds a tenant-scoped date_from/date_to range filter', async () => {
      prisma.clock_session.findMany.mockResolvedValue([]);
      prisma.clock_session.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, {
        date_from: '2026-01-01T00:00:00Z',
        date_to: '2026-01-31T23:59:59Z',
      });

      expect(prisma.clock_session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            clock_in_at: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });
  });

  // ────────────────── findMyActive ──────────────────
  describe('findMyActive', () => {
    it('returns { data: null } when no active session exists (no 404)', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(defaultProfile());
      prisma.clock_session.findFirst.mockResolvedValue(null);

      const result = await service.findMyActive(TENANT_ID, USER_ID);
      expect(result).toEqual({ data: null });
    });

    it('throws 404 when employee profile does not belong to tenant', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(null);
      await expect(
        service.findMyActive(OTHER_TENANT_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ────────────────── findAvailableProjects ──────────────────
  describe('findAvailableProjects', () => {
    it('returns ALL active projects for anywhere mode', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(defaultProfile());
      settingsService.getSettings.mockResolvedValue(
        defaultSettings({ clock_in_mode: 'anywhere' }),
      );
      prisma.project.findMany.mockResolvedValue([
        { id: 'p1', name: 'Project A', project_number: 'P-1' },
      ]);

      const result = await service.findAvailableProjects(TENANT_ID, USER_ID);

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            status: { in: ['planned', 'in_progress'] },
          }),
        }),
      );
      expect(result).toEqual({
        data: [{ id: 'p1', name: 'Project A', project_number: 'P-1' }],
      });
    });

    it('unions assignment + task_assignee for active_job_sites mode', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(
        defaultProfile({ crew_member_id: 'crew-1' }),
      );
      settingsService.getSettings.mockResolvedValue(
        defaultSettings({ clock_in_mode: 'active_job_sites' }),
      );
      prisma.employee_project_assignment.findMany.mockResolvedValue([
        { project_id: 'p1' },
      ]);
      prisma.task_assignee.findMany.mockResolvedValue([
        { task: { project_id: 'p2' } },
        { task: { project_id: 'p1' } },
      ]);
      prisma.project.findMany.mockResolvedValue([
        { id: 'p1', name: 'A', project_number: 'PA' },
        { id: 'p2', name: 'B', project_number: 'PB' },
      ]);

      const result = await service.findAvailableProjects(TENANT_ID, USER_ID);

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            id: { in: expect.arrayContaining(['p1', 'p2']) },
          }),
        }),
      );
      expect(result.data).toHaveLength(2);
    });

    it('returns empty array when no assignments and no task matches (active_job_sites)', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(defaultProfile());
      settingsService.getSettings.mockResolvedValue(
        defaultSettings({ clock_in_mode: 'active_job_sites' }),
      );
      prisma.employee_project_assignment.findMany.mockResolvedValue([]);
      prisma.task_assignee.findMany.mockResolvedValue([]);

      const result = await service.findAvailableProjects(TENANT_ID, USER_ID);
      expect(result).toEqual({ data: [] });
      expect(prisma.project.findMany).not.toHaveBeenCalled();
    });
  });

  // ────────────────── findMine ──────────────────
  describe('findMine', () => {
    it('scopes all queries to tenant_id and the caller employee profile', async () => {
      prisma.employee_profile.findFirst.mockResolvedValue(defaultProfile());
      prisma.clock_session.findMany.mockResolvedValue([]);
      prisma.clock_session.count.mockResolvedValue(0);

      await service.findMine(TENANT_ID, USER_ID, {});

      expect(prisma.clock_session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            employee_profile_id: PROFILE_ID,
          }),
        }),
      );
    });
  });

  // ────────────────── findAllActive ──────────────────
  describe('findAllActive', () => {
    it('returns only tenant sessions with status in (active, on_break)', async () => {
      prisma.clock_session.findMany.mockResolvedValue([]);
      prisma.clock_session.count.mockResolvedValue(0);

      await service.findAllActive(TENANT_ID);

      expect(prisma.clock_session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            status: { in: ['active', 'on_break'] },
          }),
        }),
      );
    });
  });

  // ────────────────── findOne ──────────────────
  describe('findOne', () => {
    it('throws 404 when session belongs to another tenant', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(null);
      await expect(service.findOne(TENANT_ID, SESSION_ID)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.clock_session.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: SESSION_ID,
            tenant_id: TENANT_ID,
          }),
        }),
      );
    });

    it('returns the session with full detail when found', async () => {
      const session = defaultSession();
      prisma.clock_session.findFirst.mockResolvedValue(session);
      const result = await service.findOne(TENANT_ID, SESSION_ID);
      expect(result).toBe(session);
    });
  });
});
