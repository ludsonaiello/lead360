import {
  IsString,
  IsOptional,
  IsNumber,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateSupplierProductDto {
  @ApiProperty({
    description: 'Product or service name (unique per supplier)',
    example: 'Crushed Stone',
    maxLength: 200,
  })
  @IsString()
  @Length(1, 200)
  name: string;

  @ApiPropertyOptional({
    description: 'Optional product description',
    example: '#57 crushed limestone, suitable for driveways and drainage',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Unit of measure for pricing',
    example: 'ton',
    maxLength: 50,
  })
  @IsString()
  @Length(1, 50)
  unit_of_measure: string;

  @ApiPropertyOptional({
    description: 'Current price per unit (null if unknown)',
    example: 45.50,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  unit_price?: number;

  @ApiPropertyOptional({
    description: "Supplier's product code or SKU",
    example: 'CS-57-LM',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  sku?: string;
}
