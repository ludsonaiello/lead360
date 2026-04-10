import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SubcontractorPaymentService } from '../services/subcontractor-payment.service';
import { SubcontractorInvoiceService } from '../services/subcontractor-invoice.service';
import { CreateSubcontractorPaymentDto } from '../dto/create-subcontractor-payment.dto';
import { UpdateSubcontractorPaymentDto } from '../dto/update-subcontractor-payment.dto';
import { ListSubcontractorPaymentsDto } from '../dto/list-subcontractor-payments.dto';

@ApiTags('Subcontractor Payments')
@ApiBearerAuth()
@Controller('financial')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubcontractorPaymentController {
  constructor(
    private readonly subcontractorPaymentService: SubcontractorPaymentService,
  ) {}

  @Post('subcontractor-payments')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Create a subcontractor payment record' })
  @ApiResponse({ status: 201, description: 'Payment created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Subcontractor not found' })
  async create(@Request() req, @Body() dto: CreateSubcontractorPaymentDto) {
    return this.subcontractorPaymentService.createPayment(
      req.user.tenant_id,
      req.user.id,
      dto.subcontractor_id,
      dto,
    );
  }

  @Get('subcontractor-payments')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'List subcontractor payments (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of subcontractor payments' })
  async findAll(@Request() req, @Query() query: ListSubcontractorPaymentsDto) {
    return this.subcontractorPaymentService.listPayments(
      req.user.tenant_id,
      query,
    );
  }

  @Patch('subcontractor-payments/:id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Update a subcontractor payment record' })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiResponse({ status: 200, description: 'Payment updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubcontractorPaymentDto,
  ) {
    return this.subcontractorPaymentService.updatePayment(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }

  @Delete('subcontractor-payments/:id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete a subcontractor payment record' })
  @ApiParam({ name: 'id', description: 'Payment UUID' })
  @ApiResponse({ status: 200, description: 'Payment deleted successfully' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async delete(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.subcontractorPaymentService.deletePayment(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }
}

@ApiTags('Subcontractor Payment History')
@ApiBearerAuth()
@Controller('subcontractors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubcontractorPaymentHistoryController {
  constructor(
    private readonly subcontractorPaymentService: SubcontractorPaymentService,
  ) {}

  @Get(':subcontractorId/payment-history')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Get payment history for a subcontractor' })
  @ApiParam({ name: 'subcontractorId', description: 'Subcontractor UUID' })
  @ApiResponse({ status: 200, description: 'Paginated payment history' })
  async getPaymentHistory(
    @Request() req,
    @Param('subcontractorId', ParseUUIDPipe) subcontractorId: string,
    @Query() query: ListSubcontractorPaymentsDto,
  ) {
    return this.subcontractorPaymentService.getPaymentHistory(
      req.user.tenant_id,
      subcontractorId,
      query,
    );
  }
}

/**
 * Sprint 30 — Subcontractor payment summary (combined invoice + payment aggregation).
 * GET /subcontractors/:id/payment-summary
 */
@ApiTags('Subcontractor Payment Summary')
@ApiBearerAuth()
@Controller('subcontractors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubcontractorPaymentSummaryController {
  constructor(
    private readonly subcontractorPaymentService: SubcontractorPaymentService,
    private readonly subcontractorInvoiceService: SubcontractorInvoiceService,
  ) {}

  @Get(':id/payment-summary')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'Get payment summary for a subcontractor',
    description:
      'Returns aggregated financial summary combining invoice totals by status ' +
      'and total payments made. Provides a complete financial profile for the subcontractor.',
  })
  @ApiParam({ name: 'id', description: 'Subcontractor UUID' })
  @ApiResponse({
    status: 200,
    description: 'Subcontractor payment summary',
    schema: {
      type: 'object',
      properties: {
        subcontractor_id: { type: 'string', format: 'uuid' },
        total_invoiced: { type: 'number', example: 15000.0 },
        total_paid: { type: 'number', example: 10000.0 },
        total_pending: { type: 'number', example: 3000.0 },
        total_approved: { type: 'number', example: 2000.0 },
        invoices_count: { type: 'number', example: 5 },
        payments_count: { type: 'number', example: 3 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Subcontractor not found' })
  async getPaymentSummary(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const [invoiceAgg, paymentAgg] = await Promise.all([
      this.subcontractorInvoiceService.getInvoiceAggregation(
        req.user.tenant_id,
        id,
      ),
      this.subcontractorPaymentService.getTotalPaid(
        req.user.tenant_id,
        id,
      ),
    ]);

    return {
      subcontractor_id: id,
      total_invoiced: invoiceAgg.total_invoiced,
      total_paid: paymentAgg.total_paid,
      total_pending: invoiceAgg.total_pending,
      total_approved: invoiceAgg.total_approved,
      invoices_count: invoiceAgg.invoices_count,
      payments_count: paymentAgg.payment_count,
    };
  }
}
