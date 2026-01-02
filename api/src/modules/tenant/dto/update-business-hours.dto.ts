import {
  IsString,
  IsBoolean,
  IsOptional,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBusinessHoursDto {
  // Monday
  @ApiPropertyOptional({
    description: 'Monday is closed (true = closed, false = open)',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  monday_closed?: boolean;

  @ApiPropertyOptional({
    description: 'Monday opening time 1 (HH:MM format, 24-hour)',
    example: '08:00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:MM format (24-hour)',
  })
  @ValidateIf((o) => o.monday_closed === false)
  monday_open1?: string;

  @ApiPropertyOptional({
    description: 'Monday closing time 1 (HH:MM format, 24-hour)',
    example: '12:00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:MM format (24-hour)',
  })
  @ValidateIf((o) => o.monday_closed === false)
  monday_close1?: string;

  @ApiPropertyOptional({
    description: 'Monday opening time 2 (after lunch break)',
    example: '13:00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:MM format (24-hour)',
  })
  monday_open2?: string;

  @ApiPropertyOptional({
    description: 'Monday closing time 2',
    example: '17:00',
  })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Time must be in HH:MM format (24-hour)',
  })
  monday_close2?: string;

  // Tuesday
  @ApiPropertyOptional({ description: 'Tuesday is closed (true = closed, false = open)', example: false })
  @IsBoolean()
  @IsOptional()
  tuesday_closed?: boolean;

  @ApiPropertyOptional({ description: 'Tuesday opening time 1', example: '08:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  @ValidateIf((o) => o.tuesday_closed === false)
  tuesday_open1?: string;

  @ApiPropertyOptional({ description: 'Tuesday closing time 1', example: '12:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  @ValidateIf((o) => o.tuesday_closed === false)
  tuesday_close1?: string;

  @ApiPropertyOptional({ description: 'Tuesday opening time 2', example: '13:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  tuesday_open2?: string;

  @ApiPropertyOptional({ description: 'Tuesday closing time 2', example: '17:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  tuesday_close2?: string;

  // Wednesday
  @ApiPropertyOptional({ description: 'Wednesday is closed (true = closed, false = open)', example: false })
  @IsBoolean()
  @IsOptional()
  wednesday_closed?: boolean;

  @ApiPropertyOptional({ description: 'Wednesday opening time 1', example: '08:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  @ValidateIf((o) => o.wednesday_closed === false)
  wednesday_open1?: string;

  @ApiPropertyOptional({ description: 'Wednesday closing time 1', example: '12:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  @ValidateIf((o) => o.wednesday_closed === false)
  wednesday_close1?: string;

  @ApiPropertyOptional({ description: 'Wednesday opening time 2', example: '13:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  wednesday_open2?: string;

  @ApiPropertyOptional({ description: 'Wednesday closing time 2', example: '17:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  wednesday_close2?: string;

  // Thursday
  @ApiPropertyOptional({ description: 'Thursday is closed (true = closed, false = open)', example: false })
  @IsBoolean()
  @IsOptional()
  thursday_closed?: boolean;

  @ApiPropertyOptional({ description: 'Thursday opening time 1', example: '08:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  @ValidateIf((o) => o.thursday_closed === false)
  thursday_open1?: string;

  @ApiPropertyOptional({ description: 'Thursday closing time 1', example: '12:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  @ValidateIf((o) => o.thursday_closed === false)
  thursday_close1?: string;

  @ApiPropertyOptional({ description: 'Thursday opening time 2', example: '13:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  thursday_open2?: string;

  @ApiPropertyOptional({ description: 'Thursday closing time 2', example: '17:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  thursday_close2?: string;

  // Friday
  @ApiPropertyOptional({ description: 'Friday is closed (true = closed, false = open)', example: false })
  @IsBoolean()
  @IsOptional()
  friday_closed?: boolean;

  @ApiPropertyOptional({ description: 'Friday opening time 1', example: '08:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  @ValidateIf((o) => o.friday_closed === false)
  friday_open1?: string;

  @ApiPropertyOptional({ description: 'Friday closing time 1', example: '12:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  @ValidateIf((o) => o.friday_closed === false)
  friday_close1?: string;

  @ApiPropertyOptional({ description: 'Friday opening time 2', example: '13:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  friday_open2?: string;

  @ApiPropertyOptional({ description: 'Friday closing time 2', example: '17:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  friday_close2?: string;

  // Saturday
  @ApiPropertyOptional({ description: 'Saturday is closed (true = closed, false = open)', example: true })
  @IsBoolean()
  @IsOptional()
  saturday_closed?: boolean;

  @ApiPropertyOptional({ description: 'Saturday opening time 1', example: '09:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  @ValidateIf((o) => o.saturday_closed === false)
  saturday_open1?: string;

  @ApiPropertyOptional({ description: 'Saturday closing time 1', example: '13:00' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  @ValidateIf((o) => o.saturday_closed === false)
  saturday_close1?: string;

  @ApiPropertyOptional({ description: 'Saturday opening time 2' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  saturday_open2?: string;

  @ApiPropertyOptional({ description: 'Saturday closing time 2' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  saturday_close2?: string;

  // Sunday
  @ApiPropertyOptional({ description: 'Sunday is closed (true = closed, false = open)', example: true })
  @IsBoolean()
  @IsOptional()
  sunday_closed?: boolean;

  @ApiPropertyOptional({ description: 'Sunday opening time 1' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  @ValidateIf((o) => o.sunday_closed === false)
  sunday_open1?: string;

  @ApiPropertyOptional({ description: 'Sunday closing time 1' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  @ValidateIf((o) => o.sunday_closed === false)
  sunday_close1?: string;

  @ApiPropertyOptional({ description: 'Sunday opening time 2' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  sunday_open2?: string;

  @ApiPropertyOptional({ description: 'Sunday closing time 2' })
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  sunday_close2?: string;

  // NOTE: Complex time validation (open1 < close1, close1 < open2, open2 < close2)
  // will be implemented in the service layer
}
