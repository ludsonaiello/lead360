import { IsOptional, IsString, MaxLength, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTaskCalendarEventDto {
  @ApiPropertyOptional({
    description: 'Event title',
    example: 'Roof Installation - Day 2',
    maxLength: 300,
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @ApiPropertyOptional({
    description: 'Event description',
    example: 'Continue roof installation',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Event start datetime (ISO 8601)',
    example: '2026-04-06T08:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  start_datetime?: string;

  @ApiPropertyOptional({
    description: 'Event end datetime (ISO 8601)',
    example: '2026-04-06T17:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  end_datetime?: string;
}
