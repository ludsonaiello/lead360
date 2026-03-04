import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Query parameters for GET /calendar/external-blocks endpoint
 * Sprint 13B: External Block Management
 */
export class GetExternalBlocksDto {
  @ApiProperty({
    description: 'Start of date range (YYYY-MM-DD)',
    example: '2026-03-02',
    required: true,
  })
  @IsDateString()
  date_from: string;

  @ApiProperty({
    description: 'End of date range (YYYY-MM-DD)',
    example: '2026-03-16',
    required: true,
  })
  @IsDateString()
  date_to: string;

  @ApiProperty({
    description:
      'Optional appointment type ID to filter (currently not used, reserved for future)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  appointment_type_id?: string;
}

/**
 * External Block DTO
 * Represents a time block from external calendar (e.g., Google Calendar)
 */
export class ExternalBlockDto {
  @ApiProperty({
    description: 'External block ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Block start time in UTC (ISO 8601)',
    example: '2026-03-15T14:00:00.000Z',
  })
  start_datetime_utc: string;

  @ApiProperty({
    description: 'Block end time in UTC (ISO 8601)',
    example: '2026-03-15T15:30:00.000Z',
  })
  end_datetime_utc: string;

  @ApiProperty({
    description: 'Whether this is an all-day event',
    example: false,
  })
  is_all_day: boolean;

  @ApiProperty({
    description: 'Source of the external block',
    example: 'google_calendar',
  })
  source: string;
}

/**
 * Response DTO for external blocks endpoint
 */
export class ExternalBlocksResponseDto {
  @ApiProperty({
    description: 'Date range of the query',
    example: { from: '2026-03-02', to: '2026-03-16' },
  })
  date_range: {
    from: string;
    to: string;
  };

  @ApiProperty({
    description: 'List of external calendar blocks in the date range',
    type: [ExternalBlockDto],
    example: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        start_datetime_utc: '2026-03-15T14:00:00.000Z',
        end_datetime_utc: '2026-03-15T15:30:00.000Z',
        is_all_day: false,
        source: 'google_calendar',
      },
    ],
  })
  data: ExternalBlockDto[];

  @ApiProperty({
    description: 'Total number of external blocks found',
    example: 3,
  })
  total_blocks: number;
}
