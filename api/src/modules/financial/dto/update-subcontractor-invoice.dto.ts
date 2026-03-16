import { IsOptional, IsNumber, IsString, IsEnum, Min } from 'class-validator';
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

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
