import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { NotificationsService } from '../../communication/services/notifications.service';

/**
 * InsuranceExpiryCheckProcessor — Sprint 33
 *
 * Scans subcontractor insurance expiry dates for ALL active tenants,
 * recomputes compliance_status, and creates notifications for tenant
 * Owner/Admin users when insurance is expiring or expired.
 *
 * Invoked by the shared 'project-management' BullMQ queue via job-name
 * routing in TaskDelayCheckProcessor.
 *
 * Multi-tenant isolation: each tenant is processed independently.
 * If one tenant fails, processing continues for remaining tenants.
 *
 * Deduplication: one notification per subcontractor per day per tenant.
 */
@Injectable()
export class InsuranceExpiryCheckProcessor {
  private readonly logger = new Logger(InsuranceExpiryCheckProcessor.name);

  /** Number of days before expiry that triggers "expiring_soon" status */
  private readonly EXPIRING_SOON_DAYS = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Entry point — called from TaskDelayCheckProcessor via job-name routing
  // ---------------------------------------------------------------------------

  async execute(): Promise<{
    tenants_processed: number;
    tenants_total: number;
    subcontractors_checked: number;
    compliance_updated: number;
    notifications_sent: number;
    errors?: string[];
  }> {
    const tenants = await this.prisma.tenant.findMany({
      where: { is_active: true, deleted_at: null },
      select: { id: true, company_name: true },
    });

    let tenantsProcessed = 0;
    let totalSubcontractorsChecked = 0;
    let totalComplianceUpdated = 0;
    let totalNotificationsSent = 0;
    const errors: string[] = [];

    for (const tenant of tenants) {
      try {
        const result = await this.processTenant(tenant.id);
        tenantsProcessed++;
        totalSubcontractorsChecked += result.subcontractorsChecked;
        totalComplianceUpdated += result.complianceUpdated;
        totalNotificationsSent += result.notificationsSent;
      } catch (error) {
        this.logger.error(
          `Failed to process tenant ${tenant.id} (${tenant.company_name}): ${error.message}`,
          error.stack,
        );
        errors.push(`Tenant ${tenant.id}: ${error.message}`);
        // Continue to next tenant — never let one tenant block the rest
      }
    }

    return {
      tenants_processed: tenantsProcessed,
      tenants_total: tenants.length,
      subcontractors_checked: totalSubcontractorsChecked,
      compliance_updated: totalComplianceUpdated,
      notifications_sent: totalNotificationsSent,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Per-tenant processing
  // ---------------------------------------------------------------------------

  private async processTenant(tenantId: string): Promise<{
    subcontractorsChecked: number;
    complianceUpdated: number;
    notificationsSent: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiringThreshold = new Date(today);
    expiringThreshold.setDate(
      expiringThreshold.getDate() + this.EXPIRING_SOON_DAYS,
    );

    // -----------------------------------------------------------------------
    // Step 1: Query active subcontractors assigned to in_progress projects
    // via task_assignee → project_task → project
    // -----------------------------------------------------------------------
    const subcontractors = await this.prisma.subcontractor.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        task_assignees: {
          some: {
            tenant_id: tenantId,
            task: {
              deleted_at: null,
              project: {
                tenant_id: tenantId,
                status: 'in_progress',
              },
            },
          },
        },
      },
      select: {
        id: true,
        business_name: true,
        insurance_expiry_date: true,
        compliance_status: true,
      },
    });

    if (subcontractors.length === 0) {
      return { subcontractorsChecked: 0, complianceUpdated: 0, notificationsSent: 0 };
    }

    // -----------------------------------------------------------------------
    // Step 2: Fetch Owner/Admin users once for the entire tenant
    // (optimization: avoids repeated queries per subcontractor)
    // -----------------------------------------------------------------------
    const ownerAdminUsers = await this.getOwnerAdminUsers(tenantId);

    let complianceUpdated = 0;
    let notificationsSent = 0;

    for (const sub of subcontractors) {
      try {
        // -------------------------------------------------------------------
        // Step 3: Compute compliance_status
        // -------------------------------------------------------------------
        const newStatus = this.computeComplianceStatus(
          sub.insurance_expiry_date,
          today,
          expiringThreshold,
        );

        // Update compliance_status if changed (with tenant isolation)
        if (sub.compliance_status !== newStatus) {
          await this.prisma.subcontractor.updateMany({
            where: { id: sub.id, tenant_id: tenantId },
            data: { compliance_status: newStatus },
          });
          complianceUpdated++;
        }

        // -------------------------------------------------------------------
        // Step 4: Create notifications for expired / expiring_soon
        // -------------------------------------------------------------------
        if (newStatus !== 'expired' && newStatus !== 'expiring_soon') {
          continue;
        }

        // Deduplication: skip if notification already exists today for this sub
        const alreadyNotifiedToday =
          await this.hasNotificationToday(tenantId, sub.id, today);
        if (alreadyNotifiedToday) {
          continue;
        }

        // Create notification for each Owner/Admin user
        if (ownerAdminUsers.length === 0) {
          this.logger.warn(
            `No Owner/Admin users found for tenant ${tenantId} — skipping notifications`,
          );
          continue;
        }

        const message =
          newStatus === 'expired'
            ? `Insurance for '${sub.business_name}' has expired.`
            : `Insurance for '${sub.business_name}' expires on ${this.formatDate(sub.insurance_expiry_date)}.`;

        for (const user of ownerAdminUsers) {
          try {
            await this.notificationsService.createNotification({
              tenant_id: tenantId,
              user_id: user.id,
              type: 'subcontractor_compliance',
              title: 'Insurance Expiry Alert',
              message,
              action_url: `/subcontractors/${sub.id}`,
              related_entity_type: 'subcontractor',
              related_entity_id: sub.id,
            });
            notificationsSent++;
          } catch (error) {
            this.logger.warn(
              `Failed to create notification for user ${user.id} re: subcontractor ${sub.id}: ${error.message}`,
            );
            // Notification failure must not stop processing
          }
        }
      } catch (error) {
        this.logger.warn(
          `Failed to process subcontractor ${sub.id} (${sub.business_name}): ${error.message}`,
        );
        // Continue to next subcontractor
      }
    }

    return {
      subcontractorsChecked: subcontractors.length,
      complianceUpdated,
      notificationsSent,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Compute compliance status from insurance_expiry_date.
   *
   * - expired:       insurance_expiry_date < today
   * - expiring_soon: insurance_expiry_date within 30 days
   * - valid:         insurance_expiry_date > 30 days from now
   * - unknown:       no insurance_expiry_date set
   */
  computeComplianceStatus(
    insuranceExpiryDate: Date | null,
    today: Date,
    expiringThreshold: Date,
  ): 'valid' | 'expiring_soon' | 'expired' | 'unknown' {
    if (!insuranceExpiryDate) {
      return 'unknown';
    }

    const expiry = new Date(insuranceExpiryDate);
    expiry.setHours(0, 0, 0, 0);

    if (expiry < today) {
      return 'expired';
    }

    if (expiry <= expiringThreshold) {
      return 'expiring_soon';
    }

    return 'valid';
  }

  /**
   * Check if a notification with type='subcontractor_compliance' and
   * related_entity_id=subcontractorId was already created TODAY for this tenant.
   */
  private async hasNotificationToday(
    tenantId: string,
    subcontractorId: string,
    todayMidnight: Date,
  ): Promise<boolean> {
    const existing = await this.prisma.notification.findFirst({
      where: {
        tenant_id: tenantId,
        type: 'subcontractor_compliance',
        related_entity_id: subcontractorId,
        created_at: { gte: todayMidnight },
      },
      select: { id: true },
    });

    return !!existing;
  }

  /**
   * Get Owner and Admin users for a given tenant.
   *
   * Uses user_tenant_membership (ACTIVE status) + user_role to find users
   * with Owner or Admin role in this tenant.
   */
  private async getOwnerAdminUsers(
    tenantId: string,
  ): Promise<{ id: string }[]> {
    const users = await this.prisma.user.findMany({
      where: {
        is_active: true,
        deleted_at: null,
        memberships: {
          some: { tenant_id: tenantId, status: 'ACTIVE' },
        },
        user_role_user_role_user_idTouser: {
          some: {
            tenant_id: tenantId,
            role: { name: { in: ['Owner', 'Admin'] } },
          },
        },
      },
      select: { id: true },
    });

    return users;
  }

  /**
   * Format a date for human-readable notification messages.
   */
  private formatDate(date: Date | null): string {
    if (!date) return 'unknown date';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }
}
