import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

/**
 * GetRevenueByVendorDto
 *
 * Query parameters for revenue by vendor
 */
export class GetRevenueByVendorDto {
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
}

/**
 * VendorPerformanceDto
 *
 * Performance metrics for a vendor
 */
export class VendorPerformanceDto {
  @ApiProperty({
    description: 'Vendor ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  vendor_id: string;

  @ApiProperty({ description: 'Vendor name', example: 'ABC Supply Co.' })
  vendor_name: string;

  @ApiProperty({ description: 'Number of quotes', example: 25 })
  quote_count: number;

  @ApiProperty({ description: 'Total revenue', example: 125000.0 })
  total_revenue: number;

  @ApiProperty({ description: 'Average quote value', example: 5000.0 })
  avg_quote_value: number;

  @ApiProperty({ description: 'Approval rate percentage', example: 68.0 })
  approval_rate: number;
}

/**
 * RevenueByVendorResponseDto
 *
 * Revenue by vendor response
 */
export class RevenueByVendorResponseDto {
  @ApiProperty({
    description: 'Vendor performance metrics',
    type: [VendorPerformanceDto],
  })
  vendors: VendorPerformanceDto[];

  @ApiProperty({
    description: 'Date range start',
    example: '2024-01-01T00:00:00.000Z',
  })
  date_from: string;

  @ApiProperty({
    description: 'Date range end',
    example: '2024-01-31T23:59:59.999Z',
  })
  date_to: string;
}
