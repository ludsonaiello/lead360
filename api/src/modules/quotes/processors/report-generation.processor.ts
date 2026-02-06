import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AdminReportingService } from '../services/admin-reporting.service';
import { ReportType, ExportFormat } from '../dto/admin';
import { SendEmailService } from '../../communication/services/send-email.service';

@Processor('export')
export class ReportGenerationProcessor extends WorkerHost {
  private readonly logger = new Logger(ReportGenerationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adminReportingService: AdminReportingService,
    private readonly sendEmailService: SendEmailService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    // Skip scheduled-report jobs (handled by ScheduledReportProcessor)
    if (job.name === 'scheduled-report') {
      return; // Let ScheduledReportProcessor handle this
    }

    const { exportJobId, exportType, filters, format, scheduledReportId } =
      job.data;

    // DEBUG: Log full job data to trace scheduledReportId
    this.logger.log(`[DEBUG] Full job.data: ${JSON.stringify(job.data)}`);
    this.logger.log(
      `[DEBUG] scheduledReportId extracted: ${scheduledReportId}`,
    );

    this.logger.log(
      `Processing report generation job: ${exportJobId}, type: ${exportType}`,
    );

    // Check if this is a report generation job
    const reportTypes = [
      ReportType.QUOTE_SUMMARY,
      ReportType.TENANT_PERFORMANCE,
      ReportType.REVENUE_ANALYSIS,
      ReportType.CONVERSION_ANALYSIS,
    ];

    if (!reportTypes.includes(exportType)) {
      this.logger.debug(`Skipping non-report job: ${exportType}`);
      return; // Not a report job, skip
    }

    try {
      // Update status to processing
      await this.prisma.export_job.update({
        where: { id: exportJobId },
        data: { status: 'processing' },
      });

      const startTime = Date.now();
      let filePath: string;
      const rowCount = 0;

      // Parse date filters
      const params = {
        date_from: new Date(filters.date_from),
        date_to: new Date(filters.date_to),
        tenant_ids: filters.tenant_ids,
        group_by: filters.group_by,
      };

      // Generate report based on type
      switch (exportType) {
        case ReportType.QUOTE_SUMMARY:
          filePath =
            await this.adminReportingService.generateQuoteSummaryReport(
              params,
              format as ExportFormat,
            );
          break;

        case ReportType.TENANT_PERFORMANCE:
          filePath =
            await this.adminReportingService.generateTenantPerformanceReport(
              params,
              format as ExportFormat,
            );
          break;

        case ReportType.REVENUE_ANALYSIS:
          filePath =
            await this.adminReportingService.generateRevenueAnalysisReport(
              params,
              format as ExportFormat,
            );
          break;

        case ReportType.CONVERSION_ANALYSIS:
          filePath =
            await this.adminReportingService.generateConversionAnalysisReport(
              params,
              format as ExportFormat,
            );
          break;

        default:
          throw new Error(`Unsupported report type: ${exportType}`);
      }

      const duration = Date.now() - startTime;

      // Update job as completed
      await this.prisma.export_job.update({
        where: { id: exportJobId },
        data: {
          status: 'completed',
          file_path: filePath,
          row_count: rowCount,
          completed_at: new Date(),
        },
      });

      this.logger.log(
        `Report generation completed: ${exportJobId} in ${duration}ms`,
      );

      // DEBUG: Check if we should send email
      this.logger.log(
        `[DEBUG] Checking email sending: scheduledReportId=${scheduledReportId}, type: ${typeof scheduledReportId}`,
      );

      // If this is from a scheduled report, send emails to recipients
      if (scheduledReportId) {
        this.logger.log(
          `[DEBUG] Condition passed - calling sendScheduledReportEmail`,
        );
        await this.sendScheduledReportEmail(
          scheduledReportId,
          filePath,
          exportType,
          format,
        );
      } else {
        this.logger.log(
          `[DEBUG] Condition failed - scheduledReportId is falsy, NOT sending email`,
        );
      }

      return { success: true, filePath, duration };
    } catch (error) {
      this.logger.error(
        `Report generation failed: ${exportJobId}`,
        error.stack,
      );

      // Update job as failed
      await this.prisma.export_job.update({
        where: { id: exportJobId },
        data: {
          status: 'failed',
          error_message: error.message,
          completed_at: new Date(),
        },
      });

      throw error;
    }
  }

  /**
   * Send email with report attachment to scheduled report recipients
   */
  private async sendScheduledReportEmail(
    scheduledReportId: string,
    filePath: string,
    reportType: string,
    format: string,
  ): Promise<void> {
    this.logger.log(
      `[DEBUG] sendScheduledReportEmail called with scheduledReportId: ${scheduledReportId}`,
    );

    try {
      // Fetch scheduled report with recipients
      const scheduledReport = await this.prisma.scheduled_report.findUnique({
        where: { id: scheduledReportId },
      });

      this.logger.log(
        `[DEBUG] Fetched scheduled report: ${scheduledReport ? 'FOUND' : 'NOT FOUND'}`,
      );

      if (!scheduledReport) {
        this.logger.warn(
          `Scheduled report not found: ${scheduledReportId}, skipping email`,
        );
        return;
      }

      const recipients = scheduledReport.recipients as string[];
      if (!recipients || recipients.length === 0) {
        this.logger.log(
          `No recipients configured for scheduled report: ${scheduledReportId}`,
        );
        return;
      }

      // Send email to each recipient
      for (const recipientEmail of recipients) {
        try {
          await this.sendEmailService.sendRaw(
            null, // Platform admin report (no tenant)
            {
              to: recipientEmail,
              subject: `Scheduled Report: ${scheduledReport.name}`,
              html_body: `
                <h2>Scheduled Report Ready</h2>
                <p>Your scheduled report "<strong>${scheduledReport.name}</strong>" has been generated.</p>
                <p><strong>Report Type:</strong> ${reportType}</p>
                <p><strong>Format:</strong> ${format.toUpperCase()}</p>
                <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
                <p>The report has been generated and is available for download.</p>
                <p><em>Note: File attachment coming in future update. For now, access the report from the admin panel.</em></p>
              `,
              text_body: `
Scheduled Report Ready

Your scheduled report "${scheduledReport.name}" has been generated.

Report Type: ${reportType}
Format: ${format.toUpperCase()}
Generated: ${new Date().toLocaleString()}

The report has been generated and is available for download from the admin panel.
              `,
            },
          );

          this.logger.log(
            `Report email sent to ${recipientEmail} for scheduled report: ${scheduledReportId}`,
          );
        } catch (emailError) {
          this.logger.error(
            `Failed to send report email to ${recipientEmail}: ${emailError.message}`,
            emailError.stack,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error sending scheduled report emails: ${error.message}`,
        error.stack,
      );
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed successfully`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}
