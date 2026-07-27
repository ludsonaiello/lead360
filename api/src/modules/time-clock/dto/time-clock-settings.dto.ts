import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsInt,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

export class UpdateTimeClockSettingsDto {
  @ApiPropertyOptional({
    description: 'Clock-in location mode',
    enum: ['anywhere', 'specific_addresses', 'active_job_sites'],
  })
  @IsOptional()
  @IsEnum(['anywhere', 'specific_addresses', 'active_job_sites'])
  clock_in_mode?: string;

  @ApiPropertyOptional({
    description: 'Action when outside geofence',
    enum: ['block', 'warn_only'],
  })
  @IsOptional()
  @IsEnum(['block', 'warn_only'])
  geofence_violation_action?: string;

  @ApiPropertyOptional({ description: 'Whether GPS is required' })
  @IsOptional()
  @IsBoolean()
  gps_required?: boolean;

  @ApiPropertyOptional({
    description: 'Action when GPS unavailable',
    enum: ['block', 'allow_flagged'],
  })
  @IsOptional()
  @IsEnum(['block', 'allow_flagged'])
  gps_unavailable_action?: string;

  @ApiPropertyOptional({ description: 'Require project selection at clock-in' })
  @IsOptional()
  @IsBoolean()
  require_job_tag?: boolean;

  @ApiPropertyOptional({ description: 'Require task selection at clock-in' })
  @IsOptional()
  @IsBoolean()
  require_task_tag?: boolean;

  @ApiPropertyOptional({ description: 'Enable overtime calculation' })
  @IsOptional()
  @IsBoolean()
  overtime_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Daily overtime threshold in hours (0-24)',
    example: 8.0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  overtime_daily_threshold_hours?: number;

  @ApiPropertyOptional({
    description: 'Weekly overtime threshold in hours (0-168)',
    example: 40.0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(168)
  overtime_weekly_threshold_hours?: number;

  @ApiPropertyOptional({
    description: 'Overtime rate multiplier (1-5)',
    example: 1.5,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(5)
  overtime_multiplier?: number;

  @ApiPropertyOptional({
    description: 'Pay period type',
    enum: ['weekly', 'biweekly', 'semimonthly', 'monthly'],
  })
  @IsOptional()
  @IsEnum(['weekly', 'biweekly', 'semimonthly', 'monthly'])
  pay_period_type?: string;

  @ApiPropertyOptional({
    description: 'Pay period start day (0=Sun, 6=Sat)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  pay_period_start_day?: number;

  @ApiPropertyOptional({
    description: 'Anchor date for biweekly pay period',
    example: '2026-01-06',
  })
  @IsOptional()
  @IsDateString()
  pay_period_anchor_date?: string;

  @ApiPropertyOptional({ description: 'Enable kiosk mode' })
  @IsOptional()
  @IsBoolean()
  kiosk_mode_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Minutes before shift to send reminder (5-120)',
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  shift_reminder_minutes?: number;

  @ApiPropertyOptional({
    description: 'Minutes after shift start to mark as missed (5-120)',
    example: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(120)
  missed_shift_threshold_minutes?: number;
}
