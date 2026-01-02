import {
  IsString,
  IsBoolean,
  IsDateString,
  IsOptional,
  Matches,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomHoursDto {
  @ApiProperty({
    description: 'Date for custom hours (holidays, special dates)',
    example: '2024-12-25',
  })
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
    description: 'Opening time 1 (if not closed)',
    example: '10:00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:MM format (24-hour)',
  })
  open1?: string;

  @ApiPropertyOptional({
    description: 'Closing time 1 (if not closed)',
    example: '14:00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:MM format (24-hour)',
  })
  close1?: string;

  @ApiPropertyOptional({
    description: 'Opening time 2 (after lunch break)',
    example: null,
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  open2?: string;

  @ApiPropertyOptional({
    description: 'Closing time 2',
    example: null,
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  close2?: string;
}
