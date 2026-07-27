import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { NotificationsService } from '../../communication/services/notifications.service';

/**
 * Shift Reminder Service
 *
 * Sends in-app reminder notifications to employees for upcoming work shifts.
 *
 * Behavior:
 *  - Each tenant defines its own `shift_reminder_minutes` lead time.
 *  - Only published shifts (`published_at IS NOT NULL`) are eligible.
 *  - A shift is reminded at most once: `reminder_sent_at` is stamped BEFORE
 *    the notification is dispatched. If the notification call fails and the
 *    job is retried, the shift will be skipped on the second pass — by design,
 *    a missed reminder is preferred over a duplicate notification.
 *
 * Tenant Isolation:
 *  - Iterates active tenants individually.
 *  - One tenant failure never blocks subsequent tenants.
 *  - Every Prisma query carries an explicit `tenant_id` filter for
 *    defense-in-depth.
 */
@Injectable()
export class ShiftReminderService {
  private readonly logger = new Logger(ShiftReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Entry point — iterates every active tenant.
   */
  async sendReminders(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({
      where: { is_active: true, deleted_at: null },
      select: { id: true },
    });

    for (const tenant of tenants) {
      try {
        await this.processTenantReminders(tenant.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          `Shift reminder failed for tenant ${tenant.id}: ${message}`,
          stack,
        );
      }
    }
  }

  /**
   * Per-tenant reminder dispatch.
   */
  private async processTenantReminders(tenantId: string): Promise<void> {
    const settings = await this.prisma.time_clock_settings.findFirst({
      where: { tenant_id: tenantId },
      select: { shift_reminder_minutes: true },
    });

    if (!settings || !settings.shift_reminder_minutes) {
      return;
    }

    const now = new Date();
    const reminderWindow = new Date(
      now.getTime() + settings.shift_reminder_minutes * 60 * 1000,
    );

    const shifts = await this.prisma.work_shift.findMany({
      where: {
        tenant_id: tenantId,
        status: 'scheduled',
        scheduled_start: { gte: now, lte: reminderWindow },
        reminder_sent_at: null,
        published_at: { not: null },
      },
      include: {
        employee_profile: {
          include: {
            user: {
              select: { id: true, first_name: true, last_name: true },
            },
          },
        },
        project: { select: { name: true } },
      },
    });

    if (shifts.length === 0) {
      return;
    }

    let sentCount = 0;

    for (const shift of shifts) {
      // Stamp the reminder timestamp BEFORE sending the notification to
      // guarantee at-most-once delivery on retry.
      const stamped = await this.prisma.work_shift.updateMany({
        where: {
          id: shift.id,
          tenant_id: tenantId,
          reminder_sent_at: null,
        },
        data: { reminder_sent_at: new Date() },
      });

      // If another worker stamped the row first, skip it.
      if (stamped.count === 0) {
        continue;
      }

      const minutesUntilShift = Math.max(
        0,
        Math.round((shift.scheduled_start.getTime() - Date.now()) / 60000),
      );
      const projectName = shift.project?.name ?? 'Unassigned';

      try {
        await this.notificationsService.createNotification({
          tenant_id: tenantId,
          user_id: shift.employee_profile.user.id,
          type: 'timeclock_shift_reminder',
          title: 'Upcoming Shift',
          message: `Your shift starts in ${minutesUntilShift} minute${minutesUntilShift === 1 ? '' : 's'} — ${projectName}`,
          action_url: '/workforce/my-shifts',
          related_entity_type: 'work_shift',
          related_entity_id: shift.id,
        });
        sentCount++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to send shift reminder for shift ${shift.id} (tenant ${tenantId}): ${message}`,
        );
      }
    }

    if (sentCount > 0) {
      this.logger.log(
        `Tenant ${tenantId}: sent ${sentCount} shift reminder(s)`,
      );
    }
  }
}
