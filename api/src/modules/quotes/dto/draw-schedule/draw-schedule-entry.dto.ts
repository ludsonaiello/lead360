import {
  IsInt,
  IsString,
  IsNumber,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DrawScheduleEntryDto {
  @ApiProperty({
    description: 'Draw number (sequential, starting from 1)',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1, { message: 'draw_number must be >= 1' })
  draw_number: number;

  @ApiProperty({
    description: 'Description of what this payment covers',
    example: 'Initial deposit',
    minLength: 5,
    maxLength: 255,
  })
  @IsString()
  @MinLength(5, { message: 'description must be at least 5 characters' })
  @MaxLength(255, { message: 'description must be at most 255 characters' })
  description: string;

  @ApiProperty({
    description: 'Percentage (0-100) or fixed dollar amount',
    example: 30.0,
    minimum: 0,
  })
  @IsNumber()
  @Min(0, { message: 'value must be >= 0' })
  value: number;
}
