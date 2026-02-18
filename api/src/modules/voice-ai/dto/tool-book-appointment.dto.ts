import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsIn,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ToolBookAppointmentDto {
  @ApiProperty({ description: 'Call log ID from /calls/start' })
  @IsString()
  @IsNotEmpty()
  call_log_id: string;

  @ApiPropertyOptional({ description: 'Lead UUID from create_lead tool' })
  @IsOptional()
  @IsString()
  lead_id?: string;

  @ApiProperty({
    description: 'Slot chosen by caller from check_availability response',
    enum: ['slot_1', 'slot_2', 'slot_3'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['slot_1', 'slot_2', 'slot_3'])
  slot_id: string;

  @ApiProperty({
    description:
      'Base date used in check_availability call (YYYY-MM-DD) — used to reconstruct actual datetime',
    example: '2026-03-01',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'preferred_date must be YYYY-MM-DD',
  })
  preferred_date: string;

  @ApiPropertyOptional({ example: 'Plumbing' })
  @IsOptional()
  @IsString()
  service_type?: string;

  @ApiPropertyOptional({ example: 'Kitchen sink is leaking under the cabinet' })
  @IsOptional()
  @IsString()
  service_description?: string;

  @ApiPropertyOptional({ example: 'Morning preferred, dog will be home' })
  @IsOptional()
  @IsString()
  notes?: string;
}
