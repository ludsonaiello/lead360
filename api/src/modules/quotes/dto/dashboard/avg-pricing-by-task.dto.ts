import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

/**
 * GetAvgPricingByTaskDto
 *
 * Query parameters for pricing benchmarks
 */
export class GetAvgPricingByTaskDto {
  @ApiProperty({
    description: 'Start date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiProperty({
    description: 'End date (ISO 8601)',
    example: '2024-01-31T23:59:59.999Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;
}

/**
 * TaskPricingBenchmarkDto
 *
 * Pricing benchmark for a task/item type
 */
export class TaskPricingBenchmarkDto {
  @ApiProperty({
    description: 'Task/item title',
    example: 'Concrete Foundation',
  })
  task_title: string;

  @ApiProperty({ description: 'Number of times used', example: 45 })
  usage_count: number;

  @ApiProperty({ description: 'Average price', example: 5000.0 })
  avg_price: number;

  @ApiProperty({ description: 'Minimum price', example: 3500.0 })
  min_price: number;

  @ApiProperty({ description: 'Maximum price', example: 7500.0 })
  max_price: number;

  @ApiProperty({ description: 'Median price', example: 4800.0 })
  median_price: number;

  @ApiProperty({
    description: 'Associated library item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  library_item_id: string | null;
}

/**
 * AvgPricingByTaskResponseDto
 *
 * Pricing benchmarks response
 */
export class AvgPricingByTaskResponseDto {
  @ApiProperty({
    description: 'Pricing benchmarks by task',
    type: [TaskPricingBenchmarkDto],
  })
  benchmarks: TaskPricingBenchmarkDto[];

  @ApiProperty({
    description: 'Date range start',
    example: '2024-01-01T00:00:00.000Z',
  })
  date_from: string;

  @ApiProperty({
    description: 'Date range end',
    example: '2024-01-31T23:59:59.999Z',
  })
  date_to: string;
}
