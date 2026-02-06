import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * Transcription Job Service
 *
 * Manages transcription job lifecycle including queuing, status tracking,
 * and full-text search across completed transcriptions.
 *
 * Features:
 * - Async job queuing via BullMQ
 * - Full-text search using MySQL FULLTEXT indexes
 * - Pagination support
 * - Tenant isolation
 * - Automatic retry on failures (configured in processor)
 * - Job status tracking
 *
 * @example
 * ```typescript
 * // Queue transcription for call
 * await transcriptionJobService.queueTranscription(callRecordId);
 *
 * // Search transcriptions
 * const results = await transcriptionJobService.searchTranscriptions(
 *   tenantId,
 *   'quote request',
 *   1,
 *   20
 * );
 * ```
 */
@Injectable()
export class TranscriptionJobService {
  private readonly logger = new Logger(TranscriptionJobService.name);

  constructor(
    @InjectQueue('communication-call-transcription')
    private readonly transcriptionQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Queue transcription job for call recording
   *
   * Creates transcription record in 'queued' status and adds job to BullMQ
   * for async processing. Updates call record to track transcription progress.
   *
   * @param callRecordId - Call record ID to transcribe
   * @throws NotFoundException if call record not found
   *
   * Job Configuration:
   * - 3 retry attempts with exponential backoff
   * - 30-second initial backoff delay
   * - Results kept for 24 hours
   * - Failed jobs kept indefinitely for debugging
   *
   * @example
   * ```typescript
   * // After recording ready webhook
   * await queueTranscription(callRecord.id);
   * ```
   */
  async queueTranscription(callRecordId: string) {
    this.logger.log(`Queuing transcription for call ${callRecordId}`);

    // Validate call record exists
    const callRecord = await this.prisma.call_record.findUnique({
      where: { id: callRecordId },
      select: {
        id: true,
        tenant_id: true,
        recording_url: true,
        recording_status: true,
        transcription_id: true,
      },
    });

    if (!callRecord) {
      throw new NotFoundException(
        `Call record not found: ${callRecordId}`,
      );
    }

    // Validate recording is available
    if (!callRecord.recording_url) {
      this.logger.warn(
        `No recording URL for call ${callRecordId}. Transcription skipped.`,
      );
      return {
        success: false,
        reason: 'no_recording',
        message: 'Call has no recording available',
      };
    }

    // Check if transcription already exists
    if (callRecord.transcription_id) {
      const existingTranscription =
        await this.prisma.call_transcription.findUnique({
          where: { id: callRecord.transcription_id },
          select: { id: true, status: true },
        });

      if (existingTranscription) {
        this.logger.warn(
          `Transcription already exists for call ${callRecordId}: ${existingTranscription.id} (${existingTranscription.status})`,
        );
        return {
          success: false,
          reason: 'already_exists',
          transcriptionId: existingTranscription.id,
          status: existingTranscription.status,
        };
      }
    }

    // Create transcription record in queued state
    const transcription = await this.prisma.call_transcription.create({
      data: {
        tenant_id: callRecord.tenant_id,
        call_record_id: callRecord.id,
        transcription_provider: 'openai_whisper', // Will be overridden by processor based on active provider
        status: 'queued',
      },
    });

    this.logger.log(
      `Created transcription record: ${transcription.id}`,
    );

    // Queue job for async processing
    await this.transcriptionQueue.add(
      'process-transcription',
      {
        callRecordId: callRecord.id,
        transcriptionId: transcription.id,
      },
      {
        // Retry configuration
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30000, // Start with 30 seconds
        },

        // Job lifecycle
        removeOnComplete: {
          age: 86400, // Keep completed jobs for 24 hours
          count: 1000, // Keep last 1000 completed jobs
        },
        removeOnFail: false, // Keep failed jobs for debugging

        // Priority (lower number = higher priority)
        priority: 10,
      },
    );

    this.logger.log(
      `Transcription job queued successfully for call ${callRecordId}`,
    );

    // Update call record to track transcription
    await this.prisma.call_record.update({
      where: { id: callRecordId },
      data: {
        recording_status: 'processing_transcription',
        transcription_id: transcription.id,
      },
    });

    return {
      success: true,
      transcriptionId: transcription.id,
      status: 'queued',
    };
  }

  /**
   * Search transcriptions using full-text search
   *
   * Performs MySQL FULLTEXT search on transcription_text column.
   * Results are sorted by call date (newest first) with pagination support.
   *
   * @param tenantId - Tenant ID for isolation
   * @param query - Search query (natural language)
   * @param page - Page number (1-indexed)
   * @param limit - Results per page (max 100)
   * @returns Paginated search results with metadata
   *
   * Performance:
   * - Uses FULLTEXT index for fast searching
   * - Supports natural language queries
   * - Multi-tenant isolated
   * - Efficient pagination
   *
   * @example
   * ```typescript
   * // Search for quote-related calls
   * const results = await searchTranscriptions(
   *   'tenant-123',
   *   'quote estimate pricing',
   *   1,
   *   20
   * );
   *
   * console.log(results.data); // Array of transcription records
   * console.log(results.meta.total); // Total matching results
   * console.log(results.meta.totalPages); // Total pages
   * ```
   */
  async searchTranscriptions(
    tenantId: string,
    query: string,
    page = 1,
    limit = 20,
  ) {
    // Validate pagination parameters
    const validatedLimit = Math.min(Math.max(1, limit), 100);
    const validatedPage = Math.max(1, page);
    const skip = (validatedPage - 1) * validatedLimit;

    this.logger.debug(
      `Searching transcriptions: tenant=${tenantId}, query="${query}", page=${validatedPage}, limit=${validatedLimit}`,
    );

    // Perform full-text search using raw SQL for optimal performance
    const results = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        ct.id,
        ct.transcription_text,
        ct.transcription_provider,
        ct.language_detected,
        ct.confidence_score,
        ct.processing_duration_seconds,
        ct.status,
        ct.created_at,
        ct.completed_at,
        cr.id as call_id,
        cr.twilio_call_sid,
        cr.from_number,
        cr.to_number,
        cr.direction,
        cr.call_type,
        cr.recording_duration_seconds,
        cr.created_at as call_date
      FROM call_transcription ct
      JOIN call_record cr ON ct.call_record_id = cr.id
      WHERE ct.tenant_id = ?
        AND ct.status = 'completed'
        AND MATCH(ct.transcription_text) AGAINST(? IN NATURAL LANGUAGE MODE)
      ORDER BY cr.created_at DESC
      LIMIT ? OFFSET ?
    `,
      tenantId,
      query,
      validatedLimit,
      skip,
    );

    // Get total count for pagination metadata
    const countResult = await this.prisma.$queryRawUnsafe<
      Array<{ count: bigint }>
    >(
      `
      SELECT COUNT(*) as count
      FROM call_transcription ct
      WHERE ct.tenant_id = ?
        AND ct.status = 'completed'
        AND MATCH(ct.transcription_text) AGAINST(? IN NATURAL LANGUAGE MODE)
    `,
      tenantId,
      query,
    );

    const total = Number(countResult[0]?.count || 0);

    this.logger.debug(
      `Found ${results.length} results (${total} total matches)`,
    );

    return {
      data: results,
      meta: {
        total,
        page: validatedPage,
        limit: validatedLimit,
        totalPages: Math.ceil(total / validatedLimit),
      },
      query,
    };
  }

  /**
   * Get transcription by ID (with tenant isolation)
   *
   * @param transcriptionId - Transcription ID
   * @param tenantId - Tenant ID for isolation
   * @returns Transcription record with call details
   * @throws NotFoundException if not found
   */
  async getTranscriptionById(transcriptionId: string, tenantId: string) {
    const transcription = await this.prisma.call_transcription.findFirst({
      where: {
        id: transcriptionId,
        tenant_id: tenantId,
      },
      include: {
        call_record: {
          select: {
            id: true,
            twilio_call_sid: true,
            from_number: true,
            to_number: true,
            direction: true,
            call_type: true,
            recording_url: true,
            recording_duration_seconds: true,
            started_at: true,
            ended_at: true,
            created_at: true,
          },
        },
      },
    });

    if (!transcription) {
      throw new NotFoundException(
        `Transcription not found: ${transcriptionId}`,
      );
    }

    return transcription;
  }

  /**
   * List transcriptions for call record
   *
   * @param callRecordId - Call record ID
   * @param tenantId - Tenant ID for isolation
   * @returns Array of transcription records
   */
  async listTranscriptionsForCall(
    callRecordId: string,
    tenantId: string,
  ) {
    return this.prisma.call_transcription.findMany({
      where: {
        call_record_id: callRecordId,
        tenant_id: tenantId,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  /**
   * List all transcriptions for tenant (with pagination)
   *
   * @param tenantId - Tenant ID
   * @param page - Page number (1-indexed)
   * @param limit - Results per page
   * @param status - Optional status filter
   * @returns Paginated transcriptions
   */
  async listTranscriptions(
    tenantId: string,
    page = 1,
    limit = 20,
    status?: string,
  ) {
    const validatedLimit = Math.min(Math.max(1, limit), 100);
    const validatedPage = Math.max(1, page);
    const skip = (validatedPage - 1) * validatedLimit;

    const where: any = {
      tenant_id: tenantId,
    };

    if (status) {
      where.status = status;
    }

    const [transcriptions, total] = await Promise.all([
      this.prisma.call_transcription.findMany({
        where,
        include: {
          call_record: {
            select: {
              id: true,
              from_number: true,
              to_number: true,
              direction: true,
              recording_duration_seconds: true,
              created_at: true,
            },
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        skip,
        take: validatedLimit,
      }),
      this.prisma.call_transcription.count({ where }),
    ]);

    return {
      data: transcriptions,
      meta: {
        total,
        page: validatedPage,
        limit: validatedLimit,
        totalPages: Math.ceil(total / validatedLimit),
      },
    };
  }

  /**
   * Get transcription statistics for tenant
   *
   * @param tenantId - Tenant ID
   * @returns Transcription statistics
   */
  async getStatistics(tenantId: string) {
    const stats = await this.prisma.call_transcription.groupBy({
      by: ['status'],
      where: {
        tenant_id: tenantId,
      },
      _count: {
        id: true,
      },
    });

    const totalProcessingTime =
      await this.prisma.call_transcription.aggregate({
        where: {
          tenant_id: tenantId,
          status: 'completed',
        },
        _sum: {
          processing_duration_seconds: true,
        },
        _avg: {
          processing_duration_seconds: true,
          confidence_score: true,
        },
      });

    return {
      byStatus: stats.reduce(
        (acc, stat) => {
          acc[stat.status] = stat._count.id;
          return acc;
        },
        {} as Record<string, number>,
      ),
      processing: {
        totalSeconds: totalProcessingTime._sum.processing_duration_seconds || 0,
        averageSeconds: totalProcessingTime._avg.processing_duration_seconds || 0,
        averageConfidence: totalProcessingTime._avg.confidence_score || 0,
      },
    };
  }

  /**
   * Retry failed transcription
   *
   * Re-queues a failed transcription for processing.
   *
   * @param transcriptionId - Transcription ID
   * @param tenantId - Tenant ID for isolation
   * @throws NotFoundException if transcription not found
   */
  async retryTranscription(transcriptionId: string, tenantId: string) {
    const transcription = await this.prisma.call_transcription.findFirst({
      where: {
        id: transcriptionId,
        tenant_id: tenantId,
      },
      include: {
        call_record: true,
      },
    });

    if (!transcription) {
      throw new NotFoundException(
        `Transcription not found: ${transcriptionId}`,
      );
    }

    // Update status to queued
    await this.prisma.call_transcription.update({
      where: { id: transcriptionId },
      data: {
        status: 'queued',
        error_message: null,
      },
    });

    // Re-queue job
    await this.transcriptionQueue.add(
      'process-transcription',
      {
        callRecordId: transcription.call_record_id,
        transcriptionId: transcription.id,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30000,
        },
        priority: 5, // Higher priority for retries
      },
    );

    this.logger.log(
      `Transcription ${transcriptionId} re-queued for retry`,
    );

    return {
      success: true,
      transcriptionId,
      status: 'queued',
    };
  }
}
