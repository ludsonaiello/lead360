import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ListEmployeeProfilesDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Search by user name or email' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CreateEmployeeProfileDto {
  @ApiProperty({ description: 'User ID to create profile for' })
  @IsString()
  @IsUUID()
  user_id: string;

  @ApiPropertyOptional({ description: 'Crew member ID for labor cost linkage' })
  @IsOptional()
  @IsString()
  @IsUUID()
  crew_member_id?: string;

  @ApiPropertyOptional({ description: 'Override hourly rate', example: 25.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hourly_rate?: number;

  @ApiPropertyOptional({
    description: 'Use employee-level overtime thresholds',
  })
  @IsOptional()
  @IsBoolean()
  overtime_rule_override?: boolean;

  @ApiPropertyOptional({
    description: 'Employee daily OT threshold',
    example: 8.0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  overtime_daily_threshold_hours?: number;

  @ApiPropertyOptional({
    description: 'Employee weekly OT threshold',
    example: 40.0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(168)
  overtime_weekly_threshold_hours?: number;
}

export class UpdateEmployeeProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  crew_member_id?: string;

  @ApiPropertyOptional({ example: 30.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hourly_rate?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  overtime_rule_override?: boolean;

  @ApiPropertyOptional({ example: 8.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(24)
  overtime_daily_threshold_hours?: number;

  @ApiPropertyOptional({ example: 40.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(168)
  overtime_weekly_threshold_hours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class SetEmployeePinDto {
  @ApiProperty({ description: 'Kiosk PIN (4-6 digits)', example: '1234' })
  @IsString()
  @MinLength(4)
  @MaxLength(6)
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4-6 digits' })
  pin: string;
}

export class SavePushSubscriptionDto {
  @ApiProperty({ description: 'Web Push subscription JSON' })
  @IsString()
  @IsNotEmpty()
  push_subscription_json: string;
}
