import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsDateString, IsArray, ArrayMinSize } from 'class-validator';

/**
 * ExportDashboardDto
 *
 * Request for exporting dashboard data
 */
export class ExportDashboardDto {
  @ApiProperty({
    description: 'Export format',
    example: 'csv',
    enum: ['csv', 'xlsx', 'pdf'],
  })
  @IsEnum(['csv', 'xlsx', 'pdf'])
  format: 'csv' | 'xlsx' | 'pdf';

  @ApiProperty({
    description: 'Start date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiProperty({
    description: 'End date (ISO 8601)',
    example: '2024-01-31T23:59:59.999Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiProperty({
    description: 'Dashboard sections to include',
    example: ['overview', 'top_items', 'conversion_funnel'],
    type: [String],
    isArray: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  sections: string[];
}

/**
 * ExportDashboardResponseDto
 *
 * Export response with download URL
 */
export class ExportDashboardResponseDto {
  @ApiProperty({
    description: 'File ID in storage',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  file_id: string;

  @ApiProperty({
    description: 'Download URL (presigned)',
    example: 'https://storage.lead360.app/exports/dashboard-2024-01.csv',
  })
  download_url: string;

  @ApiProperty({ description: 'File name', example: 'dashboard-2024-01.csv' })
  filename: string;

  @ApiProperty({ description: 'File size in bytes', example: 45632 })
  file_size: number;

  @ApiProperty({
    description: 'Export format',
    example: 'csv',
    enum: ['csv', 'xlsx', 'pdf'],
  })
  format: string;

  @ApiProperty({
    description: 'Timestamp when export was generated',
    example: '2024-01-20T10:30:00.000Z',
  })
  generated_at: string;

  @ApiProperty({
    description: 'URL expires at (presigned URL expiration)',
    example: '2024-01-20T11:30:00.000Z',
  })
  expires_at: string;
}
