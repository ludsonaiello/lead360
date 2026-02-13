import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { SmsAnalyticsService } from '../../services/sms-analytics.service';

/**
 * SMS Analytics Admin Controller
 *
 * Provides cross-tenant SMS analytics for system administrators:
 * - Summary metrics across all tenants or specific tenant
 * - Same functionality as tenant controller but with cross-tenant visibility
 *
 * RBAC: SystemAdmin only
 * Multi-tenant: Optional tenant_id filter, defaults to all tenants
 */
@ApiTags('Admin - SMS Analytics')
@Controller('admin/communication/sms/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SystemAdmin')
@ApiBearerAuth()
export class SmsAnalyticsAdminController {
  constructor(private readonly analyticsService: SmsAnalyticsService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Get SMS analytics summary (cross-tenant)',
    description:
      'Get summary metrics for SMS communications across all tenants or for a specific tenant. Includes sent, delivered, failed counts, delivery rate, total cost, unique recipients, and opt-out count. Default date range: last 30 days.',
  })
  @ApiQuery({
    name: 'tenant_id',
    required: false,
    type: String,
    description:
      'Optional tenant ID filter. If omitted, returns data for all tenants.',
    example: 'tenant-123',
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
    description: 'SMS analytics summary retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        total_sent: {
          type: 'number',
          example: 15234,
          description: 'Total SMS messages sent across all/filtered tenants',
        },
        total_delivered: {
          type: 'number',
          example: 14952,
          description: 'Total SMS messages delivered',
        },
        total_failed: {
          type: 'number',
          example: 282,
          description: 'Total SMS messages failed',
        },
        delivery_rate: {
          type: 'number',
          example: 98.15,
          description: 'Delivery rate percentage',
        },
        total_cost: {
          type: 'number',
          example: 456.78,
          description: 'Total cost in dollars',
        },
        unique_recipients: {
          type: 'number',
          example: 3421,
          description: 'Number of unique phone numbers',
        },
        opt_out_count: {
          type: 'number',
          example: 152,
          description: 'Number of leads who opted out',
        },
        tenant_id: {
          type: 'string',
          example: 'tenant-123',
          description: 'Tenant ID (only present if filtered by tenant)',
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
    description: 'Insufficient permissions (SystemAdmin only)',
  })
  async getSummary(
    @Query('tenant_id') tenantId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
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

    return await this.analyticsService.getAdminSummary(start, end, tenantId);
  }

  @Get('trends')
  @ApiOperation({
    summary: 'Get SMS daily trends (cross-tenant)',
    description:
      'Get daily breakdown of SMS metrics across all tenants or for a specific tenant. Shows sent, delivered, and failed counts per day. Default date range: last 30 days.',
  })
  @ApiQuery({
    name: 'tenant_id',
    required: false,
    type: String,
    description: 'Optional tenant ID filter',
    example: 'tenant-123',
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
            example: 450,
            description: 'SMS messages sent on this day',
          },
          delivered_count: {
            type: 'number',
            example: 442,
            description: 'SMS messages delivered on this day',
          },
          failed_count: {
            type: 'number',
            example: 8,
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
    description: 'Insufficient permissions (SystemAdmin only)',
  })
  async getTrends(
    @Query('tenant_id') tenantId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
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

    // If tenant_id provided, use tenant-specific method, otherwise would need admin version
    // For now, admin can query specific tenant trends by providing tenant_id
    if (!tenantId) {
      throw new BadRequestException(
        'tenant_id is required for trends endpoint. Cross-tenant trends aggregation not yet implemented.',
      );
    }

    return await this.analyticsService.getTrends(tenantId, start, end);
  }

  @Get('failures')
  @ApiOperation({
    summary: 'Get SMS failure breakdown (cross-tenant)',
    description:
      'Get breakdown of SMS failures by error code for all tenants or specific tenant. Sorted by count (descending). Helps identify common failure patterns. Default date range: last 30 days.',
  })
  @ApiQuery({
    name: 'tenant_id',
    required: false,
    type: String,
    description: 'Optional tenant ID filter',
    example: 'tenant-123',
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
            example: 152,
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
    description: 'Insufficient permissions (SystemAdmin only)',
  })
  async getFailureBreakdown(
    @Query('tenant_id') tenantId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
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

    if (!tenantId) {
      throw new BadRequestException(
        'tenant_id is required for failure breakdown endpoint. Cross-tenant failure aggregation not yet implemented.',
      );
    }

    return await this.analyticsService.getFailureBreakdown(
      tenantId,
      start,
      end,
    );
  }

  @Get('top-recipients')
  @ApiOperation({
    summary: 'Get top SMS recipients (cross-tenant)',
    description:
      "Get the most frequently SMS'd phone numbers for all tenants or specific tenant, with associated lead information. Default date range: last 30 days.",
  })
  @ApiQuery({
    name: 'tenant_id',
    required: false,
    type: String,
    description: 'Optional tenant ID filter',
    example: 'tenant-123',
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
            example: 234,
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
    description: 'Insufficient permissions (SystemAdmin only)',
  })
  async getTopRecipients(
    @Query('tenant_id') tenantId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('limit') limit?: string,
  ) {
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

    if (!tenantId) {
      throw new BadRequestException(
        'tenant_id is required for top recipients endpoint. Cross-tenant recipient aggregation not yet implemented.',
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
