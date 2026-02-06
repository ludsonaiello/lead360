import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

export class DashboardOverviewQueryDto {
  @ApiProperty({
    required: false,
    description:
      'Start date in ISO 8601 format (optional, defaults to 30 days ago)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiProperty({
    required: false,
    description: 'End date in ISO 8601 format (optional, defaults to now)',
    example: '2024-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;
}
