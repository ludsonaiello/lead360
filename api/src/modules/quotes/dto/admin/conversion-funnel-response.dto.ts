import { ApiProperty } from '@nestjs/swagger';

export class FunnelStageDto {
  @ApiProperty({ example: 'created', description: 'Funnel stage name' })
  stage: string;

  @ApiProperty({ example: 1000, description: 'Number of quotes at this stage' })
  count: number;

  @ApiProperty({ example: 100.0, description: 'Percentage relative to total created' })
  percentage: number;
}

export class ConversionRatesDto {
  @ApiProperty({ example: 75.5, description: 'Conversion rate from sent to viewed' })
  sent_to_viewed: number;

  @ApiProperty({ example: 56.2, description: 'Conversion rate from viewed to accepted' })
  viewed_to_accepted: number;

  @ApiProperty({ example: 42.5, description: 'Overall conversion rate (accepted / sent)' })
  overall: number;
}

export class ConversionFunnelResponseDto {
  @ApiProperty({ type: [FunnelStageDto], description: 'Funnel stages with counts and percentages' })
  funnel_stages: FunnelStageDto[];

  @ApiProperty({ type: ConversionRatesDto })
  conversion_rates: ConversionRatesDto;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', description: 'Start date of period' })
  date_from: string;

  @ApiProperty({ example: '2024-01-31T23:59:59.999Z', description: 'End date of period' })
  date_to: string;
}
