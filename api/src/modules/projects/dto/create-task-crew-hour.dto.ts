import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for logging crew hours from task context.
 * project_id and task_id are extracted from URL params — never from client body.
 */
export class CreateTaskCrewHourDto {
  @ApiProperty({
    description: 'Crew member ID (must be assigned to this tenant)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsString()
  @IsUUID()
  crew_member_id: string;

  @ApiProperty({
    description: 'Date the hours were worked (ISO date format)',
    example: '2026-03-15',
  })
  @IsDateString()
  log_date: string;

  @ApiProperty({
    description: 'Regular hours worked (must be > 0)',
    example: 8.0,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Regular hours must be greater than 0' })
  hours_regular: number;

  @ApiPropertyOptional({
    description: 'Overtime hours worked (defaults to 0)',
    example: 2.0,
    default: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hours_overtime?: number;

  @ApiPropertyOptional({
    description: 'Additional notes about the hours logged',
    example: 'Framing work on unit 3B',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
