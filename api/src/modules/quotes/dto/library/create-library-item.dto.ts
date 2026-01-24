import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateLibraryItemDto {
  @ApiProperty({
    example: 'Standard drywall installation',
    description: 'Item title',
  })
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiPropertyOptional({
    example: '1/2 inch drywall with tape and mud finish',
    description: 'Detailed description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unit measurement UUID (sq ft, linear ft, etc.)',
  })
  @IsString()
  @IsUUID()
  unit_measurement_id: string;

  @ApiProperty({
    example: 1,
    description: 'Default quantity when adding to quote',
  })
  @IsNumber()
  @Min(0.01)
  default_quantity: number;

  @ApiProperty({
    example: 2.50,
    description: 'Material cost per unit',
  })
  @IsNumber()
  @Min(0)
  material_cost_per_unit: number;

  @ApiProperty({
    example: 1.75,
    description: 'Labor cost per unit',
  })
  @IsNumber()
  @Min(0)
  labor_cost_per_unit: number;

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
}
