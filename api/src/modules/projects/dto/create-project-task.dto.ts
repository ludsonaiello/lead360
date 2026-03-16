import {
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
  MaxLength,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProjectTaskCategoryEnum {
  labor = 'labor',
  material = 'material',
  subcontractor = 'subcontractor',
  equipment = 'equipment',
  other = 'other',
}

export class CreateProjectTaskDto {
  @ApiProperty({ description: 'Task title', maxLength: 200, example: 'Install new shingles' })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Task description', example: 'Premium architectural shingles' })
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
    description: 'Task category',
    enum: ProjectTaskCategoryEnum,
    example: 'labor',
  })
  @IsOptional()
  @IsEnum(ProjectTaskCategoryEnum)
  category?: ProjectTaskCategoryEnum;

  @ApiProperty({ description: 'Display order index (integer, >= 0)', example: 0 })
  @IsInt()
  @Min(0)
  order_index: number;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
