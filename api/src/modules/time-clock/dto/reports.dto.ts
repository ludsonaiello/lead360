import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class TimesheetReportDto {
  @ApiProperty({
    description: 'Start date (inclusive)',
    example: '2026-04-01',
  })
  @IsDateString()
  date_from: string;

  @ApiProperty({
    description: 'End date (inclusive)',
    example: '2026-04-15',
  })
  @IsDateString()
  date_to: string;

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
}

export class PayrollReportDto {
  @ApiProperty({
    description: 'Start date (inclusive)',
    example: '2026-04-01',
  })
  @IsDateString()
  date_from: string;

  @ApiProperty({
    description: 'End date (inclusive)',
    example: '2026-04-15',
  })
  @IsDateString()
  date_to: string;

  @ApiPropertyOptional({ description: 'Filter by employee profile ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;
}

export class ShiftVarianceReportDto {
  @ApiProperty({
    description: 'Start date (inclusive)',
    example: '2026-04-01',
  })
  @IsDateString()
  date_from: string;

  @ApiProperty({
    description: 'End date (inclusive)',
    example: '2026-04-15',
  })
  @IsDateString()
  date_to: string;

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
}

export class GeoViolationsReportDto {
  @ApiProperty({
    description: 'Start date (inclusive)',
    example: '2026-04-01',
  })
  @IsDateString()
  date_from: string;

  @ApiProperty({
    description: 'End date (inclusive)',
    example: '2026-04-15',
  })
  @IsDateString()
  date_to: string;

  @ApiPropertyOptional({ description: 'Filter by employee profile ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;

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
}

export class ActivityFeedDto {
  @ApiPropertyOptional({
    description: 'Number of events to return',
    default: 50,
    minimum: 1,
    maximum: 200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by employee profile ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  employee_profile_id?: string;

  @ApiPropertyOptional({
    description:
      'Cursor: return events strictly before this ISO timestamp (DESC pagination)',
  })
  @IsOptional()
  @IsDateString()
  after?: string;
}
