import { IsString, IsOptional, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Sprint 18: Book Appointment Tool DTO
 *
 * Request DTO for the book_appointment Voice AI tool.
 * Supports two modes:
 * 1. Search mode: Only lead_id (and optional preferred_date) → returns available slots
 * 2. Confirm mode: lead_id + confirmed_date + confirmed_start_time → creates appointment
 */
export class BookAppointmentToolDto {
  @ApiProperty({ example: 'uuid', description: 'Lead ID from create_lead or find_lead tool' })
  @IsString()
  @IsNotEmpty()
  lead_id: string;

  @ApiPropertyOptional({ example: '2026-03-15', description: 'Preferred date (YYYY-MM-DD) - tool searches this date first' })
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'preferred_date must be in YYYY-MM-DD format',
  })
  preferred_date?: string;

  @ApiPropertyOptional({ example: '2026-03-15', description: 'Confirmed date (YYYY-MM-DD) when caller selects a slot' })
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'confirmed_date must be in YYYY-MM-DD format',
  })
  confirmed_date?: string;

  @ApiPropertyOptional({ example: '09:00', description: 'Confirmed start time (HH:MM) when caller selects a slot' })
  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'confirmed_start_time must be in HH:MM format',
  })
  confirmed_start_time?: string;

  @ApiPropertyOptional({ example: 'Customer mentioned they need exterior painting', description: 'Additional notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

/**
 * Response DTO for book_appointment tool
 *
 * Two response modes:
 * 1. Search mode (status: 'availability_found' or 'no_availability')
 * 2. Confirm mode (status: 'appointment_booked')
 */
export class BookAppointmentToolResponseDto {
  @ApiProperty({ description: 'Response status', enum: ['availability_found', 'no_availability', 'appointment_booked', 'error'] })
  status: 'availability_found' | 'no_availability' | 'appointment_booked' | 'error';

  @ApiPropertyOptional({ description: 'Human-readable message for Voice AI to convey to caller' })
  message?: string;

  @ApiPropertyOptional({ description: 'Available slots (search mode)', type: 'array' })
  available_slots?: Array<{
    date: string;
    day_name: string;
    start_time: string;
    end_time: string;
  }>;

  @ApiPropertyOptional({ description: 'Total number of available slots found' })
  total_slots?: number;

  @ApiPropertyOptional({ description: 'Appointment ID (confirm mode)' })
  appointment_id?: string;

  @ApiPropertyOptional({ description: 'Appointment details (confirm mode)' })
  appointment?: {
    id: string;
    appointment_type: string;
    scheduled_date: string;
    start_time: string;
    end_time: string;
    lead_name: string;
  };

  @ApiPropertyOptional({ description: 'Error message if status is error' })
  error?: string;
}
