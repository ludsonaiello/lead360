import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ChangeOrderResponseDto
 *
 * Response when creating or updating a change order
 */
export class ChangeOrderResponseDto {
  @ApiProperty({
    description: 'Change order UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Change order number (CO- prefix)',
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
    description: 'Parent quote original total',
    example: 45000.00,
  })
  parent_original_total: number;

  @ApiProperty({
    description: 'Change order subtotal',
    example: 3200.00,
  })
  subtotal: number;

  @ApiProperty({
    description: 'Tax amount',
    example: 256.00,
  })
  tax_amount: number;

  @ApiProperty({
    description: 'Discount amount',
    example: 0.00,
  })
  discount_amount: number;

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

  @ApiProperty({
    description: 'Last updated timestamp',
    example: '2026-01-30T12:45:00.000Z',
  })
  updated_at: string;

  @ApiPropertyOptional({
    description: 'Approved timestamp (if status is approved)',
    example: '2026-01-31T08:00:00.000Z',
  })
  approved_at?: string;
}
