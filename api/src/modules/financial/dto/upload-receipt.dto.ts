import {
  IsOptional,
  IsUUID,
  IsString,
  MaxLength,
  IsDateString,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO for the multipart/form-data body fields when uploading a receipt.
 * The actual file is handled by @UploadedFile() — not declared here.
 *
 * Accepted file types: jpg, png, webp, pdf
 * Max file size: 25 MB (enforced by FilesService via 'receipt' category rules)
 */
export class UploadReceiptDto {
  @ApiPropertyOptional({
    description: 'Project ID this receipt belongs to',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({
    description: 'Task ID this receipt belongs to (must belong to project_id)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567891',
  })
  @IsOptional()
  @IsUUID()
  task_id?: string;

  @ApiPropertyOptional({
    description: 'Vendor name (manually entered at upload time)',
    example: 'Home Depot',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor_name?: string;

  @ApiPropertyOptional({
    description: 'Receipt amount in dollars (manually entered at upload time)',
    example: 125.5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @ApiPropertyOptional({
    description: 'Receipt date (ISO 8601 date string, e.g. 2026-03-10)',
    example: '2026-03-10',
  })
  @IsOptional()
  @IsDateString()
  receipt_date?: string;
}
