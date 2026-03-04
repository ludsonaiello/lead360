import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for GET /calendar/dashboard/upcoming query parameters
 */
export class GetUpcomingAppointmentsDto {
  @ApiPropertyOptional({
    description: 'Number of upcoming appointments to return',
    minimum: 1,
    maximum: 50,
    default: 5,
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

/**
 * DTO for GET /calendar/dashboard/new query parameters
 */
export class GetNewAppointmentsDto {
  @ApiPropertyOptional({
    description: 'Number of new appointments to return',
    minimum: 1,
    maximum: 50,
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

/**
 * Response DTO for a single upcoming appointment
 */
export class UpcomingAppointmentDto {
  @ApiProperty({
    description: 'Appointment ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'Appointment type name',
    example: 'Quote Visit',
  })
  appointment_type_name: string;

  @ApiProperty({
    description: 'Lead first name',
    example: 'John',
  })
  lead_first_name: string;

  @ApiProperty({
    description: 'Lead last name',
    example: 'Smith',
  })
  lead_last_name: string;

  @ApiProperty({
    description: 'Scheduled date (YYYY-MM-DD)',
    example: '2026-03-05',
  })
  scheduled_date: string;

  @ApiProperty({
    description: 'Start time (HH:MM)',
    example: '09:30',
  })
  start_time: string;

  @ApiProperty({
    description: 'End time (HH:MM)',
    example: '11:00',
  })
  end_time: string;

  @ApiProperty({
    description: 'Address line 1 (if available)',
    example: '123 Main St',
    required: false,
  })
  address?: string;

  @ApiProperty({
    description: 'Appointment status',
    example: 'scheduled',
  })
  status: string;
}

/**
 * Response DTO for upcoming appointments
 */
export class UpcomingAppointmentsResponseDto {
  @ApiProperty({
    description: 'List of upcoming appointments',
    type: [UpcomingAppointmentDto],
  })
  items: UpcomingAppointmentDto[];

  @ApiProperty({
    description: 'Total count of appointments returned',
    example: 5,
  })
  count: number;
}

/**
 * Response DTO for a single new appointment
 */
export class NewAppointmentDto {
  @ApiProperty({
    description: 'Appointment ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  id: string;

  @ApiProperty({
    description: 'Appointment type name',
    example: 'Quote Visit',
  })
  appointment_type_name: string;

  @ApiProperty({
    description: 'Lead first name',
    example: 'John',
  })
  lead_first_name: string;

  @ApiProperty({
    description: 'Lead last name',
    example: 'Smith',
  })
  lead_last_name: string;

  @ApiProperty({
    description: 'Scheduled date (YYYY-MM-DD)',
    example: '2026-03-05',
  })
  scheduled_date: string;

  @ApiProperty({
    description: 'Start time (HH:MM)',
    example: '09:30',
  })
  start_time: string;

  @ApiProperty({
    description: 'End time (HH:MM)',
    example: '11:00',
  })
  end_time: string;

  @ApiProperty({
    description: 'Source of the appointment',
    example: 'voice_ai',
  })
  source: string;

  @ApiProperty({
    description: 'When the appointment was created',
    example: '2026-03-03T10:30:00Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Appointment status',
    example: 'scheduled',
  })
  status: string;
}

/**
 * Response DTO for new appointments
 */
export class NewAppointmentsResponseDto {
  @ApiProperty({
    description: 'List of new unacknowledged appointments',
    type: [NewAppointmentDto],
  })
  items: NewAppointmentDto[];

  @ApiProperty({
    description: 'Total count of new appointments',
    example: 2,
  })
  count: number;
}

/**
 * Response DTO for acknowledge action
 */
export class AcknowledgeAppointmentResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Appointment acknowledged successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Appointment ID that was acknowledged',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  appointment_id: string;

  @ApiProperty({
    description: 'Timestamp when acknowledged',
    example: '2026-03-03T10:30:00Z',
  })
  acknowledged_at: Date;
}
