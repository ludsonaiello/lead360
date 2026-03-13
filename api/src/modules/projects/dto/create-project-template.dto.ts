import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  IsEnum,
  MaxLength,
  MinLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProjectTaskCategory {
  LABOR = 'labor',
  MATERIAL = 'material',
  SUBCONTRACTOR = 'subcontractor',
  EQUIPMENT = 'equipment',
  OTHER = 'other',
}

export class CreateTemplateTaskDto {
  @ApiProperty({ description: 'Task title', example: 'Remove existing shingles', maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ description: 'Task description', example: 'Strip old roofing material' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Estimated duration in days', example: 2 })
  @IsInt()
  @Min(1)
  @IsOptional()
  estimated_duration_days?: number;

  @ApiPropertyOptional({
    description: 'Task category',
    enum: ProjectTaskCategory,
    example: ProjectTaskCategory.LABOR,
  })
  @IsEnum(ProjectTaskCategory)
  @IsOptional()
  category?: ProjectTaskCategory;

  @ApiProperty({ description: 'Task sequence in template (0-based)', example: 0 })
  @IsInt()
  @Min(0)
  order_index: number;

  @ApiPropertyOptional({
    description: 'order_index of prerequisite task in same template',
    example: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  depends_on_order_index?: number;
}

export class CreateProjectTemplateDto {
  @ApiProperty({ description: 'Template name', example: 'Standard Roofing Project', maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'Template description', example: 'Complete roof replacement template' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Industry type (e.g. Roofing, Painting, Remodeling)',
    example: 'Roofing',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  industry_type?: string;

  @ApiPropertyOptional({
    description: 'Optional array of tasks to create with the template',
    type: [CreateTemplateTaskDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTemplateTaskDto)
  @IsOptional()
  tasks?: CreateTemplateTaskDto[];
}
