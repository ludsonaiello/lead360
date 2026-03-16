import {
  IsOptional,
  IsString,
  IsBoolean,
  IsUUID,
  IsDateString,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateProjectLogDto {
  // Multipart file fields — handled by @UploadedFiles() decorator, whitelisted here
  @IsOptional()
  attachments?: any;

  @ApiPropertyOptional({
    description: 'Task UUID this log is associated with (optional context)',
    example: 'uuid-of-task',
  })
  @IsUUID()
  @IsOptional()
  task_id?: string;

  @ApiPropertyOptional({
    description:
      'Date of the log entry (ISO date: YYYY-MM-DD). Defaults to today. PM can backfill past dates.',
    example: '2026-04-05',
  })
  @IsDateString()
  @IsOptional()
  log_date?: string;

  @ApiProperty({
    description: 'Log content (rich text or plain text). Immutable after creation.',
    example: 'Foundation pour completed today. Weather was clear.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Log content is required' })
  @MaxLength(65535)
  content: string;

  @ApiPropertyOptional({
    description: 'Whether this log is visible on the customer portal',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  is_public?: boolean;

  @ApiPropertyOptional({
    description: 'Whether this log records a weather delay',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  weather_delay?: boolean;
}
