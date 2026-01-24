import { IsNumber, IsString, IsOptional, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
}
