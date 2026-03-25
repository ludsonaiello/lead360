import {
  IsString,
  IsOptional,
  IsBoolean,
  Length,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSupplierCategoryDto {
  @ApiPropertyOptional({
    description: 'Category name (unique per tenant)',
    example: 'Roofing Materials',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Optional description of the category',
    example: 'Shingles, underlayment, flashing, and other roofing supplies',
  })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Hex color for UI badge display (#RRGGBB format)',
    example: '#3B82F6',
  })
  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid hex color in #RRGGBB format (e.g., #3B82F6)',
  })
  color?: string;

  @ApiPropertyOptional({
    description: 'Active status — deactivating hides from category picker but preserves assignments',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
