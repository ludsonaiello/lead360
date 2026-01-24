import { Decimal } from '@prisma/client/runtime/library';

/**
 * Internal calculation result for markup application
 * Used by QuotePricingService to calculate profit, overhead, and contingency
 */
export interface MarkupBreakdown {
  /**
   * Profit amount (itemSubtotal × profitPercent / 100)
   */
  profit: Decimal;

  /**
   * Overhead amount ((itemSubtotal + profit) × overheadPercent / 100)
   * Note: Compounding calculation
   */
  overhead: Decimal;

  /**
   * Contingency amount ((itemSubtotal + profit + overhead) × contingencyPercent / 100)
   * Note: Compounding calculation
   */
  contingency: Decimal;

  /**
   * Subtotal before discounts (itemSubtotal + profit + overhead + contingency)
   * This value is stored in quote.subtotal
   */
  subtotalBeforeDiscounts: Decimal;
}
