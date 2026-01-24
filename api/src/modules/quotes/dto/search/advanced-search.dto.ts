import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsArray, IsEnum, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * AdvancedSearchDto
 *
 * Query parameters for advanced quote search
 */
export class AdvancedSearchDto {
  @ApiProperty({ description: 'General search query', example: 'foundation', required: false })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiProperty({ description: 'Quote number filter', example: 'Q-2024-001', required: false })
  @IsOptional()
  @IsString()
  quote_number?: string;

  @ApiProperty({ description: 'Title filter', example: 'Home renovation', required: false })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({ description: 'Customer name filter', example: 'John Smith', required: false })
  @IsOptional()
  @IsString()
  customer_name?: string;

  @ApiProperty({ description: 'City filter', example: 'Austin', required: false })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiProperty({ description: 'Item title search', example: 'concrete', required: false })
  @IsOptional()
  @IsString()
  item_title?: string;

  @ApiProperty({ description: 'Status filters', example: ['draft', 'sent'], required: false, type: [String] })
  @IsOptional()
  @IsArray()
  status?: string[];

  @ApiProperty({ description: 'Vendor ID filter', example: '123e4567-e89b-12d3-a456-426614174000', required: false })
  @IsOptional()
  @IsString()
  vendor_id?: string;

  @ApiProperty({ description: 'Minimum amount', example: 1000, required: false })
  @IsOptional()
  @Type(() => Number)
  amount_min?: number;

  @ApiProperty({ description: 'Maximum amount', example: 50000, required: false })
  @IsOptional()
  @Type(() => Number)
  amount_max?: number;

  @ApiProperty({ description: 'Date from', example: '2024-01-01', required: false })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiProperty({ description: 'Date to', example: '2024-12-31', required: false })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiProperty({ description: 'Sort field', example: 'created_at', enum: ['created_at', 'quote_number', 'total', 'title'], required: false, default: 'created_at' })
  @IsOptional()
  @IsEnum(['created_at', 'quote_number', 'total', 'title'])
  sort_by?: string = 'created_at';

  @ApiProperty({ description: 'Sort order', example: 'desc', enum: ['asc', 'desc'], required: false, default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sort_order?: 'asc' | 'desc' = 'desc';

  @ApiProperty({ description: 'Page number', example: 1, required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: 'Results per page', example: 20, required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * SearchResultDto
 *
 * Single search result
 */
export class SearchResultDto {
  @ApiProperty({ description: 'Quote ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ description: 'Quote number', example: 'Q-2024-001' })
  quote_number: string;

  @ApiProperty({ description: 'Title', example: 'Home Renovation Project' })
  title: string;

  @ApiProperty({ description: 'Status', example: 'sent' })
  status: string;

  @ApiProperty({ description: 'Total amount', example: 25000.00 })
  total: number;

  @ApiProperty({ description: 'Customer name', example: 'John Smith', nullable: true })
  customer_name: string | null;

  @ApiProperty({ description: 'City', example: 'Austin', nullable: true })
  city: string | null;

  @ApiProperty({ description: 'Created at', example: '2024-01-20T10:30:00.000Z' })
  created_at: string;
}

/**
 * AdvancedSearchResponseDto
 *
 * Paginated search response
 */
export class AdvancedSearchResponseDto {
  @ApiProperty({ description: 'Search results', type: [SearchResultDto] })
  results: SearchResultDto[];

  @ApiProperty({ description: 'Pagination metadata', example: { page: 1, limit: 20, total: 150, total_pages: 8 } })
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}
