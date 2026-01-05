import {
  IsString,
  IsBoolean,
  IsDateString,
  IsOptional,
  Matches,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SanitizeDate } from '../../../common/validators/formatted-inputs';

export class CreateCustomHoursDto {
  @ApiProperty({
    description: 'Date for custom hours (holidays, special dates)',
    example: '2024-12-25',
  })
  @SanitizeDate()
  @IsDateString()
  date: string;

  @ApiProperty({
    description: 'Reason for custom hours (e.g., holiday name)',
    example: 'Christmas Day',
  })
  @IsString()
  @Length(1, 255)
  reason: string;

  @ApiProperty({
    description: 'Is the business closed on this date?',
    example: true,
  })
  @IsBoolean()
  closed: boolean;

  @ApiPropertyOptional({
    description: 'First shift opening time (if not closed)',
    example: '09:00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:MM format (24-hour)',
  })
  open_time1?: string;

  @ApiPropertyOptional({
    description: 'First shift closing time (if not closed)',
    example: '12:00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:MM format (24-hour)',
  })
  close_time1?: string;

  @ApiPropertyOptional({
    description: 'Second shift opening time (after lunch break)',
    example: '13:00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:MM format (24-hour)',
  })
  open_time2?: string;

  @ApiPropertyOptional({
    description: 'Second shift closing time',
    example: '17:00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:MM format (24-hour)',
  })
  close_time2?: string;
}
