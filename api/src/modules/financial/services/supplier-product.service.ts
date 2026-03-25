import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateSupplierProductDto } from '../dto/create-supplier-product.dto';
import { UpdateSupplierProductDto } from '../dto/update-supplier-product.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';

@Injectable()
export class SupplierProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private async verifySupplierExists(tenantId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenant_id: tenantId },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found.');
    }
    return supplier;
  }

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  async create(
    tenantId: string,
    supplierId: string,
    userId: string,
    dto: CreateSupplierProductDto,
  ) {
    // 1. Verify supplier exists
    await this.verifySupplierExists(tenantId, supplierId);

    // 2. Case-insensitive name uniqueness within supplier
    //    (MySQL ci collation handles case-insensitive matching)
    const existing = await this.prisma.supplier_product.findFirst({
      where: {
        supplier_id: supplierId,
        tenant_id: tenantId,
        name: dto.name,
      },
    });
    if (existing) {
      throw new ConflictException(
        `Product "${dto.name}" already exists for this supplier.`,
      );
    }

    // 3. Create product and initial price history in a transaction
    const productId = randomUUID();
    const now = new Date();

    const product = await this.prisma.$transaction(async (tx) => {
      const newProduct = await tx.supplier_product.create({
        data: {
          id: productId,
          tenant_id: tenantId,
          supplier_id: supplierId,
          name: dto.name,
          description: dto.description || null,
          unit_of_measure: dto.unit_of_measure,
          unit_price:
            dto.unit_price !== undefined ? new Decimal(dto.unit_price) : null,
          price_last_updated_at:
            dto.unit_price !== undefined ? now : null,
          price_last_updated_by_user_id:
            dto.unit_price !== undefined ? userId : null,
          sku: dto.sku || null,
          created_by_user_id: userId,
        },
      });

      // If unit_price is provided, create the first price history record
      if (dto.unit_price !== undefined) {
        await tx.supplier_product_price_history.create({
          data: {
            id: randomUUID(),
            tenant_id: tenantId,
            supplier_product_id: productId,
            supplier_id: supplierId,
            previous_price: null, // First price ever set
            new_price: new Decimal(dto.unit_price),
            changed_by_user_id: userId,
            notes: 'Initial price set on product creation',
          },
        });
      }

      return newProduct;
    });

    // 4. Audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'supplier_product',
      entityId: productId,
      tenantId,
      actorUserId: userId,
      after: product,
      description: `Supplier product created: ${product.name}`,
    });

    // 5. Return the product
    return product;
  }

  // ---------------------------------------------------------------------------
  // FIND ONE
  // ---------------------------------------------------------------------------

  async findOne(tenantId: string, supplierId: string, productId: string) {
    await this.verifySupplierExists(tenantId, supplierId);

    const product = await this.prisma.supplier_product.findFirst({
      where: {
        id: productId,
        supplier_id: supplierId,
        tenant_id: tenantId,
      },
    });
    if (!product) {
      throw new NotFoundException('Supplier product not found.');
    }

    return product;
  }

  // ---------------------------------------------------------------------------
  // FIND ALL
  // ---------------------------------------------------------------------------

  async findAll(
    tenantId: string,
    supplierId: string,
    isActive?: boolean,
  ) {
    await this.verifySupplierExists(tenantId, supplierId);

    const where: any = {
      tenant_id: tenantId,
      supplier_id: supplierId,
    };

    if (isActive !== undefined) {
      where.is_active = isActive;
    } else {
      where.is_active = true; // Default to active only
    }

    const products = await this.prisma.supplier_product.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        unit_of_measure: true,
        unit_price: true,
        price_last_updated_at: true,
        sku: true,
        is_active: true,
        created_at: true,
      },
    });

    return products;
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  async update(
    tenantId: string,
    supplierId: string,
    productId: string,
    userId: string,
    dto: UpdateSupplierProductDto,
  ) {
    // 1. Verify supplier and product exist
    await this.verifySupplierExists(tenantId, supplierId);

    const existing = await this.prisma.supplier_product.findFirst({
      where: {
        id: productId,
        supplier_id: supplierId,
        tenant_id: tenantId,
      },
    });
    if (!existing) {
      throw new NotFoundException('Supplier product not found.');
    }

    // 2. Name uniqueness check (if name is changing)
    if (dto.name && dto.name.toLowerCase() !== existing.name.toLowerCase()) {
      const duplicate = await this.prisma.supplier_product.findFirst({
        where: {
          supplier_id: supplierId,
          tenant_id: tenantId,
          name: dto.name,
          id: { not: productId },
        },
      });
      if (duplicate) {
        throw new ConflictException(
          `Product "${dto.name}" already exists for this supplier.`,
        );
      }
    }

    // 3. Detect price change and create history record
    const priceChanged =
      dto.unit_price !== undefined &&
      (existing.unit_price === null ||
        Number(existing.unit_price) !== dto.unit_price);

    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      // If price changed, create price history record BEFORE updating
      if (priceChanged) {
        await tx.supplier_product_price_history.create({
          data: {
            id: randomUUID(),
            tenant_id: tenantId,
            supplier_product_id: productId,
            supplier_id: supplierId,
            previous_price: existing.unit_price,
            new_price: new Decimal(dto.unit_price!),
            changed_by_user_id: userId,
          },
        });
      }

      // Update the product
      return tx.supplier_product.update({
        where: { id: productId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.unit_of_measure !== undefined && {
            unit_of_measure: dto.unit_of_measure,
          }),
          ...(dto.unit_price !== undefined && {
            unit_price: new Decimal(dto.unit_price),
          }),
          ...(dto.sku !== undefined && { sku: dto.sku }),
          ...(dto.is_active !== undefined && { is_active: dto.is_active }),
          // Auto-update price tracking fields when price changes
          ...(priceChanged && {
            price_last_updated_at: now,
            price_last_updated_by_user_id: userId,
          }),
        },
      });
    });

    // 4. Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'supplier_product',
      entityId: productId,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: `Supplier product updated: ${updated.name}${priceChanged ? ' (price changed)' : ''}`,
    });

    // 5. Return the updated product
    return updated;
  }

  // ---------------------------------------------------------------------------
  // SOFT DELETE
  // ---------------------------------------------------------------------------

  async softDelete(
    tenantId: string,
    supplierId: string,
    productId: string,
    userId: string,
  ) {
    await this.verifySupplierExists(tenantId, supplierId);

    const product = await this.prisma.supplier_product.findFirst({
      where: {
        id: productId,
        supplier_id: supplierId,
        tenant_id: tenantId,
      },
    });
    if (!product) {
      throw new NotFoundException('Supplier product not found.');
    }

    const updated = await this.prisma.supplier_product.update({
      where: { id: productId },
      data: { is_active: false },
    });

    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'supplier_product',
      entityId: productId,
      tenantId,
      actorUserId: userId,
      before: product,
      after: updated,
      description: `Supplier product soft-deleted: ${product.name}`,
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // PRICE HISTORY
  // ---------------------------------------------------------------------------

  async getPriceHistory(
    tenantId: string,
    supplierId: string,
    productId: string,
  ) {
    await this.verifySupplierExists(tenantId, supplierId);

    // Verify product exists
    const product = await this.prisma.supplier_product.findFirst({
      where: {
        id: productId,
        supplier_id: supplierId,
        tenant_id: tenantId,
      },
    });
    if (!product) {
      throw new NotFoundException('Supplier product not found.');
    }

    const history = await this.prisma.supplier_product_price_history.findMany({
      where: {
        tenant_id: tenantId,
        supplier_product_id: productId,
      },
      orderBy: { changed_at: 'desc' },
      include: {
        changed_by: {
          select: { id: true, first_name: true, last_name: true },
        },
      },
    });

    return history.map((h) => ({
      id: h.id,
      previous_price: h.previous_price,
      new_price: h.new_price,
      changed_at: h.changed_at,
      changed_by: h.changed_by,
      notes: h.notes,
    }));
  }
}
