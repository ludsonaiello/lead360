import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsBoolean, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';

/**
 * GetDashboardOverviewDto
 *
 * Query parameters for dashboard overview
 */
export class GetDashboardOverviewDto {
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
    description: 'Filter by quote status',
    example: 'sent',
    required: false,
    enum: ['draft', 'pending_approval', 'ready', 'sent', 'delivered', 'read', 'opened', 'downloaded', 'approved', 'started', 'concluded', 'denied', 'lost', 'email_failed'],
  })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({
    description: 'Compare to previous period',
    example: true,
    required: false,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  compare_to_previous?: boolean = false;
}

/**
 * StatusMetricsDto
 *
 * Metrics for a specific quote status
 */
export class StatusMetricsDto {
  @ApiProperty({ description: 'Quote status', example: 'approved' })
  status: string;

  @ApiProperty({ description: 'Number of quotes', example: 45 })
  count: number;

  @ApiProperty({ description: 'Total revenue', example: 125000.50 })
  total_revenue: number;

  @ApiProperty({ description: 'Average quote value', example: 2777.79 })
  avg_value: number;
}

/**
 * PeriodComparisonDto
 *
 * Comparison with previous period
 */
export class PeriodComparisonDto {
  @ApiProperty({ description: 'Current period value', example: 50 })
  current: number;

  @ApiProperty({ description: 'Previous period value', example: 42 })
  previous: number;

  @ApiProperty({ description: 'Change percentage', example: 19.05 })
  change_percent: number;

  @ApiProperty({ description: 'Trend direction', example: 'up', enum: ['up', 'down', 'stable'] })
  trend: 'up' | 'down' | 'stable';
}

/**
 * DashboardOverviewResponseDto
 *
 * Complete dashboard overview response
 */
export class DashboardOverviewResponseDto {
  @ApiProperty({ description: 'Total number of quotes', example: 150 })
  total_quotes: number;

  @ApiProperty({ description: 'Total amount generated (sent/read quotes, excluding drafts)', example: 450000.00 })
  total_generated: number;

  @ApiProperty({ description: 'Total revenue (approved quotes only)', example: 189000.00 })
  total_revenue: number;

  @ApiProperty({ description: 'Average quote value (excluding drafts)', example: 3000.00 })
  avg_quote_value: number;

  @ApiProperty({ description: 'Total amount sent (status >= sent, excluding drafts)', example: 380000.00 })
  amount_sent: number;

  @ApiProperty({ description: 'Total amount lost (status = lost)', example: 45000.00 })
  amount_lost: number;

  @ApiProperty({ description: 'Total amount denied (status = denied)', example: 32000.00 })
  amount_denied: number;

  @ApiProperty({ description: 'Total amount pending approval (status = pending_approval)', example: 28000.00 })
  amount_pending_approval: number;

  @ApiProperty({ description: 'Conversion rate (approved / sent)', example: 42.5 })
  conversion_rate: number;

  @ApiProperty({ description: 'Metrics by status', type: [StatusMetricsDto] })
  by_status: StatusMetricsDto[];

  @ApiProperty({
    description: 'Quote velocity comparison',
    type: PeriodComparisonDto,
    required: false,
  })
  velocity_comparison?: PeriodComparisonDto;

  @ApiProperty({ description: 'Date range start', example: '2024-01-01T00:00:00.000Z' })
  date_from: string;

  @ApiProperty({ description: 'Date range end', example: '2024-01-31T23:59:59.999Z' })
  date_to: string;
}
