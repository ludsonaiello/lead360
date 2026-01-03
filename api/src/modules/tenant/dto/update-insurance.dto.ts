import {
  IsString,
  IsOptional,
  IsNumber,
  IsDate,
  Length,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateInsuranceDto {
  // General Liability Insurance
  @ApiPropertyOptional({
    description: 'GL insurance provider name',
    example: 'State Farm',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  gl_insurance_provider?: string;

  @ApiPropertyOptional({
    description: 'GL policy number',
    example: 'GL-123456',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  gl_policy_number?: string;

  @ApiPropertyOptional({
    description: 'GL coverage amount',
    example: 1000000,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  gl_coverage_amount?: number;

  @ApiPropertyOptional({
    description: 'GL effective date (ISO 8601 format)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDate()
  @Transform(({ value }) => {
    if (!value) return value;
    // Convert to Date object at noon UTC to avoid timezone issues
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    date.setUTCHours(12, 0, 0, 0);
    return date;
  })
  gl_effective_date?: Date;

  @ApiPropertyOptional({
    description: 'GL expiry date (ISO 8601 format)',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDate()
  @Transform(({ value }) => {
    if (!value) return value;
    // Convert to Date object at noon UTC to avoid timezone issues
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    date.setUTCHours(12, 0, 0, 0);
    return date;
  })
  gl_expiry_date?: Date;

  @ApiPropertyOptional({
    description: 'GL document file ID',
    example: 'file-uuid',
  })
  @IsString()
  @IsOptional()
  gl_document_file_id?: string;

  // Workers Compensation Insurance
  @ApiPropertyOptional({
    description: 'WC insurance provider name',
    example: 'Hartford',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  wc_insurance_provider?: string;

  @ApiPropertyOptional({
    description: 'WC policy number',
    example: 'WC-789012',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  wc_policy_number?: string;

  @ApiPropertyOptional({
    description: 'WC coverage amount',
    example: 500000,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  wc_coverage_amount?: number;

  @ApiPropertyOptional({
    description: 'WC effective date (ISO 8601 format)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDate()
  @Transform(({ value }) => {
    if (!value) return value;
    // Convert to Date object at noon UTC to avoid timezone issues
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    date.setUTCHours(12, 0, 0, 0);
    return date;
  })
  wc_effective_date?: Date;

  @ApiPropertyOptional({
    description: 'WC expiry date (ISO 8601 format)',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDate()
  @Transform(({ value }) => {
    if (!value) return value;
    // Convert to Date object at noon UTC to avoid timezone issues
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    date.setUTCHours(12, 0, 0, 0);
    return date;
  })
  wc_expiry_date?: Date;

  @ApiPropertyOptional({
    description: 'WC document file ID',
    example: 'file-uuid',
  })
  @IsString()
  @IsOptional()
  wc_document_file_id?: string;
}
