import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { NotificationsService } from '../../communication/services/notifications.service';
import {
  ApproveDisputeDto,
  CreateTimeDisputeDto,
  DisputeTypeEnum,
  RejectDisputeDto,
} from '../dto/time-dispute.dto';
import { ClockSessionEditService } from './clock-session-edit.service';
import { TimeDisputeService } from './time-dispute.service';

/**
 * Tests for TimeDisputeService.
 *
 * Focus:
 *  - Multi-tenant isolation on every query
 *  - Submission validation (no-session, duplicate, empty correction)
 *  - Approve → delegates to ClockSessionEditService and flips status
 *  - Reject → records rejection without touching the session
 *  - Cancel → only submitter or admin, only when pending
 *  - findOne access control for non-admin users
 */

const TENANT_ID = 'tenant-uuid-0000';
const USER_ID = 'user-uuid-0000';
const OTHER_USER_ID = 'user-uuid-9999';
const SESSION_ID = 'session-uuid-0000';
const DISPUTE_ID = 'dispute-uuid-0000';

const buildPrismaMock = () => ({
  clock_session: {
    findFirst: jest.fn(),
  },
  time_dispute: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  user_tenant_membership: {
    findMany: jest.fn(),
  },
});

type PrismaMock = ReturnType<typeof buildPrismaMock>;

const buildSession = (overrides: Record<string, unknown> = {}) => ({
  id: SESSION_ID,
  tenant_id: TENANT_ID,
  clock_in_at: new Date('2026-04-10T08:00:00.000Z'),
  employee_profile: {
    user: {
      id: 'owner-user',
      first_name: 'Jane',
      last_name: 'Doe',
    },
  },
  ...overrides,
});

const buildDispute = (overrides: Record<string, unknown> = {}) => ({
  id: DISPUTE_ID,
  tenant_id: TENANT_ID,
  clock_session_id: SESSION_ID,
  submitted_by_user_id: USER_ID,
  dispute_type: 'correction_request',
  description: 'Missed my clock-in',
  proposed_clock_in_at: new Date('2026-04-10T07:00:00.000Z'),
  proposed_clock_out_at: null,
  proposed_project_id: null,
  proposed_task_id: null,
  proposed_notes: null,
  status: 'pending',
  reviewed_by_user_id: null,
  review_notes: null,
  reviewed_at: null,
  created_at: new Date('2026-04-10T08:30:00.000Z'),
  updated_at: new Date('2026-04-10T08:30:00.000Z'),
  clock_session: {
    id: SESSION_ID,
    clock_in_at: new Date('2026-04-10T08:00:00.000Z'),
  },
  ...overrides,
});

describe('TimeDisputeService', () => {
  let service: TimeDisputeService;
  let prisma: PrismaMock;
  let editService: { editSession: jest.Mock };
  let auditLogger: { logTenantChange: jest.Mock };
  let notifications: { createNotification: jest.Mock };

  beforeEach(async () => {
    prisma = buildPrismaMock();
    editService = { editSession: jest.fn().mockResolvedValue(undefined) };
    auditLogger = { logTenantChange: jest.fn().mockResolvedValue(undefined) };
    notifications = {
      createNotification: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeDisputeService,
        { provide: PrismaService, useValue: prisma },
        { provide: ClockSessionEditService, useValue: editService },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuditLoggerService, useValue: auditLogger },
      ],
    }).compile();

    service = module.get(TimeDisputeService);
  });

  // ── submit ─────────────────────────────────────────────────────────

  describe('submit', () => {
    const validDto: CreateTimeDisputeDto = {
      dispute_type: DisputeTypeEnum.CORRECTION_REQUEST,
      description: 'I forgot to clock in',
      proposed_clock_in_at: '2026-04-10T07:00:00.000Z',
    };

    it('throws NotFoundException when the session is missing or in another tenant', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(null);

      await expect(
        service.submit(TENANT_ID, USER_ID, SESSION_ID, validDto),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.clock_session.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SESSION_ID, tenant_id: TENANT_ID },
        }),
      );
    });

    it('throws ConflictException when a pending dispute already exists', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(buildSession());
      prisma.time_dispute.findFirst.mockResolvedValue({ id: 'other-dispute' });

      await expect(
        service.submit(TENANT_ID, USER_ID, SESSION_ID, validDto),
      ).rejects.toThrow(ConflictException);

      expect(prisma.time_dispute.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            clock_session_id: SESSION_ID,
            status: 'pending',
          }),
        }),
      );
    });

    it('throws BadRequestException when a correction_request has no proposed values', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(buildSession());
      prisma.time_dispute.findFirst.mockResolvedValue(null);

      await expect(
        service.submit(TENANT_ID, USER_ID, SESSION_ID, {
          dispute_type: DisputeTypeEnum.CORRECTION_REQUEST,
          description: 'Please fix something',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows a flag_only dispute with no proposed values', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(buildSession());
      prisma.time_dispute.findFirst.mockResolvedValue(null);
      prisma.time_dispute.create.mockResolvedValue(buildDispute());
      prisma.user_tenant_membership.findMany.mockResolvedValue([]);

      await service.submit(TENANT_ID, USER_ID, SESSION_ID, {
        dispute_type: DisputeTypeEnum.FLAG_ONLY,
        description: 'GPS did not work on-site',
      });

      expect(prisma.time_dispute.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            clock_session_id: SESSION_ID,
            submitted_by_user_id: USER_ID,
            dispute_type: DisputeTypeEnum.FLAG_ONLY,
            status: 'pending',
          }),
        }),
      );
    });

    it('creates the dispute, notifies admins, and writes an audit log on success', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(buildSession());
      prisma.time_dispute.findFirst.mockResolvedValue(null);
      prisma.time_dispute.create.mockResolvedValue(buildDispute());
      prisma.user_tenant_membership.findMany.mockResolvedValue([
        { user_id: 'admin-1' },
      ]);

      const result = await service.submit(
        TENANT_ID,
        USER_ID,
        SESSION_ID,
        validDto,
      );

      expect(result.id).toBe(DISPUTE_ID);
      expect(notifications.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: TENANT_ID,
          user_id: 'admin-1',
          type: 'timeclock_dispute_submitted',
        }),
      );
      expect(auditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'created',
          entityType: 'time_dispute',
          entityId: DISPUTE_ID,
          tenantId: TENANT_ID,
          actorUserId: USER_ID,
        }),
      );
    });

    it('does not block creation when the notification pipeline fails', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(buildSession());
      prisma.time_dispute.findFirst.mockResolvedValue(null);
      prisma.time_dispute.create.mockResolvedValue(buildDispute());
      prisma.user_tenant_membership.findMany.mockRejectedValue(
        new Error('db boom'),
      );

      await expect(
        service.submit(TENANT_ID, USER_ID, SESSION_ID, validDto),
      ).resolves.toBeDefined();
    });
  });

  // ── findAll ────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('scopes every query by tenant_id and paginates', async () => {
      prisma.time_dispute.findMany.mockResolvedValue([buildDispute()]);
      prisma.time_dispute.count.mockResolvedValue(1);

      const result = await service.findAll(TENANT_ID, {
        page: 2,
        limit: 10,
        status: undefined,
      });

      expect(prisma.time_dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
          skip: 10,
          take: 10,
          orderBy: { created_at: 'desc' },
        }),
      );
      expect(result.meta).toEqual({
        total: 1,
        page: 2,
        limit: 10,
        totalPages: 1,
      });
    });

    it('applies status and employee_profile_id filters', async () => {
      prisma.time_dispute.findMany.mockResolvedValue([]);
      prisma.time_dispute.count.mockResolvedValue(0);

      await service.findAll(TENANT_ID, {
        status: 'pending' as any,
        employee_profile_id: 'emp-1',
      });

      expect(prisma.time_dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            status: 'pending',
            clock_session: { employee_profile_id: 'emp-1' },
          }),
        }),
      );
    });
  });

  // ── findMine ───────────────────────────────────────────────────────

  describe('findMine', () => {
    it('restricts the query to the submitter and the tenant', async () => {
      prisma.time_dispute.findMany.mockResolvedValue([]);
      prisma.time_dispute.count.mockResolvedValue(0);

      await service.findMine(TENANT_ID, USER_ID, {});

      expect(prisma.time_dispute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: TENANT_ID,
            submitted_by_user_id: USER_ID,
          }),
        }),
      );
    });
  });

  // ── findOne ────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws NotFoundException when the dispute does not exist in the tenant', async () => {
      prisma.time_dispute.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(TENANT_ID, USER_ID, DISPUTE_ID, ['Employee']),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.time_dispute.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: DISPUTE_ID, tenant_id: TENANT_ID },
        }),
      );
    });

    it('denies a non-admin user access to another user dispute', async () => {
      prisma.time_dispute.findFirst.mockResolvedValue(
        buildDispute({ submitted_by_user_id: OTHER_USER_ID }),
      );

      await expect(
        service.findOne(TENANT_ID, USER_ID, DISPUTE_ID, ['Employee']),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an admin to view any dispute', async () => {
      prisma.time_dispute.findFirst.mockResolvedValue(
        buildDispute({ submitted_by_user_id: OTHER_USER_ID }),
      );

      const result = await service.findOne(
        TENANT_ID,
        USER_ID,
        DISPUTE_ID,
        ['Admin'],
      );

      expect(result.id).toBe(DISPUTE_ID);
    });

    it('allows a user to view their own dispute even without an admin role', async () => {
      prisma.time_dispute.findFirst.mockResolvedValue(
        buildDispute({ submitted_by_user_id: USER_ID }),
      );

      const result = await service.findOne(
        TENANT_ID,
        USER_ID,
        DISPUTE_ID,
        ['Employee'],
      );

      expect(result.id).toBe(DISPUTE_ID);
    });
  });

  // ── approve ────────────────────────────────────────────────────────

  describe('approve', () => {
    const approveDto: ApproveDisputeDto = { review_notes: 'Confirmed' };

    it('throws NotFoundException when the dispute does not exist', async () => {
      prisma.time_dispute.findFirst.mockResolvedValue(null);

      await expect(
        service.approve(TENANT_ID, USER_ID, DISPUTE_ID, approveDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the dispute is not pending', async () => {
      prisma.time_dispute.findFirst.mockResolvedValue(
        buildDispute({ status: 'approved' }),
      );

      await expect(
        service.approve(TENANT_ID, USER_ID, DISPUTE_ID, approveDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('delegates the proposed values to ClockSessionEditService', async () => {
      prisma.time_dispute.findFirst.mockResolvedValue(buildDispute());
      prisma.time_dispute.update.mockResolvedValue(
        buildDispute({
          status: 'approved',
          reviewed_by_user_id: USER_ID,
          reviewed_at: new Date(),
        }),
      );

      await service.approve(TENANT_ID, USER_ID, DISPUTE_ID, approveDto);

      expect(editService.editSession).toHaveBeenCalledWith(
        TENANT_ID,
        USER_ID,
        SESSION_ID,
        expect.objectContaining({
          clock_in_at: '2026-04-10T07:00:00.000Z',
          reason: expect.stringContaining('Approved dispute:'),
        }),
      );

      expect(prisma.time_dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: DISPUTE_ID },
          data: expect.objectContaining({
            status: 'approved',
            reviewed_by_user_id: USER_ID,
            review_notes: 'Confirmed',
          }),
        }),
      );

      expect(auditLogger.logTenantChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'updated',
          entityType: 'time_dispute',
        }),
      );
    });

    it('skips the edit service entirely for a flag_only dispute with no proposed values', async () => {
      prisma.time_dispute.findFirst.mockResolvedValue(
        buildDispute({
          dispute_type: 'flag_only',
          proposed_clock_in_at: null,
          proposed_clock_out_at: null,
          proposed_project_id: null,
          proposed_task_id: null,
          proposed_notes: null,
        }),
      );
      prisma.time_dispute.update.mockResolvedValue(
        buildDispute({ status: 'approved' }),
      );

      await service.approve(TENANT_ID, USER_ID, DISPUTE_ID, {});

      expect(editService.editSession).not.toHaveBeenCalled();
      expect(prisma.time_dispute.update).toHaveBeenCalled();
    });
  });

  // ── reject ─────────────────────────────────────────────────────────

  describe('reject', () => {
    const rejectDto: RejectDisputeDto = {
      review_notes: 'GPS logs show otherwise',
    };

    it('throws BadRequestException when the dispute is not pending', async () => {
      prisma.time_dispute.findFirst.mockResolvedValue(
        buildDispute({ status: 'rejected' }),
      );

      await expect(
        service.reject(TENANT_ID, USER_ID, DISPUTE_ID, rejectDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects whitespace-only review_notes as a defense in depth', async () => {
      prisma.time_dispute.findFirst.mockResolvedValue(buildDispute());

      await expect(
        service.reject(TENANT_ID, USER_ID, DISPUTE_ID, {
          review_notes: '   ',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.time_dispute.update).not.toHaveBeenCalled();
    });

    it('does NOT touch the clock session when rejecting', async () => {
      prisma.time_dispute.findFirst.mockResolvedValue(buildDispute());
      prisma.time_dispute.update.mockResolvedValue(
        buildDispute({
          status: 'rejected',
          review_notes: rejectDto.review_notes,
        }),
      );

      await service.reject(TENANT_ID, USER_ID, DISPUTE_ID, rejectDto);

      expect(editService.editSession).not.toHaveBeenCalled();
      expect(prisma.time_dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'rejected',
            review_notes: rejectDto.review_notes,
            reviewed_by_user_id: USER_ID,
          }),
        }),
      );
    });
  });

  // ── cancel ─────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('throws NotFoundException when the dispute is missing', async () => {
      prisma.time_dispute.findFirst.mockResolvedValue(null);

      await expect(
        service.cancel(TENANT_ID, USER_ID, DISPUTE_ID, ['Employee']),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the dispute is already resolved', async () => {
      prisma.time_dispute.findFirst.mockResolvedValue(
        buildDispute({ status: 'resolved' }),
      );

      await expect(
        service.cancel(TENANT_ID, USER_ID, DISPUTE_ID, ['Owner']),
      ).rejects.toThrow(BadRequestException);
    });

    it('forbids a non-admin user from cancelling another user dispute', async () => {
      prisma.time_dispute.findFirst.mockResolvedValue(
        buildDispute({ submitted_by_user_id: OTHER_USER_ID }),
      );

      await expect(
        service.cancel(TENANT_ID, USER_ID, DISPUTE_ID, ['Employee']),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.time_dispute.update).not.toHaveBeenCalled();
    });

    it('allows the submitter to cancel their own dispute', async () => {
      prisma.time_dispute.findFirst.mockResolvedValue(buildDispute());
      prisma.time_dispute.update.mockResolvedValue(
        buildDispute({ status: 'resolved' }),
      );

      const result = await service.cancel(
        TENANT_ID,
        USER_ID,
        DISPUTE_ID,
        ['Employee'],
      );

      expect(result).toEqual({ message: 'Dispute cancelled' });
      expect(prisma.time_dispute.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: DISPUTE_ID },
          data: { status: 'resolved' },
        }),
      );
    });

    it('allows an admin to cancel any dispute in the tenant', async () => {
      prisma.time_dispute.findFirst.mockResolvedValue(
        buildDispute({ submitted_by_user_id: OTHER_USER_ID }),
      );
      prisma.time_dispute.update.mockResolvedValue(
        buildDispute({ status: 'resolved' }),
      );

      const result = await service.cancel(
        TENANT_ID,
        USER_ID,
        DISPUTE_ID,
        ['Admin'],
      );

      expect(result).toEqual({ message: 'Dispute cancelled' });
    });
  });
});
