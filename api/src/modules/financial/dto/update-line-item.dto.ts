import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsInt,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateLineItemDto {
  @ApiPropertyOptional({
    description: 'Line item description',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Quantity',
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Quantity must be at least 0.01' })
  @Type(() => Number)
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Unit price',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0, { message: 'Unit price must be 0 or greater' })
  @Type(() => Number)
  unit_price?: number;

  @ApiPropertyOptional({
    description: 'Unit of measure',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit_of_measure?: string;

  @ApiPropertyOptional({
    description: 'Supplier product ID (set to null to unlink)',
  })
  @IsOptional()
  @IsUUID()
  supplier_product_id?: string | null;

  @ApiPropertyOptional({
    description: 'Sort order (0-based)',
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
