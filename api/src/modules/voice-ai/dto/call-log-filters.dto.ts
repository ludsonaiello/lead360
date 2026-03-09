import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Sprint BAS15: Tenant call log filters
 * Query parameters for filtering call logs for a single tenant
 */
export class CallLogFiltersDto {
  @ApiPropertyOptional({
    description: 'Start date (ISO 8601)',
    example: '2026-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601)',
    example: '2026-01-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Filter by call outcome',
    enum: ['lead_created', 'transferred', 'abandoned'],
  })
  @IsOptional()
  @IsString()
  outcome?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Results per page',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

/**
 * Sprint BAS15: Admin call log filters
 * Query parameters for filtering call logs across all tenants (admin only)
 */
export class AdminCallLogFiltersDto extends CallLogFiltersDto {
  @ApiPropertyOptional({
    description: 'Filter by tenant ID (optional for cross-tenant queries)',
  })
  @IsOptional()
  @IsString()
  tenantId?: string;
}

/**
 * Sprint BAS15: Admin usage report filters
 * Query parameters for aggregate usage reports (admin only)
 */
export class AdminUsageReportFiltersDto {
  @ApiPropertyOptional({ description: 'Filter by tenant ID' })
  @IsOptional()
  @IsString()
  tenant_id?: string;

  @ApiPropertyOptional({
    description: 'Start date (ISO 8601)',
    example: '2026-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601)',
    example: '2026-01-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Filter by provider type',
    enum: ['STT', 'LLM', 'TTS'],
  })
  @IsOptional()
  @IsString()
  provider_type?: string;
}
