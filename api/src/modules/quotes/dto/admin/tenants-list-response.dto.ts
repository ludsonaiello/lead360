import { ApiProperty } from '@nestjs/swagger';

/**
 * TenantQuoteStatsDto
 *
 * Quote statistics for a tenant
 */
export class TenantQuoteStatsDto {
  @ApiProperty({ example: 145, description: 'Total quotes all-time' })
  total_quotes: number;

  @ApiProperty({ example: 23, description: 'Quotes created in last 30 days' })
  quotes_last_30_days: number;

  @ApiProperty({
    example: 125000.5,
    description: 'Total revenue from accepted quotes',
  })
  total_revenue: number;

  @ApiProperty({ example: 42.5, description: 'Conversion rate (percentage)' })
  conversion_rate: number;
}

/**
 * TenantListItemDto
 *
 * Single tenant item in the list
 */
export class TenantListItemDto {
  @ApiProperty({ example: 'abc-123-def-456', description: 'Tenant UUID' })
  tenant_id: string;

  @ApiProperty({ example: 'Acme Roofing', description: 'Company name' })
  company_name: string;

  @ApiProperty({ example: 'acme-roofing', description: 'Subdomain' })
  subdomain: string;

  @ApiProperty({
    example: 'active',
    description: 'Subscription status (active, trial, suspended)',
  })
  subscription_status: string;

  @ApiProperty({ type: TenantQuoteStatsDto, description: 'Quote statistics' })
  quote_stats: TenantQuoteStatsDto;

  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Tenant creation date',
  })
  created_at: string;
}

/**
 * PaginationDto
 *
 * Pagination metadata
 */
export class PaginationDto {
  @ApiProperty({ example: 145, description: 'Total number of results' })
  total: number;

  @ApiProperty({ example: 1, description: 'Current page number (1-based)' })
  page: number;

  @ApiProperty({ example: 50, description: 'Results per page' })
  limit: number;

  @ApiProperty({ example: 3, description: 'Total number of pages' })
  total_pages: number;
}

/**
 * TenantListSummaryDto
 *
 * Summary statistics for tenant list
 */
export class TenantListSummaryDto {
  @ApiProperty({
    example: 145,
    description: 'Total tenants matching filter criteria',
  })
  total_tenants: number;

  @ApiProperty({
    example: 120,
    description: 'Total tenants with active subscription',
  })
  active_tenants: number;
}

/**
 * TenantsListResponseDto
 *
 * Response for listing tenants with quote activity
 */
export class TenantsListResponseDto {
  @ApiProperty({ type: [TenantListItemDto], description: 'List of tenants' })
  tenants: TenantListItemDto[];

  @ApiProperty({ type: PaginationDto, description: 'Pagination metadata' })
  pagination: PaginationDto;

  @ApiProperty({ type: TenantListSummaryDto, description: 'Summary statistics' })
  summary: TenantListSummaryDto;
}
