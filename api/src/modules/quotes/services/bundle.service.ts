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
  UpdateBundleWithItemsDto,
  UpdateBundleItemDto,
  BundleItemDto,
  ListBundlesDto,
  DiscountType,
} from '../dto/bundle';
import { randomUUID } from 'crypto';
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
    return randomUUID();
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
   * Calculate total cost for a bundle including all items and discount
   */
  private calculateBundleTotalCost(bundle: any): number {
    if (!bundle.items || bundle.items.length === 0) {
      return 0;
    }

    // Sum up all item costs: quantity × (material + labor + equipment + subcontract + other)
    const subtotal = bundle.items.reduce((sum: number, item: any) => {
      const quantity = Number(item.quantity);
      const materialCost = Number(item.material_cost_per_unit);
      const laborCost = Number(item.labor_cost_per_unit);
      const equipmentCost = Number(item.equipment_cost_per_unit);
      const subcontractCost = Number(item.subcontract_cost_per_unit);
      const otherCost = Number(item.other_cost_per_unit);

      const totalCostPerUnit = materialCost + laborCost + equipmentCost + subcontractCost + otherCost;
      const itemTotal = quantity * totalCostPerUnit;

      return sum + itemTotal;
    }, 0);

    // Apply discount if present
    let total = subtotal;
    if (bundle.discount_type && bundle.discount_value) {
      const discountValue = Number(bundle.discount_value);
      if (bundle.discount_type === 'percentage') {
        total = subtotal * (1 - discountValue / 100);
      } else if (bundle.discount_type === 'fixed_amount') {
        total = subtotal - discountValue;
        // Ensure total doesn't go negative
        total = Math.max(0, total);
      }
    }

    return total;
  }

  /**
   * Create bundle with items (transaction)
   * Supports creating items from library by passing library_item_id
   */
  async create(tenantId: string, userId: string, dto: CreateBundleDto) {
    // Validate discount
    this.validateDiscount(dto.discount_type, dto.discount_value);

    // Validate at least one item
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Bundle must have at least one item');
    }

    // Populate items from library if library_item_id is provided
    const populatedItems = await Promise.all(
      dto.items.map(async (item, index) => {
        if (item.library_item_id) {
          // Fetch library item and auto-populate fields
          const libraryItem = await this.prisma.item_library.findFirst({
            where: {
              id: item.library_item_id,
              tenant_id: tenantId,
              is_active: true,
            },
          });

          if (!libraryItem) {
            throw new NotFoundException(
              `Library item ${item.library_item_id} not found or inactive`,
            );
          }

          // Use library item data, allow overrides from dto
          return {
            library_item_id: item.library_item_id,
            title: item.title || libraryItem.title,
            description: item.description || libraryItem.description,
            quantity: item.quantity,
            unit_measurement_id: item.unit_measurement_id || libraryItem.unit_measurement_id,
            material_cost_per_unit: item.material_cost_per_unit !== undefined
              ? item.material_cost_per_unit
              : Number(libraryItem.material_cost_per_unit),
            labor_cost_per_unit: item.labor_cost_per_unit !== undefined
              ? item.labor_cost_per_unit
              : Number(libraryItem.labor_cost_per_unit),
            equipment_cost_per_unit: item.equipment_cost_per_unit !== undefined
              ? item.equipment_cost_per_unit
              : Number(libraryItem.equipment_cost_per_unit),
            subcontract_cost_per_unit: item.subcontract_cost_per_unit !== undefined
              ? item.subcontract_cost_per_unit
              : Number(libraryItem.subcontract_cost_per_unit),
            other_cost_per_unit: item.other_cost_per_unit !== undefined
              ? item.other_cost_per_unit
              : Number(libraryItem.other_cost_per_unit),
            order_index: item.order_index !== undefined ? item.order_index : index,
          };
        } else {
          // Validate all required fields are present when not using library_item_id
          if (!item.title || !item.unit_measurement_id ||
              item.material_cost_per_unit === undefined ||
              item.labor_cost_per_unit === undefined) {
            throw new BadRequestException(
              'When library_item_id is not provided, title, unit_measurement_id, material_cost_per_unit, and labor_cost_per_unit are required',
            );
          }

          return {
            library_item_id: null,
            title: item.title,
            description: item.description || null,
            quantity: item.quantity,
            unit_measurement_id: item.unit_measurement_id,
            material_cost_per_unit: item.material_cost_per_unit,
            labor_cost_per_unit: item.labor_cost_per_unit,
            equipment_cost_per_unit: item.equipment_cost_per_unit || 0,
            subcontract_cost_per_unit: item.subcontract_cost_per_unit || 0,
            other_cost_per_unit: item.other_cost_per_unit || 0,
            order_index: item.order_index !== undefined ? item.order_index : index,
          };
        }
      }),
    );

    // Validate all unit measurements exist
    const unitIds = populatedItems.map((item) => item.unit_measurement_id);
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

      // Create bundle items with populated data
      const itemsData = populatedItems.map((item) => ({
        id: this.generateUUID(),
        quote_bundle_id: bundleId,
        item_library_id: item.library_item_id,
        title: item.title!,
        description: item.description,
        quantity: new Decimal(item.quantity),
        unit_measurement_id: item.unit_measurement_id!,
        material_cost_per_unit: new Decimal(item.material_cost_per_unit!),
        labor_cost_per_unit: new Decimal(item.labor_cost_per_unit!),
        equipment_cost_per_unit: new Decimal(item.equipment_cost_per_unit!),
        subcontract_cost_per_unit: new Decimal(item.subcontract_cost_per_unit!),
        other_cost_per_unit: new Decimal(item.other_cost_per_unit!),
        order_index: item.order_index!,
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
   * List all bundles with item count and total cost
   */
  async findAll(tenantId: string, filters: ListBundlesDto) {
    const { is_active, page = 1, limit = 50, sort_by = 'name', sort_order = 'asc' } = filters;
    const skip = (page - 1) * limit;

    const where: any = {
      tenant_id: tenantId,
    };

    if (is_active !== undefined) {
      where.is_active = is_active;
    }

    // Build orderBy dynamically
    const orderBy: any = {};
    orderBy[sort_by] = sort_order;

    const [bundles, total] = await Promise.all([
      this.prisma.quote_bundle.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          _count: {
            select: { items: true },
          },
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
      }),
      this.prisma.quote_bundle.count({ where }),
    ]);

    // Add total_cost to each bundle
    const bundlesWithTotalCost = bundles.map((bundle) => ({
      ...bundle,
      total_cost: this.calculateBundleTotalCost(bundle),
    }));

    return {
      data: bundlesWithTotalCost,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get bundle with all items and total cost
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

    return {
      ...bundle,
      total_cost: this.calculateBundleTotalCost(bundle),
    };
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

    return {
      ...updatedBundle,
      total_cost: this.calculateBundleTotalCost(updatedBundle),
    };
  }

  /**
   * Replace bundle completely (metadata + items)
   * Deletes all existing items and creates new ones
   * Used by PUT endpoint for full replacement
   */
  async replaceBundle(
    tenantId: string,
    bundleId: string,
    userId: string,
    dto: UpdateBundleWithItemsDto,
  ) {
    // Verify bundle exists
    const bundle = await this.findOne(tenantId, bundleId);

    // Validate discount if provided
    if (dto.discount_type !== undefined || dto.discount_value !== undefined) {
      const newDiscountType = dto.discount_type ?? bundle.discount_type;
      const newDiscountValue = dto.discount_value ?? (bundle.discount_value ? Number(bundle.discount_value) : undefined);
      this.validateDiscount(
        newDiscountType as DiscountType,
        newDiscountValue,
      );
    }

    // If items are provided, validate and populate from library
    let populatedItems: any[] = [];
    if (dto.items && dto.items.length > 0) {
      // Reuse the same population logic from create() method
      populatedItems = await Promise.all(
        dto.items.map(async (item, index) => {
          if (item.library_item_id) {
            // Fetch library item and auto-populate fields
            const libraryItem = await this.prisma.item_library.findFirst({
              where: {
                id: item.library_item_id,
                tenant_id: tenantId,
                is_active: true,
              },
            });

            if (!libraryItem) {
              throw new NotFoundException(
                `Library item ${item.library_item_id} not found or inactive`,
              );
            }

            return {
              library_item_id: item.library_item_id,
              title: item.title || libraryItem.title,
              description: item.description || libraryItem.description,
              quantity: item.quantity,
              unit_measurement_id: item.unit_measurement_id || libraryItem.unit_measurement_id,
              material_cost_per_unit: item.material_cost_per_unit !== undefined
                ? item.material_cost_per_unit
                : Number(libraryItem.material_cost_per_unit),
              labor_cost_per_unit: item.labor_cost_per_unit !== undefined
                ? item.labor_cost_per_unit
                : Number(libraryItem.labor_cost_per_unit),
              equipment_cost_per_unit: item.equipment_cost_per_unit !== undefined
                ? item.equipment_cost_per_unit
                : Number(libraryItem.equipment_cost_per_unit),
              subcontract_cost_per_unit: item.subcontract_cost_per_unit !== undefined
                ? item.subcontract_cost_per_unit
                : Number(libraryItem.subcontract_cost_per_unit),
              other_cost_per_unit: item.other_cost_per_unit !== undefined
                ? item.other_cost_per_unit
                : Number(libraryItem.other_cost_per_unit),
              order_index: item.order_index !== undefined ? item.order_index : index,
            };
          } else {
            // Validate all required fields when not using library_item_id
            if (!item.title || !item.unit_measurement_id ||
                item.material_cost_per_unit === undefined ||
                item.labor_cost_per_unit === undefined) {
              throw new BadRequestException(
                'When library_item_id is not provided, title, unit_measurement_id, material_cost_per_unit, and labor_cost_per_unit are required',
              );
            }

            return {
              library_item_id: null,
              title: item.title,
              description: item.description || null,
              quantity: item.quantity,
              unit_measurement_id: item.unit_measurement_id,
              material_cost_per_unit: item.material_cost_per_unit,
              labor_cost_per_unit: item.labor_cost_per_unit,
              equipment_cost_per_unit: item.equipment_cost_per_unit || 0,
              subcontract_cost_per_unit: item.subcontract_cost_per_unit || 0,
              other_cost_per_unit: item.other_cost_per_unit || 0,
              order_index: item.order_index !== undefined ? item.order_index : index,
            };
          }
        }),
      );

      // Validate all unit measurements exist
      const unitIds = populatedItems.map((item) => item.unit_measurement_id);
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
    }

    // Execute replacement in transaction
    return await this.prisma.$transaction(async (tx) => {
      // 1. Update bundle metadata
      const updatedBundle = await tx.quote_bundle.update({
        where: { id: bundleId },
        data: {
          ...(dto.name && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.discount_type !== undefined && { discount_type: dto.discount_type }),
          ...(dto.discount_value !== undefined && {
            discount_value: dto.discount_value ? new Decimal(dto.discount_value) : null,
          }),
        },
      });

      // 2. If items are provided, replace all items
      if (dto.items && dto.items.length > 0) {
        // Delete all existing items
        await tx.quote_bundle_item.deleteMany({
          where: { quote_bundle_id: bundleId },
        });

        // Create new items
        const itemsData = populatedItems.map((item) => ({
          id: this.generateUUID(),
          quote_bundle_id: bundleId,
          item_library_id: item.library_item_id,
          title: item.title!,
          description: item.description,
          quantity: new Decimal(item.quantity),
          unit_measurement_id: item.unit_measurement_id!,
          material_cost_per_unit: new Decimal(item.material_cost_per_unit!),
          labor_cost_per_unit: new Decimal(item.labor_cost_per_unit!),
          equipment_cost_per_unit: new Decimal(item.equipment_cost_per_unit!),
          subcontract_cost_per_unit: new Decimal(item.subcontract_cost_per_unit!),
          other_cost_per_unit: new Decimal(item.other_cost_per_unit!),
          order_index: item.order_index!,
        }));

        await tx.quote_bundle_item.createMany({
          data: itemsData,
        });
      }

      // 3. Audit log
      await this.auditLogger.logTenantChange({
        action: 'updated',
        entityType: 'quote_bundle',
        entityId: bundleId,
        tenantId,
        actorUserId: userId,
        before: bundle,
        after: updatedBundle,
        description: `Bundle replaced: ${updatedBundle.name}${dto.items ? ` with ${dto.items.length} items` : ''}`,
      });

      // 4. Return complete bundle with items and total_cost
      return await tx.quote_bundle.findFirst({
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
    }).then((bundle) => ({
      ...bundle,
      total_cost: this.calculateBundleTotalCost(bundle),
    }));
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
   * Toggle bundle active status
   */
  async toggleActive(tenantId: string, bundleId: string, userId: string) {
    // Verify bundle exists
    const bundle = await this.findOne(tenantId, bundleId);

    // Toggle is_active
    const updatedBundle = await this.prisma.quote_bundle.update({
      where: { id: bundleId },
      data: {
        is_active: !bundle.is_active,
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
      description: `Bundle ${updatedBundle.is_active ? 'activated' : 'deactivated'}: ${updatedBundle.name}`,
    });

    return {
      ...updatedBundle,
      total_cost: this.calculateBundleTotalCost(updatedBundle),
    };
  }

  /**
   * Duplicate bundle with all items
   */
  async duplicate(tenantId: string, bundleId: string, userId: string) {
    // Fetch original bundle with all items
    const originalBundle = await this.findOne(tenantId, bundleId);

    // Create new bundle with "(Copy)" appended to name
    const newBundleId = this.generateUUID();
    const newBundle = await this.prisma.$transaction(async (tx) => {
      // Create bundle
      const createdBundle = await tx.quote_bundle.create({
        data: {
          id: newBundleId,
          tenant_id: tenantId,
          name: `${originalBundle.name} (Copy)`,
          description: originalBundle.description,
          discount_type: originalBundle.discount_type,
          discount_value: originalBundle.discount_value,
          is_active: originalBundle.is_active,
          created_by_user_id: userId,
        },
      });

      // Duplicate all items
      const itemsData = originalBundle.items.map((item: any) => ({
        id: this.generateUUID(),
        quote_bundle_id: newBundleId,
        item_library_id: item.item_library_id,
        title: item.title,
        description: item.description,
        quantity: item.quantity,
        unit_measurement_id: item.unit_measurement_id,
        material_cost_per_unit: item.material_cost_per_unit,
        labor_cost_per_unit: item.labor_cost_per_unit,
        equipment_cost_per_unit: item.equipment_cost_per_unit,
        subcontract_cost_per_unit: item.subcontract_cost_per_unit,
        other_cost_per_unit: item.other_cost_per_unit,
        order_index: item.order_index,
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
      entityId: newBundle.id,
      tenantId,
      actorUserId: userId,
      after: newBundle,
      description: `Bundle duplicated from: ${originalBundle.name}`,
    });

    // Return complete bundle with items
    return this.findOne(tenantId, newBundleId);
  }

  /**
   * Add item to bundle
   * Supports creating items from library by passing library_item_id
   */
  async addItem(
    tenantId: string,
    bundleId: string,
    userId: string,
    dto: BundleItemDto,
  ) {
    // Verify bundle exists
    const bundle = await this.findOne(tenantId, bundleId);

    // Populate item from library if library_item_id is provided
    let itemData: any;

    if (dto.library_item_id) {
      // Fetch library item and auto-populate fields
      const libraryItem = await this.prisma.item_library.findFirst({
        where: {
          id: dto.library_item_id,
          tenant_id: tenantId,
          is_active: true,
        },
      });

      if (!libraryItem) {
        throw new NotFoundException(
          `Library item ${dto.library_item_id} not found or inactive`,
        );
      }

      itemData = {
        library_item_id: dto.library_item_id,
        title: dto.title || libraryItem.title,
        description: dto.description || libraryItem.description,
        quantity: dto.quantity,
        unit_measurement_id: dto.unit_measurement_id || libraryItem.unit_measurement_id,
        material_cost_per_unit: dto.material_cost_per_unit !== undefined
          ? dto.material_cost_per_unit
          : Number(libraryItem.material_cost_per_unit),
        labor_cost_per_unit: dto.labor_cost_per_unit !== undefined
          ? dto.labor_cost_per_unit
          : Number(libraryItem.labor_cost_per_unit),
        equipment_cost_per_unit: dto.equipment_cost_per_unit !== undefined
          ? dto.equipment_cost_per_unit
          : Number(libraryItem.equipment_cost_per_unit),
        subcontract_cost_per_unit: dto.subcontract_cost_per_unit !== undefined
          ? dto.subcontract_cost_per_unit
          : Number(libraryItem.subcontract_cost_per_unit),
        other_cost_per_unit: dto.other_cost_per_unit !== undefined
          ? dto.other_cost_per_unit
          : Number(libraryItem.other_cost_per_unit),
      };
    } else {
      // Validate all required fields are present
      if (!dto.title || !dto.unit_measurement_id ||
          dto.material_cost_per_unit === undefined ||
          dto.labor_cost_per_unit === undefined) {
        throw new BadRequestException(
          'When library_item_id is not provided, title, unit_measurement_id, material_cost_per_unit, and labor_cost_per_unit are required',
        );
      }

      itemData = {
        library_item_id: null,
        title: dto.title,
        description: dto.description || null,
        quantity: dto.quantity,
        unit_measurement_id: dto.unit_measurement_id,
        material_cost_per_unit: dto.material_cost_per_unit,
        labor_cost_per_unit: dto.labor_cost_per_unit,
        equipment_cost_per_unit: dto.equipment_cost_per_unit || 0,
        subcontract_cost_per_unit: dto.subcontract_cost_per_unit || 0,
        other_cost_per_unit: dto.other_cost_per_unit || 0,
      };
    }

    // Validate unit measurement
    const unit = await this.prisma.unit_measurement.findFirst({
      where: {
        id: itemData.unit_measurement_id,
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
        item_library_id: itemData.library_item_id,
        title: itemData.title,
        description: itemData.description,
        quantity: new Decimal(itemData.quantity),
        unit_measurement_id: itemData.unit_measurement_id,
        material_cost_per_unit: new Decimal(itemData.material_cost_per_unit),
        labor_cost_per_unit: new Decimal(itemData.labor_cost_per_unit),
        equipment_cost_per_unit: new Decimal(itemData.equipment_cost_per_unit),
        subcontract_cost_per_unit: new Decimal(itemData.subcontract_cost_per_unit),
        other_cost_per_unit: new Decimal(itemData.other_cost_per_unit),
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
        ...((dto as any).library_item_id !== undefined && { item_library_id: (dto as any).library_item_id }),
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
