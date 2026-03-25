import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
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
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ProjectInvoiceService } from '../services/project-invoice.service';
import { CreateProjectInvoiceDto } from '../dto/create-project-invoice.dto';
import { UpdateProjectInvoiceDto } from '../dto/update-project-invoice.dto';
import { RecordInvoicePaymentDto } from '../dto/record-invoice-payment.dto';
import { VoidInvoiceDto } from '../dto/void-invoice.dto';
import { ListProjectInvoicesDto } from '../dto/list-project-invoices.dto';

/** Typed request shape after JwtAuthGuard populates req.user. */
interface AuthenticatedRequest {
  user: { tenant_id: string; id: string; role: string };
}

@ApiTags('Project Invoices')
@ApiBearerAuth()
@Controller('projects/:projectId/invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectInvoiceController {
  constructor(private readonly projectInvoiceService: ProjectInvoiceService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // GET /projects/:projectId/invoices
  // ───────────────────────────────────────────────────────────────────────────

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'List invoices for a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'sent', 'partial', 'paid', 'voided'] })
  @ApiQuery({ name: 'date_from', required: false, description: 'Filter by created_at from (ISO date)' })
  @ApiQuery({ name: 'date_to', required: false, description: 'Filter by created_at to (ISO date)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated list of invoices' })
  async findByProject(
    @Request() req: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ListProjectInvoicesDto,
  ) {
    return this.projectInvoiceService.findByProject(
      req.user.tenant_id,
      projectId,
      query,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POST /projects/:projectId/invoices
  // ───────────────────────────────────────────────────────────────────────────

  @Post()
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an invoice manually' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiBody({ type: CreateProjectInvoiceDto })
  @ApiResponse({ status: 201, description: 'Invoice created with status draft' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateProjectInvoiceDto,
  ) {
    return this.projectInvoiceService.create(
      req.user.tenant_id,
      projectId,
      req.user.id,
      dto,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GET /projects/:projectId/invoices/:id
  // ───────────────────────────────────────────────────────────────────────────

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Get a single invoice with payments' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({ status: 200, description: 'Invoice with payments and milestone details' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async findOne(
    @Request() req: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectInvoiceService.findOne(
      req.user.tenant_id,
      projectId,
      id,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PATCH /projects/:projectId/invoices/:id
  // ───────────────────────────────────────────────────────────────────────────

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Update a draft invoice' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiBody({ type: UpdateProjectInvoiceDto })
  @ApiResponse({ status: 200, description: 'Invoice updated' })
  @ApiResponse({ status: 400, description: 'Invoice is not in draft status' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectInvoiceDto,
  ) {
    return this.projectInvoiceService.update(
      req.user.tenant_id,
      projectId,
      id,
      req.user.id,
      dto,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POST /projects/:projectId/invoices/:id/send
  // ───────────────────────────────────────────────────────────────────────────

  @Post(':id/send')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark invoice as sent' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({ status: 200, description: 'Invoice marked as sent' })
  @ApiResponse({ status: 400, description: 'Invoice is not in draft status' })
  async markSent(
    @Request() req: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectInvoiceService.markSent(
      req.user.tenant_id,
      projectId,
      id,
      req.user.id,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POST /projects/:projectId/invoices/:id/void
  // ───────────────────────────────────────────────────────────────────────────

  @Post(':id/void')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Void an invoice' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiBody({ type: VoidInvoiceDto })
  @ApiResponse({ status: 200, description: 'Invoice voided, linked milestone reset to pending' })
  @ApiResponse({ status: 400, description: 'Invoice is already voided or reason missing' })
  async voidInvoice(
    @Request() req: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidInvoiceDto,
  ) {
    return this.projectInvoiceService.voidInvoice(
      req.user.tenant_id,
      projectId,
      id,
      req.user.id,
      dto,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POST /projects/:projectId/invoices/:id/payments
  // ───────────────────────────────────────────────────────────────────────────

  @Post(':id/payments')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Record a payment against an invoice' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiBody({ type: RecordInvoicePaymentDto })
  @ApiResponse({ status: 201, description: 'Payment recorded, invoice updated atomically' })
  @ApiResponse({ status: 400, description: 'Payment exceeds amount due or invoice is voided' })
  async recordPayment(
    @Request() req: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordInvoicePaymentDto,
  ) {
    return this.projectInvoiceService.recordPayment(
      req.user.tenant_id,
      projectId,
      id,
      req.user.id,
      dto,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // GET /projects/:projectId/invoices/:id/payments
  // ───────────────────────────────────────────────────────────────────────────

  @Get(':id/payments')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'List payments for an invoice' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({ status: 200, description: 'List of payments ordered by payment_date' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async getPayments(
    @Request() req: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectInvoiceService.getPayments(
      req.user.tenant_id,
      projectId,
      id,
    );
  }
}
