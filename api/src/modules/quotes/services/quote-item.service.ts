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
  CreateItemDto,
  UpdateItemDto,
  ReorderItemsDto,
  MoveItemToGroupDto,
} from '../dto/item';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuid } from 'uuid';

@Injectable()
export class QuoteItemService {
  private readonly logger = new Logger(QuoteItemService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly versionService: QuoteVersionService,
    private readonly pricingService: QuotePricingService,
  ) {}

  /**
   * Create new quote item
   * Validates costs > 0, sets order_index
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param userId - User UUID
   * @param dto - Create item DTO
   * @returns Created item with relationships
   */
  async create(
    tenantId: string,
    quoteId: string,
    userId: string,
    dto: CreateItemDto,
  ): Promise<any> {
    // Validate quote exists and belongs to tenant
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.status === 'approved') {
      throw new BadRequestException('Cannot add items to approved quote');
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

    return await this.prisma.$transaction(async (tx) => {
      // Validate unit measurement (global or tenant-owned)
      const unit = await tx.unit_measurement.findFirst({
        where: {
          id: dto.unit_measurement_id,
          OR: [{ tenant_id: tenantId }, { is_global: true, tenant_id: null }],
          is_active: true,
        },
      });

      if (!unit) {
        throw new NotFoundException('Unit measurement not found or inactive');
      }

      // Validate quote group if provided
      if (dto.quote_group_id) {
        const group = await tx.quote_group.findFirst({
          where: {
            id: dto.quote_group_id,
            quote_id: quoteId,
          },
        });

        if (!group) {
          throw new NotFoundException('Quote group not found');
        }
      }

      // Get next order_index
      const lastItem = await tx.quote_item.findFirst({
        where: { quote_id: quoteId },
        orderBy: { order_index: 'desc' },
        select: { order_index: true },
      });

      const orderIndex = lastItem ? lastItem.order_index + 1 : 1;

      // Calculate total_cost
      const itemTotalCost = totalCost * dto.quantity;

      // Create item
      const item = await tx.quote_item.create({
        data: {
          id: uuid(),
          quote_id: quoteId,
          quote_group_id: dto.quote_group_id || null,
          title: dto.title,
          description: dto.description || null,
          quantity: new Decimal(dto.quantity),
          unit_measurement_id: dto.unit_measurement_id,
          material_cost_per_unit: new Decimal(dto.material_cost_per_unit),
          labor_cost_per_unit: new Decimal(dto.labor_cost_per_unit),
          equipment_cost_per_unit: new Decimal(
            dto.equipment_cost_per_unit || 0,
          ),
          subcontract_cost_per_unit: new Decimal(
            dto.subcontract_cost_per_unit || 0,
          ),
          other_cost_per_unit: new Decimal(dto.other_cost_per_unit || 0),
          total_cost: new Decimal(itemTotalCost),
          custom_profit_percent:
            dto.custom_profit_percent !== undefined
              ? dto.custom_profit_percent !== null
                ? new Decimal(dto.custom_profit_percent)
                : null
              : null,
          custom_overhead_percent:
            dto.custom_overhead_percent !== undefined
              ? dto.custom_overhead_percent !== null
                ? new Decimal(dto.custom_overhead_percent)
                : null
              : null,
          custom_contingency_percent:
            dto.custom_contingency_percent !== undefined
              ? dto.custom_contingency_percent !== null
                ? new Decimal(dto.custom_contingency_percent)
                : null
              : null,
          custom_discount_percentage:
            dto.custom_discount_percentage !== undefined
              ? dto.custom_discount_percentage !== null
                ? new Decimal(dto.custom_discount_percentage)
                : null
              : null,
          custom_discount_amount:
            dto.custom_discount_amount !== undefined
              ? dto.custom_discount_amount !== null
                ? new Decimal(dto.custom_discount_amount)
                : null
              : null,
          order_index: orderIndex,
        },
        include: {
          unit_measurement: true,
          quote_group: true,
        },
      });

      // Update quote totals using pricing service
      await this.pricingService.updateQuoteFinancials(quoteId, tx);

      // Create version (+0.1)
      await this.versionService.createVersion(
        quoteId,
        0.1,
        `Item added: ${dto.title}`,
        userId,
        tx,
      );

      // Save to library if requested
      if (dto.save_to_library) {
        await tx.item_library.create({
          data: {
            id: uuid(),
            tenant_id: tenantId,
            title: dto.title,
            description: dto.description || null,
            unit_measurement_id: dto.unit_measurement_id,
            default_quantity: new Decimal(dto.quantity),
            material_cost_per_unit: new Decimal(dto.material_cost_per_unit),
            labor_cost_per_unit: new Decimal(dto.labor_cost_per_unit),
            equipment_cost_per_unit: new Decimal(
              dto.equipment_cost_per_unit || 0,
            ),
            subcontract_cost_per_unit: new Decimal(
              dto.subcontract_cost_per_unit || 0,
            ),
            other_cost_per_unit: new Decimal(dto.other_cost_per_unit || 0),
            usage_count: 0,
          },
        });

        this.logger.log(`Item saved to library: ${dto.title}`);
      }

      // Log audit trail
      await this.auditLogger.logTenantChange({
        action: 'created',
        entityType: 'quote_item',
        entityId: item.id,
        tenantId,
        actorUserId: userId,
        before: {} as any,
        after: item,
        description: `Quote item added: ${dto.title} to quote ${quote.quote_number}`,
      });

      this.logger.log(`Quote item created: ${item.id} for quote: ${quoteId}`);

      return {
        ...item,
        quantity: Number(item.quantity),
        material_cost_per_unit: Number(item.material_cost_per_unit),
        labor_cost_per_unit: Number(item.labor_cost_per_unit),
        equipment_cost_per_unit: Number(item.equipment_cost_per_unit),
        subcontract_cost_per_unit: Number(item.subcontract_cost_per_unit),
        other_cost_per_unit: Number(item.other_cost_per_unit),
        total_cost: Number(item.total_cost),
      };
    });
  }

  /**
   * Create quote item from library item
   * Fetches library item, creates quote_item with library data
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param userId - User UUID
   * @param libraryItemId - Library item UUID
   * @returns Created item with relationships
   */
  async createFromLibrary(
    tenantId: string,
    quoteId: string,
    userId: string,
    libraryItemId: string,
  ): Promise<any> {
    // Fetch library item
    const libraryItem = await this.prisma.item_library.findFirst({
      where: {
        id: libraryItemId,
        tenant_id: tenantId,
        is_active: true,
      },
    });

    if (!libraryItem) {
      throw new NotFoundException('Library item not found or inactive');
    }

    // Create quote item from library data
    const createdItem = await this.create(tenantId, quoteId, userId, {
      title: libraryItem.title,
      description: libraryItem.description || undefined,
      quantity: Number(libraryItem.default_quantity),
      unit_measurement_id: libraryItem.unit_measurement_id,
      material_cost_per_unit: Number(libraryItem.material_cost_per_unit),
      labor_cost_per_unit: Number(libraryItem.labor_cost_per_unit),
      equipment_cost_per_unit: Number(libraryItem.equipment_cost_per_unit),
      subcontract_cost_per_unit: Number(libraryItem.subcontract_cost_per_unit),
      other_cost_per_unit: Number(libraryItem.other_cost_per_unit),
    });

    // Update library item usage tracking
    await this.prisma.item_library.update({
      where: { id: libraryItemId },
      data: {
        usage_count: { increment: 1 },
        last_used_at: new Date(),
      },
    });

    this.logger.log(
      `Quote item created from library: ${libraryItemId} → ${createdItem.id}`,
    );

    return createdItem;
  }

  /**
   * List items for quote
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param includeGrouped - Include items that belong to groups (default: true)
   * @returns Array of quote items
   */
  async findAll(
    tenantId: string,
    quoteId: string,
    includeGrouped: boolean = true,
  ): Promise<any[]> {
    // Validate quote exists
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    const where: any = { quote_id: quoteId };

    if (!includeGrouped) {
      where.quote_group_id = null;
    }

    const items = await this.prisma.quote_item.findMany({
      where,
      include: {
        unit_measurement: true,
        quote_group: true,
      },
      orderBy: { order_index: 'asc' },
    });

    return items.map((item) => ({
      ...item,
      quantity: Number(item.quantity),
      material_cost_per_unit: Number(item.material_cost_per_unit),
      labor_cost_per_unit: Number(item.labor_cost_per_unit),
      equipment_cost_per_unit: Number(item.equipment_cost_per_unit),
      subcontract_cost_per_unit: Number(item.subcontract_cost_per_unit),
      other_cost_per_unit: Number(item.other_cost_per_unit),
      total_cost: Number(item.total_cost),
    }));
  }

  /**
   * Get single item with relationships
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param itemId - Item UUID
   * @returns Quote item with relationships
   */
  async findOne(
    tenantId: string,
    quoteId: string,
    itemId: string,
  ): Promise<any> {
    // Validate quote exists
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    const item = await this.prisma.quote_item.findFirst({
      where: {
        id: itemId,
        quote_id: quoteId,
      },
      include: {
        unit_measurement: true,
        quote_group: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Quote item not found');
    }

    return {
      ...item,
      quantity: Number(item.quantity),
      material_cost_per_unit: Number(item.material_cost_per_unit),
      labor_cost_per_unit: Number(item.labor_cost_per_unit),
      equipment_cost_per_unit: Number(item.equipment_cost_per_unit),
      subcontract_cost_per_unit: Number(item.subcontract_cost_per_unit),
      other_cost_per_unit: Number(item.other_cost_per_unit),
      total_cost: Number(item.total_cost),
    };
  }

  /**
   * Update quote item
   * Creates quote version (+0.1)
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param itemId - Item UUID
   * @param userId - User UUID
   * @param dto - Update item DTO
   * @returns Updated item
   */
  async update(
    tenantId: string,
    quoteId: string,
    itemId: string,
    userId: string,
    dto: UpdateItemDto,
  ): Promise<any> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.status === 'approved') {
      throw new BadRequestException('Cannot edit items in approved quote');
    }

    const item = await this.findOne(tenantId, quoteId, itemId);

    return await this.prisma.$transaction(async (tx) => {
      // Validate unit measurement if provided
      if (dto.unit_measurement_id) {
        const unit = await tx.unit_measurement.findFirst({
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
      if (dto.description !== undefined)
        updateData.description = dto.description;
      if (dto.quantity) {
        updateData.quantity = new Decimal(dto.quantity);
      }
      if (dto.unit_measurement_id)
        updateData.unit_measurement_id = dto.unit_measurement_id;
      if (dto.material_cost_per_unit !== undefined)
        updateData.material_cost_per_unit = new Decimal(
          dto.material_cost_per_unit,
        );
      if (dto.labor_cost_per_unit !== undefined)
        updateData.labor_cost_per_unit = new Decimal(dto.labor_cost_per_unit);
      if (dto.equipment_cost_per_unit !== undefined)
        updateData.equipment_cost_per_unit = new Decimal(
          dto.equipment_cost_per_unit,
        );
      if (dto.subcontract_cost_per_unit !== undefined)
        updateData.subcontract_cost_per_unit = new Decimal(
          dto.subcontract_cost_per_unit,
        );
      if (dto.other_cost_per_unit !== undefined)
        updateData.other_cost_per_unit = new Decimal(dto.other_cost_per_unit);
      if (dto.quote_group_id !== undefined) {
        // Validate group exists if provided and belongs to this quote
        if (dto.quote_group_id) {
          const group = await tx.quote_group.findFirst({
            where: {
              id: dto.quote_group_id,
              quote_id: quoteId,
            },
          });
          if (!group) {
            throw new NotFoundException('Quote group not found');
          }
        }
        updateData.quote_group_id = dto.quote_group_id;
      }

      // Handle custom margin fields (null means 0%, not "use default")
      if (dto.custom_profit_percent !== undefined)
        updateData.custom_profit_percent =
          dto.custom_profit_percent !== null
            ? new Decimal(dto.custom_profit_percent)
            : null;
      if (dto.custom_overhead_percent !== undefined)
        updateData.custom_overhead_percent =
          dto.custom_overhead_percent !== null
            ? new Decimal(dto.custom_overhead_percent)
            : null;
      if (dto.custom_contingency_percent !== undefined)
        updateData.custom_contingency_percent =
          dto.custom_contingency_percent !== null
            ? new Decimal(dto.custom_contingency_percent)
            : null;
      if (dto.custom_discount_percentage !== undefined)
        updateData.custom_discount_percentage =
          dto.custom_discount_percentage !== null
            ? new Decimal(dto.custom_discount_percentage)
            : null;
      if (dto.custom_discount_amount !== undefined)
        updateData.custom_discount_amount =
          dto.custom_discount_amount !== null
            ? new Decimal(dto.custom_discount_amount)
            : null;

      // Recalculate total_cost
      const quantity = dto.quantity || Number(item.quantity);
      const material =
        dto.material_cost_per_unit ?? Number(item.material_cost_per_unit);
      const labor = dto.labor_cost_per_unit ?? Number(item.labor_cost_per_unit);
      const equipment =
        dto.equipment_cost_per_unit ?? Number(item.equipment_cost_per_unit);
      const subcontract =
        dto.subcontract_cost_per_unit ?? Number(item.subcontract_cost_per_unit);
      const other = dto.other_cost_per_unit ?? Number(item.other_cost_per_unit);

      const totalCostPerUnit =
        material + labor + equipment + subcontract + other;

      // Validate at least one cost > 0
      if (totalCostPerUnit <= 0) {
        throw new BadRequestException(
          'At least one cost field must be greater than 0',
        );
      }

      updateData.total_cost = new Decimal(totalCostPerUnit * quantity);

      // Update item
      const updatedItem = await tx.quote_item.update({
        where: { id: itemId },
        data: updateData,
        include: {
          unit_measurement: true,
          quote_group: true,
        },
      });

      // Update quote totals using pricing service
      await this.pricingService.updateQuoteFinancials(quoteId, tx);

      // Create version (+0.1)
      await this.versionService.createVersion(
        quoteId,
        0.1,
        `Item updated: ${updatedItem.title}`,
        userId,
        tx,
      );

      // Log audit trail
      await this.auditLogger.logTenantChange({
        action: 'updated',
        entityType: 'quote_item',
        entityId: itemId,
        tenantId,
        actorUserId: userId,
        before: item,
        after: updatedItem,
        description: `Quote item updated: ${updatedItem.title}`,
      });

      this.logger.log(`Quote item updated: ${itemId}`);

      return {
        ...updatedItem,
        quantity: Number(updatedItem.quantity),
        material_cost_per_unit: Number(updatedItem.material_cost_per_unit),
        labor_cost_per_unit: Number(updatedItem.labor_cost_per_unit),
        equipment_cost_per_unit: Number(updatedItem.equipment_cost_per_unit),
        subcontract_cost_per_unit: Number(
          updatedItem.subcontract_cost_per_unit,
        ),
        other_cost_per_unit: Number(updatedItem.other_cost_per_unit),
        total_cost: Number(updatedItem.total_cost),
      };
    });
  }

  /**
   * Delete quote item (hard delete)
   * Updates quote version, reorders remaining items
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param itemId - Item UUID
   * @param userId - User UUID
   */
  async delete(
    tenantId: string,
    quoteId: string,
    itemId: string,
    userId: string,
  ): Promise<void> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.status === 'approved') {
      throw new BadRequestException('Cannot delete items from approved quote');
    }

    const item = await this.findOne(tenantId, quoteId, itemId);

    await this.prisma.$transaction(async (tx) => {
      // Delete item
      await tx.quote_item.delete({
        where: { id: itemId },
      });

      // Reorder remaining items
      const remainingItems = await tx.quote_item.findMany({
        where: { quote_id: quoteId },
        orderBy: { order_index: 'asc' },
      });

      for (let i = 0; i < remainingItems.length; i++) {
        await tx.quote_item.update({
          where: { id: remainingItems[i].id },
          data: { order_index: i + 1 },
        });
      }

      // Update quote totals using pricing service
      await this.pricingService.updateQuoteFinancials(quoteId, tx);

      // Create version (+0.1)
      await this.versionService.createVersion(
        quoteId,
        0.1,
        `Item deleted: ${item.name}`,
        userId,
        tx,
      );

      // Log audit trail
      await this.auditLogger.logTenantChange({
        action: 'deleted',
        entityType: 'quote_item',
        entityId: itemId,
        tenantId,
        actorUserId: userId,
        before: item,
        after: {} as any,
        description: `Quote item deleted: ${item.title}`,
      });

      this.logger.log(`Quote item deleted: ${itemId}`);
    });
  }

  /**
   * Duplicate quote item
   * Clones item with " (Copy)" suffix, inserts after original
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param itemId - Item UUID
   * @param userId - User UUID
   * @returns Duplicated item
   */
  async duplicate(
    tenantId: string,
    quoteId: string,
    itemId: string,
    userId: string,
  ): Promise<any> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.status === 'approved') {
      throw new BadRequestException('Cannot duplicate items in approved quote');
    }

    const sourceItem = await this.findOne(tenantId, quoteId, itemId);

    return await this.prisma.$transaction(async (tx) => {
      // Increment order_index of items below
      await tx.quote_item.updateMany({
        where: {
          quote_id: quoteId,
          order_index: { gt: sourceItem.order_index },
        },
        data: {
          order_index: { increment: 1 },
        },
      });

      // Create duplicate
      const duplicatedItem = await tx.quote_item.create({
        data: {
          id: uuid(),
          quote_id: quoteId,
          quote_group_id: sourceItem.quote_group_id,
          title: `${sourceItem.title} (Copy)`,
          description: sourceItem.description,
          quantity: new Decimal(sourceItem.quantity),
          unit_measurement_id: sourceItem.unit_measurement_id,
          material_cost_per_unit: new Decimal(
            sourceItem.material_cost_per_unit,
          ),
          labor_cost_per_unit: new Decimal(sourceItem.labor_cost_per_unit),
          equipment_cost_per_unit: new Decimal(
            sourceItem.equipment_cost_per_unit,
          ),
          subcontract_cost_per_unit: new Decimal(
            sourceItem.subcontract_cost_per_unit,
          ),
          other_cost_per_unit: new Decimal(sourceItem.other_cost_per_unit),
          total_cost: new Decimal(sourceItem.total_cost),
          order_index: sourceItem.order_index + 1,
        },
        include: {
          unit_measurement: true,
          quote_group: true,
        },
      });

      // Update quote totals using pricing service
      await this.pricingService.updateQuoteFinancials(quoteId, tx);

      // Create version (+0.1)
      await this.versionService.createVersion(
        quoteId,
        0.1,
        `Item duplicated: ${sourceItem.name}`,
        userId,
        tx,
      );

      // Log audit trail
      await this.auditLogger.logTenantChange({
        action: 'created',
        entityType: 'quote_item',
        entityId: duplicatedItem.id,
        tenantId,
        actorUserId: userId,
        before: {} as any,
        after: duplicatedItem,
        description: `Quote item duplicated: ${sourceItem.title}`,
      });

      this.logger.log(
        `Quote item duplicated: ${itemId} → ${duplicatedItem.id}`,
      );

      return {
        ...duplicatedItem,
        quantity: Number(duplicatedItem.quantity),
        material_cost_per_unit: Number(duplicatedItem.material_cost_per_unit),
        labor_cost_per_unit: Number(duplicatedItem.labor_cost_per_unit),
        equipment_cost_per_unit: Number(duplicatedItem.equipment_cost_per_unit),
        subcontract_cost_per_unit: Number(
          duplicatedItem.subcontract_cost_per_unit,
        ),
        other_cost_per_unit: Number(duplicatedItem.other_cost_per_unit),
        total_cost: Number(duplicatedItem.total_cost),
      };
    });
  }

  /**
   * Reorder items (no version created - cosmetic only)
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param dto - Reorder items DTO
   */
  async reorder(
    tenantId: string,
    quoteId: string,
    dto: ReorderItemsDto,
  ): Promise<void> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const itemOrder of dto.items) {
        await tx.quote_item.updateMany({
          where: {
            id: itemOrder.item_id,
            quote_id: quoteId,
          },
          data: {
            order_index: itemOrder.order_index,
          },
        });
      }
    });

    this.logger.log(`Quote items reordered for quote: ${quoteId}`);
  }

  /**
   * Move item to different group (or ungrouped)
   * Updates quote version
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param itemId - Item UUID
   * @param userId - User UUID
   * @param dto - Move item to group DTO
   * @returns Updated item
   */
  async moveToGroup(
    tenantId: string,
    quoteId: string,
    itemId: string,
    userId: string,
    dto: MoveItemToGroupDto,
  ): Promise<any> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.status === 'approved') {
      throw new BadRequestException('Cannot move items in approved quote');
    }

    const item = await this.findOne(tenantId, quoteId, itemId);

    return await this.prisma.$transaction(async (tx) => {
      // Validate target group if provided
      if (dto.quote_group_id) {
        const group = await tx.quote_group.findFirst({
          where: {
            id: dto.quote_group_id,
            quote_id: quoteId,
          },
        });

        if (!group) {
          throw new NotFoundException('Target quote group not found');
        }
      }

      // Update item
      const updatedItem = await tx.quote_item.update({
        where: { id: itemId },
        data: {
          quote_group_id: dto.quote_group_id,
        },
        include: {
          unit_measurement: true,
          quote_group: true,
        },
      });

      // Create version (+0.1)
      const groupName = dto.quote_group_id ? 'group' : 'ungrouped';
      await this.versionService.createVersion(
        quoteId,
        0.1,
        `Item moved to ${groupName}: ${item.name}`,
        userId,
        tx,
      );

      // Log audit trail
      await this.auditLogger.logTenantChange({
        action: 'updated',
        entityType: 'quote_item',
        entityId: itemId,
        tenantId,
        actorUserId: userId,
        before: item,
        after: updatedItem,
        description: `Quote item moved to ${groupName}: ${item.name}`,
      });

      this.logger.log(`Quote item moved to group: ${itemId}`);

      return {
        ...updatedItem,
        quantity: Number(updatedItem.quantity),
        material_cost_per_unit: Number(updatedItem.material_cost_per_unit),
        labor_cost_per_unit: Number(updatedItem.labor_cost_per_unit),
        equipment_cost_per_unit: Number(updatedItem.equipment_cost_per_unit),
        subcontract_cost_per_unit: Number(
          updatedItem.subcontract_cost_per_unit,
        ),
        other_cost_per_unit: Number(updatedItem.other_cost_per_unit),
        total_cost: Number(updatedItem.total_cost),
      };
    });
  }

  /**
   * Save quote item to library for future reuse
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param itemId - Item UUID
   * @param userId - User UUID
   * @returns Created library item
   */
  async saveToLibrary(
    tenantId: string,
    quoteId: string,
    itemId: string,
    userId: string,
  ): Promise<any> {
    const item = await this.findOne(tenantId, quoteId, itemId);

    const libraryItem = await this.prisma.item_library.create({
      data: {
        id: uuid(),
        tenant_id: tenantId,
        title: item.name,
        description: item.description,
        unit_measurement_id: item.unit_measurement_id,
        default_quantity: new Decimal(item.quantity),
        material_cost_per_unit: new Decimal(item.material_cost_per_unit),
        labor_cost_per_unit: new Decimal(item.labor_cost_per_unit),
        equipment_cost_per_unit: new Decimal(item.equipment_cost_per_unit),
        subcontract_cost_per_unit: new Decimal(item.subcontract_cost_per_unit),
        other_cost_per_unit: new Decimal(item.other_cost_per_unit),
        usage_count: 0,
      },
    });

    this.logger.log(
      `Quote item saved to library: ${itemId} → ${libraryItem.id}`,
    );

    return libraryItem;
  }
}
