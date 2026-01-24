import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * GetTopItemsDto
 *
 * Query parameters for top items
 */
export class GetTopItemsDto {
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
    description: 'Number of top items to return',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

/**
 * TopItemDto
 *
 * Single top item entry
 */
export class TopItemDto {
  @ApiProperty({ description: 'Item title', example: 'Concrete Foundation' })
  title: string;

  @ApiProperty({ description: 'Usage count', example: 45 })
  usage_count: number;

  @ApiProperty({ description: 'Total revenue generated', example: 125000.00 })
  total_revenue: number;

  @ApiProperty({ description: 'Average price', example: 2777.78 })
  avg_price: number;

  @ApiProperty({
    description: 'Associated library item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  library_item_id: string | null;
}

/**
 * TopItemsResponseDto
 *
 * Top items response
 */
export class TopItemsResponseDto {
  @ApiProperty({ description: 'Top items by usage', type: [TopItemDto] })
  top_items: TopItemDto[];

  @ApiProperty({ description: 'Date range start', example: '2024-01-01T00:00:00.000Z' })
  date_from: string;

  @ApiProperty({ description: 'Date range end', example: '2024-01-31T23:59:59.999Z' })
  date_to: string;
}
