import { IsOptional, IsNumber, IsDateString, IsString, IsUUID, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCrewHourLogDto {
  @ApiPropertyOptional({ description: 'Task ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiPropertyOptional({ description: 'Log date (ISO format)' })
  @IsOptional()
  @IsDateString()
  log_date?: string;

  @ApiPropertyOptional({ description: 'Regular hours worked (must be > 0)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Regular hours must be greater than 0' })
  hours_regular?: number;

  @ApiPropertyOptional({ description: 'Overtime hours worked' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  hours_overtime?: number;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}
