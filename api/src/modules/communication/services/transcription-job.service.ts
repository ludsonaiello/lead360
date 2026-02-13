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
      },
    });

    if (!callRecord) {
      throw new NotFoundException(`Call record not found: ${callRecordId}`);
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

    // Check if current (active) transcription already exists
    const existingTranscription =
      await this.prisma.call_transcription.findFirst({
        where: {
          call_record_id: callRecordId,
          is_current: true,
        },
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

    // Create transcription record in queued state
    const transcription = await this.prisma.call_transcription.create({
      data: {
        tenant_id: callRecord.tenant_id,
        call_record_id: callRecord.id,
        transcription_provider: 'openai_whisper', // Will be overridden by processor based on active provider
        status: 'queued',
        is_current: true, // New field for retry support
      },
    });

    this.logger.log(`Created transcription record: ${transcription.id}`);

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

    // Update call record status
    await this.prisma.call_record.update({
      where: { id: callRecordId },
      data: {
        recording_status: 'processing_transcription',
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
  async listTranscriptionsForCall(callRecordId: string, tenantId: string) {
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

    const totalProcessingTime = await this.prisma.call_transcription.aggregate({
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
        averageSeconds:
          totalProcessingTime._avg.processing_duration_seconds || 0,
        averageConfidence: totalProcessingTime._avg.confidence_score || 0,
      },
    };
  }

  /**
   * Retry failed or poor quality transcription
   *
   * Creates a new transcription record and re-queues the job.
   * Marks the previous transcription as superseded (is_current = false).
   * Increments retry counter for tracking.
   *
   * @param transcriptionId - ID of transcription to retry
   * @param tenantId - Tenant ID for isolation
   * @param reason - Optional reason for retry (for audit purposes)
   * @returns New transcription record details
   * @throws NotFoundException if transcription not found or no recording URL
   *
   * @example
   * ```typescript
   * const result = await retryTranscription(
   *   'trans-123',
   *   'tenant-456',
   *   'Poor quality, retrying with different settings'
   * );
   * console.log(result.new_transcription_id); // ID of new transcription
   * ```
   */
  async retryTranscription(
    transcriptionId: string,
    tenantId: string,
    reason?: string,
  ) {
    this.logger.log(
      `Retrying transcription ${transcriptionId}${reason ? `: ${reason}` : ''}`,
    );

    // Fetch existing transcription with call record details
    const existingTranscription =
      await this.prisma.call_transcription.findFirst({
        where: {
          id: transcriptionId,
          tenant_id: tenantId,
        },
        include: {
          call_record: {
            select: {
              id: true,
              tenant_id: true,
              recording_url: true,
              recording_duration_seconds: true,
            },
          },
        },
      });

    if (!existingTranscription) {
      throw new NotFoundException(
        `Transcription not found: ${transcriptionId}`,
      );
    }

    // Validate recording URL is still available
    if (!existingTranscription.call_record.recording_url) {
      throw new NotFoundException(
        `Recording URL not available for call ${existingTranscription.call_record_id}. Cannot retry transcription.`,
      );
    }

    // Check if there's already a pending retry for this call
    const existingPendingRetry = await this.prisma.call_transcription.findFirst(
      {
        where: {
          call_record_id: existingTranscription.call_record_id,
          status: {
            in: ['queued', 'processing'],
          },
          is_current: true,
        },
      },
    );

    if (existingPendingRetry && existingPendingRetry.id !== transcriptionId) {
      this.logger.warn(
        `Retry already in progress for call ${existingTranscription.call_record_id}: ${existingPendingRetry.id}`,
      );
      return {
        success: false,
        reason: 'retry_in_progress',
        message: 'A retry is already in progress for this call recording',
        existing_retry_id: existingPendingRetry.id,
      };
    }

    // Mark old transcription as superseded (no longer current)
    await this.prisma.call_transcription.update({
      where: { id: transcriptionId },
      data: {
        is_current: false,
      },
    });

    this.logger.debug(
      `Marked transcription ${transcriptionId} as superseded (is_current = false)`,
    );

    // Create new transcription record for retry
    const newTranscription = await this.prisma.call_transcription.create({
      data: {
        tenant_id: existingTranscription.tenant_id,
        call_record_id: existingTranscription.call_record_id,
        transcription_provider: existingTranscription.transcription_provider,
        status: 'queued',
        is_current: true,
        retry_count: existingTranscription.retry_count + 1,
        previous_transcription_id: transcriptionId,
      },
    });

    this.logger.log(
      `Created new transcription record ${newTranscription.id} (retry #${newTranscription.retry_count})`,
    );

    // Queue job for processing
    await this.transcriptionQueue.add(
      'process-transcription',
      {
        callRecordId: existingTranscription.call_record_id,
        transcriptionId: newTranscription.id,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30000,
        },
        priority: 5, // Higher priority for manual retries
        removeOnComplete: {
          age: 86400,
          count: 1000,
        },
        removeOnFail: false,
      },
    );

    this.logger.log(
      `Transcription retry queued successfully: ${newTranscription.id}`,
    );

    // Update call record status
    await this.prisma.call_record.update({
      where: { id: existingTranscription.call_record_id },
      data: {
        recording_status: 'processing_transcription',
      },
    });

    return {
      success: true,
      transcription_id: newTranscription.id,
      previous_transcription_id: transcriptionId,
      call_record_id: existingTranscription.call_record_id,
      retry_count: newTranscription.retry_count,
      status: 'queued',
      recording_url: existingTranscription.call_record.recording_url,
      message: `Transcription retry queued successfully. Previous attempt (${transcriptionId}) superseded.`,
    };
  }

  /**
   * Transcribe a call (create new or retry existing transcription)
   *
   * More flexible than retryTranscription - works with call record ID.
   * Creates transcription if none exists, or retries if one exists.
   *
   * Use cases:
   * - Call was never transcribed (webhook failed)
   * - Want to manually trigger transcription
   * - Recording was delayed and missed automatic processing
   *
   * @param callRecordId - Call record ID to transcribe
   * @param tenantId - Tenant ID for isolation
   * @param reason - Optional reason (for audit purposes)
   * @returns Transcription details (new or retried)
   * @throws NotFoundException if call not found or no recording
   */
  async transcribeCall(
    callRecordId: string,
    tenantId: string,
    reason?: string,
  ) {
    this.logger.log(
      `Transcribing call ${callRecordId}${reason ? `: ${reason}` : ''}`,
    );

    // Find call record with recording details
    const callRecord = await this.prisma.call_record.findFirst({
      where: {
        id: callRecordId,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        tenant_id: true,
        recording_url: true,
        recording_duration_seconds: true,
        recording_status: true,
      },
    });

    if (!callRecord) {
      throw new NotFoundException(`Call record not found: ${callRecordId}`);
    }

    // Validate recording is available
    if (!callRecord.recording_url) {
      throw new NotFoundException(
        `Recording not available for call ${callRecordId}. Cannot transcribe.`,
      );
    }

    // Check if current transcription exists
    const currentTranscription = await this.prisma.call_transcription.findFirst(
      {
        where: {
          call_record_id: callRecordId,
          is_current: true,
        },
      },
    );

    // If transcription exists, retry it
    if (currentTranscription) {
      this.logger.log(
        `Found existing transcription ${currentTranscription.id}, retrying...`,
      );

      // Check if already processing
      if (['queued', 'processing'].includes(currentTranscription.status)) {
        this.logger.warn(
          `Transcription ${currentTranscription.id} is already ${currentTranscription.status}`,
        );
        return {
          success: false,
          reason: 'already_processing',
          message: `Transcription is already ${currentTranscription.status}`,
          transcription_id: currentTranscription.id,
          status: currentTranscription.status,
        };
      }

      // Mark old as superseded
      await this.prisma.call_transcription.update({
        where: { id: currentTranscription.id },
        data: { is_current: false },
      });

      // Create retry
      const newTranscription = await this.prisma.call_transcription.create({
        data: {
          tenant_id: callRecord.tenant_id,
          call_record_id: callRecord.id,
          transcription_provider: currentTranscription.transcription_provider,
          status: 'queued',
          is_current: true,
          retry_count: currentTranscription.retry_count + 1,
          previous_transcription_id: currentTranscription.id,
        },
      });

      this.logger.log(
        `Created retry transcription ${newTranscription.id} (attempt #${newTranscription.retry_count + 1})`,
      );

      // Queue job
      await this.transcriptionQueue.add(
        'process-transcription',
        {
          callRecordId: callRecord.id,
          transcriptionId: newTranscription.id,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 30000 },
          priority: 5,
          removeOnComplete: { age: 86400, count: 1000 },
          removeOnFail: false,
        },
      );

      // Update call status
      await this.prisma.call_record.update({
        where: { id: callRecordId },
        data: { recording_status: 'processing_transcription' },
      });

      return {
        success: true,
        transcription_id: newTranscription.id,
        previous_transcription_id: currentTranscription.id,
        call_record_id: callRecordId,
        retry_count: newTranscription.retry_count,
        status: 'queued',
        recording_url: callRecord.recording_url,
        message: `Transcription retry queued (attempt #${newTranscription.retry_count + 1}). Previous attempt superseded.`,
      };
    }

    // No transcription exists - create first one
    this.logger.log(
      `No existing transcription found, creating first transcription...`,
    );

    const transcription = await this.prisma.call_transcription.create({
      data: {
        tenant_id: callRecord.tenant_id,
        call_record_id: callRecord.id,
        transcription_provider: 'openai_whisper',
        status: 'queued',
        is_current: true,
        retry_count: 0,
      },
    });

    this.logger.log(`Created first transcription record: ${transcription.id}`);

    // Queue job
    await this.transcriptionQueue.add(
      'process-transcription',
      {
        callRecordId: callRecord.id,
        transcriptionId: transcription.id,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
        priority: 5,
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: false,
      },
    );

    // Update call status
    await this.prisma.call_record.update({
      where: { id: callRecordId },
      data: { recording_status: 'processing_transcription' },
    });

    return {
      success: true,
      transcription_id: transcription.id,
      previous_transcription_id: null,
      call_record_id: callRecordId,
      retry_count: 0,
      status: 'queued',
      recording_url: callRecord.recording_url,
      message: 'First transcription queued successfully.',
    };
  }
}
