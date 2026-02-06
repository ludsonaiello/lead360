import { ApiProperty } from '@nestjs/swagger';

/**
 * ViewAnalyticsDto
 *
 * Analytics data for quote views and downloads
 */
export class ViewAnalyticsDto {
  @ApiProperty({
    description: 'Quote UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  quote_id: string;

  @ApiProperty({
    description: 'Current quote status',
    example: 'read',
    enum: [
      'draft',
      'pending_approval',
      'ready',
      'sent',
      'delivered',
      'read',
      'opened',
      'downloaded',
      'approved',
      'started',
      'concluded',
      'denied',
      'lost',
      'email_failed',
    ],
  })
  quote_status: string;

  @ApiProperty({
    description: 'Total number of views',
    example: 25,
  })
  total_views: number;

  @ApiProperty({
    description: 'Number of unique viewers (distinct IP addresses)',
    example: 12,
  })
  unique_viewers: number;

  @ApiProperty({
    description: 'Average viewing duration in seconds',
    example: 145.5,
    nullable: true,
  })
  average_duration_seconds: number | null;

  @ApiProperty({
    description: 'Engagement score (0-100)',
    example: 78,
  })
  engagement_score: number;

  @ApiProperty({
    description: 'Views grouped by date',
    example: [
      { date: '2024-01-20', count: 5 },
      { date: '2024-01-21', count: 8 },
    ],
    type: 'array',
  })
  views_by_date: { date: string; count: number }[];

  @ApiProperty({
    description: 'Views grouped by device type',
    example: {
      desktop: 15,
      mobile: 8,
      tablet: 2,
      unknown: 0,
    },
  })
  views_by_device: {
    desktop: number;
    mobile: number;
    tablet: number;
    unknown: number;
  };

  @ApiProperty({
    description: 'Date of first view',
    example: '2024-01-20T10:30:00.000Z',
    nullable: true,
  })
  first_viewed_at: string | null;

  @ApiProperty({
    description: 'Date of most recent view',
    example: '2024-01-21T15:45:00.000Z',
    nullable: true,
  })
  last_viewed_at: string | null;

  @ApiProperty({
    description: 'Total number of PDF downloads',
    example: 8,
  })
  total_downloads: number;

  @ApiProperty({
    description: 'Downloads grouped by date',
    example: [
      { date: '2024-01-20', count: 3 },
      { date: '2024-01-21', count: 5 },
    ],
    type: 'array',
  })
  downloads_by_date: { date: string; count: number }[];

  @ApiProperty({
    description: 'Downloads grouped by device type',
    example: {
      desktop: 6,
      mobile: 2,
      tablet: 0,
      unknown: 0,
    },
  })
  downloads_by_device: {
    desktop: number;
    mobile: number;
    tablet: number;
    unknown: number;
  };

  @ApiProperty({
    description: 'Date of first PDF download',
    example: '2024-01-20T11:15:00.000Z',
    nullable: true,
  })
  first_downloaded_at: string | null;

  @ApiProperty({
    description: 'Date of most recent PDF download',
    example: '2024-01-21T16:30:00.000Z',
    nullable: true,
  })
  last_downloaded_at: string | null;
}
