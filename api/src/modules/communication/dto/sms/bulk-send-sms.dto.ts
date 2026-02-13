import {
  IsNotEmpty,
  IsArray,
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
  ArrayMaxSize,
  ArrayMinSize,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for bulk SMS sending
 *
 * Validates input for sending SMS to multiple Leads at once.
 * Used for campaigns, reminders, and announcements.
 *
 * Features:
 * - Send to up to 500 Leads per request
 * - Automatic opt-out filtering (TCPA compliance)
 * - Rate limiting support
 * - Template support
 * - Multi-tenant isolation enforced
 *
 * Usage:
 * - Provide lead_ids array (max 500)
 * - Either text_body or template_id required
 * - Optional rate_limit_per_second (default: 5/sec)
 */
export class BulkSendSmsDto {
  @ApiProperty({
    description: 'Array of Lead UUIDs to send SMS to (max 500)',
    example: [
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    ],
    type: [String],
    minItems: 1,
    maxItems: 500,
  })
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1, {
    message: 'At least one Lead ID is required',
  })
  @ArrayMaxSize(500, {
    message: 'Cannot send to more than 500 Leads per bulk operation',
  })
  @IsUUID('4', {
    each: true,
    message: 'Each lead_id must be a valid UUID',
  })
  lead_ids: string[];

  @ApiProperty({
    description: 'SMS message body (max 1600 characters)',
    example: 'Your quote is ready! View it at: https://...',
    maxLength: 1600,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1600, {
    message: 'SMS message cannot exceed 1600 characters',
  })
  text_body: string;

  @ApiProperty({
    description:
      'Optional: SMS template UUID (if provided, template will be merged with Lead data)',
    example: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  template_id?: string;

  @ApiProperty({
    description:
      'Optional: Related entity type (quote, invoice, campaign, etc.)',
    example: 'campaign',
    required: false,
  })
  @IsOptional()
  @IsString()
  related_entity_type?: string;

  @ApiProperty({
    description: 'Optional: Related entity UUID',
    example: 'd4e5f6a7-b8c9-0123-def0-234567890123',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  related_entity_id?: string;

  @ApiProperty({
    description:
      'Optional: Rate limit (SMS per second). Default: 5. Max: 10 to comply with Twilio limits.',
    example: 5,
    minimum: 1,
    maximum: 10,
    default: 5,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1, {
    message: 'Rate limit must be at least 1 SMS per second',
  })
  @Max(10, {
    message: 'Rate limit cannot exceed 10 SMS per second (Twilio limit)',
  })
  rate_limit_per_second?: number;
}
