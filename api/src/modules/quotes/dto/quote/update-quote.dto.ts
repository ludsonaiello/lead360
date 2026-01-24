import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsUUID,
  IsDateString,
  Length,
  Min,
  Max,
} from 'class-validator';

export class UpdateQuoteDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Vendor UUID',
  })
  @IsString()
  @IsOptional()
  @IsUUID()
  vendor_id?: string;

  @ApiPropertyOptional({
    example: 'Kitchen Remodel - Updated',
    description: 'Quote title',
  })
  @IsString()
  @IsOptional()
  @Length(1, 200)
  title?: string;

  @ApiPropertyOptional({
    example: 'PO-12345',
    description: 'Purchase order number',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  po_number?: string;

  @ApiPropertyOptional({
    example: '2026-02-28',
    description: 'Quote expiration date (YYYY-MM-DD)',
  })
  @IsDateString()
  @IsOptional()
  expiration_date?: string;

  @ApiPropertyOptional({
    example: 25.0,
    description: 'Custom profit percentage',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  custom_profit_percent?: number;

  @ApiPropertyOptional({
    example: 15.0,
    description: 'Custom overhead percentage',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  custom_overhead_percent?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Show line item details to customer',
  })
  @IsBoolean()
  @IsOptional()
  show_line_items?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Show cost breakdown to customer',
  })
  @IsBoolean()
  @IsOptional()
  show_cost_breakdown?: boolean;

  @ApiPropertyOptional({
    example: 'Customer requested detailed breakdown',
    description: 'Internal notes (not visible to customer)',
  })
  @IsString()
  @IsOptional()
  internal_notes?: string;

  @ApiPropertyOptional({
    example: 'Please review the attached specifications',
    description: 'Notes visible to customer',
  })
  @IsString()
  @IsOptional()
  customer_notes?: string;

  @ApiPropertyOptional({
    example: 'Net 30',
    description: 'Payment terms',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  payment_terms?: string;

  @ApiPropertyOptional({
    example: '50% deposit, 50% on completion',
    description: 'Payment schedule description',
  })
  @IsString()
  @IsOptional()
  payment_schedule?: string;
}
