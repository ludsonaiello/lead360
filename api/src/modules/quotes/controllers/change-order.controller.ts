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
  ChangeOrderDto,
  ListChangeOrdersResponseDto,
  ChangeOrderImpactDto,
  ChangeOrderHistoryResponseDto,
} from '../dto/change-order';

/**
 * ChangeOrderController
 *
 * Change order management (6 endpoints)
 *
 * @author Developer 5
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
  @ApiOperation({ summary: 'Create change order' })
  @ApiParam({ name: 'parentQuoteId', description: 'Parent quote UUID' })
  @ApiResponse({ status: 201, description: 'Change order created', type: ChangeOrderDto })
  @ApiResponse({ status: 400, description: 'Parent quote not approved' })
  async createChangeOrder(
    @Param('parentQuoteId', ParseUUIDPipe) parentQuoteId: string,
    @Body() dto: CreateChangeOrderDto,
    @Request() req,
  ): Promise<ChangeOrderDto> {
    const tenantId = req.user.tenant_id;
    const userId = req.user.user_id;

    return await this.changeOrderService.createChangeOrder(tenantId, userId, parentQuoteId, dto);
  }

  @Get('quotes/:parentQuoteId/change-orders')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Field')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List change orders for quote' })
  @ApiParam({ name: 'parentQuoteId', description: 'Parent quote UUID' })
  @ApiResponse({ status: 200, description: 'Change orders returned', type: ListChangeOrdersResponseDto })
  async listChangeOrders(
    @Param('parentQuoteId', ParseUUIDPipe) parentQuoteId: string,
    @Request() req,
  ): Promise<ListChangeOrdersResponseDto> {
    const tenantId = req.user.tenant_id;

    return await this.changeOrderService.listChangeOrders(tenantId, parentQuoteId);
  }

  @Get('quotes/:parentQuoteId/change-orders/total-impact')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Field')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get total impact of change orders' })
  @ApiParam({ name: 'parentQuoteId', description: 'Parent quote UUID' })
  @ApiResponse({ status: 200, description: 'Total impact returned', type: ChangeOrderImpactDto })
  async getTotalImpact(
    @Param('parentQuoteId', ParseUUIDPipe) parentQuoteId: string,
    @Request() req,
  ): Promise<ChangeOrderImpactDto> {
    const tenantId = req.user.tenant_id;

    return await this.changeOrderService.getTotalImpact(tenantId, parentQuoteId);
  }

  @Post('change-orders/:id/approve')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve change order' })
  @ApiParam({ name: 'id', description: 'Change order UUID' })
  @ApiResponse({ status: 200, description: 'Change order approved', type: ChangeOrderDto })
  async approveChangeOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ): Promise<ChangeOrderDto> {
    const tenantId = req.user.tenant_id;
    const userId = req.user.user_id;

    return await this.changeOrderService.approveChangeOrder(tenantId, userId, id);
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
  @ApiOperation({ summary: 'Get change order history timeline' })
  @ApiParam({ name: 'parentQuoteId', description: 'Parent quote UUID' })
  @ApiResponse({ status: 200, description: 'History timeline returned', type: ChangeOrderHistoryResponseDto })
  async getHistory(
    @Param('parentQuoteId', ParseUUIDPipe) parentQuoteId: string,
    @Request() req,
  ): Promise<ChangeOrderHistoryResponseDto> {
    const tenantId = req.user.tenant_id;

    return await this.changeOrderService.getHistory(tenantId, parentQuoteId);
  }
}
