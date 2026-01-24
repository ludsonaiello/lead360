import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ProfitabilityAnalyzerService {
  private readonly logger = new Logger(ProfitabilityAnalyzerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate profitability and warn if margins are too low
   * Uses tenant-specific thresholds or defaults
   *
   * @param quoteId - Quote UUID
   * @param tenantId - Tenant UUID
   * @returns Profitability validation with warning level
   */
  async validateProfitability(quoteId: string, tenantId: string): Promise<any> {
    // Fetch quote with items
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
      include: {
        items: {
          select: { total_cost: true },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    // Calculate totals
    const totalCost = quote.items.reduce(
      (sum, item) => sum.add(item.total_cost),
      new Decimal(0),
    );
    const totalRevenue = quote.total;
    const grossProfit = totalRevenue.sub(totalCost);
    const marginPercent =
      Number(totalRevenue) > 0
        ? grossProfit.div(totalRevenue).mul(100)
        : new Decimal(0);

    // Fetch tenant thresholds
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { profitability_thresholds: true },
    });

    // Default thresholds
    const thresholds = (tenant?.profitability_thresholds as any) || {
      target: 25.0,
      minimum: 15.0,
      hard_floor: 10.0,
    };

    // Determine warning level
    let warningLevel: string;
    let canSend: boolean;
    const warnings: string[] = [];
    const recommendations: string[] = [];

    const margin = Number(marginPercent);

    if (margin >= thresholds.target) {
      warningLevel = 'green';
      canSend = true;
      recommendations.push(
        'Margin is above target - excellent profitability',
      );
    } else if (margin >= thresholds.minimum) {
      warningLevel = 'yellow';
      canSend = true;
      warnings.push(
        `Margin (${margin.toFixed(2)}%) is below target (${thresholds.target}%). Consider increasing markup or reducing costs.`,
      );
      recommendations.push('Review markup settings');
      recommendations.push('Negotiate better vendor pricing');
      recommendations.push('Optimize labor estimates');
    } else if (margin >= thresholds.hard_floor) {
      warningLevel = 'red';
      canSend = true;
      warnings.push(
        `Margin (${margin.toFixed(2)}%) is below minimum (${thresholds.minimum}%). Review pricing carefully before sending.`,
      );
      recommendations.push('URGENT: Increase profit/overhead markup');
      recommendations.push('Reduce vendor costs if possible');
      recommendations.push('Consider reducing scope or increasing quote total');
    } else {
      warningLevel = 'blocked';
      canSend = false;
      warnings.push(
        `Margin (${margin.toFixed(2)}%) is below hard floor (${thresholds.hard_floor}%). Cannot send without admin override.`,
      );
      recommendations.push('CRITICAL: This quote will lose money');
      recommendations.push('Increase total significantly or reject quote');
      recommendations.push('Contact admin for override if necessary');
    }

    // Additional warnings
    if (Number(quote.discount_amount) > 0) {
      const discountPercent =
        (Number(quote.discount_amount) / Number(quote.subtotal)) * 100;
      if (discountPercent > 10) {
        warnings.push(
          `High discount applied (${discountPercent.toFixed(2)}%) - further reducing margin`,
        );
      }
    }

    return {
      quote_id: quoteId,
      is_valid: canSend,
      can_send: canSend,
      margin_percent: Number(marginPercent.toDecimalPlaces(2)),
      warning_level: warningLevel,
      thresholds,
      financial_summary: {
        total_cost: Number(totalCost.toDecimalPlaces(2)),
        total_revenue: Number(totalRevenue),
        gross_profit: Number(grossProfit.toDecimalPlaces(2)),
        discount_amount: Number(quote.discount_amount),
        tax_amount: Number(quote.tax_amount),
        subtotal_before_discount: Number(quote.subtotal),
      },
      warnings,
      recommendations,
    };
  }

  /**
   * Analyze margins per item and per group
   * Shows which items/groups have low margins
   *
   * @param quoteId - Quote UUID
   * @param tenantId - Tenant UUID
   * @returns Detailed margin analysis
   */
  async analyzeMargins(quoteId: string, tenantId: string): Promise<any> {
    // Fetch quote with items and groups
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
      include: {
        items: {
          include: {
            unit_measurement: true,
            quote_group: true,
          },
          orderBy: { order_index: 'asc' },
        },
        groups: {
          include: {
            items: true,
          },
          orderBy: { order_index: 'asc' },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    // Get tenant settings for markup calculation
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        default_profit_margin: true,
        default_overhead_rate: true,
        default_contingency_rate: true,
      },
    });

    const defaultProfitPercent = tenant?.default_profit_margin
      ? Number(tenant.default_profit_margin)
      : 15;
    const defaultOverheadPercent = tenant?.default_overhead_rate
      ? Number(tenant.default_overhead_rate)
      : 10;
    const defaultContingencyPercent = tenant?.default_contingency_rate
      ? Number(tenant.default_contingency_rate)
      : 5;

    // Use custom percentages if set
    const profitPercent = quote.custom_profit_percent
      ? Number(quote.custom_profit_percent)
      : defaultProfitPercent;
    const overheadPercent = quote.custom_overhead_percent
      ? Number(quote.custom_overhead_percent)
      : defaultOverheadPercent;
    const contingencyPercent = quote.custom_contingency_percent
      ? Number(quote.custom_contingency_percent)
      : defaultContingencyPercent;

    // Calculate total markup factor (compounding)
    const profitMultiplier = 1 + profitPercent / 100;
    const overheadMultiplier = 1 + overheadPercent / 100;
    const contingencyMultiplier = 1 + contingencyPercent / 100;
    const totalMarkupMultiplier =
      profitMultiplier * overheadMultiplier * contingencyMultiplier;

    // Calculate overall margin
    const totalCost = quote.items.reduce(
      (sum, item) => sum + Number(item.total_cost),
      0,
    );
    const subtotal = Number(quote.subtotal);
    const overallMargin =
      subtotal > 0 ? ((subtotal - totalCost) / subtotal) * 100 : 0;

    // Analyze per item
    const itemsAnalysis = quote.items.map((item) => {
      const cost = Number(item.total_cost);
      const priceBeforeDiscount = cost * totalMarkupMultiplier;
      const margin =
        priceBeforeDiscount > 0
          ? ((priceBeforeDiscount - cost) / priceBeforeDiscount) * 100
          : 0;

      let status: string;
      if (margin >= 25) {
        status = 'healthy';
      } else if (margin >= 15) {
        status = 'acceptable';
      } else if (margin >= 10) {
        status = 'low_margin';
      } else {
        status = 'critical';
      }

      return {
        item_id: item.id,
        title: item.title,
        group_name: item.quote_group?.name || 'Ungrouped',
        quantity: Number(item.quantity),
        unit: item.unit_measurement?.abbreviation || null,
        cost: cost,
        price_before_discount: Number(priceBeforeDiscount.toFixed(2)),
        profit: Number((priceBeforeDiscount - cost).toFixed(2)),
        margin_percent: Number(margin.toFixed(2)),
        status,
      };
    });

    // Analyze per group
    const groupsAnalysis = quote.groups.map((group) => {
      const groupItems = quote.items.filter(
        (item) => item.quote_group_id === group.id,
      );
      const totalCost = groupItems.reduce(
        (sum, item) => sum + Number(item.total_cost),
        0,
      );
      const totalPrice = totalCost * totalMarkupMultiplier;
      const margin =
        totalPrice > 0 ? ((totalPrice - totalCost) / totalPrice) * 100 : 0;

      return {
        group_id: group.id,
        name: group.name,
        item_count: groupItems.length,
        total_cost: Number(totalCost.toFixed(2)),
        total_price: Number(totalPrice.toFixed(2)),
        margin_percent: Number(margin.toFixed(2)),
      };
    });

    // Identify low margin items
    const lowMarginItems = itemsAnalysis
      .filter((item) => item.margin_percent < 15)
      .sort((a, b) => a.margin_percent - b.margin_percent)
      .map((item) => ({
        item_id: item.item_id,
        title: item.title,
        margin_percent: item.margin_percent,
        cost: item.cost,
        price_before_discount: item.price_before_discount,
        recommendation:
          item.margin_percent < 10
            ? 'CRITICAL: Increase markup or reduce costs immediately'
            : 'Consider increasing markup or reducing costs',
      }));

    // Identify high margin items (potential pricing issues)
    const highMarginItems = itemsAnalysis
      .filter((item) => item.margin_percent > 50)
      .sort((a, b) => b.margin_percent - a.margin_percent)
      .map((item) => ({
        item_id: item.item_id,
        title: item.title,
        margin_percent: item.margin_percent,
        cost: item.cost,
        price_before_discount: item.price_before_discount,
        recommendation:
          'Very high margin - verify pricing is competitive',
      }));

    return {
      quote_id: quoteId,
      quote_total: Number(quote.total),
      overall_margin_percent: Number(overallMargin.toFixed(2)),
      markup_settings: {
        profit_percent: profitPercent,
        overhead_percent: overheadPercent,
        contingency_percent: contingencyPercent,
        total_markup_multiplier: Number(totalMarkupMultiplier.toFixed(4)),
      },
      items_analysis: itemsAnalysis,
      groups_analysis: groupsAnalysis,
      low_margin_items: lowMarginItems,
      high_margin_items: highMarginItems,
      summary: {
        total_items: itemsAnalysis.length,
        healthy_items: itemsAnalysis.filter((i) => i.status === 'healthy')
          .length,
        acceptable_items: itemsAnalysis.filter(
          (i) => i.status === 'acceptable',
        ).length,
        low_margin_items: itemsAnalysis.filter((i) => i.status === 'low_margin')
          .length,
        critical_items: itemsAnalysis.filter((i) => i.status === 'critical')
          .length,
      },
    };
  }
}
