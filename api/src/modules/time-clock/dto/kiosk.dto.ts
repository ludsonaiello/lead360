import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class KioskClockInDto {
  @ApiProperty({ description: 'Employee profile ID' })
  @IsString()
  @IsUUID()
  employee_profile_id: string;

  @ApiProperty({ description: 'Kiosk PIN (4-6 digits)', example: '1234' })
  @IsString()
  @MinLength(4)
  @MaxLength(6)
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4-6 digits' })
  pin: string;

  @ApiPropertyOptional({ description: 'Project to clock in for' })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ description: 'Task to clock in for' })
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiPropertyOptional({
    description: 'Notes for the clock-in',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class KioskClockOutDto {
  @ApiProperty({ description: 'Employee profile ID' })
  @IsString()
  @IsUUID()
  employee_profile_id: string;

  @ApiProperty({ description: 'Kiosk PIN (4-6 digits)', example: '1234' })
  @IsString()
  @MinLength(4)
  @MaxLength(6)
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4-6 digits' })
  pin: string;

  @ApiPropertyOptional({
    description: 'Notes for the clock-out',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
