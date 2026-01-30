import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  CreateLibraryItemDto,
  UpdateLibraryItemDto,
  ListLibraryItemsDto,
  BulkImportLibraryDto,
} from '../dto/library';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuid } from 'uuid';

@Injectable()
export class ItemLibraryService {
  private readonly logger = new Logger(ItemLibraryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Helper method to format library item response with computed total_cost_per_unit
   */
  private formatLibraryItem(item: any): any {
    const materialCost = Number(item.material_cost_per_unit);
    const laborCost = Number(item.labor_cost_per_unit);
    const equipmentCost = Number(item.equipment_cost_per_unit);
    const subcontractCost = Number(item.subcontract_cost_per_unit);
    const otherCost = Number(item.other_cost_per_unit);

    return {
      ...item,
      default_quantity: Number(item.default_quantity),
      material_cost_per_unit: materialCost,
      labor_cost_per_unit: laborCost,
      equipment_cost_per_unit: equipmentCost,
      subcontract_cost_per_unit: subcontractCost,
      other_cost_per_unit: otherCost,
      total_cost_per_unit: materialCost + laborCost + equipmentCost + subcontractCost + otherCost,
    };
  }

  /**
   * Create library item
   * Validates unit, sets default_quantity
   *
   * @param tenantId - Tenant UUID
   * @param userId - User UUID
   * @param dto - Create library item DTO
   * @returns Created library item
   */
  async create(
    tenantId: string,
    userId: string,
    dto: CreateLibraryItemDto,
  ): Promise<any> {
    // Validate unit measurement (global or tenant-owned)
    const unit = await this.prisma.unit_measurement.findFirst({
      where: {
        id: dto.unit_measurement_id,
        OR: [{ tenant_id: tenantId }, { is_global: true, tenant_id: null }],
        is_active: true,
      },
    });

    if (!unit) {
      throw new NotFoundException('Unit measurement not found or inactive');
    }

    // Validate at least one cost > 0
    const totalCost =
      dto.material_cost_per_unit +
      dto.labor_cost_per_unit +
      (dto.equipment_cost_per_unit || 0) +
      (dto.subcontract_cost_per_unit || 0) +
      (dto.other_cost_per_unit || 0);

    if (totalCost <= 0) {
      throw new BadRequestException(
        'At least one cost field must be greater than 0',
      );
    }

    const libraryItem = await this.prisma.item_library.create({
      data: {
        id: uuid(),
        tenant_id: tenantId,
        title: dto.title,
        description: dto.description || null,
        unit_measurement_id: dto.unit_measurement_id,
        default_quantity: new Decimal(dto.default_quantity),
        material_cost_per_unit: new Decimal(dto.material_cost_per_unit),
        labor_cost_per_unit: new Decimal(dto.labor_cost_per_unit),
        equipment_cost_per_unit: new Decimal(dto.equipment_cost_per_unit || 0),
        subcontract_cost_per_unit: new Decimal(dto.subcontract_cost_per_unit || 0),
        other_cost_per_unit: new Decimal(dto.other_cost_per_unit || 0),
        usage_count: 0,
      },
      include: {
        unit_measurement: true,
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'item_library',
      entityId: libraryItem.id,
      tenantId,
      actorUserId: userId,
      before: {} as any,
      after: libraryItem,
      description: `Library item created: ${dto.title}`,
    });

    this.logger.log(`Library item created: ${libraryItem.id}`);

    return this.formatLibraryItem(libraryItem);
  }

  /**
   * List library items with filters
   * Sorted by usage_count by default
   *
   * @param tenantId - Tenant UUID
   * @param listDto - List filters
   * @returns Paginated library items
   */
  async findAll(
    tenantId: string,
    listDto: ListLibraryItemsDto,
  ): Promise<any> {
    const {
      page = 1,
      limit = 50,
      is_active = true,
      search,
      unit_measurement_id,
      sort_by = 'usage_count',
      sort_order = 'desc',
    } = listDto;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      tenant_id: tenantId,
      is_active,
    };

    if (unit_measurement_id) {
      where.unit_measurement_id = unit_measurement_id;
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // Execute query
    const [items, total] = await Promise.all([
      this.prisma.item_library.findMany({
        where,
        include: {
          unit_measurement: true,
        },
        skip,
        take: limit,
        orderBy: { [sort_by]: sort_order },
      }),
      this.prisma.item_library.count({ where }),
    ]);

    return {
      data: items.map((item) => this.formatLibraryItem(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single library item
   *
   * @param tenantId - Tenant UUID
   * @param itemId - Library item UUID
   * @returns Library item
   */
  async findOne(tenantId: string, itemId: string): Promise<any> {
    const item = await this.prisma.item_library.findFirst({
      where: {
        id: itemId,
        tenant_id: tenantId,
      },
      include: {
        unit_measurement: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Library item not found');
    }

    return this.formatLibraryItem(item);
  }

  /**
   * Update library item
   * Only affects future uses, not existing quotes
   *
   * @param tenantId - Tenant UUID
   * @param itemId - Library item UUID
   * @param userId - User UUID
   * @param dto - Update library item DTO
   * @returns Updated library item
   */
  async update(
    tenantId: string,
    itemId: string,
    userId: string,
    dto: UpdateLibraryItemDto,
  ): Promise<any> {
    const item = await this.findOne(tenantId, itemId);

    // Validate unit measurement if provided
    if (dto.unit_measurement_id) {
      const unit = await this.prisma.unit_measurement.findFirst({
        where: {
          id: dto.unit_measurement_id,
          OR: [{ tenant_id: tenantId }, { is_global: true, tenant_id: null }],
          is_active: true,
        },
      });

      if (!unit) {
        throw new NotFoundException('Unit measurement not found or inactive');
      }
    }

    // Build update data
    const updateData: any = {};

    if (dto.title) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.unit_measurement_id) updateData.unit_measurement_id = dto.unit_measurement_id;
    if (dto.default_quantity) updateData.default_quantity = new Decimal(dto.default_quantity);
    if (dto.material_cost_per_unit !== undefined)
      updateData.material_cost_per_unit = new Decimal(dto.material_cost_per_unit);
    if (dto.labor_cost_per_unit !== undefined)
      updateData.labor_cost_per_unit = new Decimal(dto.labor_cost_per_unit);
    if (dto.equipment_cost_per_unit !== undefined)
      updateData.equipment_cost_per_unit = new Decimal(dto.equipment_cost_per_unit);
    if (dto.subcontract_cost_per_unit !== undefined)
      updateData.subcontract_cost_per_unit = new Decimal(dto.subcontract_cost_per_unit);
    if (dto.other_cost_per_unit !== undefined)
      updateData.other_cost_per_unit = new Decimal(dto.other_cost_per_unit);
    if (dto.is_active !== undefined) updateData.is_active = dto.is_active;

    const updatedItem = await this.prisma.item_library.update({
      where: { id: itemId },
      data: updateData,
      include: {
        unit_measurement: true,
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'item_library',
      entityId: itemId,
      tenantId,
      actorUserId: userId,
      before: item,
      after: updatedItem,
      description: `Library item updated: ${updatedItem.title}`,
    });

    this.logger.log(`Library item updated: ${itemId}`);

    return this.formatLibraryItem(updatedItem);
  }

  /**
   * Hard delete library item
   * Only allowed if usage_count = 0
   *
   * @param tenantId - Tenant UUID
   * @param itemId - Library item UUID
   * @param userId - User UUID
   */
  async delete(tenantId: string, itemId: string, userId: string): Promise<void> {
    const item = await this.findOne(tenantId, itemId);

    if (item.usage_count > 0) {
      throw new ConflictException(
        `Cannot delete library item with usage_count > 0 (${item.usage_count} uses). Consider marking as inactive instead.`,
      );
    }

    await this.prisma.item_library.delete({
      where: { id: itemId },
    });

    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'item_library',
      entityId: itemId,
      tenantId,
      actorUserId: userId,
      before: item,
      after: {} as any,
      description: `Library item deleted: ${item.title}`,
    });

    this.logger.log(`Library item deleted: ${itemId}`);
  }

  /**
   * Mark library item as inactive (soft delete alternative)
   *
   * @param tenantId - Tenant UUID
   * @param itemId - Library item UUID
   * @param userId - User UUID
   * @returns Updated library item
   */
  async markInactive(
    tenantId: string,
    itemId: string,
    userId: string,
  ): Promise<any> {
    const item = await this.findOne(tenantId, itemId);

    const updatedItem = await this.prisma.item_library.update({
      where: { id: itemId },
      data: { is_active: false },
      include: {
        unit_measurement: true,
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'item_library',
      entityId: itemId,
      tenantId,
      actorUserId: userId,
      before: item,
      after: updatedItem,
      description: `Library item marked inactive: ${item.title}`,
    });

    this.logger.log(`Library item marked inactive: ${itemId}`);

    return this.formatLibraryItem(updatedItem);
  }

  /**
   * Get library item statistics
   * Count quotes using item, total revenue
   *
   * @param tenantId - Tenant UUID
   * @param itemId - Library item UUID
   * @returns Statistics
   */
  async getStatistics(tenantId: string, itemId: string): Promise<any> {
    const item = await this.findOne(tenantId, itemId);

    // Find all quote items created from this library item
    // Note: We don't have a direct link, so we use name matching as approximation
    // In production, you might add a library_item_id FK to quote_item
    const quotesUsingItem = await this.prisma.quote_item.findMany({
      where: {
        quote: {
          tenant_id: tenantId,
        },
        title: item.title,
      },
      select: {
        quote_id: true,
        total_cost: true,
      },
    });

    const uniqueQuoteIds = new Set(quotesUsingItem.map((qi) => qi.quote_id));
    const totalRevenue = quotesUsingItem.reduce(
      (sum, qi) => sum + Number(qi.total_cost),
      0,
    );

    return {
      library_item_id: itemId,
      library_item_title: item.title,
      usage_count: item.usage_count,
      quotes_count: uniqueQuoteIds.size,
      total_revenue: totalRevenue,
    };
  }

  /**
   * Bulk import library items
   * Transaction: validate all, create all atomically (all or nothing)
   *
   * @param tenantId - Tenant UUID
   * @param userId - User UUID
   * @param dto - Bulk import DTO
   * @returns Created library items
   */
  async bulkImport(
    tenantId: string,
    userId: string,
    dto: BulkImportLibraryDto,
  ): Promise<any[]> {
    return await this.prisma.$transaction(async (tx) => {
      const createdItems: any[] = [];

      for (const itemDto of dto.items) {
        // Validate unit measurement
        const unit = await tx.unit_measurement.findFirst({
          where: {
            id: itemDto.unit_measurement_id,
            OR: [{ tenant_id: tenantId }, { is_global: true, tenant_id: null }],
            is_active: true,
          },
        });

        if (!unit) {
          throw new NotFoundException(
            `Unit measurement not found or inactive: ${itemDto.unit_measurement_id}`,
          );
        }

        // Validate at least one cost > 0
        const totalCost =
          itemDto.material_cost_per_unit +
          itemDto.labor_cost_per_unit +
          (itemDto.equipment_cost_per_unit || 0) +
          (itemDto.subcontract_cost_per_unit || 0) +
          (itemDto.other_cost_per_unit || 0);

        if (totalCost <= 0) {
          throw new BadRequestException(
            `At least one cost field must be greater than 0 for item: ${itemDto.title}`,
          );
        }

        // Create item
        const item = await tx.item_library.create({
          data: {
            id: uuid(),
            tenant_id: tenantId,
            title: itemDto.title,
            description: itemDto.description || null,
            unit_measurement_id: itemDto.unit_measurement_id,
            default_quantity: new Decimal(itemDto.default_quantity),
            material_cost_per_unit: new Decimal(itemDto.material_cost_per_unit),
            labor_cost_per_unit: new Decimal(itemDto.labor_cost_per_unit),
            equipment_cost_per_unit: new Decimal(itemDto.equipment_cost_per_unit || 0),
            subcontract_cost_per_unit: new Decimal(itemDto.subcontract_cost_per_unit || 0),
            other_cost_per_unit: new Decimal(itemDto.other_cost_per_unit || 0),
            usage_count: 0,
          },
          include: {
            unit_measurement: true,
          },
        });

        createdItems.push(item);
      }

      // Log audit trail for bulk import
      await this.auditLogger.logTenantChange({
        action: 'created',
        entityType: 'item_library',
        entityId: 'bulk',
        tenantId,
        actorUserId: userId,
        before: {} as any,
        after: { count: createdItems.length },
        description: `Bulk import: ${createdItems.length} library items created`,
      });

      this.logger.log(`Bulk import: ${createdItems.length} library items created`);

      return createdItems.map((item) => this.formatLibraryItem(item));
    });
  }
}
