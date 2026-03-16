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

export class CreateSubcontractorPaymentDto {
  @ApiProperty({
    description: 'Subcontractor ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsUUID()
  subcontractor_id: string;

  @ApiPropertyOptional({
    description: 'Project ID (optional)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiProperty({
    description: 'Payment amount (must be > 0)',
    example: 5000.0,
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
    example: 'bank_transfer',
  })
  @IsEnum(['cash', 'check', 'bank_transfer', 'venmo', 'zelle'], {
    message: 'payment_method must be one of: cash, check, bank_transfer, venmo, zelle',
  })
  payment_method: string;

  @ApiPropertyOptional({
    description: 'Reference number (check number, transfer ID, etc.)',
    example: 'WIRE-20260315-001',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference_number?: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Payment for electrical work on Project #P-0012',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
