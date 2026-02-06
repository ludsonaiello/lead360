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
import { CreateGroupDto, UpdateGroupDto, ReorderGroupsDto } from '../dto/group';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuid } from 'uuid';

@Injectable()
export class QuoteGroupService {
  private readonly logger = new Logger(QuoteGroupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly versionService: QuoteVersionService,
    private readonly pricingService: QuotePricingService,
  ) {}

  /**
   * Create new quote group
   * Sets order_index = max + 1
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param userId - User UUID
   * @param dto - Create group DTO
   * @returns Created group
   */
  async create(
    tenantId: string,
    quoteId: string,
    userId: string,
    dto: CreateGroupDto,
  ): Promise<any> {
    // Validate quote exists
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.status === 'approved') {
      throw new BadRequestException('Cannot add groups to approved quote');
    }

    return await this.prisma.$transaction(async (tx) => {
      // Get next order_index
      const lastGroup = await tx.quote_group.findFirst({
        where: { quote_id: quoteId },
        orderBy: { order_index: 'desc' },
        select: { order_index: true },
      });

      const orderIndex = lastGroup ? lastGroup.order_index + 1 : 1;

      // Create group
      const group = await tx.quote_group.create({
        data: {
          id: uuid(),
          quote_id: quoteId,
          name: dto.name,
          description: dto.description || null,
          order_index: orderIndex,
        },
      });

      // Create version (+0.1)
      await this.versionService.createVersion(
        quoteId,
        0.1,
        `Group created: ${dto.name}`,
        userId,
        tx,
      );

      // Log audit trail
      await this.auditLogger.logTenantChange({
        action: 'created',
        entityType: 'quote_group',
        entityId: group.id,
        tenantId,
        actorUserId: userId,
        before: {} as any,
        after: group,
        description: `Quote group created: ${dto.name}`,
      });

      this.logger.log(`Quote group created: ${group.id} for quote: ${quoteId}`);

      return group;
    });
  }

  /**
   * List groups with nested items and subtotals
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @returns Array of groups with items and subtotals
   */
  async findAll(tenantId: string, quoteId: string): Promise<any[]> {
    // Validate quote exists
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    const groups = await this.prisma.quote_group.findMany({
      where: { quote_id: quoteId },
      include: {
        items: {
          include: {
            unit_measurement: true,
          },
          orderBy: { order_index: 'asc' },
        },
      },
      orderBy: { order_index: 'asc' },
    });

    // Calculate subtotals for each group
    return groups.map((group) => {
      const subtotal = group.items.reduce(
        (sum, item) => sum + Number(item.total_cost),
        0,
      );

      return {
        ...group,
        subtotal,
        items: group.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          material_cost_per_unit: Number(item.material_cost_per_unit),
          labor_cost_per_unit: Number(item.labor_cost_per_unit),
          equipment_cost_per_unit: Number(item.equipment_cost_per_unit),
          subcontract_cost_per_unit: Number(item.subcontract_cost_per_unit),
          other_cost_per_unit: Number(item.other_cost_per_unit),
          total_cost: Number(item.total_cost),
        })),
      };
    });
  }

  /**
   * Get single group with items
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param groupId - Group UUID
   * @returns Group with items
   */
  async findOne(
    tenantId: string,
    quoteId: string,
    groupId: string,
  ): Promise<any> {
    // Validate quote exists
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    const group = await this.prisma.quote_group.findFirst({
      where: {
        id: groupId,
        quote_id: quoteId,
      },
      include: {
        items: {
          include: {
            unit_measurement: true,
          },
          orderBy: { order_index: 'asc' },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Quote group not found');
    }

    const subtotal = group.items.reduce(
      (sum, item) => sum + Number(item.total_cost),
      0,
    );

    return {
      ...group,
      subtotal,
      items: group.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        material_cost_per_unit: Number(item.material_cost_per_unit),
        labor_cost_per_unit: Number(item.labor_cost_per_unit),
        equipment_cost_per_unit: Number(item.equipment_cost_per_unit),
        subcontract_cost_per_unit: Number(item.subcontract_cost_per_unit),
        other_cost_per_unit: Number(item.other_cost_per_unit),
        total_cost: Number(item.total_cost),
      })),
    };
  }

  /**
   * Update group name/description
   * Creates version (+0.1)
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param groupId - Group UUID
   * @param userId - User UUID
   * @param dto - Update group DTO
   * @returns Updated group
   */
  async update(
    tenantId: string,
    quoteId: string,
    groupId: string,
    userId: string,
    dto: UpdateGroupDto,
  ): Promise<any> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.status === 'approved') {
      throw new BadRequestException('Cannot edit groups in approved quote');
    }

    const group = await this.findOne(tenantId, quoteId, groupId);

    return await this.prisma.$transaction(async (tx) => {
      // Update group
      const updatedGroup = await tx.quote_group.update({
        where: { id: groupId },
        data: {
          name: dto.name || group.name,
          description:
            dto.description !== undefined ? dto.description : group.description,
        },
      });

      // Create version (+0.1)
      await this.versionService.createVersion(
        quoteId,
        0.1,
        `Group updated: ${updatedGroup.name}`,
        userId,
        tx,
      );

      // Log audit trail
      await this.auditLogger.logTenantChange({
        action: 'updated',
        entityType: 'quote_group',
        entityId: groupId,
        tenantId,
        actorUserId: userId,
        before: group,
        after: updatedGroup,
        description: `Quote group updated: ${updatedGroup.name}`,
      });

      this.logger.log(`Quote group updated: ${groupId}`);

      return updatedGroup;
    });
  }

  /**
   * Delete group with options: delete items OR move to ungrouped
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param groupId - Group UUID
   * @param userId - User UUID
   * @param deleteItems - Delete items or move to ungrouped (default: false)
   */
  async delete(
    tenantId: string,
    quoteId: string,
    groupId: string,
    userId: string,
    deleteItems: boolean = false,
  ): Promise<void> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.status === 'approved') {
      throw new BadRequestException('Cannot delete groups from approved quote');
    }

    const group = await this.findOne(tenantId, quoteId, groupId);

    await this.prisma.$transaction(async (tx) => {
      if (deleteItems) {
        // Delete all items in group
        await tx.quote_item.deleteMany({
          where: { quote_group_id: groupId },
        });
      } else {
        // Move items to ungrouped
        await tx.quote_item.updateMany({
          where: { quote_group_id: groupId },
          data: { quote_group_id: null },
        });
      }

      // Delete group
      await tx.quote_group.delete({
        where: { id: groupId },
      });

      // Update quote totals if items were deleted
      if (deleteItems) {
        const remainingItems = await tx.quote_item.findMany({
          where: { quote_id: quoteId },
        });

        const subtotal = remainingItems.reduce(
          (sum, item) => sum + Number(item.total_cost),
          0,
        );

        await tx.quote.update({
          where: { id: quoteId },
          data: {
            subtotal: new Decimal(subtotal),
            total: new Decimal(subtotal),
          },
        });
      }

      // Create version (+0.1)
      const action = deleteItems
        ? 'deleted with items'
        : 'deleted (items moved to ungrouped)';
      await this.versionService.createVersion(
        quoteId,
        0.1,
        `Group ${action}: ${group.name}`,
        userId,
        tx,
      );

      // Log audit trail
      await this.auditLogger.logTenantChange({
        action: 'deleted',
        entityType: 'quote_group',
        entityId: groupId,
        tenantId,
        actorUserId: userId,
        before: group,
        after: {} as any,
        description: `Quote group ${action}: ${group.name}`,
      });

      this.logger.log(
        `Quote group deleted: ${groupId} (deleteItems: ${deleteItems})`,
      );
    });
  }

  /**
   * Duplicate group (clones group + all items)
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param groupId - Group UUID
   * @param userId - User UUID
   * @returns Duplicated group with items
   */
  async duplicate(
    tenantId: string,
    quoteId: string,
    groupId: string,
    userId: string,
  ): Promise<any> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.status === 'approved') {
      throw new BadRequestException(
        'Cannot duplicate groups in approved quote',
      );
    }

    const sourceGroup = await this.findOne(tenantId, quoteId, groupId);

    const newGroupId = await this.prisma.$transaction(async (tx) => {
      // Increment order_index of groups below
      await tx.quote_group.updateMany({
        where: {
          quote_id: quoteId,
          order_index: { gt: sourceGroup.order_index },
        },
        data: {
          order_index: { increment: 1 },
        },
      });

      // Create new group
      const newGroup = await tx.quote_group.create({
        data: {
          id: uuid(),
          quote_id: quoteId,
          name: `${sourceGroup.name} (Copy)`,
          description: sourceGroup.description,
          order_index: sourceGroup.order_index + 1,
        },
      });

      // Clone all items in group
      for (const item of sourceGroup.items) {
        await tx.quote_item.create({
          data: {
            id: uuid(),
            quote_id: quoteId,
            quote_group_id: newGroup.id,
            title: item.title,
            description: item.description,
            quantity: new Decimal(item.quantity),
            unit_measurement_id: item.unit_measurement_id,
            material_cost_per_unit: new Decimal(item.material_cost_per_unit),
            labor_cost_per_unit: new Decimal(item.labor_cost_per_unit),
            equipment_cost_per_unit: new Decimal(item.equipment_cost_per_unit),
            subcontract_cost_per_unit: new Decimal(
              item.subcontract_cost_per_unit,
            ),
            other_cost_per_unit: new Decimal(item.other_cost_per_unit),
            total_cost: new Decimal(item.total_cost),
            order_index: item.order_index,
          },
        });
      }

      // Update quote totals (includes markups, discounts, tax)
      await this.pricingService.updateQuoteFinancials(quoteId, tx);

      // Create version (+0.1)
      await this.versionService.createVersion(
        quoteId,
        0.1,
        `Group duplicated: ${sourceGroup.name}`,
        userId,
        tx,
      );

      // Log audit trail
      await this.auditLogger.logTenantChange({
        action: 'created',
        entityType: 'quote_group',
        entityId: newGroup.id,
        tenantId,
        actorUserId: userId,
        before: {} as any,
        after: newGroup,
        description: `Quote group duplicated: ${sourceGroup.name}`,
      });

      this.logger.log(`Quote group duplicated: ${groupId} → ${newGroup.id}`);

      return newGroup.id;
    });

    // Fetch and return the complete group after transaction commits
    return this.findOne(tenantId, quoteId, newGroupId);
  }

  /**
   * Reorder quote groups
   * DOES NOT create a version - this is a cosmetic change
   *
   * @param tenantId - Tenant UUID
   * @param quoteId - Quote UUID
   * @param dto - Reorder groups DTO
   */
  async reorder(
    tenantId: string,
    quoteId: string,
    dto: ReorderGroupsDto,
  ): Promise<void> {
    // Validate quote exists
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    // Batch update order_index for all groups
    await this.prisma.$transaction(
      dto.groups.map((group) =>
        this.prisma.quote_group.updateMany({
          where: {
            id: group.group_id,
            quote_id: quoteId,
          },
          data: {
            order_index: group.order_index,
          },
        }),
      ),
    );

    this.logger.log(
      `Reordered ${dto.groups.length} groups for quote: ${quoteId}`,
    );
  }
}
