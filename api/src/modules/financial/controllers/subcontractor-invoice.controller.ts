import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SubcontractorInvoiceService } from '../services/subcontractor-invoice.service';
import { CreateSubcontractorInvoiceDto } from '../dto/create-subcontractor-invoice.dto';
import { UpdateSubcontractorInvoiceDto } from '../dto/update-subcontractor-invoice.dto';
import { ListSubcontractorInvoicesDto } from '../dto/list-subcontractor-invoices.dto';

@ApiTags('Subcontractor Invoices')
@ApiBearerAuth()
@Controller('financial')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubcontractorInvoiceController {
  constructor(
    private readonly subcontractorInvoiceService: SubcontractorInvoiceService,
  ) {}

  @Post('subcontractor-invoices')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create a subcontractor task invoice (with optional file upload)' })
  @ApiResponse({ status: 201, description: 'Invoice created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Subcontractor, project, or task not found' })
  @ApiResponse({ status: 409, description: 'Invoice number already exists' })
  async create(
    @Request() req,
    @Body() dto: CreateSubcontractorInvoiceDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.subcontractorInvoiceService.createInvoice(
      req.user.tenant_id,
      req.user.id,
      dto,
      file,
    );
  }

  @Get('subcontractor-invoices')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'List subcontractor invoices (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of invoices' })
  async findAll(@Request() req, @Query() query: ListSubcontractorInvoicesDto) {
    return this.subcontractorInvoiceService.listInvoices(
      req.user.tenant_id,
      query,
    );
  }

  @Patch('subcontractor-invoices/:id')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Update a subcontractor invoice (status, amount, notes)' })
  @ApiParam({ name: 'id', description: 'Invoice UUID' })
  @ApiResponse({ status: 200, description: 'Invoice updated' })
  @ApiResponse({ status: 400, description: 'Invalid status transition or amount update' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubcontractorInvoiceDto,
  ) {
    return this.subcontractorInvoiceService.updateInvoice(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }
}

@ApiTags('Task Invoices')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TaskInvoicesController {
  constructor(
    private readonly subcontractorInvoiceService: SubcontractorInvoiceService,
  ) {}

  @Get(':projectId/tasks/:taskId/invoices')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Get invoices for a specific task' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'List of invoices for the task' })
  async getTaskInvoices(
    @Request() req,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.subcontractorInvoiceService.getTaskInvoices(
      req.user.tenant_id,
      taskId,
    );
  }
}

/**
 * Sprint 30 — Subcontractor invoice listing on profile context.
 * GET /subcontractors/:id/invoices
 */
@ApiTags('Subcontractor Invoices')
@ApiBearerAuth()
@Controller('subcontractors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubcontractorInvoiceListController {
  constructor(
    private readonly subcontractorInvoiceService: SubcontractorInvoiceService,
  ) {}

  @Get(':id/invoices')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'List all invoices for a subcontractor',
    description:
      'Returns all subcontractor task invoices across all projects/tasks. ' +
      'Includes task and project details for context.',
  })
  @ApiParam({ name: 'id', description: 'Subcontractor UUID' })
  @ApiResponse({ status: 200, description: 'List of invoices for the subcontractor' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  async getSubcontractorInvoices(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.subcontractorInvoiceService.getSubcontractorInvoices(
      req.user.tenant_id,
      id,
    );
  }
}
