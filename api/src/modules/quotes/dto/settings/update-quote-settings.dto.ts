import { IsNumber, IsString, IsOptional, Min, Max, IsUUID, IsObject, IsBoolean, ValidateBy } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

// Custom validator to accept both array and object for approval_thresholds
function IsArrayOrObject() {
  return ValidateBy({
    name: 'isArrayOrObject',
    validator: {
      validate: (value) => {
        return value === null || value === undefined || typeof value === 'object';
      },
      defaultMessage: () => 'approval_thresholds must be an array or object',
    },
  });
}

export class UpdateQuoteSettingsDto {
  @ApiPropertyOptional({ example: 20.0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  default_profit_margin?: number;

  @ApiPropertyOptional({ example: 10.0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  default_overhead_rate?: number;

  @ApiPropertyOptional({ example: 5.0 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  default_contingency_rate?: number;

  @ApiPropertyOptional({ example: 'Payment due upon completion' })
  @IsString()
  @IsOptional()
  default_quote_terms?: string;

  @ApiPropertyOptional({ example: 'Check or cash accepted' })
  @IsString()
  @IsOptional()
  default_payment_instructions?: string;

  @ApiPropertyOptional({ example: 30 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  default_quote_validity_days?: number;

  @ApiPropertyOptional({ example: 'Q-' })
  @IsString()
  @IsOptional()
  quote_prefix?: string;

  @ApiPropertyOptional({ example: 1001 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  next_quote_number?: number;

  @ApiPropertyOptional({ example: 'INV-' })
  @IsString()
  @IsOptional()
  invoice_prefix?: string;

  @ApiPropertyOptional({ example: 1001 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  next_invoice_number?: number;

  @ApiPropertyOptional({ example: 'Thank you for your business!' })
  @IsString()
  @IsOptional()
  default_quote_footer?: string;

  @ApiPropertyOptional({ example: 'Payment due within 30 days' })
  @IsString()
  @IsOptional()
  default_invoice_footer?: string;

  @ApiPropertyOptional({ example: 7.5 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  sales_tax_rate?: number;

  @ApiPropertyOptional({
    example: { min_margin: 15, target_margin: 25, warning_threshold: 10 },
    description: 'JSON object for profitability thresholds'
  })
  @IsObject()
  @IsOptional()
  profitability_thresholds?: any;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsOptional()
  active_quote_template_id?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Show line items by default in quote PDFs'
  })
  @IsBoolean()
  @IsOptional()
  show_line_items_by_default?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Show cost breakdown (material, labor, etc.) by default in quote PDFs'
  })
  @IsBoolean()
  @IsOptional()
  show_cost_breakdown_by_default?: boolean;

  @ApiPropertyOptional({
    example: {
      approval_levels: [
        { level: 1, role: 'Manager', min_amount: 0, max_amount: 10000 },
        { level: 2, role: 'Admin', min_amount: 10000, max_amount: 50000 },
        { level: 3, role: 'Owner', min_amount: 50000, max_amount: null }
      ]
    },
    description: 'JSON object containing approval_levels array OR array directly (will be normalized)'
  })
  @IsArrayOrObject()
  @IsOptional()
  approval_thresholds?: any;

  @ApiPropertyOptional({
    example: false,
    description: 'Computed field (read-only, ignored if provided)'
  })
  @IsBoolean()
  @IsOptional()
  is_using_system_defaults?: boolean;
}
