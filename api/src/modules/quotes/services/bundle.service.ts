import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  CreateBundleDto,
  UpdateBundleDto,
  UpdateBundleItemDto,
  BundleItemDto,
  ListBundlesDto,
  DiscountType,
} from '../dto/bundle';
import { randomBytes } from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class BundleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    return randomBytes(16)
      .toString('hex')
      .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
  }

  /**
   * Validate discount logic
   */
  private validateDiscount(discountType?: DiscountType, discountValue?: number) {
    if (discountType && !discountValue) {
      throw new BadRequestException('Discount value is required when discount type is set');
    }
    if (!discountType && discountValue) {
      throw new BadRequestException('Discount type is required when discount value is set');
    }
    if (discountType === DiscountType.PERCENTAGE && discountValue) {
      if (discountValue < 0 || discountValue > 100) {
        throw new BadRequestException('Percentage discount must be between 0 and 100');
      }
    }
    if (discountType === DiscountType.FIXED_AMOUNT && discountValue && discountValue < 0) {
      throw new BadRequestException('Fixed amount discount cannot be negative');
    }
  }

  /**
   * Create bundle with items (transaction)
   */
  async create(tenantId: string, userId: string, dto: CreateBundleDto) {
    // Validate discount
    this.validateDiscount(dto.discount_type, dto.discount_value);

    // Validate at least one item
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Bundle must have at least one item');
    }

    // Validate all unit measurements exist
    const unitIds = dto.items.map((item) => item.unit_measurement_id);
    const units = await this.prisma.unit_measurement.findMany({
      where: {
        id: { in: unitIds },
        OR: [{ tenant_id: null }, { tenant_id: tenantId }],
        is_active: true,
      },
    });

    if (units.length !== new Set(unitIds).size) {
      throw new BadRequestException('One or more unit measurements not found or inactive');
    }

    // Create bundle and items in transaction
    const bundleId = this.generateUUID();
    const bundle = await this.prisma.$transaction(async (tx) => {
      // Create bundle
      const createdBundle = await tx.quote_bundle.create({
        data: {
          id: bundleId,
          tenant_id: tenantId,
          name: dto.name,
          description: dto.description,
          discount_type: dto.discount_type,
          discount_value: dto.discount_value
            ? new Decimal(dto.discount_value)
            : null,
          created_by_user_id: userId,
        },
      });

      // Create bundle items
      const itemsData = dto.items.map((item, index) => ({
        id: this.generateUUID(),
        quote_bundle_id: bundleId,
        item_library_id: item.item_library_id || null,
        title: item.title,
        description: item.description || null,
        quantity: new Decimal(item.quantity),
        unit_measurement_id: item.unit_measurement_id,
        material_cost_per_unit: new Decimal(item.material_cost_per_unit),
        labor_cost_per_unit: new Decimal(item.labor_cost_per_unit),
        equipment_cost_per_unit: new Decimal(item.equipment_cost_per_unit),
        subcontract_cost_per_unit: new Decimal(item.subcontract_cost_per_unit),
        other_cost_per_unit: new Decimal(item.other_cost_per_unit),
        order_index: item.order_index !== undefined ? item.order_index : index,
      }));

      await tx.quote_bundle_item.createMany({
        data: itemsData,
      });

      return createdBundle;
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'quote_bundle',
      entityId: bundle.id,
      tenantId,
      actorUserId: userId,
      after: bundle,
      description: `Bundle created: ${bundle.name} with ${dto.items.length} items`,
    });

    // Fetch complete bundle with items
    return this.findOne(tenantId, bundleId);
  }

  /**
   * List all bundles with item count
   */
  async findAll(tenantId: string, filters: ListBundlesDto) {
    const { is_active, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      tenant_id: tenantId,
    };

    if (is_active !== undefined) {
      where.is_active = is_active;
    }

    const [bundles, total] = await Promise.all([
      this.prisma.quote_bundle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { items: true },
          },
        },
      }),
      this.prisma.quote_bundle.count({ where }),
    ]);

    return {
      data: bundles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get bundle with all items
   */
  async findOne(tenantId: string, bundleId: string) {
    const bundle = await this.prisma.quote_bundle.findFirst({
      where: { id: bundleId, tenant_id: tenantId },
      include: {
        items: {
          orderBy: { order_index: 'asc' },
          include: {
            unit_measurement: {
              select: {
                id: true,
                name: true,
                abbreviation: true,
              },
            },
          },
        },
      },
    });

    if (!bundle) {
      throw new NotFoundException('Bundle not found');
    }

    return bundle;
  }

  /**
   * Update bundle metadata (not items)
   */
  async update(
    tenantId: string,
    bundleId: string,
    userId: string,
    dto: UpdateBundleDto,
  ) {
    // Verify bundle exists
    const bundle = await this.findOne(tenantId, bundleId);

    // Validate discount if being updated
    if (dto.discount_type !== undefined || dto.discount_value !== undefined) {
      const newDiscountType = dto.discount_type ?? bundle.discount_type;
      const newDiscountValue = dto.discount_value ?? Number(bundle.discount_value);
      this.validateDiscount(
        newDiscountType as DiscountType,
        newDiscountValue,
      );
    }

    const updatedBundle = await this.prisma.quote_bundle.update({
      where: { id: bundleId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.discount_type !== undefined && { discount_type: dto.discount_type }),
        ...(dto.discount_value !== undefined && {
          discount_value: dto.discount_value ? new Decimal(dto.discount_value) : null,
        }),
      },
      include: {
        items: {
          orderBy: { order_index: 'asc' },
          include: {
            unit_measurement: {
              select: {
                id: true,
                name: true,
                abbreviation: true,
              },
            },
          },
        },
      },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'quote_bundle',
      entityId: bundleId,
      tenantId,
      actorUserId: userId,
      before: bundle,
      after: updatedBundle,
      description: `Bundle updated: ${updatedBundle.name}`,
    });

    return updatedBundle;
  }

  /**
   * Delete bundle and cascade items
   */
  async delete(tenantId: string, bundleId: string, userId: string) {
    // Verify bundle exists
    const bundle = await this.findOne(tenantId, bundleId);

    // Delete bundle (items cascade automatically via schema)
    await this.prisma.quote_bundle.delete({
      where: { id: bundleId },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'quote_bundle',
      entityId: bundleId,
      tenantId,
      actorUserId: userId,
      before: bundle,
      description: `Bundle deleted: ${bundle.name}`,
    });

    return { message: 'Bundle deleted successfully' };
  }

  /**
   * Add item to bundle
   */
  async addItem(
    tenantId: string,
    bundleId: string,
    userId: string,
    dto: BundleItemDto,
  ) {
    // Verify bundle exists
    const bundle = await this.findOne(tenantId, bundleId);

    // Validate unit measurement
    const unit = await this.prisma.unit_measurement.findFirst({
      where: {
        id: dto.unit_measurement_id,
        OR: [{ tenant_id: null }, { tenant_id: tenantId }],
        is_active: true,
      },
    });

    if (!unit) {
      throw new BadRequestException('Unit measurement not found or inactive');
    }

    // Get max order_index
    const maxOrderIndex = await this.prisma.quote_bundle_item.findFirst({
      where: { quote_bundle_id: bundleId },
      orderBy: { order_index: 'desc' },
      select: { order_index: true },
    });

    const newOrderIndex = maxOrderIndex ? maxOrderIndex.order_index + 1 : 0;

    // Create item
    const itemId = this.generateUUID();
    const item = await this.prisma.quote_bundle_item.create({
      data: {
        id: itemId,
        quote_bundle_id: bundleId,
        item_library_id: dto.item_library_id || null,
        title: dto.title,
        description: dto.description || null,
        quantity: new Decimal(dto.quantity),
        unit_measurement_id: dto.unit_measurement_id,
        material_cost_per_unit: new Decimal(dto.material_cost_per_unit),
        labor_cost_per_unit: new Decimal(dto.labor_cost_per_unit),
        equipment_cost_per_unit: new Decimal(dto.equipment_cost_per_unit),
        subcontract_cost_per_unit: new Decimal(dto.subcontract_cost_per_unit),
        other_cost_per_unit: new Decimal(dto.other_cost_per_unit),
        order_index: dto.order_index !== undefined ? dto.order_index : newOrderIndex,
      },
      include: {
        unit_measurement: {
          select: {
            id: true,
            name: true,
            abbreviation: true,
          },
        },
      },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'quote_bundle_item',
      entityId: item.id,
      tenantId,
      actorUserId: userId,
      after: item,
      description: `Item added to bundle ${bundle.name}: ${item.title}`,
    });

    return item;
  }

  /**
   * Update bundle item
   */
  async updateItem(
    tenantId: string,
    bundleId: string,
    itemId: string,
    userId: string,
    dto: UpdateBundleItemDto,
  ) {
    // Verify bundle exists
    await this.findOne(tenantId, bundleId);

    // Verify item exists and belongs to bundle
    const item = await this.prisma.quote_bundle_item.findFirst({
      where: {
        id: itemId,
        quote_bundle_id: bundleId,
      },
    });

    if (!item) {
      throw new NotFoundException('Bundle item not found');
    }

    // Validate unit measurement if being changed
    if (dto.unit_measurement_id) {
      const unit = await this.prisma.unit_measurement.findFirst({
        where: {
          id: dto.unit_measurement_id,
          OR: [{ tenant_id: null }, { tenant_id: tenantId }],
          is_active: true,
        },
      });

      if (!unit) {
        throw new BadRequestException('Unit measurement not found or inactive');
      }
    }

    // Update item
    const updatedItem = await this.prisma.quote_bundle_item.update({
      where: { id: itemId },
      data: {
        ...(dto.item_library_id !== undefined && { item_library_id: dto.item_library_id }),
        ...(dto.title && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.quantity && { quantity: new Decimal(dto.quantity) }),
        ...(dto.unit_measurement_id && { unit_measurement_id: dto.unit_measurement_id }),
        ...(dto.material_cost_per_unit !== undefined && {
          material_cost_per_unit: new Decimal(dto.material_cost_per_unit),
        }),
        ...(dto.labor_cost_per_unit !== undefined && {
          labor_cost_per_unit: new Decimal(dto.labor_cost_per_unit),
        }),
        ...(dto.equipment_cost_per_unit !== undefined && {
          equipment_cost_per_unit: new Decimal(dto.equipment_cost_per_unit),
        }),
        ...(dto.subcontract_cost_per_unit !== undefined && {
          subcontract_cost_per_unit: new Decimal(dto.subcontract_cost_per_unit),
        }),
        ...(dto.other_cost_per_unit !== undefined && {
          other_cost_per_unit: new Decimal(dto.other_cost_per_unit),
        }),
        ...(dto.order_index !== undefined && { order_index: dto.order_index }),
      },
      include: {
        unit_measurement: {
          select: {
            id: true,
            name: true,
            abbreviation: true,
          },
        },
      },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'quote_bundle_item',
      entityId: itemId,
      tenantId,
      actorUserId: userId,
      before: item,
      after: updatedItem,
      description: `Bundle item updated: ${updatedItem.title}`,
    });

    return updatedItem;
  }

  /**
   * Delete bundle item (ensure minimum 1 item remains)
   */
  async deleteItem(
    tenantId: string,
    bundleId: string,
    itemId: string,
    userId: string,
  ) {
    // Verify bundle exists
    const bundle = await this.findOne(tenantId, bundleId);

    // Check if this is the last item
    const itemCount = await this.prisma.quote_bundle_item.count({
      where: { quote_bundle_id: bundleId },
    });

    if (itemCount <= 1) {
      throw new BadRequestException('Cannot delete last item. Bundle must have at least one item');
    }

    // Verify item exists and belongs to bundle
    const item = await this.prisma.quote_bundle_item.findFirst({
      where: {
        id: itemId,
        quote_bundle_id: bundleId,
      },
    });

    if (!item) {
      throw new NotFoundException('Bundle item not found');
    }

    // Delete item
    await this.prisma.quote_bundle_item.delete({
      where: { id: itemId },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'quote_bundle_item',
      entityId: itemId,
      tenantId,
      actorUserId: userId,
      before: item,
      description: `Item deleted from bundle ${bundle.name}: ${item.title}`,
    });

    return { message: 'Bundle item deleted successfully' };
  }
}
