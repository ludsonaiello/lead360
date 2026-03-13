import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectFromQuoteDto {
  @ApiPropertyOptional({ description: 'Project name (defaults to quote title if omitted)', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Project description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Start date (ISO date string)', example: '2026-04-01' })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({ description: 'Target completion date (ISO date string)', example: '2026-06-15' })
  @IsOptional()
  @IsDateString()
  target_completion_date?: string;

  @ApiPropertyOptional({ description: 'Whether a permit is required', default: false })
  @IsOptional()
  @IsBoolean()
  permit_required?: boolean;

  @ApiPropertyOptional({ description: 'Assigned project manager user ID (UUID)' })
  @IsOptional()
  @IsUUID()
  assigned_pm_user_id?: string;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Template ID to seed additional tasks from (UUID)' })
  @IsOptional()
  @IsUUID()
  template_id?: string;
}
