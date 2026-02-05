import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AdminReportingService } from '../services/admin-reporting.service';

@Processor('scheduled-reports')
export class ScheduledReportProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduledReportProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminReportingService: AdminReportingService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    // This processor only handles scheduled-report jobs
    // (no need to check job.name since we're on a dedicated queue)

    const { scheduledReportId, report_type, parameters, format } = job.data;

    this.logger.log(
      `Processing scheduled report: ${scheduledReportId}, type: ${report_type}`,
    );

    try {
      // Fetch scheduled report from database
      const scheduledReport = await this.prisma.scheduled_report.findUnique({
        where: { id: scheduledReportId },
      });

      if (!scheduledReport) {
        this.logger.error(
          `Scheduled report not found: ${scheduledReportId}`,
        );
        return;
      }

      // Check if report is still active
      if (!scheduledReport.is_active) {
        this.logger.log(
          `Scheduled report is inactive, skipping: ${scheduledReportId}`,
        );
        return;
      }

      // Resolve relative dates in parameters
      const resolvedParams = this.resolveRelativeDates(parameters);

      // Queue the report generation
      this.logger.log(`[DEBUG] Calling queueReportGeneration with scheduledReportId: ${scheduledReportId}`);

      const reportJob = await this.adminReportingService.queueReportGeneration(
        report_type,
        {
          date_from: new Date(resolvedParams.date_from),
          date_to: new Date(resolvedParams.date_to),
          tenant_ids: resolvedParams.tenant_ids,
          group_by: resolvedParams.group_by,
        },
        format,
        scheduledReport.admin_user_id,
        scheduledReportId, // Pass scheduledReportId for email sending
      );

      this.logger.log(
        `Report generation queued: ${reportJob.job_id} for scheduled report: ${scheduledReportId}`,
      );

      // Update last_run_at and next_run_at
      const schedule = scheduledReport.schedule as
        | 'daily'
        | 'weekly'
        | 'monthly';
      const next_run_at = this.calculateNextRunTime(schedule);

      await this.prisma.scheduled_report.update({
        where: { id: scheduledReportId },
        data: {
          last_run_at: new Date(),
          next_run_at,
        },
      });

      this.logger.log(
        `Scheduled report updated: ${scheduledReportId}, next run: ${next_run_at}`,
      );

      return { success: true, reportJobId: reportJob.job_id };
    } catch (error) {
      this.logger.error(
        `Failed to process scheduled report: ${scheduledReportId}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Resolve relative dates (e.g., "relative:-7d", "relative:now")
   */
  private resolveRelativeDates(parameters: any): any {
    const resolved = { ...parameters };

    if (parameters.date_from && parameters.date_from.startsWith('relative:')) {
      resolved.date_from = this.parseRelativeDate(parameters.date_from);
    }

    if (parameters.date_to && parameters.date_to.startsWith('relative:')) {
      resolved.date_to = this.parseRelativeDate(parameters.date_to);
    }

    return resolved;
  }

  /**
   * Parse relative date strings (e.g., "relative:-7d", "relative:now")
   */
  private parseRelativeDate(relative: string): string {
    const now = new Date();

    if (relative === 'relative:now') {
      return now.toISOString();
    }

    // Parse relative:-7d, relative:-30d, etc.
    const match = relative.match(/^relative:(-?\d+)([dhm])$/);
    if (match) {
      const amount = parseInt(match[1], 10);
      const unit = match[2];

      switch (unit) {
        case 'd': // days
          now.setDate(now.getDate() + amount);
          break;
        case 'h': // hours
          now.setHours(now.getHours() + amount);
          break;
        case 'm': // months
          now.setMonth(now.getMonth() + amount);
          break;
      }

      return now.toISOString();
    }

    // Default to now if parsing fails
    return now.toISOString();
  }

  /**
   * Calculate next run time based on schedule
   */
  private calculateNextRunTime(
    schedule: 'daily' | 'weekly' | 'monthly',
  ): Date {
    const now = new Date();
    const next = new Date(now);

    // Set to midnight
    next.setHours(0, 0, 0, 0);

    switch (schedule) {
      case 'daily':
        // Tomorrow at midnight
        next.setDate(next.getDate() + 1);
        break;

      case 'weekly':
        // Next Monday at midnight
        const daysUntilMonday = (8 - next.getDay()) % 7 || 7;
        next.setDate(next.getDate() + daysUntilMonday);
        break;

      case 'monthly':
        // First day of next month at midnight
        next.setMonth(next.getMonth() + 1);
        next.setDate(1);
        break;
    }

    return next;
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    if (job.name === 'scheduled-report') {
      this.logger.log(`Scheduled report job ${job.id} completed successfully`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    if (job.name === 'scheduled-report') {
      this.logger.error(
        `Scheduled report job ${job.id} failed: ${error.message}`,
      );
    }
  }
}
