import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsIn } from 'class-validator';

export class QuoteTrendsQueryDto {
  @ApiProperty({
    required: true,
    description: 'Start date in ISO 8601 format',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDateString()
  date_from: string;

  @ApiProperty({
    required: true,
    description: 'End date in ISO 8601 format',
    example: '2024-01-31T23:59:59.999Z',
  })
  @IsDateString()
  date_to: string;

  @ApiProperty({
    enum: ['day', 'week', 'month'],
    default: 'day',
    required: false,
    description: 'Grouping interval for trend data',
    example: 'day',
  })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  interval?: 'day' | 'week' | 'month' = 'day';
}
