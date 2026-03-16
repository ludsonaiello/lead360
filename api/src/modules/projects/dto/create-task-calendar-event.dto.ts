import { IsNotEmpty, IsOptional, IsString, MaxLength, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTaskCalendarEventDto {
  @ApiProperty({
    description: 'Event title',
    example: 'Roof Installation - Day 1',
    maxLength: 300,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  title: string;

  @ApiPropertyOptional({
    description: 'Event description',
    example: 'Start roof tear-off and prep underlayment',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Event start datetime (ISO 8601)',
    example: '2026-04-05T08:00:00.000Z',
  })
  @IsNotEmpty()
  @IsDateString()
  start_datetime: string;

  @ApiProperty({
    description: 'Event end datetime (ISO 8601)',
    example: '2026-04-05T17:00:00.000Z',
  })
  @IsNotEmpty()
  @IsDateString()
  end_datetime: string;
}
