import {
  IsOptional,
  IsString,
  IsBoolean,
  IsUUID,
  IsDateString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UploadProjectPhotoDto {
  // File field from multipart/form-data — handled by @UploadedFile() decorator
  @IsOptional()
  file?: any;

  @ApiPropertyOptional({
    description: 'Task UUID this photo is associated with',
    example: 'uuid-of-task',
  })
  @IsUUID()
  @IsOptional()
  task_id?: string;

  @ApiPropertyOptional({
    description: 'Caption for the photo',
    example: 'Foundation pour complete',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  caption?: string;

  @ApiPropertyOptional({
    description: 'Whether this photo is visible on the customer portal',
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
    description: 'When the photo was taken (ISO date: YYYY-MM-DD)',
    example: '2026-03-10',
  })
  @IsDateString()
  @IsOptional()
  taken_at?: string;
}
