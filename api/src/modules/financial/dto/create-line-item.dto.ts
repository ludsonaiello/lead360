import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsInt,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateLineItemDto {
  @ApiProperty({
    description: 'Line item description',
    example: '2x4 lumber',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiProperty({
    description: 'Quantity',
    example: 2,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Quantity must be at least 0.01' })
  @Type(() => Number)
  quantity: number;

  @ApiProperty({
    description: 'Unit price',
    example: 10.0,
    minimum: 0,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0, { message: 'Unit price must be 0 or greater' })
  @Type(() => Number)
  unit_price: number;

  @ApiPropertyOptional({
    description: 'Unit of measure',
    example: 'each',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit_of_measure?: string;

  @ApiPropertyOptional({
    description: 'Supplier product ID (auto-fills unit_of_measure and unit_price if not provided)',
  })
  @IsOptional()
  @IsUUID()
  supplier_product_id?: string;

  @ApiPropertyOptional({
    description: 'Sort order (0-based)',
    example: 0,
  })
  @IsOptional()
  @IsInt({ message: 'order_index must be an integer' })
  @Min(0)
  @Type(() => Number)
  order_index?: number;

  @ApiPropertyOptional({
    description: 'Optional notes',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
