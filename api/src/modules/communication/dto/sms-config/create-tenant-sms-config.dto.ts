import { IsString, IsUUID, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Create Tenant SMS Configuration DTO
 *
 * Validates input for creating a new SMS configuration.
 * All credentials are validated before storage.
 */
export class CreateTenantSmsConfigDto {
  @ApiProperty({
    description: 'Communication provider ID (must be twilio_sms provider)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  @IsUUID()
  provider_id: string;

  @ApiProperty({
    description:
      'Twilio Account SID (starts with AC followed by 32 characters)',
    example: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    pattern: '^AC[a-z0-9]{32}$',
    minLength: 34,
    maxLength: 34,
  })
  @IsString()
  @Matches(/^AC[a-z0-9]{32}$/i, {
    message:
      'Invalid Twilio Account SID format. Must start with "AC" followed by 32 alphanumeric characters.',
  })
  account_sid: string;

  @ApiProperty({
    description: 'Twilio Auth Token (32 characters)',
    example: 'your_auth_token_here_32_characters',
    minLength: 32,
  })
  @IsString()
  auth_token: string;

  @ApiProperty({
    description: 'Twilio phone number in E.164 format (e.g., +19781234567)',
    example: '+19781234567',
    pattern: '^\\+[1-9]\\d{1,14}$',
  })
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message:
      'Phone number must be in E.164 format with country code (e.g., +19781234567)',
  })
  from_phone: string;

  @ApiProperty({
    description:
      'Optional webhook secret for signature verification (recommended for production)',
    required: false,
    example: 'your_webhook_secret_here',
  })
  @IsOptional()
  @IsString()
  webhook_secret?: string;
}
