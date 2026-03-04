import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  UnauthorizedException,
  Logger,
  ParseIntPipe,
  DefaultValuePipe,
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
import { CalendarSyncLogService } from '../services/calendar-sync-log.service';
import { CalendarProviderConnectionService } from '../services/calendar-provider-connection.service';
import {
  SyncLogsResponseDto,
  CalendarHealthResponseDto,
} from '../dto/google-integration.dto';

/**
 * Sync Logs Controller
 * Sprint 16: Sync Logging and Health Monitoring
 *
 * Provides endpoints for:
 * 1. Viewing paginated sync logs with filtering
 * 2. Monitoring calendar integration health
 *
 * All endpoints enforce:
 * - JWT authentication
 * - RBAC (role-based access control)
 * - Multi-tenant isolation (tenant_id from JWT)
 *
 * @class SyncLogsController
 * @since Sprint 16
 */
@ApiTags('Calendar Integration')
@Controller('calendar/integration')
export class SyncLogsController {
  private readonly logger = new Logger(SyncLogsController.name);

  constructor(
    private readonly syncLogService: CalendarSyncLogService,
    private readonly connectionService: CalendarProviderConnectionService,
  ) {}

  /**
   * Get paginated sync logs with optional filtering
   *
   * Returns a list of sync operations (create/update/delete events, webhook notifications, etc.)
   * with pagination and filtering capabilities.
   *
   * **RBAC**: Owner, Admin only (Estimator cannot access sync logs)
   * **Multi-tenant**: Automatically scoped to authenticated user's tenant
   *
   * @param req - Request object (contains JWT with tenant_id)
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 50, max: 100)
   * @param status - Filter by status (optional)
   * @param direction - Filter by direction (optional)
   * @param action - Filter by action type (optional)
   * @returns Paginated sync logs
   */
  @Get('sync-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Owner', 'Admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get sync logs',
    description:
      'Returns paginated sync logs for calendar integration operations. Supports filtering by status, direction, and action type.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (max 100)',
    example: 50,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['success', 'failed', 'skipped'],
    description: 'Filter by sync status',
  })
  @ApiQuery({
    name: 'direction',
    required: false,
    enum: ['outbound', 'inbound'],
    description: 'Filter by sync direction',
  })
  @ApiQuery({
    name: 'action',
    required: false,
    type: String,
    description: 'Filter by action type (e.g., event_created, webhook_received)',
  })
  @ApiResponse({
    status: 200,
    description: 'Sync logs retrieved successfully',
    type: SyncLogsResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT missing or invalid',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User role not authorized (Estimator cannot access)',
  })
  async getSyncLogs(
    @Req() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('status') status?: 'success' | 'failed' | 'skipped',
    @Query('direction') direction?: 'outbound' | 'inbound',
    @Query('action') action?: string,
  ): Promise<SyncLogsResponseDto> {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in request');
    }

    // Enforce limit maximum
    const sanitizedLimit = Math.min(limit, 100);

    this.logger.log(
      `Fetching sync logs for tenant ${tenantId} - Page: ${page}, Limit: ${sanitizedLimit}, Status: ${status || 'all'}, Direction: ${direction || 'all'}, Action: ${action || 'all'}`,
    );

    const result = await this.syncLogService.getPaginatedLogs(tenantId, {
      page,
      limit: sanitizedLimit,
      status,
      direction,
      action,
    });

    // Map to DTO format (createdAt as ISO string)
    const data = result.data.map((log) => ({
      id: log.id,
      connectionId: log.connectionId,
      direction: log.direction,
      action: log.action,
      appointmentId: log.appointmentId,
      externalEventId: log.externalEventId,
      status: log.status,
      errorMessage: log.errorMessage,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
    }));

    return {
      data,
      pagination: result.pagination,
    };
  }

  /**
   * Get calendar integration health status
   *
   * Returns health metrics for the calendar integration including:
   * - Connection status
   * - Sync status
   * - Last sync timestamp
   * - Webhook expiration
   * - Recent errors and successes (last 24 hours)
   *
   * **RBAC**: Owner, Admin, Estimator (all roles can check health)
   * **Multi-tenant**: Automatically scoped to authenticated user's tenant
   *
   * @param req - Request object (contains JWT with tenant_id)
   * @returns Health status
   */
  @Get('health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Owner', 'Admin', 'Estimator')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get calendar integration health',
    description:
      'Returns health metrics for calendar integration including connection status, sync status, and recent operation counts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Health status retrieved successfully',
    type: CalendarHealthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT missing or invalid',
  })
  async getHealth(@Req() req: any): Promise<CalendarHealthResponseDto> {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      throw new UnauthorizedException('Tenant ID not found in request');
    }

    this.logger.log(`Fetching health status for tenant ${tenantId}`);

    // 1. Get active connection
    const connection = await this.connectionService.getActiveConnection(tenantId);

    if (!connection) {
      // No connection - return inactive status
      return {
        connected: false,
        syncStatus: 'inactive',
        recentErrors: 0,
        recentSuccesses: 0,
      };
    }

    // 2. Get last sync timestamp
    const lastSyncAt = await this.syncLogService.getLastSyncTimestamp(tenantId);

    // 3. Count recent errors and successes (last 24 hours)
    const [recentErrors, recentSuccesses] = await Promise.all([
      this.syncLogService.countRecentFailures(tenantId),
      this.syncLogService.countRecentSuccesses(tenantId),
    ]);

    // 4. Determine sync status
    // Map connection sync_status to health status
    let syncStatus: string;
    switch (connection.syncStatus) {
      case 'active':
      case 'syncing':
        syncStatus = 'active';
        break;
      case 'disconnected':
        syncStatus = 'inactive';
        break;
      case 'error':
        syncStatus = 'error';
        break;
      default:
        syncStatus = 'inactive';
    }

    return {
      connected: true,
      syncStatus,
      lastSyncAt: lastSyncAt?.toISOString(),
      webhookExpiration: connection.webhookExpiration?.toISOString(),
      recentErrors,
      recentSuccesses,
    };
  }
}
