import {
  IsString,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum FinancialCategoryType {
  LABOR = 'labor',
  MATERIAL = 'material',
  SUBCONTRACTOR = 'subcontractor',
  EQUIPMENT = 'equipment',
  OTHER = 'other',
}

export class CreateFinancialCategoryDto {
  @ApiProperty({
    description: 'Category name',
    example: 'Materials - Concrete',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({
    description: 'Category type',
    enum: FinancialCategoryType,
    example: FinancialCategoryType.MATERIAL,
  })
  @IsEnum(FinancialCategoryType)
  type: FinancialCategoryType;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Concrete and cement related expenses',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
