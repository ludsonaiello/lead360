import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsUUID,
  MaxLength,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProjectDto {
  @ApiProperty({ description: 'Project name', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  name: string;

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

  @ApiPropertyOptional({ description: 'Estimated cost (must be > 0)', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimated_cost?: number;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Template ID to seed tasks from (UUID)' })
  @IsOptional()
  @IsUUID()
  template_id?: string;
}
