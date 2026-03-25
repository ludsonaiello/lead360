import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateSupplierCategoryDto } from '../dto/create-supplier-category.dto';
import { UpdateSupplierCategoryDto } from '../dto/update-supplier-category.dto';

@Injectable()
export class SupplierCategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Create a new supplier category for a tenant.
   * Enforces: 50-category limit, case-insensitive name uniqueness.
   */
  async create(
    tenantId: string,
    userId: string,
    dto: CreateSupplierCategoryDto,
  ) {
    // 1. Check 50-category limit
    const activeCount = await this.prisma.supplier_category.count({
      where: { tenant_id: tenantId, is_active: true },
    });
    if (activeCount >= 50) {
      throw new BadRequestException(
        'Maximum of 50 active supplier categories per tenant. Deactivate unused categories before creating new ones.',
      );
    }

    // 2. Case-insensitive uniqueness check (MySQL utf8mb4_unicode_ci collation handles ci matching)
    const existing = await this.prisma.supplier_category.findFirst({
      where: {
        tenant_id: tenantId,
        name: dto.name,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Supplier category "${dto.name}" already exists for this tenant.`,
      );
    }

    // 3. Create the category (Prisma @default(uuid()) generates the ID)
    const category = await this.prisma.supplier_category.create({
      data: {
        tenant_id: tenantId,
        name: dto.name,
        description: dto.description ?? null,
        color: dto.color ?? null,
        created_by_user_id: userId,
      },
    });

    // 4. Audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'supplier_category',
      entityId: category.id,
      tenantId,
      actorUserId: userId,
      after: category,
      description: `Supplier category created: ${category.name}`,
    });

    // 5. Return created category
    return category;
  }

  /**
   * Returns all categories for a tenant, optionally filtered by is_active.
   * Includes supplier_count (active suppliers only) for each category.
   */
  async findAll(tenantId: string, isActive?: boolean) {
    const where: any = { tenant_id: tenantId };
    if (isActive !== undefined) {
      where.is_active = isActive;
    }

    const categories = await this.prisma.supplier_category.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    // Get active supplier counts per category (max 50 categories, N+1 is acceptable)
    const categoriesWithCounts = await Promise.all(
      categories.map(async (cat) => {
        const supplierCount =
          await this.prisma.supplier_category_assignment.count({
            where: {
              supplier_category_id: cat.id,
              tenant_id: tenantId,
              supplier: { is_active: true },
            },
          });
        return { ...cat, supplier_count: supplierCount };
      }),
    );

    return categoriesWithCounts;
  }

  /**
   * Find a single supplier category by ID within a tenant.
   * Throws NotFoundException if not found or wrong tenant.
   */
  async findOne(tenantId: string, categoryId: string) {
    const category = await this.prisma.supplier_category.findFirst({
      where: { id: categoryId, tenant_id: tenantId },
    });

    if (!category) {
      throw new NotFoundException('Supplier category not found.');
    }

    return category;
  }

  /**
   * Update a supplier category.
   * Enforces: case-insensitive name uniqueness on name change, 50-limit on reactivation.
   */
  async update(
    tenantId: string,
    categoryId: string,
    userId: string,
    dto: UpdateSupplierCategoryDto,
  ) {
    // 1. Find existing category
    const existing = await this.findOne(tenantId, categoryId);

    // 2. If name is being changed, check uniqueness
    if (dto.name && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.prisma.supplier_category.findFirst({
        where: {
          tenant_id: tenantId,
          name: dto.name,
          id: { not: categoryId },
        },
      });
      if (duplicate) {
        throw new ConflictException(
          `Supplier category "${dto.name}" already exists for this tenant.`,
        );
      }
    }

    // 3. If reactivating (is_active: true on a currently inactive category), check 50-limit
    if (dto.is_active === true && !existing.is_active) {
      const activeCount = await this.prisma.supplier_category.count({
        where: { tenant_id: tenantId, is_active: true },
      });
      if (activeCount >= 50) {
        throw new BadRequestException(
          'Maximum of 50 active supplier categories per tenant.',
        );
      }
    }

    // 4. Update only the provided fields
    const updated = await this.prisma.supplier_category.update({
      where: { id: categoryId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
      },
    });

    // 5. Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'supplier_category',
      entityId: categoryId,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: `Supplier category updated: ${updated.name}`,
    });

    // 6. Return updated category
    return updated;
  }

  /**
   * Delete a supplier category (hard delete).
   * Blocks deletion if the category has any supplier assignments.
   */
  async delete(tenantId: string, categoryId: string, userId: string) {
    // 1. Find existing category
    const existing = await this.findOne(tenantId, categoryId);

    // 2. Check if category is assigned to any supplier (active or not — prevents orphaned junction records)
    const assignmentCount =
      await this.prisma.supplier_category_assignment.count({
        where: {
          supplier_category_id: categoryId,
          tenant_id: tenantId,
        },
      });
    if (assignmentCount > 0) {
      throw new ConflictException(
        'Category is assigned to one or more suppliers. Deactivate it instead.',
      );
    }

    // 3. Hard delete
    await this.prisma.supplier_category.delete({
      where: { id: categoryId },
    });

    // 4. Audit log
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'supplier_category',
      entityId: categoryId,
      tenantId,
      actorUserId: userId,
      before: existing,
      description: `Supplier category deleted: ${existing.name}`,
    });

    // 5. Return success message
    return { message: 'Supplier category deleted successfully' };
  }
}
