import { ApiProperty } from '@nestjs/swagger';

export class DataPointDto {
  @ApiProperty({ example: '2024-01-15', description: 'Date key (format depends on interval)' })
  date: string;

  @ApiProperty({ example: 45, description: 'Number of quotes in this period' })
  count: number;

  @ApiProperty({ example: 125000.5, description: 'Total revenue in this period' })
  revenue: number;
}

export class TrendSummaryDto {
  @ApiProperty({ example: 543, description: 'Total quotes across all periods' })
  total_quotes: number;

  @ApiProperty({ example: 1250000.0, description: 'Total revenue across all periods' })
  total_revenue: number;

  @ApiProperty({ example: 27.15, description: 'Average quotes per interval' })
  avg_per_interval: number;
}

export class QuoteTrendsResponseDto {
  @ApiProperty({ type: [DataPointDto], description: 'Time series data points' })
  data_points: DataPointDto[];

  @ApiProperty({ example: 'day', enum: ['day', 'week', 'month'], description: 'Interval used for grouping' })
  interval: string;

  @ApiProperty({ type: TrendSummaryDto })
  summary: TrendSummaryDto;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Start date of period' })
  date_from: string;

  @ApiProperty({ example: '2024-01-31T23:59:59.999Z', description: 'End date of period' })
  date_to: string;
}
