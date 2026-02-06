import {
  IsIn,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * TenantComparisonQueryDto
 *
 * Query parameters for comparing tenants by metric
 * Supports metric selection, result limiting, and date range filtering
 */
export class TenantComparisonQueryDto {
  @ApiProperty({
    enum: ['quote_count', 'revenue', 'conversion_rate', 'avg_quote_value'],
    required: true,
    description: 'Metric to compare tenants by',
    example: 'revenue',
  })
  @IsIn(['quote_count', 'revenue', 'conversion_rate', 'avg_quote_value'])
  metric: 'quote_count' | 'revenue' | 'conversion_rate' | 'avg_quote_value';

  @ApiProperty({
    default: 10,
    minimum: 1,
    maximum: 50,
    description: 'Number of top tenants to return',
    required: false,
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10;

  @ApiProperty({
    required: false,
    description: 'Start date in ISO 8601 format',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiProperty({
    required: false,
    description: 'End date in ISO 8601 format',
    example: '2024-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;
}
