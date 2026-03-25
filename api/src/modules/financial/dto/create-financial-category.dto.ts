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
  INSURANCE = 'insurance',
  FUEL = 'fuel',
  UTILITIES = 'utilities',
  OFFICE = 'office',
  MARKETING = 'marketing',
  TAXES = 'taxes',
  TOOLS = 'tools',
  OTHER = 'other',
}

export enum FinancialCategoryClassification {
  COST_OF_GOODS_SOLD = 'cost_of_goods_sold',
  OPERATING_EXPENSE = 'operating_expense',
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
    description: 'Category classification for P&L reporting. Defaults to cost_of_goods_sold if omitted.',
    enum: FinancialCategoryClassification,
    example: FinancialCategoryClassification.COST_OF_GOODS_SOLD,
    default: FinancialCategoryClassification.COST_OF_GOODS_SOLD,
  })
  @IsOptional()
  @IsEnum(FinancialCategoryClassification)
  classification?: FinancialCategoryClassification;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Concrete and cement related expenses',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
