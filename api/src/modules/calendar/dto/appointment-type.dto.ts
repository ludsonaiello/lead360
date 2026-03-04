import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  Min,
  Max,
  Length,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ============================================
// CREATE APPOINTMENT TYPE DTO
// ============================================

export class CreateAppointmentTypeDto {
  @ApiProperty({
    description: 'Appointment type name',
    example: 'Quote Visit',
    maxLength: 100,
  })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional({
    description: 'Description of the appointment type',
    example: 'Schedule a quote visit with the customer to assess the job',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Duration of each appointment slot in minutes',
    example: 60,
    default: 60,
    minimum: 15,
    maximum: 480,
  })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(480)
  @Type(() => Number)
  slot_duration_minutes?: number;

  @ApiPropertyOptional({
    description: 'Maximum weeks in advance customers can book',
    example: 8,
    default: 8,
    minimum: 1,
    maximum: 52,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  @Type(() => Number)
  max_lookahead_weeks?: number;

  @ApiPropertyOptional({
    description: 'Enable 24-hour reminder',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  reminder_24h_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable 1-hour reminder',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  reminder_1h_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Set as default appointment type for this tenant',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @ApiPropertyOptional({
    description: 'Whether this appointment type is active',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

// ============================================
// UPDATE APPOINTMENT TYPE DTO
// ============================================

export class UpdateAppointmentTypeDto extends PartialType(
  CreateAppointmentTypeDto,
) {}

// ============================================
// LIST APPOINTMENT TYPES DTO
// ============================================

export class ListAppointmentTypesDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by active status',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by default status',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  is_default?: boolean;

  @ApiPropertyOptional({
    description: 'Search by name (partial match)',
    example: 'Quote',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    example: 'created_at',
    default: 'created_at',
    enum: ['name', 'created_at', 'updated_at'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['name', 'created_at', 'updated_at'])
  sort_by?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'desc',
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort_order?: 'asc' | 'desc';
}
