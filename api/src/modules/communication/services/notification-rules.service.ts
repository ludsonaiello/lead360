import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { randomUUID } from 'crypto';
import {
  CreateNotificationRuleDto,
  UpdateNotificationRuleDto,
} from '../dto/notification.dto';

/**
 * Notification Rules Service
 *
 * Manages notification rules that define when and how users are notified.
 * Rules trigger on specific events (lead_created, quote_sent, etc.).
 *
 * Features:
 * - Event-based notification triggers
 * - In-app and email notification channels
 * - Flexible recipient targeting (owner, assigned user, specific users, all users)
 * - Email template integration
 * - Active/inactive rule toggling
 */
@Injectable()
export class NotificationRulesService {
  private readonly logger = new Logger(NotificationRulesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all notification rules for tenant
   */
  async findAll(tenantId: string) {
    const rules = await this.prisma.notification_rule.findMany({
      where: { tenant_id: tenantId },
      orderBy: [{ event_type: 'asc' }, { created_at: 'desc' }],
    });

    return {
      rules,
      total: rules.length,
    };
  }

  /**
   * Get single notification rule
   */
  async findOne(tenantId: string, id: string) {
    const rule = await this.prisma.notification_rule.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
    });

    if (!rule) {
      throw new NotFoundException(
        `Notification rule '${id}' not found for this tenant`,
      );
    }

    return rule;
  }

  /**
   * Create notification rule
   */
  async create(
    tenantId: string,
    dto: CreateNotificationRuleDto,
    userId: string,
  ) {
    // Validate: if notify_email is true, email_template_key is required
    if (dto.notify_email && !dto.email_template_key) {
      throw new BadRequestException(
        'email_template_key is required when notify_email is true',
      );
    }

    // Validate: if email_template_key is provided, verify it exists
    if (dto.email_template_key) {
      const template = await this.prisma.email_template.findFirst({
        where: {
          template_key: dto.email_template_key,
          OR: [{ tenant_id: tenantId }, { is_system: true }],
          is_active: true,
        },
      });

      if (!template) {
        throw new BadRequestException(
          `Email template '${dto.email_template_key}' not found or inactive`,
        );
      }
    }

    // Validate: if recipient_type is specific_users, specific_user_ids is required
    if (dto.recipient_type === 'specific_users') {
      if (!dto.specific_user_ids || dto.specific_user_ids.length === 0) {
        throw new BadRequestException(
          'specific_user_ids is required when recipient_type is specific_users',
        );
      }

      // Verify all users exist in tenant
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: dto.specific_user_ids },
          memberships: { some: { tenant_id: tenantId, status: 'ACTIVE' } },
        },
      });

      if (users.length !== dto.specific_user_ids.length) {
        throw new BadRequestException(
          'One or more specified users do not exist in this tenant',
        );
      }
    }

    // Create rule
    const rule = await this.prisma.notification_rule.create({
      data: {
        id: randomUUID(),
        tenant_id: tenantId,
        event_type: dto.event_type,
        notify_in_app: dto.notify_in_app,
        notify_email: dto.notify_email,
        email_template_key: dto.email_template_key,
        recipient_type: dto.recipient_type,
        specific_user_ids: dto.specific_user_ids ?? undefined,
        is_active: dto.is_active,
      },
    });

    this.logger.log(
      `Notification rule created: ${rule.id} for event '${dto.event_type}' by user ${userId}`,
    );

    return rule;
  }

  /**
   * Update notification rule
   */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateNotificationRuleDto,
    userId: string,
  ) {
    // Find rule
    const rule = await this.prisma.notification_rule.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
    });

    if (!rule) {
      throw new NotFoundException(
        `Notification rule '${id}' not found for this tenant`,
      );
    }

    // Validate: if notify_email is being set to true, email_template_key must be provided
    const notifyEmail =
      dto.notify_email !== undefined ? dto.notify_email : rule.notify_email;
    const emailTemplateKey =
      dto.email_template_key !== undefined
        ? dto.email_template_key
        : rule.email_template_key;

    if (notifyEmail && !emailTemplateKey) {
      throw new BadRequestException(
        'email_template_key is required when notify_email is true',
      );
    }

    // Validate: if email_template_key is being updated, verify it exists
    if (dto.email_template_key) {
      const template = await this.prisma.email_template.findFirst({
        where: {
          template_key: dto.email_template_key,
          OR: [{ tenant_id: tenantId }, { is_system: true }],
          is_active: true,
        },
      });

      if (!template) {
        throw new BadRequestException(
          `Email template '${dto.email_template_key}' not found or inactive`,
        );
      }
    }

    // Validate: if recipient_type is being changed to specific_users, specific_user_ids must be provided
    const recipientType =
      dto.recipient_type !== undefined
        ? dto.recipient_type
        : rule.recipient_type;
    const specificUserIds =
      dto.specific_user_ids !== undefined
        ? dto.specific_user_ids
        : (rule.specific_user_ids as string[] | null);

    if (recipientType === 'specific_users') {
      if (!specificUserIds || specificUserIds.length === 0) {
        throw new BadRequestException(
          'specific_user_ids is required when recipient_type is specific_users',
        );
      }

      // Verify all users exist in tenant
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: specificUserIds },
          memberships: { some: { tenant_id: tenantId, status: 'ACTIVE' } },
        },
      });

      if (users.length !== specificUserIds.length) {
        throw new BadRequestException(
          'One or more specified users do not exist in this tenant',
        );
      }
    }

    // Update rule
    const updated = await this.prisma.notification_rule.update({
      where: { id },
      data: {
        notify_in_app: dto.notify_in_app,
        notify_email: dto.notify_email,
        email_template_key: dto.email_template_key,
        recipient_type: dto.recipient_type,
        specific_user_ids: dto.specific_user_ids,
        is_active: dto.is_active,
      },
    });

    this.logger.log(`Notification rule updated: ${id} by user ${userId}`);

    return updated;
  }

  /**
   * Delete notification rule
   */
  async delete(tenantId: string, id: string, userId: string) {
    // Find rule
    const rule = await this.prisma.notification_rule.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
    });

    if (!rule) {
      throw new NotFoundException(
        `Notification rule '${id}' not found for this tenant`,
      );
    }

    // Delete rule
    await this.prisma.notification_rule.delete({
      where: { id },
    });

    this.logger.log(
      `Notification rule deleted: ${id} (event: ${rule.event_type}) by user ${userId}`,
    );

    return { message: 'Notification rule deleted successfully' };
  }

  /**
   * Get active rules for specific event (used by notification processor)
   */
  async getActiveRulesForEvent(tenantId: string, eventType: string) {
    const rules = await this.prisma.notification_rule.findMany({
      where: {
        tenant_id: tenantId,
        event_type: eventType,
        is_active: true,
      },
    });

    return rules;
  }
}
