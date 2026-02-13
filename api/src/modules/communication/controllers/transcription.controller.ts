import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { TenantId } from '../../../modules/auth/decorators/tenant-id.decorator';
import { TranscriptionJobService } from '../services/transcription-job.service';
import {
  RetryTranscriptionDto,
  RetryTranscriptionResponseDto,
} from '../dto/transcription/retry-transcription.dto';

/**
 * Transcription Controller
 *
 * Manages call transcription operations including:
 * - Viewing transcription details
 * - Searching transcriptions
 * - Retrying failed transcriptions
 * - Viewing transcription history
 */
@ApiTags('Communication - Transcriptions')
@ApiBearerAuth()
@Controller('communication/transcriptions')
@UseGuards(JwtAuthGuard)
export class TranscriptionController {
  constructor(
    private readonly transcriptionJobService: TranscriptionJobService,
  ) {}

  /**
   * Retry a failed or poor quality transcription
   *
   * Creates a new transcription attempt for the same call recording.
   * The previous transcription is marked as superseded but retained for audit purposes.
   */
  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retry transcription',
    description: `
      Re-transcribe a call recording. Creates a new transcription record and queues it for processing.

      Use cases:
      - Failed transcription needs to be retried
      - Poor quality transcription (low confidence score)
      - Want to try different provider settings
      - Twilio recording was initially unavailable but is now ready

      The previous transcription is kept for audit purposes but marked as superseded.
      The new transcription will have an incremented retry_count.

      Recording URL must still be available in Twilio (recordings expire after some time).
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Transcription ID to retry',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Transcription retry queued successfully',
    type: RetryTranscriptionResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Transcription not found or recording URL not available',
  })
  @ApiResponse({
    status: 409,
    description: 'A retry is already in progress for this call',
  })
  async retryTranscription(
    @Param('id') transcriptionId: string,
    @TenantId() tenantId: string,
    @Body() dto: RetryTranscriptionDto,
  ): Promise<RetryTranscriptionResponseDto | any> {
    return this.transcriptionJobService.retryTranscription(
      transcriptionId,
      tenantId,
      dto.reason,
    );
  }

  /**
   * Get transcription by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get transcription details',
    description:
      'Retrieve full transcription details including call information',
  })
  @ApiParam({
    name: 'id',
    description: 'Transcription ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Transcription details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Transcription not found',
  })
  async getTranscription(
    @Param('id') transcriptionId: string,
    @TenantId() tenantId: string,
  ) {
    return this.transcriptionJobService.getTranscriptionById(
      transcriptionId,
      tenantId,
    );
  }

  /**
   * List all transcriptions for tenant (paginated)
   */
  @Get()
  @ApiOperation({
    summary: 'List transcriptions',
    description: 'Get paginated list of transcriptions for the tenant',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (1-indexed)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Results per page (max 100)',
    example: 20,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status',
    enum: ['queued', 'processing', 'completed', 'failed'],
  })
  @ApiResponse({
    status: 200,
    description: 'Transcriptions retrieved successfully',
  })
  async listTranscriptions(
    @TenantId() tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.transcriptionJobService.listTranscriptions(
      tenantId,
      page,
      limit,
      status,
    );
  }

  /**
   * Search transcriptions using full-text search
   */
  @Get('search/:query')
  @ApiOperation({
    summary: 'Search transcriptions',
    description: 'Full-text search across all transcription text',
  })
  @ApiParam({
    name: 'query',
    description: 'Search query',
    example: 'quote estimate pricing',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (1-indexed)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Results per page (max 100)',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Search results retrieved successfully',
  })
  async searchTranscriptions(
    @Param('query') query: string,
    @TenantId() tenantId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.transcriptionJobService.searchTranscriptions(
      tenantId,
      query,
      page,
      limit,
    );
  }

  /**
   * Get transcription statistics for tenant
   */
  @Get('stats/summary')
  @ApiOperation({
    summary: 'Get transcription statistics',
    description: 'Get summary statistics for all transcriptions',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  async getStatistics(@TenantId() tenantId: string) {
    return this.transcriptionJobService.getStatistics(tenantId);
  }

  /**
   * Get transcription history for a call (all retry attempts)
   */
  @Get('call/:callRecordId/history')
  @ApiOperation({
    summary: 'Get transcription history for call',
    description:
      'Get all transcription attempts for a call (including retries)',
  })
  @ApiParam({
    name: 'callRecordId',
    description: 'Call record ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Transcription history retrieved successfully',
  })
  async getCallTranscriptionHistory(
    @Param('callRecordId') callRecordId: string,
    @TenantId() tenantId: string,
  ) {
    return this.transcriptionJobService.listTranscriptionsForCall(
      callRecordId,
      tenantId,
    );
  }

  /**
   * Transcribe a call (create new transcription or retry existing)
   *
   * Use this endpoint when:
   * - Call was never transcribed (no transcription exists)
   * - Want to retry an existing transcription using call ID instead of transcription ID
   * - Recording webhook failed and transcription was never created
   */
  @Post('call/:callRecordId/transcribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Transcribe a call recording',
    description: `
      Create a transcription for a call that was never transcribed, or retry an existing one.

      This endpoint is more flexible than the retry endpoint because:
      - Works with call record ID (not transcription ID)
      - Creates transcription if none exists
      - Retries existing transcription if one exists
      - Useful when webhook failed or recording was delayed

      If a current transcription exists:
      - Marks it as superseded (is_current = false)
      - Creates new transcription attempt
      - Increments retry counter

      If no transcription exists:
      - Creates first transcription attempt
      - Sets retry_count = 0
    `,
  })
  @ApiParam({
    name: 'callRecordId',
    description: 'Call record ID to transcribe',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Transcription queued successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Call record not found or recording not available',
  })
  async transcribeCall(
    @Param('callRecordId') callRecordId: string,
    @TenantId() tenantId: string,
    @Body() dto: RetryTranscriptionDto,
  ) {
    return this.transcriptionJobService.transcribeCall(
      callRecordId,
      tenantId,
      dto.reason,
    );
  }
}
