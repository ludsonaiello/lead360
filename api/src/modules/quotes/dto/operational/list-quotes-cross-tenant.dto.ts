import { ApiProperty } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ListQuotesCrossTenantQueryDto {
  @ApiProperty({
    description: 'Filter by tenant ID (optional)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsOptional()
  @IsString()
  tenant_id?: string;

  @ApiProperty({
    description: 'Filter by quote status (optional)',
    example: 'approved',
    required: false,
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({
    description: 'Search by quote number or customer name (optional)',
    example: 'QUOTE-2024-001',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter quotes created after this date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiProperty({
    description: 'Filter quotes created before this date (ISO 8601)',
    example: '2024-01-31T23:59:59.999Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 50,
    default: 50,
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class QuoteWithTenantDto {
  @ApiProperty({ description: 'Quote ID' })
  id: string;

  @ApiProperty({ description: 'Quote number' })
  quote_number: string;

  @ApiProperty({ description: 'Quote title' })
  title: string;

  @ApiProperty({ description: 'Quote status' })
  status: string;

  @ApiProperty({ description: 'Quote total amount' })
  total: number;

  @ApiProperty({ description: 'Created timestamp' })
  created_at: string;

  @ApiProperty({ description: 'Tenant information' })
  tenant: {
    id: string;
    company_name: string;
    subdomain: string;
  };

  @ApiProperty({ description: 'Customer name (optional)', required: false })
  customer_name?: string;
}

export class PaginationDto {
  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Items per page', example: 50 })
  limit: number;

  @ApiProperty({ description: 'Total number of items', example: 250 })
  total: number;

  @ApiProperty({ description: 'Total number of pages', example: 5 })
  total_pages: number;
}

export class CrossTenantQuotesResponseDto {
  @ApiProperty({
    description: 'Array of quotes with tenant information',
    type: [QuoteWithTenantDto],
  })
  quotes: QuoteWithTenantDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PaginationDto,
  })
  pagination: PaginationDto;

  @ApiProperty({
    description: 'Filters that were applied to the query',
    example: {
      tenant_id: '550e8400-e29b-41d4-a716-446655440000',
      status: 'approved',
    },
  })
  filters_applied: object;
}
