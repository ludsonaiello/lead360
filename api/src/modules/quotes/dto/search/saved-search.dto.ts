import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject } from 'class-validator';

/**
 * SaveSearchDto
 *
 * Save a search for reuse
 */
export class SaveSearchDto {
  @ApiProperty({ description: 'Search name', example: 'High value quotes' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Search criteria',
    example: { amount_min: 10000, status: ['sent', 'read'] },
  })
  @IsObject()
  criteria: Record<string, any>;
}

/**
 * SavedSearchDto
 *
 * Saved search entry
 */
export class SavedSearchDto {
  @ApiProperty({
    description: 'Saved search ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({ description: 'Search name', example: 'High value quotes' })
  name: string;

  @ApiProperty({
    description: 'Search criteria',
    example: { amount_min: 10000, status: ['sent', 'read'] },
  })
  criteria: Record<string, any>;

  @ApiProperty({
    description: 'Created at',
    example: '2024-01-20T10:30:00.000Z',
  })
  created_at: string;
}

/**
 * SavedSearchesResponseDto
 *
 * List of saved searches
 */
export class SavedSearchesResponseDto {
  @ApiProperty({ description: 'Saved searches', type: [SavedSearchDto] })
  saved_searches: SavedSearchDto[];
}
