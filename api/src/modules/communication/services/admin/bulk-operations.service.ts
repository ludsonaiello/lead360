import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  BatchRetryTranscriptionsDto,
  BatchResendCommunicationEventsDto,
  BatchRetryWebhookEventsDto,
  ExportUsageDto,
} from '../../dto/admin/bulk-operations.dto';

/**
 * BulkOperationsService
 *
 * Manages bulk administrative operations for communication system.
 *
 * Responsibilities:
 * - Batch retry failed transcriptions
 * - Batch resend failed communication events
 * - Batch retry failed webhook events
 * - Export usage data to CSV format
 *
 * Architecture:
 * - Uses BullMQ for async processing of batch operations
 * - Limits batch size to prevent overwhelming system
 * - Returns job IDs for tracking progress
 * - Supports filtering by date range, status, tenant, etc.
 *
 * Security:
 * - All operations require SystemAdmin role (enforced at controller level)
 * - Admin user ID is recorded for audit purposes
 * - Batch size limits prevent abuse
 *
 * @class BulkOperationsService
 * @since Sprint 11
 */
@Injectable()
export class BulkOperationsService {
  private readonly logger = new Logger(BulkOperationsService.name);
  private readonly MAX_BATCH_SIZE = 1000;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('communication-call-transcription')
    private readonly transcriptionQueue: Queue,
  ) {}

  /**
   * Batch retry failed transcriptions
   *
   * Queues multiple failed transcriptions for retry using BullMQ.
   * Useful for recovering from provider outages or temporary failures.
   *
   * @param filters - Filter criteria for selecting transcriptions
   * @returns Promise<BatchRetryResult>
   */
  async batchRetryTranscriptions(
    filters: BatchRetryTranscriptionsDto,
  ): Promise<BatchRetryResult> {
    this.logger.log(
      `Batch retrying transcriptions with filters: ${JSON.stringify(filters)}`,
    );

    try {
      const { tenant_id, start_date, end_date, provider_id, limit } = filters;

      // Validate limit
      const batchLimit = Math.min(limit || 100, this.MAX_BATCH_SIZE);

      // Build where clause
      const where: any = {
        status: 'failed',
      };

      if (tenant_id) {
        where.tenant_id = tenant_id;
      }

      if (provider_id) {
        where.transcription_provider = provider_id;
      }

      if (start_date || end_date) {
        where.created_at = {};
        if (start_date) {
          where.created_at.gte = new Date(start_date);
        }
        if (end_date) {
          where.created_at.lte = new Date(end_date);
        }
      }

      // Fetch failed transcriptions
      const transcriptions = await this.prisma.call_transcription.findMany({
        where,
        take: batchLimit,
        orderBy: { created_at: 'desc' },
        include: {
          call_record: {
            select: {
              id: true,
              recording_url: true,
              tenant_id: true,
            },
          },
        },
      });

      if (transcriptions.length === 0) {
        return {
          success: true,
          queued_count: 0,
          job_ids: [],
          message: 'No failed transcriptions found matching criteria',
        };
      }

      // Queue each transcription for retry
      const jobIds: string[] = [];

      for (const transcription of transcriptions) {
        // Add job to BullMQ queue
        const job = await this.transcriptionQueue.add(
          'retry-transcription',
          {
            transcriptionId: transcription.id,
            callRecordId: transcription.call_record_id,
            recordingUrl: transcription.call_record.recording_url,
            tenantId: transcription.call_record.tenant_id,
            transcriptionProvider: transcription.transcription_provider,
            isRetry: true,
          },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        );

        if (job.id) {
          jobIds.push(job.id);
        }

        // Update transcription status to queued for retry
        await this.prisma.call_transcription.update({
          where: { id: transcription.id },
          data: {
            status: 'queued',
            error_message: null,
          },
        });
      }

      this.logger.log(
        `Queued ${transcriptions.length} transcriptions for retry`,
      );

      return {
        success: true,
        queued_count: transcriptions.length,
        job_ids: jobIds,
        message: `Successfully queued ${transcriptions.length} transcription(s) for retry`,
      };
    } catch (error) {
      this.logger.error('Failed to batch retry transcriptions:', error.message);
      this.logger.error('Error stack:', error.stack);
      throw new InternalServerErrorException(
        'Failed to queue transcriptions for retry',
      );
    }
  }

  /**
   * Batch resend failed communication events
   *
   * Queues multiple failed communication events (SMS, email, WhatsApp) for retry.
   * Supports filtering by channel, tenant, and date range.
   *
   * @param filters - Filter criteria for selecting events
   * @returns Promise<BatchRetryResult>
   */
  async batchResendCommunicationEvents(
    filters: BatchResendCommunicationEventsDto,
  ): Promise<BatchRetryResult> {
    this.logger.log(
      `Batch resending communication events with filters: ${JSON.stringify(filters)}`,
    );

    try {
      const { tenant_id, channel, start_date, end_date, limit } = filters;

      // Validate limit
      const batchLimit = Math.min(limit || 100, this.MAX_BATCH_SIZE);

      // Build where clause
      const where: any = {
        status: 'failed',
      };

      if (tenant_id) {
        where.tenant_id = tenant_id;
      }

      if (channel) {
        where.channel = channel;
      }

      if (start_date || end_date) {
        where.created_at = {};
        if (start_date) {
          where.created_at.gte = new Date(start_date);
        }
        if (end_date) {
          where.created_at.lte = new Date(end_date);
        }
      }

      // Fetch failed communication events
      const events = await this.prisma.communication_event.findMany({
        where,
        take: batchLimit,
        orderBy: { created_at: 'desc' },
      });

      if (events.length === 0) {
        return {
          success: true,
          queued_count: 0,
          job_ids: [],
          message: 'No failed communication events found matching criteria',
        };
      }

      // Reset events to pending for retry
      const jobIds: string[] = [];

      for (const event of events) {
        // Update status back to pending for retry
        await this.prisma.communication_event.update({
          where: { id: event.id },
          data: {
            status: 'pending',
            error_message: null,
          },
        });

        jobIds.push(`retry-${event.id}`);
      }

      this.logger.log(`Queued ${events.length} communication events for retry`);

      return {
        success: true,
        queued_count: events.length,
        job_ids: jobIds,
        message: `Successfully queued ${events.length} communication event(s) for retry`,
      };
    } catch (error) {
      this.logger.error(
        'Failed to batch resend communication events:',
        error.message,
      );
      this.logger.error('Error stack:', error.stack);
      throw new InternalServerErrorException(
        'Failed to queue communication events for retry',
      );
    }
  }

  /**
   * Batch retry failed webhook events
   *
   * Queues multiple failed webhook events for reprocessing.
   * Useful for recovering from temporary processing failures.
   *
   * @param filters - Filter criteria for selecting webhook events
   * @returns Promise<BatchRetryResult>
   */
  async batchRetryWebhookEvents(
    filters: BatchRetryWebhookEventsDto,
  ): Promise<BatchRetryResult> {
    this.logger.log(
      `Batch retrying webhook events with filters: ${JSON.stringify(filters)}`,
    );

    try {
      const { tenant_id, event_type, start_date, end_date, limit } = filters;

      // Validate limit
      const batchLimit = Math.min(limit || 100, this.MAX_BATCH_SIZE);

      // Build where clause
      const where: any = {
        processed: true,
        error_message: { not: null }, // Only retry failed events
      };

      if (tenant_id) {
        where.provider = {
          tenant_id,
        };
      }

      if (event_type) {
        where.event_type = event_type;
      }

      if (start_date || end_date) {
        where.created_at = {};
        if (start_date) {
          where.created_at.gte = new Date(start_date);
        }
        if (end_date) {
          where.created_at.lte = new Date(end_date);
        }
      }

      // Fetch failed webhook events
      const webhookEvents = await this.prisma.webhook_event.findMany({
        where,
        take: batchLimit,
        orderBy: { created_at: 'desc' },
      });

      if (webhookEvents.length === 0) {
        return {
          success: true,
          queued_count: 0,
          job_ids: [],
          message: 'No failed webhook events found matching criteria',
        };
      }

      // Reset webhook events for retry
      const jobIds: string[] = [];

      for (const event of webhookEvents) {
        await this.prisma.webhook_event.update({
          where: { id: event.id },
          data: {
            processed: false,
            error_message: null,
            retry_count: event.retry_count + 1,
            next_retry_at: null,
          },
        });

        jobIds.push(`webhook-retry-${event.id}`);
      }

      this.logger.log(`Queued ${webhookEvents.length} webhook events for retry`);

      return {
        success: true,
        queued_count: webhookEvents.length,
        job_ids: jobIds,
        message: `Successfully queued ${webhookEvents.length} webhook event(s) for retry`,
      };
    } catch (error) {
      this.logger.error('Failed to batch retry webhook events:', error.message);
      this.logger.error('Error stack:', error.stack);
      throw new InternalServerErrorException(
        'Failed to queue webhook events for retry',
      );
    }
  }

  /**
   * Export usage data to CSV format
   *
   * Generates a CSV export of Twilio usage data with flexible filtering.
   * Supports filtering by tenant, date range, and usage category.
   *
   * @param filters - Filter criteria for usage export
   * @returns Promise<UsageExportResult>
   */
  async exportUsageToCSV(filters: ExportUsageDto): Promise<UsageExportResult> {
    this.logger.log(
      `Exporting usage to CSV with filters: ${JSON.stringify(filters)}`,
    );

    try {
      const { tenant_id, start_date, end_date, category } = filters;

      // Build where clause
      const where: any = {};

      if (tenant_id) {
        where.tenant_id = tenant_id;
      }

      if (category) {
        where.category = category;
      }

      // Date range (default to last 30 days if not provided)
      const endDate = end_date ? new Date(end_date) : new Date();
      const startDate = start_date
        ? new Date(start_date)
        : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      where.start_date = {
        gte: startDate,
        lte: endDate,
      };

      // Fetch usage records
      const usageRecords = await this.prisma.twilio_usage_record.findMany({
        where,
        orderBy: [{ start_date: 'desc' }, { category: 'asc' }],
        include: {
          tenant: {
            select: {
              id: true,
              company_name: true,
            },
          },
        },
      });

      if (usageRecords.length === 0) {
        throw new BadRequestException(
          'No usage records found matching criteria',
        );
      }

      // Generate CSV content
      const csvRows: string[] = [];

      // CSV Header
      csvRows.push(
        [
          'Start Date',
          'End Date',
          'Tenant ID',
          'Tenant Name',
          'Category',
          'Count',
          'Usage Unit',
          'Price (USD)',
          'Price Unit',
        ].join(','),
      );

      // CSV Data Rows
      for (const record of usageRecords) {
        const row = [
          record.start_date.toISOString().split('T')[0],
          record.end_date.toISOString().split('T')[0],
          record.tenant_id || 'SYSTEM',
          record.tenant ? `"${record.tenant.company_name}"` : 'System-Level',
          `"${record.category}"`,
          record.count.toString(),
          record.usage_unit,
          record.price.toString(),
          record.price_unit,
        ];

        csvRows.push(row.join(','));
      }

      const csvContent = csvRows.join('\n');

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `twilio-usage-export-${timestamp}.csv`;

      this.logger.log(
        `Generated CSV export with ${usageRecords.length} records`,
      );

      return {
        success: true,
        filename,
        content: csvContent,
        record_count: usageRecords.length,
        date_range: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('Failed to export usage to CSV:', error.message);
      this.logger.error('Error stack:', error.stack);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to generate CSV export');
    }
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface BatchRetryResult {
  success: boolean;
  queued_count: number;
  job_ids: string[];
  message: string;
}

export interface UsageExportResult {
  success: boolean;
  filename: string;
  content: string;
  record_count: number;
  date_range: {
    start: string;
    end: string;
  };
}
