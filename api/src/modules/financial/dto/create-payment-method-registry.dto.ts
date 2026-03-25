import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentMethodRegistryDto {
  @ApiProperty({
    description: 'Human-readable name for this payment method',
    example: 'Chase Business Visa - Vehicle 1',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: 'nickname must not be empty' })
  @MaxLength(100)
  nickname: string;

  @ApiProperty({
    description: 'Payment method type',
    enum: ['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'],
    example: 'credit_card',
  })
  @IsEnum(['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'], {
    message: 'type must be one of: cash, check, bank_transfer, venmo, zelle, credit_card, debit_card, ACH',
  })
  type: string;

  @ApiPropertyOptional({
    description: 'Bank or institution name',
    example: 'Chase',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  bank_name?: string;

  @ApiPropertyOptional({
    description: 'Last 4 digits of card/account number (display label only). Must be exactly 4 numeric digits.',
    example: '4521',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, {
    message: 'last_four must be exactly 4 numeric digits',
  })
  last_four?: string;

  @ApiPropertyOptional({
    description: 'Internal notes about this payment method',
    example: 'Assigned to field crew for supply runs',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Set as default payment method for new expense entries',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
