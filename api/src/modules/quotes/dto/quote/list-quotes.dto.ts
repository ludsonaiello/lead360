import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuoteStatus } from './update-quote-status.dto';

export class ListQuotesDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Page number (default: 1)',
    default: 1,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: 'Items per page (default: 20, max: 100)',
    default: 20,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: QuoteStatus,
    example: QuoteStatus.DRAFT,
    description: 'Filter by quote status',
  })
  @IsEnum(QuoteStatus)
  @IsOptional()
  status?: QuoteStatus;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Filter by vendor UUID',
  })
  @IsString()
  @IsOptional()
  vendor_id?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Filter by lead UUID',
  })
  @IsString()
  @IsOptional()
  lead_id?: string;

  @ApiPropertyOptional({
    example: 'kitchen',
    description: 'Search in quote_number, title, customer name, items',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'Filter quotes created on or after this date (YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  created_from?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'Filter quotes created on or before this date (YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  created_to?: string;

  @ApiPropertyOptional({
    example: 'created_at',
    description: 'Sort field (created_at, updated_at, quote_number, total)',
    default: 'created_at',
  })
  @IsString()
  @IsOptional()
  sort_by?: string = 'created_at';

  @ApiPropertyOptional({
    example: 'desc',
    description: 'Sort direction (asc or desc)',
    default: 'desc',
  })
  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sort_order?: 'asc' | 'desc' = 'desc';
}
