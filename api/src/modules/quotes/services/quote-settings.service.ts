import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { UpdateQuoteSettingsDto } from '../dto/settings';
import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';

/**
 * System defaults for quote settings
 */
const SYSTEM_DEFAULTS = {
  default_profit_margin: 20.0,
  default_overhead_rate: 10.0,
  default_contingency_rate: 5.0,
  default_quote_terms: 'Payment due upon completion',
  default_payment_instructions: 'Check or cash accepted',
  default_quote_validity_days: 30,
};

@Injectable()
export class QuoteSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Get quote settings for tenant (with system defaults fallback)
   */
  async getSettings(tenantId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        id: true,
        default_profit_margin: true,
        default_overhead_rate: true,
        default_contingency_rate: true,
        default_quote_terms: true,
        default_payment_instructions: true,
        default_quote_validity_days: true,
        quote_prefix: true,
        next_quote_number: true,
        invoice_prefix: true,
        next_invoice_number: true,
        default_quote_footer: true,
        default_invoice_footer: true,
        sales_tax_rate: true,
        profitability_thresholds: true,
        active_quote_template_id: true,
        show_line_items_by_default: true,
        show_cost_breakdown_by_default: true,
        approval_thresholds: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Return tenant settings with system defaults as fallback
    return {
      default_profit_margin:
        tenant.default_profit_margin !== null
          ? Number(tenant.default_profit_margin)
          : SYSTEM_DEFAULTS.default_profit_margin,
      default_overhead_rate:
        tenant.default_overhead_rate !== null
          ? Number(tenant.default_overhead_rate)
          : SYSTEM_DEFAULTS.default_overhead_rate,
      default_contingency_rate:
        tenant.default_contingency_rate !== null
          ? Number(tenant.default_contingency_rate)
          : SYSTEM_DEFAULTS.default_contingency_rate,
      default_quote_terms:
        tenant.default_quote_terms || SYSTEM_DEFAULTS.default_quote_terms,
      default_payment_instructions:
        tenant.default_payment_instructions ||
        SYSTEM_DEFAULTS.default_payment_instructions,
      default_quote_validity_days:
        tenant.default_quote_validity_days ||
        SYSTEM_DEFAULTS.default_quote_validity_days,
      quote_prefix: tenant.quote_prefix || 'Q-',
      next_quote_number: tenant.next_quote_number || 1,
      invoice_prefix: tenant.invoice_prefix || 'INV',
      next_invoice_number: tenant.next_invoice_number || 1,
      default_quote_footer: tenant.default_quote_footer || null,
      default_invoice_footer: tenant.default_invoice_footer || null,
      sales_tax_rate:
        tenant.sales_tax_rate !== null
          ? Number(tenant.sales_tax_rate)
          : null,
      profitability_thresholds: tenant.profitability_thresholds || null,
      active_quote_template_id: tenant.active_quote_template_id || null,
      show_line_items_by_default: tenant.show_line_items_by_default ?? true,
      show_cost_breakdown_by_default: tenant.show_cost_breakdown_by_default ?? false,
      approval_thresholds: tenant.approval_thresholds || null,
      is_using_system_defaults: this.isUsingSystemDefaults(tenant),
    };
  }

  /**
   * Normalize approval thresholds to expected format
   * Accepts both array and object formats from frontend
   */
  private normalizeApprovalThresholds(value: any): any {
    if (!value) {
      return null;
    }

    // If it's already an object with approval_levels, return as-is
    if (typeof value === 'object' && !Array.isArray(value) && value.approval_levels) {
      return value;
    }

    // If it's an array, wrap it in the expected object structure
    if (Array.isArray(value)) {
      return {
        approval_levels: value,
      };
    }

    // If it's some other object format, return as-is (let Prisma handle it)
    return value;
  }

  /**
   * Check if tenant is using system defaults
   */
  private isUsingSystemDefaults(tenant: any): boolean {
    return (
      tenant.default_profit_margin === null &&
      tenant.default_overhead_rate === null &&
      tenant.default_contingency_rate === null &&
      !tenant.default_quote_terms &&
      !tenant.default_payment_instructions &&
      !tenant.default_quote_validity_days
    );
  }

  /**
   * Update quote settings (upsert on tenant table)
   */
  async updateSettings(
    tenantId: string,
    userId: string,
    dto: UpdateQuoteSettingsDto,
  ) {
    // Get current settings
    const currentSettings = await this.getSettings(tenantId);

    // Update tenant record
    const updateData: any = {};

    if (dto.default_profit_margin !== undefined) {
      updateData.default_profit_margin = new Decimal(dto.default_profit_margin);
    }
    if (dto.default_overhead_rate !== undefined) {
      updateData.default_overhead_rate = new Decimal(dto.default_overhead_rate);
    }
    if (dto.default_contingency_rate !== undefined) {
      updateData.default_contingency_rate = new Decimal(
        dto.default_contingency_rate,
      );
    }
    if (dto.default_quote_terms !== undefined) {
      updateData.default_quote_terms = dto.default_quote_terms;
    }
    if (dto.default_payment_instructions !== undefined) {
      updateData.default_payment_instructions = dto.default_payment_instructions;
    }
    if (dto.default_quote_validity_days !== undefined) {
      updateData.default_quote_validity_days = dto.default_quote_validity_days;
    }
    if (dto.quote_prefix !== undefined) {
      updateData.quote_prefix = dto.quote_prefix;
    }
    if (dto.next_quote_number !== undefined) {
      updateData.next_quote_number = dto.next_quote_number;
    }
    if (dto.invoice_prefix !== undefined) {
      updateData.invoice_prefix = dto.invoice_prefix;
    }
    if (dto.next_invoice_number !== undefined) {
      updateData.next_invoice_number = dto.next_invoice_number;
    }
    if (dto.default_quote_footer !== undefined) {
      updateData.default_quote_footer = dto.default_quote_footer;
    }
    if (dto.default_invoice_footer !== undefined) {
      updateData.default_invoice_footer = dto.default_invoice_footer;
    }
    if (dto.sales_tax_rate !== undefined) {
      updateData.sales_tax_rate = dto.sales_tax_rate !== null ? new Decimal(dto.sales_tax_rate) : null;
    }
    if (dto.profitability_thresholds !== undefined) {
      updateData.profitability_thresholds = dto.profitability_thresholds;
    }
    if (dto.active_quote_template_id !== undefined) {
      updateData.active_quote_template_id = dto.active_quote_template_id;
    }
    if (dto.show_line_items_by_default !== undefined) {
      updateData.show_line_items_by_default = dto.show_line_items_by_default;
    }
    if (dto.show_cost_breakdown_by_default !== undefined) {
      updateData.show_cost_breakdown_by_default = dto.show_cost_breakdown_by_default;
    }
    if (dto.approval_thresholds !== undefined) {
      // Normalize approval_thresholds (accept both array and object formats)
      updateData.approval_thresholds = this.normalizeApprovalThresholds(dto.approval_thresholds);
    }
    // Note: is_using_system_defaults is computed/read-only, not persisted

    const updatedTenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
      select: {
        id: true,
        default_profit_margin: true,
        default_overhead_rate: true,
        default_contingency_rate: true,
        default_quote_terms: true,
        default_payment_instructions: true,
        default_quote_validity_days: true,
        quote_prefix: true,
        next_quote_number: true,
        invoice_prefix: true,
        next_invoice_number: true,
        default_quote_footer: true,
        default_invoice_footer: true,
        sales_tax_rate: true,
        profitability_thresholds: true,
        active_quote_template_id: true,
        show_line_items_by_default: true,
        show_cost_breakdown_by_default: true,
        approval_thresholds: true,
      },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'quote_settings',
      entityId: tenantId,
      tenantId,
      actorUserId: userId,
      before: currentSettings,
      after: updatedTenant,
      description: 'Quote settings updated',
    });

    // Return formatted settings
    return this.getSettings(tenantId);
  }

  /**
   * Reset quote settings to system defaults
   */
  async resetToDefaults(tenantId: string, userId: string) {
    // Get current settings
    const currentSettings = await this.getSettings(tenantId);

    // Reset tenant settings to NULL/empty to use system defaults
    const updatedTenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        default_profit_margin: null,
        default_overhead_rate: null,
        default_contingency_rate: null,
        default_quote_terms: null,
        default_payment_instructions: null,
        default_quote_validity_days: 30,
        quote_prefix: 'Q-',
        next_quote_number: 1,
        invoice_prefix: 'INV',
        next_invoice_number: 1,
        default_quote_footer: null,
        default_invoice_footer: null,
        sales_tax_rate: null,
        profitability_thresholds: Prisma.JsonNull,
        active_quote_template_id: null,
        show_line_items_by_default: true,
        show_cost_breakdown_by_default: false,
        approval_thresholds: Prisma.JsonNull,
      },
      select: {
        id: true,
        default_profit_margin: true,
        default_overhead_rate: true,
        default_contingency_rate: true,
        default_quote_terms: true,
        default_payment_instructions: true,
        default_quote_validity_days: true,
        quote_prefix: true,
        next_quote_number: true,
        invoice_prefix: true,
        next_invoice_number: true,
        default_quote_footer: true,
        default_invoice_footer: true,
        sales_tax_rate: true,
        profitability_thresholds: true,
        active_quote_template_id: true,
        show_line_items_by_default: true,
        show_cost_breakdown_by_default: true,
        approval_thresholds: true,
      },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'quote_settings',
      entityId: tenantId,
      tenantId,
      actorUserId: userId,
      before: currentSettings,
      after: updatedTenant,
      description: 'Quote settings reset to system defaults',
    });

    // Return formatted settings
    return this.getSettings(tenantId);
  }

  /**
   * Get approval thresholds configuration
   * Returns tenant-specific approval thresholds or null if approvals not required
   *
   * @returns approval_thresholds object or null (null = no approvals required, auto-approve all)
   */
  async getApprovalThresholds(tenantId: string) {
    // Verify tenant exists
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
      select: {
        id: true,
        approval_thresholds: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Return tenant's approval thresholds or null
    // null = approval workflow disabled, all quotes auto-approved
    return tenant.approval_thresholds || null;
  }
}
