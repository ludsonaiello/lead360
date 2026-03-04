import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsIn,
  Matches,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ============================================
// CREATE APPOINTMENT DTO
// ============================================

export class CreateAppointmentDto {
  @ApiProperty({
    description: 'Appointment type ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  appointment_type_id: string;

  @ApiProperty({
    description: 'Lead ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID('4')
  lead_id: string;

  @ApiPropertyOptional({
    description: 'Service request ID (optional)',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID('4')
  service_request_id?: string;

  @ApiProperty({
    description: 'Scheduled date in YYYY-MM-DD format',
    example: '2026-03-15',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'scheduled_date must be in YYYY-MM-DD format',
  })
  scheduled_date: string;

  @ApiProperty({
    description: 'Start time in HH:mm format (24-hour)',
    example: '09:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'start_time must be in HH:mm format (24-hour)',
  })
  start_time: string;

  @ApiProperty({
    description: 'End time in HH:mm format (24-hour)',
    example: '10:00',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'end_time must be in HH:mm format (24-hour)',
  })
  end_time: string;

  @ApiPropertyOptional({
    description: 'Appointment notes',
    example: 'Customer prefers morning appointments',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Assigned user ID (optional)',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsOptional()
  @IsUUID('4')
  assigned_user_id?: string;

  @ApiPropertyOptional({
    description: 'Appointment source (Sprint 18: for Voice AI booking)',
    example: 'manual',
    enum: ['voice_ai', 'manual', 'system'],
    default: 'manual',
  })
  @IsOptional()
  @IsIn(['voice_ai', 'manual', 'system'])
  source?: 'voice_ai' | 'manual' | 'system';
}

// ============================================
// UPDATE APPOINTMENT DTO (Sprint 05a: notes and assigned_user only)
// ============================================

export class UpdateAppointmentDto {
  @ApiPropertyOptional({
    description: 'Appointment notes',
    example: 'Updated notes about the appointment',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Assigned user ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsOptional()
  @IsUUID('4')
  assigned_user_id?: string;
}

// ============================================
// LIST APPOINTMENTS DTO
// ============================================

export class ListAppointmentsDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 50,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by appointment status',
    example: 'scheduled',
    enum: ['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by lead ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID('4')
  lead_id?: string;

  @ApiPropertyOptional({
    description: 'Filter appointments starting from this date (YYYY-MM-DD)',
    example: '2026-03-01',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date_from must be in YYYY-MM-DD format',
  })
  date_from?: string;

  @ApiPropertyOptional({
    description: 'Filter appointments up to this date (YYYY-MM-DD)',
    example: '2026-03-31',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date_to must be in YYYY-MM-DD format',
  })
  date_to?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    example: 'scheduled_date',
    default: 'scheduled_date',
    enum: ['scheduled_date', 'created_at', 'updated_at'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['scheduled_date', 'created_at', 'updated_at'])
  sort_by?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'asc',
    default: 'asc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort_order?: 'asc' | 'desc';
}
