import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Request,
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
import { CommunicationHistoryService } from '../services/communication-history.service';

/**
 * Communication History Controller
 *
 * View sent/received communications with filtering and search.
 * Tracks email, SMS, and WhatsApp message status.
 *
 * RBAC: View (all roles), Resend (Owner, Admin, Manager, Sales)
 */
@ApiTags('Communication - History')
@Controller('communication/history')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CommunicationHistoryController {
  constructor(
    private readonly communicationHistoryService: CommunicationHistoryService,
  ) {}

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'List communication events with filters',
    description:
      'Get paginated list of communication events (email, SMS, WhatsApp)',
  })
  @ApiQuery({
    name: 'channel',
    required: false,
    enum: ['email', 'sms', 'whatsapp'],
    description: 'Filter by channel',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'sent', 'delivered', 'failed', 'bounced'],
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'to_email',
    required: false,
    type: String,
    description: 'Filter by recipient email',
  })
  @ApiQuery({
    name: 'to_phone',
    required: false,
    type: String,
    description: 'Filter by recipient phone',
  })
  @ApiQuery({
    name: 'related_entity_type',
    required: false,
    type: String,
    description: 'Filter by related entity (e.g., lead, quote)',
  })
  @ApiQuery({
    name: 'related_entity_id',
    required: false,
    type: String,
    description: 'Filter by related entity ID',
  })
  @ApiQuery({
    name: 'date_from',
    required: false,
    type: String,
    description: 'Filter by date from (ISO 8601)',
  })
  @ApiQuery({
    name: 'date_to',
    required: false,
    type: String,
    description: 'Filter by date to (ISO 8601)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Results per page (default: 20, max: 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'Communication events retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'comm-event-001' },
              channel: { type: 'string', example: 'email' },
              direction: { type: 'string', example: 'outbound' },
              status: { type: 'string', example: 'delivered' },
              to_email: { type: 'string', example: 'john@example.com' },
              to_phone: { type: 'string', example: '+15551234567' },
              subject: { type: 'string', example: 'New Lead Created' },
              provider: {
                type: 'object',
                properties: {
                  provider_name: { type: 'string', example: 'SendGrid' },
                },
              },
              sent_at: {
                type: 'string',
                example: '2026-01-18T10:00:00.000Z',
              },
              delivered_at: {
                type: 'string',
                example: '2026-01-18T10:00:05.000Z',
              },
              opened_at: {
                type: 'string',
                example: '2026-01-18T11:30:00.000Z',
              },
              clicked_at: { type: 'string', nullable: true },
              error_message: { type: 'string', nullable: true },
              created_at: {
                type: 'string',
                example: '2026-01-18T10:00:00.000Z',
              },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
            total: { type: 'number', example: 150 },
            total_pages: { type: 'number', example: 8 },
          },
        },
      },
    },
  })
  async findAll(@Request() req, @Query() filters: any) {
    return this.communicationHistoryService.findAll(
      req.user.tenant_id,
      filters,
    );
  }

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'Get communication event details',
    description:
      'Get detailed information for a single communication event including full body',
  })
  @ApiParam({
    name: 'id',
    description: 'Communication event UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Communication event retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        channel: { type: 'string' },
        direction: { type: 'string' },
        status: { type: 'string' },
        to_email: { type: 'string' },
        to_phone: { type: 'string' },
        cc_emails: { type: 'array', items: { type: 'string' } },
        bcc_emails: { type: 'array', items: { type: 'string' } },
        from_email: { type: 'string' },
        from_name: { type: 'string' },
        subject: { type: 'string' },
        html_body: { type: 'string' },
        text_body: { type: 'string' },
        template_key: { type: 'string' },
        template_variables: { type: 'object' },
        attachments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              file_id: { type: 'string' },
              filename: { type: 'string' },
              size: { type: 'number' },
            },
          },
        },
        provider: {
          type: 'object',
          properties: {
            provider_key: { type: 'string' },
            provider_name: { type: 'string' },
          },
        },
        provider_message_id: { type: 'string' },
        provider_metadata: { type: 'object' },
        error_message: { type: 'string' },
        sent_at: { type: 'string' },
        delivered_at: { type: 'string' },
        opened_at: { type: 'string' },
        clicked_at: { type: 'string' },
        bounced_at: { type: 'string' },
        bounce_type: { type: 'string' },
        related_entity_type: { type: 'string' },
        related_entity_id: { type: 'string' },
        created_at: { type: 'string' },
        created_by: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            email: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Communication event not found' })
  async findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.communicationHistoryService.findOne(req.user.tenant_id, id);
  }

  @Post(':id/resend')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Resend failed communication',
    description: 'Retry sending a failed email/SMS/WhatsApp message',
  })
  @ApiParam({
    name: 'id',
    description: 'Communication event UUID',
  })
  @ApiResponse({
    status: 202,
    description: 'Communication re-queued successfully',
    schema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', example: 'job-12345' },
        communication_event_id: {
          type: 'string',
          example: 'comm-event-001',
        },
        status: { type: 'string', example: 'queued' },
        message: {
          type: 'string',
          example: 'Communication re-queued for sending',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot resend non-failed communication',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Communication event not found' })
  async resend(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.communicationHistoryService.resend(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }
}
