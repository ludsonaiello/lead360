import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PreviewType } from './preview-template.dto';

export class TestPdfDto {
  @ApiProperty({
    enum: PreviewType,
    default: PreviewType.STANDARD,
    description: 'Type of sample data to use for PDF generation',
  })
  @IsEnum(PreviewType)
  preview_type: PreviewType;

  @ApiProperty({
    required: false,
    description: 'Quote ID to use for PDF generation (use real quote data)',
  })
  @IsOptional()
  @IsUUID()
  quote_id?: string;
}

export class TestPdfResponseDto {
  @ApiProperty({
    description: 'Temporary PDF download URL (expires after 15 minutes)',
  })
  pdf_url: string;

  @ApiProperty({ description: 'PDF file size in bytes' })
  file_size_bytes: number;

  @ApiProperty({ description: 'PDF generation time in milliseconds' })
  generation_time_ms: number;

  @ApiProperty({ description: 'PDF expiration timestamp' })
  expires_at: string;

  @ApiProperty({
    type: [String],
    required: false,
    description: 'Warnings detected during PDF generation',
  })
  warnings?: string[];
}
