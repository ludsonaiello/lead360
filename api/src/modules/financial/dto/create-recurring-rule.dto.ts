import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsDateString,
  MaxLength,
  Min,
  Max,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum RecurringFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
}

export class CreateRecurringRuleDto {
  @ApiProperty({
    description: 'Human-readable rule name',
    example: 'Monthly Liability Insurance',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'Internal description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'FK to financial_category',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsNotEmpty()
  category_id: string;

  @ApiProperty({
    description: 'Fixed amount per occurrence',
    example: 1850.0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @ApiPropertyOptional({
    description: 'Tax per occurrence',
    example: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  tax_amount?: number;

  @ApiPropertyOptional({ description: 'FK to supplier' })
  @IsOptional()
  @IsUUID()
  supplier_id?: string;

  @ApiPropertyOptional({
    description: 'Free-text vendor fallback',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor_name?: string;

  @ApiPropertyOptional({ description: 'FK to payment_method_registry' })
  @IsOptional()
  @IsUUID()
  payment_method_registry_id?: string;

  @ApiProperty({
    description: 'Recurrence frequency',
    enum: RecurringFrequency,
    example: 'monthly',
  })
  @IsEnum(RecurringFrequency)
  @IsNotEmpty()
  frequency: RecurringFrequency;

  @ApiPropertyOptional({
    description: 'Every N frequencies (default 1)',
    example: 1,
    minimum: 1,
    maximum: 12,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  interval?: number;

  @ApiPropertyOptional({
    description: 'Day of month for monthly/quarterly/annual (1-28)',
    minimum: 1,
    maximum: 28,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  @Type(() => Number)
  day_of_month?: number;

  @ApiPropertyOptional({
    description: 'Day of week for weekly (0=Sunday, 6=Saturday)',
    minimum: 0,
    maximum: 6,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  @Type(() => Number)
  day_of_week?: number;

  @ApiProperty({
    description: 'First date this rule becomes active (YYYY-MM-DD)',
    example: '2026-04-01',
  })
  @IsDateString()
  @IsNotEmpty()
  start_date: string;

  @ApiPropertyOptional({
    description: 'Optional end date (YYYY-MM-DD)',
    example: '2027-03-31',
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({
    description: 'Max occurrences before auto-complete',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  recurrence_count?: number;

  @ApiPropertyOptional({
    description:
      'If true, generated entries are confirmed. If false, pending_review.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  auto_confirm?: boolean;

  @ApiPropertyOptional({ description: 'Notes passed into generated entries' })
  @IsOptional()
  @IsString()
  notes?: string;
}
