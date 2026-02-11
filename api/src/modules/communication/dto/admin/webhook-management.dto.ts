import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Update Webhook Config DTO
 *
 * Request body for updating webhook configuration (base URL, signature verification).
 *
 * @class UpdateWebhookConfigDto
 */
export class UpdateWebhookConfigDto {
  @ApiProperty({
    required: false,
    description: 'Base URL for webhook endpoints',
    example: 'https://api.lead360.app',
  })
  @IsOptional()
  @IsString()
  base_url?: string;

  @ApiProperty({
    required: false,
    description: 'Enable/disable webhook signature verification',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  signature_verification?: boolean;

  @ApiProperty({
    required: false,
    description: 'Generate new webhook secret',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  rotate_secret?: boolean;
}

/**
 * Test Webhook DTO
 *
 * Request body for testing webhook endpoint delivery.
 *
 * @class TestWebhookDto
 */
export class TestWebhookDto {
  @ApiProperty({
    description: 'Type of webhook to test (sms, call, whatsapp, email, ivr)',
    example: 'sms',
    enum: ['sms', 'call', 'whatsapp', 'email', 'ivr'],
  })
  @IsString()
  @IsEnum(['sms', 'call', 'whatsapp', 'email', 'ivr'], {
    message: 'Type must be one of: sms, call, whatsapp, email, ivr',
  })
  type: string;

  @ApiProperty({
    required: false,
    description: 'Test payload to send',
    example: { from: '+15555555555', to: '+15555555556', body: 'Test message' },
  })
  @IsOptional()
  @IsObject()
  payload?: any;
}

/**
 * Webhook Event Filters DTO
 *
 * Query parameters for filtering webhook events with pagination.
 *
 * @class WebhookEventFiltersDto
 */
export class WebhookEventFiltersDto {
  @ApiProperty({
    required: false,
    description: 'Filter by webhook type',
    example: 'sms',
    enum: ['sms', 'call', 'whatsapp', 'email'],
  })
  @IsOptional()
  @IsString()
  webhook_type?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by processing status',
    example: 'failed',
    enum: ['pending', 'processed', 'failed'],
  })
  @IsOptional()
  @IsEnum(['pending', 'processed', 'failed'], {
    message: 'Status must be one of: pending, processed, failed',
  })
  status?: 'pending' | 'processed' | 'failed';

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
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({
    required: false,
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
