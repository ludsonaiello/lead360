import { ApiProperty } from '@nestjs/swagger';

export class RevenueGroupDto {
  @ApiProperty({
    example: 'vendor-uuid',
    description: 'Group ID (vendor or tenant)',
  })
  group_id: string;

  @ApiProperty({ example: 'ABC Roofing', description: 'Group name' })
  group_name: string;

  @ApiProperty({
    example: 125000.5,
    description: 'Total revenue for this group',
  })
  revenue: number;

  @ApiProperty({ example: 45, description: 'Number of quotes for this group' })
  quote_count: number;
}

export class RevenueTrendPointDto {
  @ApiProperty({ example: '2024-01-15', description: 'Date' })
  date: string;

  @ApiProperty({ example: 12500.0, description: 'Revenue for this date' })
  revenue: number;
}

export class RevenueAnalyticsResponseDto {
  @ApiProperty({
    example: 1234567.89,
    description: 'Total revenue across all groups',
  })
  total_revenue: number;

  @ApiProperty({
    type: [RevenueGroupDto],
    description: 'Revenue grouped by vendor or tenant',
  })
  revenue_by_group: RevenueGroupDto[];

  @ApiProperty({
    type: [RevenueGroupDto],
    description: 'Top 10 revenue sources',
  })
  top_revenue_sources: RevenueGroupDto[];

  @ApiProperty({
    type: [RevenueTrendPointDto],
    description: 'Daily revenue trend',
  })
  revenue_trend: RevenueTrendPointDto[];

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
