import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { AlertService } from '../services/alert.service';

@ApiTags('Admin - Alerts & Notifications')
@ApiBearerAuth()
@Controller('admin/alerts')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AlertsController {
  constructor(private readonly alertService: AlertService) {}

  /**
   * GET /admin/alerts/unread-count
   * Get count of unread notifications
   */
  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread notification count',
    description: 'Returns the count of unread notifications',
  })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        unread_count: { type: 'number', example: 5 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async getUnreadCount() {
    const result = await this.alertService.getNotifications({
      page: 1,
      limit: 1,
      unread_only: true,
    });
    return { unread_count: result.unread_count };
  }

  /**
   * GET /admin/alerts/recent
   * Get recent notifications (convenience endpoint)
   */
  @Get('recent')
  @ApiOperation({
    summary: 'Get recent notifications',
    description: 'Returns recent notifications without pagination metadata',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Recent notifications retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          title: { type: 'string' },
          message: { type: 'string' },
          link: { type: 'string', nullable: true },
          is_read: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async getRecentNotifications(@Query('limit') limit?: string) {
    const limitNum = Math.min(parseInt(limit || '10') || 10, 50);
    const result = await this.alertService.getNotifications({
      page: 1,
      limit: limitNum,
    });
    return result.data;
  }

  /**
   * GET /admin/alerts
   * Get in-app notifications with pagination
   */
  @Get()
  @ApiOperation({
    summary: 'Get in-app notifications',
    description: 'Returns paginated list of admin notifications (unread first)',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'unread_only',
    required: false,
    type: Boolean,
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string', example: 'new_tenant' },
              title: { type: 'string', example: 'New Tenant Registered' },
              message: {
                type: 'string',
                example: 'Acme Roofing LLC has registered',
              },
              link: {
                type: 'string',
                nullable: true,
                example: '/admin/tenants/abc123',
              },
              is_read: { type: 'boolean' },
              created_at: { type: 'string', format: 'date-time' },
              expires_at: {
                type: 'string',
                format: 'date-time',
                nullable: true,
              },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            total_pages: { type: 'number' },
          },
        },
        unread_count: { type: 'number', example: 5 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async getNotifications(@Query() query: any) {
    const page = parseInt(query.page) || 1;
    const limit = Math.min(parseInt(query.limit) || 20, 50); // Max 50
    const unread_only = query.unread_only === 'true';

    return this.alertService.getNotifications({ page, limit, unread_only });
  }

  /**
   * PATCH /admin/alerts/:id/read
   * Mark single notification as read
   */
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { type: 'string' },
        title: { type: 'string' },
        message: { type: 'string' },
        link: { type: 'string', nullable: true },
        is_read: { type: 'boolean', example: true },
        created_at: { type: 'string', format: 'date-time' },
        expires_at: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async markAsRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.alertService.markAsRead(id);
  }

  /**
   * POST /admin/alerts/mark-all-read
   * Mark all notifications as read
   */
  @Post('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
    schema: {
      type: 'object',
      properties: {
        marked_read: { type: 'number', example: 12 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async markAllAsRead() {
    return this.alertService.markAllAsRead();
  }

  /**
   * DELETE /admin/alerts/:id
   * Delete notification
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete notification' })
  @ApiParam({ name: 'id', description: 'Notification ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Notification deleted successfully',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async deleteNotification(@Param('id', ParseUUIDPipe) id: string) {
    return this.alertService.deleteNotification(id);
  }
}
