import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { NotificationsService } from '../../communication/services/notifications.service';

interface NotificationPayload {
  type: string;
  title: string;
  message: string;
  action_url: string;
}

/**
 * Missed Shift Service (BR-010)
 *
 * Detects scheduled shifts that have started past the tenant-configured
 * `missed_shift_threshold_minutes` without an associated clock-in, marks them
 * as `missed`, and notifies both the assigned employee and tenant Owners /
 * Admins.
 *
 * Tenant Isolation:
 *  - Iterates active tenants individually.
 *  - One tenant failure never blocks subsequent tenants (try/catch per tenant).
 *  - Every Prisma query carries an explicit `tenant_id` filter for
 *    defense-in-depth, even though the loop is already scoped per tenant.
 *
 * Session matching strategy:
 *  - Primary match: `clock_session.work_shift_id = shift.id`
 *  - Fallback: any clock_session whose `clock_in_at` lies within +/- 2h of
 *    `shift.scheduled_start` for the same employee — this absorbs early
 *    clock-ins or sessions where the explicit shift link was never set.
 */
@Injectable()
export class MissedShiftService {
  private readonly logger = new Logger(MissedShiftService.name);
  private static readonly SESSION_MATCH_WINDOW_MS = 2 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Entry point — iterates every active tenant.
   */
  async detectMissedShifts(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({
      where: { is_active: true, deleted_at: null },
      select: { id: true },
    });

    this.logger.log(
      `Running missed shift detection across ${tenants.length} active tenant(s)`,
    );

    for (const tenant of tenants) {
      try {
        await this.processTenantMissedShifts(tenant.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          `Missed shift check failed for tenant ${tenant.id}: ${message}`,
          stack,
        );
      }
    }
  }

  /**
   * Per-tenant missed shift detection.
   */
  private async processTenantMissedShifts(tenantId: string): Promise<void> {
    const settings = await this.prisma.time_clock_settings.findFirst({
      where: { tenant_id: tenantId },
      select: { missed_shift_threshold_minutes: true },
    });

    if (!settings || !settings.missed_shift_threshold_minutes) {
      return;
    }

    const thresholdMinutes = settings.missed_shift_threshold_minutes;
    const thresholdTime = new Date(Date.now() - thresholdMinutes * 60 * 1000);

    const shifts = await this.prisma.work_shift.findMany({
      where: {
        tenant_id: tenantId,
        status: 'scheduled',
        scheduled_start: { lt: thresholdTime },
      },
      include: {
        employee_profile: {
          include: {
            user: {
              select: { id: true, first_name: true, last_name: true },
            },
          },
        },
      },
    });

    if (shifts.length === 0) {
      return;
    }

    let markedCount = 0;

    for (const shift of shifts) {
      const windowStart = new Date(
        shift.scheduled_start.getTime() -
          MissedShiftService.SESSION_MATCH_WINDOW_MS,
      );
      const windowEnd = new Date(
        shift.scheduled_start.getTime() +
          MissedShiftService.SESSION_MATCH_WINDOW_MS,
      );

      const existingSession = await this.prisma.clock_session.findFirst({
        where: {
          tenant_id: tenantId,
          employee_profile_id: shift.employee_profile_id,
          OR: [
            { work_shift_id: shift.id },
            { clock_in_at: { gte: windowStart, lte: windowEnd } },
          ],
        },
        select: { id: true },
      });

      if (existingSession) {
        continue;
      }

      await this.prisma.work_shift.update({
        where: { id: shift.id },
        data: { status: 'missed' },
      });

      markedCount++;

      const employeeUser = shift.employee_profile.user;
      const employeeName =
        `${employeeUser.first_name ?? ''} ${employeeUser.last_name ?? ''}`.trim() ||
        'Employee';
      const minutesAgo = Math.max(
        0,
        Math.round((Date.now() - shift.scheduled_start.getTime()) / 60000),
      );
      const shiftDate = shift.scheduled_start.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      const shiftTime = shift.scheduled_start.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });

      await this.notifyAdmins(
        tenantId,
        {
          type: 'timeclock_missed_shift',
          title: 'Missed Shift',
          message: `${employeeName} has not clocked in — shift started ${minutesAgo} minute${minutesAgo === 1 ? '' : 's'} ago`,
          action_url: '/workforce/timesheets',
        },
        shift.id,
      );

      await this.notifyEmployee(
        tenantId,
        employeeUser.id,
        {
          type: 'timeclock_missed_shift',
          title: 'Missed Shift',
          message: `You were marked as missed for your shift on ${shiftDate} at ${shiftTime}`,
          action_url: '/workforce/my-shifts',
        },
        shift.id,
      );
    }

    if (markedCount > 0) {
      this.logger.log(
        `Tenant ${tenantId}: marked ${markedCount} shift(s) as missed`,
      );
    }
  }

  /**
   * Notify every Owner / Admin of the tenant.
   */
  private async notifyAdmins(
    tenantId: string,
    payload: NotificationPayload,
    relatedShiftId: string,
  ): Promise<void> {
    const admins = await this.prisma.user.findMany({
      where: {
        is_active: true,
        deleted_at: null,
        memberships: {
          some: {
            tenant_id: tenantId,
            status: 'ACTIVE',
            role: { name: { in: ['Owner', 'Admin'] } },
          },
        },
      },
      select: { id: true },
    });

    for (const admin of admins) {
      try {
        await this.notificationsService.createNotification({
          tenant_id: tenantId,
          user_id: admin.id,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          action_url: payload.action_url,
          related_entity_type: 'work_shift',
          related_entity_id: relatedShiftId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to notify admin ${admin.id} of tenant ${tenantId}: ${message}`,
        );
      }
    }
  }

  /**
   * Notify a single employee user.
   */
  private async notifyEmployee(
    tenantId: string,
    userId: string,
    payload: NotificationPayload,
    relatedShiftId: string,
  ): Promise<void> {
    try {
      await this.notificationsService.createNotification({
        tenant_id: tenantId,
        user_id: userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        action_url: payload.action_url,
        related_entity_type: 'work_shift',
        related_entity_id: relatedShiftId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to notify employee ${userId} of tenant ${tenantId}: ${message}`,
      );
    }
  }
}
