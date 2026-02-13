import { Controller, Get, Query, UseGuards, Req, Logger } from '@nestjs/common';
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
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * Tenant SMS Opt-Out Viewing Controller
 *
 * RBAC: Owner, Admin, Manager, Sales, Employee (all tenant roles)
 *
 * Features:
 * - View opted-out Leads within current tenant
 * - Pagination support
 * - Multi-tenant isolation via req.user.tenant_id
 *
 * Purpose: Allow tenant users to see which Leads have opted out of SMS
 *
 * Endpoints:
 * - GET /communication/sms/opt-outs - List opted-out Leads for current tenant
 */
@ApiTags('Communication - SMS Opt-Out Management')
@Controller('communication/sms/opt-outs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
@ApiBearerAuth()
export class SmsOptOutController {
  private readonly logger = new Logger(SmsOptOutController.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get opted-out Leads for current tenant
   *
   * Returns Leads within tenant who have opted out of SMS (replied STOP).
   * CRITICAL: Multi-tenant isolation enforced via req.user.tenant_id.
   *
   * Query Parameters:
   * - page (optional): Page number (default: 1)
   * - limit (optional): Results per page (default: 20, max: 100)
   *
   * @param req - Express request object (contains user.tenant_id from JWT)
   * @returns Paginated list of opted-out Leads
   */
  @Get()
  @ApiOperation({
    summary: 'List opted-out Leads for current tenant',
    description:
      'Returns all Leads within your tenant who have opted out of SMS communications. ' +
      "Multi-tenant isolation is enforced - you can only see your own tenant's opt-outs.",
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
    description: 'Forbidden - Requires tenant role',
  })
  async getOptedOutLeads(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    // CRITICAL: Use tenant_id from JWT token for multi-tenant isolation
    const tenantId = req.user.tenant_id;

    this.logger.log(
      `Fetching opted-out Leads for tenant ${tenantId} (page: ${page}, limit: ${limit})`,
    );

    // Validate and sanitize pagination parameters
    const skip = (Math.max(1, page) - 1) * Math.max(1, limit);
    const take = Math.min(Math.max(1, limit), 100); // Max 100 per page

    // Build where clause with tenant isolation
    const where = {
      tenant_id: tenantId, // Multi-tenant isolation MANDATORY
      sms_opt_out: true,
    };

    // Fetch opted-out Leads
    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        select: {
          id: true,
          first_name: true,
          last_name: true,
          sms_opt_out: true,
          sms_opt_out_at: true,
          sms_opt_out_reason: true,
          sms_opt_in_at: true,
          created_at: true,
          updated_at: true,
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
      `✅ Found ${total} opted-out Leads for tenant ${tenantId} (returning ${leads.length})`,
    );

    return {
      data: leads.map((lead) => ({
        id: lead.id,
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
}
