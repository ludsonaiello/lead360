import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsUUID,
  IsObject,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
} from 'class-validator';

/**
 * DTO for updating platform email configuration (ADMIN ONLY)
 */
export class UpdatePlatformEmailConfigDto {
  @ApiProperty({
    description: 'Provider ID to use for platform emails',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  provider_id: string;

  @ApiProperty({
    description: 'Provider credentials (will be encrypted)',
    example: {
      api_key: 'SG.xxxxxxxxxxxxxxxxxxx',
    },
  })
  @IsObject()
  credentials: object;

  @ApiPropertyOptional({
    description: 'Provider-specific configuration',
    example: {
      click_tracking: false,
      open_tracking: true,
    },
  })
  @IsObject()
  @IsOptional()
  provider_config?: object;

  @ApiProperty({
    description: 'From email address for platform emails',
    example: 'noreply@lead360.app',
  })
  @IsEmail()
  from_email: string;

  @ApiProperty({
    description: 'From name for platform emails',
    example: 'Lead360 Platform',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  from_name: string;

  @ApiPropertyOptional({
    description: 'Webhook verification secret (recommended)',
    example: 'webhook_secret_xyz123',
  })
  @IsString()
  @MinLength(16)
  @IsOptional()
  webhook_secret?: string;
}

/**
 * DTO for creating tenant email provider configuration
 */
export class CreateTenantEmailConfigDto {
  @ApiProperty({
    description: 'Provider ID to use for tenant emails',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  provider_id: string;

  @ApiProperty({
    description: 'Provider credentials (will be encrypted)',
    example: {
      api_key: 'SG.xxxxxxxxxxxxxxxxxxx',
    },
  })
  @IsObject()
  credentials: object;

  @ApiPropertyOptional({
    description: 'Provider-specific configuration',
    example: {
      click_tracking: false,
      open_tracking: true,
    },
  })
  @IsObject()
  @IsOptional()
  provider_config?: object;

  @ApiProperty({
    description: 'From email address',
    example: 'info@acmeplumbing.com',
  })
  @IsEmail()
  from_email: string;

  @ApiProperty({
    description: 'From name',
    example: 'Acme Plumbing',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  from_name: string;

  @ApiPropertyOptional({
    description: 'Reply-to email address',
    example: 'support@acmeplumbing.com',
  })
  @IsEmail()
  @IsOptional()
  reply_to_email?: string;

  @ApiPropertyOptional({
    description: 'Webhook verification secret (recommended)',
    example: 'webhook_secret_xyz123',
  })
  @IsString()
  @MinLength(16)
  @IsOptional()
  webhook_secret?: string;

  @ApiPropertyOptional({
    description: 'Set this provider as active for sending emails',
    example: true,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

/**
 * DTO for updating tenant email configuration
 */
export class UpdateTenantEmailConfigDto {
  @ApiPropertyOptional({
    description: 'Provider ID to use for tenant emails',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  @IsOptional()
  provider_id?: string;

  @ApiPropertyOptional({
    description: 'Provider credentials (will be encrypted)',
    example: {
      api_key: 'SG.xxxxxxxxxxxxxxxxxxx',
    },
  })
  @IsObject()
  @IsOptional()
  credentials?: object;

  @ApiPropertyOptional({
    description: 'Provider-specific configuration',
    example: {
      click_tracking: false,
      open_tracking: true,
    },
  })
  @IsObject()
  @IsOptional()
  provider_config?: object;

  @ApiPropertyOptional({
    description: 'From email address',
    example: 'info@acmeplumbing.com',
  })
  @IsEmail()
  @IsOptional()
  from_email?: string;

  @ApiPropertyOptional({
    description: 'From name',
    example: 'Acme Plumbing',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @IsOptional()
  from_name?: string;

  @ApiPropertyOptional({
    description: 'Reply-to email address',
    example: 'support@acmeplumbing.com',
  })
  @IsEmail()
  @IsOptional()
  reply_to_email?: string;

  @ApiPropertyOptional({
    description: 'Webhook verification secret (recommended)',
    example: 'webhook_secret_xyz123',
  })
  @IsString()
  @MinLength(16)
  @IsOptional()
  webhook_secret?: string;

  @ApiPropertyOptional({
    description: 'Set this provider as active for sending emails',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

/**
 * DTO for testing email configuration
 */
export class TestEmailConfigDto {
  @ApiProperty({
    description: 'Email address to send test email to',
    example: 'test@example.com',
  })
  @IsEmail()
  to: string;
}
