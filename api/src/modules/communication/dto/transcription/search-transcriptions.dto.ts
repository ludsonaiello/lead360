import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Search Transcriptions Query DTO
 *
 * Query parameters for full-text search across transcriptions
 */
export class SearchTranscriptionsDto {
  @ApiProperty({
    description: 'Search query (natural language)',
    example: 'quote estimate pricing',
    required: true,
  })
  @IsString()
  query: string;

  @ApiProperty({
    description: 'Page number (1-indexed)',
    example: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Results per page (max 100)',
    example: 20,
    default: 20,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * List Transcriptions Query DTO
 *
 * Query parameters for listing transcriptions with filters
 */
export class ListTranscriptionsDto {
  @ApiProperty({
    description: 'Page number (1-indexed)',
    example: 1,
    default: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Results per page (max 100)',
    example: 20,
    default: 20,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({
    description: 'Filter by status',
    example: 'completed',
    required: false,
    enum: ['queued', 'processing', 'completed', 'failed'],
  })
  @IsOptional()
  @IsString()
  status?: string;
}
