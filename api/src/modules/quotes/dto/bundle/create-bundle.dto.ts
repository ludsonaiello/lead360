import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsArray,
  IsUUID,
  Length,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
}

export class BundleItemDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716',
    description:
      'Library item ID - if provided, will auto-populate title, costs, and unit from library',
  })
  @IsUUID()
  @IsOptional()
  library_item_id?: string;

  @ApiPropertyOptional({
    example: 'Kitchen Cabinet Installation',
    description: 'Required if library_item_id is not provided',
  })
  @IsString()
  @Length(1, 200)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: 'Standard kitchen cabinets' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(0.01)
  quantity: number;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716',
    description: 'Required if library_item_id is not provided',
  })
  @IsUUID()
  @IsOptional()
  unit_measurement_id?: string;

  @ApiPropertyOptional({
    example: 50.0,
    description: 'Required if library_item_id is not provided',
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  material_cost_per_unit?: number;

  @ApiPropertyOptional({
    example: 100.0,
    description: 'Required if library_item_id is not provided',
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  labor_cost_per_unit?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  equipment_cost_per_unit?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  subcontract_cost_per_unit?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  other_cost_per_unit?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  order_index?: number;
}

export class CreateBundleDto {
  @ApiProperty({ example: 'Complete Kitchen Remodel' })
  @IsString()
  @Length(1, 200)
  name: string;

  @ApiPropertyOptional({ example: 'Standard kitchen renovation package' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: DiscountType, example: DiscountType.PERCENTAGE })
  @IsEnum(DiscountType)
  @IsOptional()
  discount_type?: DiscountType;

  @ApiPropertyOptional({ example: 10.0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  discount_value?: number;

  @ApiProperty({ type: [BundleItemDto], minItems: 1 })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => BundleItemDto)
  items: BundleItemDto[];
}
