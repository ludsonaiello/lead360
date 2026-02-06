import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { JobQueueService } from '../services/job-queue.service';

@Injectable()
export class ExpiryCheckHandler {
  private readonly logger = new Logger(ExpiryCheckHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobQueue: JobQueueService,
  ) {
    this.logger.log('ExpiryCheckHandler initialized');
  }

  async execute(jobId: string, payload: any): Promise<any> {
    this.logger.log(`🔄 PROCESSING: Starting expiry check job ${jobId}`);

    try {
      await this.jobQueue.updateJobStatus(jobId, 'processing');

      // Get all active tenants
      const tenants = await this.prisma.tenant.findMany({
        where: { is_active: true },
        select: { id: true, company_name: true },
      });

      let totalWarnings = 0;

      for (const tenant of tenants) {
        try {
          // Check licenses expiring in 30, 14, 7, 3, 1 days
          const warnings = await this.checkTenantExpiry(tenant.id, jobId);
          totalWarnings += warnings;
        } catch (error) {
          this.logger.error(
            `Tenant ${tenant.company_name} expiry check failed: ${error.message}`,
          );
          await this.jobQueue.logJobExecution(
            jobId,
            'error',
            `Tenant ${tenant.company_name} failed: ${error.message}`,
          );
        }
      }

      await this.jobQueue.updateJobStatus(jobId, 'completed', {
        result: { tenantsProcessed: tenants.length, totalWarnings },
      });

      await this.jobQueue.logJobExecution(
        jobId,
        'info',
        `Expiry check completed: ${totalWarnings} warnings sent`,
        { tenantsProcessed: tenants.length, totalWarnings },
      );

      this.logger.log(`Expiry check completed: ${totalWarnings} warnings sent`);

      return { success: true, tenantsProcessed: tenants.length, totalWarnings };
    } catch (error) {
      this.logger.error(
        `Expiry check job ${jobId} failed: ${error.message}`,
        error.stack,
      );

      await this.jobQueue.updateJobStatus(jobId, 'failed', {
        error_message: error.message,
      });

      throw error;
    }
  }

  private async checkTenantExpiry(
    tenantId: string,
    jobId: string,
  ): Promise<number> {
    // Fetch tenant details (company name + owner email)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        company_name: true,
        primary_contact_email: true,
      },
    });

    if (!tenant) {
      this.logger.warn(`Tenant ${tenantId} not found, skipping expiry check`);
      return 0;
    }

    let warningsCount = 0;
    const now = new Date();
    const thirtyDaysFromNow = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000,
    );

    // Check license expiry
    const expiringLicenses = await this.prisma.tenant_license.findMany({
      where: {
        tenant_id: tenantId,
        expiry_date: {
          gte: now,
          lte: thirtyDaysFromNow,
        },
      },
      include: {
        license_type: true,
      },
    });

    for (const license of expiringLicenses) {
      const daysUntilExpiry = Math.floor(
        (license.expiry_date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      );

      // Only send warnings at specific thresholds: 30, 14, 7, 3, 1 days
      if ([30, 14, 7, 3, 1].includes(daysUntilExpiry)) {
        // Check if we already sent a warning for this license today
        const alreadySent = await this.checkIfWarningAlreadySent(
          tenantId,
          'license-expiry-warning',
          license.id,
        );

        if (!alreadySent) {
          await this.jobQueue.queueEmail({
            to: tenant.primary_contact_email,
            templateKey: 'license-expiry-warning',
            variables: {
              company_name: tenant.company_name,
              license_type:
                license.license_type?.name ||
                license.custom_license_type ||
                'License',
              license_number: license.license_number,
              expiry_date: license.expiry_date.toISOString().split('T')[0],
              days_until_expiry: daysUntilExpiry.toString(),
            },
            tenantId,
          });

          await this.jobQueue.logJobExecution(
            jobId,
            'info',
            `License expiry warning queued for tenant ${tenantId}: ${license.license_number} expiring in ${daysUntilExpiry} days`,
          );

          warningsCount++;
        }
      }
    }

    // Check insurance expiry (General Liability + Workers Comp)
    const insurance = await this.prisma.tenant_insurance.findUnique({
      where: { tenant_id: tenantId },
    });

    if (insurance) {
      // Check GL expiry
      if (
        insurance.gl_expiry_date &&
        insurance.gl_expiry_date >= now &&
        insurance.gl_expiry_date <= thirtyDaysFromNow
      ) {
        const daysUntilExpiry = Math.floor(
          (insurance.gl_expiry_date.getTime() - now.getTime()) /
            (24 * 60 * 60 * 1000),
        );

        if ([30, 14, 7, 3, 1].includes(daysUntilExpiry)) {
          const alreadySent = await this.checkIfWarningAlreadySent(
            tenantId,
            'insurance-expiry-warning',
            `gl-${insurance.id}`,
          );

          if (!alreadySent) {
            try {
              await this.jobQueue.queueEmail({
                to: tenant.primary_contact_email,
                templateKey: 'insurance-expiry-warning',
                variables: {
                  company_name: tenant.company_name,
                  insurance_type: 'General Liability Insurance',
                  policy_number: insurance.gl_policy_number || 'N/A',
                  provider: insurance.gl_insurance_provider || 'N/A',
                  expiry_date: insurance.gl_expiry_date
                    .toISOString()
                    .split('T')[0],
                  days_until_expiry: daysUntilExpiry.toString(),
                },
                tenantId,
              });

              await this.jobQueue.logJobExecution(
                jobId,
                'info',
                `GL insurance expiry warning queued for tenant ${tenantId}: expiring in ${daysUntilExpiry} days`,
              );

              warningsCount++;
            } catch (error) {
              this.logger.warn(
                `Failed to queue GL insurance warning: ${error.message} (template may not exist)`,
              );
            }
          }
        }
      }

      // Check WC expiry
      if (
        insurance.wc_expiry_date &&
        insurance.wc_expiry_date >= now &&
        insurance.wc_expiry_date <= thirtyDaysFromNow
      ) {
        const daysUntilExpiry = Math.floor(
          (insurance.wc_expiry_date.getTime() - now.getTime()) /
            (24 * 60 * 60 * 1000),
        );

        if ([30, 14, 7, 3, 1].includes(daysUntilExpiry)) {
          const alreadySent = await this.checkIfWarningAlreadySent(
            tenantId,
            'insurance-expiry-warning',
            `wc-${insurance.id}`,
          );

          if (!alreadySent) {
            try {
              await this.jobQueue.queueEmail({
                to: tenant.primary_contact_email,
                templateKey: 'insurance-expiry-warning',
                variables: {
                  company_name: tenant.company_name,
                  insurance_type: 'Workers Compensation Insurance',
                  policy_number: insurance.wc_policy_number || 'N/A',
                  provider: insurance.wc_insurance_provider || 'N/A',
                  expiry_date: insurance.wc_expiry_date
                    .toISOString()
                    .split('T')[0],
                  days_until_expiry: daysUntilExpiry.toString(),
                },
                tenantId,
              });

              await this.jobQueue.logJobExecution(
                jobId,
                'info',
                `WC insurance expiry warning queued for tenant ${tenantId}: expiring in ${daysUntilExpiry} days`,
              );

              warningsCount++;
            } catch (error) {
              this.logger.warn(
                `Failed to queue WC insurance warning: ${error.message} (template may not exist)`,
              );
            }
          }
        }
      }
    }

    return warningsCount;
  }

  private async checkIfWarningAlreadySent(
    tenantId: string,
    templateKey: string,
    itemId: string,
  ): Promise<boolean> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const existingEmail = await this.prisma.email_queue.findFirst({
      where: {
        template_key: templateKey,
        to_email: { contains: tenantId },
        created_at: { gte: oneDayAgo },
        status: { in: ['pending', 'sent'] },
      },
    });

    return !!existingEmail;
  }
}
