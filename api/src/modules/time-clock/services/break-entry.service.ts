import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { BreakTypeEnum, StartBreakDto } from '../dto/break-entry.dto';

type BreakTypeValue = 'paid' | 'unpaid';

const ADMIN_ROLE_NAMES = ['Owner', 'Admin'] as const;

@Injectable()
export class BreakEntryService {
  constructor(private readonly prisma: PrismaService) {}

  // ────────────────────────────────────────────────────────────────
  // START BREAK — BR-007B / BR-016
  //
  // Concurrency model:
  //   All reads and writes run inside a single interactive transaction.
  //   The "session is active AND no break in progress" invariant is
  //   enforced by an atomic conditional updateMany on clock_session that
  //   flips status 'active' → 'on_break' in one statement. Two concurrent
  //   startBreak calls serialize on the row write lock; only one will see
  //   count=1, the other sees count=0 and is rejected with 409 Conflict.
  //   No unique index is needed — the session row itself is the lock.
  // ────────────────────────────────────────────────────────────────
  async startBreak(
    tenantId: string,
    userId: string,
    sessionId: string,
    dto: StartBreakDto,
    userRoles: string[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Step 1 — load the session (with employee profile for ownership)
      const session = await tx.clock_session.findFirst({
        where: { id: sessionId, tenant_id: tenantId },
        include: {
          employee_profile: { select: { id: true, user_id: true } },
        },
      });

      if (!session) {
        throw new NotFoundException('Clock session not found');
      }

      // Step 2 — ownership check
      this.assertSessionOwnership(
        session.employee_profile?.user_id,
        userId,
        userRoles,
      );

      // Step 3 — atomic status flip: only succeeds if session is still 'active'.
      // This is the concurrency gate. MySQL row-locks the clock_session row
      // during this UPDATE, serializing any concurrent startBreak calls.
      const flipResult = await tx.clock_session.updateMany({
        where: {
          id: sessionId,
          tenant_id: tenantId,
          status: 'active',
        },
        data: { status: 'on_break' },
      });

      if (flipResult.count === 0) {
        // Session is not 'active'. Use the originally-loaded status to
        // decide whether this is a 409 (already on break) or a 400 (not
        // startable — completed, etc). If the original snapshot showed
        // 'active' but the flip failed, a concurrent startBreak won the
        // race — report it as a conflict.
        if (session.status === 'completed') {
          throw new BadRequestException(
            'Can only start a break on an active session',
          );
        }
        throw new ConflictException('A break is already active.');
      }

      // Step 4 — create the break entry. At this point we hold the logical
      // lock (the session is 'on_break') so no other startBreak can slip in.
      const breakType: BreakTypeValue = dto.break_type ?? BreakTypeEnum.UNPAID;

      return tx.break_entry.create({
        data: {
          tenant_id: tenantId,
          clock_session_id: sessionId,
          break_type: breakType,
          break_label: dto.break_label ?? null,
          started_at: new Date(),
        },
      });
    });
  }

  // ────────────────────────────────────────────────────────────────
  // END BREAK
  //
  // Concurrency model:
  //   Loads the session + open break inside a transaction, then ends the
  //   break with an atomic conditional updateMany (where ended_at: null).
  //   Two concurrent endBreak calls serialize on the break_entry row
  //   lock; only one sees count=1, the other sees count=0 and is rejected
  //   with 404 "No active break found". Also guards against the race
  //   between endBreak and clockOut's auto-end.
  // ────────────────────────────────────────────────────────────────
  async endBreak(
    tenantId: string,
    userId: string,
    sessionId: string,
    userRoles: string[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Step 1 — load the session
      const session = await tx.clock_session.findFirst({
        where: { id: sessionId, tenant_id: tenantId },
        include: {
          employee_profile: { select: { id: true, user_id: true } },
        },
      });

      if (!session) {
        throw new NotFoundException('Clock session not found');
      }

      // Step 2 — ownership check
      this.assertSessionOwnership(
        session.employee_profile?.user_id,
        userId,
        userRoles,
      );

      // Step 3 — find the active break
      const openBreak = await tx.break_entry.findFirst({
        where: {
          tenant_id: tenantId,
          clock_session_id: sessionId,
          ended_at: null,
        },
      });

      if (!openBreak) {
        throw new NotFoundException('No active break found');
      }

      // Step 4 — compute duration (clamped at 0 for clock-skew safety)
      const endedAt = new Date();
      const startedAt = new Date(openBreak.started_at);
      const durationMinutes = Math.max(
        0,
        Math.floor((endedAt.getTime() - startedAt.getTime()) / 60000),
      );

      // Step 5 — atomic end: only succeeds if ended_at is still NULL.
      // Prevents double-end race (two concurrent endBreak calls) and
      // clock_out-vs-endBreak race.
      const endResult = await tx.break_entry.updateMany({
        where: { id: openBreak.id, ended_at: null },
        data: {
          ended_at: endedAt,
          duration_minutes: durationMinutes,
        },
      });

      if (endResult.count === 0) {
        // Another caller (concurrent endBreak or clockOut auto-end) ended
        // this break between our findFirst and our update.
        throw new NotFoundException('No active break found');
      }

      // Step 6 — restore session status to 'active'
      await tx.clock_session.update({
        where: { id: sessionId },
        data: { status: 'active' },
      });

      // Step 7 — return the canonical updated row (no extra DB round-trip)
      return {
        ...openBreak,
        ended_at: endedAt,
        duration_minutes: durationMinutes,
      };
    });
  }

  // ────────────────────────────────────────────────────────────────
  // LIST BREAKS
  // ────────────────────────────────────────────────────────────────
  async getBreaks(tenantId: string, sessionId: string) {
    const session = await this.prisma.clock_session.findFirst({
      where: { id: sessionId, tenant_id: tenantId },
      select: { id: true },
    });

    if (!session) {
      throw new NotFoundException('Clock session not found');
    }

    const data = await this.prisma.break_entry.findMany({
      where: {
        tenant_id: tenantId,
        clock_session_id: sessionId,
      },
      orderBy: { started_at: 'asc' },
    });

    return { data };
  }

  // ────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────
  private assertSessionOwnership(
    sessionUserId: string | null | undefined,
    callerUserId: string,
    callerRoles: string[],
  ): void {
    if (sessionUserId && sessionUserId === callerUserId) {
      return;
    }
    const hasAdminRole = callerRoles.some((role) =>
      (ADMIN_ROLE_NAMES as readonly string[]).includes(role),
    );
    if (hasAdminRole) {
      return;
    }
    throw new ForbiddenException(
      'You can only manage breaks on your own sessions',
    );
  }
}
