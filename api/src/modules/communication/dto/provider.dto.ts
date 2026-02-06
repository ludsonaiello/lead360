import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsBoolean,
  IsObject,
  IsArray,
  IsOptional,
  Matches,
  IsUrl,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum ProviderType {
  EMAIL = 'email',
  SMS = 'sms',
  CALL = 'call',
  WHATSAPP = 'whatsapp',
}

/**
 * DTO for creating a new provider (ADMIN ONLY)
 */
export class CreateProviderDto {
  @ApiProperty({
    description: 'Unique provider key (kebab-case)',
    example: 'custom-smtp',
  })
  @IsString()
  @Matches(/^[a-z0-9_-]+$/, {
    message:
      'Provider key must be lowercase alphanumeric with hyphens/underscores',
  })
  provider_key: string;

  @ApiProperty({
    description: 'Display name for provider',
    example: 'Custom SMTP Server',
  })
  @IsString()
  provider_name: string;

  @ApiProperty({
    description: 'Provider type',
    enum: ProviderType,
    example: ProviderType.EMAIL,
  })
  @IsEnum(ProviderType)
  provider_type: ProviderType;

  @ApiProperty({
    description: 'JSON Schema for credentials validation',
    example: {
      type: 'object',
      required: ['api_key'],
      properties: {
        api_key: {
          type: 'string',
          description: 'API Key',
          minLength: 10,
        },
      },
    },
  })
  @IsObject()
  credentials_schema: object;

  @ApiPropertyOptional({
    description: 'JSON Schema for configuration validation',
    example: {
      type: 'object',
      properties: {
        enable_tracking: {
          type: 'boolean',
          default: false,
        },
      },
    },
  })
  @IsObject()
  @IsOptional()
  config_schema?: object;

  @ApiPropertyOptional({
    description: 'Default configuration values',
    example: { enable_tracking: false },
  })
  @IsObject()
  @IsOptional()
  default_config?: object;

  @ApiProperty({
    description: 'Whether provider supports webhooks',
    example: true,
  })
  @IsBoolean()
  supports_webhooks: boolean;

  @ApiPropertyOptional({
    description: 'Array of webhook event types',
    example: ['delivered', 'opened', 'clicked', 'bounced'],
  })
  @IsArray()
  @IsOptional()
  webhook_events?: string[];

  @ApiPropertyOptional({
    description: 'Webhook verification method',
    enum: ['signature', 'token', 'ip_whitelist', 'sns_signature'],
    example: 'signature',
  })
  @IsString()
  @IsOptional()
  webhook_verification_method?: string;

  @ApiPropertyOptional({
    description: 'Link to provider documentation',
    example: 'https://docs.provider.com/api',
  })
  @IsUrl()
  @IsOptional()
  documentation_url?: string;

  @ApiPropertyOptional({
    description: 'URL to provider logo',
    example: 'https://cdn.provider.com/logo.png',
  })
  @IsUrl()
  @IsOptional()
  logo_url?: string;
}

/**
 * DTO for updating a provider (ADMIN ONLY)
 */
export class UpdateProviderDto {
  @ApiPropertyOptional({
    description: 'Display name for provider',
    example: 'Custom SMTP Server',
  })
  @IsString()
  @IsOptional()
  provider_name?: string;

  @ApiPropertyOptional({
    description: 'JSON Schema for credentials validation',
  })
  @IsObject()
  @IsOptional()
  credentials_schema?: object;

  @ApiPropertyOptional({
    description: 'JSON Schema for configuration validation',
  })
  @IsObject()
  @IsOptional()
  config_schema?: object;

  @ApiPropertyOptional({
    description: 'Default configuration values',
  })
  @IsObject()
  @IsOptional()
  default_config?: object;

  @ApiPropertyOptional({
    description: 'Whether provider supports webhooks',
  })
  @IsBoolean()
  @IsOptional()
  supports_webhooks?: boolean;

  @ApiPropertyOptional({
    description: 'Array of webhook event types',
  })
  @IsArray()
  @IsOptional()
  webhook_events?: string[];

  @ApiPropertyOptional({
    description: 'Webhook verification method',
  })
  @IsString()
  @IsOptional()
  webhook_verification_method?: string;

  @ApiPropertyOptional({
    description: 'Link to provider documentation',
  })
  @IsUrl()
  @IsOptional()
  documentation_url?: string;

  @ApiPropertyOptional({
    description: 'URL to provider logo',
  })
  @IsUrl()
  @IsOptional()
  logo_url?: string;

  @ApiPropertyOptional({
    description: 'Whether provider is active',
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

/**
 * DTO for filtering providers
 */
export class FilterProvidersDto {
  @ApiPropertyOptional({
    description: 'Filter by provider type',
    enum: ProviderType,
  })
  @IsEnum(ProviderType)
  @IsOptional()
  type?: ProviderType;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Include system providers',
    example: true,
  })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  @IsOptional()
  include_system?: boolean;
}
