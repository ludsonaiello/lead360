import { randomBytes } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenantLicenseService } from '../services/tenant-license.service';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * License Expiry Check Job
 *
 * Runs daily at 9 AM (tenant timezone) to check for expiring licenses
 * and send email alerts at 30, 15, 7, and 1 days before expiry.
 *
 * This is a CRITICAL job for compliance and risk management.
 */
@Injectable()
export class LicenseExpiryCheckJob {
  private readonly logger = new Logger(LicenseExpiryCheckJob.name);

  // Days before expiry to send alerts
  private readonly ALERT_DAYS = [30, 15, 7, 1];

  constructor(
    private readonly licenseService: TenantLicenseService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Run daily at 9 AM server time
   * TODO: Adjust to tenant timezone once timezone field is added to Tenant model
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleLicenseExpiryCheck() {
    this.logger.log('Starting license expiry check job...');

    try {
      for (const days of this.ALERT_DAYS) {
        await this.checkAndAlertForDays(days);
      }

      this.logger.log('License expiry check job completed successfully');
    } catch (error) {
      this.logger.error(
        `License expiry check job failed: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Check for licenses expiring in specified days and send alerts
   */
  private async checkAndAlertForDays(daysFromNow: number) {
    this.logger.log(`Checking for licenses expiring in ${daysFromNow} days...`);

    try {
      // Get all licenses expiring in X days
      const expiringLicenses =
        await this.licenseService.findAllExpiring(daysFromNow);

      if (expiringLicenses.length === 0) {
        this.logger.log(`No licenses expiring in ${daysFromNow} days`);
        return;
      }

      this.logger.log(
        `Found ${expiringLicenses.length} licenses expiring in ${daysFromNow} days`,
      );

      // Group licenses by tenant
      const licensesByTenant = this.groupByTenant(expiringLicenses);

      // Send alert for each tenant
      for (const [tenantId, licenses] of Object.entries(licensesByTenant)) {
        await this.sendExpiryAlert(tenantId, licenses, daysFromNow);
      }
    } catch (error) {
      this.logger.error(
        `Failed to check licenses expiring in ${daysFromNow} days: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Group licenses by tenant_id
   */
  private groupByTenant(licenses: any[]): Record<string, any[]> {
    return licenses.reduce((acc, license) => {
      const tenantId = license.tenant.id;
      if (!acc[tenantId]) {
        acc[tenantId] = [];
      }
      acc[tenantId].push(license);
      return acc;
    }, {});
  }

  /**
   * Send expiry alert email to tenant Owner/Admin users
   */
  private async sendExpiryAlert(
    tenantId: string,
    licenses: any[],
    daysUntilExpiry: number,
  ) {
    try {
      const tenant = licenses[0].tenant;

      // Get Owner and Admin users for this tenant
      const allUsers = await this.prisma.user.findMany({
        where: {
          tenant_id: tenantId,
          is_active: true,
        },
        include: {
          user_role_user_role_user_idTouser: {
            include: {
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      // Filter by role name (check if user has Owner or Admin role)
      const recipients = allUsers.filter((user) =>
        user.user_role_user_role_user_idTouser.some((ur) =>
          ['Owner', 'Admin'].includes(ur.role.name),
        ),
      );

      if (recipients.length === 0) {
        this.logger.warn(
          `No Owner/Admin users found for tenant ${tenantId} to send license expiry alerts`,
        );
        return;
      }

      // TODO: Integrate with email service (Mailgun, SendGrid, etc.)
      // For now, just log the alert
      this.logger.log(
        `ALERT: Tenant '${tenant.company_name}' (${tenant.subdomain}) has ${licenses.length} license(s) expiring in ${daysUntilExpiry} days`,
      );

      for (const license of licenses) {
        const licenseTypeName =
          license.license_type?.name ||
          license.custom_license_type ||
          'Unknown';
        this.logger.log(
          `  - ${licenseTypeName} #${license.license_number} (State: ${license.issuing_state}) expires on ${new Date(license.expiry_date).toLocaleDateString()}`,
        );
      }

      this.logger.log(
        `  Recipients: ${recipients.map((r) => r.email).join(', ')}`,
      );

      // TODO: Send actual email
      // await this.emailService.sendLicenseExpiryAlert({
      //   recipients: recipients.map(r => r.email),
      //   tenant: tenant,
      //   licenses: licenses,
      //   daysUntilExpiry: daysUntilExpiry,
      // });

      // Create audit log entry
      await this.prisma.audit_log.create({
        data: {
          id: randomBytes(16).toString('hex'),
          tenant_id: tenantId,
          actor_user_id: null, // System action
          actor_type: 'cron_job',
          action_type: 'ALERT',
          entity_type: 'TenantLicense',
          entity_id: '',
          description: `License expiry alert: ${licenses.length} license(s) expiring in ${daysUntilExpiry} days`,
          metadata_json: JSON.stringify({
            type: 'license_expiry_alert',
            days_until_expiry: daysUntilExpiry,
            license_count: licenses.length,
            licenses: licenses.map((l) => ({
              id: l.id,
              license_number: l.license_number,
              expiry_date: l.expiry_date,
            })),
          }),
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to send expiry alert for tenant ${tenantId}: ${error.message}`,
        error.stack,
      );
    }
  }
}
