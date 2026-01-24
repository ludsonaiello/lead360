import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { UpdateQuoteSettingsDto } from '../dto/settings';
import { Decimal } from '@prisma/client/runtime/library';

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
      is_using_system_defaults: this.isUsingSystemDefaults(tenant),
    };
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
      },
      select: {
        id: true,
        default_profit_margin: true,
        default_overhead_rate: true,
        default_contingency_rate: true,
        default_quote_terms: true,
        default_payment_instructions: true,
        default_quote_validity_days: true,
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
   * Note: This returns the approval configuration from the database
   */
  async getApprovalThresholds(tenantId: string) {
    // Verify tenant exists
    const tenant = await this.prisma.tenant.findFirst({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // For now, return standard approval thresholds
    // In the future, this could be made configurable per tenant
    return {
      approval_levels: [
        {
          level: 1,
          role: 'Manager',
          min_amount: 0,
          max_amount: 10000,
          description: 'Manager approval required for quotes up to $10,000',
        },
        {
          level: 2,
          role: 'Admin',
          min_amount: 10000,
          max_amount: 50000,
          description: 'Admin approval required for quotes $10,000 - $50,000',
        },
        {
          level: 3,
          role: 'Owner',
          min_amount: 50000,
          max_amount: null,
          description: 'Owner approval required for quotes over $50,000',
        },
      ],
    };
  }
}
