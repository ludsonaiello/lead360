import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  Length,
  Min,
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
    example: 3.50,
    description: 'Labor cost per unit',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  labor_cost_per_unit?: number;

  @ApiPropertyOptional({
    example: 0.50,
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
}
