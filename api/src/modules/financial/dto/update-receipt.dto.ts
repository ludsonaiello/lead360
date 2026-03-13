import {
  IsOptional,
  IsString,
  MaxLength,
  IsDateString,
  IsNumber,
  IsPositive,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * DTO for updating receipt metadata (vendor_name, amount, receipt_date).
 * File data, OCR fields, and categorization are NOT updatable here.
 * All fields are optional — only provided fields are updated (PATCH semantics).
 *
 * Nullable fields: send `null` to clear a value.
 * Note: We use @ValidateIf instead of @Type(() => Number) for `amount`
 *       because @Type converts null → 0, which then fails @IsPositive().
 */
export class UpdateReceiptDto {
  @ApiPropertyOptional({
    description: 'Vendor name (send null to clear)',
    example: 'Home Depot',
    maxLength: 200,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  vendor_name?: string | null;

  @ApiPropertyOptional({
    description: 'Receipt amount in dollars (send null to clear)',
    example: 125.5,
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(({ value }) => {
    if (value === null || value === undefined) return value;
    return Number(value);
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number | null;

  @ApiPropertyOptional({
    description: 'Receipt date (ISO 8601 date string, send null to clear)',
    example: '2026-03-10',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  receipt_date?: string | null;
}
