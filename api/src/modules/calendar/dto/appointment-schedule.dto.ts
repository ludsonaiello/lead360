import {
  IsString,
  IsBoolean,
  IsOptional,
  Matches,
  IsInt,
  Min,
  Max,
  ValidateNested,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  Validate,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TimeWindowValidator } from '../validators/time-window.validator';

/**
 * DTO for a single day schedule entry
 * Used for both bulk updates and single day updates
 */
export class DayScheduleDto {
  @ApiProperty({
    description: 'Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)',
    example: 1,
    minimum: 0,
    maximum: 6,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  @Type(() => Number)
  day_of_week: number;

  @ApiProperty({
    description: 'Whether appointments are available on this day',
    example: true,
  })
  @IsBoolean()
  is_available: boolean;

  @ApiPropertyOptional({
    description: 'First window start time (HH:MM format, 24-hour)',
    example: '09:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:MM format (24-hour)',
  })
  window1_start?: string;

  @ApiPropertyOptional({
    description: 'First window end time (HH:MM format, 24-hour)',
    example: '12:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:MM format (24-hour)',
  })
  window1_end?: string;

  @ApiPropertyOptional({
    description:
      'Second window start time (for split shifts/lunch breaks, HH:MM format, 24-hour)',
    example: '13:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:MM format (24-hour)',
  })
  window2_start?: string;

  @ApiPropertyOptional({
    description: 'Second window end time (HH:MM format, 24-hour)',
    example: '17:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:MM format (24-hour)',
  })
  window2_end?: string;

  // Apply custom time window validation
  @Validate(TimeWindowValidator)
  validateTimeWindows?: any;
}

/**
 * DTO for bulk updating all 7 days of the week schedule
 * PUT /calendar/appointment-types/:typeId/schedule
 */
export class BulkUpdateScheduleDto {
  @ApiProperty({
    description: 'Array of 7 schedule entries (one for each day of the week)',
    type: [DayScheduleDto],
    example: [
      {
        day_of_week: 0,
        is_available: false,
        window1_start: null,
        window1_end: null,
        window2_start: null,
        window2_end: null,
      },
      {
        day_of_week: 1,
        is_available: true,
        window1_start: '09:00',
        window1_end: '12:00',
        window2_start: '13:00',
        window2_end: '17:00',
      },
      // ... remaining 5 days
    ],
  })
  @IsArray()
  @ArrayMinSize(7, { message: 'Must provide exactly 7 schedule entries' })
  @ArrayMaxSize(7, { message: 'Must provide exactly 7 schedule entries' })
  @ValidateNested({ each: true })
  @Type(() => DayScheduleDto)
  schedules: DayScheduleDto[];
}

/**
 * DTO for updating a single day's schedule
 * PATCH /calendar/appointment-types/:typeId/schedule/:dayOfWeek
 */
export class UpdateSingleDayScheduleDto {
  @ApiProperty({
    description: 'Whether appointments are available on this day',
    example: true,
  })
  @IsBoolean()
  is_available: boolean;

  @ApiPropertyOptional({
    description: 'First window start time (HH:MM format, 24-hour)',
    example: '09:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:MM format (24-hour)',
  })
  window1_start?: string;

  @ApiPropertyOptional({
    description: 'First window end time (HH:MM format, 24-hour)',
    example: '12:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:MM format (24-hour)',
  })
  window1_end?: string;

  @ApiPropertyOptional({
    description:
      'Second window start time (for split shifts/lunch breaks, HH:MM format, 24-hour)',
    example: '13:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:MM format (24-hour)',
  })
  window2_start?: string;

  @ApiPropertyOptional({
    description: 'Second window end time (HH:MM format, 24-hour)',
    example: '17:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:MM format (24-hour)',
  })
  window2_end?: string;

  // Apply custom time window validation
  @Validate(TimeWindowValidator)
  validateTimeWindows?: any;
}
