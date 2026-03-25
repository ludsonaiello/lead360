import {
  IsOptional,
  IsDateString,
  IsString,
  IsIn,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QualityReportQueryDto {
  @ApiPropertyOptional({
    description: 'Start date filter (optional — if omitted, checks all records)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'End date filter (optional — if omitted, checks all records)',
    example: '2026-03-31',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({
    description: 'Target platform for platform-specific checks',
    enum: ['quickbooks', 'xero'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['quickbooks', 'xero'])
  platform?: 'quickbooks' | 'xero';
}
