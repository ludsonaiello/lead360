import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateFinancialCategoryDto } from '../dto/create-financial-category.dto';
import { UpdateFinancialCategoryDto } from '../dto/update-financial-category.dto';
import type { financial_category_type, financial_category_classification } from '@prisma/client';

/**
 * System default categories seeded per tenant.
 */
const DEFAULT_CATEGORIES: {
  name: string;
  type: financial_category_type;
  classification: financial_category_classification;
}[] = [
  { name: 'Labor - General', type: 'labor', classification: 'cost_of_goods_sold' },
  { name: 'Labor - Crew Overtime', type: 'labor', classification: 'cost_of_goods_sold' },
  { name: 'Materials - General', type: 'material', classification: 'cost_of_goods_sold' },
  { name: 'Materials - Tools', type: 'equipment', classification: 'cost_of_goods_sold' },
  { name: 'Materials - Safety Equipment', type: 'equipment', classification: 'cost_of_goods_sold' },
  { name: 'Subcontractor - General', type: 'subcontractor', classification: 'cost_of_goods_sold' },
  { name: 'Equipment Rental', type: 'equipment', classification: 'cost_of_goods_sold' },
  { name: 'Fuel & Transportation', type: 'other', classification: 'cost_of_goods_sold' },
  { name: 'Miscellaneous', type: 'other', classification: 'cost_of_goods_sold' },
  // Overhead categories (operating expenses)
  { name: 'Insurance', type: 'insurance', classification: 'operating_expense' },
  { name: 'Fuel & Vehicle', type: 'fuel', classification: 'operating_expense' },
  { name: 'Utilities', type: 'utilities', classification: 'operating_expense' },
  { name: 'Office & Admin', type: 'office', classification: 'operating_expense' },
  { name: 'Marketing & Advertising', type: 'marketing', classification: 'operating_expense' },
  { name: 'Taxes & Licenses', type: 'taxes', classification: 'operating_expense' },
  { name: 'Tools & Equipment Purchase', type: 'tools', classification: 'operating_expense' },
];

@Injectable()
export class FinancialCategoryService {
  private readonly logger = new Logger(FinancialCategoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Returns all active categories for a tenant, ordered by type then name.
   */
  async findAllForTenant(tenantId: string) {
    return this.prisma.financial_category.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Create a custom financial category.
   */
  async createCategory(
    tenantId: string,
    userId: string,
    dto: CreateFinancialCategoryDto,
  ) {
    const category = await this.prisma.financial_category.create({
      data: {
        tenant_id: tenantId,
        name: dto.name,
        type: dto.type,
        classification: dto.classification ?? 'cost_of_goods_sold',
        description: dto.description ?? null,
        is_system_default: false,
        created_by_user_id: userId,
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'financial_category',
      entityId: category.id,
      tenantId,
      actorUserId: userId,
      after: category,
      description: `Created financial category "${category.name}" (${category.type})`,
    });

    return category;
  }

  /**
   * Update a category. Type cannot be changed (business rule).
   */
  async updateCategory(
    tenantId: string,
    categoryId: string,
    userId: string,
    dto: UpdateFinancialCategoryDto,
  ) {
    const existing = await this.prisma.financial_category.findFirst({
      where: { id: categoryId, tenant_id: tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Financial category not found');
    }

    // Prevent classification change on system-default categories
    if (dto.classification !== undefined && existing.is_system_default) {
      throw new BadRequestException(
        'Cannot change the classification of a system-default category',
      );
    }

    const updated = await this.prisma.financial_category.update({
      where: { id: categoryId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.classification !== undefined && { classification: dto.classification }),
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'financial_category',
      entityId: categoryId,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: `Updated financial category "${updated.name}"`,
    });

    return updated;
  }

  /**
   * Deactivate a category. System defaults cannot be deactivated.
   */
  async deactivateCategory(
    tenantId: string,
    categoryId: string,
    userId: string,
  ) {
    const existing = await this.prisma.financial_category.findFirst({
      where: { id: categoryId, tenant_id: tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Financial category not found');
    }

    if (existing.is_system_default) {
      throw new BadRequestException(
        'System default categories cannot be deactivated',
      );
    }

    const updated = await this.prisma.financial_category.update({
      where: { id: categoryId },
      data: { is_active: false },
    });

    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'financial_category',
      entityId: categoryId,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: `Deactivated financial category "${existing.name}"`,
    });

    return updated;
  }

  /**
   * Seed 16 default categories for a tenant. Idempotent — skips if already seeded.
   */
  async seedDefaultCategories(tenantId: string) {
    // Check if defaults already exist for this tenant
    const existingCount = await this.prisma.financial_category.count({
      where: {
        tenant_id: tenantId,
        is_system_default: true,
      },
    });

    if (existingCount >= DEFAULT_CATEGORIES.length) {
      this.logger.log(
        `Tenant ${tenantId} already has ${existingCount} default financial categories, skipping seed.`,
      );
      return;
    }

    // Get existing default category names to avoid duplicates
    const existingDefaults = await this.prisma.financial_category.findMany({
      where: {
        tenant_id: tenantId,
        is_system_default: true,
      },
      select: { name: true },
    });
    const existingNames = new Set(existingDefaults.map((c) => c.name));

    const toCreate = DEFAULT_CATEGORIES.filter(
      (cat) => !existingNames.has(cat.name),
    );

    if (toCreate.length === 0) {
      return;
    }

    await this.prisma.financial_category.createMany({
      data: toCreate.map((cat) => ({
        tenant_id: tenantId,
        name: cat.name,
        type: cat.type,
        classification: cat.classification,
        is_system_default: true,
        is_active: true,
        created_by_user_id: null,
      })),
    });

    this.logger.log(
      `Seeded ${toCreate.length} default financial categories for tenant ${tenantId}`,
    );
  }
}
