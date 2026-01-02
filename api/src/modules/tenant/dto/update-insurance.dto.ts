import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  Length,
  Min,
} from 'class-validator';
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
  gl_insurance_provider?: string;

  @ApiPropertyOptional({
    description: 'GL policy number',
    example: 'GL-123456',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  gl_policy_number?: string;

  @ApiPropertyOptional({
    description: 'GL coverage amount',
    example: 1000000,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  gl_coverage_amount?: number;

  @ApiPropertyOptional({
    description: 'GL effective date',
    example: '2024-01-01',
  })
  @IsDateString()
  @IsOptional()
  gl_effective_date?: string;

  @ApiPropertyOptional({
    description: 'GL expiry date',
    example: '2025-01-01',
  })
  @IsDateString()
  @IsOptional()
  gl_expiry_date?: string;

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
  wc_insurance_provider?: string;

  @ApiPropertyOptional({
    description: 'WC policy number',
    example: 'WC-789012',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  wc_policy_number?: string;

  @ApiPropertyOptional({
    description: 'WC coverage amount',
    example: 500000,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  wc_coverage_amount?: number;

  @ApiPropertyOptional({
    description: 'WC effective date',
    example: '2024-01-01',
  })
  @IsDateString()
  @IsOptional()
  wc_effective_date?: string;

  @ApiPropertyOptional({
    description: 'WC expiry date',
    example: '2025-01-01',
  })
  @IsDateString()
  @IsOptional()
  wc_expiry_date?: string;

  @ApiPropertyOptional({
    description: 'WC document file ID',
    example: 'file-uuid',
  })
  @IsString()
  @IsOptional()
  wc_document_file_id?: string;
}
