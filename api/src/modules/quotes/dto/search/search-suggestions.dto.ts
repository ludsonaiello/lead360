import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * GetSuggestionsDto
 *
 * Query parameters for autocomplete suggestions
 */
export class GetSuggestionsDto {
  @ApiProperty({ description: 'Search query', example: 'John' })
  @IsString()
  query: string;

  @ApiProperty({
    description: 'Field to search',
    example: 'customer',
    enum: ['customer', 'item', 'all'],
    default: 'all',
    required: false,
  })
  @IsOptional()
  @IsEnum(['customer', 'item', 'all'])
  field?: 'customer' | 'item' | 'all' = 'all';

  @ApiProperty({
    description: 'Max suggestions',
    example: 10,
    default: 10,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}

/**
 * SuggestionDto
 *
 * Single suggestion entry
 */
export class SuggestionDto {
  @ApiProperty({ description: 'Suggestion value', example: 'John Smith' })
  value: string;

  @ApiProperty({ description: 'Suggestion type', example: 'customer' })
  type: string;

  @ApiProperty({ description: 'Usage count', example: 12 })
  usage_count: number;
}

/**
 * SuggestionsResponseDto
 *
 * Autocomplete suggestions response
 */
export class SuggestionsResponseDto {
  @ApiProperty({ description: 'Suggestions', type: [SuggestionDto] })
  suggestions: SuggestionDto[];
}
