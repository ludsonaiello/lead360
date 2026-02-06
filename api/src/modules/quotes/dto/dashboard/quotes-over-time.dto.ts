import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsEnum } from 'class-validator';

/**
 * GetQuotesOverTimeDto
 *
 * Query parameters for time series data
 */
export class GetQuotesOverTimeDto {
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

  @ApiProperty({
    description: 'Grouping interval',
    example: 'day',
    enum: ['day', 'week', 'month'],
    default: 'day',
    required: false,
  })
  @IsOptional()
  @IsEnum(['day', 'week', 'month'])
  interval?: 'day' | 'week' | 'month' = 'day';
}

/**
 * TimeSeriesDataPointDto
 *
 * Single data point in time series
 */
export class TimeSeriesDataPointDto {
  @ApiProperty({ description: 'Date/period', example: '2024-01-15' })
  date: string;

  @ApiProperty({ description: 'Number of quotes created', example: 12 })
  count: number;

  @ApiProperty({ description: 'Total value of quotes', example: 35000.0 })
  total_value: number;

  @ApiProperty({ description: 'Number approved', example: 5 })
  approved_count: number;

  @ApiProperty({ description: 'Number rejected', example: 2 })
  rejected_count: number;
}

/**
 * QuotesOverTimeResponseDto
 *
 * Time series response
 */
export class QuotesOverTimeResponseDto {
  @ApiProperty({
    description: 'Time series data',
    type: [TimeSeriesDataPointDto],
  })
  data: TimeSeriesDataPointDto[];

  @ApiProperty({ description: 'Grouping interval', example: 'day' })
  interval: string;

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
