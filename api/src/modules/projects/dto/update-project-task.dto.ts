import {
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
  MaxLength,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ProjectTaskCategoryEnum } from './create-project-task.dto';

export enum ProjectTaskStatusEnum {
  not_started = 'not_started',
  in_progress = 'in_progress',
  blocked = 'blocked',
  done = 'done',
}

export class UpdateProjectTaskDto {
  @ApiPropertyOptional({ description: 'Task title', maxLength: 200, example: 'Install new shingles' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Task description' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ description: 'Estimated duration in days (integer, > 0)', example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  estimated_duration_days?: number;

  @ApiPropertyOptional({ description: 'Estimated start date (ISO date)', example: '2026-04-05' })
  @IsOptional()
  @IsDateString()
  estimated_start_date?: string;

  @ApiPropertyOptional({ description: 'Estimated end date (ISO date)', example: '2026-04-07' })
  @IsOptional()
  @IsDateString()
  estimated_end_date?: string;

  @ApiPropertyOptional({
    description: 'Task status',
    enum: ProjectTaskStatusEnum,
  })
  @IsOptional()
  @IsEnum(ProjectTaskStatusEnum)
  status?: ProjectTaskStatusEnum;

  @ApiPropertyOptional({ description: 'Actual start date (ISO date)', example: '2026-04-06' })
  @IsOptional()
  @IsDateString()
  actual_start_date?: string;

  @ApiPropertyOptional({ description: 'Actual end date (ISO date)', example: '2026-04-10' })
  @IsOptional()
  @IsDateString()
  actual_end_date?: string;

  @ApiPropertyOptional({
    description: 'Task category',
    enum: ProjectTaskCategoryEnum,
    example: 'labor',
  })
  @IsOptional()
  @IsEnum(ProjectTaskCategoryEnum)
  category?: ProjectTaskCategoryEnum;

  @ApiPropertyOptional({ description: 'Display order index (integer, >= 0)', example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order_index?: number;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
