import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSubcontractorInvoiceDto {
  @ApiProperty({
    description: 'Subcontractor ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsUUID()
  subcontractor_id: string;

  @ApiProperty({
    description: 'Task ID (required — invoice is task-level)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsString()
  @IsUUID()
  task_id: string;

  @ApiProperty({
    description: 'Project ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsString()
  @IsUUID()
  project_id: string;

  @ApiProperty({
    description: 'Invoice amount (must be > 0)',
    example: 3500.0,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount: number;

  @ApiPropertyOptional({
    description: 'Invoice number (must be unique per tenant if provided)',
    example: 'SUB-INV-0045',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  invoice_number?: string;

  @ApiPropertyOptional({
    description: 'Invoice date (ISO format)',
    example: '2026-03-10',
  })
  @IsOptional()
  @IsDateString()
  invoice_date?: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: 'Electrical rough-in for unit 5A',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
