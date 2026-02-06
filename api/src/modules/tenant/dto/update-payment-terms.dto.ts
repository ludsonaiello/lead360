import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsNumber, Min, Max, IsInt } from 'class-validator';

export enum PaymentTermType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export class PaymentTermDto {
  @ApiProperty({
    description: 'Sequence number (order)',
    example: 1,
  })
  @IsInt()
  @Min(1)
  sequence: number;

  @ApiProperty({
    description: 'Payment term type',
    enum: PaymentTermType,
    example: PaymentTermType.PERCENTAGE,
  })
  @IsEnum(PaymentTermType)
  type: PaymentTermType;

  @ApiProperty({
    description: 'Amount (percentage or dollar value)',
    example: 50,
  })
  @IsNumber()
  @Min(0)
  @Max(100) // Max 100% for percentage, or reasonable dollar limit
  amount: number;

  @ApiProperty({
    description: 'Description of this payment milestone',
    example: 'Upfront deposit',
  })
  @IsString()
  description: string;
}

export class UpdatePaymentTermsDto {
  @ApiProperty({
    description: 'Array of payment terms',
    type: [PaymentTermDto],
    example: [
      {
        sequence: 1,
        type: 'percentage',
        amount: 50,
        description: 'Upfront deposit',
      },
      {
        sequence: 2,
        type: 'percentage',
        amount: 25,
        description: 'Upon permit approval',
      },
      {
        sequence: 3,
        type: 'percentage',
        amount: 25,
        description: 'Upon completion',
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentTermDto)
  terms: PaymentTermDto[];
}
