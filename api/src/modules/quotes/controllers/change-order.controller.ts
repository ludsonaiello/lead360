import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ChangeOrderService } from '../services/change-order.service';
import {
  CreateChangeOrderDto,
  ChangeOrderResponseDto,
  ListChangeOrdersResponseDto,
  ParentQuoteTotalsDto,
  ApproveChangeOrderDto,
  RejectChangeOrderDto,
} from '../dto/change-order';

/**
 * ChangeOrderController
 *
 * Change order management - proper implementation with parent_quote_id foreign key
 *
 * Endpoints:
 * - POST /quotes/:parentQuoteId/change-orders - Create change order
 * - GET /quotes/:parentQuoteId/change-orders - List change orders
 * - GET /quotes/:quoteId/with-change-orders - Get parent quote with aggregated totals
 * - POST /change-orders/:id/approve - Approve change order
 * - POST /change-orders/:id/reject - Reject change order
 * - POST /change-orders/:id/link-to-project - Link to project (placeholder)
 * - GET /quotes/:parentQuoteId/change-orders/history - Get history timeline
 *
 * @author Developer 5 (Rebuilt)
 */
@ApiTags('Quotes - Change Orders')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChangeOrderController {
  private readonly logger = new Logger(ChangeOrderController.name);

  constructor(private readonly changeOrderService: ChangeOrderService) {}

  @Post('quotes/:parentQuoteId/change-orders')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create change order from approved quote',
    description: 'Creates a new change order linked to an approved parent quote. Inherits customer, vendor, and jobsite unless overridden.',
  })
  @ApiParam({ name: 'parentQuoteId', description: 'Parent quote UUID' })
  @ApiResponse({ status: 201, description: 'Change order created', type: ChangeOrderResponseDto })
  @ApiResponse({ status: 400, description: 'Parent quote not in valid status (must be approved, started, or concluded)' })
  @ApiResponse({ status: 404, description: 'Parent quote not found' })
  async createChangeOrder(
    @Param('parentQuoteId', ParseUUIDPipe) parentQuoteId: string,
    @Body() dto: CreateChangeOrderDto,
    @Request() req,
  ): Promise<ChangeOrderResponseDto> {
    const tenantId = req.user.tenant_id;
    const userId = req.user.user_id;

    return await this.changeOrderService.createChangeOrder(tenantId, userId, parentQuoteId, dto);
  }

  @Get('quotes/:parentQuoteId/change-orders')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Field')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all change orders for parent quote',
    description: 'Returns all change orders linked to a parent quote with summary statistics (approved, pending, rejected counts).',
  })
  @ApiParam({ name: 'parentQuoteId', description: 'Parent quote UUID' })
  @ApiResponse({ status: 200, description: 'Change orders list with summary', type: ListChangeOrdersResponseDto })
  @ApiResponse({ status: 404, description: 'Parent quote not found' })
  async listChangeOrders(
    @Param('parentQuoteId', ParseUUIDPipe) parentQuoteId: string,
    @Request() req,
  ): Promise<ListChangeOrdersResponseDto> {
    const tenantId = req.user.tenant_id;

    return await this.changeOrderService.listChangeOrders(tenantId, parentQuoteId);
  }

  @Get('quotes/:quoteId/with-change-orders')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Field')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get parent quote with aggregated change order totals',
    description: 'Returns parent quote totals with breakdown of approved and pending change orders. Shows original total, approved COs, pending COs, and revised total.',
  })
  @ApiParam({ name: 'quoteId', description: 'Parent quote UUID' })
  @ApiResponse({ status: 200, description: 'Parent quote totals with change order aggregation', type: ParentQuoteTotalsDto })
  @ApiResponse({ status: 404, description: 'Parent quote not found' })
  async getParentQuoteTotals(
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Request() req,
  ): Promise<ParentQuoteTotalsDto> {
    const tenantId = req.user.tenant_id;

    return await this.changeOrderService.getParentQuoteTotals(tenantId, quoteId);
  }

  @Post('change-orders/:id/approve')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve change order',
    description: 'Approves a change order and updates the revised total for the parent quote. Creates a version snapshot and audit log entry.',
  })
  @ApiParam({ name: 'id', description: 'Change order UUID' })
  @ApiResponse({ status: 200, description: 'Change order approved with revised parent total', type: ChangeOrderResponseDto })
  @ApiResponse({ status: 400, description: 'Change order not in valid status or not a change order' })
  @ApiResponse({ status: 404, description: 'Change order not found' })
  async approveChangeOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveChangeOrderDto,
    @Request() req,
  ): Promise<ChangeOrderResponseDto> {
    const tenantId = req.user.tenant_id;
    const userId = req.user.user_id;

    return await this.changeOrderService.approveChangeOrder(tenantId, userId, id, dto);
  }

  @Post('change-orders/:id/reject')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject change order',
    description: 'Rejects a change order with a required reason. Updates status to denied and creates audit log entry with rejection reason.',
  })
  @ApiParam({ name: 'id', description: 'Change order UUID' })
  @ApiResponse({ status: 200, description: 'Change order rejected', type: ChangeOrderResponseDto })
  @ApiResponse({ status: 400, description: 'Not a change order or rejection reason missing/invalid' })
  @ApiResponse({ status: 404, description: 'Change order not found' })
  async rejectChangeOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectChangeOrderDto,
    @Request() req,
  ): Promise<ChangeOrderResponseDto> {
    const tenantId = req.user.tenant_id;
    const userId = req.user.user_id;

    return await this.changeOrderService.rejectChangeOrder(tenantId, userId, id, dto);
  }

  @Post('change-orders/:id/link-to-project')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Link change order to project (placeholder)' })
  @ApiParam({ name: 'id', description: 'Change order UUID' })
  @ApiResponse({ status: 200, description: 'Success message' })
  async linkToProject(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const tenantId = req.user.tenant_id;

    return await this.changeOrderService.linkToProject(tenantId, id);
  }

  @Get('quotes/:parentQuoteId/change-orders/history')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Field')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get change order history timeline',
    description: 'Returns timeline of all change order events (created, approved, rejected) sorted chronologically.',
  })
  @ApiParam({ name: 'parentQuoteId', description: 'Parent quote UUID' })
  @ApiResponse({
    status: 200,
    description: 'History timeline with events',
    schema: {
      type: 'object',
      properties: {
        timeline: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              event_type: { type: 'string', enum: ['change_order_created', 'change_order_approved', 'change_order_rejected'] },
              change_order_number: { type: 'string' },
              description: { type: 'string' },
              amount: { type: 'number' },
              timestamp: { type: 'string' },
              status: { type: 'string' },
            },
          },
        },
        parent_quote_id: { type: 'string' },
        parent_quote_number: { type: 'string' },
        total_events: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Parent quote not found' })
  async getHistory(
    @Param('parentQuoteId', ParseUUIDPipe) parentQuoteId: string,
    @Request() req,
  ) {
    const tenantId = req.user.tenant_id;

    return await this.changeOrderService.getHistory(tenantId, parentQuoteId);
  }
}
