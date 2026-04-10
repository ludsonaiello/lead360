import {
  IsOptional,
  IsString,
  IsUUID,
  IsNumber,
  IsDateString,
  IsEnum,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCrewPaymentDto {
  @ApiPropertyOptional({
    description: 'Project ID (optional)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({
    description: 'Payment amount (must be > 0)',
    example: 1500.0,
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount?: number;

  @ApiPropertyOptional({
    description: 'Payment date (ISO format, cannot be future)',
    example: '2026-03-15',
  })
  @IsOptional()
  @IsDateString()
  payment_date?: string;

  @ApiPropertyOptional({
    description: 'Payment method',
    enum: ['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'],
  })
  @IsOptional()
  @IsEnum(['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'], {
    message: 'payment_method must be one of: cash, check, bank_transfer, venmo, zelle, credit_card, debit_card, ACH',
  })
  payment_method?: string;

  @ApiPropertyOptional({
    description: 'Reference number (check number, transfer ID, etc.)',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference_number?: string;

  @ApiPropertyOptional({
    description: 'Pay period start date',
    example: '2026-03-01',
  })
  @IsOptional()
  @IsDateString()
  period_start_date?: string;

  @ApiPropertyOptional({
    description: 'Pay period end date',
    example: '2026-03-15',
  })
  @IsOptional()
  @IsDateString()
  period_end_date?: string;

  @ApiPropertyOptional({
    description: 'Hours paid (reference only)',
    example: 40.0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hours_paid?: number;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
