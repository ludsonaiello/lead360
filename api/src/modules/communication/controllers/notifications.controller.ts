import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
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
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { NotificationsService } from '../services/notifications.service';
import { ListNotificationsDto } from '../dto/notification.dto';

/**
 * Notifications Controller
 *
 * User-specific in-app notifications.
 * Each user sees only their own notifications plus tenant-wide broadcasts.
 *
 * RBAC: All authenticated users can manage their own notifications
 */
@ApiTags('Communication - Notifications')
@Controller('communication/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'List user notifications',
    description:
      'Get all notifications for current user (user-specific + tenant-wide broadcasts)',
  })
  @ApiQuery({
    name: 'is_read',
    required: false,
    type: Boolean,
    description: 'Filter by read status',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    type: String,
    description: 'Filter by notification type',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Results limit (default: 20, max: 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'notif-001' },
          type: { type: 'string', example: 'lead_created' },
          title: { type: 'string', example: 'New Lead Created' },
          message: {
            type: 'string',
            example: 'John Doe submitted a service request',
          },
          action_url: {
            type: 'string',
            example: '/leads/abc-123',
          },
          related_entity_type: { type: 'string', example: 'lead' },
          related_entity_id: { type: 'string', example: 'lead-abc-123' },
          is_read: { type: 'boolean', example: false },
          read_at: { type: 'string', nullable: true },
          expires_at: { type: 'string', nullable: true },
          created_at: {
            type: 'string',
            example: '2026-01-18T10:00:00.000Z',
          },
        },
      },
    },
  })
  async findAll(@Request() req, @Query() dto: ListNotificationsDto) {
    return this.notificationsService.findAllForUser(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Get('unread-count')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'Get unread notification count',
    description: 'Get count of unread notifications for current user',
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
  async getUnreadCount(@Request() req) {
    return this.notificationsService.getUnreadCount(
      req.user.tenant_id,
      req.user.id,
    );
  }

  @Patch(':id/read')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'Mark notification as read',
    description: 'Mark a single notification as read',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        is_read: { type: 'boolean', example: true },
        read_at: {
          type: 'string',
          example: '2026-01-18T11:00:00.000Z',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsRead(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.markAsRead(
      req.user.tenant_id,
      req.user.id,
      id,
    );
  }

  @Post('mark-all-read')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Mark all unread notifications as read for current user',
  })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
    schema: {
      type: 'object',
      properties: {
        updated_count: { type: 'number', example: 5 },
      },
    },
  })
  async markAllAsRead(@Request() req) {
    return this.notificationsService.markAllAsRead(
      req.user.tenant_id,
      req.user.id,
    );
  }

  @Delete(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete notification',
    description: 'Delete a notification (user can only delete their own)',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification UUID',
  })
  @ApiResponse({
    status: 204,
    description: 'Notification deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async delete(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    await this.notificationsService.delete(req.user.tenant_id, req.user.id, id);
  }
}
