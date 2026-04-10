import { IsOptional, IsNumber, IsString, IsEnum, IsDateString, Min, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSubcontractorInvoiceDto {
  @ApiPropertyOptional({
    description: 'Invoice status (forward-only: pending→approved→paid)',
    enum: ['approved', 'paid'],
  })
  @IsOptional()
  @IsEnum(['approved', 'paid'], {
    message: 'Status must be one of: approved, paid',
  })
  status?: string;

  @ApiPropertyOptional({
    description: 'Invoice amount (only updatable before approved status)',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount?: number;

  @ApiPropertyOptional({
    description: 'Invoice number (only updatable before approved status)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoice_number?: string;

  @ApiPropertyOptional({
    description: 'Invoice date (only updatable before approved status)',
    example: '2026-03-10',
  })
  @IsOptional()
  @IsDateString()
  invoice_date?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
