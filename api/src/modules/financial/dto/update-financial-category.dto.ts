import { IsString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// NOTE: `type` is intentionally NOT updatable (business rule).
// We do NOT use PartialType(CreateFinancialCategoryDto) to prevent
// `type` from being accepted in updates.
export class UpdateFinancialCategoryDto {
  @ApiPropertyOptional({
    description: 'Category name',
    example: 'Materials - Lumber',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Updated description',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
