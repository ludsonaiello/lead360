import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Sprint 19: Cancel Appointment Tool DTO
 *
 * Request DTO for the cancel_appointment Voice AI tool.
 * Supports two modes:
 * 1. Initial mode: call_log_id + lead_id → verifies identity and returns active appointments
 * 2. Confirm mode: call_log_id + lead_id + appointment_id + reason → executes cancellation
 */
export class CancelAppointmentToolDto {
  @ApiProperty({
    example: 'uuid',
    description: 'Call log ID from current call',
  })
  @IsString()
  @IsNotEmpty()
  call_log_id: string;

  @ApiProperty({
    example: 'uuid',
    description: 'Lead ID requesting cancellation',
  })
  @IsString()
  @IsNotEmpty()
  lead_id: string;

  @ApiPropertyOptional({
    example: 'uuid',
    description: 'Appointment ID to cancel (required in confirm mode)',
  })
  @IsString()
  @IsOptional()
  appointment_id?: string;

  @ApiPropertyOptional({
    example: 'customer_cancelled',
    description:
      'Cancellation reason (optional - defaults to customer_cancelled)',
  })
  @IsString()
  @IsOptional()
  reason?: string;
}

/**
 * Response DTO for cancel_appointment tool
 *
 * Multiple response statuses:
 * 1. verification_failed - caller phone doesn't match lead phone
 * 2. no_appointment_found - lead has no active appointments
 * 3. multiple_appointments - lead has multiple active appointments (must choose one)
 * 4. cancelled - appointment successfully cancelled
 * 5. error - something went wrong
 */
export class CancelAppointmentToolResponseDto {
  @ApiProperty({
    description: 'Response status',
    enum: [
      'verification_failed',
      'no_appointment_found',
      'multiple_appointments',
      'cancelled',
      'error',
    ],
  })
  status:
    | 'verification_failed'
    | 'no_appointment_found'
    | 'multiple_appointments'
    | 'cancelled'
    | 'error';

  @ApiPropertyOptional({
    description: 'Human-readable message for Voice AI to convey to caller',
  })
  message?: string;

  @ApiPropertyOptional({ description: 'Voice AI action guidance' })
  action?: string;

  @ApiPropertyOptional({
    description: 'Available appointments (multiple_appointments mode)',
    type: 'array',
  })
  appointments?: Array<{
    id: string;
    date: string;
    time: string;
    type: string;
  }>;

  @ApiPropertyOptional({
    description: 'Cancelled appointment ID (cancelled mode)',
  })
  appointment_id?: string;

  @ApiPropertyOptional({
    description: 'Cancelled appointment date (cancelled mode)',
  })
  appointment_date?: string;

  @ApiPropertyOptional({
    description: 'Cancelled appointment time (cancelled mode)',
  })
  appointment_time?: string;

  @ApiPropertyOptional({ description: 'Cancellation reason (cancelled mode)' })
  cancellation_reason?: string;

  @ApiPropertyOptional({
    description: 'Whether confirmation was sent (cancelled mode)',
  })
  confirmation_sent?: boolean;

  @ApiPropertyOptional({ description: 'Error message if status is error' })
  error?: string;
}
