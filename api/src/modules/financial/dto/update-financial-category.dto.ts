import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FinancialCategoryClassification } from './create-financial-category.dto';

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

  @ApiPropertyOptional({
    description: 'Category classification — cannot be changed for system-default categories',
    enum: FinancialCategoryClassification,
  })
  @IsOptional()
  @IsEnum(FinancialCategoryClassification)
  classification?: FinancialCategoryClassification;
}
