import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
} from 'class-validator';

/**
 * Create Tenant SMS Config DTO
 *
 * Request body for creating SMS configuration on behalf of a tenant.
 * Admin can configure tenant to use system provider (Model B) or custom credentials (Model A).
 *
 * @class CreateTenantSmsConfigDto
 */
export class CreateTenantSmsConfigDto {
  @ApiProperty({
    required: false,
    description: 'Provider type: system (Model B) or custom (Model A)',
    example: 'system',
    enum: ['system', 'custom'],
  })
  @IsOptional()
  @IsEnum(['system', 'custom'])
  provider_type?: 'system' | 'custom';

  @ApiProperty({
    description: 'Phone number for sending SMS (E.164 format)',
    example: '+15555555555',
  })
  @IsString()
  from_phone: string;

  @ApiProperty({
    required: false,
    description: 'Twilio Account SID (required for custom provider)',
    example: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  })
  @IsOptional()
  @IsString()
  account_sid?: string;

  @ApiProperty({
    required: false,
    description: 'Twilio Auth Token (required for custom provider, will be encrypted)',
    example: 'your_auth_token_here',
  })
  @IsOptional()
  @IsString()
  auth_token?: string;
}

/**
 * Update Tenant SMS Config DTO
 *
 * Request body for updating SMS configuration on behalf of a tenant.
 *
 * @class UpdateTenantSmsConfigDto
 */
export class UpdateTenantSmsConfigDto {
  @ApiProperty({
    required: false,
    description: 'Phone number for sending SMS (E.164 format)',
    example: '+15555555555',
  })
  @IsOptional()
  @IsString()
  from_phone?: string;

  @ApiProperty({
    required: false,
    description: 'Enable/disable this configuration',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({
    required: false,
    description: 'Twilio Account SID (for updating custom provider credentials)',
    example: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  })
  @IsOptional()
  @IsString()
  account_sid?: string;

  @ApiProperty({
    required: false,
    description: 'Twilio Auth Token (for updating custom provider credentials)',
    example: 'your_auth_token_here',
  })
  @IsOptional()
  @IsString()
  auth_token?: string;
}

/**
 * Create Tenant WhatsApp Config DTO
 *
 * Request body for creating WhatsApp configuration on behalf of a tenant.
 *
 * @class CreateTenantWhatsAppConfigDto
 */
export class CreateTenantWhatsAppConfigDto {
  @ApiProperty({
    required: false,
    description: 'Provider type: system (Model B) or custom (Model A)',
    example: 'system',
    enum: ['system', 'custom'],
  })
  @IsOptional()
  @IsEnum(['system', 'custom'])
  provider_type?: 'system' | 'custom';

  @ApiProperty({
    description: 'WhatsApp phone number (E.164 format)',
    example: '+15555555555',
  })
  @IsString()
  from_phone: string;

  @ApiProperty({
    required: false,
    description: 'Twilio Account SID (required for custom provider)',
    example: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  })
  @IsOptional()
  @IsString()
  account_sid?: string;

  @ApiProperty({
    required: false,
    description: 'Twilio Auth Token (required for custom provider, will be encrypted)',
    example: 'your_auth_token_here',
  })
  @IsOptional()
  @IsString()
  auth_token?: string;
}

/**
 * Update Tenant WhatsApp Config DTO
 *
 * Request body for updating WhatsApp configuration on behalf of a tenant.
 *
 * @class UpdateTenantWhatsAppConfigDto
 */
export class UpdateTenantWhatsAppConfigDto {
  @ApiProperty({
    required: false,
    description: 'WhatsApp phone number (E.164 format)',
    example: '+15555555555',
  })
  @IsOptional()
  @IsString()
  from_phone?: string;

  @ApiProperty({
    required: false,
    description: 'Enable/disable this configuration',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({
    required: false,
    description: 'Twilio Account SID (for updating custom provider credentials)',
    example: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  })
  @IsOptional()
  @IsString()
  account_sid?: string;

  @ApiProperty({
    required: false,
    description: 'Twilio Auth Token (for updating custom provider credentials)',
    example: 'your_auth_token_here',
  })
  @IsOptional()
  @IsString()
  auth_token?: string;
}
