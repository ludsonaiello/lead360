import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
  Delete,
  Param,
  Get,
  Query,
  NotFoundException,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SmsSendingService } from '../services/sms-sending.service';
import { BulkSmsService } from '../services/bulk-sms.service';
import { SendSmsDto } from '../dto/sms/send-sms.dto';
import { SendSmsResponseDto } from '../dto/sms/send-sms-response.dto';
import { BulkSendSmsDto } from '../dto/sms/bulk-send-sms.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * Authenticated request interface
 * Extends Express Request with JWT user data
 */
interface AuthenticatedRequest {
  user: {
    id: string;
    tenant_id: string;
    email: string;
    roles: string[];
    is_platform_admin: boolean;
  };
}

/**
 * SMS Sending Controller
 *
 * Provides REST endpoint for direct SMS sending from frontend UI.
 * Messages are queued for delivery via Twilio.
 *
 * Security:
 * - Authentication required (JWT)
 * - RBAC enforced: Owner, Admin, Manager, Sales only
 * - Multi-tenant isolation via tenant_id from JWT
 * - Opt-out status checked automatically (TCPA compliance)
 *
 * Use Cases:
 * - Send SMS to Lead from Lead detail page
 * - Send SMS to custom phone number
 * - Link SMS to related entities (quote, invoice, etc.)
 *
 * RBAC:
 * - Send SMS: Owner, Admin, Manager, Sales
 * - Employee role NOT allowed (business decision)
 */
@ApiTags('Communication - SMS')
@Controller('communication/sms')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SmsController {
  private readonly logger = new Logger(SmsController.name);

  constructor(
    private readonly smsSendingService: SmsSendingService,
    private readonly bulkSmsService: BulkSmsService,
    @InjectQueue('communication-sms') private readonly smsQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Send SMS to a recipient
   *
   * Queues SMS for delivery via Twilio. Use communication_event_id
   * to track delivery status via /communication/history endpoint.
   *
   * @param req - Request object (contains JWT user data)
   * @param dto - SMS sending data
   * @returns Communication event ID and job ID for tracking
   */
  @Post('send')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send SMS to a recipient',
    description: `
      Send an SMS message to a phone number or Lead. Message is queued for delivery via Twilio.

      **Usage:**
      - Provide \`to_phone\` directly, OR
      - Provide \`lead_id\` to auto-fill phone from Lead's primary phone
      - If both provided, \`to_phone\` takes precedence

      **TCPA Compliance:**
      - Automatically checks if Lead has opted out (replied STOP)
      - Returns 403 Forbidden if opted out

      **Multi-tenant Isolation:**
      - Lead ownership verified automatically
      - Cannot send to Leads from other tenants

      **Tracking:**
      - Use \`communication_event_id\` to track delivery status
      - Check status via \`GET /communication/history/:id\`
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'SMS queued successfully',
    type: SendSmsResponseDto,
    schema: {
      example: {
        communication_event_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        job_id: '12345',
        status: 'queued',
        message: 'SMS queued for delivery',
        to_phone: '+12025551234',
        from_phone: '+19781234567',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - Validation error, missing phone, or unverified config',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'Phone number must be in E.164 format (e.g., +12025551234)',
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Recipient opted out or insufficient permissions',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 403 },
        message: {
          type: 'string',
          example: 'Cannot send SMS: recipient has opted out (replied STOP)',
        },
        error: { type: 'string', example: 'Forbidden' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - No active SMS config or Lead not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: {
          type: 'string',
          example:
            'No active SMS configuration found. Please configure Twilio settings first.',
        },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  async sendSms(
    @Request() req: AuthenticatedRequest,
    @Body() dto: SendSmsDto,
  ): Promise<SendSmsResponseDto> {
    const tenantId = req.user.tenant_id; // CRITICAL: From JWT token
    const userId = req.user.id; // CRITICAL: From JWT token

    this.logger.log(
      `User ${userId} (tenant ${tenantId}) sending SMS to ${dto.to_phone || `Lead ${dto.lead_id}`}`,
    );

    return await this.smsSendingService.sendSms(tenantId, userId, dto);
  }

  /**
   * Cancel a scheduled SMS
   *
   * Removes a scheduled SMS from the queue before it's sent.
   * Only works for SMS with status='scheduled'.
   *
   * @param req - Request object (contains JWT user data)
   * @param communicationEventId - Communication event UUID
   * @returns Success message
   */
  @Delete('scheduled/:id/cancel')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a scheduled SMS',
    description: `
      Cancel a scheduled SMS before it's sent.

      **Requirements:**
      - SMS must have status='scheduled'
      - SMS must belong to your organization (multi-tenant isolation)

      **What happens:**
      - SMS job removed from queue
      - Communication event status updated to 'cancelled'
      - SMS will NOT be sent

      **Use Case:**
      - User scheduled a follow-up SMS but deal closed early
      - User made a mistake and wants to prevent sending
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Scheduled SMS cancelled successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Scheduled SMS cancelled' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Scheduled SMS not found or already sent',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: {
          type: 'string',
          example: 'Scheduled SMS not found',
        },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  async cancelScheduledSms(
    @Request() req: AuthenticatedRequest,
    @Param('id') communicationEventId: string,
  ): Promise<{ success: boolean; message: string }> {
    const tenantId = req.user.tenant_id; // CRITICAL: Multi-tenant isolation

    this.logger.log(
      `User ${req.user.id} (tenant ${tenantId}) cancelling scheduled SMS ${communicationEventId}`,
    );

    // Find event - CRITICAL: Filter by tenant_id for multi-tenant isolation
    const event = await this.prisma.communication_event.findFirst({
      where: {
        id: communicationEventId,
        tenant_id: tenantId, // MANDATORY: Prevent cross-tenant access
        status: 'scheduled',
      },
    });

    if (!event) {
      throw new NotFoundException('Scheduled SMS not found or already sent');
    }

    // Remove from queue
    const jobId = `sms-${communicationEventId}`;
    const job = await this.smsQueue.getJob(jobId);
    if (job) {
      await job.remove();
      this.logger.log(
        `Removed job ${jobId} from queue for SMS ${communicationEventId}`,
      );
    } else {
      this.logger.warn(
        `Job ${jobId} not found in queue (may have already processed)`,
      );
    }

    // Update event status to cancelled
    await this.prisma.communication_event.update({
      where: { id: communicationEventId },
      data: { status: 'cancelled' },
    });

    this.logger.log(
      `Cancelled scheduled SMS ${communicationEventId} (tenant: ${tenantId})`,
    );

    return {
      success: true,
      message: 'Scheduled SMS cancelled',
    };
  }

  /**
   * List scheduled SMS messages
   *
   * Returns all scheduled SMS for the tenant, sorted by scheduled_at.
   * Use this to show users their upcoming scheduled messages.
   *
   * @param req - Request object (contains JWT user data)
   * @param page - Page number (default: 1)
   * @param limit - Items per page (default: 20, max: 100)
   * @returns Paginated list of scheduled SMS
   */
  @Get('scheduled')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List scheduled SMS messages',
    description: `
      Get a paginated list of all scheduled SMS for your organization.

      **Returns:**
      - SMS with status='scheduled' only
      - Sorted by scheduled_at (soonest first)
      - Multi-tenant isolated (only your organization's SMS)

      **Pagination:**
      - Default: 20 items per page
      - Max: 100 items per page

      **Use Case:**
      - Show "Upcoming SMS" dashboard
      - Allow users to review and cancel scheduled messages
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'List of scheduled SMS messages',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              to_phone: { type: 'string' },
              text_body: { type: 'string' },
              scheduled_at: { type: 'string' },
              scheduled_by: { type: 'string' },
              created_at: { type: 'string' },
              related_entity_type: { type: 'string' },
              related_entity_id: { type: 'string' },
            },
          },
        },
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 42 },
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
          },
        },
      },
    },
  })
  async getScheduledSms(
    @Request() req: AuthenticatedRequest,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 20,
  ): Promise<{
    data: any[];
    meta: { total: number; page: number; limit: number };
  }> {
    const tenantId = req.user.tenant_id; // CRITICAL: Multi-tenant isolation

    // Validate pagination parameters
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(Math.max(1, limit), 100); // Max 100 items
    const skip = (validatedPage - 1) * validatedLimit;

    this.logger.log(
      `Fetching scheduled SMS for tenant ${tenantId} (page ${validatedPage}, limit ${validatedLimit})`,
    );

    // Fetch scheduled SMS and count in parallel
    const [events, total] = await Promise.all([
      this.prisma.communication_event.findMany({
        where: {
          tenant_id: tenantId, // CRITICAL: Multi-tenant isolation
          channel: 'sms',
          status: 'scheduled',
        },
        orderBy: { scheduled_at: 'asc' }, // Soonest first
        skip,
        take: validatedLimit,
        select: {
          id: true,
          to_phone: true,
          text_body: true,
          scheduled_at: true,
          scheduled_by: true,
          created_at: true,
          related_entity_type: true,
          related_entity_id: true,
        },
      }),
      this.prisma.communication_event.count({
        where: {
          tenant_id: tenantId, // CRITICAL: Multi-tenant isolation
          channel: 'sms',
          status: 'scheduled',
        },
      }),
    ]);

    this.logger.log(
      `Found ${events.length} scheduled SMS (total: ${total}) for tenant ${tenantId}`,
    );

    return {
      data: events,
      meta: {
        total,
        page: validatedPage,
        limit: validatedLimit,
      },
    };
  }

  /**
   * Bulk send SMS to multiple Leads
   *
   * Queues SMS for delivery to multiple Leads at once.
   * Use for campaigns, reminders, and announcements.
   *
   * @param req - Request object (contains JWT user data)
   * @param dto - Bulk SMS data
   * @returns Tracking information (job IDs, event IDs, counts)
   */
  @Post('bulk-send')
  @Roles('Owner', 'Admin', 'Manager') // More restrictive than single send
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Send SMS to multiple Leads (bulk)',
    description: `
      Send the same SMS message to multiple Leads at once.
      Designed for campaigns, reminders, and announcements.

      **Features:**
      - Send to up to 500 Leads per request
      - Automatic opt-out filtering (TCPA compliance)
      - Rate limiting to avoid Twilio throttling
      - Template support with personalization
      - Status tracking for all messages

      **TCPA Compliance:**
      - Automatically filters out opted-out Leads
      - Skips Leads without phone numbers
      - Returns count of skipped Leads

      **Rate Limiting:**
      - Default: 5 SMS per second
      - Max: 10 SMS per second (Twilio limit)
      - Jobs are automatically delayed for rate limiting

      **Multi-tenant Isolation:**
      - Only sends to Leads belonging to your organization
      - Silently skips Leads from other tenants

      **Tracking:**
      - Returns array of \`communication_event_ids\`
      - Use \`GET /bulk-status\` to track delivery progress
    `,
  })
  @ApiResponse({
    status: 201,
    description: 'Bulk SMS queued successfully',
    schema: {
      type: 'object',
      properties: {
        queued_count: {
          type: 'number',
          example: 48,
          description: 'Number of SMS successfully queued',
        },
        skipped_count: {
          type: 'number',
          example: 2,
          description: 'Number of Leads skipped (opted out or no phone)',
        },
        job_ids: {
          type: 'array',
          items: { type: 'string' },
          example: ['12345', '12346', '12347'],
          description: 'BullMQ job IDs for tracking',
        },
        communication_event_ids: {
          type: 'array',
          items: { type: 'string' },
          example: [
            'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          ],
          description: 'Communication event UUIDs for status tracking',
        },
        estimated_completion_seconds: {
          type: 'number',
          example: 10,
          description:
            'Estimated time until all SMS sent (based on rate limit)',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - No valid recipients, validation error, or unverified config',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example:
            'No valid recipients found. All Leads either opted out or missing phone numbers.',
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Not found - No active SMS config or template not found',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 404 },
        message: {
          type: 'string',
          example:
            'No active SMS configuration found. Please configure Twilio settings first.',
        },
        error: { type: 'string', example: 'Not Found' },
      },
    },
  })
  async bulkSendSms(
    @Request() req: AuthenticatedRequest,
    @Body() dto: BulkSendSmsDto,
  ): Promise<{
    queued_count: number;
    skipped_count: number;
    job_ids: string[];
    communication_event_ids: string[];
    estimated_completion_seconds: number;
  }> {
    const tenantId = req.user.tenant_id; // CRITICAL: From JWT token
    const userId = req.user.id; // CRITICAL: From JWT token

    this.logger.log(
      `User ${userId} (tenant ${tenantId}) initiating bulk SMS to ${dto.lead_ids.length} Leads`,
    );

    return await this.bulkSmsService.queueBulkSms(tenantId, userId, dto);
  }

  /**
   * Get bulk SMS status
   *
   * Retrieves status of all SMS in a bulk operation.
   * Shows summary counts and individual event details.
   *
   * @param req - Request object (contains JWT user data)
   * @param eventIds - Comma-separated list of communication event UUIDs
   * @returns Summary and individual event statuses
   */
  @Get('bulk-status')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get bulk SMS delivery status',
    description: `
      Track the delivery status of a bulk SMS operation.

      **Returns:**
      - Summary counts (total, pending, sent, delivered, failed)
      - Individual event details with timestamps

      **Usage:**
      - Provide comma-separated list of \`communication_event_ids\`
      - Returned by \`POST /bulk-send\` endpoint

      **Multi-tenant Isolation:**
      - Only returns events belonging to your organization
      - Silently filters out events from other tenants
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'Bulk SMS status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'object',
          properties: {
            total: { type: 'number', example: 50 },
            pending: { type: 'number', example: 5 },
            sent: { type: 'number', example: 40 },
            delivered: { type: 'number', example: 38 },
            failed: { type: 'number', example: 2 },
          },
        },
        events: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              to_phone: { type: 'string' },
              status: { type: 'string' },
              sent_at: { type: 'string', nullable: true },
              delivered_at: { type: 'string', nullable: true },
              error_message: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid event_ids parameter',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'event_ids query parameter is required',
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async getBulkSmsStatus(
    @Request() req: AuthenticatedRequest,
    @Query('event_ids') eventIds: string,
  ): Promise<{
    summary: {
      total: number;
      pending: number;
      sent: number;
      delivered: number;
      failed: number;
    };
    events: Array<{
      id: string;
      to_phone: string | null;
      status: string;
      sent_at: Date | null;
      delivered_at: Date | null;
      error_message: string | null;
    }>;
  }> {
    const tenantId = req.user.tenant_id; // CRITICAL: Multi-tenant isolation

    if (!eventIds) {
      throw new BadRequestException('event_ids query parameter is required');
    }

    const eventIdArray = eventIds.split(',').map((id) => id.trim());

    this.logger.log(
      `User ${req.user.id} (tenant ${tenantId}) checking bulk SMS status for ${eventIdArray.length} events`,
    );

    return await this.bulkSmsService.getBulkSmsStatus(tenantId, eventIdArray);
  }
}
