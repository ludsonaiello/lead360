/**
 * Quote Financial Calculations
 * Calculates profit, overhead, and contingency breakdown at the ITEM level
 * respecting item-level custom values, then quote-level, then settings defaults
 *
 * Uses backend-calculated totals for subtotal, discount, tax, and final total
 */

import type { Quote, QuoteItem, QuoteSettings } from '@/lib/types/quotes';

export interface QuoteFinancialSummary {
  itemTotals: number; // Total base cost of all items
  profitAmount: number; // Total profit across all items
  overheadAmount: number; // Total overhead across all items
  contingencyAmount: number; // Total contingency across all items

  // Metadata for display
  hasMixedProfitRates: boolean; // True if items have different profit percentages
  hasMixedOverheadRates: boolean; // True if items have different overhead percentages
  hasMixedContingencyRates: boolean; // True if items have different contingency percentages
  uniformProfitPercent?: number; // If all items have same rate, this is it
  uniformOverheadPercent?: number; // If all items have same rate, this is it
  uniformContingencyPercent?: number; // If all items have same rate, this is it
}

/**
 * Calculate markup breakdown (profit/overhead/contingency amounts) for display
 * Backend handles all other calculations (subtotal, discount, tax, total)
 */
export function calculateQuoteFinancials(
  quote: Quote,
  items: QuoteItem[],
  settings: QuoteSettings | null
): QuoteFinancialSummary {
  // Track percentages used for each item to detect if they're all the same
  const profitPercents = new Set<number>();
  const overheadPercents = new Set<number>();
  const contingencyPercents = new Set<number>();

  let totalItemCost = 0;
  let totalProfit = 0;
  let totalOverhead = 0;
  let totalContingency = 0;

  // Calculate markup breakdown for each item
  items.forEach((item) => {
    const itemCost = item.total_cost; // total_cost already includes quantity

    // Determine effective percentages (item custom → quote custom → settings default → 0)
    const profitPercent =
      item.custom_profit_percent ??
      quote.custom_profit_percent ??
      settings?.default_profit_margin ??
      0;

    const overheadPercent =
      item.custom_overhead_percent ??
      quote.custom_overhead_percent ??
      settings?.default_overhead_rate ??
      0;

    const contingencyPercent =
      item.custom_contingency_percent ??
      quote.custom_contingency_percent ??
      settings?.default_contingency_rate ??
      0;

    // Track percentages for uniformity detection
    profitPercents.add(profitPercent);
    overheadPercents.add(overheadPercent);
    contingencyPercents.add(contingencyPercent);

    // Calculate markup amounts for this item (applied to base cost)
    const itemProfit = itemCost * (profitPercent / 100);
    const itemOverhead = itemCost * (overheadPercent / 100);
    const itemContingency = itemCost * (contingencyPercent / 100);

    // Accumulate totals
    totalItemCost += itemCost;
    totalProfit += itemProfit;
    totalOverhead += itemOverhead;
    totalContingency += itemContingency;
  });

  // Determine if rates are mixed or uniform
  const hasMixedProfitRates = profitPercents.size > 1;
  const hasMixedOverheadRates = overheadPercents.size > 1;
  const hasMixedContingencyRates = contingencyPercents.size > 1;

  const uniformProfitPercent = profitPercents.size === 1 ? Array.from(profitPercents)[0] : undefined;
  const uniformOverheadPercent = overheadPercents.size === 1 ? Array.from(overheadPercents)[0] : undefined;
  const uniformContingencyPercent = contingencyPercents.size === 1 ? Array.from(contingencyPercents)[0] : undefined;

  return {
    itemTotals: totalItemCost,
    profitAmount: totalProfit,
    overheadAmount: totalOverhead,
    contingencyAmount: totalContingency,
    hasMixedProfitRates,
    hasMixedOverheadRates,
    hasMixedContingencyRates,
    uniformProfitPercent,
    uniformOverheadPercent,
    uniformContingencyPercent,
  };
}
