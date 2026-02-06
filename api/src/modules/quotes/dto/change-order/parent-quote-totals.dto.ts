import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ChangeOrderSummaryDto } from './change-order-summary.dto';

/**
 * ParentQuoteTotalsDto
 *
 * Parent quote with aggregated change order totals
 * Used by GET /api/v1/quotes/:quoteId/with-change-orders
 */
export class ParentQuoteTotalsDto {
  @ApiProperty({
    description: 'Parent quote UUID',
    example: '987e6543-e89b-12d3-a456-426614174111',
  })
  parent_quote_id: string;

  @ApiProperty({
    description: 'Parent quote number',
    example: 'Q-2026-0123',
  })
  parent_quote_number: string;

  @ApiProperty({
    description: 'Original quote total (before change orders)',
    example: 45000.0,
  })
  original_total: number;

  @ApiProperty({
    description: 'Sum of approved change order totals',
    example: 8500.0,
  })
  approved_change_orders_total: number;

  @ApiProperty({
    description: 'Sum of pending change order totals',
    example: 2000.0,
  })
  pending_change_orders_total: number;

  @ApiProperty({
    description: 'Revised total (original + approved change orders)',
    example: 53500.0,
  })
  revised_total: number;

  @ApiProperty({
    description: 'Count of approved change orders',
    example: 3,
  })
  approved_co_count: number;

  @ApiProperty({
    description: 'Count of pending change orders',
    example: 1,
  })
  pending_co_count: number;

  @ApiProperty({
    description: 'List of all change orders',
    type: [ChangeOrderSummaryDto],
  })
  @Type(() => ChangeOrderSummaryDto)
  change_orders: ChangeOrderSummaryDto[];
}
