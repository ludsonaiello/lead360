import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  IsEnum,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCrewPaymentDto {
  @ApiProperty({
    description: 'Crew member ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsUUID()
  crew_member_id: string;

  @ApiPropertyOptional({
    description: 'Project ID (optional — payment may not be project-linked)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiProperty({
    description: 'Payment amount (must be > 0). Max: $9,999,999,999.99',
    example: 1500.0,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount: number;

  @ApiProperty({
    description: 'Payment date (ISO format, cannot be future)',
    example: '2026-03-15',
  })
  @IsDateString()
  payment_date: string;

  @ApiProperty({
    description: 'Payment method',
    enum: ['cash', 'check', 'bank_transfer', 'venmo', 'zelle'],
    example: 'check',
  })
  @IsEnum(['cash', 'check', 'bank_transfer', 'venmo', 'zelle'], {
    message: 'payment_method must be one of: cash, check, bank_transfer, venmo, zelle',
  })
  payment_method: string;

  @ApiPropertyOptional({
    description: 'Reference number (check number, transfer ID, etc.)',
    example: 'CHK-4521',
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

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Bi-weekly payment for March 1-15',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
