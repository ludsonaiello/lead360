import {
  IsArray,
  IsUUID,
  IsInt,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class DiscountRuleOrderDto {
  @ApiProperty({
    description: 'Discount rule UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'id must be a valid UUID' })
  id: string;

  @ApiProperty({
    description: 'New order index (0-based)',
    example: 0,
    minimum: 0,
  })
  @IsInt()
  @Min(0, { message: 'new_order_index must be >= 0' })
  new_order_index: number;
}

export class ReorderDiscountRulesDto {
  @ApiProperty({
    description: 'Array of discount rules with their new order indices',
    type: [DiscountRuleOrderDto],
    example: [
      { id: '123e4567-e89b-12d3-a456-426614174000', new_order_index: 0 },
      { id: '223e4567-e89b-12d3-a456-426614174001', new_order_index: 1 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, {
    message: 'discount_rules array must have at least one entry',
  })
  @ValidateNested({ each: true })
  @Type(() => DiscountRuleOrderDto)
  discount_rules: DiscountRuleOrderDto[];
}
