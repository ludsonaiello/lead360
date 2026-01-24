import { IsEnum, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PreviewDiscountImpactDto {
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
    description: 'Discount value to preview',
    example: 10.0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0, { message: 'value must be greater than or equal to 0' })
  value: number;
}
