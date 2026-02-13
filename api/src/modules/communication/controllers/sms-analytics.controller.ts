import {
  Controller,
  Get,
  Query,
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
import { SmsAnalyticsService } from '../services/sms-analytics.service';

/**
 * SMS Analytics Controller
 *
 * Provides analytics and insights for SMS communications:
 * - Summary metrics (sent, delivered, failed, delivery rate, cost)
 * - Daily trends
 * - Failure breakdown by error code
 * - Top recipients
 *
 * RBAC: View analytics (Owner, Admin, Manager)
 * Multi-tenant: All data filtered by tenant_id from JWT
 */
@ApiTags('Communication - SMS Analytics')
@Controller('communication/sms/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SmsAnalyticsController {
  constructor(private readonly analyticsService: SmsAnalyticsService) {}

  @Get('summary')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Get SMS analytics summary',
    description:
      'Get summary metrics for SMS communications including sent, delivered, failed counts, delivery rate, total cost, unique recipients, and opt-out count. Default date range: last 30 days.',
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
    description: 'SMS analytics summary retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        total_sent: {
          type: 'number',
          example: 1523,
          description: 'Total SMS messages sent (includes delivered)',
        },
        total_delivered: {
          type: 'number',
          example: 1495,
          description: 'Total SMS messages delivered',
        },
        total_failed: {
          type: 'number',
          example: 28,
          description: 'Total SMS messages failed',
        },
        delivery_rate: {
          type: 'number',
          example: 98.16,
          description: 'Delivery rate percentage',
        },
        total_cost: {
          type: 'number',
          example: 45.69,
          description: 'Total cost in dollars',
        },
        unique_recipients: {
          type: 'number',
          example: 342,
          description: 'Number of unique phone numbers',
        },
        opt_out_count: {
          type: 'number',
          example: 15,
          description: 'Number of leads who opted out',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid date range (start_date must be before end_date)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  async getSummary(
    @Request() req,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
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

    return await this.analyticsService.getSummary(tenantId, start, end);
  }

  @Get('trends')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Get SMS daily trends',
    description:
      'Get daily breakdown of SMS metrics showing sent, delivered, and failed counts per day. Default date range: last 30 days.',
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
    description: 'SMS daily trends retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            example: '2026-02-01',
            description: 'Date (YYYY-MM-DD)',
          },
          sent_count: {
            type: 'number',
            example: 45,
            description: 'SMS messages sent on this day',
          },
          delivered_count: {
            type: 'number',
            example: 43,
            description: 'SMS messages delivered on this day',
          },
          failed_count: {
            type: 'number',
            example: 2,
            description: 'SMS messages failed on this day',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid date range',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  async getTrends(
    @Request() req,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const tenantId = req.user.tenant_id;

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Validate dates
    if (isNaN(start.getTime())) {
      throw new BadRequestException(
        'Invalid start_date format. Use ISO 8601 format',
      );
    }
    if (isNaN(end.getTime())) {
      throw new BadRequestException(
        'Invalid end_date format. Use ISO 8601 format',
      );
    }

    return await this.analyticsService.getTrends(tenantId, start, end);
  }

  @Get('failures')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Get SMS failure breakdown',
    description:
      'Get breakdown of SMS failures by error code, sorted by count (descending). Helps identify common failure patterns. Default date range: last 30 days.',
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
    description: 'SMS failure breakdown retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          error_code: {
            type: 'string',
            example: '21211',
            description: 'Error code from SMS provider',
          },
          count: {
            type: 'number',
            example: 15,
            description: 'Number of failures with this error code',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid date range',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  async getFailureBreakdown(
    @Request() req,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const tenantId = req.user.tenant_id;

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Validate dates
    if (isNaN(start.getTime())) {
      throw new BadRequestException(
        'Invalid start_date format. Use ISO 8601 format',
      );
    }
    if (isNaN(end.getTime())) {
      throw new BadRequestException(
        'Invalid end_date format. Use ISO 8601 format',
      );
    }

    return await this.analyticsService.getFailureBreakdown(
      tenantId,
      start,
      end,
    );
  }

  @Get('top-recipients')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Get top SMS recipients',
    description:
      "Get the most frequently SMS'd phone numbers with associated lead information. Useful for identifying high-engagement leads. Default date range: last 30 days.",
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
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Maximum number of recipients to return (1-100). Default: 10',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Top SMS recipients retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          to_phone: {
            type: 'string',
            example: '+15551234567',
            description: 'Recipient phone number',
          },
          sms_count: {
            type: 'number',
            example: 23,
            description: 'Number of SMS messages sent to this number',
          },
          lead: {
            type: 'object',
            nullable: true,
            description: 'Associated lead information (null if not found)',
            properties: {
              id: {
                type: 'string',
                example: 'lead-123',
              },
              first_name: {
                type: 'string',
                example: 'John',
              },
              last_name: {
                type: 'string',
                example: 'Doe',
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid date range or limit',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  async getTopRecipients(
    @Request() req,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const tenantId = req.user.tenant_id;

    const start = startDate
      ? new Date(startDate)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const parsedLimit = limit ? parseInt(limit, 10) : 10;

    // Validate dates
    if (isNaN(start.getTime())) {
      throw new BadRequestException(
        'Invalid start_date format. Use ISO 8601 format',
      );
    }
    if (isNaN(end.getTime())) {
      throw new BadRequestException(
        'Invalid end_date format. Use ISO 8601 format',
      );
    }

    // Validate limit
    if (isNaN(parsedLimit)) {
      throw new BadRequestException(
        'Invalid limit. Must be a number between 1 and 100',
      );
    }

    return await this.analyticsService.getTopRecipients(
      tenantId,
      start,
      end,
      parsedLimit,
    );
  }
}
