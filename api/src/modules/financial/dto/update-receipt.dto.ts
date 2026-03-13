import {
  IsOptional,
  IsString,
  MaxLength,
  IsDateString,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO for updating receipt metadata (vendor_name, amount, receipt_date).
 * File data, OCR fields, and categorization are NOT updatable here.
 * All fields are optional — only provided fields are updated (PATCH semantics).
 */
export class UpdateReceiptDto {
  @ApiPropertyOptional({
    description: 'Vendor name',
    example: 'Home Depot',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor_name?: string | null;

  @ApiPropertyOptional({
    description: 'Receipt amount in dollars',
    example: 125.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number | null;

  @ApiPropertyOptional({
    description: 'Receipt date (ISO 8601 date string)',
    example: '2026-03-10',
  })
  @IsOptional()
  @IsDateString()
  receipt_date?: string | null;
}
