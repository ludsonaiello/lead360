import { ApiProperty } from '@nestjs/swagger';

export class GlobalStatsDto {
  @ApiProperty({
    example: 145,
    description: 'Total number of unique tenants with quotes',
  })
  total_tenants: number;

  @ApiProperty({ example: 120, description: 'Number of active tenants' })
  active_tenants: number;

  @ApiProperty({ example: 5432, description: 'Total number of quotes created' })
  total_quotes: number;

  @ApiProperty({
    example: 1234567.89,
    description: 'Total revenue from accepted quotes',
  })
  total_revenue: number;

  @ApiProperty({ example: 2500.0, description: 'Average quote value' })
  avg_quote_value: number;

  @ApiProperty({ example: 42.5, description: 'Conversion rate percentage' })
  conversion_rate: number;
}

export class TenantSummaryDto {
  @ApiProperty({ example: 'uuid-123', description: 'Tenant ID' })
  tenant_id: string;

  @ApiProperty({ example: 'Acme Roofing', description: 'Company name' })
  company_name: string;

  @ApiProperty({ example: 125000.5, description: 'Total revenue' })
  revenue: number;

  @ApiProperty({ example: 45, description: 'Number of quotes' })
  quote_count: number;
}

export class TenantBreakdownDto {
  @ApiProperty({
    type: [TenantSummaryDto],
    description: 'Top 10 tenants by revenue',
  })
  top_tenants_by_revenue: TenantSummaryDto[];

  @ApiProperty({
    type: [TenantSummaryDto],
    description: 'Top 10 tenants by quote count',
  })
  top_tenants_by_quote_count: TenantSummaryDto[];

  @ApiProperty({
    example: 12,
    description: 'Number of new tenants in this period',
  })
  new_tenants_this_period: number;
}

export class TrendsDto {
  @ApiProperty({
    example: '+15.2%',
    description: 'Quote volume change vs previous period',
  })
  quote_velocity: string;

  @ApiProperty({ example: '+8.3%', description: 'Average quote value change' })
  avg_value_change: string;

  @ApiProperty({ example: '-2.1%', description: 'Conversion rate change' })
  conversion_rate_change: string;
}

export class DashboardOverviewResponseDto {
  @ApiProperty({ type: GlobalStatsDto })
  global_stats: GlobalStatsDto;

  @ApiProperty({ type: TenantBreakdownDto })
  tenant_breakdown: TenantBreakdownDto;

  @ApiProperty({ type: TrendsDto })
  trends: TrendsDto;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Start date of period',
  })
  date_from: string;

  @ApiProperty({
    example: '2024-01-31T23:59:59.999Z',
    description: 'End date of period',
  })
  date_to: string;
}
