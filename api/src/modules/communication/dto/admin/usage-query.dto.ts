import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, Matches } from 'class-validator';

/**
 * Usage Query DTO
 *
 * Query parameters for retrieving usage statistics and reports.
 *
 * @class UsageQueryDto
 */
export class UsageQueryDto {
  @ApiProperty({
    required: false,
    description: 'Month in YYYY-MM format',
    example: '2026-01',
    pattern: '^\\d{4}-\\d{2}$',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'Month must be in YYYY-MM format (e.g., 2026-01)',
  })
  month?: string;

  @ApiProperty({
    required: false,
    description: 'Start date for custom date range (ISO 8601)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiProperty({
    required: false,
    description: 'End date for custom date range (ISO 8601)',
    example: '2026-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  end_date?: string;
}

/**
 * Cost Query DTO
 *
 * Query parameters for cost estimation endpoints.
 *
 * @class CostQueryDto
 */
export class CostQueryDto {
  @ApiProperty({
    description: 'Month in YYYY-MM format',
    example: '2026-01',
    pattern: '^\\d{4}-\\d{2}$',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'Month must be in YYYY-MM format (e.g., 2026-01)',
  })
  month: string;
}
