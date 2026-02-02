import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  QuoteFinancialsDto,
  MarkupBreakdown,
  DiscountCalculation,
  DiscountRuleBreakdown,
  EffectivePercentages,
} from '../dto/pricing';
import type { Prisma } from '@prisma/client';

/**
 * Service for calculating quote financial totals
 * Implements the complete pricing logic:
 * 1. Item subtotal (sum of all item costs)
 * 2. Apply profit/overhead/contingency markups (compounding)
 * 3. Apply discount rules (percentage first, then fixed)
 * 4. Calculate tax
 * 5. Calculate final total
 *
 * All calculations use Decimal type for precision
 */
@Injectable()
export class QuotePricingService {
  private readonly logger = new Logger(QuotePricingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate complete financial breakdown for a quote
   * This is the main orchestrator method that calls all calculation steps
   *
   * @param quoteId - Quote UUID
   * @param tx - Optional transaction client
   * @returns Complete financial breakdown
   */
  async calculateQuoteFinancials(
    quoteId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<QuoteFinancialsDto> {
    const prisma = tx || this.prisma;

    // Fetch all required data
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId },
      include: {
        items: {
          select: {
            total_cost: true,
            custom_profit_percent: true,
            custom_overhead_percent: true,
            custom_contingency_percent: true,
            custom_discount_percentage: true,
            custom_discount_amount: true,
          },
        },
        discount_rules: {
          orderBy: { order_index: 'asc' },
        },
        tenant: {
          select: {
            default_profit_margin: true,
            default_overhead_rate: true,
            default_contingency_rate: true,
            sales_tax_rate: true,
          },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID ${quoteId} not found`);
    }

    // Step 1: Calculate subtotal before discounts
    // Each item gets its own margins applied, then we sum them
    const result = this.calculateItemsWithMarkups(
      quote.items,
      quote,
      quote.tenant,
    );

    // Step 2: Apply quote-level discount rules
    const discounts = this.applyDiscountRules(
      result.subtotalBeforeDiscounts,
      quote.discount_rules,
    );

    // Step 3: Calculate tax
    // Priority: quote custom_tax_rate → tenant sales_tax_rate → 0%
    const taxRate =
      quote.custom_tax_rate !== null
        ? quote.custom_tax_rate
        : quote.tenant.sales_tax_rate !== null
          ? quote.tenant.sales_tax_rate
          : new Decimal(0);
    const taxAmount = this.calculateTax(discounts.subtotalAfterDiscounts, taxRate);

    // Step 4: Calculate final total
    const total = this.calculateTotal(discounts.subtotalAfterDiscounts, taxAmount);

    // Build response DTO
    return {
      itemSubtotal: Number(result.itemSubtotal),
      profitAmount: Number(result.totalProfit),
      overheadAmount: Number(result.totalOverhead),
      contingencyAmount: Number(result.totalContingency),
      subtotalBeforeDiscounts: Number(result.subtotalBeforeDiscounts),
      discountAmount: Number(discounts.totalDiscountAmount),
      subtotalAfterDiscounts: Number(discounts.subtotalAfterDiscounts),
      taxAmount: Number(taxAmount),
      total: Number(total),
      effectivePercentages: {
        profit: 0, // Not applicable when items have individual margins
        overhead: 0,
        contingency: 0,
        taxRate: Number(taxRate),
      },
      discountBreakdown: discounts.discountBreakdown.map((d) => ({
        ruleName: d.ruleName,
        ruleType: d.ruleType,
        value: Number(d.value),
        discountAmount: Number(d.discountAmount),
      })),
    };
  }

  /**
   * Update quote financial fields in database
   * Call this method after any operation that affects quote totals:
   * - Item create/update/delete
   * - Discount rule create/update/delete
   * - Settings update (profit/overhead/contingency/tax)
   *
   * @param quoteId - Quote UUID
   * @param tx - Optional transaction client
   * @returns Updated quote
   */
  async updateQuoteFinancials(
    quoteId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    const prisma = tx || this.prisma;

    // Calculate all financial fields
    const financials = await this.calculateQuoteFinancials(quoteId, tx);

    this.logger.log(
      `Updating quote ${quoteId} financials - Subtotal: ${financials.subtotalBeforeDiscounts}, Discount: ${financials.discountAmount}, Tax: ${financials.taxAmount}, Total: ${financials.total}`,
    );

    // Update quote with new values (with retry logic for deadlocks)
    const updatedQuote = await this.retryOnDeadlock(
      async () => {
        return prisma.quote.update({
          where: { id: quoteId },
          data: {
            subtotal: new Decimal(financials.subtotalBeforeDiscounts),
            discount_amount: new Decimal(financials.discountAmount),
            tax_amount: new Decimal(financials.taxAmount),
            total: new Decimal(financials.total),
          },
        });
      },
      3, // max 3 retries
      100, // 100ms delay between retries
    );

    return updatedQuote;
  }

  /**
   * Retry helper for handling database deadlocks
   *
   * @param operation - Async operation to retry
   * @param maxRetries - Maximum number of retries (default: 3)
   * @param delayMs - Delay between retries in ms (default: 100)
   * @returns Result of the operation
   */
  private async retryOnDeadlock<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 100,
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;

        // Check if this is a deadlock error (Prisma error code P2034)
        const isDeadlock =
          error.code === 'P2034' ||
          (error.message &&
            error.message.includes('write conflict or a deadlock'));

        if (!isDeadlock || attempt === maxRetries) {
          // Not a deadlock or we've exhausted retries - throw the error
          throw error;
        }

        // Deadlock detected - log and retry after delay
        this.logger.warn(
          `Deadlock detected on attempt ${attempt}/${maxRetries}, retrying after ${delayMs}ms...`,
        );

        // Wait before retrying (exponential backoff)
        await this.delay(delayMs * attempt);
      }
    }

    // Should never reach here, but throw last error just in case
    throw lastError;
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Calculate item subtotal (sum of all item costs)
   *
   * @param items - Array of quote items
   * @returns Sum of all item.total_cost
   */
  calculateItemSubtotal(items: { total_cost: Decimal }[]): Decimal {
    if (!items || items.length === 0) {
      return new Decimal(0);
    }

    return items.reduce((sum, item) => sum.add(item.total_cost), new Decimal(0));
  }

  /**
   * Calculate items with individual markups applied
   * Each item can have custom margins that override quote-level margins
   * Priority: item custom → quote custom → tenant default → 0%
   *
   * @param items - Array of quote items with custom margin fields
   * @param quote - Quote with custom percentages
   * @param tenant - Tenant with default percentages
   * @returns Aggregated totals
   */
  calculateItemsWithMarkups(
    items: Array<{
      total_cost: Decimal;
      custom_profit_percent: Decimal | null;
      custom_overhead_percent: Decimal | null;
      custom_contingency_percent: Decimal | null;
      custom_discount_percentage: Decimal | null;
      custom_discount_amount: Decimal | null;
    }>,
    quote: {
      custom_profit_percent: Decimal | null;
      custom_overhead_percent: Decimal | null;
      custom_contingency_percent: Decimal | null;
    },
    tenant: {
      default_profit_margin: Decimal | null;
      default_overhead_rate: Decimal | null;
      default_contingency_rate: Decimal | null;
    },
  ): {
    itemSubtotal: Decimal;
    totalProfit: Decimal;
    totalOverhead: Decimal;
    totalContingency: Decimal;
    subtotalBeforeDiscounts: Decimal;
  } {
    if (!items || items.length === 0) {
      return {
        itemSubtotal: new Decimal(0),
        totalProfit: new Decimal(0),
        totalOverhead: new Decimal(0),
        totalContingency: new Decimal(0),
        subtotalBeforeDiscounts: new Decimal(0),
      };
    }

    let itemSubtotal = new Decimal(0);
    let totalProfit = new Decimal(0);
    let totalOverhead = new Decimal(0);
    let totalContingency = new Decimal(0);

    for (const item of items) {
      // Get effective percentages for this item
      // Priority: item custom → quote custom → tenant default → 0%
      const profitPercent =
        item.custom_profit_percent !== null
          ? item.custom_profit_percent
          : quote.custom_profit_percent !== null
            ? quote.custom_profit_percent
            : tenant.default_profit_margin !== null
              ? tenant.default_profit_margin
              : new Decimal(0);

      const overheadPercent =
        item.custom_overhead_percent !== null
          ? item.custom_overhead_percent
          : quote.custom_overhead_percent !== null
            ? quote.custom_overhead_percent
            : tenant.default_overhead_rate !== null
              ? tenant.default_overhead_rate
              : new Decimal(0);

      const contingencyPercent =
        item.custom_contingency_percent !== null
          ? item.custom_contingency_percent
          : quote.custom_contingency_percent !== null
            ? quote.custom_contingency_percent
            : tenant.default_contingency_rate !== null
              ? tenant.default_contingency_rate
              : new Decimal(0);

      // Calculate markups for this item (non-compounding)
      const itemCost = item.total_cost;
      const itemProfit = itemCost.mul(profitPercent).div(100);
      const itemOverhead = itemCost.mul(overheadPercent).div(100);
      const itemContingency = itemCost.mul(contingencyPercent).div(100);

      // Accumulate totals
      itemSubtotal = itemSubtotal.add(itemCost);
      totalProfit = totalProfit.add(itemProfit);
      totalOverhead = totalOverhead.add(itemOverhead);
      totalContingency = totalContingency.add(itemContingency);

      this.logger.debug(
        `Item with cost ${itemCost} - Profit(${profitPercent}%): ${itemProfit}, ` +
        `Overhead(${overheadPercent}%): ${itemOverhead}, ` +
        `Contingency(${contingencyPercent}%): ${itemContingency}`,
      );
    }

    const subtotalBeforeDiscounts = itemSubtotal
      .add(totalProfit)
      .add(totalOverhead)
      .add(totalContingency);

    this.logger.debug(
      `Items calculation - Item subtotal: ${itemSubtotal}, ` +
      `Total Profit: ${totalProfit}, Total Overhead: ${totalOverhead}, ` +
      `Total Contingency: ${totalContingency}, ` +
      `Subtotal before discounts: ${subtotalBeforeDiscounts}`,
    );

    return {
      itemSubtotal,
      totalProfit,
      totalOverhead,
      totalContingency,
      subtotalBeforeDiscounts,
    };
  }

  /**
   * Apply profit, overhead, and contingency markups (compounding)
   *
   * Calculation:
   * 1. Profit = itemSubtotal × (profitPercent / 100)
   * 2. Overhead = (itemSubtotal + profit) × (overheadPercent / 100)
   * 3. Contingency = (itemSubtotal + profit + overhead) × (contingencyPercent / 100)
   * 4. Subtotal = itemSubtotal + profit + overhead + contingency
   *
   * @param itemSubtotal - Sum of all item costs
   * @param profitPercent - Profit percentage (0-100)
   * @param overheadPercent - Overhead percentage (0-100)
   * @param contingencyPercent - Contingency percentage (0-100)
   * @returns Markup breakdown
   */
  applyMarkups(
    itemSubtotal: Decimal,
    profitPercent: Decimal,
    overheadPercent: Decimal,
    contingencyPercent: Decimal,
  ): MarkupBreakdown {
    // All markups apply to ORIGINAL item subtotal (non-compounding)
    const profit = itemSubtotal.mul(profitPercent).div(100);
    const overhead = itemSubtotal.mul(overheadPercent).div(100);
    const contingency = itemSubtotal.mul(contingencyPercent).div(100);

    // Calculate final subtotal before discounts
    const subtotalBeforeDiscounts = itemSubtotal
      .add(profit)
      .add(overhead)
      .add(contingency);

    this.logger.debug(
      `Markup calculation (NON-COMPOUNDING) - Item subtotal: ${itemSubtotal}, ` +
      `Profit (${profitPercent}%): ${profit}, ` +
      `Overhead (${overheadPercent}%): ${overhead}, ` +
      `Contingency (${contingencyPercent}%): ${contingency}, ` +
      `Subtotal: ${subtotalBeforeDiscounts}`,
    );

    return {
      profit,
      overhead,
      contingency,
      subtotalBeforeDiscounts,
    };
  }

  /**
   * Apply all discount rules sequentially
   * Percentage discounts are applied first (in order_index order)
   * Then fixed amount discounts (in order_index order)
   * Total discount is capped at subtotal (cannot go negative)
   *
   * @param subtotalBeforeDiscounts - Subtotal before any discounts
   * @param discountRules - Array of discount rules (sorted by order_index)
   * @returns Discount calculation result
   */
  applyDiscountRules(
    subtotalBeforeDiscounts: Decimal,
    discountRules: Array<{
      id: string;
      reason: string | null;
      rule_type: 'percentage' | 'fixed_amount';
      value: Decimal;
      order_index: number;
    }>,
  ): DiscountCalculation {
    if (!discountRules || discountRules.length === 0) {
      return {
        totalDiscountAmount: new Decimal(0),
        subtotalAfterDiscounts: subtotalBeforeDiscounts,
        discountBreakdown: [],
      };
    }

    let runningSubtotal = subtotalBeforeDiscounts;
    let totalDiscount = new Decimal(0);
    const breakdown: DiscountRuleBreakdown[] = [];

    // Separate percentage and fixed amount rules
    const percentageRules = discountRules.filter(
      (r) => r.rule_type === 'percentage',
    );
    const fixedRules = discountRules.filter((r) => r.rule_type === 'fixed_amount');

    // Apply percentage discounts first
    for (const rule of percentageRules) {
      const discountAmount = runningSubtotal.mul(rule.value).div(100);
      totalDiscount = totalDiscount.add(discountAmount);
      runningSubtotal = runningSubtotal.sub(discountAmount);

      breakdown.push({
        ruleName: rule.reason || `Discount ${rule.id.substring(0, 8)}`,
        ruleType: rule.rule_type,
        value: rule.value,
        discountAmount,
      });
    }

    // Then apply fixed amount discounts
    for (const rule of fixedRules) {
      const discountAmount = rule.value;
      totalDiscount = totalDiscount.add(discountAmount);
      runningSubtotal = runningSubtotal.sub(discountAmount);

      breakdown.push({
        ruleName: rule.reason || `Discount ${rule.id.substring(0, 8)}`,
        ruleType: rule.rule_type,
        value: rule.value,
        discountAmount,
      });
    }

    // Cap discount at subtotal (cannot go negative)
    if (totalDiscount.greaterThan(subtotalBeforeDiscounts)) {
      this.logger.warn(
        `Total discount (${totalDiscount}) exceeds subtotal (${subtotalBeforeDiscounts}). Capping at subtotal.`,
      );
      totalDiscount = subtotalBeforeDiscounts;
      runningSubtotal = new Decimal(0);
    }

    this.logger.debug(
      `Applied ${discountRules.length} discount rules - Total discount: ${totalDiscount}, Subtotal after discounts: ${runningSubtotal}`,
    );

    return {
      totalDiscountAmount: totalDiscount,
      subtotalAfterDiscounts: runningSubtotal,
      discountBreakdown: breakdown,
    };
  }

  /**
   * Calculate tax amount
   *
   * @param subtotalAfterDiscounts - Subtotal after all discounts
   * @param taxRate - Tax rate percentage (0-100)
   * @returns Tax amount
   */
  calculateTax(subtotalAfterDiscounts: Decimal, taxRate: Decimal): Decimal {
    if (!taxRate || taxRate.isZero()) {
      return new Decimal(0);
    }

    const taxAmount = subtotalAfterDiscounts.mul(taxRate).div(100);

    this.logger.debug(
      `Tax calculation - Subtotal: ${subtotalAfterDiscounts}, Rate: ${taxRate}%, Tax: ${taxAmount}`,
    );

    return taxAmount;
  }

  /**
   * Calculate final total
   *
   * @param subtotalAfterDiscounts - Subtotal after discounts
   * @param taxAmount - Tax amount
   * @returns Final total
   */
  calculateTotal(subtotalAfterDiscounts: Decimal, taxAmount: Decimal): Decimal {
    return subtotalAfterDiscounts.add(taxAmount);
  }

  /**
   * Get effective percentages for calculations
   * Priority: Custom value → Tenant default → 0%
   * - custom = null → Use tenant default
   * - custom = 0 → Use 0% (explicit override)
   * - custom = 5 → Use 5%
   *
   * @param quote - Quote with custom percentage fields
   * @param tenant - Tenant with default percentages and tax rate
   * @returns Effective percentages to use
   */
  getEffectivePercentages(
    quote: {
      custom_profit_percent: Decimal | null;
      custom_overhead_percent: Decimal | null;
      custom_contingency_percent: Decimal | null;
    },
    tenant: {
      default_profit_margin: Decimal | null;
      default_overhead_rate: Decimal | null;
      default_contingency_rate: Decimal | null;
      sales_tax_rate: Decimal | null;
    },
  ): EffectivePercentages {
    // Priority: custom → tenant default → 0%
    const profitPercent =
      quote.custom_profit_percent !== null
        ? quote.custom_profit_percent
        : tenant.default_profit_margin !== null
          ? tenant.default_profit_margin
          : new Decimal(0);

    const overheadPercent =
      quote.custom_overhead_percent !== null
        ? quote.custom_overhead_percent
        : tenant.default_overhead_rate !== null
          ? tenant.default_overhead_rate
          : new Decimal(0);

    const contingencyPercent =
      quote.custom_contingency_percent !== null
        ? quote.custom_contingency_percent
        : tenant.default_contingency_rate !== null
          ? tenant.default_contingency_rate
          : new Decimal(0);

    // Tax: null means use tenant rate, 0 means no tax
    const taxRate =
      tenant.sales_tax_rate !== null ? tenant.sales_tax_rate : new Decimal(0);

    this.logger.debug(
      `Effective percentages - Profit: ${profitPercent}% (custom: ${quote.custom_profit_percent}, default: ${tenant.default_profit_margin}), ` +
      `Overhead: ${overheadPercent}% (custom: ${quote.custom_overhead_percent}, default: ${tenant.default_overhead_rate}), ` +
      `Contingency: ${contingencyPercent}% (custom: ${quote.custom_contingency_percent}, default: ${tenant.default_contingency_rate}), ` +
      `Tax: ${taxRate}% (tenant rate: ${tenant.sales_tax_rate})`,
    );

    return {
      profitPercent,
      overheadPercent,
      contingencyPercent,
      taxRate,
    };
  }
}
