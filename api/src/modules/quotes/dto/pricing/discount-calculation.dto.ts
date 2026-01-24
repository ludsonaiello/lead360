import { Decimal } from '@prisma/client/runtime/library';

/**
 * Single discount rule application result
 */
export interface DiscountRuleBreakdown {
  /**
   * Description or name of the discount rule
   */
  ruleName: string;

  /**
   * Type of discount: 'percentage' or 'fixed_amount'
   */
  ruleType: string;

  /**
   * Discount value (percentage 0-100 or fixed dollar amount)
   */
  value: Decimal;

  /**
   * Calculated discount amount for this rule
   */
  discountAmount: Decimal;
}

/**
 * Internal calculation result for discount application
 * Used by QuotePricingService to apply all discount rules
 */
export interface DiscountCalculation {
  /**
   * Sum of all discount amounts
   * This value is stored in quote.discount_amount
   */
  totalDiscountAmount: Decimal;

  /**
   * Subtotal after all discounts applied
   * (subtotalBeforeDiscounts - totalDiscountAmount)
   */
  subtotalAfterDiscounts: Decimal;

  /**
   * Breakdown of each discount rule applied (for transparency)
   */
  discountBreakdown: DiscountRuleBreakdown[];
}
