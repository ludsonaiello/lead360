import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * CallHistoryQueryDto
 *
 * Query parameters for paginated call history retrieval.
 *
 * Pagination Pattern:
 * - Page-based pagination (not cursor-based)
 * - Default: 20 records per page
 * - Maximum: 100 records per page (prevents performance issues)
 * - Returns metadata: total count, total pages, current page
 *
 * Example Usage:
 * GET /api/v1/communication/call?page=2&limit=50
 *
 * Response includes:
 * - data: Array of call records
 * - meta: { total, page, limit, totalPages }
 */
export class CallHistoryQueryDto {
  @ApiProperty({
    description: 'Page number (1-indexed)',
    required: false,
    default: 1,
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  page?: number = 1;

  @ApiProperty({
    description: 'Number of records per page',
    required: false,
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(100, { message: 'limit cannot exceed 100' })
  limit?: number = 20;
}
