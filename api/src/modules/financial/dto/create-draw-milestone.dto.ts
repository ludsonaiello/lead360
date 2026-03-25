import {
  IsInt,
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  Min,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateDrawMilestoneDto {
  @ApiProperty({
    description: 'Draw number (order of milestone)',
    example: 1,
  })
  @IsInt()
  @Min(1)
  @Type(() => Number)
  draw_number: number;

  @ApiProperty({
    description: 'Milestone description',
    example: 'Deposit',
    maxLength: 255,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  description: string;

  @ApiProperty({
    description: 'Calculation type',
    enum: ['percentage', 'fixed_amount'],
  })
  @IsEnum(['percentage', 'fixed_amount'], {
    message: 'calculation_type must be percentage or fixed_amount',
  })
  calculation_type: 'percentage' | 'fixed_amount';

  @ApiProperty({
    description:
      'Value — percentage (1-100) or fixed dollar amount',
    example: 50.0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Value must be greater than 0' })
  @Type(() => Number)
  value: number;

  @ApiPropertyOptional({
    description:
      'Computed dollar amount — if not provided, computed from value and project.contract_value',
    example: 5000.0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  calculated_amount?: number;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
