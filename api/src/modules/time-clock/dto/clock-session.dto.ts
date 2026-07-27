import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum LocationSourceEnum {
  BROWSER_GPS = 'browser_gps',
  NATIVE_GPS = 'native_gps',
  KIOSK = 'kiosk',
  MANUAL = 'manual',
}

export enum ClockSessionStatusFilter {
  ACTIVE = 'active',
  ON_BREAK = 'on_break',
  COMPLETED = 'completed',
}

const toOptionalBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  return value;
};

export class ClockInDto {
  @ApiPropertyOptional({ description: 'Project to tag this session to' })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ description: 'Task to tag this session to' })
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiPropertyOptional({
    description: 'Latitude (up to 8 decimal places)',
    example: 40.7128,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Longitude (up to 8 decimal places)',
    example: -74.006,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Source of GPS coordinates',
    enum: LocationSourceEnum,
    default: LocationSourceEnum.BROWSER_GPS,
  })
  @IsOptional()
  @IsEnum(LocationSourceEnum)
  location_source?: LocationSourceEnum;

  @ApiPropertyOptional({ description: 'Clock-in notes', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ClockOutDto {
  @ApiPropertyOptional({ description: 'Latitude', example: 40.7128 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ description: 'Longitude', example: -74.006 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Source of GPS coordinates',
    enum: LocationSourceEnum,
    default: LocationSourceEnum.BROWSER_GPS,
  })
  @IsOptional()
  @IsEnum(LocationSourceEnum)
  location_source?: LocationSourceEnum;

  @ApiPropertyOptional({ description: 'Clock-out notes', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ListClockSessionsDto {
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
    description: 'Filter by session status',
    enum: ClockSessionStatusFilter,
  })
  @IsOptional()
  @IsEnum(ClockSessionStatusFilter)
  status?: ClockSessionStatusFilter;

  @ApiPropertyOptional({
    description: 'Filter sessions starting from this date (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'Filter sessions ending at this date (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Filter by flagged status' })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  is_flagged?: boolean;

  @ApiPropertyOptional({ description: 'Filter by manually edited sessions' })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  is_manual_edit?: boolean;
}

export class ListMyClockSessionsDto {
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

  @ApiPropertyOptional({
    description: 'Filter by session status',
    enum: ClockSessionStatusFilter,
  })
  @IsOptional()
  @IsEnum(ClockSessionStatusFilter)
  status?: ClockSessionStatusFilter;

  @ApiPropertyOptional({
    description: 'Filter sessions starting from this date (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'Filter sessions ending at this date (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;
}
