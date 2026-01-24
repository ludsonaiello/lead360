import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

/**
 * GetConversionFunnelDto
 *
 * Query parameters for conversion funnel
 */
export class GetConversionFunnelDto {
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
 * FunnelStageDto
 *
 * Single funnel stage
 */
export class FunnelStageDto {
  @ApiProperty({ description: 'Stage name', example: 'Sent' })
  stage: string;

  @ApiProperty({ description: 'Number of quotes at this stage', example: 100 })
  count: number;

  @ApiProperty({ description: 'Total value at this stage', example: 300000.00 })
  total_value: number;

  @ApiProperty({ description: 'Conversion rate to next stage', example: 75.0, nullable: true })
  conversion_to_next: number | null;

  @ApiProperty({ description: 'Drop-off rate', example: 25.0, nullable: true })
  drop_off_rate: number | null;
}

/**
 * ConversionFunnelResponseDto
 *
 * Conversion funnel response
 */
export class ConversionFunnelResponseDto {
  @ApiProperty({ description: 'Funnel stages', type: [FunnelStageDto] })
  funnel: FunnelStageDto[];

  @ApiProperty({ description: 'Overall conversion rate (approved / sent)', example: 56.25 })
  overall_conversion_rate: number;

  @ApiProperty({ description: 'Date range start', example: '2024-01-01T00:00:00.000Z' })
  date_from: string;

  @ApiProperty({ description: 'Date range end', example: '2024-01-31T23:59:59.999Z' })
  date_to: string;
}
