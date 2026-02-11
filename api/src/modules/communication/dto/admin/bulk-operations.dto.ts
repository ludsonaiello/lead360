import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsEnum,
} from 'class-validator';

/**
 * Batch Retry Transcriptions DTO
 *
 * Request body for queueing failed transcriptions for retry.
 *
 * @class BatchRetryTranscriptionsDto
 */
export class BatchRetryTranscriptionsDto {
  @ApiProperty({
    required: false,
    description: 'Filter by tenant ID',
    example: 'tenant-uuid-here',
  })
  @IsOptional()
  @IsString()
  tenant_id?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by transcription provider ID',
    example: 'provider-uuid-here',
  })
  @IsOptional()
  @IsString()
  provider_id?: string;

  @ApiProperty({
    required: false,
    description: 'Start date for filtering (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiProperty({
    required: false,
    description: 'End date for filtering (ISO 8601)',
    example: '2026-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiProperty({
    required: false,
    description: 'Maximum number of transcriptions to queue (max: 1000)',
    example: 100,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}

/**
 * Batch Resend Communication Events DTO
 *
 * Request body for queueing failed communication events for retry.
 *
 * @class BatchResendCommunicationEventsDto
 */
export class BatchResendCommunicationEventsDto {
  @ApiProperty({
    required: false,
    description: 'Filter by tenant ID',
    example: 'tenant-uuid-here',
  })
  @IsOptional()
  @IsString()
  tenant_id?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by communication channel',
    example: 'sms',
    enum: ['email', 'sms', 'whatsapp'],
  })
  @IsOptional()
  @IsEnum(['email', 'sms', 'whatsapp'], {
    message: 'Channel must be one of: email, sms, whatsapp',
  })
  channel?: 'email' | 'sms' | 'whatsapp';

  @ApiProperty({
    required: false,
    description: 'Start date for filtering (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiProperty({
    required: false,
    description: 'End date for filtering (ISO 8601)',
    example: '2026-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiProperty({
    required: false,
    description: 'Maximum number of events to queue (max: 1000)',
    example: 100,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}

/**
 * Batch Retry Webhook Events DTO
 *
 * Request body for queueing failed webhook events for reprocessing.
 *
 * @class BatchRetryWebhookEventsDto
 */
export class BatchRetryWebhookEventsDto {
  @ApiProperty({
    required: false,
    description: 'Filter by tenant ID',
    example: 'tenant-uuid-here',
  })
  @IsOptional()
  @IsString()
  tenant_id?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by webhook event type',
    example: 'sms',
  })
  @IsOptional()
  @IsString()
  event_type?: string;

  @ApiProperty({
    required: false,
    description: 'Start date for filtering (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiProperty({
    required: false,
    description: 'End date for filtering (ISO 8601)',
    example: '2026-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiProperty({
    required: false,
    description: 'Maximum number of webhook events to queue (max: 1000)',
    example: 100,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}

/**
 * Export Usage DTO
 *
 * Query parameters for exporting Twilio usage data to CSV.
 *
 * @class ExportUsageDto
 */
export class ExportUsageDto {
  @ApiProperty({
    required: false,
    description: 'Filter by tenant ID (omit for all tenants)',
    example: 'tenant-uuid-here',
  })
  @IsOptional()
  @IsString()
  tenant_id?: string;

  @ApiProperty({
    required: false,
    description: 'Start date for export (ISO 8601, defaults to 30 days ago)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiProperty({
    required: false,
    description: 'End date for export (ISO 8601, defaults to today)',
    example: '2026-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by usage category',
    example: 'sms-outbound',
  })
  @IsOptional()
  @IsString()
  category?: string;
}
