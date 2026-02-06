import { ApiProperty } from '@nestjs/swagger';

/**
 * Complete financial breakdown for a quote
 * Shows all calculation steps from item costs to final total
 */
export class QuoteFinancialsDto {
  @ApiProperty({
    description: 'Sum of all quote item total_cost values',
    example: 1000.0,
    type: Number,
  })
  itemSubtotal: number;

  @ApiProperty({
    description: 'Profit markup amount (itemSubtotal × profit%)',
    example: 200.0,
    type: Number,
  })
  profitAmount: number;

  @ApiProperty({
    description: 'Overhead markup amount ((itemSubtotal + profit) × overhead%)',
    example: 120.0,
    type: Number,
  })
  overheadAmount: number;

  @ApiProperty({
    description:
      'Contingency markup amount ((itemSubtotal + profit + overhead) × contingency%)',
    example: 66.0,
    type: Number,
  })
  contingencyAmount: number;

  @ApiProperty({
    description:
      'Subtotal before discounts (itemSubtotal + profit + overhead + contingency) - stored in quote.subtotal',
    example: 1386.0,
    type: Number,
  })
  subtotalBeforeDiscounts: number;

  @ApiProperty({
    description:
      'Total discount amount from all discount rules - stored in quote.discount_amount',
    example: 188.6,
    type: Number,
  })
  discountAmount: number;

  @ApiProperty({
    description:
      'Subtotal after applying all discounts (subtotalBeforeDiscounts - discountAmount)',
    example: 1197.4,
    type: Number,
  })
  subtotalAfterDiscounts: number;

  @ApiProperty({
    description:
      'Tax amount (subtotalAfterDiscounts × taxRate) - stored in quote.tax_amount',
    example: 95.79,
    type: Number,
  })
  taxAmount: number;

  @ApiProperty({
    description:
      'Final total (subtotalAfterDiscounts + taxAmount) - stored in quote.total',
    example: 1293.19,
    type: Number,
  })
  total: number;

  @ApiProperty({
    description:
      'Effective percentages used in calculations (custom or tenant defaults)',
    type: Object,
  })
  effectivePercentages: {
    profit: number;
    overhead: number;
    contingency: number;
    taxRate: number;
  };

  @ApiProperty({
    description: 'Breakdown of each discount rule applied',
    type: Array,
    isArray: true,
  })
  discountBreakdown: Array<{
    ruleName: string;
    ruleType: string;
    value: number;
    discountAmount: number;
  }>;
}
