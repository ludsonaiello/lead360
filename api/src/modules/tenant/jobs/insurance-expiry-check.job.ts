import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenantInsuranceService } from '../services/tenant-insurance.service';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * Insurance Expiry Check Job
 *
 * Runs daily at 9 AM (tenant timezone) to check for expiring insurance policies
 * (General Liability and Workers Compensation) and send email alerts
 * at 30, 15, 7, and 1 days before expiry.
 *
 * This is a CRITICAL job for compliance and risk management.
 */
@Injectable()
export class InsuranceExpiryCheckJob {
  private readonly logger = new Logger(InsuranceExpiryCheckJob.name);

  // Days before expiry to send alerts
  private readonly ALERT_DAYS = [30, 15, 7, 1];

  constructor(
    private readonly insuranceService: TenantInsuranceService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Run daily at 9 AM server time
   * TODO: Adjust to tenant timezone once timezone field is added to Tenant model
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async handleInsuranceExpiryCheck() {
    this.logger.log('Starting insurance expiry check job...');

    try {
      for (const days of this.ALERT_DAYS) {
        await this.checkAndAlertForDays(days);
      }

      this.logger.log('Insurance expiry check job completed successfully');
    } catch (error) {
      this.logger.error(`Insurance expiry check job failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Check for insurance policies expiring in specified days and send alerts
   */
  private async checkAndAlertForDays(daysFromNow: number) {
    this.logger.log(`Checking for insurance policies expiring in ${daysFromNow} days...`);

    try {
      // Get all insurance records with GL or WC expiring in X days
      const expiringInsurance = await this.insuranceService.findExpiring(daysFromNow);

      if (expiringInsurance.length === 0) {
        this.logger.log(`No insurance policies expiring in ${daysFromNow} days`);
        return;
      }

      this.logger.log(`Found ${expiringInsurance.length} insurance records with expiring policies in ${daysFromNow} days`);

      // Send alert for each tenant
      for (const insurance of expiringInsurance) {
        await this.sendExpiryAlert(insurance, daysFromNow);
      }
    } catch (error) {
      this.logger.error(
        `Failed to check insurance expiring in ${daysFromNow} days: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send expiry alert email to tenant Owner/Admin users
   */
  private async sendExpiryAlert(insurance: any, daysUntilExpiry: number) {
    try {
      const tenant = insurance.tenant;
      const tenantId = tenant.id;

      // Determine which policies are expiring
      const expiringDate = new Date();
      expiringDate.setDate(expiringDate.getDate() + daysUntilExpiry);
      const startOfDay = new Date(expiringDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(expiringDate);
      endOfDay.setHours(23, 59, 59, 999);

      const expiringPolicies: string[] = [];

      if (insurance.gl_expiry_date) {
        const glExpiryDate = new Date(insurance.gl_expiry_date);
        if (glExpiryDate >= startOfDay && glExpiryDate <= endOfDay) {
          expiringPolicies.push('General Liability (GL)');
        }
      }

      if (insurance.wc_expiry_date) {
        const wcExpiryDate = new Date(insurance.wc_expiry_date);
        if (wcExpiryDate >= startOfDay && wcExpiryDate <= endOfDay) {
          expiringPolicies.push('Workers Compensation (WC)');
        }
      }

      if (expiringPolicies.length === 0) {
        return; // No policies expiring on this exact date
      }

      // Get Owner and Admin users for this tenant
      const allUsers = await this.prisma.user.findMany({
        where: {
          tenant_id: tenantId,
          is_active: true,
        },
        select: {
          id: true,
          email: true,
          first_name: true,
          last_name: true,
          user_roles: {
            select: {
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      // Filter by role (check if user has Owner or Admin role)
      const recipients = allUsers.filter(user =>
        user.user_roles.some(ur => ['Owner', 'Admin'].includes(ur.role.name))
      );

      if (recipients.length === 0) {
        this.logger.warn(`No Owner/Admin users found for tenant ${tenantId} to send insurance expiry alerts`);
        return;
      }

      // TODO: Integrate with email service (Mailgun, SendGrid, etc.)
      // For now, just log the alert
      this.logger.log(
        `ALERT: Tenant '${tenant.company_name}' (${tenant.subdomain}) has ${expiringPolicies.length} insurance policy/policies expiring in ${daysUntilExpiry} days`,
      );

      for (const policy of expiringPolicies) {
        if (policy.includes('GL')) {
          this.logger.log(
            `  - General Liability: ${insurance.gl_insurance_provider} (Policy: ${insurance.gl_policy_number}) expires on ${new Date(insurance.gl_expiry_date).toLocaleDateString()}`,
          );
        } else if (policy.includes('WC')) {
          this.logger.log(
            `  - Workers Compensation: ${insurance.wc_insurance_provider} (Policy: ${insurance.wc_policy_number}) expires on ${new Date(insurance.wc_expiry_date).toLocaleDateString()}`,
          );
        }
      }

      this.logger.log(`  Recipients: ${recipients.map((r) => r.email).join(', ')}`);

      // TODO: Send actual email
      // await this.emailService.sendInsuranceExpiryAlert({
      //   recipients: recipients.map(r => r.email),
      //   tenant: tenant,
      //   insurance: insurance,
      //   expiringPolicies: expiringPolicies,
      //   daysUntilExpiry: daysUntilExpiry,
      // });

      // Create audit log entry
      await this.prisma.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: null, // System action
          actor_type: 'cron_job',
          action_type: 'ALERT',
          entity_type: 'TenantInsurance',
          entity_id: insurance.id,
          description: `Insurance expiry alert: ${daysUntilExpiry} days until expiry`,
          metadata_json: {
            type: 'insurance_expiry_alert',
            days_until_expiry: daysUntilExpiry,
            expiring_policies: expiringPolicies,
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to send insurance expiry alert for tenant ${insurance.tenant.id}: ${error.message}`,
        error.stack,
      );
    }
  }
}
