import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { randomUUID } from 'crypto';

/**
 * Notification Processor
 *
 * Processes notification rule evaluation and creates in-app notifications.
 *
 * Queue: communication-notifications
 * Job: create-notification
 *
 * Job Data:
 * - event_type: string (e.g., 'lead_created', 'quote_approved')
 * - tenant_id: string
 * - data: object (event-specific data like lead_id, lead_name, etc.)
 * - entity_type: string (e.g., 'lead', 'quote')
 * - entity_id: string
 *
 * Process:
 * 1. Load active notification rules for event_type
 * 2. For each rule, determine recipients based on recipient_type
 * 3. Create in-app notifications for each recipient
 * 4. If rule has notify_email enabled, queue emails
 */
@Processor('communication-notifications')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
    this.logger.log('🚀 NotificationProcessor worker initialized and ready');
  }

  async process(job: Job): Promise<any> {
    const { event_type, tenant_id, data, entity_type, entity_id } = job.data;
    const jobId = job.id as string;

    this.logger.log(
      `🔄 PROCESSING: Notification job ${jobId} for event ${event_type} in tenant ${tenant_id}`,
    );

    try {
      // 1. Load active notification rules for this event type
      const rules = await this.prisma.notification_rule.findMany({
        where: {
          tenant_id,
          event_type,
          is_active: true,
        },
      });

      if (rules.length === 0) {
        this.logger.log(
          `No active notification rules found for event ${event_type}`,
        );
        return { success: true, notifications_created: 0 };
      }

      let totalNotificationsCreated = 0;

      // 2. Process each rule
      for (const rule of rules) {
        const recipients = await this.determineRecipients(
          rule,
          tenant_id,
          entity_type,
          entity_id,
          data,
        );

        if (recipients.length === 0) {
          this.logger.warn(
            `No recipients found for rule ${rule.id} (${rule.recipient_type})`,
          );
          continue;
        }

        // 3. Create in-app notifications
        if (rule.notify_in_app) {
          for (const userId of recipients) {
            await this.prisma.notification.create({
              data: {
                id: randomUUID(),
                tenant_id,
                user_id: userId === 'all' ? null : userId,
                type: event_type,
                title: this.generateTitle(event_type, data),
                message: this.generateMessage(event_type, data),
                action_url: this.generateActionUrl(entity_type, entity_id),
                related_entity_type: entity_type,
                related_entity_id: entity_id,
              },
            });

            totalNotificationsCreated++;
          }
        }

        // 4. Queue email notifications if enabled
        if (rule.notify_email && rule.email_template_key) {
          // TODO: Queue emails via SendEmailService
          // This will be implemented when integrating with existing modules
          this.logger.log(
            `Email notifications queued for template ${rule.email_template_key}`,
          );
        }
      }

      this.logger.log(
        `✅ Notification job ${jobId} completed - Created ${totalNotificationsCreated} notifications`,
      );

      return {
        success: true,
        notifications_created: totalNotificationsCreated,
      };
    } catch (error) {
      this.logger.error(
        `❌ Notification job ${jobId} failed: ${error.message}`,
        error.stack,
      );
      throw error; // BullMQ will retry
    }
  }

  /**
   * Determine recipients based on rule configuration
   */
  private async determineRecipients(
    rule: any,
    tenantId: string,
    entityType: string,
    entityId: string,
    data: any,
  ): Promise<string[]> {
    switch (rule.recipient_type) {
      case 'all_users':
        // Get all active users in tenant
        const allUsers = await this.prisma.user.findMany({
          where: {
            tenant_id: tenantId,
            is_active: true,
          },
          select: { id: true },
        });
        return allUsers.map((u) => u.id);

      case 'owner':
        // Get tenant owner through user_role join
        const ownerRole = await this.prisma.role.findFirst({
          where: {
            name: 'Owner',
            is_active: true,
          },
        });

        if (!ownerRole) {
          return [];
        }

        const owner = await this.prisma.user.findFirst({
          where: {
            tenant_id: tenantId,
            is_active: true,
            user_role_user_role_user_idTouser: {
              some: {
                role_id: ownerRole.id,
                tenant_id: tenantId,
              },
            },
          },
          select: { id: true },
        });

        // Return owner if found
        return owner ? [owner.id] : [];

      case 'assigned_user':
        // Get creator/owner of the entity (since lead doesn't have assigned_to field)
        if (entityType === 'lead' && entityId) {
          const lead = await this.prisma.lead.findUnique({
            where: { id: entityId },
            select: { created_by_user_id: true },
          });
          return lead?.created_by_user_id ? [lead.created_by_user_id] : [];
        }
        return [];

      case 'specific_users':
        // Use specific user IDs from rule
        return (rule.specific_user_ids as string[]) || [];

      default:
        this.logger.warn(`Unknown recipient_type: ${rule.recipient_type}`);
        return [];
    }
  }

  /**
   * Generate notification title based on event type
   */
  private generateTitle(eventType: string, data: any): string {
    switch (eventType) {
      case 'lead_created':
        return 'New Lead Created';
      case 'lead_assigned':
        return 'Lead Assigned to You';
      case 'quote_approved':
        return 'Quote Approved';
      case 'invoice_paid':
        return 'Invoice Paid';
      default:
        return eventType
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase());
    }
  }

  /**
   * Generate notification message based on event type
   */
  private generateMessage(eventType: string, data: any): string {
    switch (eventType) {
      case 'lead_created':
        return `${data.lead_name || 'A new lead'} submitted a service request`;
      case 'lead_assigned':
        return `Lead ${data.lead_name} has been assigned to you`;
      case 'quote_approved':
        return `Quote ${data.quote_number} was approved`;
      case 'invoice_paid':
        return `Invoice ${data.invoice_number} was paid in full`;
      default:
        return JSON.stringify(data);
    }
  }

  /**
   * Generate action URL based on entity type
   */
  private generateActionUrl(entityType: string, entityId: string): string {
    switch (entityType) {
      case 'lead':
        return `/leads/${entityId}`;
      case 'quote':
        return `/quotes/${entityId}`;
      case 'invoice':
        return `/invoices/${entityId}`;
      default:
        return '/';
    }
  }
}
