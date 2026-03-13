import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsEnum,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum ProjectStatusEnum {
  planned = 'planned',
  in_progress = 'in_progress',
  on_hold = 'on_hold',
  completed = 'completed',
  canceled = 'canceled',
}

export class UpdateProjectDto {
  @ApiPropertyOptional({ description: 'Project name', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: 'Project description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Project status',
    enum: ProjectStatusEnum,
  })
  @IsOptional()
  @IsEnum(ProjectStatusEnum)
  status?: ProjectStatusEnum;

  @ApiPropertyOptional({ description: 'Start date (ISO date string)', example: '2026-04-01' })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({ description: 'Target completion date', example: '2026-06-15' })
  @IsOptional()
  @IsDateString()
  target_completion_date?: string;

  @ApiPropertyOptional({ description: 'Whether a permit is required' })
  @IsOptional()
  @IsBoolean()
  permit_required?: boolean;

  @ApiPropertyOptional({ description: 'Assigned project manager user ID (UUID, null to unassign)', nullable: true })
  @IsOptional()
  @IsUUID()
  assigned_pm_user_id?: string | null;

  @ApiPropertyOptional({ description: 'Whether portal is enabled for this project' })
  @IsOptional()
  @IsBoolean()
  portal_enabled?: boolean;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
