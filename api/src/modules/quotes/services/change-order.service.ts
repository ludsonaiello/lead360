import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { QuoteVersionService } from './quote-version.service';
import { QuotePricingService } from './quote-pricing.service';
import {
  CreateChangeOrderDto,
  ChangeOrderResponseDto,
  ChangeOrderSummaryDto,
  ParentQuoteTotalsDto,
  ApproveChangeOrderDto,
  RejectChangeOrderDto,
  ListChangeOrdersResponseDto,
} from '../dto/change-order';
import { v4 as uuid } from 'uuid';

/**
 * ChangeOrderService
 *
 * Manages change orders (modifications to approved quotes).
 *
 * PROPER IMPLEMENTATION:
 * Uses parent_quote_id foreign key relationship (no more private_notes hack!)
 *
 * Key Features:
 * - Create change orders from approved quotes
 * - Full quote capabilities (groups, items, bundles, discounts, custom margins)
 * - Independent status workflow (draft → sent → approved/denied)
 * - PDF generation with parent context
 * - Public URL access with tokens
 * - Email sending to customers
 * - Track cumulative impact on project total
 * - Parent totals: original + approved COs = revised total
 *
 * Business Rules:
 * - Parent quote must be approved, started, or concluded
 * - Change order inherits customer, vendor, jobsite (unless overridden)
 * - Change order status starts as draft
 * - Quote number with CO- prefix (CO-YYYY-####)
 * - Only approved COs count toward revised total
 * - Pending COs tracked separately
 * - Cannot delete parent if COs exist (ON DELETE RESTRICT)
 *
 * @author Developer 5 (Rebuilt)
 */
@Injectable()
export class ChangeOrderService {
  private readonly logger = new Logger(ChangeOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly versionService: QuoteVersionService,
    private readonly pricingService: QuotePricingService,
  ) {}

  /**
   * Generate change order number (CO-YYYY-####)
   *
   * @param tenantId - Tenant UUID
   * @param transaction - Prisma transaction
   * @returns Formatted change order number
   */
  private async generateChangeOrderNumber(tenantId: string, transaction: any): Promise<string> {
    // Count existing change orders for this year
    const year = new Date().getFullYear();
    const existingCOs = await transaction.quote.count({
      where: {
        tenant_id: tenantId,
        quote_number: { startsWith: `CO-${year}-` },
      },
    });

    const sequence = existingCOs + 1;
    const paddedSequence = String(sequence).padStart(4, '0');

    return `CO-${year}-${paddedSequence}`;
  }

  /**
   * Create change order from approved quote
   *
   * @param tenantId - Tenant ID
   * @param userId - User creating change order
   * @param parentQuoteId - Parent quote UUID
   * @param dto - Change order details
   * @returns Created change order with parent context
   */
  async createChangeOrder(
    tenantId: string,
    userId: string,
    parentQuoteId: string,
    dto: CreateChangeOrderDto,
  ): Promise<ChangeOrderResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Validate parent quote exists and is in valid status
      const parentQuote = await tx.quote.findFirst({
        where: {
          id: parentQuoteId,
          tenant_id: tenantId,
        },
      });

      if (!parentQuote) {
        throw new NotFoundException(`Parent quote ${parentQuoteId} not found`);
      }

      // Parent must be approved, started, or concluded
      const validStatuses = ['approved', 'started', 'concluded'];
      if (!validStatuses.includes(parentQuote.status)) {
        throw new BadRequestException(
          `Parent quote must be approved, started, or concluded to create change order. Current status: ${parentQuote.status}`,
        );
      }

      // 2. Generate change order number (CO-YYYY-####)
      const coNumber = await this.generateChangeOrderNumber(tenantId, tx);

      // 3. Set expiration days (default 30) and calculate expiration date
      const expirationDays = dto.expiration_days || 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);

      // 4. Handle jobsite address (use override or inherit from parent)
      let jobsiteAddressId = parentQuote.jobsite_address_id;
      if (dto.jobsite_address) {
        // Create new address if override provided
        const newAddress = await tx.quote_jobsite_address.create({
          data: {
            id: uuid(),
            tenant_id: tenantId,
            address_line1: dto.jobsite_address.address_line1,
            address_line2: dto.jobsite_address.address_line2 || null,
            city: dto.jobsite_address.city || '',
            state: dto.jobsite_address.state || '',
            zip_code: dto.jobsite_address.zip_code,
            latitude: dto.jobsite_address.latitude || 0,
            longitude: dto.jobsite_address.longitude || 0,
          },
        });
        jobsiteAddressId = newAddress.id;
      }

      // 5. Determine vendor (use override or inherit from parent)
      const vendorId = dto.vendor_id || parentQuote.vendor_id;
      if (dto.vendor_id) {
        // Validate vendor exists and belongs to tenant
        const vendor = await tx.vendor.findFirst({
          where: {
            id: dto.vendor_id,
            tenant_id: tenantId,
            is_active: true,
          },
        });
        if (!vendor) {
          throw new NotFoundException('Vendor not found or inactive');
        }
      }

      // 6. Create change order (new quote with parent reference)
      const changeOrder = await tx.quote.create({
        data: {
          id: uuid(),
          tenant_id: tenantId,
          quote_number: coNumber,
          title: dto.title,
          status: 'draft',
          lead_id: parentQuote.lead_id,
          vendor_id: vendorId,
          jobsite_address_id: jobsiteAddressId,
          parent_quote_id: parentQuoteId, // PROPER FOREIGN KEY!
          private_notes: dto.description || null,
          created_by_user_id: userId,
          expires_at: expiresAt,
          use_default_settings: dto.custom_profit_percent === undefined &&
                                dto.custom_overhead_percent === undefined &&
                                dto.custom_contingency_percent === undefined,
          custom_profit_percent: dto.custom_profit_percent ?? parentQuote.custom_profit_percent,
          custom_overhead_percent: dto.custom_overhead_percent ?? parentQuote.custom_overhead_percent,
          custom_contingency_percent: dto.custom_contingency_percent ?? parentQuote.custom_contingency_percent,
        },
      });

      // 7. Create initial version (1.0)
      await this.versionService.createVersion(
        changeOrder.id,
        1.0,
        'Initial change order version',
        userId,
        tx,
      );

      // 8. Audit log
      await this.auditLogger.log({
        tenant_id: tenantId,
        actor_user_id: userId,
        actor_type: 'user',
        entity_type: 'quote',
        entity_id: changeOrder.id,
        action_type: 'created',
        description: `Created change order ${coNumber} for parent quote ${parentQuote.quote_number}`,
        metadata_json: {
          parent_quote_id: parentQuoteId,
          parent_quote_number: parentQuote.quote_number,
          change_order_number: coNumber,
          title: dto.title,
        },
      });

      this.logger.log(`Created change order ${coNumber} for parent quote ${parentQuote.quote_number}`);

      // 9. Return response with parent context
      return {
        id: changeOrder.id,
        quote_number: changeOrder.quote_number,
        title: changeOrder.title,
        status: changeOrder.status,
        parent_quote_id: parentQuoteId,
        parent_quote_number: parentQuote.quote_number,
        parent_original_total: parseFloat(parentQuote.total?.toString() || '0'),
        subtotal: parseFloat(changeOrder.subtotal?.toString() || '0'),
        tax_amount: parseFloat(changeOrder.tax_amount?.toString() || '0'),
        discount_amount: parseFloat(changeOrder.discount_amount?.toString() || '0'),
        total: parseFloat(changeOrder.total?.toString() || '0'),
        created_at: changeOrder.created_at.toISOString(),
        updated_at: changeOrder.updated_at.toISOString(),
      };
    });
  }

  /**
   * List change orders for parent quote
   *
   * @param tenantId - Tenant ID
   * @param parentQuoteId - Parent quote UUID
   * @param status - Optional status filter
   * @returns Change orders with summary statistics
   */
  async listChangeOrders(
    tenantId: string,
    parentQuoteId: string,
    status?: string,
  ): Promise<ListChangeOrdersResponseDto> {
    // Validate parent quote exists
    const parentQuote = await this.prisma.quote.findFirst({
      where: {
        id: parentQuoteId,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        quote_number: true,
      },
    });

    if (!parentQuote) {
      throw new NotFoundException(`Parent quote ${parentQuoteId} not found`);
    }

    // Build where clause
    const whereClause: any = {
      tenant_id: tenantId,
      parent_quote_id: parentQuoteId, // PROPER FOREIGN KEY FILTER!
    };

    if (status) {
      whereClause.status = status;
    }

    // Fetch change orders
    const changeOrders = await this.prisma.quote.findMany({
      where: whereClause,
      orderBy: {
        created_at: 'desc',
      },
      select: {
        id: true,
        quote_number: true,
        title: true,
        status: true,
        total: true,
        created_at: true,
        updated_at: true,
      },
    });

    // Calculate summary statistics
    const approvedCount = changeOrders.filter((co) => co.status === 'approved').length;
    const pendingStatuses = ['draft', 'pending_approval', 'ready', 'sent', 'delivered', 'read', 'opened', 'downloaded'];
    const pendingCount = changeOrders.filter((co) => pendingStatuses.includes(co.status)).length;
    const rejectedCount = changeOrders.filter((co) => co.status === 'denied').length;

    // Map to summary DTOs
    const changeOrderSummaries: ChangeOrderSummaryDto[] = changeOrders.map((co) => ({
      id: co.id,
      quote_number: co.quote_number,
      title: co.title || '',
      status: co.status,
      total: parseFloat(co.total?.toString() || '0'),
      created_at: co.created_at.toISOString(),
      approved_at: co.status === 'approved' ? co.updated_at.toISOString() : undefined,
    }));

    return {
      parent_quote_id: parentQuoteId,
      parent_quote_number: parentQuote.quote_number,
      change_orders: changeOrderSummaries,
      summary: {
        total_count: changeOrders.length,
        approved_count: approvedCount,
        pending_count: pendingCount,
        rejected_count: rejectedCount,
      },
    };
  }

  /**
   * Get parent quote totals with aggregated change order impact
   *
   * @param tenantId - Tenant ID
   * @param parentQuoteId - Parent quote UUID
   * @returns Parent totals with change order aggregation
   */
  async getParentQuoteTotals(
    tenantId: string,
    parentQuoteId: string,
  ): Promise<ParentQuoteTotalsDto> {
    // Fetch parent quote
    const parentQuote = await this.prisma.quote.findFirst({
      where: {
        id: parentQuoteId,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        quote_number: true,
        total: true,
      },
    });

    if (!parentQuote) {
      throw new NotFoundException(`Parent quote ${parentQuoteId} not found`);
    }

    // Fetch all change orders
    const changeOrders = await this.prisma.quote.findMany({
      where: {
        tenant_id: tenantId,
        parent_quote_id: parentQuoteId, // PROPER FOREIGN KEY FILTER!
      },
      select: {
        id: true,
        quote_number: true,
        title: true,
        status: true,
        total: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    // Separate approved and pending change orders
    const approvedCOs = changeOrders.filter((co) => co.status === 'approved');
    const pendingStatuses = ['draft', 'pending_approval', 'ready', 'sent', 'delivered', 'read', 'opened', 'downloaded'];
    const pendingCOs = changeOrders.filter((co) => pendingStatuses.includes(co.status));

    // Calculate totals
    const originalTotal = parseFloat(parentQuote.total?.toString() || '0');
    const approvedChangeOrdersTotal = approvedCOs.reduce(
      (sum, co) => sum + parseFloat(co.total?.toString() || '0'),
      0,
    );
    const pendingChangeOrdersTotal = pendingCOs.reduce(
      (sum, co) => sum + parseFloat(co.total?.toString() || '0'),
      0,
    );
    const revisedTotal = originalTotal + approvedChangeOrdersTotal;

    // Map to summary DTOs
    const changeOrderSummaries: ChangeOrderSummaryDto[] = changeOrders.map((co) => ({
      id: co.id,
      quote_number: co.quote_number,
      title: co.title || '',
      status: co.status,
      total: parseFloat(co.total?.toString() || '0'),
      created_at: co.created_at.toISOString(),
      approved_at: co.status === 'approved' ? co.updated_at.toISOString() : undefined,
    }));

    return {
      parent_quote_id: parentQuoteId,
      parent_quote_number: parentQuote.quote_number,
      original_total: originalTotal,
      approved_change_orders_total: approvedChangeOrdersTotal,
      pending_change_orders_total: pendingChangeOrdersTotal,
      revised_total: revisedTotal,
      approved_co_count: approvedCOs.length,
      pending_co_count: pendingCOs.length,
      change_orders: changeOrderSummaries,
    };
  }

  /**
   * Approve change order
   *
   * @param tenantId - Tenant ID
   * @param userId - User approving
   * @param changeOrderId - Change order UUID
   * @param dto - Approval notes (optional)
   * @returns Approved change order with revised parent total
   */
  async approveChangeOrder(
    tenantId: string,
    userId: string,
    changeOrderId: string,
    dto?: ApproveChangeOrderDto,
  ): Promise<ChangeOrderResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch change order with parent
      const changeOrder = await tx.quote.findFirst({
        where: {
          id: changeOrderId,
          tenant_id: tenantId,
        },
        include: {
          parent_quote: {
            select: {
              id: true,
              quote_number: true,
              total: true,
            },
          },
        },
      });

      if (!changeOrder) {
        throw new NotFoundException(`Change order ${changeOrderId} not found`);
      }

      if (!changeOrder.parent_quote_id) {
        throw new BadRequestException('This quote is not a change order');
      }

      if (!changeOrder.parent_quote) {
        throw new NotFoundException('Parent quote not found');
      }

      // 2. Validate status (must be ready or sent)
      const validStatuses = ['ready', 'sent', 'delivered', 'read', 'opened', 'downloaded'];
      if (!validStatuses.includes(changeOrder.status)) {
        throw new BadRequestException(
          `Change order must be in ready or sent status to approve. Current status: ${changeOrder.status}`,
        );
      }

      // 3. Update status to approved
      const updated = await tx.quote.update({
        where: { id: changeOrderId },
        data: { status: 'approved' },
      });

      // 4. Create version snapshot (+1.0)
      await this.versionService.createVersion(
        changeOrderId,
        1.0,
        dto?.notes || 'Change order approved',
        userId,
        tx,
      );

      // 5. Audit log
      await this.auditLogger.log({
        tenant_id: tenantId,
        actor_user_id: userId,
        actor_type: 'user',
        entity_type: 'quote',
        entity_id: changeOrderId,
        action_type: 'updated',
        description: `Approved change order ${changeOrder.quote_number}`,
        metadata_json: {
          change_order_number: changeOrder.quote_number,
          parent_quote_id: changeOrder.parent_quote_id,
          parent_quote_number: changeOrder.parent_quote.quote_number,
          total: parseFloat(updated.total?.toString() || '0'),
          notes: dto?.notes,
          status: 'approved',
        },
      });

      this.logger.log(`Change order ${changeOrder.quote_number} approved by user ${userId}`);

      // 6. Return response with parent context and revised total
      return {
        id: updated.id,
        quote_number: updated.quote_number,
        title: updated.title || '',
        status: updated.status,
        parent_quote_id: changeOrder.parent_quote_id,
        parent_quote_number: changeOrder.parent_quote.quote_number,
        parent_original_total: parseFloat(changeOrder.parent_quote.total?.toString() || '0'),
        subtotal: parseFloat(updated.subtotal?.toString() || '0'),
        tax_amount: parseFloat(updated.tax_amount?.toString() || '0'),
        discount_amount: parseFloat(updated.discount_amount?.toString() || '0'),
        total: parseFloat(updated.total?.toString() || '0'),
        created_at: updated.created_at.toISOString(),
        updated_at: updated.updated_at.toISOString(),
        approved_at: updated.updated_at.toISOString(),
      };
    });
  }

  /**
   * Reject change order with reason
   *
   * @param tenantId - Tenant ID
   * @param userId - User rejecting
   * @param changeOrderId - Change order UUID
   * @param dto - Rejection reason (required)
   * @returns Rejected change order
   */
  async rejectChangeOrder(
    tenantId: string,
    userId: string,
    changeOrderId: string,
    dto: RejectChangeOrderDto,
  ): Promise<ChangeOrderResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch change order with parent
      const changeOrder = await tx.quote.findFirst({
        where: {
          id: changeOrderId,
          tenant_id: tenantId,
        },
        include: {
          parent_quote: {
            select: {
              id: true,
              quote_number: true,
              total: true,
            },
          },
        },
      });

      if (!changeOrder) {
        throw new NotFoundException(`Change order ${changeOrderId} not found`);
      }

      if (!changeOrder.parent_quote_id) {
        throw new BadRequestException('This quote is not a change order');
      }

      if (!changeOrder.parent_quote) {
        throw new NotFoundException('Parent quote not found');
      }

      // 2. Update status to denied
      const updated = await tx.quote.update({
        where: { id: changeOrderId },
        data: { status: 'denied' },
      });

      // 3. Create version snapshot (+1.0)
      await this.versionService.createVersion(
        changeOrderId,
        1.0,
        `Change order rejected: ${dto.reason}`,
        userId,
        tx,
      );

      // 4. Audit log with rejection reason
      await this.auditLogger.log({
        tenant_id: tenantId,
        actor_user_id: userId,
        actor_type: 'user',
        entity_type: 'quote',
        entity_id: changeOrderId,
        action_type: 'updated',
        description: `Rejected change order ${changeOrder.quote_number}: ${dto.reason}`,
        metadata_json: {
          change_order_number: changeOrder.quote_number,
          parent_quote_id: changeOrder.parent_quote_id,
          parent_quote_number: changeOrder.parent_quote.quote_number,
          rejection_reason: dto.reason,
          status: 'denied',
        },
      });

      this.logger.log(`Change order ${changeOrder.quote_number} rejected by user ${userId}: ${dto.reason}`);

      // 5. Return response
      return {
        id: updated.id,
        quote_number: updated.quote_number,
        title: updated.title || '',
        status: updated.status,
        parent_quote_id: changeOrder.parent_quote_id,
        parent_quote_number: changeOrder.parent_quote.quote_number,
        parent_original_total: parseFloat(changeOrder.parent_quote.total?.toString() || '0'),
        subtotal: parseFloat(updated.subtotal?.toString() || '0'),
        tax_amount: parseFloat(updated.tax_amount?.toString() || '0'),
        discount_amount: parseFloat(updated.discount_amount?.toString() || '0'),
        total: parseFloat(updated.total?.toString() || '0'),
        created_at: updated.created_at.toISOString(),
        updated_at: updated.updated_at.toISOString(),
      };
    });
  }

  /**
   * Link change order to project (placeholder)
   *
   * @param tenantId - Tenant ID
   * @param changeOrderId - Change order UUID
   * @returns Success message
   */
  async linkToProject(tenantId: string, changeOrderId: string) {
    return {
      message: 'Project integration not yet available',
      planned_for: 'Phase 2',
    };
  }

  /**
   * Get change order history timeline
   *
   * @param tenantId - Tenant ID
   * @param parentQuoteId - Parent quote UUID
   * @returns Timeline of changes with events
   */
  async getHistory(tenantId: string, parentQuoteId: string) {
    const changeOrdersList = await this.listChangeOrders(tenantId, parentQuoteId);

    const timeline = changeOrdersList.change_orders.map((co) => ({
      id: co.id,
      event_type: co.status === 'approved' ? 'change_order_approved' :
                  co.status === 'denied' ? 'change_order_rejected' :
                  'change_order_created',
      change_order_number: co.quote_number,
      description: co.title,
      amount: co.total,
      timestamp: co.created_at,
      status: co.status,
    }));

    // Sort by timestamp (ascending - oldest first)
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      timeline,
      parent_quote_id: parentQuoteId,
      parent_quote_number: changeOrdersList.parent_quote_number,
      total_events: timeline.length,
    };
  }
}
