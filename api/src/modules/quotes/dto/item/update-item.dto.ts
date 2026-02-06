import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  Length,
  Min,
  Max,
} from 'class-validator';

export class UpdateItemDto {
  @ApiPropertyOptional({
    example: 'Premium hardwood flooring - Updated',
    description: 'Item title',
  })
  @IsString()
  @IsOptional()
  @Length(1, 255)
  title?: string;

  @ApiPropertyOptional({
    example: 'Oak hardwood, 3/4 inch thick, prefinished',
    description: 'Detailed description of the item',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: 600,
    description: 'Quantity of units',
  })
  @IsNumber()
  @IsOptional()
  @Min(0.01)
  quantity?: number;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unit measurement UUID (sq ft, linear ft, etc.)',
  })
  @IsString()
  @IsOptional()
  @IsUUID()
  unit_measurement_id?: string;

  @ApiPropertyOptional({
    example: 5.75,
    description: 'Material cost per unit',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  material_cost_per_unit?: number;

  @ApiPropertyOptional({
    example: 3.5,
    description: 'Labor cost per unit',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  labor_cost_per_unit?: number;

  @ApiPropertyOptional({
    example: 0.5,
    description: 'Equipment cost per unit',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  equipment_cost_per_unit?: number;

  @ApiPropertyOptional({
    example: 0.0,
    description: 'Subcontract cost per unit',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  subcontract_cost_per_unit?: number;

  @ApiPropertyOptional({
    example: 0.75,
    description: 'Other cost per unit',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  other_cost_per_unit?: number;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description:
      'Quote group UUID (assign item to a group, or null to unassign)',
  })
  @IsUUID()
  @IsOptional()
  quote_group_id?: string | null;

  @ApiPropertyOptional({
    example: 15.0,
    description:
      'Custom profit percentage for this item (overrides quote-level)',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  custom_profit_percent?: number;

  @ApiPropertyOptional({
    example: 10.0,
    description:
      'Custom overhead percentage for this item (overrides quote-level)',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  custom_overhead_percent?: number;

  @ApiPropertyOptional({
    example: 5.0,
    description:
      'Custom contingency percentage for this item (overrides quote-level)',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  custom_contingency_percent?: number;

  @ApiPropertyOptional({
    example: 10.0,
    description: 'Custom discount percentage for this item',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  custom_discount_percentage?: number;

  @ApiPropertyOptional({
    example: 50.0,
    description: 'Custom fixed discount amount for this item',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  custom_discount_amount?: number;
}
