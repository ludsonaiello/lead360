import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ChangeOrderSummaryDto
 *
 * Lightweight summary of a change order (used in lists and parent totals)
 */
export class ChangeOrderSummaryDto {
  @ApiProperty({
    description: 'Change order UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Change order number',
    example: 'CO-2026-0001',
  })
  quote_number: string;

  @ApiProperty({
    description: 'Change order title',
    example: 'Additional foundation work',
  })
  title: string;

  @ApiProperty({
    description: 'Change order status',
    example: 'draft',
    enum: ['draft', 'pending_approval', 'ready', 'sent', 'delivered', 'read', 'opened', 'downloaded', 'approved', 'denied', 'started', 'concluded'],
  })
  status: string;

  @ApiProperty({
    description: 'Change order total',
    example: 3456.00,
  })
  total: number;

  @ApiProperty({
    description: 'Created timestamp',
    example: '2026-01-30T10:30:00.000Z',
  })
  created_at: string;

  @ApiPropertyOptional({
    description: 'Approved timestamp (if status is approved)',
    example: '2026-01-31T08:00:00.000Z',
  })
  approved_at?: string;
}
