import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class UpdateLibraryItemDto {
  @ApiPropertyOptional({
    example: 'Standard drywall installation - Updated',
    description: 'Item title',
  })
  @IsString()
  @IsOptional()
  @Length(1, 200)
  title?: string;

  @ApiPropertyOptional({
    example: '1/2 inch drywall with tape and mud finish',
    description: 'Detailed description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unit measurement UUID (sq ft, linear ft, etc.)',
  })
  @IsString()
  @IsOptional()
  @IsUUID()
  unit_measurement_id?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Default quantity when adding to quote',
  })
  @IsNumber()
  @IsOptional()
  @Min(0.01)
  default_quantity?: number;

  @ApiPropertyOptional({
    example: 2.75,
    description: 'Material cost per unit',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  material_cost_per_unit?: number;

  @ApiPropertyOptional({
    example: 2.00,
    description: 'Labor cost per unit',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  labor_cost_per_unit?: number;

  @ApiPropertyOptional({
    example: 0.25,
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
    example: 0.0,
    description: 'Other cost per unit',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  other_cost_per_unit?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Mark item as active or inactive',
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
