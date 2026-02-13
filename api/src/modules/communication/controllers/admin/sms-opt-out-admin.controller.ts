import {
  Controller,
  Get,
  Query,
  Param,
  Patch,
  UseGuards,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { PrismaService } from '../../../../core/database/prisma.service';
import { SmsKeywordDetectionService } from '../../services/sms-keyword-detection.service';

/**
 * Admin SMS Opt-Out Management Controller
 *
 * RBAC: SystemAdmin only
 *
 * Features:
 * - View all opted-out Leads across tenants
 * - Filter by tenant_id
 * - Manually opt-in Leads (override opt-out)
 * - Pagination support
 *
 * Purpose: Allow System Admins to manage SMS opt-outs for compliance and support
 *
 * Endpoints:
 * - GET /admin/communication/sms/opt-outs - List opted-out Leads
 * - PATCH /admin/communication/sms/opt-outs/:leadId/opt-in - Manually opt-in Lead
 */
@ApiTags('Admin - SMS Opt-Out Management')
@Controller('admin/communication/sms/opt-outs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SystemAdmin')
@ApiBearerAuth()
export class SmsOptOutAdminController {
  private readonly logger = new Logger(SmsOptOutAdminController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsKeywordDetection: SmsKeywordDetectionService,
  ) {}

  /**
   * Get all opted-out Leads (cross-tenant)
   *
   * System Admin can view opted-out Leads across all tenants
   * for compliance monitoring and support.
   *
   * Query Parameters:
   * - tenant_id (optional): Filter by specific tenant
   * - page (optional): Page number (default: 1)
   * - limit (optional): Results per page (default: 20, max: 100)
   *
   * @returns Paginated list of opted-out Leads with tenant info
   */
  @Get()
  @ApiOperation({
    summary: 'List all opted-out Leads (cross-tenant)',
    description:
      'System Admin endpoint to view all Leads who have opted out of SMS across all tenants. ' +
      'Supports filtering by tenant_id and pagination.',
  })
  @ApiQuery({
    name: 'tenant_id',
    required: false,
    description: 'Filter by specific tenant ID',
    type: String,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number (default: 1)',
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Results per page (default: 20, max: 100)',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'List of opted-out Leads returned successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires SystemAdmin role',
  })
  async getOptedOutLeads(
    @Query('tenant_id') tenantId?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    this.logger.log(
      `Admin fetching opted-out Leads (tenant_id: ${tenantId || 'all'}, page: ${page}, limit: ${limit})`,
    );

    // Validate and sanitize pagination parameters
    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    const take = Math.min(Math.max(1, limit), 100); // Max 100 per page

    // Build where clause
    const where: any = {
      sms_opt_out: true,
    };

    // Filter by tenant if provided
    if (tenantId) {
      where.tenant_id = tenantId;
    }

    // Fetch opted-out Leads with tenant info
    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        select: {
          id: true,
          tenant_id: true,
          first_name: true,
          last_name: true,
          sms_opt_out: true,
          sms_opt_out_at: true,
          sms_opt_out_reason: true,
          sms_opt_in_at: true,
          created_at: true,
          updated_at: true,
          tenant: {
            select: {
              id: true,
              company_name: true,
              subdomain: true,
            },
          },
          phones: {
            where: { is_primary: true },
            select: {
              phone: true,
              phone_type: true,
            },
            take: 1,
          },
        },
        orderBy: {
          sms_opt_out_at: 'desc',
        },
        skip,
        take,
      }),
      this.prisma.lead.count({ where }),
    ]);

    this.logger.log(
      `✅ Found ${total} opted-out Leads (returning ${leads.length})`,
    );

    return {
      data: leads.map((lead) => ({
        id: lead.id,
        tenant_id: lead.tenant_id,
        tenant: lead.tenant,
        first_name: lead.first_name,
        last_name: lead.last_name,
        phone: lead.phones[0]?.phone || null,
        phone_type: lead.phones[0]?.phone_type || null,
        sms_opt_out: lead.sms_opt_out,
        sms_opt_out_at: lead.sms_opt_out_at,
        sms_opt_out_reason: lead.sms_opt_out_reason,
        sms_opt_in_at: lead.sms_opt_in_at,
        created_at: lead.created_at,
        updated_at: lead.updated_at,
      })),
      meta: {
        total,
        page: Math.max(1, page),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Manually opt-in a Lead (override opt-out)
   *
   * System Admin can manually re-enable SMS for a Lead who has opted out.
   * Use case: Customer service resolved complaint, customer agrees to resume SMS.
   *
   * IMPORTANT: This bypasses user's opt-out preference - use with caution!
   * Only use when customer explicitly requests re-enrollment.
   *
   * Path Parameters:
   * - leadId: Lead UUID
   *
   * Query Parameters:
   * - tenant_id: Tenant ID (required for multi-tenant isolation)
   *
   * @returns Success confirmation
   */
  @Patch(':leadId/opt-in')
  @ApiOperation({
    summary: 'Manually opt-in a Lead (override opt-out)',
    description:
      'System Admin endpoint to manually re-enable SMS for a Lead. ' +
      'Use only when customer explicitly requests re-enrollment. ' +
      'Requires tenant_id for multi-tenant isolation.',
  })
  @ApiParam({
    name: 'leadId',
    description: 'Lead UUID',
    type: String,
  })
  @ApiQuery({
    name: 'tenant_id',
    required: true,
    description: 'Tenant ID (required for multi-tenant isolation)',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Lead successfully opted back in',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Missing tenant_id',
  })
  @ApiResponse({
    status: 404,
    description: 'Not Found - Lead not found',
  })
  async manualOptIn(
    @Param('leadId') leadId: string,
    @Query('tenant_id') tenantId: string,
  ) {
    this.logger.log(
      `Admin manually opting in Lead ${leadId} (tenant: ${tenantId})`,
    );

    // Validate tenant_id is provided
    if (!tenantId) {
      throw new BadRequestException('tenant_id query parameter is required');
    }

    // Verify Lead exists
    const lead = await this.prisma.lead.findUnique({
      where: {
        id: leadId,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        sms_opt_out: true,
      },
    });

    if (!lead) {
      throw new NotFoundException(
        `Lead ${leadId} not found for tenant ${tenantId}`,
      );
    }

    if (!lead.sms_opt_out) {
      this.logger.warn(`Lead ${leadId} is not opted out - no action needed`);
      return {
        success: true,
        message: 'Lead is already opted in to SMS',
        lead: {
          id: lead.id,
          first_name: lead.first_name,
          last_name: lead.last_name,
          sms_opt_out: false,
        },
      };
    }

    // Process opt-in
    await this.smsKeywordDetection.processOptIn(tenantId, leadId);

    this.logger.log(
      `✅ Admin manually opted in Lead ${leadId} for tenant ${tenantId}`,
    );

    return {
      success: true,
      message: 'Lead successfully opted back in to SMS',
      lead: {
        id: lead.id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        sms_opt_out: false,
      },
    };
  }
}
