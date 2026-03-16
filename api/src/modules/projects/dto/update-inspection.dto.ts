import {
  IsOptional,
  IsString,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { InspectionResultEnum } from './create-inspection.dto';

export class UpdateInspectionDto {
  @ApiPropertyOptional({
    description: 'Type of inspection',
    example: 'Electrical Rough-In',
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  inspection_type?: string;

  @ApiPropertyOptional({
    description: 'Scheduled date for the inspection (ISO date: YYYY-MM-DD)',
    example: '2026-04-10',
  })
  @IsDateString()
  @IsOptional()
  scheduled_date?: string;

  @ApiPropertyOptional({
    description: 'Name of the inspector',
    example: 'John Inspector',
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  inspector_name?: string;

  @ApiPropertyOptional({
    description: 'Inspection result (pass, fail, conditional, pending). Setting to "fail" auto-sets reinspection_required to true.',
    example: 'pass',
    enum: InspectionResultEnum,
  })
  @IsEnum(InspectionResultEnum, { message: 'Invalid inspection result. Must be: pass, fail, conditional, or pending' })
  @IsOptional()
  result?: InspectionResultEnum;

  @ApiPropertyOptional({
    description: 'Whether a reinspection is required',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  reinspection_required?: boolean;

  @ApiPropertyOptional({
    description: 'Scheduled reinspection date (ISO date: YYYY-MM-DD)',
    example: '2026-04-17',
  })
  @IsDateString()
  @IsOptional()
  reinspection_date?: string;

  @ApiPropertyOptional({
    description: 'Additional notes about the inspection',
    example: 'Failed framing — cross braces missing on south wall',
  })
  @IsString()
  @IsOptional()
  @MaxLength(65535)
  notes?: string;

  @ApiPropertyOptional({
    description: 'UUID of the internal user who performed the inspection',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID('4', { message: 'inspected_by_user_id must be a valid UUID' })
  @IsOptional()
  inspected_by_user_id?: string;
}
