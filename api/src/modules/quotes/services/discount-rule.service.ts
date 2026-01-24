import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { QuoteVersionService } from './quote-version.service';
import { QuotePricingService } from './quote-pricing.service';
import {
  CreateDiscountRuleDto,
  UpdateDiscountRuleDto,
  ReorderDiscountRulesDto,
  PreviewDiscountImpactDto,
} from '../dto/discount-rule';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuid } from 'uuid';

@Injectable()
export class DiscountRuleService {
  private readonly logger = new Logger(DiscountRuleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: QuotePricingService,
    private readonly versionService: QuoteVersionService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Create discount rule
   * Validates quote exists, not approved, and value within range
   * Recalculates quote totals and creates version
   *
   * @param quoteId - Quote UUID
   * @param dto - Create discount rule DTO
   * @param tenantId - Tenant UUID
   * @param userId - User UUID
   * @returns Created discount rule
   */
  async create(
    quoteId: string,
    dto: CreateDiscountRuleDto,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    // 1. Validate quote exists and belongs to tenant
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    // 2. Validate quote not approved
    if (quote.status === 'approved') {
      throw new BadRequestException('Cannot modify approved quote');
    }

    // 3. Validate value based on rule_type
    if (dto.rule_type === 'percentage') {
      if (dto.value < 0 || dto.value > 100) {
        throw new BadRequestException('Percentage must be between 0 and 100');
      }
    } else if (dto.rule_type === 'fixed_amount') {
      if (dto.value <= 0) {
        throw new BadRequestException('Fixed amount must be positive');
      }
      // Optionally validate fixed amount not greater than subtotal
      if (dto.value > Number(quote.subtotal)) {
        throw new BadRequestException(
          'Fixed amount discount cannot exceed quote subtotal',
        );
      }
    }

    // 4. Transaction
    return await this.prisma.$transaction(async (tx) => {
      // Get max order_index
      const maxOrder = await tx.quote_discount_rule.aggregate({
        where: { quote_id: quoteId },
        _max: { order_index: true },
      });

      // Create rule
      const rule = await tx.quote_discount_rule.create({
        data: {
          id: uuid(),
          quote_id: quoteId,
          rule_type: dto.rule_type,
          value: new Decimal(dto.value),
          reason: dto.reason,
          apply_to: dto.apply_to || 'subtotal',
          order_index: (maxOrder._max.order_index || -1) + 1,
        },
      });

      // 🔥 CRITICAL: Recalculate quote totals
      await this.pricingService.updateQuoteFinancials(quoteId, tx);

      // Create version (+0.1 minor change)
      await this.versionService.createVersion(
        quoteId,
        0.1,
        `Discount rule added: ${dto.reason}`,
        userId,
        tx,
      );

      this.logger.log(`Discount rule created: ${rule.id} for quote: ${quoteId}`);

      return rule;
    }).then(async (rule) => {
      // Audit log (outside transaction - non-blocking)
      await this.auditLogger.logTenantChange({
        action: 'created',
        entityType: 'discount_rule',
        entityId: rule.id,
        tenantId,
        actorUserId: userId,
        before: {} as any,
        after: rule,
        description: `Discount rule created: ${rule.reason}`,
      });

      return rule;
    });
  }

  /**
   * List all discount rules for a quote
   * Includes total discount amount from quote
   *
   * @param quoteId - Quote UUID
   * @param tenantId - Tenant UUID
   * @returns Discount rules and summary
   */
  async findAll(quoteId: string, tenantId: string): Promise<any> {
    // Validate quote exists
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
      include: {
        discount_rules: {
          orderBy: { order_index: 'asc' },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    return {
      discount_rules: quote.discount_rules.map((rule) => ({
        id: rule.id,
        quote_id: rule.quote_id,
        rule_type: rule.rule_type,
        value: Number(rule.value),
        reason: rule.reason,
        apply_to: rule.apply_to,
        order_index: rule.order_index,
        created_at: rule.created_at,
      })),
      summary: {
        total_discount_amount: Number(quote.discount_amount),
        subtotal_before_discounts: Number(quote.subtotal),
        subtotal_after_discounts:
          Number(quote.subtotal) - Number(quote.discount_amount),
        discount_count: quote.discount_rules.length,
      },
    };
  }

  /**
   * Get single discount rule
   *
   * @param quoteId - Quote UUID
   * @param ruleId - Discount rule UUID
   * @param tenantId - Tenant UUID
   * @returns Discount rule
   */
  async findOne(
    quoteId: string,
    ruleId: string,
    tenantId: string,
  ): Promise<any> {
    // Validate quote exists
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    const rule = await this.prisma.quote_discount_rule.findFirst({
      where: { id: ruleId, quote_id: quoteId },
    });

    if (!rule) {
      throw new NotFoundException('Discount rule not found');
    }

    return {
      id: rule.id,
      quote_id: rule.quote_id,
      rule_type: rule.rule_type,
      value: Number(rule.value),
      reason: rule.reason,
      apply_to: rule.apply_to,
      order_index: rule.order_index,
      created_at: rule.created_at,
    };
  }

  /**
   * Update discount rule
   * Validates and recalculates quote totals
   *
   * @param quoteId - Quote UUID
   * @param ruleId - Discount rule UUID
   * @param dto - Update discount rule DTO
   * @param tenantId - Tenant UUID
   * @param userId - User UUID
   * @returns Updated discount rule
   */
  async update(
    quoteId: string,
    ruleId: string,
    dto: UpdateDiscountRuleDto,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    // Validate quote and rule exist
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.status === 'approved') {
      throw new BadRequestException('Cannot modify approved quote');
    }

    const rule = await this.prisma.quote_discount_rule.findFirst({
      where: { id: ruleId, quote_id: quoteId },
    });

    if (!rule) {
      throw new NotFoundException('Discount rule not found');
    }

    // Validate value if provided
    const ruleType = dto.rule_type || rule.rule_type;
    const value = dto.value !== undefined ? dto.value : Number(rule.value);

    if (ruleType === 'percentage') {
      if (value < 0 || value > 100) {
        throw new BadRequestException('Percentage must be between 0 and 100');
      }
    } else if (ruleType === 'fixed_amount') {
      if (value <= 0) {
        throw new BadRequestException('Fixed amount must be positive');
      }
    }

    return await this.prisma.$transaction(async (tx) => {
      // Update rule
      const updatedRule = await tx.quote_discount_rule.update({
        where: { id: ruleId },
        data: {
          rule_type: dto.rule_type || rule.rule_type,
          value: dto.value !== undefined ? new Decimal(dto.value) : rule.value,
          reason: dto.reason || rule.reason,
          apply_to: dto.apply_to || rule.apply_to,
        },
      });

      // Recalculate quote totals
      await this.pricingService.updateQuoteFinancials(quoteId, tx);

      // Create version
      await this.versionService.createVersion(
        quoteId,
        0.1,
        `Discount rule updated: ${dto.reason || rule.reason}`,
        userId,
        tx,
      );

      this.logger.log(`Discount rule updated: ${ruleId}`);

      return updatedRule;
    }).then(async (updatedRule) => {
      // Audit log
      await this.auditLogger.logTenantChange({
        action: 'updated',
        entityType: 'discount_rule',
        entityId: ruleId,
        tenantId,
        actorUserId: userId,
        before: rule,
        after: updatedRule,
        description: `Discount rule updated: ${updatedRule.reason}`,
      });

      return {
        id: updatedRule.id,
        quote_id: updatedRule.quote_id,
        rule_type: updatedRule.rule_type,
        value: Number(updatedRule.value),
        reason: updatedRule.reason,
        apply_to: updatedRule.apply_to,
        order_index: updatedRule.order_index,
        created_at: updatedRule.created_at,
      };
    });
  }

  /**
   * Delete discount rule
   * Hard delete, recalculates quote totals
   *
   * @param quoteId - Quote UUID
   * @param ruleId - Discount rule UUID
   * @param tenantId - Tenant UUID
   * @param userId - User UUID
   */
  async delete(
    quoteId: string,
    ruleId: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    // Validate quote and rule exist
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.status === 'approved') {
      throw new BadRequestException('Cannot modify approved quote');
    }

    const rule = await this.prisma.quote_discount_rule.findFirst({
      where: { id: ruleId, quote_id: quoteId },
    });

    if (!rule) {
      throw new NotFoundException('Discount rule not found');
    }

    await this.prisma.$transaction(async (tx) => {
      // Hard delete
      await tx.quote_discount_rule.delete({
        where: { id: ruleId },
      });

      // Recalculate quote totals (total will increase after discount removed)
      await this.pricingService.updateQuoteFinancials(quoteId, tx);

      // Create version
      await this.versionService.createVersion(
        quoteId,
        0.1,
        `Discount rule removed: ${rule.reason}`,
        userId,
        tx,
      );

      this.logger.log(`Discount rule deleted: ${ruleId}`);
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'discount_rule',
      entityId: ruleId,
      tenantId,
      actorUserId: userId,
      before: rule,
      after: {} as any,
      description: `Discount rule deleted: ${rule.reason}`,
    });
  }

  /**
   * Reorder discount rules
   * Important: Order affects totals for percentage discounts (compounding)
   *
   * @param quoteId - Quote UUID
   * @param dto - Reorder discount rules DTO
   * @param tenantId - Tenant UUID
   * @param userId - User UUID
   * @returns Updated discount rules
   */
  async reorder(
    quoteId: string,
    dto: ReorderDiscountRulesDto,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    // Validate quote exists
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.status === 'approved') {
      throw new BadRequestException('Cannot modify approved quote');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Update order_index for each rule
      for (const ruleOrder of dto.discount_rules) {
        await tx.quote_discount_rule.updateMany({
          where: { id: ruleOrder.id, quote_id: quoteId },
          data: { order_index: ruleOrder.new_order_index },
        });
      }

      // Recalculate quote totals (order affects percentage discount compounding)
      await this.pricingService.updateQuoteFinancials(quoteId, tx);

      // Create version
      await this.versionService.createVersion(
        quoteId,
        0.1,
        'Discount rules reordered',
        userId,
        tx,
      );

      // Fetch updated rules
      const updatedRules = await tx.quote_discount_rule.findMany({
        where: { quote_id: quoteId },
        orderBy: { order_index: 'asc' },
      });

      this.logger.log(`Discount rules reordered for quote: ${quoteId}`);

      return updatedRules.map((rule) => ({
        id: rule.id,
        quote_id: rule.quote_id,
        rule_type: rule.rule_type,
        value: Number(rule.value),
        reason: rule.reason,
        apply_to: rule.apply_to,
        order_index: rule.order_index,
        created_at: rule.created_at,
      }));
    });
  }

  /**
   * Preview discount impact
   * Calculates what the discount would do without saving
   * Read-only operation
   *
   * @param quoteId - Quote UUID
   * @param dto - Preview discount impact DTO
   * @param tenantId - Tenant UUID
   * @returns Before/after comparison
   */
  async previewImpact(
    quoteId: string,
    dto: PreviewDiscountImpactDto,
    tenantId: string,
  ): Promise<any> {
    // Validate quote exists
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

    // Calculate current state
    const currentTotal = Number(quote.total);
    const currentSubtotal = Number(quote.subtotal);

    // Calculate proposed discount amount
    let proposedDiscountAmount = 0;
    if (dto.rule_type === 'percentage') {
      proposedDiscountAmount = currentSubtotal * (dto.value / 100);
    } else {
      proposedDiscountAmount = dto.value;
    }

    // Calculate new total (simplified - doesn't account for existing discounts)
    const newSubtotalAfterDiscount = currentSubtotal - proposedDiscountAmount;
    const taxAmount = Number(quote.tax_amount);
    const newTotal = newSubtotalAfterDiscount + taxAmount;

    // Calculate margin impact
    const totalCost = quote.items.reduce(
      (sum, item) => sum + Number(item.total_cost),
      0,
    );
    const currentMargin = ((currentTotal - totalCost) / currentTotal) * 100;
    const newMargin = ((newTotal - totalCost) / newTotal) * 100;

    return {
      current_total: currentTotal,
      proposed_discount_amount: proposedDiscountAmount,
      new_total: newTotal,
      impact_amount: currentTotal - newTotal,
      impact_percent: ((currentTotal - newTotal) / currentTotal) * 100,
      current_margin_percent: currentMargin,
      new_margin_percent: newMargin,
      margin_change: newMargin - currentMargin,
    };
  }
}
