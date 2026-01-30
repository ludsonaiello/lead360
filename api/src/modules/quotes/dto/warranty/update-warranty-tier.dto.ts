import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsNumber,
  IsInt,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

/**
 * UpdateWarrantyTierDto
 *
 * Updates an existing warranty tier
 *
 * @author Backend Developer
 */
export class UpdateWarrantyTierDto {
  @ApiPropertyOptional({
    description: 'Warranty tier name',
    example: '1-Year Standard',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  tier_name?: string;

  @ApiPropertyOptional({
    description: 'Warranty description',
    example: 'Standard 1-year warranty covering defects',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Price type: fixed amount or percentage of item price',
    enum: ['fixed', 'percentage'],
    example: 'fixed',
  })
  @IsOptional()
  @IsEnum(['fixed', 'percentage'])
  price_type?: 'fixed' | 'percentage';

  @ApiPropertyOptional({
    description:
      'Price value (dollar amount if fixed, percentage if percentage type)',
    example: 199.99,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price_value?: number;

  @ApiPropertyOptional({
    description: 'Warranty duration in months',
    example: 12,
    minimum: 1,
    maximum: 600,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  duration_months?: number;

  @ApiPropertyOptional({
    description: 'Active status',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
