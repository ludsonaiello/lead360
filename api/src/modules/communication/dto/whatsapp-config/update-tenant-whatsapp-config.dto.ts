import { IsString, IsBoolean, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Update Tenant WhatsApp Configuration DTO
 *
 * All fields are optional - only provided fields will be updated.
 * If credentials are updated, they will be re-validated.
 */
export class UpdateTenantWhatsAppConfigDto {
  @ApiProperty({
    description: 'Twilio Account SID',
    example: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    required: false,
    pattern: '^AC[a-z0-9]{32}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^AC[a-z0-9]{32}$/i, {
    message:
      'Invalid Twilio Account SID format. Must start with "AC" followed by 32 alphanumeric characters.',
  })
  account_sid?: string;

  @ApiProperty({
    description: 'Twilio Auth Token',
    example: 'your_auth_token_here',
    required: false,
  })
  @IsOptional()
  @IsString()
  auth_token?: string;

  @ApiProperty({
    description:
      'Twilio WhatsApp phone number in E.164 format (with or without whatsapp: prefix)',
    example: '+19781234567',
    required: false,
    pattern: '^(whatsapp:)?\\+[1-9]\\d{1,14}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^(whatsapp:)?\+[1-9]\d{1,14}$/, {
    message:
      'Phone number must be in E.164 format with country code (e.g., +19781234567 or whatsapp:+19781234567)',
  })
  from_phone?: string;

  @ApiProperty({
    description: 'Webhook secret for signature verification',
    required: false,
    example: 'your_webhook_secret_here',
  })
  @IsOptional()
  @IsString()
  webhook_secret?: string;

  @ApiProperty({
    description: 'Whether this configuration is active',
    required: false,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
