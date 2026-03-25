import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ListProjectInvoicesDto {
  @ApiPropertyOptional({
    description: 'Filter by invoice status',
    enum: ['draft', 'sent', 'partial', 'paid', 'voided'],
  })
  @IsOptional()
  @IsEnum(['draft', 'sent', 'partial', 'paid', 'voided'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by created_at from date',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'Filter by created_at to date',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}
