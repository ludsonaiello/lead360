import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { AuditLoggerService } from '../../../audit/services/audit-logger.service';

/**
 * AlertManagementService
 *
 * Manages admin alert acknowledgement and resolution workflow.
 *
 * Responsibilities:
 * - Acknowledge alerts with admin comments
 * - Resolve alerts with resolution notes
 * - Bulk acknowledge multiple alerts
 * - Track alert history and workflow changes
 *
 * Audit Logging:
 * - All alert acknowledgements are audit logged
 * - All alert resolutions are audit logged
 * - Bulk operations are logged as a single action
 *
 * Security:
 * - All operations require SystemAdmin role (enforced at controller level)
 * - Admin user ID is recorded for all actions
 * - Complete audit trail maintained
 *
 * @class AlertManagementService
 * @since Sprint 11
 */
@Injectable()
export class AlertManagementService {
  private readonly logger = new Logger(AlertManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Acknowledge alert with admin comment
   *
   * Marks an alert as acknowledged by an admin, optionally with a comment.
   * Updates the acknowledged_by, acknowledged_at, and comment fields.
   *
   * @param id - Alert ID
   * @param comment - Admin comment (optional)
   * @param adminUserId - ID of admin acknowledging the alert
   * @returns Promise<AcknowledgedAlert>
   */
  async acknowledgeAlert(
    id: string,
    comment: string | undefined,
    adminUserId: string,
  ): Promise<AcknowledgedAlert> {
    this.logger.log(`Acknowledging alert ${id} by admin ${adminUserId}`);

    try {
      // Find the alert
      const alert = await this.prisma.admin_alert.findUnique({
        where: { id },
      });

      if (!alert) {
        throw new NotFoundException(`Alert ${id} not found`);
      }

      // Check if already acknowledged
      if (alert.acknowledged) {
        this.logger.warn(`Alert ${id} is already acknowledged`);
        // Allow re-acknowledgement to update comment
      }

      // Store before state for audit log
      const beforeState = {
        acknowledged: alert.acknowledged,
        acknowledged_by: alert.acknowledged_by,
        acknowledged_at: alert.acknowledged_at,
        comment: alert.comment,
      };

      // Update alert
      const updated = await this.prisma.admin_alert.update({
        where: { id },
        data: {
          acknowledged: true,
          acknowledged_by: adminUserId,
          acknowledged_at: new Date(),
          comment: comment || alert.comment, // Keep existing comment if none provided
        },
        include: {
          acknowledged_by_user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      });

      // Audit log
      await this.auditLogger.log({
        tenant_id: undefined, // Platform-level alert
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'admin_alert',
        entity_id: id,
        action_type: 'updated',
        description: `Alert acknowledged: ${alert.message}`,
        before_json: beforeState,
        after_json: {
          acknowledged: true,
          acknowledged_by: adminUserId,
          acknowledged_at: updated.acknowledged_at,
          comment: updated.comment,
        },
        status: 'success',
      });

      this.logger.log(`Alert ${id} acknowledged successfully`);

      return {
        id: updated.id,
        type: updated.type,
        severity: updated.severity,
        message: updated.message,
        details: updated.details,
        acknowledged: updated.acknowledged,
        acknowledged_by: updated.acknowledged_by_user
          ? {
              id: updated.acknowledged_by_user.id,
              name: `${updated.acknowledged_by_user.first_name} ${updated.acknowledged_by_user.last_name}`,
              email: updated.acknowledged_by_user.email,
            }
          : null,
        acknowledged_at: updated.acknowledged_at,
        comment: updated.comment,
        created_at: updated.created_at,
      };
    } catch (error) {
      this.logger.error('Failed to acknowledge alert:', error.message);
      this.logger.error('Error stack:', error.stack);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException('Failed to acknowledge alert');
    }
  }

  /**
   * Resolve alert with resolution notes
   *
   * Marks an alert as resolved with admin resolution notes.
   * Automatically acknowledges the alert if not already acknowledged.
   *
   * @param id - Alert ID
   * @param resolution - Resolution notes
   * @param adminUserId - ID of admin resolving the alert
   * @returns Promise<ResolvedAlert>
   */
  async resolveAlert(
    id: string,
    resolution: string,
    adminUserId: string,
  ): Promise<ResolvedAlert> {
    this.logger.log(`Resolving alert ${id} by admin ${adminUserId}`);

    try {
      // Find the alert
      const alert = await this.prisma.admin_alert.findUnique({
        where: { id },
      });

      if (!alert) {
        throw new NotFoundException(`Alert ${id} not found`);
      }

      // Check if already resolved
      if (alert.resolved) {
        throw new BadRequestException(
          `Alert ${id} is already resolved. Cannot resolve again.`,
        );
      }

      // Store before state for audit log
      const beforeState = {
        acknowledged: alert.acknowledged,
        resolved: alert.resolved,
        resolved_by: alert.resolved_by,
        resolved_at: alert.resolved_at,
        resolution: alert.resolution,
      };

      // Update alert (auto-acknowledge if not acknowledged)
      const updated = await this.prisma.admin_alert.update({
        where: { id },
        data: {
          acknowledged: true, // Auto-acknowledge on resolution
          acknowledged_by: alert.acknowledged_by || adminUserId,
          acknowledged_at: alert.acknowledged_at || new Date(),
          resolved: true,
          resolved_by: adminUserId,
          resolved_at: new Date(),
          resolution,
        },
        include: {
          acknowledged_by_user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          resolved_by_user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      });

      // Audit log
      await this.auditLogger.log({
        tenant_id: undefined, // Platform-level alert
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'admin_alert',
        entity_id: id,
        action_type: 'updated',
        description: `Alert resolved: ${alert.message}`,
        before_json: beforeState,
        after_json: {
          acknowledged: true,
          resolved: true,
          resolved_by: adminUserId,
          resolved_at: updated.resolved_at,
          resolution,
        },
        status: 'success',
      });

      this.logger.log(`Alert ${id} resolved successfully`);

      return {
        id: updated.id,
        type: updated.type,
        severity: updated.severity,
        message: updated.message,
        details: updated.details,
        acknowledged: updated.acknowledged,
        acknowledged_by: updated.acknowledged_by_user
          ? {
              id: updated.acknowledged_by_user.id,
              name: `${updated.acknowledged_by_user.first_name} ${updated.acknowledged_by_user.last_name}`,
              email: updated.acknowledged_by_user.email,
            }
          : null,
        acknowledged_at: updated.acknowledged_at,
        resolved: updated.resolved,
        resolved_by: updated.resolved_by_user
          ? {
              id: updated.resolved_by_user.id,
              name: `${updated.resolved_by_user.first_name} ${updated.resolved_by_user.last_name}`,
              email: updated.resolved_by_user.email,
            }
          : null,
        resolved_at: updated.resolved_at,
        resolution: updated.resolution,
        created_at: updated.created_at,
      };
    } catch (error) {
      this.logger.error('Failed to resolve alert:', error.message);
      this.logger.error('Error stack:', error.stack);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to resolve alert');
    }
  }

  /**
   * Bulk acknowledge multiple alerts
   *
   * Acknowledges multiple alerts at once with the same comment.
   * Useful for acknowledging related alerts from the same incident.
   *
   * @param alertIds - Array of alert IDs to acknowledge
   * @param comment - Comment to apply to all alerts
   * @param adminUserId - ID of admin acknowledging alerts
   * @returns Promise<BulkAcknowledgeResult>
   */
  async bulkAcknowledgeAlerts(
    alertIds: string[],
    comment: string | undefined,
    adminUserId: string,
  ): Promise<BulkAcknowledgeResult> {
    this.logger.log(
      `Bulk acknowledging ${alertIds.length} alerts by admin ${adminUserId}`,
    );

    try {
      if (!alertIds || alertIds.length === 0) {
        throw new BadRequestException('At least one alert ID must be provided');
      }

      // Find which alerts exist (Best-Effort approach)
      const alerts = await this.prisma.admin_alert.findMany({
        where: { id: { in: alertIds } },
      });

      const foundIds = alerts.map((a) => a.id);
      const missingIds = alertIds.filter((id) => !foundIds.includes(id));

      // Log missing alerts for transparency
      if (missingIds.length > 0) {
        this.logger.warn(
          `${missingIds.length} alert(s) not found and will be skipped: ${missingIds.join(', ')}`,
        );
      }

      // If no valid alerts found, return early
      if (foundIds.length === 0) {
        this.logger.warn('No valid alerts found to acknowledge');
        return {
          success: false,
          acknowledged_count: 0,
          acknowledged_ids: [],
          not_found_ids: missingIds,
          total_requested: alertIds.length,
          message: 'No valid alerts found - all IDs were invalid',
        };
      }

      // Update only the alerts that exist
      const result = await this.prisma.admin_alert.updateMany({
        where: { id: { in: foundIds } },
        data: {
          acknowledged: true,
          acknowledged_by: adminUserId,
          acknowledged_at: new Date(),
          comment: comment || undefined,
        },
      });

      // Audit log bulk operation (including partial success info)
      await this.auditLogger.log({
        tenant_id: undefined, // Platform-level
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'admin_alert',
        entity_id: 'bulk_operation',
        action_type: 'updated',
        description: `Bulk acknowledged ${result.count} alerts${missingIds.length > 0 ? ` (${missingIds.length} not found)` : ''}`,
        after_json: {
          acknowledged_ids: foundIds,
          not_found_ids: missingIds,
          acknowledged: true,
          comment,
        },
        status: 'success',
      });

      const message =
        missingIds.length > 0
          ? `Successfully acknowledged ${result.count} alert(s). ${missingIds.length} alert(s) not found.`
          : `Successfully acknowledged ${result.count} alert(s)`;

      this.logger.log(
        `Bulk acknowledge completed: ${result.count}/${alertIds.length} alerts updated`,
      );

      return {
        success: true,
        acknowledged_count: result.count,
        acknowledged_ids: foundIds,
        not_found_ids: missingIds,
        total_requested: alertIds.length,
        message,
      };
    } catch (error) {
      this.logger.error('Failed to bulk acknowledge alerts:', error.message);
      this.logger.error('Error stack:', error.stack);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Failed to bulk acknowledge alerts');
    }
  }

  /**
   * Get alert history
   *
   * Returns the acknowledgement and resolution history for a specific alert.
   * Includes information about who acknowledged/resolved and when.
   *
   * @param alertId - Alert ID
   * @returns Promise<AlertHistory>
   */
  async getAlertHistory(alertId: string): Promise<AlertHistory> {
    this.logger.log(`Fetching history for alert ${alertId}`);

    try {
      const alert = await this.prisma.admin_alert.findUnique({
        where: { id: alertId },
        include: {
          acknowledged_by_user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
          resolved_by_user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      });

      if (!alert) {
        throw new NotFoundException(`Alert ${alertId} not found`);
      }

      // Build history timeline
      const history: any[] = [
        {
          action: 'created',
          timestamp: alert.created_at,
          performed_by: 'system',
        },
      ];

      if (alert.acknowledged) {
        history.push({
          action: 'acknowledged',
          timestamp: alert.acknowledged_at,
          performed_by: alert.acknowledged_by_user
            ? {
                id: alert.acknowledged_by_user.id,
                name: `${alert.acknowledged_by_user.first_name} ${alert.acknowledged_by_user.last_name}`,
                email: alert.acknowledged_by_user.email,
              }
            : 'unknown',
          comment: alert.comment,
        });
      }

      if (alert.resolved) {
        history.push({
          action: 'resolved',
          timestamp: alert.resolved_at,
          performed_by: alert.resolved_by_user
            ? {
                id: alert.resolved_by_user.id,
                name: `${alert.resolved_by_user.first_name} ${alert.resolved_by_user.last_name}`,
                email: alert.resolved_by_user.email,
              }
            : 'unknown',
          resolution: alert.resolution,
        });
      }

      return {
        alert_id: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        current_status: alert.resolved
          ? 'resolved'
          : alert.acknowledged
            ? 'acknowledged'
            : 'open',
        history,
      };
    } catch (error) {
      this.logger.error('Failed to fetch alert history:', error.message);
      this.logger.error('Error stack:', error.stack);

      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new BadRequestException('Failed to retrieve alert history');
    }
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AcknowledgedAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  details: any;
  acknowledged: boolean;
  acknowledged_by: {
    id: string;
    name: string;
    email: string;
  } | null;
  acknowledged_at: Date | null;
  comment: string | null;
  created_at: Date;
}

export interface ResolvedAlert {
  id: string;
  type: string;
  severity: string;
  message: string;
  details: any;
  acknowledged: boolean;
  acknowledged_by: {
    id: string;
    name: string;
    email: string;
  } | null;
  acknowledged_at: Date | null;
  resolved: boolean;
  resolved_by: {
    id: string;
    name: string;
    email: string;
  } | null;
  resolved_at: Date | null;
  resolution: string | null;
  created_at: Date;
}

export interface BulkAcknowledgeResult {
  success: boolean;
  acknowledged_count: number;
  acknowledged_ids: string[];
  not_found_ids: string[];
  total_requested: number;
  message: string;
}

export interface AlertHistory {
  alert_id: string;
  type: string;
  severity: string;
  message: string;
  current_status: 'open' | 'acknowledged' | 'resolved';
  history: any[];
}
