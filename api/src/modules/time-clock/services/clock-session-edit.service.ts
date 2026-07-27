import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { NotificationsService } from '../../communication/services/notifications.service';
import { EditClockSessionDto } from '../dto/clock-session-edit.dto';
import { OvertimeService } from './overtime.service';

/**
 * Fields that a tenant Owner / Admin may modify through the
 * `PATCH /time-clock/sessions/:id` endpoint. Every other column
 * (status, employee_profile_id, is_flagged, flag_reason,
 *  labor_cost_posted, labor_cost_entry_id, ...) is explicitly
 * NOT editable via this path.
 */
const EDITABLE_FIELDS = [
  'clock_in_at',
  'clock_out_at',
  'project_id',
  'task_id',
  'notes',
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

interface FieldChange {
  field: EditableField;
  oldValue: string | null;
  newValue: string | null;
}

const ADMIN_ROLE_NAMES = ['Owner', 'Admin'] as const;

/**
 * Prisma include used when (re)fetching a clock session so the response
 * contains everything the frontend needs to render the detail view —
 * matches the include used by ClockSessionService.findOne().
 */
const DETAIL_INCLUDE = {
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
      crew_member: {
        select: { id: true, first_name: true, last_name: true },
      },
    },
  },
  project: {
    select: { id: true, name: true, project_number: true, status: true },
  },
  task: { select: { id: true, title: true, status: true } },
  work_shift: {
    select: {
      id: true,
      scheduled_start: true,
      scheduled_end: true,
      status: true,
      title: true,
    },
  },
  clockin_address: {
    select: { id: true, label: true, latitude: true, longitude: true },
  },
  break_entries: {
    orderBy: { started_at: 'asc' },
  },
  edit_logs: {
    orderBy: { edited_at: 'desc' },
    include: {
      edited_by: {
        select: { id: true, first_name: true, last_name: true },
      },
    },
  },
  disputes: {
    orderBy: { created_at: 'desc' },
  },
} satisfies Prisma.clock_sessionInclude;

/**
 * ClockSessionEditService
 *
 * Implements the business logic that powers
 * `PATCH /time-clock/sessions/:id`.
 *
 * Responsibilities:
 *  - Validate the edit payload (reason required).
 *  - Detect which editable fields actually changed.
 *  - Persist an IMMUTABLE `clock_session_edit_log` row per changed field.
 *  - Recalculate `total_worked_minutes`, `regular_minutes`, and
 *    `overtime_minutes` when a time field changed and the session is
 *    (or becomes) completed.
 *  - Flag the session for labor-cost reconciliation and notify admins
 *    when the edit lands on a session whose cost was already posted.
 *  - Emit a single audit-log entry that summarizes the edit batch.
 *
 * Notes:
 *  - `clock_session_edit_log` rows are write-once. They are created here,
 *    never updated, never deleted.
 *  - Multi-tenancy is enforced on every query via `where: { tenant_id }`.
 *  - The editor's user id is always taken from the JWT — never from the
 *    request body or query params.
 */
@Injectable()
export class ClockSessionEditService {
  private readonly logger = new Logger(ClockSessionEditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly overtimeService: OvertimeService,
    private readonly auditLogger: AuditLoggerService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async editSession(
    tenantId: string,
    userId: string,
    sessionId: string,
    dto: EditClockSessionDto,
  ) {
    // ── Step 1 — Load the session (tenant-scoped) ───────────────────
    const session = await this.prisma.clock_session.findFirst({
      where: { id: sessionId, tenant_id: tenantId },
      include: {
        employee_profile: {
          include: {
            user: {
              select: { id: true, first_name: true, last_name: true },
            },
          },
        },
        break_entries: true,
      },
    });

    if (!session) {
      throw new NotFoundException('Clock session not found');
    }

    // ── Step 2 — Defense-in-depth validation of `reason` ────────────
    // The DTO already enforces @IsNotEmpty, but a whitespace-only
    // string passes class-validator's IsNotEmpty check. Reject it here.
    if (!dto.reason || dto.reason.trim().length === 0) {
      throw new BadRequestException('Edit reason is required');
    }

    // ── Step 3 — Determine which fields actually changed ────────────
    const changes = this.computeChanges(session, dto);

    if (changes.length === 0) {
      // No actual changes — return the session as-is with full detail.
      return this.findDetailOrThrow(tenantId, sessionId);
    }

    // ── Step 4 — Create IMMUTABLE edit-log entries ──────────────────
    const editLogIds: string[] = [];
    for (const change of changes) {
      const logEntry = await this.prisma.clock_session_edit_log.create({
        data: {
          tenant_id: tenantId,
          clock_session_id: sessionId,
          edited_by_user_id: userId,
          field_changed: change.field,
          original_value: change.oldValue,
          new_value: change.newValue,
          reason: dto.reason,
        },
        select: { id: true },
      });
      editLogIds.push(logEntry.id);
    }

    // ── Step 5 & 6 — Build the update payload ───────────────────────
    // Step 5: `is_manual_edit` is always flipped to true after any edit.
    // Step 6: Apply only the fields that were explicitly provided and
    //         whose value actually differed from the stored value.
    const updateData: Prisma.clock_sessionUpdateInput = {
      is_manual_edit: true,
    };

    for (const change of changes) {
      switch (change.field) {
        case 'clock_in_at':
          // `null` is already rejected in computeChanges() — the column
          // is NOT NULL in the schema, so newValue is guaranteed to be
          // a non-null ISO string here.
          updateData.clock_in_at = new Date(change.newValue as string);
          break;
        case 'clock_out_at':
          updateData.clock_out_at =
            change.newValue !== null ? new Date(change.newValue) : null;
          break;
        case 'project_id':
          updateData.project =
            change.newValue !== null
              ? { connect: { id: change.newValue } }
              : { disconnect: true };
          break;
        case 'task_id':
          updateData.task =
            change.newValue !== null
              ? { connect: { id: change.newValue } }
              : { disconnect: true };
          break;
        case 'notes':
          updateData.notes = change.newValue;
          break;
      }
    }

    // ── Step 7 — Recalculate times if a time field changed AND the
    //            session is (or becomes) completed ──────────────────
    const timeFieldsChanged = changes.some(
      (c) => c.field === 'clock_in_at' || c.field === 'clock_out_at',
    );

    const clockInProvided = dto.clock_in_at !== undefined;
    const clockOutProvided = dto.clock_out_at !== undefined;

    const effectiveClockIn = clockInProvided
      ? new Date(dto.clock_in_at as string)
      : session.clock_in_at;

    const effectiveClockOut = clockOutProvided
      ? dto.clock_out_at
        ? new Date(dto.clock_out_at)
        : null
      : session.clock_out_at;

    if (timeFieldsChanged && effectiveClockOut) {
      const unpaidBreakMinutes = session.break_entries
        .filter((b) => b.break_type === 'unpaid' && b.duration_minutes != null)
        .reduce((sum, b) => sum + (b.duration_minutes ?? 0), 0);

      const elapsedMinutes = Math.floor(
        (effectiveClockOut.getTime() - effectiveClockIn.getTime()) / 60_000,
      );
      const totalWorkedMinutes = Math.max(
        0,
        elapsedMinutes - unpaidBreakMinutes,
      );

      updateData.total_worked_minutes = totalWorkedMinutes;

      // BR-006 — recalculate regular / overtime split.
      const overtimeResult = await this.overtimeService.calculateOvertime({
        tenantId,
        employeeProfileId: session.employee_profile_id,
        sessionId: session.id,
        totalWorkedMinutes,
        clockInAt: effectiveClockIn,
      });

      updateData.regular_minutes = overtimeResult.regular_minutes;
      updateData.overtime_minutes = overtimeResult.overtime_minutes;
    }
    // Step 8: if only non-time fields changed, nothing above runs —
    // total/regular/overtime minutes are preserved untouched.

    // ── Step 9 — Labor-cost reconciliation check ────────────────────
    if (session.labor_cost_posted === true) {
      updateData.labor_cost_reconciliation_needed = true;

      const employeeName = this.buildEmployeeDisplayName(
        session.employee_profile?.user?.first_name ?? null,
        session.employee_profile?.user?.last_name ?? null,
      );
      const sessionDate = new Date(session.clock_in_at)
        .toISOString()
        .split('T')[0];

      // Notification is best-effort — a delivery failure must NOT
      // block the edit from persisting.
      await this.notifyAdmins(
        tenantId,
        'timeclock_reconciliation_needed',
        'Reconciliation Needed',
        `Clock session for ${employeeName} on ${sessionDate} was edited after labor cost was posted — manual reconciliation required`,
        '/workforce/timesheets',
        sessionId,
      );
    }

    // ── Step 10 — Apply the update ──────────────────────────────────
    await this.prisma.clock_session.update({
      where: { id: sessionId },
      data: updateData,
    });

    // ── Step 11 — Audit log (single entry for the whole edit batch) ─
    const beforeSnapshot: Record<string, unknown> = {};
    const afterSnapshot: Record<string, unknown> = {};
    for (const change of changes) {
      beforeSnapshot[change.field] = change.oldValue;
      afterSnapshot[change.field] = change.newValue;
    }

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'clock_session',
      entityId: sessionId,
      tenantId,
      actorUserId: userId,
      before: beforeSnapshot,
      after: afterSnapshot,
      metadata: {
        edit_log_ids: editLogIds,
        reason: dto.reason,
        labor_cost_reconciliation_triggered: session.labor_cost_posted === true,
      },
      description: `Clock session ${sessionId} manually edited (${changes
        .map((c) => c.field)
        .join(', ')})`,
    });

    // ── Step 12 — Return the fully-hydrated session ────────────────
    return this.findDetailOrThrow(tenantId, sessionId);
  }

  // ─────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────

  /**
   * Compares the incoming DTO to the stored session and returns
   * the list of fields that actually changed. Values are normalized
   * to strings so dates, UUIDs, and text can share a single log schema.
   */
  private computeChanges(
    session: {
      clock_in_at: Date;
      clock_out_at: Date | null;
      project_id: string | null;
      task_id: string | null;
      notes: string | null;
    },
    dto: EditClockSessionDto,
  ): FieldChange[] {
    const changes: FieldChange[] = [];

    // NOTE: class-validator's @IsOptional() accepts null for every
    // optional field. We widen the DTO to `unknown` here so the service
    // can reason about null values explicitly — instead of trusting the
    // nominal `string | undefined` type.
    const rawDto = dto as unknown as Record<EditableField, unknown>;

    for (const field of EDITABLE_FIELDS) {
      const incoming = rawDto[field];
      if (incoming === undefined) {
        continue;
      }

      // `clock_in_at` is NOT NULL in the schema — rejecting null here
      // prevents a phantom edit-log entry that claims the field changed
      // to null while the database column is silently left untouched.
      if (field === 'clock_in_at' && incoming === null) {
        throw new BadRequestException('clock_in_at cannot be null');
      }

      const current = session[field];
      const oldStr = this.stringify(field, current);
      const newStr = this.stringify(field, incoming);

      if (oldStr !== newStr) {
        changes.push({ field, oldValue: oldStr, newValue: newStr });
      }
    }

    return changes;
  }

  /**
   * Normalizes a value to the canonical string used in
   * `clock_session_edit_log.original_value` / `new_value`.
   * Dates are emitted as ISO-8601 UTC so old/new comparisons are stable
   * regardless of whether the caller sent the value as a Date or string.
   */
  private stringify(field: EditableField, value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (field === 'clock_in_at' || field === 'clock_out_at') {
      const asDate = value instanceof Date ? value : new Date(value as string);
      if (Number.isNaN(asDate.getTime())) {
        return null;
      }
      return asDate.toISOString();
    }

    return String(value);
  }

  private async findDetailOrThrow(tenantId: string, sessionId: string) {
    const result = await this.prisma.clock_session.findFirst({
      where: { id: sessionId, tenant_id: tenantId },
      include: DETAIL_INCLUDE,
    });
    if (!result) {
      throw new NotFoundException('Clock session not found');
    }
    return result;
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
            related_entity_type: 'clock_session',
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
}
