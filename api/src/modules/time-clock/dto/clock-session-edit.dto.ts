import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

/**
 * Payload for manually editing a clock session.
 *
 * Only Owner / Admin users may submit this DTO. Every field other than
 * `reason` is optional — omitted fields are left untouched. `reason` is
 * mandatory and is copied onto every immutable edit-log entry produced by
 * the edit batch.
 */
export class EditClockSessionDto {
  @ApiPropertyOptional({
    description: 'New clock-in time (ISO 8601)',
    example: '2026-04-10T07:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  clock_in_at?: string;

  @ApiPropertyOptional({
    description: 'New clock-out time (ISO 8601)',
    example: '2026-04-10T15:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  clock_out_at?: string;

  @ApiPropertyOptional({
    description: 'New project ID',
    example: '6d4f6e3e-1c2b-4c4e-9f2d-2b9c9e9a9b1a',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({
    description: 'New task ID',
    example: '7e5c7f4f-2d3c-4d4f-8f3e-3c0d0f0b0c2b',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiPropertyOptional({
    description: 'Updated notes',
    maxLength: 500,
    example: 'Adjusted per badge log review',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({
    description: 'Reason for the edit — REQUIRED, must not be empty',
    maxLength: 500,
    example:
      'Employee reported incorrect start time — corrected from badge log',
  })
  @IsString()
  @IsNotEmpty({ message: 'Edit reason is required' })
  @MaxLength(500)
  reason: string;
}
