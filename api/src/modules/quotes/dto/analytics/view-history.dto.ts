import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * GetViewHistoryDto
 *
 * Query parameters for view history pagination
 */
export class GetViewHistoryDto {
  @ApiProperty({
    description: 'Page number (1-based)',
    example: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Items per page',
    example: 20,
    required: false,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * ViewLogDto
 *
 * Single view log entry
 */
export class ViewLogDto {
  @ApiProperty({
    description: 'View log ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Quote ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  quote_id: string;

  @ApiProperty({
    description: 'Public access token used',
    example: 'abc123def456',
  })
  public_token: string;

  @ApiProperty({
    description: 'Viewer IP address (anonymized if > 90 days)',
    example: '192.168.1.1',
    nullable: true,
  })
  ip_address: string | null;

  @ApiProperty({
    description: 'Device type',
    example: 'desktop',
    enum: ['desktop', 'mobile', 'tablet', 'unknown'],
    nullable: true,
  })
  device_type: string | null;

  @ApiProperty({
    description: 'Referrer URL',
    example: 'https://example.com/email-link',
    nullable: true,
  })
  referrer_url: string | null;

  @ApiProperty({
    description: 'Viewing duration in seconds',
    example: 120,
    nullable: true,
  })
  view_duration_seconds: number | null;

  @ApiProperty({
    description: 'Timestamp of view',
    example: '2024-01-20T10:30:00.000Z',
  })
  viewed_at: string;
}

/**
 * ViewHistoryResponseDto
 *
 * Paginated response for view history
 */
export class ViewHistoryResponseDto {
  @ApiProperty({
    description: 'View log entries',
    type: [ViewLogDto],
  })
  data: ViewLogDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    example: {
      page: 1,
      limit: 20,
      total: 45,
      total_pages: 3,
    },
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}
