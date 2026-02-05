import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsIn } from 'class-validator';

export class RevenueAnalyticsQueryDto {
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
    enum: ['vendor', 'tenant', 'none'],
    default: 'none',
    required: false,
    description: 'Group revenue by vendor, tenant, or no grouping',
    example: 'vendor',
  })
  @IsOptional()
  @IsIn(['vendor', 'tenant', 'none'])
  group_by?: 'vendor' | 'tenant' | 'none' = 'none';
}
