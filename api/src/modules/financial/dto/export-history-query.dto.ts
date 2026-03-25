import {
  IsOptional,
  IsString,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ExportHistoryQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by export type',
    enum: ['quickbooks_expenses', 'quickbooks_invoices', 'xero_expenses', 'xero_invoices', 'pl_csv', 'entries_csv'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['quickbooks_expenses', 'quickbooks_invoices', 'xero_expenses', 'xero_invoices', 'pl_csv', 'entries_csv'])
  export_type?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
