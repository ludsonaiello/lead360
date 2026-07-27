import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { NotificationsService } from '../../communication/services/notifications.service';
import { EditClockSessionDto } from '../dto/clock-session-edit.dto';
import { ClockSessionEditService } from './clock-session-edit.service';
import { OvertimeService } from './overtime.service';

/**
 * Tests for ClockSessionEditService.
 *
 * Focus:
 *  - Multi-tenant isolation on every query
 *  - Field-change detection (including no-op edits)
 *  - IMMUTABLE edit-log creation (one per changed field)
 *  - Recalculation trigger only when a time field changed
 *  - Reconciliation flag + admin notification path
 *  - Reason validation (defense-in-depth)
 */

const TENANT_ID = 'tenant-uuid-0000';
const USER_ID = 'user-uuid-0000';
const SESSION_ID = 'session-uuid-0000';
const EMPLOYEE_PROFILE_ID = 'employee-uuid-0000';

const buildPrismaMock = () => ({
  clock_session: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  clock_session_edit_log: {
    create: jest.fn(),
  },
  user_tenant_membership: {
    findMany: jest.fn(),
  },
});

type PrismaMock = ReturnType<typeof buildPrismaMock>;

const buildSession = (overrides: Record<string, unknown> = {}) => ({
  id: SESSION_ID,
  tenant_id: TENANT_ID,
  employee_profile_id: EMPLOYEE_PROFILE_ID,
  status: 'completed',
  clock_in_at: new Date('2026-04-10T08:00:00.000Z'),
  clock_out_at: new Date('2026-04-10T16:00:00.000Z'),
  total_worked_minutes: 480,
  regular_minutes: 480,
  overtime_minutes: 0,
  is_manual_edit: false,
  labor_cost_posted: false,
  notes: 'original note',
  project_id: 'project-a',
  task_id: null,
  employee_profile: {
    id: EMPLOYEE_PROFILE_ID,
    user: { id: 'u-1', first_name: 'Jane', last_name: 'Doe' },
  },
  break_entries: [],
  ...overrides,
});

describe('ClockSessionEditService', () => {
  let service: ClockSessionEditService;
  let prisma: PrismaMock;
  let overtimeService: { calculateOvertime: jest.Mock };
  let auditLogger: { logTenantChange: jest.Mock };
  let notifications: { createNotification: jest.Mock };

  const wireInitialSession = (session: ReturnType<typeof buildSession>) => {
    prisma.clock_session.findFirst
      .mockResolvedValueOnce(session) // Step 1: load for edit
      .mockResolvedValueOnce({ ...session, edit_logs: [] }); // Step 12: re-fetch detail
  };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    overtimeService = {
      calculateOvertime: jest
        .fn()
        .mockResolvedValue({ regular_minutes: 450, overtime_minutes: 60 }),
    };
    auditLogger = { logTenantChange: jest.fn().mockResolvedValue(undefined) };
    notifications = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClockSessionEditService,
        { provide: PrismaService, useValue: prisma },
        { provide: OvertimeService, useValue: overtimeService },
        { provide: AuditLoggerService, useValue: auditLogger },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(ClockSessionEditService);

    prisma.clock_session_edit_log.create.mockImplementation(
      async ({ data }: { data: { field_changed: string } }) => ({
        id: `log-${data.field_changed}`,
      }),
    );
    prisma.clock_session.update.mockResolvedValue({} as unknown);
    prisma.user_tenant_membership.findMany.mockResolvedValue([]);
  });

  // ────────────────────────────────────────────────────────────────
  // Validation
  // ────────────────────────────────────────────────────────────────
  describe('editSession — validation', () => {
    it('throws NotFoundException when session is not in tenant', async () => {
      prisma.clock_session.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.editSession(TENANT_ID, USER_ID, SESSION_ID, {
          reason: 'valid',
        } as EditClockSessionDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when reason is whitespace only', async () => {
      wireInitialSession(buildSession());

      await expect(
        service.editSession(TENANT_ID, USER_ID, SESSION_ID, {
          reason: '   ',
        } as EditClockSessionDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when clock_in_at is null (schema is NOT NULL)', async () => {
      wireInitialSession(buildSession());

      await expect(
        service.editSession(TENANT_ID, USER_ID, SESSION_ID, {
          clock_in_at: null,
          reason: 'try to null required field',
        } as unknown as EditClockSessionDto),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.clock_session_edit_log.create).not.toHaveBeenCalled();
      expect(prisma.clock_session.update).not.toHaveBeenCalled();
    });

    it('scopes the load query to tenant_id', async () => {
      wireInitialSession(buildSession());

      await service.editSession(TENANT_ID, USER_ID, SESSION_ID, {
        reason: 'touch',
      } as EditClockSessionDto);

      expect(prisma.clock_session.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SESSION_ID, tenant_id: TENANT_ID },
        }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Field-change detection
  // ────────────────────────────────────────────────────────────────
  describe('editSession — field change detection', () => {
    it('creates no edit logs when nothing actually changed', async () => {
      wireInitialSession(buildSession());

      await service.editSession(TENANT_ID, USER_ID, SESSION_ID, {
        notes: 'original note',
        reason: 'no-op attempt',
      } as EditClockSessionDto);

      expect(prisma.clock_session_edit_log.create).not.toHaveBeenCalled();
      expect(prisma.clock_session.update).not.toHaveBeenCalled();
      expect(auditLogger.logTenantChange).not.toHaveBeenCalled();
    });

    it('creates one immutable edit log per changed field', async () => {
      wireInitialSession(buildSession());

      await service.editSession(TENANT_ID, USER_ID, SESSION_ID, {
        notes: 'updated note',
        project_id: 'project-b',
        reason: 'clarify + reassign',
      } as EditClockSessionDto);

      expect(prisma.clock_session_edit_log.create).toHaveBeenCalledTimes(2);
      const payloads = prisma.clock_session_edit_log.create.mock.calls.map(
        (c: unknown[]) => (c[0] as { data: unknown }).data,
      );
      expect(payloads).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tenant_id: TENANT_ID,
            clock_session_id: SESSION_ID,
            edited_by_user_id: USER_ID,
            field_changed: 'project_id',
            original_value: 'project-a',
            new_value: 'project-b',
            reason: 'clarify + reassign',
          }),
          expect.objectContaining({
            field_changed: 'notes',
            original_value: 'original note',
            new_value: 'updated note',
          }),
        ]),
      );
    });

    it('always flips is_manual_edit to true after a real edit', async () => {
      wireInitialSession(buildSession());

      await service.editSession(TENANT_ID, USER_ID, SESSION_ID, {
        notes: 'new',
        reason: 'n',
      } as EditClockSessionDto);

      expect(prisma.clock_session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SESSION_ID },
          data: expect.objectContaining({ is_manual_edit: true }),
        }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Recalculation rules
  // ────────────────────────────────────────────────────────────────
  describe('editSession — recalculation rules', () => {
    it('does NOT recalculate times when only notes / project / task changed', async () => {
      wireInitialSession(buildSession());

      await service.editSession(TENANT_ID, USER_ID, SESSION_ID, {
        notes: 'updated',
        reason: 'r',
      } as EditClockSessionDto);

      expect(overtimeService.calculateOvertime).not.toHaveBeenCalled();
      const updateCall = prisma.clock_session.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(updateCall.data.total_worked_minutes).toBeUndefined();
      expect(updateCall.data.regular_minutes).toBeUndefined();
      expect(updateCall.data.overtime_minutes).toBeUndefined();
    });

    it('recalculates total / regular / overtime when clock_in_at changes', async () => {
      wireInitialSession(buildSession());

      await service.editSession(TENANT_ID, USER_ID, SESSION_ID, {
        clock_in_at: '2026-04-10T07:30:00.000Z',
        reason: 'time fix',
      } as EditClockSessionDto);

      expect(overtimeService.calculateOvertime).toHaveBeenCalledTimes(1);
      expect(overtimeService.calculateOvertime).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          employeeProfileId: EMPLOYEE_PROFILE_ID,
          sessionId: SESSION_ID,
          totalWorkedMinutes: 510,
        }),
      );

      const updateCall = prisma.clock_session.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(updateCall.data.total_worked_minutes).toBe(510);
      expect(updateCall.data.regular_minutes).toBe(450);
      expect(updateCall.data.overtime_minutes).toBe(60);
    });

    it('subtracts unpaid break minutes from the recalculated total', async () => {
      wireInitialSession(
        buildSession({
          break_entries: [
            { break_type: 'unpaid', duration_minutes: 30 },
            { break_type: 'paid', duration_minutes: 15 },
          ],
        }),
      );

      await service.editSession(TENANT_ID, USER_ID, SESSION_ID, {
        clock_in_at: '2026-04-10T07:00:00.000Z', // +60 min earlier
        reason: 'confirm',
      } as EditClockSessionDto);

      expect(overtimeService.calculateOvertime).toHaveBeenCalledWith(
        expect.objectContaining({
          // 9h elapsed − 30 unpaid break = 510 min
          totalWorkedMinutes: 510,
        }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Labor cost reconciliation
  // ────────────────────────────────────────────────────────────────
  describe('editSession — labor cost reconciliation', () => {
    it('sets labor_cost_reconciliation_needed and notifies admins', async () => {
      wireInitialSession(buildSession({ labor_cost_posted: true }));
      prisma.user_tenant_membership.findMany.mockResolvedValueOnce([
        { user_id: 'admin-1' },
        { user_id: 'admin-2' },
      ]);

      await service.editSession(TENANT_ID, USER_ID, SESSION_ID, {
        notes: 'adjustment',
        reason: 'cost already posted',
      } as EditClockSessionDto);

      const updateCall = prisma.clock_session.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(updateCall.data.labor_cost_reconciliation_needed).toBe(true);

      expect(notifications.createNotification).toHaveBeenCalledTimes(2);
      expect(notifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          type: 'timeclock_reconciliation_needed',
          title: 'Reconciliation Needed',
          action_url: '/workforce/timesheets',
          related_entity_type: 'clock_session',
          related_entity_id: SESSION_ID,
        }),
      );
    });

    it('does NOT block the edit when notification delivery fails', async () => {
      wireInitialSession(buildSession({ labor_cost_posted: true }));
      prisma.user_tenant_membership.findMany.mockRejectedValueOnce(
        new Error('db blip'),
      );

      await expect(
        service.editSession(TENANT_ID, USER_ID, SESSION_ID, {
          notes: 'adjustment',
          reason: 'cost already posted',
        } as EditClockSessionDto),
      ).resolves.toBeDefined();

      expect(prisma.clock_session.update).toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────
  // Audit
  // ────────────────────────────────────────────────────────────────
  describe('editSession — audit', () => {
    it('emits a single audit entry with edit_log_ids metadata', async () => {
      wireInitialSession(buildSession());

      await service.editSession(TENANT_ID, USER_ID, SESSION_ID, {
        notes: 'updated',
        reason: 'context',
      } as EditClockSessionDto);

      expect(auditLogger.logTenantChange).toHaveBeenCalledTimes(1);
      const payload = auditLogger.logTenantChange.mock.calls[0][0];
      expect(payload).toEqual(
        expect.objectContaining({
          action: 'updated',
          entityType: 'clock_session',
          entityId: SESSION_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
          before: { notes: 'original note' },
          after: { notes: 'updated' },
        }),
      );
      expect(payload.metadata.edit_log_ids).toHaveLength(1);
      expect(payload.metadata.reason).toBe('context');
    });
  });
});
