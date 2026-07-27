import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { NotificationsService } from '../../communication/services/notifications.service';
import { EditClockSessionDto } from '../dto/clock-session-edit.dto';
import {
  ApproveDisputeDto,
  CreateTimeDisputeDto,
  DisputeTypeEnum,
  ListTimeDisputesDto,
  RejectDisputeDto,
} from '../dto/time-dispute.dto';
import { ClockSessionEditService } from './clock-session-edit.service';

/**
 * Roles that may review disputes and view any dispute in the tenant.
 */
const ADMIN_ROLE_NAMES = ['Owner', 'Admin'] as const;

/**
 * Detail include used when returning a single dispute from `findOne()`,
 * `approve()` and `reject()`. Contains the full session context so the
 * frontend can render a dispute detail view without a second request.
 */
const DISPUTE_DETAIL_INCLUDE = {
  clock_session: {
    include: {
      employee_profile: {
        include: {
          user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      },
      project: {
        select: { id: true, name: true, project_number: true, status: true },
      },
      task: { select: { id: true, title: true, status: true } },
      break_entries: { orderBy: { started_at: 'asc' } },
      edit_logs: {
        orderBy: { edited_at: 'desc' },
        include: {
          edited_by: {
            select: { id: true, first_name: true, last_name: true },
          },
        },
      },
    },
  },
  submitted_by: {
    select: { id: true, first_name: true, last_name: true },
  },
  reviewed_by: {
    select: { id: true, first_name: true, last_name: true },
  },
} satisfies Prisma.time_disputeInclude;

/**
 * Lighter include used for the paginated list endpoints.
 */
const DISPUTE_LIST_INCLUDE = {
  clock_session: {
    select: {
      id: true,
      clock_in_at: true,
      clock_out_at: true,
      status: true,
      employee_profile: {
        include: {
          user: {
            select: { id: true, first_name: true, last_name: true },
          },
        },
      },
    },
  },
  submitted_by: {
    select: { id: true, first_name: true, last_name: true },
  },
  reviewed_by: {
    select: { id: true, first_name: true, last_name: true },
  },
} satisfies Prisma.time_disputeInclude;

/**
 * TimeDisputeService
 *
 * Implements the complete Time Dispute lifecycle:
 *  - submit  → employee raises a dispute against a clock session
 *  - findAll → admin paginated view of every dispute in the tenant
 *  - findMine → employee paginated view of their own disputes
 *  - findOne → detail view with access control
 *  - approve → applies proposed values through ClockSessionEditService,
 *              which reuses the Sprint 11 edit-log / recalculation /
 *              reconciliation pipeline.
 *  - reject  → records rejection without touching the session
 *  - cancel  → submitter (or admin) cancels a pending dispute
 *
 * Multi-tenancy is enforced on every Prisma query via
 * `where: { tenant_id }`. The actor's user id is always taken from the
 * JWT, never from the request body or query params.
 */
@Injectable()
export class TimeDisputeService {
  private readonly logger = new Logger(TimeDisputeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly clockSessionEditService: ClockSessionEditService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  // ────────────────────────────────────────────────────────────────────
  // Method 1 — submit
  // ────────────────────────────────────────────────────────────────────

  async submit(
    tenantId: string,
    userId: string,
    sessionId: string,
    dto: CreateTimeDisputeDto,
  ) {
    // Step 1 — verify the session exists and belongs to the tenant.
    const session = await this.prisma.clock_session.findFirst({
      where: { id: sessionId, tenant_id: tenantId },
      select: {
        id: true,
        clock_in_at: true,
        employee_profile: {
          include: {
            user: {
              select: { id: true, first_name: true, last_name: true },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Clock session not found');
    }

    // Step 2 — reject if another pending dispute already exists for this
    // session. Only one open dispute per session is allowed.
    const existingPending = await this.prisma.time_dispute.findFirst({
      where: {
        tenant_id: tenantId,
        clock_session_id: sessionId,
        status: 'pending',
      },
      select: { id: true },
    });

    if (existingPending) {
      throw new ConflictException(
        'A pending dispute already exists for this session. Please wait for it to be reviewed or cancel it first.',
      );
    }

    // Step 3 — correction_request must include at least one proposed value.
    if (dto.dispute_type === DisputeTypeEnum.CORRECTION_REQUEST) {
      const hasAnyProposed =
        dto.proposed_clock_in_at != null ||
        dto.proposed_clock_out_at != null ||
        dto.proposed_project_id != null ||
        dto.proposed_task_id != null ||
        (dto.proposed_notes != null && dto.proposed_notes.length > 0);

      if (!hasAnyProposed) {
        throw new BadRequestException(
          'A correction request must include at least one proposed value (clock-in time, clock-out time, project, task, or notes)',
        );
      }
    }

    // Step 4 — create the dispute.
    const created = await this.prisma.time_dispute.create({
      data: {
        tenant_id: tenantId,
        clock_session_id: sessionId,
        submitted_by_user_id: userId,
        dispute_type: dto.dispute_type,
        description: dto.description,
        proposed_clock_in_at: dto.proposed_clock_in_at
          ? new Date(dto.proposed_clock_in_at)
          : null,
        proposed_clock_out_at: dto.proposed_clock_out_at
          ? new Date(dto.proposed_clock_out_at)
          : null,
        proposed_project_id: dto.proposed_project_id ?? null,
        proposed_task_id: dto.proposed_task_id ?? null,
        proposed_notes: dto.proposed_notes ?? null,
        status: 'pending',
      },
      include: DISPUTE_LIST_INCLUDE,
    });

    // Step 5 — notify every admin in the tenant. Best-effort: a delivery
    // failure must NOT block the dispute from being persisted.
    const employeeName = this.buildEmployeeDisplayName(
      session.employee_profile?.user?.first_name ?? null,
      session.employee_profile?.user?.last_name ?? null,
    );
    const sessionDate = new Date(session.clock_in_at)
      .toISOString()
      .split('T')[0];
    const disputeTypeLabel =
      dto.dispute_type === DisputeTypeEnum.CORRECTION_REQUEST
        ? 'correction request'
        : 'flag';

    await this.notifyAdmins(
      tenantId,
      'timeclock_dispute_submitted',
      'Time Dispute Submitted',
      `${employeeName} submitted a ${disputeTypeLabel} for the session on ${sessionDate}`,
      '/workforce/disputes',
      created.id,
    );

    // Step 6 — audit log.
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'time_dispute',
      entityId: created.id,
      tenantId,
      actorUserId: userId,
      after: {
        id: created.id,
        clock_session_id: created.clock_session_id,
        dispute_type: created.dispute_type,
        status: created.status,
      },
      metadata: { clock_session_id: sessionId },
      description: `Time dispute ${created.id} submitted for session ${sessionId}`,
    });

    return created;
  }

  // ────────────────────────────────────────────────────────────────────
  // Method 2 — findAll (admin)
  // ────────────────────────────────────────────────────────────────────

  async findAll(tenantId: string, query: ListTimeDisputesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.time_disputeWhereInput = { tenant_id: tenantId };

    if (query.status) {
      where.status = query.status;
    }

    if (query.employee_profile_id) {
      where.clock_session = {
        employee_profile_id: query.employee_profile_id,
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.time_dispute.findMany({
        where,
        include: DISPUTE_LIST_INCLUDE,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.time_dispute.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // Method 3 — findMine
  // ────────────────────────────────────────────────────────────────────

  async findMine(tenantId: string, userId: string, query: ListTimeDisputesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.time_disputeWhereInput = {
      tenant_id: tenantId,
      submitted_by_user_id: userId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.employee_profile_id) {
      where.clock_session = {
        employee_profile_id: query.employee_profile_id,
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.time_dispute.findMany({
        where,
        include: DISPUTE_LIST_INCLUDE,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.time_dispute.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ────────────────────────────────────────────────────────────────────
  // Method 4 — findOne
  // ────────────────────────────────────────────────────────────────────

  async findOne(
    tenantId: string,
    userId: string,
    disputeId: string,
    userRoles: string[],
  ) {
    const dispute = await this.prisma.time_dispute.findFirst({
      where: { id: disputeId, tenant_id: tenantId },
      include: DISPUTE_DETAIL_INCLUDE,
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (!this.isAdmin(userRoles) && dispute.submitted_by_user_id !== userId) {
      throw new ForbiddenException('You can only view your own disputes');
    }

    return dispute;
  }

  // ────────────────────────────────────────────────────────────────────
  // Method 5 — approve
  // ────────────────────────────────────────────────────────────────────

  async approve(
    tenantId: string,
    userId: string,
    disputeId: string,
    dto: ApproveDisputeDto,
  ) {
    // Step 1 — load the dispute with the session context we need to
    //          build the edit payload.
    const dispute = await this.prisma.time_dispute.findFirst({
      where: { id: disputeId, tenant_id: tenantId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Step 2 — only pending disputes can be approved.
    if (dispute.status !== 'pending') {
      throw new BadRequestException('Only pending disputes can be approved');
    }

    // Step 3 — build an edit DTO from the dispute's non-null proposed
    //          fields. Null/undefined fields are skipped so the edit
    //          service's change detection does not generate phantom
    //          edit-log entries.
    const shortDescription = dispute.description.slice(0, 200);
    const editDto: EditClockSessionDto = {
      reason: `Approved dispute: ${shortDescription}`,
    };

    if (dispute.proposed_clock_in_at) {
      editDto.clock_in_at = dispute.proposed_clock_in_at.toISOString();
    }
    if (dispute.proposed_clock_out_at) {
      editDto.clock_out_at = dispute.proposed_clock_out_at.toISOString();
    }
    if (dispute.proposed_project_id) {
      editDto.project_id = dispute.proposed_project_id;
    }
    if (dispute.proposed_task_id) {
      editDto.task_id = dispute.proposed_task_id;
    }
    if (dispute.proposed_notes != null) {
      editDto.notes = dispute.proposed_notes;
    }

    // Step 4 — if any proposed value is present, apply it through the
    //          edit service. This reuses ALL edit-log, recalculation,
    //          and labor-cost reconciliation behavior from Sprint 11.
    //          For a `flag_only` dispute with no proposed values this
    //          block is skipped entirely — approval simply records that
    //          the flag was reviewed and accepted.
    const hasProposedValues =
      editDto.clock_in_at !== undefined ||
      editDto.clock_out_at !== undefined ||
      editDto.project_id !== undefined ||
      editDto.task_id !== undefined ||
      editDto.notes !== undefined;

    if (hasProposedValues) {
      await this.clockSessionEditService.editSession(
        tenantId,
        userId,
        dispute.clock_session_id,
        editDto,
      );
    }

    // Step 5 — update the dispute status.
    const updated = await this.prisma.time_dispute.update({
      where: { id: disputeId },
      data: {
        status: 'approved',
        reviewed_by_user_id: userId,
        reviewed_at: new Date(),
        review_notes: dto.review_notes ?? null,
      },
      include: DISPUTE_DETAIL_INCLUDE,
    });

    // Step 6 — notify the employee. Best-effort.
    const sessionDate = new Date(updated.clock_session.clock_in_at)
      .toISOString()
      .split('T')[0];
    await this.sendNotificationSafe({
      tenant_id: tenantId,
      user_id: dispute.submitted_by_user_id,
      type: 'timeclock_dispute_approved',
      title: 'Dispute Approved',
      message: `Your time correction for ${sessionDate} has been approved`,
      action_url: '/workforce/my-timesheets',
      related_entity_type: 'time_dispute',
      related_entity_id: disputeId,
    });

    // Step 7 — audit log.
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'time_dispute',
      entityId: disputeId,
      tenantId,
      actorUserId: userId,
      before: { status: 'pending' },
      after: { status: 'approved', review_notes: dto.review_notes ?? null },
      metadata: {
        action: 'approved',
        session_id: dispute.clock_session_id,
        applied_fields: Object.keys(editDto).filter((k) => k !== 'reason'),
      },
      description: `Time dispute ${disputeId} approved`,
    });

    return updated;
  }

  // ────────────────────────────────────────────────────────────────────
  // Method 6 — reject
  // ────────────────────────────────────────────────────────────────────

  async reject(
    tenantId: string,
    userId: string,
    disputeId: string,
    dto: RejectDisputeDto,
  ) {
    // Step 1 — load the dispute.
    const dispute = await this.prisma.time_dispute.findFirst({
      where: { id: disputeId, tenant_id: tenantId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    // Step 2 — only pending disputes can be rejected.
    if (dispute.status !== 'pending') {
      throw new BadRequestException('Only pending disputes can be rejected');
    }

    // Step 3 — defense in depth: class-validator already enforces
    // @IsNotEmpty, but whitespace-only strings pass that check.
    if (!dto.review_notes || dto.review_notes.trim().length === 0) {
      throw new BadRequestException(
        'Review notes are required when rejecting a dispute',
      );
    }

    // Step 4 — update the dispute. The clock session is NOT touched.
    const updated = await this.prisma.time_dispute.update({
      where: { id: disputeId },
      data: {
        status: 'rejected',
        reviewed_by_user_id: userId,
        reviewed_at: new Date(),
        review_notes: dto.review_notes,
      },
      include: DISPUTE_DETAIL_INCLUDE,
    });

    // Step 5 — notify the employee (best-effort).
    const sessionDate = new Date(updated.clock_session.clock_in_at)
      .toISOString()
      .split('T')[0];
    await this.sendNotificationSafe({
      tenant_id: tenantId,
      user_id: dispute.submitted_by_user_id,
      type: 'timeclock_dispute_rejected',
      title: 'Dispute Not Approved',
      message: `Your time correction for ${sessionDate} was not approved. ${dto.review_notes}`,
      action_url: '/workforce/my-timesheets',
      related_entity_type: 'time_dispute',
      related_entity_id: disputeId,
    });

    // Step 6 — audit log.
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'time_dispute',
      entityId: disputeId,
      tenantId,
      actorUserId: userId,
      before: { status: 'pending' },
      after: { status: 'rejected', review_notes: dto.review_notes },
      metadata: {
        action: 'rejected',
        session_id: dispute.clock_session_id,
        review_notes: dto.review_notes,
      },
      description: `Time dispute ${disputeId} rejected`,
    });

    return updated;
  }

  // ────────────────────────────────────────────────────────────────────
  // Method 7 — cancel
  // ────────────────────────────────────────────────────────────────────

  async cancel(
    tenantId: string,
    userId: string,
    disputeId: string,
    userRoles: string[],
  ) {
    const dispute = await this.prisma.time_dispute.findFirst({
      where: { id: disputeId, tenant_id: tenantId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    if (dispute.status !== 'pending') {
      throw new BadRequestException('Only pending disputes can be cancelled');
    }

    if (dispute.submitted_by_user_id !== userId && !this.isAdmin(userRoles)) {
      throw new ForbiddenException('You can only cancel your own disputes');
    }

    await this.prisma.time_dispute.update({
      where: { id: disputeId },
      data: { status: 'resolved' },
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'time_dispute',
      entityId: disputeId,
      tenantId,
      actorUserId: userId,
      before: { status: 'pending' },
      after: { status: 'resolved' },
      metadata: {
        action: 'cancelled',
        session_id: dispute.clock_session_id,
      },
      description: `Time dispute ${disputeId} cancelled`,
    });

    return { message: 'Dispute cancelled' };
  }

  // ────────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────────

  private isAdmin(userRoles: string[]): boolean {
    if (!Array.isArray(userRoles)) {
      return false;
    }
    return userRoles.some((r) =>
      (ADMIN_ROLE_NAMES as readonly string[]).includes(r),
    );
  }

  private buildEmployeeDisplayName(
    firstName: string | null,
    lastName: string | null,
  ): string {
    const name = `${firstName ?? ''} ${lastName ?? ''}`.trim();
    return name.length > 0 ? name : 'An employee';
  }

  private async notifyAdmins(
    tenantId: string,
    type: string,
    title: string,
    message: string,
    actionUrl: string,
    relatedEntityId: string,
  ): Promise<void> {
    try {
      const admins = await this.prisma.user_tenant_membership.findMany({
        where: {
          tenant_id: tenantId,
          status: 'ACTIVE',
          role: { name: { in: [...ADMIN_ROLE_NAMES] } },
        },
        select: { user_id: true },
      });

      if (admins.length === 0) {
        return;
      }

      await Promise.all(
        admins.map((admin) =>
          this.notificationsService.createNotification({
            tenant_id: tenantId,
            user_id: admin.user_id,
            type,
            title,
            message,
            action_url: actionUrl,
            related_entity_type: 'time_dispute',
            related_entity_id: relatedEntityId,
          }),
        ),
      );
    } catch (error) {
      this.logger.error(
        `notifyAdmins failed (${type}) for tenant ${tenantId}: ${
          (error as Error).message
        }`,
      );
    }
  }

  private async sendNotificationSafe(params: {
    tenant_id: string;
    user_id: string;
    type: string;
    title: string;
    message: string;
    action_url: string;
    related_entity_type: string;
    related_entity_id: string;
  }): Promise<void> {
    try {
      await this.notificationsService.createNotification(params);
    } catch (error) {
      this.logger.error(
        `sendNotification failed (${params.type}) for user ${params.user_id}: ${
          (error as Error).message
        }`,
      );
    }
  }
}
