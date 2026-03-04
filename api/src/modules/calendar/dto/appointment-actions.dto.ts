import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  Matches,
  Length,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ============================================
// ENUMS for Appointment Status and Cancellation Reason
// ============================================

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
  RESCHEDULED = 'rescheduled',
}

export enum CancellationReason {
  CUSTOMER_CANCELLED = 'customer_cancelled',
  BUSINESS_CANCELLED = 'business_cancelled',
  NO_SHOW = 'no_show',
  RESCHEDULED = 'rescheduled',
  OTHER = 'other',
}

// ============================================
// CANCEL APPOINTMENT DTO
// ============================================

export class CancelAppointmentDto {
  @ApiProperty({
    description: 'Reason for cancellation',
    example: 'customer_cancelled',
    enum: CancellationReason,
  })
  @IsEnum(CancellationReason)
  cancellation_reason: CancellationReason;

  @ApiPropertyOptional({
    description:
      'Additional notes about the cancellation (required if reason is "other")',
    example: 'Customer found another contractor',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  cancellation_notes?: string;
}

// ============================================
// RESCHEDULE APPOINTMENT DTO
// ============================================

export class RescheduleAppointmentDto {
  @ApiProperty({
    description: 'New scheduled date in YYYY-MM-DD format',
    example: '2026-03-20',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'new_scheduled_date must be in YYYY-MM-DD format',
  })
  new_scheduled_date: string;

  @ApiProperty({
    description: 'New start time in HH:mm format (24-hour)',
    example: '10:30',
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'new_start_time must be in HH:mm format (24-hour)',
  })
  new_start_time: string;

  @ApiPropertyOptional({
    description: 'Reason for rescheduling (optional)',
    example: 'Customer requested different time',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;
}

// ============================================
// COMPLETE APPOINTMENT DTO
// ============================================

export class CompleteAppointmentDto {
  @ApiPropertyOptional({
    description: 'Completion notes (optional)',
    example: 'Quote delivered, customer requested follow-up',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @Length(0, 2000)
  completion_notes?: string;
}

// ============================================
// NO SHOW APPOINTMENT DTO
// ============================================

export class NoShowAppointmentDto {
  @ApiPropertyOptional({
    description: 'Notes about the no-show (optional)',
    example: 'Called customer, no answer. Waited 15 minutes.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  notes?: string;
}

// ============================================
// CONFIRM APPOINTMENT DTO
// ============================================

export class ConfirmAppointmentDto {
  @ApiPropertyOptional({
    description: 'Confirmation notes (optional)',
    example: 'Confirmed via phone call',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}
