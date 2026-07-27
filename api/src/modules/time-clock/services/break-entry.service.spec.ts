import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../core/database/prisma.service';
import { BreakTypeEnum, StartBreakDto } from '../dto/break-entry.dto';
import { BreakEntryService } from './break-entry.service';

const TENANT_ID = 'tenant-uuid-0000';
const OTHER_USER_ID = 'user-uuid-9999';
const OWNER_USER_ID = 'user-uuid-0000';
const SESSION_ID = 'session-uuid-0000';
const BREAK_ID = 'break-uuid-0000';

const EMPLOYEE_ROLES = ['Employee'];
const ADMIN_ROLES = ['Admin'];

const buildPrismaMock = () => {
  const mock = {
    clock_session: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    break_entry: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  // The interactive $transaction(cb) form: run the callback with the same
  // mock so all in-tx calls route through the same jest mocks.
  mock.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) =>
    cb(mock),
  );
  return mock;
};

type PrismaMock = ReturnType<typeof buildPrismaMock>;

const buildActiveSession = (
  overrides: Partial<{ status: string; userId: string | null }> = {},
) => ({
  id: SESSION_ID,
  tenant_id: TENANT_ID,
  status: overrides.status ?? 'active',
  employee_profile: {
    id: 'profile-uuid-0000',
    user_id: overrides.userId === undefined ? OWNER_USER_ID : overrides.userId,
  },
});

describe('BreakEntryService', () => {
  let service: BreakEntryService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = buildPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BreakEntryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(BreakEntryService);
  });

  // ────────────────────────────────────────────────────────────────
  // startBreak
  // ────────────────────────────────────────────────────────────────
  describe('startBreak', () => {
    const dto: StartBreakDto = {
      break_type: BreakTypeEnum.UNPAID,
      break_label: 'Lunch',
    };

    it('creates an unpaid break via the atomic status-flip path', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(buildActiveSession());
      prisma.clock_session.updateMany.mockResolvedValue({ count: 1 });
      prisma.break_entry.create.mockResolvedValue({
        id: BREAK_ID,
        tenant_id: TENANT_ID,
        clock_session_id: SESSION_ID,
        break_type: 'unpaid',
        break_label: 'Lunch',
        started_at: new Date(),
        ended_at: null,
        duration_minutes: null,
      });

      const result = await service.startBreak(
        TENANT_ID,
        OWNER_USER_ID,
        SESSION_ID,
        dto,
        EMPLOYEE_ROLES,
      );

      expect(result.id).toBe(BREAK_ID);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.clock_session.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: SESSION_ID, tenant_id: TENANT_ID },
        }),
      );
      // The atomic status flip must be conditional on status='active'.
      expect(prisma.clock_session.updateMany).toHaveBeenCalledWith({
        where: {
          id: SESSION_ID,
          tenant_id: TENANT_ID,
          status: 'active',
        },
        data: { status: 'on_break' },
      });
      expect(prisma.break_entry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: TENANT_ID,
            clock_session_id: SESSION_ID,
            break_type: 'unpaid',
            break_label: 'Lunch',
          }),
        }),
      );
    });

    it('defaults break_type to unpaid and break_label to null when not provided', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(buildActiveSession());
      prisma.clock_session.updateMany.mockResolvedValue({ count: 1 });
      prisma.break_entry.create.mockResolvedValue({ id: BREAK_ID });

      await service.startBreak(
        TENANT_ID,
        OWNER_USER_ID,
        SESSION_ID,
        {},
        EMPLOYEE_ROLES,
      );

      expect(prisma.break_entry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            break_type: 'unpaid',
            break_label: null,
          }),
        }),
      );
    });

    it('throws NotFoundException when session does not exist', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(null);

      await expect(
        service.startBreak(
          TENANT_ID,
          OWNER_USER_ID,
          SESSION_ID,
          dto,
          EMPLOYEE_ROLES,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.clock_session.updateMany).not.toHaveBeenCalled();
      expect(prisma.break_entry.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the session is completed', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(
        buildActiveSession({ status: 'completed' }),
      );
      prisma.clock_session.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.startBreak(
          TENANT_ID,
          OWNER_USER_ID,
          SESSION_ID,
          dto,
          EMPLOYEE_ROLES,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.break_entry.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the session is already on_break', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(
        buildActiveSession({ status: 'on_break' }),
      );
      prisma.clock_session.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.startBreak(
          TENANT_ID,
          OWNER_USER_ID,
          SESSION_ID,
          dto,
          EMPLOYEE_ROLES,
        ),
      ).rejects.toThrow(ConflictException);

      expect(prisma.break_entry.create).not.toHaveBeenCalled();
    });

    it('rejects the losing call in a concurrent start race (snapshot said active, updateMany count=0)', async () => {
      // The session snapshot read showed 'active', but by the time our
      // conditional updateMany ran, a concurrent startBreak had already
      // flipped it to 'on_break'. The atomic flip returns count=0.
      prisma.clock_session.findFirst.mockResolvedValue(buildActiveSession());
      prisma.clock_session.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.startBreak(
          TENANT_ID,
          OWNER_USER_ID,
          SESSION_ID,
          dto,
          EMPLOYEE_ROLES,
        ),
      ).rejects.toThrow(ConflictException);

      // Critically: break_entry.create must NEVER run when the flip failed.
      expect(prisma.break_entry.create).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when caller is not the owner and has no admin role', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(buildActiveSession());

      await expect(
        service.startBreak(
          TENANT_ID,
          OTHER_USER_ID,
          SESSION_ID,
          dto,
          EMPLOYEE_ROLES,
        ),
      ).rejects.toThrow(ForbiddenException);

      // Ownership must fail BEFORE we touch any mutation.
      expect(prisma.clock_session.updateMany).not.toHaveBeenCalled();
      expect(prisma.break_entry.create).not.toHaveBeenCalled();
    });

    it('allows Admin role to start a break on another employee session', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(buildActiveSession());
      prisma.clock_session.updateMany.mockResolvedValue({ count: 1 });
      prisma.break_entry.create.mockResolvedValue({ id: BREAK_ID });

      const result = await service.startBreak(
        TENANT_ID,
        OTHER_USER_ID,
        SESSION_ID,
        dto,
        ADMIN_ROLES,
      );

      expect(result.id).toBe(BREAK_ID);
    });

    it('runs inside an interactive transaction', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(buildActiveSession());
      prisma.clock_session.updateMany.mockResolvedValue({ count: 1 });
      prisma.break_entry.create.mockResolvedValue({ id: BREAK_ID });

      await service.startBreak(
        TENANT_ID,
        OWNER_USER_ID,
        SESSION_ID,
        dto,
        EMPLOYEE_ROLES,
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(typeof prisma.$transaction.mock.calls[0][0]).toBe('function');
    });

    it('always filters clock_session by tenant_id on both lookup and flip', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(buildActiveSession());
      prisma.clock_session.updateMany.mockResolvedValue({ count: 1 });
      prisma.break_entry.create.mockResolvedValue({ id: BREAK_ID });

      await service.startBreak(
        TENANT_ID,
        OWNER_USER_ID,
        SESSION_ID,
        dto,
        EMPLOYEE_ROLES,
      );

      expect(prisma.clock_session.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
      expect(prisma.clock_session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // endBreak
  // ────────────────────────────────────────────────────────────────
  describe('endBreak', () => {
    const startedAt = new Date(Date.now() - 15 * 60 * 1000); // 15 minutes ago

    it('ends the active break and computes duration_minutes via conditional updateMany', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(buildActiveSession());
      prisma.break_entry.findFirst.mockResolvedValue({
        id: BREAK_ID,
        tenant_id: TENANT_ID,
        clock_session_id: SESSION_ID,
        break_type: 'unpaid',
        break_label: 'Lunch',
        started_at: startedAt,
        ended_at: null,
        duration_minutes: null,
      });
      prisma.break_entry.updateMany.mockResolvedValue({ count: 1 });
      prisma.clock_session.update.mockResolvedValue({});

      const result = await service.endBreak(
        TENANT_ID,
        OWNER_USER_ID,
        SESSION_ID,
        EMPLOYEE_ROLES,
      );

      // Atomic end — the where clause must also check ended_at: null
      // so a concurrent endBreak or clockOut auto-end cannot double-end.
      const updateArgs = prisma.break_entry.updateMany.mock.calls[0][0];
      expect(updateArgs.where).toEqual({ id: BREAK_ID, ended_at: null });
      expect(updateArgs.data.duration_minutes).toBeGreaterThanOrEqual(14);
      expect(updateArgs.data.duration_minutes).toBeLessThanOrEqual(16);
      expect(updateArgs.data.ended_at).toBeInstanceOf(Date);

      // Session status flipped back to active.
      expect(prisma.clock_session.update).toHaveBeenCalledWith({
        where: { id: SESSION_ID },
        data: { status: 'active' },
      });

      expect(result.id).toBe(BREAK_ID);
      expect(result.ended_at).toBeInstanceOf(Date);
      expect(result.duration_minutes).toBeGreaterThanOrEqual(14);
    });

    it('clamps negative duration to zero', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(buildActiveSession());
      prisma.break_entry.findFirst.mockResolvedValue({
        id: BREAK_ID,
        started_at: new Date(Date.now() + 60 * 60 * 1000), // future
      });
      prisma.break_entry.updateMany.mockResolvedValue({ count: 1 });
      prisma.clock_session.update.mockResolvedValue({});

      const result = await service.endBreak(
        TENANT_ID,
        OWNER_USER_ID,
        SESSION_ID,
        EMPLOYEE_ROLES,
      );

      const updateArgs = prisma.break_entry.updateMany.mock.calls[0][0];
      expect(updateArgs.data.duration_minutes).toBe(0);
      expect(result.duration_minutes).toBe(0);
    });

    it('throws NotFoundException when session does not exist', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(null);

      await expect(
        service.endBreak(TENANT_ID, OWNER_USER_ID, SESSION_ID, EMPLOYEE_ROLES),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.break_entry.updateMany).not.toHaveBeenCalled();
      expect(prisma.clock_session.update).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when caller is not the owner', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(buildActiveSession());

      await expect(
        service.endBreak(TENANT_ID, OTHER_USER_ID, SESSION_ID, EMPLOYEE_ROLES),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.break_entry.findFirst).not.toHaveBeenCalled();
      expect(prisma.break_entry.updateMany).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when no active break exists', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(buildActiveSession());
      prisma.break_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.endBreak(TENANT_ID, OWNER_USER_ID, SESSION_ID, EMPLOYEE_ROLES),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.break_entry.updateMany).not.toHaveBeenCalled();
      expect(prisma.clock_session.update).not.toHaveBeenCalled();
    });

    it('rejects the losing call in a concurrent end race (found break, updateMany count=0)', async () => {
      // Two concurrent endBreak calls: both find the same open break row,
      // but only one wins the conditional updateMany. The loser sees count=0
      // and must NOT flip the session status back to 'active'.
      prisma.clock_session.findFirst.mockResolvedValue(buildActiveSession());
      prisma.break_entry.findFirst.mockResolvedValue({
        id: BREAK_ID,
        started_at: startedAt,
      });
      prisma.break_entry.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.endBreak(TENANT_ID, OWNER_USER_ID, SESSION_ID, EMPLOYEE_ROLES),
      ).rejects.toThrow(NotFoundException);

      // Critical: the losing racer must NOT flip session status back.
      expect(prisma.clock_session.update).not.toHaveBeenCalled();
    });

    it('allows Owner role to end a break on another employee session', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(buildActiveSession());
      prisma.break_entry.findFirst.mockResolvedValue({
        id: BREAK_ID,
        started_at: startedAt,
      });
      prisma.break_entry.updateMany.mockResolvedValue({ count: 1 });
      prisma.clock_session.update.mockResolvedValue({});

      const result = await service.endBreak(
        TENANT_ID,
        OTHER_USER_ID,
        SESSION_ID,
        ['Owner'],
      );

      expect(result.id).toBe(BREAK_ID);
    });

    it('runs inside an interactive transaction', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(buildActiveSession());
      prisma.break_entry.findFirst.mockResolvedValue({
        id: BREAK_ID,
        started_at: startedAt,
      });
      prisma.break_entry.updateMany.mockResolvedValue({ count: 1 });
      prisma.clock_session.update.mockResolvedValue({});

      await service.endBreak(
        TENANT_ID,
        OWNER_USER_ID,
        SESSION_ID,
        EMPLOYEE_ROLES,
      );

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(typeof prisma.$transaction.mock.calls[0][0]).toBe('function');
    });

    it('always filters break_entry and clock_session by tenant_id', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(buildActiveSession());
      prisma.break_entry.findFirst.mockResolvedValue(null);

      await expect(
        service.endBreak(TENANT_ID, OWNER_USER_ID, SESSION_ID, EMPLOYEE_ROLES),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.clock_session.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
      expect(prisma.break_entry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────────
  // getBreaks
  // ────────────────────────────────────────────────────────────────
  describe('getBreaks', () => {
    it('returns all breaks ordered by started_at ASC', async () => {
      prisma.clock_session.findFirst.mockResolvedValue({ id: SESSION_ID });
      const breaks = [
        { id: 'break-1', started_at: new Date('2026-01-01T08:00:00Z') },
        { id: 'break-2', started_at: new Date('2026-01-01T12:00:00Z') },
      ];
      prisma.break_entry.findMany.mockResolvedValue(breaks);

      const result = await service.getBreaks(TENANT_ID, SESSION_ID);

      expect(result).toEqual({ data: breaks });
      expect(prisma.break_entry.findMany).toHaveBeenCalledWith({
        where: {
          tenant_id: TENANT_ID,
          clock_session_id: SESSION_ID,
        },
        orderBy: { started_at: 'asc' },
      });
    });

    it('throws NotFoundException when session does not exist', async () => {
      prisma.clock_session.findFirst.mockResolvedValue(null);

      await expect(service.getBreaks(TENANT_ID, SESSION_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('enforces tenant isolation on both session lookup and break listing', async () => {
      prisma.clock_session.findFirst.mockResolvedValue({ id: SESSION_ID });
      prisma.break_entry.findMany.mockResolvedValue([]);

      await service.getBreaks(TENANT_ID, SESSION_ID);

      expect(prisma.clock_session.findFirst).toHaveBeenCalledWith({
        where: { id: SESSION_ID, tenant_id: TENANT_ID },
        select: { id: true },
      });
      expect(prisma.break_entry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant_id: TENANT_ID }),
        }),
      );
    });
  });
});
