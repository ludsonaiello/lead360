import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ChangeOrderSummaryDto } from './change-order-summary.dto';

/**
 * ListChangeOrdersResponseDto
 *
 * Response for GET /api/v1/quotes/:parentQuoteId/change-orders
 */
export class ListChangeOrdersResponseDto {
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
    description: 'Array of change orders',
    type: [ChangeOrderSummaryDto],
  })
  @Type(() => ChangeOrderSummaryDto)
  change_orders: ChangeOrderSummaryDto[];

  @ApiProperty({
    description: 'Summary statistics',
    example: {
      total_count: 5,
      approved_count: 3,
      pending_count: 1,
      rejected_count: 1,
    },
  })
  summary: {
    total_count: number;
    approved_count: number;
    pending_count: number;
    rejected_count: number;
  };
}
