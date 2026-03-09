import { IsString, IsOptional, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Sprint 19: Reschedule Appointment Tool DTO
 *
 * Request DTO for the reschedule_appointment Voice AI tool.
 * Supports two modes:
 * 1. Initial mode: call_log_id + lead_id → verifies identity and returns current appointment + available slots
 * 2. Confirm mode: call_log_id + lead_id + appointment_id + new_date + new_time → executes reschedule
 */
export class RescheduleAppointmentToolDto {
  @ApiProperty({
    example: 'uuid',
    description: 'Call log ID from current call',
  })
  @IsString()
  @IsNotEmpty()
  call_log_id: string;

  @ApiProperty({
    example: 'uuid',
    description: 'Lead ID requesting reschedule',
  })
  @IsString()
  @IsNotEmpty()
  lead_id: string;

  @ApiPropertyOptional({
    example: 'uuid',
    description: 'Appointment ID to reschedule (required in confirm mode)',
  })
  @IsString()
  @IsOptional()
  appointment_id?: string;

  @ApiPropertyOptional({
    example: '2026-03-15',
    description: 'New appointment date (YYYY-MM-DD) - used in confirm mode',
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'new_date must be in YYYY-MM-DD format',
  })
  new_date?: string;

  @ApiPropertyOptional({
    example: '10:30',
    description: 'New start time (HH:MM) - used in confirm mode',
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'new_time must be in HH:MM format',
  })
  new_time?: string;
}

/**
 * Response DTO for reschedule_appointment tool
 *
 * Multiple response statuses:
 * 1. verification_failed - caller phone doesn't match lead phone
 * 2. no_appointment_found - lead has no active appointments
 * 3. multiple_appointments - lead has multiple active appointments (must choose one)
 * 4. slots_available - current appointment + available slots returned
 * 5. rescheduled - appointment successfully moved
 * 6. error - something went wrong
 */
export class RescheduleAppointmentToolResponseDto {
  @ApiProperty({
    description: 'Response status',
    enum: [
      'verification_failed',
      'no_appointment_found',
      'multiple_appointments',
      'slots_available',
      'rescheduled',
      'error',
    ],
  })
  status:
    | 'verification_failed'
    | 'no_appointment_found'
    | 'multiple_appointments'
    | 'slots_available'
    | 'rescheduled'
    | 'error';

  @ApiPropertyOptional({
    description: 'Human-readable message for Voice AI to convey to caller',
  })
  message?: string;

  @ApiPropertyOptional({ description: 'Voice AI action guidance' })
  action?: string;

  @ApiPropertyOptional({
    description: 'Current appointment details (slots_available mode)',
  })
  current_appointment?: {
    id: string;
    date: string;
    time: string;
    type: string;
  };

  @ApiPropertyOptional({
    description: 'Available appointments (multiple_appointments mode)',
  })
  appointments?: Array<{
    id: string;
    date: string;
    time: string;
    type: string;
  }>;

  @ApiPropertyOptional({
    description: 'Available slots for rescheduling (slots_available mode)',
    type: 'array',
  })
  available_slots?: Array<{
    date: string;
    day_name: string;
    slots: Array<{
      start_time: string;
      end_time: string;
    }>;
  }>;

  @ApiPropertyOptional({
    description: 'New appointment ID after reschedule (rescheduled mode)',
  })
  new_appointment_id?: string;

  @ApiPropertyOptional({ description: 'Old appointment ID (rescheduled mode)' })
  old_appointment_id?: string;

  @ApiPropertyOptional({
    description: 'Whether confirmation was sent (rescheduled mode)',
  })
  confirmation_sent?: boolean;

  @ApiPropertyOptional({ description: 'Error message if status is error' })
  error?: string;
}
