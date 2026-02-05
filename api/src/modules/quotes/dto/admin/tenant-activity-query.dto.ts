import { IsOptional, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * TenantActivityQueryDto
 *
 * Query parameters for tenant activity timeline
 * Supports date range filtering and result limiting
 */
export class TenantActivityQueryDto {
  @ApiProperty({
    required: false,
    description: 'Start date in ISO 8601 format',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiProperty({
    required: false,
    description: 'End date in ISO 8601 format',
    example: '2024-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiProperty({
    default: 50,
    minimum: 1,
    maximum: 200,
    description: 'Maximum number of activity events to return',
    required: false,
    example: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  limit?: number = 50;
}
