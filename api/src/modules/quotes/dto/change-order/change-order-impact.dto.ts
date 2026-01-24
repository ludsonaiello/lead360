import { ApiProperty } from '@nestjs/swagger';

/**
 * ChangeOrderImpactDto
 *
 * Total impact of change orders on parent quote
 */
export class ChangeOrderImpactDto {
  @ApiProperty({ description: 'Parent quote ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  parent_quote_id: string;

  @ApiProperty({ description: 'Original quote total', example: 50000.00 })
  original_total: number;

  @ApiProperty({ description: 'Sum of approved change orders', example: 7500.00 })
  change_orders_total: number;

  @ApiProperty({ description: 'Revised project total', example: 57500.00 })
  revised_total: number;

  @ApiProperty({ description: 'Number of change orders', example: 3 })
  change_order_count: number;

  @ApiProperty({ description: 'Number of approved change orders', example: 2 })
  approved_count: number;

  @ApiProperty({ description: 'Number of pending change orders', example: 1 })
  pending_count: number;
}

/**
 * ChangeOrderHistoryEventDto
 *
 * Single event in change order history
 */
export class ChangeOrderHistoryEventDto {
  @ApiProperty({ description: 'Event ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ description: 'Event type', example: 'change_order_created', enum: ['change_order_created', 'change_order_approved', 'change_order_rejected'] })
  event_type: string;

  @ApiProperty({ description: 'Change order number', example: 'CO-2024-001' })
  change_order_number: string;

  @ApiProperty({ description: 'Description', example: 'Change order created for additional work' })
  description: string;

  @ApiProperty({ description: 'Amount', example: 5000.00 })
  amount: number;

  @ApiProperty({ description: 'Timestamp', example: '2024-01-20T10:30:00.000Z' })
  timestamp: string;
}

/**
 * ChangeOrderHistoryResponseDto
 *
 * Timeline of change order events
 */
export class ChangeOrderHistoryResponseDto {
  @ApiProperty({ description: 'History timeline', type: [ChangeOrderHistoryEventDto] })
  timeline: ChangeOrderHistoryEventDto[];

  @ApiProperty({ description: 'Parent quote ID', example: '123e4567-e89b-12d3-a456-426614174000' })
  parent_quote_id: string;
}
