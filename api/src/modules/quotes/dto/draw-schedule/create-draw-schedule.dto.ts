import {
  IsEnum,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { DrawScheduleEntryDto } from './draw-schedule-entry.dto';

export class CreateDrawScheduleDto {
  @ApiProperty({
    description:
      'Calculation type (percentage entries must sum to 100%, fixed amounts should equal quote total)',
    enum: ['percentage', 'fixed_amount'],
    example: 'percentage',
  })
  @IsEnum(['percentage', 'fixed_amount'], {
    message: 'calculation_type must be either percentage or fixed_amount',
  })
  calculation_type: 'percentage' | 'fixed_amount';

  @ApiProperty({
    description: 'Array of draw schedule entries (1-10 entries allowed)',
    type: [DrawScheduleEntryDto],
    minItems: 1,
    maxItems: 10,
    example: [
      { draw_number: 1, description: 'Initial deposit', value: 30.0 },
      { draw_number: 2, description: 'Midpoint payment', value: 40.0 },
      { draw_number: 3, description: 'Final payment', value: 30.0 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'entries must have at least 1 entry' })
  @ArrayMaxSize(10, { message: 'entries can have maximum 10 entries' })
  @ValidateNested({ each: true })
  @Type(() => DrawScheduleEntryDto)
  entries: DrawScheduleEntryDto[];
}
