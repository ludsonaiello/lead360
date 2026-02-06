import {
  Controller,
  Get,
  Query,
  Param,
  Request,
  UseGuards,
  ParseUUIDPipe,
  StreamableFile,
  Header,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../rbac/guards/permission.guard';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { AuditReaderService } from './services/audit-reader.service';
import { AuditExportService } from './services/audit-export.service';
import { AuditLogQueryDto, ExportAuditLogDto } from './dto';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AuditController {
  constructor(
    private readonly auditReaderService: AuditReaderService,
    private readonly auditExportService: AuditExportService,
  ) {}

  /**
   * GET /audit-logs
   * List audit logs with filters and pagination
   * Accessible by: Owner, Admin, Platform Admin
   */
  @Get()
  @RequirePermission('audit', 'view')
  @ApiOperation({ summary: 'Get all audit log entries for tenant' })
  @ApiQuery({
    name: 'page',
    required: false,
    example: 1,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 50,
    description: 'Items per page (max 200)',
  })
  @ApiQuery({
    name: 'start_date',
    required: false,
    description: 'Filter by start date (ISO-8601)',
  })
  @ApiQuery({
    name: 'end_date',
    required: false,
    description: 'Filter by end date (ISO-8601)',
  })
  @ApiQuery({
    name: 'actor_user_id',
    required: false,
    description: 'Filter by actor user ID',
  })
  @ApiQuery({
    name: 'actor_type',
    required: false,
    enum: ['user', 'system', 'platform_admin', 'cron_job'],
  })
  @ApiQuery({
    name: 'action_type',
    required: false,
    enum: ['created', 'updated', 'deleted', 'accessed', 'failed'],
  })
  @ApiQuery({
    name: 'entity_type',
    required: false,
    description: 'Filter by entity type',
  })
  @ApiQuery({
    name: 'entity_id',
    required: false,
    description: 'Filter by entity ID',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['success', 'failure'] })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search in description field',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit logs retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async findAll(@Request() req, @Query() query: AuditLogQueryDto) {
    const isPlatformAdmin = req.user.is_platform_admin || false;
    const tenantId = req.user.tenant_id;

    return this.auditReaderService.findAll(query, isPlatformAdmin, tenantId);
  }

  /**
   * GET /audit-logs/export
   * Export audit logs to CSV or JSON
   * Accessible by: Owner, Admin, Platform Admin
   */
  @Get('export')
  @RequirePermission('audit', 'export')
  @ApiOperation({ summary: 'Export audit logs to CSV or JSON' })
  @ApiQuery({
    name: 'format',
    required: false,
    enum: ['csv', 'json'],
    description: 'Export format',
  })
  @ApiQuery({
    name: 'start_date',
    required: false,
    description: 'Filter by start date (ISO-8601)',
  })
  @ApiQuery({
    name: 'end_date',
    required: false,
    description: 'Filter by end date (ISO-8601)',
  })
  @ApiResponse({
    status: 200,
    description: 'Export file generated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Too many results or no results found',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @Header('Content-Disposition', 'attachment')
  async export(@Request() req, @Query() query: ExportAuditLogDto) {
    const isPlatformAdmin = req.user.is_platform_admin || false;
    const tenantId = req.user.tenant_id;

    const { data, filename, contentType } =
      await this.auditExportService.export(query, isPlatformAdmin, tenantId);

    return new StreamableFile(Buffer.from(data), {
      type: contentType,
      disposition: `attachment; filename="${filename}"`,
    });
  }

  /**
   * GET /audit-logs/:id
   * Get single audit log entry by ID
   * Accessible by: Owner, Admin, Platform Admin
   */
  @Get(':id')
  @RequirePermission('audit', 'view')
  @ApiOperation({ summary: 'Get audit log entry by ID' })
  @ApiParam({ name: 'id', description: 'Audit log ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Audit log retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Audit log not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    const isPlatformAdmin = req.user.is_platform_admin || false;
    const tenantId = req.user.tenant_id;

    return this.auditReaderService.findOne(id, isPlatformAdmin, tenantId);
  }

  /**
   * GET /users/:userId/audit-logs
   * Get audit logs for specific user (user activity history)
   * Accessible by: Owner, Admin, Platform Admin
   */
  @Get('users/:userId/audit-logs')
  @RequirePermission('audit', 'view')
  @ApiOperation({ summary: 'Get audit logs for specific user' })
  @ApiParam({ name: 'userId', description: 'User ID (UUID)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'start_date', required: false })
  @ApiQuery({ name: 'end_date', required: false })
  @ApiResponse({
    status: 200,
    description: 'User activity history retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'User not found in your tenant' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  async findByUser(
    @Request() req,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: AuditLogQueryDto,
  ) {
    const isPlatformAdmin = req.user.is_platform_admin || false;
    const tenantId = req.user.tenant_id;

    return this.auditReaderService.findByUser(
      userId,
      query,
      isPlatformAdmin,
      tenantId,
    );
  }

  /**
   * GET /tenants/:tenantId/audit-logs
   * Get audit logs for specific tenant (Platform Admin only)
   * Accessible by: Platform Admin only
   */
  @Get('tenants/:tenantId/audit-logs')
  @RequirePermission('platform_admin', 'view_all_tenants')
  @ApiOperation({
    summary: 'Get audit logs for specific tenant (Platform Admin only)',
  })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID (UUID)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'start_date', required: false })
  @ApiQuery({ name: 'end_date', required: false })
  @ApiResponse({
    status: 200,
    description: 'Tenant activity history retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async findByTenant(
    @Request() req,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Query() query: AuditLogQueryDto,
  ) {
    // Force tenantId from URL parameter
    const updatedQuery = { ...query, tenant_id: tenantId };

    // Platform Admin can access any tenant
    return this.auditReaderService.findAll(updatedQuery, true, tenantId);
  }
}
