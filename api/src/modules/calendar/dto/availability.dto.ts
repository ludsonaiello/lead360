import { IsString, IsUUID, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Query parameters for GET /calendar/availability endpoint
 */
export class GetAvailabilityDto {
  @ApiProperty({
    description: 'Appointment type ID to check availability for',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true,
  })
  @IsUUID()
  appointment_type_id: string;

  @ApiProperty({
    description: 'Start of date range (YYYY-MM-DD)',
    example: '2026-03-02',
    required: true,
  })
  @IsDateString()
  date_from: string;

  @ApiProperty({
    description:
      'End of date range (YYYY-MM-DD). Max span depends on appointment type max_lookahead_weeks.',
    example: '2026-03-16',
    required: true,
  })
  @IsDateString()
  date_to: string;
}

/**
 * Response DTO for availability endpoint
 * Matches the contract specification exactly
 */
export class AvailabilityResponseDto {
  @ApiProperty({
    description: 'Appointment type information',
    example: {
      id: '123e4567-e89b-12d3-a456-426614174000',
      name: 'Quote Visit',
      slot_duration_minutes: 90,
    },
  })
  appointment_type: {
    id: string;
    name: string;
    slot_duration_minutes: number;
  };

  @ApiProperty({
    description: 'Tenant timezone (IANA timezone identifier)',
    example: 'America/New_York',
  })
  timezone: string;

  @ApiProperty({
    description: 'Date range of the query',
    example: { from: '2026-03-02', to: '2026-03-16' },
  })
  date_range: {
    from: string;
    to: string;
  };

  @ApiProperty({
    description: 'Available dates with slots',
    type: 'array',
    example: [
      {
        date: '2026-03-02',
        day_name: 'Monday',
        slots: [
          { start_time: '08:00', end_time: '09:30' },
          { start_time: '09:30', end_time: '11:00' },
        ],
      },
    ],
  })
  available_dates: Array<{
    date: string;
    day_name: string;
    slots: Array<{
      start_time: string;
      end_time: string;
    }>;
  }>;

  @ApiProperty({
    description: 'Total number of available slots across all dates',
    example: 5,
  })
  total_available_slots: number;
}
