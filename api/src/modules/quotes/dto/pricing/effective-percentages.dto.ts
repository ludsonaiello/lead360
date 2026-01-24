import { Decimal } from '@prisma/client/runtime/library';

/**
 * Effective percentages used in quote calculations
 * Resolved from quote custom settings or tenant defaults
 */
export interface EffectivePercentages {
  /**
   * Profit percentage (0-100)
   * Priority: quote.custom_profit_percent > tenant.default_profit_margin > system default (20%)
   */
  profitPercent: Decimal;

  /**
   * Overhead percentage (0-100)
   * Priority: quote.custom_overhead_percent > tenant.default_overhead_rate > system default (10%)
   */
  overheadPercent: Decimal;

  /**
   * Contingency percentage (0-100)
   * Priority: quote.custom_contingency_percent > tenant.default_contingency_rate > system default (5%)
   */
  contingencyPercent: Decimal;

  /**
   * Tax rate percentage (0-100)
   * Priority: tenant.sales_tax_rate > 0 (no tax)
   * Note: tenant.sales_tax_rate is DECIMAL(5,3) for precision (e.g., 8.250%)
   */
  taxRate: Decimal;
}
