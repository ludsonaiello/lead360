import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ExportService } from '../services/export.service';
import { ExportExpenseQueryDto } from '../dto/export-expense-query.dto';
import { ExportInvoiceQueryDto } from '../dto/export-invoice-query.dto';
import { QualityReportQueryDto } from '../dto/quality-report-query.dto';
import { ExportHistoryQueryDto } from '../dto/export-history-query.dto';

@ApiTags('Financial Export')
@ApiBearerAuth()
@Controller('financial/export')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
  ) {}

  // ============================
  // QuickBooks Exports
  // ============================

  @Get('quickbooks/expenses')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Export expenses as QuickBooks CSV' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiResponse({ status: 400, description: 'Validation error or no matching records' })
  async exportQBExpenses(
    @Request() req,
    @Query() query: ExportExpenseQueryDto,
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportQBExpenses(
      req.user.tenant_id,
      req.user.id,
      query,
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.send(result.csv);
  }

  @Get('quickbooks/invoices')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Export invoices as QuickBooks CSV' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiResponse({ status: 400, description: 'Validation error or no matching records' })
  async exportQBInvoices(
    @Request() req,
    @Query() query: ExportInvoiceQueryDto,
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportQBInvoices(
      req.user.tenant_id,
      req.user.id,
      query,
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.send(result.csv);
  }

  // ============================
  // Xero Exports
  // ============================

  @Get('xero/expenses')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Export expenses as Xero CSV' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiResponse({ status: 400, description: 'Validation error or no matching records' })
  async exportXeroExpenses(
    @Request() req,
    @Query() query: ExportExpenseQueryDto,
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportXeroExpenses(
      req.user.tenant_id,
      req.user.id,
      query,
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.send(result.csv);
  }

  @Get('xero/invoices')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Export invoices as Xero CSV' })
  @ApiResponse({ status: 200, description: 'CSV file download' })
  @ApiResponse({ status: 400, description: 'Validation error or no matching records' })
  async exportXeroInvoices(
    @Request() req,
    @Query() query: ExportInvoiceQueryDto,
    @Res() res: Response,
  ) {
    const result = await this.exportService.exportXeroInvoices(
      req.user.tenant_id,
      req.user.id,
      query,
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.send(result.csv);
  }

  // ============================
  // Quality Report
  // ============================

  @Get('quality-report')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Data quality report for export readiness' })
  @ApiResponse({ status: 200, description: 'Quality report with issues and readiness scores' })
  async getQualityReport(
    @Request() req,
    @Query() query: QualityReportQueryDto,
  ) {
    return this.exportService.getQualityReport(
      req.user.tenant_id,
      query,
    );
  }

  // ============================
  // Export History
  // ============================

  @Get('history')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Export history log (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of export records' })
  async getExportHistory(
    @Request() req,
    @Query() query: ExportHistoryQueryDto,
  ) {
    return this.exportService.getExportHistory(
      req.user.tenant_id,
      query,
    );
  }
}
