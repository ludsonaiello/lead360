import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { randomUUID } from 'crypto';
import { ListNotificationsDto } from '../dto/notification.dto';

/**
 * Notifications Service
 *
 * Manages in-app notifications for users.
 * Supports both user-specific and tenant-wide broadcast notifications.
 *
 * Features:
 * - User-specific notification queries
 * - Tenant-wide broadcasts (user_id = NULL)
 * - Unread count tracking
 * - Mark as read (single and bulk)
 * - Notification deletion
 * - Auto-expiration support
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all notifications for a user (includes tenant-wide broadcasts)
   */
  async findAllForUser(
    tenantId: string | null,
    userId: string,
    dto: ListNotificationsDto,
  ) {
    // Platform admins (tenantId = null) should have no notifications
    // Notifications are tenant-specific only
    if (!tenantId) {
      return {
        notifications: [],
        total: 0,
      };
    }

    const limit = Math.min(dto.limit || 50, 100);

    // Build where clause
    const where: any = {
      tenant_id: tenantId,
      OR: [
        { user_id: userId }, // User-specific notifications
        { user_id: null }, // Tenant-wide broadcasts
      ],
      AND: [
        {
          OR: [
            { expires_at: null },
            { expires_at: { gte: new Date() } },
          ],
        },
      ],
    };

    if (dto.is_read !== undefined) {
      where.is_read = dto.is_read;
    }

    if (dto.type) {
      where.type = dto.type;
    }

    // Query notifications
    const notifications = await this.prisma.notification.findMany({
      where,
      orderBy: [
        { is_read: 'asc' }, // Unread first
        { created_at: 'desc' }, // Newest first
      ],
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        action_url: true,
        related_entity_type: true,
        related_entity_id: true,
        is_read: true,
        read_at: true,
        expires_at: true,
        created_at: true,
      },
    });

    return {
      notifications,
      total: notifications.length,
    };
  }

  /**
   * Get unread notification count for user
   */
  async getUnreadCount(tenantId: string | null, userId: string) {
    // Platform admins (tenantId = null) should have 0 notifications
    // Notifications are tenant-specific only
    if (!tenantId) {
      return { count: 0 };
    }

    const count = await this.prisma.notification.count({
      where: {
        tenant_id: tenantId,
        OR: [
          { user_id: userId },
          { user_id: null }, // Include broadcasts
        ],
        is_read: false,
        AND: [
          {
            OR: [
              { expires_at: null },
              { expires_at: { gte: new Date() } },
            ],
          },
        ],
      },
    });

    return { unread_count: count };
  }

  /**
   * Mark single notification as read
   */
  async markAsRead(tenantId: string, userId: string, id: string) {
    // Find notification
    const notification = await this.prisma.notification.findFirst({
      where: {
        id,
        tenant_id: tenantId,
        OR: [
          { user_id: userId },
          { user_id: null }, // Broadcasts
        ],
      },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification '${id}' not found for this user`,
      );
    }

    if (notification.is_read) {
      return notification; // Already read
    }

    // Mark as read
    const updated = await this.prisma.notification.update({
      where: { id },
      data: {
        is_read: true,
        read_at: new Date(),
      },
    });

    this.logger.debug(
      `Notification ${id} marked as read by user ${userId}`,
    );

    return updated;
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(tenantId: string, userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        tenant_id: tenantId,
        OR: [
          { user_id: userId },
          { user_id: null }, // Include broadcasts
        ],
        is_read: false,
      },
      data: {
        is_read: true,
        read_at: new Date(),
      },
    });

    this.logger.log(
      `Marked ${result.count} notifications as read for user ${userId} in tenant ${tenantId}`,
    );

    return {
      message: 'All notifications marked as read',
      count: result.count,
    };
  }

  /**
   * Delete notification
   */
  async delete(tenantId: string, userId: string, id: string) {
    // Find notification
    const notification = await this.prisma.notification.findFirst({
      where: {
        id,
        tenant_id: tenantId,
        OR: [
          { user_id: userId },
          { user_id: null }, // Broadcasts can be dismissed
        ],
      },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification '${id}' not found for this user`,
      );
    }

    // Delete notification
    await this.prisma.notification.delete({
      where: { id },
    });

    this.logger.debug(
      `Notification ${id} deleted by user ${userId}`,
    );

    return { message: 'Notification deleted successfully' };
  }

  /**
   * Create notification (used internally by notification rules processor)
   */
  async createNotification(data: {
    tenant_id: string;
    user_id?: string | null;
    type: string;
    title: string;
    message: string;
    action_url?: string;
    related_entity_type?: string;
    related_entity_id?: string;
    expires_at?: Date;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        id: randomUUID(),
        tenant_id: data.tenant_id,
        user_id: data.user_id || null,
        type: data.type,
        title: data.title,
        message: data.message,
        action_url: data.action_url,
        related_entity_type: data.related_entity_type,
        related_entity_id: data.related_entity_id,
        is_read: false,
        expires_at: data.expires_at,
      },
    });

    this.logger.debug(
      `Notification created: ${notification.id} for ${data.user_id ? `user ${data.user_id}` : 'tenant-wide broadcast'}`,
    );

    return notification;
  }
}
