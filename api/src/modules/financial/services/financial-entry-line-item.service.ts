import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateLineItemDto } from '../dto/create-line-item.dto';
import { UpdateLineItemDto } from '../dto/update-line-item.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';

@Injectable()
export class FinancialEntryLineItemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private isPrivilegedRole(roles: string[]): boolean {
    const privileged = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];
    return roles.some((r) => privileged.includes(r));
  }

  /**
   * Verify the parent entry exists, belongs to the tenant, and the user
   * has permission to manage its line items (same RBAC as editing the entry).
   */
  private async verifyEntryAccess(
    tenantId: string,
    entryId: string,
    userId: string,
    userRoles: string[],
  ) {
    const entry = await this.prisma.financial_entry.findFirst({
      where: { id: entryId, tenant_id: tenantId },
    });

    if (!entry) {
      throw new NotFoundException('Financial entry not found.');
    }

    // Employee: can only manage line items on own entries in pending_review/denied
    if (!this.isPrivilegedRole(userRoles)) {
      if (entry.created_by_user_id !== userId) {
        throw new ForbiddenException(
          'Access denied. You can only manage line items on your own entries.',
        );
      }
      if (entry.submission_status !== 'pending_review' && entry.submission_status !== 'denied') {
        throw new ForbiddenException(
          'Access denied. You can only manage line items on pending or denied entries.',
        );
      }
    }

    return entry;
  }

  /**
   * Resolve a supplier product for auto-fill. Validates tenant + active status.
   */
  private async resolveSupplierProduct(
    tenantId: string,
    supplierProductId: string,
  ) {
    const product = await this.prisma.supplier_product.findFirst({
      where: {
        id: supplierProductId,
        tenant_id: tenantId,
        is_active: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Supplier product not found or inactive.');
    }

    return product;
  }

  /**
   * Compute total = quantity * unit_price, rounded to 2 decimal places.
   */
  private computeTotal(quantity: number, unitPrice: number): number {
    return Math.round(quantity * unitPrice * 100) / 100;
  }

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  async create(
    tenantId: string,
    entryId: string,
    userId: string,
    userRoles: string[],
    dto: CreateLineItemDto,
  ) {
    await this.verifyEntryAccess(tenantId, entryId, userId, userRoles);

    // Auto-fill unit_of_measure from supplier product if not provided
    let resolvedUnitOfMeasure = dto.unit_of_measure ?? null;

    if (dto.supplier_product_id) {
      const product = await this.resolveSupplierProduct(tenantId, dto.supplier_product_id);
      if (!dto.unit_of_measure && product.unit_of_measure) {
        resolvedUnitOfMeasure = product.unit_of_measure;
      }
    }

    const total = this.computeTotal(dto.quantity, dto.unit_price);

    // Determine order_index
    let orderIndex = dto.order_index;
    if (orderIndex === undefined) {
      const lastItem = await this.prisma.financial_entry_line_item.findFirst({
        where: { financial_entry_id: entryId, tenant_id: tenantId },
        orderBy: { order_index: 'desc' },
        select: { order_index: true },
      });
      orderIndex = lastItem ? lastItem.order_index + 1 : 0;
    }

    const itemId = randomUUID();

    const item = await this.prisma.financial_entry_line_item.create({
      data: {
        id: itemId,
        tenant_id: tenantId,
        financial_entry_id: entryId,
        description: dto.description,
        quantity: new Decimal(dto.quantity),
        unit_price: new Decimal(dto.unit_price),
        total: new Decimal(total),
        unit_of_measure: resolvedUnitOfMeasure,
        supplier_product_id: dto.supplier_product_id ?? null,
        order_index: orderIndex,
        notes: dto.notes ?? null,
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'financial_entry_line_item',
      entityId: itemId,
      tenantId,
      actorUserId: userId,
      after: item,
      description: `Line item added to entry ${entryId}: ${dto.description}`,
    });

    return item;
  }

  // ---------------------------------------------------------------------------
  // FIND ALL
  // ---------------------------------------------------------------------------

  async findAll(
    tenantId: string,
    entryId: string,
    userId: string,
    userRoles: string[],
  ) {
    await this.verifyEntryAccess(tenantId, entryId, userId, userRoles);

    return this.prisma.financial_entry_line_item.findMany({
      where: {
        tenant_id: tenantId,
        financial_entry_id: entryId,
      },
      orderBy: { order_index: 'asc' },
      include: {
        supplier_product: {
          select: { id: true, name: true, sku: true },
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  async update(
    tenantId: string,
    entryId: string,
    itemId: string,
    userId: string,
    userRoles: string[],
    dto: UpdateLineItemDto,
  ) {
    await this.verifyEntryAccess(tenantId, entryId, userId, userRoles);

    const existing = await this.prisma.financial_entry_line_item.findFirst({
      where: {
        id: itemId,
        financial_entry_id: entryId,
        tenant_id: tenantId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Line item not found.');
    }

    // Validate supplier product if changed
    if (dto.supplier_product_id !== undefined && dto.supplier_product_id !== null) {
      await this.resolveSupplierProduct(tenantId, dto.supplier_product_id);
    }

    // Recompute total if quantity or unit_price changed
    const resultingQty = dto.quantity !== undefined ? dto.quantity : Number(existing.quantity);
    const resultingPrice = dto.unit_price !== undefined ? dto.unit_price : Number(existing.unit_price);
    const needsRecompute = dto.quantity !== undefined || dto.unit_price !== undefined;
    const total = needsRecompute ? this.computeTotal(resultingQty, resultingPrice) : undefined;

    const data: any = {};
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.quantity !== undefined) data.quantity = new Decimal(dto.quantity);
    if (dto.unit_price !== undefined) data.unit_price = new Decimal(dto.unit_price);
    if (total !== undefined) data.total = new Decimal(total);
    if (dto.unit_of_measure !== undefined) data.unit_of_measure = dto.unit_of_measure ?? null;
    if (dto.supplier_product_id !== undefined) data.supplier_product_id = dto.supplier_product_id ?? null;
    if (dto.order_index !== undefined) data.order_index = dto.order_index;
    if (dto.notes !== undefined) data.notes = dto.notes ?? null;

    const updated = await this.prisma.financial_entry_line_item.update({
      where: { id: itemId },
      data,
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'financial_entry_line_item',
      entityId: itemId,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: `Line item updated on entry ${entryId}: ${updated.description}`,
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------

  async delete(
    tenantId: string,
    entryId: string,
    itemId: string,
    userId: string,
    userRoles: string[],
  ) {
    await this.verifyEntryAccess(tenantId, entryId, userId, userRoles);

    const existing = await this.prisma.financial_entry_line_item.findFirst({
      where: {
        id: itemId,
        financial_entry_id: entryId,
        tenant_id: tenantId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Line item not found.');
    }

    await this.prisma.financial_entry_line_item.delete({
      where: { id: itemId },
    });

    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'financial_entry_line_item',
      entityId: itemId,
      tenantId,
      actorUserId: userId,
      before: existing,
      description: `Line item deleted from entry ${entryId}: ${existing.description}`,
    });

    return { message: 'Line item deleted successfully.' };
  }
}
