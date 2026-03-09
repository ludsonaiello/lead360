import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SmsExportService } from '../services/sms-export.service';
import type { Response } from 'express';
import * as path from 'path';

/**
 * SMS Export Controller
 *
 * Provides SMS data export capabilities:
 * - CSV export for raw SMS history
 * - Excel export for analytics (Summary, Trends, Failures)
 *
 * RBAC: Export data (Owner, Admin, Manager)
 * Multi-tenant: All exports filtered by tenant_id from JWT
 *
 * Files are:
 * - Generated on-demand (not pre-generated)
 * - Stored temporarily in /var/www/lead360.app/api/exports
 * - Automatically deleted after 24 hours
 * - Downloaded immediately via streaming response
 */
@ApiTags('Communication - SMS Export')
@Controller('communication/sms/export')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SmsExportController {
  constructor(private readonly exportService: SmsExportService) {}

  @Get('csv')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Export SMS history to CSV',
    description:
      'Export raw SMS message history to CSV format. Includes all SMS messages (sent, delivered, failed) within the specified date range. Default date range: last 30 days.',
  })
  @ApiQuery({
    name: 'start_date',
    required: false,
    type: String,
    description:
      'Start date (ISO 8601 format, e.g., 2026-01-01). Default: 30 days ago',
    example: '2026-01-01',
  })
  @ApiQuery({
    name: 'end_date',
    required: false,
    type: String,
    description: 'End date (ISO 8601 format, e.g., 2026-02-13). Default: today',
    example: '2026-02-13',
  })
  @ApiResponse({
    status: 200,
    description:
      'CSV file downloaded successfully (Content-Type: text/csv; charset=utf-8)',
    headers: {
      'Content-Disposition': {
        description: 'Attachment with filename',
        schema: {
          type: 'string',
          example:
            'attachment; filename=sms_export_tenant-123_1707820800000.csv',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid date format or date range',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during export generation',
  })
  async exportCsv(
    @Request() req,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Res() res?: Response,
  ) {
    const tenantId = req.user.tenant_id;

    // Default: last 30 days
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Validate dates
    if (isNaN(start.getTime())) {
      throw new BadRequestException(
        'Invalid start_date format. Use ISO 8601 format (e.g., 2026-01-01)',
      );
    }
    if (isNaN(end.getTime())) {
      throw new BadRequestException(
        'Invalid end_date format. Use ISO 8601 format (e.g., 2026-02-13)',
      );
    }
    if (start > end) {
      throw new BadRequestException(
        'start_date must be before or equal to end_date',
      );
    }

    // Generate CSV export
    const filename = await this.exportService.exportToCsv(tenantId, start, end);
    const filepath = path.join('/var/www/lead360.app/api/exports', filename);

    // Stream file to client
    res!.download(filepath, filename, (err) => {
      if (err) {
        console.error('Error downloading CSV file:', err);
        // Note: Error handling here is limited because headers may already be sent
      }
    });
  }

  @Get('excel')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Export SMS analytics to Excel',
    description:
      'Export SMS analytics to Excel format with 3 sheets: Summary (key metrics), Daily Trends (daily breakdown), and Failures (error code breakdown). Default date range: last 30 days.',
  })
  @ApiQuery({
    name: 'start_date',
    required: false,
    type: String,
    description: 'Start date (ISO 8601 format). Default: 30 days ago',
    example: '2026-01-01',
  })
  @ApiQuery({
    name: 'end_date',
    required: false,
    type: String,
    description: 'End date (ISO 8601 format). Default: today',
    example: '2026-02-13',
  })
  @ApiResponse({
    status: 200,
    description:
      'Excel file downloaded successfully (Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)',
    headers: {
      'Content-Disposition': {
        description: 'Attachment with filename',
        schema: {
          type: 'string',
          example:
            'attachment; filename=sms_analytics_tenant-123_1707820800000.xlsx',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid date format or date range',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error during export generation',
  })
  async exportExcel(
    @Request() req,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Res() res?: Response,
  ) {
    const tenantId = req.user.tenant_id;

    // Default: last 30 days
    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Validate dates
    if (isNaN(start.getTime())) {
      throw new BadRequestException(
        'Invalid start_date format. Use ISO 8601 format (e.g., 2026-01-01)',
      );
    }
    if (isNaN(end.getTime())) {
      throw new BadRequestException(
        'Invalid end_date format. Use ISO 8601 format (e.g., 2026-02-13)',
      );
    }
    if (start > end) {
      throw new BadRequestException(
        'start_date must be before or equal to end_date',
      );
    }

    // Generate Excel export
    const filename = await this.exportService.exportToExcel(
      tenantId,
      start,
      end,
    );
    const filepath = path.join('/var/www/lead360.app/api/exports', filename);

    // Stream file to client
    res!.download(filepath, filename, (err) => {
      if (err) {
        console.error('Error downloading Excel file:', err);
        // Note: Error handling here is limited because headers may already be sent
      }
    });
  }
}
