import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsDateString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RecordInvoicePaymentDto {
  @ApiProperty({
    description:
      'Payment amount — must be > 0 and <= invoice.amount_due',
    example: 2500.0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Payment amount must be greater than 0' })
  @Type(() => Number)
  amount: number;

  @ApiProperty({
    description: 'Date payment was received',
    example: '2026-03-20',
  })
  @IsDateString()
  payment_date: string;

  @ApiProperty({
    description: 'Payment method',
    enum: [
      'cash',
      'check',
      'bank_transfer',
      'venmo',
      'zelle',
      'credit_card',
      'debit_card',
      'ACH',
    ],
  })
  @IsEnum(
    [
      'cash',
      'check',
      'bank_transfer',
      'venmo',
      'zelle',
      'credit_card',
      'debit_card',
      'ACH',
    ],
    {
      message:
        'payment_method must be one of: cash, check, bank_transfer, venmo, zelle, credit_card, debit_card, ACH',
    },
  )
  payment_method:
    | 'cash'
    | 'check'
    | 'bank_transfer'
    | 'venmo'
    | 'zelle'
    | 'credit_card'
    | 'debit_card'
    | 'ACH';

  @ApiPropertyOptional({
    description:
      'Optional FK to payment_method_registry — named payment account',
  })
  @IsOptional()
  @IsUUID()
  payment_method_registry_id?: string;

  @ApiPropertyOptional({
    description: 'Check number, transaction ID, etc.',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference_number?: string;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
