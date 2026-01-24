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

  // System default percentages (fallback if tenant has no defaults)
  private readonly SYSTEM_DEFAULTS = {
    PROFIT_PERCENT: new Decimal(20),
    OVERHEAD_PERCENT: new Decimal(10),
    CONTINGENCY_PERCENT: new Decimal(5),
    TAX_RATE: new Decimal(0),
  };

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
          select: { total_cost: true },
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

    // Step 1: Calculate item subtotal
    const itemSubtotal = this.calculateItemSubtotal(quote.items);

    // Step 2: Get effective percentages (custom or defaults)
    const percentages = this.getEffectivePercentages(quote, quote.tenant);

    // Step 3: Apply markups (profit, overhead, contingency)
    const markups = this.applyMarkups(
      itemSubtotal,
      percentages.profitPercent,
      percentages.overheadPercent,
      percentages.contingencyPercent,
    );

    // Step 4: Apply discount rules
    const discounts = this.applyDiscountRules(
      markups.subtotalBeforeDiscounts,
      quote.discount_rules,
    );

    // Step 5: Calculate tax
    const taxAmount = this.calculateTax(
      discounts.subtotalAfterDiscounts,
      percentages.taxRate,
    );

    // Step 6: Calculate final total
    const total = this.calculateTotal(discounts.subtotalAfterDiscounts, taxAmount);

    // Build response DTO
    return {
      itemSubtotal: Number(itemSubtotal),
      profitAmount: Number(markups.profit),
      overheadAmount: Number(markups.overhead),
      contingencyAmount: Number(markups.contingency),
      subtotalBeforeDiscounts: Number(markups.subtotalBeforeDiscounts),
      discountAmount: Number(discounts.totalDiscountAmount),
      subtotalAfterDiscounts: Number(discounts.subtotalAfterDiscounts),
      taxAmount: Number(taxAmount),
      total: Number(total),
      effectivePercentages: {
        profit: Number(percentages.profitPercent),
        overhead: Number(percentages.overheadPercent),
        contingency: Number(percentages.contingencyPercent),
        taxRate: Number(percentages.taxRate),
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

    // Update quote with new values
    const updatedQuote = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        subtotal: new Decimal(financials.subtotalBeforeDiscounts),
        discount_amount: new Decimal(financials.discountAmount),
        tax_amount: new Decimal(financials.taxAmount),
        total: new Decimal(financials.total),
      },
    });

    return updatedQuote;
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
    // Step 1: Calculate profit
    const profit = itemSubtotal.mul(profitPercent).div(100);

    // Step 2: Calculate overhead (compounding on subtotal + profit)
    const subtotalAfterProfit = itemSubtotal.add(profit);
    const overhead = subtotalAfterProfit.mul(overheadPercent).div(100);

    // Step 3: Calculate contingency (compounding on subtotal + profit + overhead)
    const subtotalAfterOverhead = subtotalAfterProfit.add(overhead);
    const contingency = subtotalAfterOverhead.mul(contingencyPercent).div(100);

    // Step 4: Calculate final subtotal before discounts
    const subtotalBeforeDiscounts = subtotalAfterOverhead.add(contingency);

    this.logger.debug(
      `Markup calculation - Item subtotal: ${itemSubtotal}, Profit (${profitPercent}%): ${profit}, Overhead (${overheadPercent}%): ${overhead}, Contingency (${contingencyPercent}%): ${contingency}, Subtotal: ${subtotalBeforeDiscounts}`,
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
   * Priority: quote custom > tenant default > system default
   *
   * @param quote - Quote with custom percentage fields
   * @param tenant - Tenant with default percentage settings
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
    const profitPercent =
      quote.custom_profit_percent ||
      tenant.default_profit_margin ||
      this.SYSTEM_DEFAULTS.PROFIT_PERCENT;

    const overheadPercent =
      quote.custom_overhead_percent ||
      tenant.default_overhead_rate ||
      this.SYSTEM_DEFAULTS.OVERHEAD_PERCENT;

    const contingencyPercent =
      quote.custom_contingency_percent ||
      tenant.default_contingency_rate ||
      this.SYSTEM_DEFAULTS.CONTINGENCY_PERCENT;

    const taxRate = tenant.sales_tax_rate || this.SYSTEM_DEFAULTS.TAX_RATE;

    this.logger.debug(
      `Effective percentages - Profit: ${profitPercent}%, Overhead: ${overheadPercent}%, Contingency: ${contingencyPercent}%, Tax: ${taxRate}%`,
    );

    return {
      profitPercent,
      overheadPercent,
      contingencyPercent,
      taxRate,
    };
  }
}
