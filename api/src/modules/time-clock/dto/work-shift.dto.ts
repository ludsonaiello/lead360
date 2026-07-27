import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const WORK_SHIFT_STATUSES = [
  'scheduled',
  'in_progress',
  'completed',
  'missed',
  'cancelled',
] as const;

export type WorkShiftStatus = (typeof WORK_SHIFT_STATUSES)[number];

export class CreateWorkShiftDto {
  @ApiProperty({ description: 'Employee profile ID' })
  @IsString()
  @IsUUID()
  employee_profile_id: string;

  @ApiPropertyOptional({ description: 'Project ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ description: 'Task ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiProperty({
    description: 'Scheduled start time (ISO 8601)',
    example: '2026-04-10T08:00:00.000Z',
  })
  @IsDateString()
  scheduled_start: string;

  @ApiProperty({
    description: 'Scheduled end time (ISO 8601)',
    example: '2026-04-10T17:00:00.000Z',
  })
  @IsDateString()
  scheduled_end: string;

  @ApiPropertyOptional({ description: 'Shift title', example: 'Morning Shift' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkCreateWorkShiftDto {
  @ApiProperty({
    description: 'Array of shifts to create',
    type: [CreateWorkShiftDto],
  })
  @ValidateNested({ each: true })
  @Type(() => CreateWorkShiftDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  shifts: CreateWorkShiftDto[];
}

export class UpdateWorkShiftDto {
  @ApiPropertyOptional({ description: 'Employee profile ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;

  @ApiPropertyOptional({ description: 'Project ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ description: 'Task ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiPropertyOptional({ description: 'Scheduled start time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  scheduled_start?: string;

  @ApiPropertyOptional({ description: 'Scheduled end time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  scheduled_end?: string;

  @ApiPropertyOptional({ description: 'Shift title' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Shift status',
    enum: WORK_SHIFT_STATUSES,
  })
  @IsOptional()
  @IsEnum(WORK_SHIFT_STATUSES)
  status?: WorkShiftStatus;
}

export class ListWorkShiftsDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by employee profile ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;

  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({
    description: 'Filter shifts starting from this date (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'Filter shifts ending before this date (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: WORK_SHIFT_STATUSES,
  })
  @IsOptional()
  @IsEnum(WORK_SHIFT_STATUSES)
  status?: WorkShiftStatus;
}

export class ListMyShiftsDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter shifts starting from this date (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'Filter shifts ending before this date (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: WORK_SHIFT_STATUSES,
  })
  @IsOptional()
  @IsEnum(WORK_SHIFT_STATUSES)
  status?: WorkShiftStatus;
}
