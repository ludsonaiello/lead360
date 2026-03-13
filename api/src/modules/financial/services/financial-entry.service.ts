import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateFinancialEntryDto } from '../dto/create-financial-entry.dto';
import { UpdateFinancialEntryDto } from '../dto/update-financial-entry.dto';
import { ListFinancialEntriesDto } from '../dto/list-financial-entries.dto';

@Injectable()
export class FinancialEntryService {
  private readonly logger = new Logger(FinancialEntryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Create a new financial entry.
   * Validates: category belongs to tenant, amount > 0, entry_date not future.
   */
  async createEntry(
    tenantId: string,
    userId: string,
    dto: CreateFinancialEntryDto,
  ) {
    // Validate category belongs to tenant
    await this.validateCategoryBelongsToTenant(tenantId, dto.category_id);

    // Validate entry_date is not in the future
    this.validateEntryDateNotFuture(dto.entry_date);

    const entry = await this.prisma.financial_entry.create({
      data: {
        tenant_id: tenantId,
        project_id: dto.project_id,
        task_id: dto.task_id ?? null,
        category_id: dto.category_id,
        entry_type: 'expense', // Phase 1: expense only
        amount: dto.amount,
        entry_date: new Date(dto.entry_date),
        vendor_name: dto.vendor_name ?? null,
        crew_member_id: dto.crew_member_id ?? null,
        subcontractor_id: dto.subcontractor_id ?? null,
        notes: dto.notes ?? null,
        has_receipt: false,
        created_by_user_id: userId,
      },
      include: {
        category: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'financial_entry',
      entityId: entry.id,
      tenantId,
      actorUserId: userId,
      after: entry,
      description: `Created financial entry of $${dto.amount} for project ${dto.project_id}`,
    });

    return entry;
  }

  /**
   * Get paginated entries for a project with optional filters.
   */
  async getProjectEntries(
    tenantId: string,
    query: ListFinancialEntriesDto,
  ) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      tenant_id: tenantId,
      project_id: query.project_id,
    };

    if (query.task_id) {
      where.task_id = query.task_id;
    }

    if (query.category_id) {
      where.category_id = query.category_id;
    }

    if (query.date_from || query.date_to) {
      where.entry_date = {};
      if (query.date_from) {
        where.entry_date.gte = new Date(query.date_from);
      }
      if (query.date_to) {
        where.entry_date.lte = new Date(query.date_to);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.financial_entry.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true, type: true },
          },
        },
        orderBy: { entry_date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.financial_entry.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get all entries for a specific task.
   */
  async getTaskEntries(tenantId: string, taskId: string) {
    return this.prisma.financial_entry.findMany({
      where: {
        tenant_id: tenantId,
        task_id: taskId,
      },
      include: {
        category: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: { entry_date: 'desc' },
    });
  }

  /**
   * Get a single entry by ID.
   */
  async getEntryById(tenantId: string, entryId: string) {
    const entry = await this.prisma.financial_entry.findFirst({
      where: {
        id: entryId,
        tenant_id: tenantId,
      },
      include: {
        category: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException('Financial entry not found');
    }

    return entry;
  }

  /**
   * Update a financial entry. Sets updated_by_user_id.
   */
  async updateEntry(
    tenantId: string,
    entryId: string,
    userId: string,
    dto: UpdateFinancialEntryDto,
  ) {
    const existing = await this.getEntryById(tenantId, entryId);

    // Validate category if being changed
    if (dto.category_id) {
      await this.validateCategoryBelongsToTenant(tenantId, dto.category_id);
    }

    // Validate entry_date if being changed
    if (dto.entry_date) {
      this.validateEntryDateNotFuture(dto.entry_date);
    }

    const data: any = {
      updated_by_user_id: userId,
    };

    if (dto.task_id !== undefined) data.task_id = dto.task_id ?? null;
    if (dto.category_id !== undefined) data.category_id = dto.category_id;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.entry_date !== undefined) data.entry_date = new Date(dto.entry_date);
    if (dto.vendor_name !== undefined) data.vendor_name = dto.vendor_name ?? null;
    if (dto.crew_member_id !== undefined) data.crew_member_id = dto.crew_member_id ?? null;
    if (dto.subcontractor_id !== undefined) data.subcontractor_id = dto.subcontractor_id ?? null;
    if (dto.notes !== undefined) data.notes = dto.notes ?? null;

    const updated = await this.prisma.financial_entry.update({
      where: { id: entryId },
      data,
      include: {
        category: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'financial_entry',
      entityId: entryId,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: `Updated financial entry ${entryId}`,
    });

    return updated;
  }

  /**
   * Hard delete a financial entry.
   */
  async deleteEntry(tenantId: string, entryId: string, userId: string) {
    const existing = await this.getEntryById(tenantId, entryId);

    await this.prisma.financial_entry.delete({
      where: { id: entryId },
    });

    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'financial_entry',
      entityId: entryId,
      tenantId,
      actorUserId: userId,
      before: existing,
      description: `Deleted financial entry ${entryId} ($${existing.amount})`,
    });

    return { message: 'Financial entry deleted successfully' };
  }

  /**
   * Get project cost summary — aggregates by category type.
   */
  async getProjectCostSummary(tenantId: string, projectId: string) {
    const entries = await this.prisma.financial_entry.findMany({
      where: {
        tenant_id: tenantId,
        project_id: projectId,
      },
      include: {
        category: {
          select: { type: true },
        },
      },
    });

    const costByCategory: Record<string, number> = {
      labor: 0,
      material: 0,
      subcontractor: 0,
      equipment: 0,
      other: 0,
    };

    let totalActualCost = 0;

    for (const entry of entries) {
      const amount = Number(entry.amount);
      const categoryType = entry.category.type;
      costByCategory[categoryType] = (costByCategory[categoryType] || 0) + amount;
      totalActualCost += amount;
    }

    return {
      project_id: projectId,
      total_actual_cost: Math.round(totalActualCost * 100) / 100,
      cost_by_category: {
        labor: Math.round(costByCategory.labor * 100) / 100,
        material: Math.round(costByCategory.material * 100) / 100,
        subcontractor: Math.round(costByCategory.subcontractor * 100) / 100,
        equipment: Math.round(costByCategory.equipment * 100) / 100,
        other: Math.round(costByCategory.other * 100) / 100,
      },
      entry_count: entries.length,
    };
  }

  /**
   * Get task cost summary — returns total cost and entry count.
   */
  async getTaskCostSummary(tenantId: string, taskId: string) {
    const entries = await this.prisma.financial_entry.findMany({
      where: {
        tenant_id: tenantId,
        task_id: taskId,
      },
      select: { amount: true },
    });

    let totalActualCost = 0;
    for (const entry of entries) {
      totalActualCost += Number(entry.amount);
    }

    return {
      task_id: taskId,
      total_actual_cost: Math.round(totalActualCost * 100) / 100,
      entry_count: entries.length,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async validateCategoryBelongsToTenant(
    tenantId: string,
    categoryId: string,
  ) {
    const category = await this.prisma.financial_category.findFirst({
      where: {
        id: categoryId,
        tenant_id: tenantId,
        is_active: true,
      },
    });

    if (!category) {
      throw new BadRequestException(
        'Financial category not found or does not belong to this tenant',
      );
    }

    return category;
  }

  private validateEntryDateNotFuture(entryDate: string) {
    const date = new Date(entryDate);
    const today = new Date();
    // Compare date-only (strip time)
    today.setHours(23, 59, 59, 999);

    if (date > today) {
      throw new BadRequestException('Entry date cannot be in the future');
    }
  }
}
