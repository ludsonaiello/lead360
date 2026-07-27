import { Injectable, Logger } from '@nestjs/common';
import { format } from 'date-fns-tz';
import { PrismaService } from '../../../core/database';
import { NotificationsService } from '../../communication/services/notifications.service';

const DEFAULT_TIMEZONE = 'America/New_York';
const ADMIN_ROLE_NAMES = ['Owner', 'Admin'] as const;

type HourlyRateLike = number | { toString(): string } | null | undefined;

interface EmployeeProfileWithCrewMember {
  id: string;
  user_id: string;
  crew_member_id: string | null;
  hourly_rate?: HourlyRateLike;
  crew_member?: {
    first_name?: string | null;
    last_name?: string | null;
    default_hourly_rate?: HourlyRateLike;
  } | null;
  user?: {
    first_name?: string | null;
    last_name?: string | null;
  } | null;
}

interface ClockSessionLike {
  id: string;
  project_id: string | null;
  task_id: string | null;
  clock_in_at: Date;
  regular_minutes: number | null;
  overtime_minutes: number | null;
  labor_cost_posted: boolean;
}

@Injectable()
export class LaborCostAttributionService {
  private readonly logger = new Logger(LaborCostAttributionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Posts a crew_hour_log entry for a completed clock session so the
   * financial module reflects labor cost.
   *
   * BR-005:
   *  - Skipped entirely if session has no project.
   *  - Skipped with a warning when the employee has no linked crew_member
   *    or no hourly rate available (employee override or crew default).
   *  - Idempotent: already-posted sessions are no-ops.
   *  - Source is `clockin_system` (NOT `manual`).
   *  - NEVER throws — any failure is logged and tenant admins are notified.
   */
  async postLaborCost(
    session: ClockSessionLike,
    employeeProfile: EmployeeProfileWithCrewMember,
    tenantId: string,
  ): Promise<void> {
    if (!session || !employeeProfile || !tenantId) {
      this.logger.warn(
        'postLaborCost called with missing session / employeeProfile / tenantId — skipping',
      );
      return;
    }

    const sessionId = session.id ?? 'unknown-session';

    try {
      if (!session.project_id) {
        return;
      }

      if (!employeeProfile.crew_member_id) {
        this.logger.warn(
          `Employee profile ${employeeProfile.id} has no crew_member_id — skipping labor cost for session ${sessionId}`,
        );
        return;
      }

      const rate = this.resolveHourlyRate(
        employeeProfile.hourly_rate,
        employeeProfile.crew_member?.default_hourly_rate,
      );
      if (rate === null) {
        this.logger.warn(
          `No hourly rate configured for employee ${employeeProfile.id} — skipping labor cost for session ${sessionId}`,
        );
        return;
      }

      if (session.labor_cost_posted === true) {
        this.logger.log(
          `Labor cost already posted for session ${sessionId} — skipping`,
        );
        return;
      }

      let logDateStr = '';
      try {
        const timezone = await this.resolveTenantTimezone(tenantId);
        const logDate = this.computeLogDate(session.clock_in_at, timezone);
        logDateStr = format(logDate, 'yyyy-MM-dd', { timeZone: 'UTC' });

        const entry = await this.prisma.crew_hour_log.create({
          data: {
            tenant_id: tenantId,
            crew_member_id: employeeProfile.crew_member_id,
            project_id: session.project_id,
            task_id: session.task_id ?? null,
            log_date: logDate,
            hours_regular: (session.regular_minutes ?? 0) / 60,
            hours_overtime: (session.overtime_minutes ?? 0) / 60,
            source: 'clockin_system',
            clockin_event_id: sessionId,
            notes: null,
            created_by_user_id: employeeProfile.user_id,
          },
        });

        await this.prisma.clock_session.update({
          where: { id: sessionId },
          data: {
            labor_cost_posted: true,
            labor_cost_entry_id: entry.id,
          },
        });

        this.logger.log(
          `Labor cost posted for session ${sessionId} (crew_hour_log ${entry.id})`,
        );
      } catch (innerError) {
        const err = innerError as Error;
        this.logger.error(
          `Failed to post labor cost for session ${sessionId}: ${err?.message ?? innerError}`,
          err?.stack,
        );
        await this.notifyTenantAdmins(
          tenantId,
          sessionId,
          employeeProfile,
          logDateStr || this.fallbackDateStr(session.clock_in_at),
        );
      }
    } catch (outerError) {
      const err = outerError as Error;
      this.logger.error(
        `Unexpected failure in postLaborCost for session ${sessionId}: ${err?.message ?? outerError}`,
        err?.stack,
      );
    }
  }

  private resolveHourlyRate(
    employeeRate: HourlyRateLike,
    crewDefaultRate: HourlyRateLike,
  ): number | null {
    const fromEmployee = this.toNumber(employeeRate);
    if (fromEmployee !== null) {
      return fromEmployee;
    }
    return this.toNumber(crewDefaultRate);
  }

  private toNumber(value: HourlyRateLike): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const numeric =
      typeof value === 'number' ? value : Number(value.toString());
    return Number.isFinite(numeric) ? numeric : null;
  }

  private async resolveTenantTimezone(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: { timezone: true },
    });
    return tenant?.timezone || DEFAULT_TIMEZONE;
  }

  private fallbackDateStr(clockInAt: Date): string {
    try {
      return format(clockInAt, 'yyyy-MM-dd', { timeZone: 'UTC' });
    } catch {
      return 'unknown date';
    }
  }

  private computeLogDate(clockInAt: Date, timezone: string): Date {
    const dayStr = format(clockInAt, 'yyyy-MM-dd', { timeZone: timezone });
    const [yearStr, monthStr, domStr] = dayStr.split('-');
    return new Date(
      Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(domStr)),
    );
  }

  private buildEmployeeDisplayName(
    employeeProfile: EmployeeProfileWithCrewMember,
  ): string {
    const crew = employeeProfile.crew_member;
    if (crew?.first_name || crew?.last_name) {
      return `${crew.first_name ?? ''} ${crew.last_name ?? ''}`.trim();
    }
    const user = employeeProfile.user;
    if (user?.first_name || user?.last_name) {
      return `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim();
    }
    return `employee ${employeeProfile.id}`;
  }

  private async notifyTenantAdmins(
    tenantId: string,
    sessionId: string,
    employeeProfile: EmployeeProfileWithCrewMember,
    logDateStr: string,
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
        this.logger.warn(
          `No tenant admins found for tenant ${tenantId} — labor cost failure for session ${sessionId} not notified`,
        );
        return;
      }

      const employeeName = this.buildEmployeeDisplayName(employeeProfile);
      const message = `Labor cost for ${employeeName} on ${logDateStr} could not be posted — manual action required`;

      await Promise.all(
        admins.map((admin) =>
          this.notificationsService.createNotification({
            tenant_id: tenantId,
            user_id: admin.user_id,
            type: 'timeclock_labor_cost_failed',
            title: 'Labor Cost Error',
            message,
            action_url: '/workforce/timesheets',
            related_entity_type: 'clock_session',
            related_entity_id: sessionId,
          }),
        ),
      );
    } catch (notifyError) {
      const err = notifyError as Error;
      this.logger.error(
        `Failed to notify tenant admins about labor cost failure for session ${sessionId}: ${err.message}`,
        err.stack,
      );
    }
  }
}
