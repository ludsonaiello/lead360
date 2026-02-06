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
    example: 5.0,
    description: 'Custom contingency percentage',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  custom_contingency_percent?: number;

  @ApiPropertyOptional({
    example: 8.5,
    description:
      'Custom tax rate for this quote (overrides tenant sales tax rate)',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  custom_tax_rate?: number;

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
    description: 'Private notes (internal use only, not visible to customer)',
  })
  @IsString()
  @IsOptional()
  private_notes?: string;

  @ApiPropertyOptional({
    example: 'Payment due within 30 days. Late fees apply after 30 days.',
    description: 'Custom terms and conditions for this quote',
  })
  @IsString()
  @IsOptional()
  custom_terms?: string;

  @ApiPropertyOptional({
    example:
      '50% deposit required to begin work. Remaining balance due upon completion.',
    description: 'Custom payment instructions for this quote',
  })
  @IsString()
  @IsOptional()
  custom_payment_instructions?: string;
}
