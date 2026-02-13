import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { AuditLoggerService } from '../../../audit/services/audit-logger.service';

/**
 * CommunicationEventManagementService
 *
 * Manages individual communication events for admin troubleshooting and corrections.
 *
 * Responsibilities:
 * - Resend failed individual messages (SMS, email, WhatsApp)
 * - Update message status (fix stuck messages)
 * - Delete erroneous/duplicate events
 *
 * Architecture:
 * - Complements BulkOperationsService (which handles batch operations)
 * - Single event operations for precise admin control
 * - Complete audit trail of all admin interventions
 *
 * Security:
 * - All operations require SystemAdmin role (enforced at controller level)
 * - Admin user ID is recorded for audit purposes
 * - Safety checks prevent accidental data loss
 *
 * @class CommunicationEventManagementService
 * @since Sprint 11
 */
@Injectable()
export class CommunicationEventManagementService {
  private readonly logger = new Logger(
    CommunicationEventManagementService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Resend failed communication event
   *
   * Manually retry a single failed message. Useful for:
   * - Individual customer escalations
   * - Testing fixes after provider outage
   * - Recovering specific important messages
   *
   * @param eventId - Communication event ID
   * @param adminUserId - Admin user performing the action
   * @returns Promise<ResendResult>
   */
  async resendCommunicationEvent(
    eventId: string,
    adminUserId: string,
  ): Promise<ResendResult> {
    this.logger.log(
      `Admin ${adminUserId} resending communication event ${eventId}`,
    );

    try {
      // Fetch event
      const event = await this.prisma.communication_event.findUnique({
        where: { id: eventId },
        include: {
          tenant: {
            select: {
              id: true,
              company_name: true,
            },
          },
        },
      });

      if (!event) {
        throw new NotFoundException(`Communication event ${eventId} not found`);
      }

      // Verify event is in a failed state
      if (event.status !== 'failed' && event.status !== 'bounced') {
        throw new BadRequestException(
          `Cannot resend event with status '${event.status}'. Only failed or bounced events can be resent.`,
        );
      }

      // Reset event to pending for retry
      const updated = await this.prisma.communication_event.update({
        where: { id: eventId },
        data: {
          status: 'pending',
          error_message: null,
          sent_at: null,
          delivered_at: null,
        },
      });

      // Audit log
      await this.auditLogger.log({
        tenant_id: event.tenant_id || undefined,
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'communication_event',
        entity_id: eventId,
        action_type: 'resend',
        description: `Admin manually resent ${event.channel} message to ${event.to_email || event.to_phone}`,
        before_json: {
          status: event.status,
          error_message: event.error_message,
        },
        after_json: {
          status: 'pending',
        },
        status: 'success',
      });

      this.logger.log(
        `Communication event ${eventId} queued for resend successfully`,
      );

      return {
        success: true,
        event_id: eventId,
        channel: event.channel,
        status: 'pending',
        tenant_name: event.tenant?.company_name || 'System',
        resent_by: adminUserId,
        message: `${event.channel.toUpperCase()} message queued for resend`,
      };
    } catch (error) {
      this.logger.error('Failed to resend communication event:', error.message);
      this.logger.error('Error stack:', error.stack);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to resend communication event');
    }
  }

  /**
   * Update communication event status
   *
   * Manually correct stuck or erroneous message statuses. Use cases:
   * - Mark message as delivered when webhook was missed
   * - Fix status discrepancies
   * - Correct erroneous bounces
   *
   * @param eventId - Communication event ID
   * @param newStatus - New status to set
   * @param reason - Reason for manual status change
   * @param adminUserId - Admin user performing the action
   * @returns Promise<StatusUpdateResult>
   */
  async updateCommunicationEventStatus(
    eventId: string,
    newStatus: string,
    reason: string,
    adminUserId: string,
  ): Promise<StatusUpdateResult> {
    this.logger.log(
      `Admin ${adminUserId} updating status of event ${eventId} to ${newStatus}`,
    );

    try {
      // Fetch event
      const event = await this.prisma.communication_event.findUnique({
        where: { id: eventId },
        include: {
          tenant: {
            select: {
              id: true,
              company_name: true,
            },
          },
        },
      });

      if (!event) {
        throw new NotFoundException(`Communication event ${eventId} not found`);
      }

      const oldStatus = event.status;

      // Validate new status
      const validStatuses = [
        'pending',
        'sent',
        'delivered',
        'failed',
        'bounced',
        'opened',
        'clicked',
      ];

      if (!validStatuses.includes(newStatus)) {
        throw new BadRequestException(
          `Invalid status '${newStatus}'. Must be one of: ${validStatuses.join(', ')}`,
        );
      }

      // Prepare update data
      const updateData: any = {
        status: newStatus as any,
      };

      // Set timestamps based on status
      if (newStatus === 'sent' && !event.sent_at) {
        updateData.sent_at = new Date();
      }
      if (newStatus === 'delivered' && !event.delivered_at) {
        updateData.delivered_at = new Date();
      }
      if (newStatus === 'bounced' && !event.bounced_at) {
        updateData.bounced_at = new Date();
        updateData.bounce_type = 'admin_marked';
      }

      // Update event
      const updated = await this.prisma.communication_event.update({
        where: { id: eventId },
        data: updateData,
      });

      // Audit log
      await this.auditLogger.log({
        tenant_id: event.tenant_id || undefined,
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'communication_event',
        entity_id: eventId,
        action_type: 'status_update',
        description: `Admin manually changed ${event.channel} message status from ${oldStatus} to ${newStatus}. Reason: ${reason}`,
        before_json: {
          status: oldStatus,
        },
        after_json: {
          status: newStatus,
          reason,
        },
        status: 'success',
      });

      this.logger.log(
        `Communication event ${eventId} status updated to ${newStatus}`,
      );

      return {
        success: true,
        event_id: eventId,
        channel: event.channel,
        old_status: oldStatus,
        new_status: newStatus as any,
        tenant_name: event.tenant?.company_name || 'System',
        updated_by: adminUserId,
        reason,
        message: `Status updated from ${oldStatus} to ${newStatus}`,
      };
    } catch (error) {
      this.logger.error('Failed to update event status:', error.message);
      this.logger.error('Error stack:', error.stack);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to update event status');
    }
  }

  /**
   * Delete communication event
   *
   * Permanently delete erroneous or duplicate communication events. Use cases:
   * - Remove test messages sent to production
   * - Clean up duplicates from bugs
   * - Remove erroneous events
   *
   * Safety checks:
   * - Cannot delete successfully delivered messages without force flag
   * - Requires confirmation for recent messages
   * - Complete audit trail
   *
   * @param eventId - Communication event ID
   * @param reason - Reason for deletion (required)
   * @param adminUserId - Admin user performing the action
   * @param force - Force delete even if delivered (default: false)
   * @returns Promise<DeletionResult>
   */
  async deleteCommunicationEvent(
    eventId: string,
    reason: string,
    adminUserId: string,
    force: boolean = false,
  ): Promise<DeletionResult> {
    this.logger.log(
      `Admin ${adminUserId} deleting communication event ${eventId}`,
    );

    try {
      // Fetch event
      const event = await this.prisma.communication_event.findUnique({
        where: { id: eventId },
        include: {
          tenant: {
            select: {
              id: true,
              company_name: true,
            },
          },
        },
      });

      if (!event) {
        throw new NotFoundException(`Communication event ${eventId} not found`);
      }

      // Safety check: prevent deletion of successfully delivered messages
      if (
        (event.status === 'delivered' || event.status === 'opened') &&
        !force
      ) {
        throw new ForbiddenException(
          `Cannot delete delivered message without force flag. Use force=true to override this safety check.`,
        );
      }

      // Safety check: warn about recent messages
      const eventAge = Date.now() - new Date(event.created_at).getTime();
      const ONE_HOUR = 60 * 60 * 1000;

      if (eventAge < ONE_HOUR && !force) {
        throw new ForbiddenException(
          `Cannot delete message created less than 1 hour ago without force flag. Event age: ${Math.round(eventAge / 60000)} minutes.`,
        );
      }

      // Audit log BEFORE deletion
      await this.auditLogger.log({
        tenant_id: event.tenant_id || undefined,
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'communication_event',
        entity_id: eventId,
        action_type: 'deleted',
        description: `Admin deleted ${event.channel} message. Reason: ${reason}`,
        before_json: {
          id: event.id,
          channel: event.channel,
          status: event.status,
          to_email: event.to_email,
          to_phone: event.to_phone,
          subject: event.subject,
          created_at: event.created_at,
        },
        status: 'success',
      });

      // Delete event
      await this.prisma.communication_event.delete({
        where: { id: eventId },
      });

      this.logger.log(`Communication event ${eventId} deleted successfully`);

      return {
        success: true,
        event_id: eventId,
        channel: event.channel,
        status: event.status,
        tenant_name: event.tenant?.company_name || 'System',
        deleted_by: adminUserId,
        reason,
        message: `${event.channel.toUpperCase()} message deleted permanently`,
      };
    } catch (error) {
      this.logger.error('Failed to delete communication event:', error.message);
      this.logger.error('Error stack:', error.stack);

      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to delete communication event');
    }
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ResendResult {
  success: boolean;
  event_id: string;
  channel: string;
  status: string;
  tenant_name: string;
  resent_by: string;
  message: string;
}

export interface StatusUpdateResult {
  success: boolean;
  event_id: string;
  channel: string;
  old_status: string;
  new_status: string;
  tenant_name: string;
  updated_by: string;
  reason: string;
  message: string;
}

export interface DeletionResult {
  success: boolean;
  event_id: string;
  channel: string;
  status: string;
  tenant_name: string;
  deleted_by: string;
  reason: string;
  message: string;
}
