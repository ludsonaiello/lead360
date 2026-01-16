import {
  IsString,
  IsEmail,
  IsBoolean,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  MinLength,
  MaxLength,
  Matches,
  IsDateString,
  IsArray,
  ValidateNested,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ========== TENANT MANAGEMENT DTOs ==========

export class CreateTenantManuallyDto {
  @ApiProperty({ example: 'acme-roofing', pattern: '^[a-z0-9-]{3,63}$' })
  @IsString()
  @MinLength(3)
  @MaxLength(63)
  @Matches(/^[a-z0-9-]+$/, { message: 'Subdomain must contain only lowercase letters, numbers, and hyphens' })
  subdomain: string;

  @ApiProperty({ example: 'Acme Roofing LLC' })
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  business_name: string;

  @ApiPropertyOptional({ example: 'LLC', enum: ['LLC', 'Corporation', 'Sole Proprietorship', 'Partnership'] })
  @IsOptional()
  @IsString()
  business_entity_type?: string;

  @ApiPropertyOptional({ example: 'NY' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  state_of_registration?: string;

  @ApiPropertyOptional({ example: '12-3456789' })
  @IsOptional()
  @IsString()
  ein?: string;

  @ApiProperty({ example: 'owner@acme-roofing.com' })
  @IsEmail()
  owner_email: string;

  @ApiProperty({ example: 'SecurePass123!' })
  @IsString()
  @MinLength(8)
  owner_password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  owner_first_name: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  owner_last_name: string;

  @ApiPropertyOptional({ example: '5551234567' })
  @IsOptional()
  @IsString()
  owner_phone?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  skip_email_verification?: boolean;

  @ApiPropertyOptional({
    example: ['uuid-of-industry-1', 'uuid-of-industry-2'],
    type: [String],
    description: 'Array of industry IDs (tenant can have multiple industries)'
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  industry_ids?: string[];

  @ApiPropertyOptional({ example: '11-25', enum: ['1-5', '6-10', '11-25', '26-50', '51-100', '101-250', '251+'] })
  @IsOptional()
  @IsEnum(['1-5', '6-10', '11-25', '26-50', '51-100', '101-250', '251+'])
  business_size?: string;

  @ApiPropertyOptional({
    example: 'uuid-of-subscription-plan',
    description: 'Subscription plan ID (defaults to platform default plan if not provided)'
  })
  @IsOptional()
  @IsUUID('all')
  subscription_plan_id?: string;

  @ApiPropertyOptional({
    example: 'active',
    enum: ['trial', 'active', 'past_due', 'canceled'],
    description: 'Subscription status (defaults to "trial" if not provided)'
  })
  @IsOptional()
  @IsEnum(['trial', 'active', 'past_due', 'canceled'])
  subscription_status?: string;

  @ApiPropertyOptional({
    example: '2026-02-15T00:00:00Z',
    description: 'Trial end date (only applicable if subscription_status is "trial")'
  })
  @IsOptional()
  @IsDateString()
  trial_end_date?: string;

  @ApiPropertyOptional({
    example: 'monthly',
    enum: ['monthly', 'annual'],
    description: 'Billing cycle (only applicable if subscription_status is "active")'
  })
  @IsOptional()
  @IsEnum(['monthly', 'annual'])
  billing_cycle?: string;

  @ApiPropertyOptional({
    example: '2026-02-15T00:00:00Z',
    description: 'Next billing date (only applicable if subscription_status is "active")'
  })
  @IsOptional()
  @IsDateString()
  next_billing_date?: string;
}

export class SuspendTenantDto {
  @ApiPropertyOptional({ example: 'Payment overdue' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class TenantListFiltersDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ enum: ['active', 'suspended', 'deleted'] })
  @IsOptional()
  @IsEnum(['active', 'suspended', 'deleted'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  created_from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  created_to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by industry IDs (shows tenants with ANY of these industries)',
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  industry_ids?: string[];

  @ApiPropertyOptional({ enum: ['1-5', '6-10', '11-25', '26-50', '51-100', '101-250', '251+'] })
  @IsOptional()
  @IsEnum(['1-5', '6-10', '11-25', '26-50', '51-100', '101-250', '251+'])
  business_size?: string;
}

// ========== IMPERSONATION DTOs ==========

export class StartImpersonationDto {
  @ApiProperty({ example: 'user-uuid-here' })
  @IsUUID()
  user_id: string;
}

export class EndImpersonationDto {
  @ApiProperty({ example: '64charhextoken...' })
  @IsString()
  @MinLength(64)
  @MaxLength(64)
  session_token: string;
}

// ========== FEATURE FLAG DTOs ==========

export class UpdateFeatureFlagDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;
}

// ========== MAINTENANCE MODE DTOs ==========

export class UpdateMaintenanceModeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;

  @ApiPropertyOptional({ enum: ['immediate', 'scheduled'] })
  @IsOptional()
  @IsEnum(['immediate', 'scheduled'])
  mode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  start_time?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  end_time?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({ description: 'Comma-separated IP addresses' })
  @IsOptional()
  @IsString()
  allowed_ips?: string;
}

// ========== SYSTEM SETTINGS DTOs ==========

export class UpdateSystemSettingDto {
  @ApiProperty({ example: 'max_file_upload_size_mb' })
  @IsString()
  key: string;

  @ApiProperty({ example: 15 })
  value: any; // Can be string, number, boolean, or object
}

export class BulkUpdateSystemSettingsDto {
  @ApiProperty({ type: [UpdateSystemSettingDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateSystemSettingDto)
  settings: UpdateSystemSettingDto[];
}

// ========== EXPORT DTOs ==========

export class ExportRequestDto {
  @ApiProperty({ enum: ['csv', 'pdf'] })
  @IsEnum(['csv', 'pdf'])
  format: string;

  @ApiPropertyOptional()
  @IsOptional()
  filters?: any; // JSON filters vary by export type
}

export class ExportTenantsDto extends ExportRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  declare filters?: {
    status?: 'active' | 'suspended' | 'deleted';
    created_from?: string;
    created_to?: string;
  };
}

export class ExportUsersDto extends ExportRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  declare filters?: {
    tenant_id?: string;
    is_active?: boolean;
  };
}

export class ExportAuditLogsDto extends ExportRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  declare filters?: {
    tenant_id?: string;
    entity_type?: string;
    action_type?: string;
    created_from?: string;
    created_to?: string;
    limit?: number;
  };
}

// ========== USER MANAGEMENT DTOs ==========

export class UserListFiltersDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  tenant_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ enum: ['active', 'inactive', 'deleted'] })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'deleted'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  last_login_from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  last_login_to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

// ========== INDUSTRY DTOs ==========

export class CreateIndustryDto {
  @ApiProperty({ example: 'Pool Services' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Pool installation, maintenance, and repair services' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateIndustryDto {
  @ApiPropertyOptional({ example: 'Pool Services' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Pool installation, maintenance, and repair services' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
