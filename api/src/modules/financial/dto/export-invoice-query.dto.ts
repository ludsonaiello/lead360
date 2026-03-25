import {
  IsString,
  IsOptional,
  IsDateString,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ExportInvoiceQueryDto {
  @ApiProperty({
    description: 'Start of export period (required)',
    example: '2026-01-01',
  })
  @IsDateString()
  date_from: string;

  @ApiProperty({
    description: 'End of export period (required)',
    example: '2026-03-31',
  })
  @IsDateString()
  date_to: string;

  @ApiPropertyOptional({
    description: 'Filter by invoice status',
    enum: ['draft', 'sent', 'partial', 'paid'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['draft', 'sent', 'partial', 'paid'])
  status?: string;
}
