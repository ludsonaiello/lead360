import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsISO8601 } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query parameters for pricing benchmarks endpoint
 */
export class PricingBenchmarksQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by item title (case-insensitive partial match)',
    example: 'roofing',
  })
  @IsOptional()
  @IsString()
  item_title_contains?: string;

  @ApiPropertyOptional({
    description: 'Minimum tenant count for privacy (default: 5)',
    example: 5,
    minimum: 2,
    maximum: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(50)
  @Type(() => Number)
  min_tenant_count?: number;

  @ApiPropertyOptional({
    description: 'Start date (ISO 8601 format)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601 format)',
    example: '2024-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsISO8601()
  date_to?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results to return (default: 50)',
    example: 50,
    minimum: 1,
    maximum: 200,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  limit?: number;
}

/**
 * Pricing statistics for a single item benchmark
 */
export class PricingStatsDto {
  @ApiProperty({
    description: 'Average price across all instances',
    example: 2500.0,
  })
  avg_price: number;

  @ApiProperty({
    description: 'Minimum price found',
    example: 1200.0,
  })
  min_price: number;

  @ApiProperty({
    description: 'Maximum price found',
    example: 4500.0,
  })
  max_price: number;

  @ApiProperty({
    description: 'Median price (50th percentile)',
    example: 2350.0,
  })
  median_price: number;

  @ApiProperty({
    description: 'Standard deviation of prices',
    example: 850.5,
  })
  std_deviation: number;
}

/**
 * Single pricing benchmark item
 */
export class PricingBenchmarkItemDto {
  @ApiProperty({
    description: 'Item title (normalized: lowercase, trimmed)',
    example: 'asphalt shingle installation',
  })
  task_title: string;

  @ApiProperty({
    description: 'Number of unique tenants using this item (anonymized)',
    example: 12,
  })
  tenant_count: number;

  @ApiProperty({
    description: 'Total number of times this item was used',
    example: 45,
  })
  usage_count: number;

  @ApiProperty({
    description: 'Pricing statistics for this item',
    type: PricingStatsDto,
  })
  pricing: PricingStatsDto;

  @ApiProperty({
    description: 'Price variance classification',
    enum: ['low', 'medium', 'high'],
    example: 'medium',
  })
  price_variance: 'low' | 'medium' | 'high';
}

/**
 * Response for pricing benchmarks endpoint
 */
export class PricingBenchmarksResponseDto {
  @ApiProperty({
    description: 'List of pricing benchmarks',
    type: [PricingBenchmarkItemDto],
  })
  benchmarks: PricingBenchmarkItemDto[];

  @ApiProperty({
    description: 'Privacy notice for data anonymization',
    example: 'Data anonymized, minimum 5 tenants per benchmark',
  })
  privacy_notice: string;

  @ApiProperty({
    description: 'Date range start (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  date_from: string;

  @ApiProperty({
    description: 'Date range end (ISO 8601)',
    example: '2024-01-31T23:59:59.999Z',
  })
  date_to: string;

  @ApiProperty({
    description: 'Minimum tenant count applied for privacy',
    example: 5,
  })
  min_tenant_count: number;

  @ApiProperty({
    description: 'Total number of benchmarks available (may be more than returned)',
    example: 150,
  })
  total_count: number;

  @ApiProperty({
    description: 'Number of benchmarks returned',
    example: 50,
  })
  returned_count: number;
}
