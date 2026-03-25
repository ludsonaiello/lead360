import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
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
  ApiProduces,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { FinancialEntryService } from '../services/financial-entry.service';
import { CreateFinancialEntryDto } from '../dto/create-financial-entry.dto';
import { UpdateFinancialEntryDto } from '../dto/update-financial-entry.dto';
import { ListFinancialEntriesQueryDto } from '../dto/list-financial-entries-query.dto';
import { ListPendingEntriesQueryDto } from '../dto/list-pending-entries-query.dto';
import { ApproveEntryDto } from '../dto/approve-entry.dto';
import { RejectEntryDto } from '../dto/reject-entry.dto';
import { ResubmitEntryDto } from '../dto/resubmit-entry.dto';

@ApiTags('Financial Entries')
@ApiBearerAuth()
@Controller('financial')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinancialEntryController {
  constructor(
    private readonly financialEntryService: FinancialEntryService,
  ) {}

  // ===========================================================================
  // Route 1 — POST /financial/entries (Create)
  // ===========================================================================

  @Post('entries')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee')
  @ApiOperation({ summary: 'Create a financial entry' })
  @ApiResponse({ status: 201, description: 'Entry created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Referenced entity not found' })
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req, @Body() dto: CreateFinancialEntryDto) {
    return this.financialEntryService.createEntry(
      req.user.tenant_id,
      req.user.id,
      req.user.roles,
      dto,
    );
  }

  // ===========================================================================
  // Route 2 — GET /financial/entries (List — paginated, filtered)
  // ===========================================================================

  @Get('entries')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee')
  @ApiOperation({ summary: 'List financial entries (paginated, filtered)' })
  @ApiResponse({ status: 200, description: 'Paginated list with summary' })
  async findAll(@Request() req, @Query() query: ListFinancialEntriesQueryDto) {
    return this.financialEntryService.getEntries(
      req.user.tenant_id,
      req.user.id,
      req.user.roles,
      query,
    );
  }

  // ===========================================================================
  // Route 3 — GET /financial/entries/pending (Pending List)
  // CRITICAL: Must appear BEFORE GET /financial/entries/:id
  // ===========================================================================

  @Get('entries/pending')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'List pending review entries' })
  @ApiResponse({ status: 200, description: 'Paginated list of pending entries' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async findPending(@Request() req, @Query() query: ListPendingEntriesQueryDto) {
    return this.financialEntryService.getPendingEntries(
      req.user.tenant_id,
      query,
    );
  }

  // ===========================================================================
  // Route 4 — GET /financial/entries/export (CSV Export)
  // CRITICAL: Must appear BEFORE GET /financial/entries/:id
  // ===========================================================================

  @Get('entries/export')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Export financial entries as CSV' })
  @ApiProduces('text/csv')
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiResponse({ status: 400, description: 'Export limit exceeded' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async exportCsv(
    @Request() req,
    @Query() query: ListFinancialEntriesQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.financialEntryService.exportEntries(
      req.user.tenant_id,
      req.user.id,
      req.user.roles,
      query,
    );

    const today = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="expenses-${today}.csv"`);
    res.send(csv);
  }

  // ===========================================================================
  // Route 5 — GET /financial/entries/:id (Get Single)
  // ===========================================================================

  @Get('entries/:id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee')
  @ApiOperation({ summary: 'Get a single financial entry' })
  @ApiParam({ name: 'id', description: 'Entry UUID' })
  @ApiResponse({ status: 200, description: 'Entry details (enriched)' })
  @ApiResponse({ status: 403, description: 'Access denied (Employee accessing other user entry)' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  async findOne(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.financialEntryService.getEntryById(
      req.user.tenant_id,
      id,
      req.user.id,
      req.user.roles,
    );
  }

  // ===========================================================================
  // Route 6 — PATCH /financial/entries/:id (Update)
  // ===========================================================================

  @Patch('entries/:id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee')
  @ApiOperation({ summary: 'Update a financial entry' })
  @ApiParam({ name: 'id', description: 'Entry UUID' })
  @ApiResponse({ status: 200, description: 'Entry updated (enriched)' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinancialEntryDto,
  ) {
    return this.financialEntryService.updateEntry(
      req.user.tenant_id,
      id,
      req.user.id,
      req.user.roles,
      dto,
    );
  }

  // ===========================================================================
  // Route 7 — DELETE /financial/entries/:id (Delete)
  // ===========================================================================

  @Delete('entries/:id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee')
  @ApiOperation({ summary: 'Delete a financial entry' })
  @ApiParam({ name: 'id', description: 'Entry UUID' })
  @ApiResponse({ status: 200, description: 'Entry deleted' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  async delete(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.financialEntryService.deleteEntry(
      req.user.tenant_id,
      id,
      req.user.id,
      req.user.roles,
    );
  }

  // ===========================================================================
  // Route 8 — POST /financial/entries/:id/approve (Approve)
  // ===========================================================================

  @Post('entries/:id/approve')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Approve a pending financial entry' })
  @ApiParam({ name: 'id', description: 'Entry UUID' })
  @ApiResponse({ status: 200, description: 'Entry approved (enriched)' })
  @ApiResponse({ status: 400, description: 'Entry is not in pending status' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  @HttpCode(HttpStatus.OK)
  async approve(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveEntryDto,
  ) {
    return this.financialEntryService.approveEntry(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }

  // ===========================================================================
  // Route 9 — POST /financial/entries/:id/reject (Reject)
  // ===========================================================================

  @Post('entries/:id/reject')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Reject a pending financial entry' })
  @ApiParam({ name: 'id', description: 'Entry UUID' })
  @ApiResponse({ status: 200, description: 'Entry rejected (enriched)' })
  @ApiResponse({ status: 400, description: 'Entry is not in pending status or reason missing' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  @HttpCode(HttpStatus.OK)
  async reject(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectEntryDto,
  ) {
    return this.financialEntryService.rejectEntry(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }

  // ===========================================================================
  // Route 10 — POST /financial/entries/:id/resubmit (Resubmit)
  // ===========================================================================

  @Post('entries/:id/resubmit')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee')
  @ApiOperation({ summary: 'Resubmit a rejected financial entry' })
  @ApiParam({ name: 'id', description: 'Entry UUID' })
  @ApiResponse({ status: 200, description: 'Entry resubmitted (enriched)' })
  @ApiResponse({ status: 400, description: 'Entry was not rejected' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  @HttpCode(HttpStatus.OK)
  async resubmit(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResubmitEntryDto,
  ) {
    return this.financialEntryService.resubmitEntry(
      req.user.tenant_id,
      id,
      req.user.id,
      req.user.roles,
      dto,
    );
  }
}
