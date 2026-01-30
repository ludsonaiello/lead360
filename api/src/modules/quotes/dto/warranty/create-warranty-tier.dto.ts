import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsNumber,
  IsInt,
  IsOptional,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

/**
 * CreateWarrantyTierDto
 *
 * Creates a new warranty tier for quote items
 *
 * @author Backend Developer
 */
export class CreateWarrantyTierDto {
  @ApiProperty({
    description: 'Warranty tier name',
    example: '1-Year Standard',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  tier_name: string;

  @ApiProperty({
    description: 'Warranty description',
    example: 'Standard 1-year warranty covering defects',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Price type: fixed amount or percentage of item price',
    enum: ['fixed', 'percentage'],
    example: 'fixed',
  })
  @IsEnum(['fixed', 'percentage'])
  price_type: 'fixed' | 'percentage';

  @ApiProperty({
    description:
      'Price value (dollar amount if fixed, percentage if percentage type)',
    example: 199.99,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  price_value: number;

  @ApiProperty({
    description: 'Warranty duration in months',
    example: 12,
    minimum: 1,
    maximum: 600,
  })
  @IsInt()
  @Min(1)
  @Max(600)
  duration_months: number;
}
