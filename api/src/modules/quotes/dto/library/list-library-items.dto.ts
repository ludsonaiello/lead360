import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ListLibraryItemsDto {
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
    example: 50,
    description: 'Items per page (default: 50, max: 100)',
    default: 50,
  })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({
    example: true,
    description: 'Filter by active status (default: true shows only active)',
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  is_active?: boolean;

  @ApiPropertyOptional({
    example: 'drywall',
    description: 'Search in title, description',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Filter by unit measurement UUID',
  })
  @IsString()
  @IsOptional()
  @IsUUID()
  unit_measurement_id?: string;

  @ApiPropertyOptional({
    example: 'usage_count',
    description: 'Sort field (title, usage_count, last_used_at, created_at)',
    default: 'usage_count',
  })
  @IsString()
  @IsOptional()
  sort_by?: string = 'usage_count';

  @ApiPropertyOptional({
    example: 'desc',
    description: 'Sort direction (asc or desc)',
    default: 'desc',
  })
  @IsString()
  @IsOptional()
  sort_order?: 'asc' | 'desc' = 'desc';
}
