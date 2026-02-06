import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, IsDateString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Admin Call Filters DTO
 *
 * Query parameters for filtering calls across all tenants.
 * Supports multi-tenant aggregation with optional tenant filtering.
 *
 * @class AdminCallFiltersDto
 */
export class AdminCallFiltersDto {
  @ApiProperty({
    required: false,
    description: 'Filter by tenant ID (optional - defaults to all tenants)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  tenant_id?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by call status',
    enum: ['initiated', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer', 'busy', 'canceled'],
    example: 'completed',
  })
  @IsOptional()
  @IsString()
  @IsIn(['initiated', 'ringing', 'in_progress', 'completed', 'failed', 'no_answer', 'busy', 'canceled'])
  status?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by call direction',
    enum: ['inbound', 'outbound'],
    example: 'inbound',
  })
  @IsOptional()
  @IsString()
  @IsIn(['inbound', 'outbound'])
  direction?: 'inbound' | 'outbound';

  @ApiProperty({
    required: false,
    description: 'Filter by start date (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiProperty({
    required: false,
    description: 'Filter by end date (ISO 8601)',
    example: '2026-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiProperty({
    default: 1,
    description: 'Page number (1-indexed)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({
    default: 20,
    description: 'Number of results per page',
    example: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;
}
