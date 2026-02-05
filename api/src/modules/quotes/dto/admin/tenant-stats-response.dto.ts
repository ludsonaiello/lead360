import { ApiProperty } from '@nestjs/swagger';

/**
 * QuotesByStatusDto
 *
 * Quote counts grouped by status
 */
export class QuotesByStatusDto {
  @ApiProperty({ example: 12, description: 'Number of draft quotes' })
  draft: number;

  @ApiProperty({ example: 34, description: 'Number of sent quotes' })
  sent: number;

  @ApiProperty({ example: 18, description: 'Number of accepted quotes' })
  accepted: number;

  @ApiProperty({ example: 5, description: 'Number of rejected quotes' })
  rejected: number;
}

/**
 * RevenueDto
 *
 * Revenue statistics
 */
export class RevenueDto {
  @ApiProperty({ example: 125000.5, description: 'Total revenue' })
  total: number;

  @ApiProperty({
    example: 6944.47,
    description: 'Average revenue per quote',
  })
  average_per_quote: number;
}

/**
 * TopItemDto
 *
 * Top quoted item
 */
export class TopItemDto {
  @ApiProperty({ example: 'Roof Installation', description: 'Item title' })
  title: string;

  @ApiProperty({ example: 45, description: 'Number of times quoted' })
  usage_count: number;

  @ApiProperty({ example: 12500.0, description: 'Average price' })
  avg_price: number;
}

/**
 * TenantStatisticsDto
 *
 * Detailed tenant statistics
 */
export class TenantStatisticsDto {
  @ApiProperty({ example: 145, description: 'Total quotes in period' })
  total_quotes: number;

  @ApiProperty({ type: QuotesByStatusDto, description: 'Quotes by status' })
  quotes_by_status: QuotesByStatusDto;

  @ApiProperty({ type: RevenueDto, description: 'Revenue metrics' })
  revenue: RevenueDto;

  @ApiProperty({ example: 42.5, description: 'Conversion rate (percentage)' })
  conversion_rate: number;

  @ApiProperty({ example: 6944.47, description: 'Average quote value' })
  avg_quote_value: number;

  @ApiProperty({
    type: [TopItemDto],
    description: 'Top 10 quoted items',
    isArray: true,
  })
  top_items: TopItemDto[];
}

/**
 * TenantTrendsDto
 *
 * Trend comparisons vs previous period
 */
export class TenantTrendsDto {
  @ApiProperty({
    example: '+15.2%',
    description: 'Quote volume change (percentage with +/- prefix)',
  })
  quote_volume_change: string;

  @ApiProperty({
    example: '+8.3%',
    description: 'Revenue change (percentage with +/- prefix)',
  })
  revenue_change: string;
}

/**
 * DateRangeDto
 *
 * Date range for the query
 */
export class DateRangeDto {
  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Start date (ISO 8601)',
  })
  from: string;

  @ApiProperty({
    example: '2024-01-31T23:59:59.999Z',
    description: 'End date (ISO 8601)',
  })
  to: string;
}

/**
 * TenantStatsResponseDto
 *
 * Response for tenant quote statistics
 */
export class TenantStatsResponseDto {
  @ApiProperty({ example: 'abc-123-def-456', description: 'Tenant UUID' })
  tenant_id: string;

  @ApiProperty({ example: 'Acme Roofing', description: 'Company name' })
  tenant_name: string;

  @ApiProperty({ type: DateRangeDto, description: 'Query period' })
  period: DateRangeDto;

  @ApiProperty({ type: TenantStatisticsDto, description: 'Detailed statistics' })
  statistics: TenantStatisticsDto;

  @ApiProperty({ type: TenantTrendsDto, description: 'Trend comparisons' })
  trends: TenantTrendsDto;
}
