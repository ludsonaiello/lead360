import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
  Matches,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for sending SMS
 *
 * Validates input for direct SMS sending via REST endpoint.
 * Phone number must be in E.164 format for Twilio compatibility.
 *
 * Usage:
 * - Provide either to_phone directly OR lead_id (which will load phone from Lead)
 * - If both are provided, to_phone takes precedence
 * - If lead_id is provided, Lead ownership is verified (multi-tenant isolation)
 */
export class SendSmsDto {
  @ApiProperty({
    description: 'Recipient phone number in E.164 format (e.g., +19781234567)',
    example: '+12025551234',
    pattern: '^\\+[1-9]\\d{1,14}$',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format (e.g., +12025551234)',
  })
  to_phone?: string;

  @ApiProperty({
    description:
      'SMS message body (max 1600 characters for proper segmentation)',
    example: 'Hi John, your quote is ready! View it here: https://...',
    maxLength: 1600,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1600, {
    message: 'SMS message cannot exceed 1600 characters',
  })
  text_body: string;

  @ApiProperty({
    description: 'Optional: Related entity type (lead, quote, invoice, etc.)',
    example: 'lead',
    required: false,
  })
  @IsOptional()
  @IsString()
  related_entity_type?: string;

  @ApiProperty({
    description: 'Optional: Related entity UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  related_entity_id?: string;

  @ApiProperty({
    description:
      'Optional: Lead UUID (if sending to a Lead, auto-fills to_phone from primary phone)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  lead_id?: string;

  @ApiProperty({
    description:
      'Optional: SMS template UUID (if provided, template will be loaded and merged with data)',
    example: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  template_id?: string;

  @ApiProperty({
    description:
      'Optional: Schedule SMS for future delivery (ISO 8601 format, e.g., 2026-02-14T09:00:00Z). If not provided, SMS sends immediately.',
    example: '2026-02-14T09:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  scheduled_at?: string;
}
