import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Request,
  StreamableFile,
  Header,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { ExportService } from '../services/export.service';
import { PrismaService } from '../../../core/database/prisma.service';
import * as fs from 'fs';

@ApiTags('Admin - Data Exports')
@ApiBearerAuth()
@Controller('admin/exports')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class ExportsController {
  constructor(
    private readonly exportService: ExportService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * POST /admin/exports/tenants
   * Queue tenant export job
   */
  @Post('tenants')
  @ApiOperation({
    summary: 'Export tenants',
    description:
      'Queue export job for tenants data. Returns job ID for polling status.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['format'],
      properties: {
        format: { type: 'string', enum: ['csv', 'pdf'], example: 'csv' },
        filters: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['active', 'suspended', 'deleted'],
            },
            created_from: { type: 'string', format: 'date-time' },
            created_to: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Export job queued successfully',
    schema: {
      type: 'object',
      properties: {
        export_job_id: { type: 'string', example: 'abc123' },
        status: { type: 'string', example: 'pending' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async exportTenants(
    @Request() req,
    @Body() body: { format: string; filters?: any },
  ) {
    return this.exportService.exportTenants(
      body.filters || {},
      body.format,
      req.user.id,
    );
  }

  /**
   * POST /admin/exports/users
   * Queue user export job
   */
  @Post('users')
  @ApiOperation({
    summary: 'Export users',
    description:
      'Queue export job for users data. Returns job ID for polling status.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['format'],
      properties: {
        format: { type: 'string', enum: ['csv', 'pdf'], example: 'csv' },
        filters: {
          type: 'object',
          properties: {
            tenant_id: { type: 'string' },
            is_active: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Export job queued successfully',
    schema: {
      type: 'object',
      properties: {
        export_job_id: { type: 'string', example: 'abc123' },
        status: { type: 'string', example: 'pending' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async exportUsers(
    @Request() req,
    @Body() body: { format: string; filters?: any },
  ) {
    return this.exportService.exportUsers(
      body.filters || {},
      body.format,
      req.user.id,
    );
  }

  /**
   * POST /admin/exports/audit-logs
   * Queue audit logs export job
   */
  @Post('audit-logs')
  @ApiOperation({
    summary: 'Export audit logs',
    description:
      'Queue export job for audit logs. Returns job ID for polling status. Max 1000 rows.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['format'],
      properties: {
        format: { type: 'string', enum: ['csv', 'pdf'], example: 'csv' },
        filters: {
          type: 'object',
          properties: {
            tenant_id: { type: 'string' },
            entity_type: { type: 'string' },
            action_type: { type: 'string' },
            created_from: { type: 'string', format: 'date-time' },
            created_to: { type: 'string', format: 'date-time' },
            limit: { type: 'number', example: 1000, maximum: 1000 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Export job queued successfully',
    schema: {
      type: 'object',
      properties: {
        export_job_id: { type: 'string', example: 'abc123' },
        status: { type: 'string', example: 'pending' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async exportAuditLogs(
    @Request() req,
    @Body() body: { format: string; filters?: any },
  ) {
    return this.exportService.exportAuditLogs(
      body.filters || {},
      body.format,
      req.user.id,
    );
  }

  /**
   * GET /admin/exports/history
   * Get export history for current admin
   */
  @Get('history')
  @ApiOperation({
    summary: 'Get export history',
    description:
      'Returns list of export jobs created by current admin (last 10 by default)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    maximum: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Export history retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          export_type: { type: 'string', example: 'tenants' },
          format: { type: 'string', example: 'csv' },
          status: {
            type: 'string',
            enum: ['pending', 'processing', 'completed', 'failed'],
          },
          row_count: { type: 'number', nullable: true },
          file_path: { type: 'string', nullable: true },
          error_message: { type: 'string', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          completed_at: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async getExportHistory(@Request() req, @Query('limit') limit?: number) {
    const exportLimit = Math.min(limit || 10, 50); // Max 50
    return this.exportService.getExportHistory(req.user.id, exportLimit);
  }

  /**
   * GET /admin/exports/:id/download
   * Download completed export file
   */
  @Get(':id/download')
  @ApiOperation({
    summary: 'Download export file',
    description: 'Download completed export file (CSV or PDF)',
  })
  @ApiParam({ name: 'id', description: 'Export job ID (UUID)' })
  @Header('Content-Disposition', 'attachment')
  @ApiResponse({
    status: 200,
    description: 'Export file downloaded successfully',
    content: {
      'text/csv': {},
      'application/pdf': {},
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Export job not found or file not ready',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async downloadExport(@Param('id', ParseUUIDPipe) id: string) {
    // Get export job
    const exportJob = await this.prisma.export_job.findUnique({
      where: { id },
    });

    if (!exportJob) {
      throw new NotFoundException('Export job not found');
    }

    if (exportJob.status !== 'completed' || !exportJob.file_path) {
      throw new NotFoundException(
        'Export file not ready. Status: ' + exportJob.status,
      );
    }

    // Check if file exists
    if (!fs.existsSync(exportJob.file_path)) {
      throw new NotFoundException('Export file not found on disk');
    }

    // Read file
    const fileBuffer = fs.readFileSync(exportJob.file_path);

    // Determine content type
    const contentType =
      exportJob.format === 'csv' ? 'text/csv' : 'application/pdf';
    const filename = `${exportJob.export_type}_${id}.${exportJob.format}`;

    return new StreamableFile(fileBuffer, {
      type: contentType,
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
