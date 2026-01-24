import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import * as crypto from 'crypto';

/**
 * ChangeOrderService
 *
 * Manages change orders (modifications to approved quotes).
 *
 * IMPLEMENTATION NOTE:
 * This implementation uses private_notes field to store parent quote ID
 * in format: "PARENT_QUOTE_ID:{uuid}"
 * A proper schema migration adding parent_quote_id field is recommended.
 *
 * Key Features:
 * - Create change orders from approved quotes
 * - Track cumulative impact on project total
 * - Change order approval workflow
 * - History timeline
 *
 * Business Rules:
 * - Parent quote must be approved
 * - Change order inherits customer, vendor, jobsite
 * - Change order status starts as draft
 * - Separate quote number with CO- prefix
 *
 * @author Developer 5
 */
@Injectable()
export class ChangeOrderService {
  private readonly logger = new Logger(ChangeOrderService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Helper: Extract parent quote ID from private notes
   */
  private extractParentQuoteId(privateNotes: string | null): string | null {
    if (!privateNotes) return null;
    const match = privateNotes.match(/PARENT_QUOTE_ID:([a-f0-9-]+)/);
    return match ? match[1] : null;
  }

  /**
   * Helper: Create private notes with parent quote ID
   */
  private createParentNotes(parentId: string, additionalNotes?: string): string {
    const parentRef = `PARENT_QUOTE_ID:${parentId}`;
    return additionalNotes ? `${parentRef}\n${additionalNotes}` : parentRef;
  }

  /**
   * Create change order from approved quote
   *
   * @param tenantId - Tenant ID
   * @param userId - User creating change order
   * @param parentQuoteId - Parent quote UUID
   * @param dto - Change order details
   * @returns Created change order (quote object)
   */
  async createChangeOrder(tenantId: string, userId: string, parentQuoteId: string, dto: any) {
    // 1. Validate parent quote exists and is approved
    const parentQuote = await this.prisma.quote.findFirst({
      where: {
        id: parentQuoteId,
        tenant_id: tenantId,
      },
    });

    if (!parentQuote) {
      throw new NotFoundException(`Parent quote ${parentQuoteId} not found`);
    }

    if (parentQuote.status !== 'approved') {
      throw new BadRequestException(
        `Parent quote must be approved to create change order. Current status: ${parentQuote.status}`,
      );
    }

    // 2. Count existing change orders to generate number
    const existingCOs = await this.prisma.quote.count({
      where: {
        tenant_id: tenantId,
        quote_number: { startsWith: 'CO-' },
      },
    });

    const coNumber = `CO-${new Date().getFullYear()}-${String(existingCOs + 1).padStart(3, '0')}`;

    // 3. Create change order (new quote)
    const changeOrder = await this.prisma.quote.create({
      data: {
        id: crypto.randomUUID(),
        tenant_id: tenantId,
        quote_number: coNumber,
        title: dto.title,
        status: 'draft',
        lead_id: parentQuote.lead_id,
        vendor_id: parentQuote.vendor_id,
        jobsite_address_id: parentQuote.jobsite_address_id,
        private_notes: this.createParentNotes(parentQuoteId, dto.description),
        created_by_user_id: userId,
        use_default_settings: parentQuote.use_default_settings,
        custom_profit_percent: parentQuote.custom_profit_percent,
        custom_overhead_percent: parentQuote.custom_overhead_percent,
        custom_contingency_percent: parentQuote.custom_contingency_percent,
      },
    });

    this.logger.log(`Created change order ${coNumber} for parent quote ${parentQuote.quote_number}`);

    return {
      id: changeOrder.id,
      quote_number: changeOrder.quote_number,
      title: changeOrder.title,
      status: changeOrder.status,
      total: parseFloat(changeOrder.total?.toString() || '0'),
      created_at: changeOrder.created_at.toISOString(),
    };
  }

  /**
   * List change orders for parent quote
   *
   * @param tenantId - Tenant ID
   * @param parentQuoteId - Parent quote UUID
   * @returns Array of change orders
   */
  async listChangeOrders(tenantId: string, parentQuoteId: string) {
    // Find all quotes with parent reference in private notes
    const allQuotes = await this.prisma.quote.findMany({
      where: {
        tenant_id: tenantId,
        quote_number: { startsWith: 'CO-' },
      },
    });

    const changeOrders = allQuotes.filter(
      (q) => this.extractParentQuoteId(q.private_notes) === parentQuoteId,
    );

    return {
      change_orders: changeOrders.map((co) => ({
        id: co.id,
        quote_number: co.quote_number,
        title: co.title,
        status: co.status,
        total: parseFloat(co.total?.toString() || '0'),
        created_at: co.created_at.toISOString(),
      })),
      total_count: changeOrders.length,
    };
  }

  /**
   * Get total impact of change orders
   *
   * @param tenantId - Tenant ID
   * @param parentQuoteId - Parent quote UUID
   * @returns Impact summary (original, change orders total, revised total)
   */
  async getTotalImpact(tenantId: string, parentQuoteId: string) {
    const parentQuote = await this.prisma.quote.findFirst({
      where: {
        id: parentQuoteId,
        tenant_id: tenantId,
      },
    });

    if (!parentQuote) {
      throw new NotFoundException(`Parent quote ${parentQuoteId} not found`);
    }

    const changeOrdersList = await this.listChangeOrders(tenantId, parentQuoteId);

    const approvedCOs = changeOrdersList.change_orders.filter((co) => co.status === 'approved');
    const pendingCOs = changeOrdersList.change_orders.filter((co) => co.status !== 'approved');

    const changeOrdersTotal = approvedCOs.reduce((sum, co) => sum + co.total, 0);
    const originalTotal = parseFloat(parentQuote.total?.toString() || '0');

    return {
      parent_quote_id: parentQuoteId,
      original_total: originalTotal,
      change_orders_total: changeOrdersTotal,
      revised_total: originalTotal + changeOrdersTotal,
      change_order_count: changeOrdersList.total_count,
      approved_count: approvedCOs.length,
      pending_count: pendingCOs.length,
    };
  }

  /**
   * Approve change order
   *
   * @param tenantId - Tenant ID
   * @param userId - User approving
   * @param changeOrderId - Change order UUID
   * @returns Approved change order
   */
  async approveChangeOrder(tenantId: string, userId: string, changeOrderId: string) {
    const changeOrder = await this.prisma.quote.findFirst({
      where: {
        id: changeOrderId,
        tenant_id: tenantId,
      },
    });

    if (!changeOrder) {
      throw new NotFoundException(`Change order ${changeOrderId} not found`);
    }

    if (!changeOrder.quote_number.startsWith('CO-')) {
      throw new BadRequestException('This quote is not a change order');
    }

    const updated = await this.prisma.quote.update({
      where: { id: changeOrderId },
      data: { status: 'approved' },
    });

    this.logger.log(`Change order ${changeOrder.quote_number} approved by user ${userId}`);

    return {
      id: updated.id,
      quote_number: updated.quote_number,
      title: updated.title,
      status: updated.status,
      total: parseFloat(updated.total?.toString() || '0'),
      created_at: updated.created_at.toISOString(),
    };
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
   * @returns Timeline of changes
   */
  async getHistory(tenantId: string, parentQuoteId: string) {
    const changeOrdersList = await this.listChangeOrders(tenantId, parentQuoteId);

    const timeline = changeOrdersList.change_orders.map((co) => ({
      id: co.id,
      event_type: co.status === 'approved' ? 'change_order_approved' : 'change_order_created',
      change_order_number: co.quote_number,
      description: co.title,
      amount: co.total,
      timestamp: co.created_at,
    }));

    // Sort by timestamp
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return {
      timeline,
      parent_quote_id: parentQuoteId,
    };
  }
}
