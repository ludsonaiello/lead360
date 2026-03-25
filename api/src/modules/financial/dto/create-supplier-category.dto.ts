import {
  IsString,
  IsOptional,
  Length,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierCategoryDto {
  @ApiProperty({
    description: 'Category name (unique per tenant)',
    example: 'Roofing Materials',
    maxLength: 100,
  })
  @IsString()
  @Length(1, 100)
  name: string;

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
}
