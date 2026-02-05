import { ApiProperty } from '@nestjs/swagger';
import { DateRangeDto } from './tenant-stats-response.dto';

/**
 * SupplementaryMetricsDto
 *
 * Additional metrics for context
 */
export class SupplementaryMetricsDto {
  @ApiProperty({ example: 145, description: 'Total quote count' })
  quote_count: number;

  @ApiProperty({ example: 42.5, description: 'Conversion rate (percentage)' })
  conversion_rate: number;

  @ApiProperty({ example: 6944.47, description: 'Average quote value' })
  avg_quote_value: number;
}

/**
 * RankingDto
 *
 * Single tenant ranking entry
 */
export class RankingDto {
  @ApiProperty({ example: 1, description: 'Rank (1-based, 1 = top)' })
  rank: number;

  @ApiProperty({ example: 'abc-123-def-456', description: 'Tenant UUID' })
  tenant_id: string;

  @ApiProperty({ example: 'Acme Roofing', description: 'Company name' })
  tenant_name: string;

  @ApiProperty({
    example: 125000.5,
    description: 'Metric value (varies by metric type)',
  })
  value: number;

  @ApiProperty({
    type: SupplementaryMetricsDto,
    description: 'Supplementary metrics for context',
  })
  supplementary: SupplementaryMetricsDto;
}

/**
 * ComparisonSummaryDto
 *
 * Platform-wide summary statistics
 */
export class ComparisonSummaryDto {
  @ApiProperty({ example: 145, description: 'Total tenants in comparison' })
  total_tenants: number;

  @ApiProperty({
    example: 15234.67,
    description: 'Platform-wide average for metric',
  })
  metric_average: number;

  @ApiProperty({
    example: 12500.0,
    description: 'Platform-wide median for metric',
  })
  metric_median: number;
}

/**
 * TenantComparisonResponseDto
 *
 * Response for tenant comparison by metric
 */
export class TenantComparisonResponseDto {
  @ApiProperty({
    example: 'revenue',
    description: 'Metric used for ranking',
    enum: ['quote_count', 'revenue', 'conversion_rate', 'avg_quote_value'],
  })
  metric: string;

  @ApiProperty({ type: DateRangeDto, description: 'Query period' })
  date_range: DateRangeDto;

  @ApiProperty({
    type: [RankingDto],
    description: 'Ranked tenants (top performers first)',
    isArray: true,
  })
  rankings: RankingDto[];

  @ApiProperty({
    type: ComparisonSummaryDto,
    description: 'Platform-wide summary',
  })
  summary: ComparisonSummaryDto;
}
