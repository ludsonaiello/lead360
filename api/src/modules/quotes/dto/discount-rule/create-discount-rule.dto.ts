import {
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDiscountRuleDto {
  @ApiProperty({
    description: 'Type of discount rule',
    enum: ['percentage', 'fixed_amount'],
    example: 'percentage',
  })
  @IsEnum(['percentage', 'fixed_amount'], {
    message: 'rule_type must be either percentage or fixed_amount',
  })
  rule_type: 'percentage' | 'fixed_amount';

  @ApiProperty({
    description:
      'Discount value (percentage 0-100 or fixed dollar amount > 0)',
    example: 10.0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0, { message: 'value must be greater than or equal to 0' })
  value: number;

  @ApiProperty({
    description: 'Reason for discount (required for audit trail)',
    example: 'Early payment discount',
    minLength: 3,
    maxLength: 255,
  })
  @IsString()
  @MinLength(3, { message: 'reason must be at least 3 characters' })
  @MaxLength(255, { message: 'reason must be at most 255 characters' })
  reason: string;

  @ApiPropertyOptional({
    description: 'Where to apply the discount',
    enum: ['subtotal'],
    default: 'subtotal',
    example: 'subtotal',
  })
  @IsEnum(['subtotal'], {
    message: 'apply_to must be subtotal',
  })
  @IsOptional()
  apply_to?: 'subtotal';
}
