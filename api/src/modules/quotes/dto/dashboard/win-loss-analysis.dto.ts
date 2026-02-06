import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

/**
 * GetWinLossAnalysisDto
 *
 * Query parameters for win/loss analysis
 */
export class GetWinLossAnalysisDto {
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
 * LossReasonDto
 *
 * Loss reason breakdown
 */
export class LossReasonDto {
  @ApiProperty({
    description: 'Loss reason',
    example: 'Price too high',
    nullable: true,
  })
  reason: string | null;

  @ApiProperty({
    description: 'Number of quotes lost for this reason',
    example: 12,
  })
  count: number;

  @ApiProperty({ description: 'Percentage of total losses', example: 35.29 })
  percentage: number;
}

/**
 * WinLossAnalysisResponseDto
 *
 * Win/loss analysis response
 */
export class WinLossAnalysisResponseDto {
  @ApiProperty({ description: 'Total number of wins (approved)', example: 45 })
  total_wins: number;

  @ApiProperty({
    description: 'Total number of losses (rejected)',
    example: 34,
  })
  total_losses: number;

  @ApiProperty({ description: 'Win rate percentage', example: 56.96 })
  win_rate: number;

  @ApiProperty({ description: 'Total revenue from wins', example: 450000.0 })
  win_revenue: number;

  @ApiProperty({
    description: 'Potential revenue from losses',
    example: 320000.0,
  })
  loss_revenue: number;

  @ApiProperty({ description: 'Loss reasons breakdown', type: [LossReasonDto] })
  loss_reasons: LossReasonDto[];

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
