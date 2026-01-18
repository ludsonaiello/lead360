import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { NotificationRulesService } from '../services/notification-rules.service';
import {
  CreateNotificationRuleDto,
  UpdateNotificationRuleDto,
} from '../dto/notification.dto';

/**
 * Notification Rules Controller
 *
 * Configure automated notification rules based on system events.
 * Rules trigger in-app notifications and/or email notifications.
 *
 * RBAC: Owner, Admin only
 */
@ApiTags('Communication - Notification Rules')
@Controller('communication/notification-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class NotificationRulesController {
  constructor(
    private readonly notificationRulesService: NotificationRulesService,
  ) {}

  @Get()
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'List notification rules',
    description: 'Get all notification rules for current tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification rules retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'notif-rule-001' },
          event_type: { type: 'string', example: 'lead_created' },
          notify_in_app: { type: 'boolean', example: true },
          notify_email: { type: 'boolean', example: false },
          email_template_key: { type: 'string', nullable: true },
          recipient_type: {
            type: 'string',
            enum: [
              'owner',
              'assigned_user',
              'specific_users',
              'all_users',
            ],
            example: 'all_users',
          },
          specific_user_ids: {
            type: 'array',
            items: { type: 'string' },
            nullable: true,
          },
          is_active: { type: 'boolean', example: true },
          created_at: {
            type: 'string',
            example: '2026-01-18T00:00:00.000Z',
          },
          updated_at: {
            type: 'string',
            example: '2026-01-18T00:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions (Owner, Admin only)',
  })
  async findAll(@Request() req) {
    return this.notificationRulesService.findAll(req.user.tenant_id);
  }

  @Get(':id')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Get notification rule by ID',
    description: 'Get single notification rule details',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification rule UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification rule retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions (Owner, Admin only)',
  })
  @ApiResponse({ status: 404, description: 'Notification rule not found' })
  async findOne(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationRulesService.findOne(req.user.tenant_id, id);
  }

  @Post()
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Create notification rule',
    description: 'Create new automated notification rule',
  })
  @ApiResponse({
    status: 201,
    description: 'Notification rule created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or validation error',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions (Owner, Admin only)',
  })
  @ApiResponse({
    status: 404,
    description: 'Email template not found (if notify_email is true)',
  })
  async create(@Request() req, @Body() dto: CreateNotificationRuleDto) {
    return this.notificationRulesService.create(
      req.user.tenant_id,
      dto,
      req.user.id,
    );
  }

  @Patch(':id')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Update notification rule',
    description: 'Update existing notification rule configuration',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification rule UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Notification rule updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or validation error',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions (Owner, Admin only)',
  })
  @ApiResponse({ status: 404, description: 'Notification rule not found' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNotificationRuleDto,
  ) {
    return this.notificationRulesService.update(
      req.user.tenant_id,
      id,
      dto,
      req.user.id,
    );
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete notification rule',
    description: 'Delete automated notification rule',
  })
  @ApiParam({
    name: 'id',
    description: 'Notification rule UUID',
  })
  @ApiResponse({
    status: 204,
    description: 'Notification rule deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions (Owner, Admin only)',
  })
  @ApiResponse({ status: 404, description: 'Notification rule not found' })
  async delete(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.notificationRulesService.delete(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }
}
