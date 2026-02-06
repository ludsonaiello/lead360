import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { JobQueueService } from '../../jobs/services/job-queue.service';
import { DashboardService } from './dashboard.service';
import { randomBytes } from 'crypto';
import { subDays } from 'date-fns';

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private readonly NOTIFICATION_RETENTION_DAYS = 30;
  private readonly MAX_NOTIFICATIONS = 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobQueue: JobQueueService,
    private readonly dashboardService: DashboardService,
  ) {}

  /**
   * Create in-app notification
   */
  async createNotification(notificationDto: {
    type: string;
    title: string;
    message: string;
    link?: string;
    expires_at?: Date;
  }) {
    try {
      const notification = await this.prisma.admin_notification.create({
        data: {
          id: randomBytes(16).toString('hex'),
          type: notificationDto.type,
          title: notificationDto.title,
          message: notificationDto.message,
          link: notificationDto.link,
          expires_at: notificationDto.expires_at,
          is_read: false,
          created_at: new Date(),
        },
      });

      this.logger.log(
        `Admin notification created: ${notification.type} - ${notification.title}`,
      );

      return notification;
    } catch (error) {
      this.logger.error(
        `Failed to create notification: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Send email alert to Platform Admins immediately
   */
  async sendEmailAlert(alert: {
    subject: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
  }) {
    try {
      // Get all Platform Admin email addresses
      const platformAdmins = await this.prisma.user.findMany({
        where: { is_platform_admin: true },
        select: { email: true, first_name: true, last_name: true },
      });

      if (platformAdmins.length === 0) {
        this.logger.warn('No Platform Admins found to send alert email');
        return;
      }

      const recipients = platformAdmins.map((admin) => admin.email);

      // Queue email for each admin
      for (const admin of platformAdmins) {
        await this.jobQueue.queueEmail({
          to: admin.email,
          templateKey: 'admin_alert',
          variables: {
            admin_name: `${admin.first_name} ${admin.last_name}`,
            alert_type: alert.type,
            alert_title: alert.title,
            alert_message: alert.message,
            alert_link: alert.link,
            alert_priority: alert.priority || 'medium',
            timestamp: new Date().toISOString(),
          },
        });
      }

      this.logger.log(
        `Alert email queued to ${recipients.length} Platform Admins: ${alert.subject}`,
      );

      return { sent_to: recipients, count: recipients.length };
    } catch (error) {
      this.logger.error(
        `Failed to send email alert: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Send daily stats email (scheduled job - daily at 8am)
   */
  async sendDailyStatsEmail() {
    try {
      this.logger.log('Generating daily stats email...');

      // Get dashboard metrics
      const metrics = await this.dashboardService.getMetrics();

      // Get yesterday's activity
      const yesterdayActivity =
        await this.dashboardService.getRecentActivity(20);

      // Get Platform Admin emails
      const platformAdmins = await this.prisma.user.findMany({
        where: { is_platform_admin: true },
        select: { email: true, first_name: true, last_name: true },
      });

      if (platformAdmins.length === 0) {
        this.logger.warn('No Platform Admins found for daily stats email');
        return;
      }

      // Queue email for each admin
      for (const admin of platformAdmins) {
        await this.jobQueue.queueEmail({
          to: admin.email,
          templateKey: 'admin_daily_stats',
          variables: {
            admin_name: `${admin.first_name} ${admin.last_name}`,
            date: new Date().toISOString().split('T')[0],
            active_tenants: metrics.activeTenants.count,
            tenants_growth: metrics.activeTenants.growth,
            total_users: metrics.totalUsers.count,
            users_growth: metrics.totalUsers.growth,
            job_success_rate: metrics.jobSuccessRate.percentage,
            job_status: metrics.jobSuccessRate.status,
            storage_used_gb: metrics.storageUsed.current,
            storage_percentage: metrics.storageUsed.percentage,
            system_health: metrics.systemHealth.status,
            recent_activity: yesterdayActivity,
          },
        });
      }

      this.logger.log(
        `Daily stats email queued to ${platformAdmins.length} Platform Admins`,
      );

      return { sent_to: platformAdmins.length };
    } catch (error) {
      this.logger.error(
        `Failed to send daily stats email: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string) {
    try {
      const notification = await this.prisma.admin_notification.findUnique({
        where: { id: notificationId },
      });

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      if (notification.is_read) {
        return notification; // Already read
      }

      const updatedNotification = await this.prisma.admin_notification.update({
        where: { id: notificationId },
        data: { is_read: true },
      });

      return updatedNotification;
    } catch (error) {
      this.logger.error(
        `Failed to mark notification as read: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead() {
    try {
      const result = await this.prisma.admin_notification.updateMany({
        where: { is_read: false },
        data: { is_read: true },
      });

      this.logger.log(`Marked ${result.count} notifications as read`);

      return { marked_read: result.count };
    } catch (error) {
      this.logger.error(
        `Failed to mark all as read: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string) {
    try {
      const notification = await this.prisma.admin_notification.findUnique({
        where: { id: notificationId },
      });

      if (!notification) {
        throw new NotFoundException('Notification not found');
      }

      await this.prisma.admin_notification.delete({
        where: { id: notificationId },
      });

      this.logger.log(`Notification deleted: ${notificationId}`);

      return { message: 'Notification deleted successfully' };
    } catch (error) {
      this.logger.error(
        `Failed to delete notification: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Cleanup expired notifications (background job - daily at 2am)
   */
  async cleanupExpiredNotifications() {
    try {
      const retentionDate = subDays(
        new Date(),
        this.NOTIFICATION_RETENTION_DAYS,
      );

      // Delete notifications older than retention period
      const oldNotifications = await this.prisma.admin_notification.deleteMany({
        where: {
          created_at: { lt: retentionDate },
        },
      });

      this.logger.log(
        `Deleted ${oldNotifications.count} expired notifications (>${this.NOTIFICATION_RETENTION_DAYS} days old)`,
      );

      // Also delete explicitly expired notifications
      const expiredNotifications =
        await this.prisma.admin_notification.deleteMany({
          where: {
            expires_at: { lt: new Date() },
          },
        });

      this.logger.log(
        `Deleted ${expiredNotifications.count} explicitly expired notifications`,
      );

      // Check if total count exceeds max - delete oldest if needed
      const totalCount = await this.prisma.admin_notification.count();

      if (totalCount > this.MAX_NOTIFICATIONS) {
        const excessCount = totalCount - this.MAX_NOTIFICATIONS;

        // Get IDs of oldest notifications to delete
        const oldestNotifications =
          await this.prisma.admin_notification.findMany({
            take: excessCount,
            orderBy: { created_at: 'asc' },
            select: { id: true },
          });

        const idsToDelete = oldestNotifications.map((n) => n.id);

        const excessDeleted = await this.prisma.admin_notification.deleteMany({
          where: { id: { in: idsToDelete } },
        });

        this.logger.log(
          `Deleted ${excessDeleted.count} excess notifications (max ${this.MAX_NOTIFICATIONS})`,
        );
      }

      return {
        old_deleted: oldNotifications.count,
        expired_deleted: expiredNotifications.count,
        total_cleaned: oldNotifications.count + expiredNotifications.count,
      };
    } catch (error) {
      this.logger.error(
        `Failed to cleanup notifications: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get paginated notifications list
   */
  async getNotifications(
    options: { page?: number; limit?: number; unread_only?: boolean } = {},
  ) {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (options.unread_only) {
        where.is_read = false;
      }

      const [notifications, total, unreadCount] = await Promise.all([
        this.prisma.admin_notification.findMany({
          where,
          skip,
          take: limit,
          orderBy: [
            { is_read: 'asc' }, // Unread first
            { created_at: 'desc' }, // Newest first within each group
          ],
        }),
        this.prisma.admin_notification.count({ where }),
        this.prisma.admin_notification.count({ where: { is_read: false } }),
      ]);

      return {
        data: notifications,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
        },
        unread_count: unreadCount,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get notifications: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
