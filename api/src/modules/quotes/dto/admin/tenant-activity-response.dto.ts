import { ApiProperty } from '@nestjs/swagger';

/**
 * ActivityUserDto
 *
 * User who performed the action
 */
export class ActivityUserDto {
  @ApiProperty({ example: 'John Doe', description: 'User full name' })
  name: string;
}

/**
 * ActivityEventDto
 *
 * Single activity event from audit log
 */
export class ActivityEventDto {
  @ApiProperty({
    example: '2024-01-15T10:30:00.000Z',
    description: 'Event timestamp (ISO 8601)',
  })
  timestamp: string;

  @ApiProperty({
    example: 'quote_created',
    description: 'Event type (action_type from audit_log)',
  })
  event_type: string;

  @ApiProperty({
    example: 'Quote Q-12345 created for ABC Construction',
    description: 'Event description',
  })
  description: string;

  @ApiProperty({ type: ActivityUserDto, description: 'User who performed action' })
  user: ActivityUserDto;

  @ApiProperty({
    example: { quote_id: 'uuid-123', quote_number: 'Q-12345' },
    description: 'Additional event metadata',
  })
  metadata: object;
}

/**
 * ActivitySummaryDto
 *
 * Summary statistics for activity timeline
 */
export class ActivitySummaryDto {
  @ApiProperty({ example: 342, description: 'Total number of events in period' })
  total_events: number;

  @ApiProperty({
    example: 'John Doe',
    description: 'User with most activity (or "N/A")',
  })
  most_active_user: string;

  @ApiProperty({
    example: '2024-01-15',
    description: 'Day with most activity (YYYY-MM-DD format or "N/A")',
  })
  busiest_day: string;
}

/**
 * TenantActivityResponseDto
 *
 * Response for tenant activity timeline
 */
export class TenantActivityResponseDto {
  @ApiProperty({ example: 'abc-123-def-456', description: 'Tenant UUID' })
  tenant_id: string;

  @ApiProperty({ example: 'Acme Roofing', description: 'Company name' })
  tenant_name: string;

  @ApiProperty({
    type: [ActivityEventDto],
    description: 'Activity events (most recent first)',
    isArray: true,
  })
  activities: ActivityEventDto[];

  @ApiProperty({ type: ActivitySummaryDto, description: 'Summary statistics' })
  summary: ActivitySummaryDto;
}
