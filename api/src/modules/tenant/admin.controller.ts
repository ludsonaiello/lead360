import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';

import { TenantService } from './services/tenant.service';
import { SubscriptionService } from './services/subscription.service';
import { LicenseTypeService } from './services/license-type.service';

import { CreateTenantDto } from './dto/create-tenant.dto';
import { CreateSubscriptionPlanDto } from './dto/create-subscription-plan.dto';
import { UpdateSubscriptionPlanDto } from './dto/update-subscription-plan.dto';
import { CreateLicenseTypeDto } from './dto/create-license-type.dto';
import { UpdateLicenseTypeDto } from './dto/update-license-type.dto';

/**
 * Admin Controller
 *
 * Platform admin endpoints for managing tenants, subscription plans, and license types.
 * All endpoints require Platform Admin role.
 *
 * CRITICAL: These endpoints bypass tenant resolution middleware and can access ALL tenant data.
 */
@ApiTags('Admin - Platform Management')
@ApiBearerAuth()
@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Platform Admin') // CRITICAL: Only Platform Admin can access
export class AdminController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly subscriptionService: SubscriptionService,
    private readonly licenseTypeService: LicenseTypeService,
  ) {}

  // ========== TENANT MANAGEMENT ==========

  @Get('tenants')
  @ApiOperation({ summary: 'List all tenants (admin-only)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page', example: 20 })
  @ApiQuery({ name: 'search', required: false, description: 'Search by company name or subdomain' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by subscription status' })
  @ApiResponse({ status: 200, description: 'Tenants retrieved successfully' })
  async getAllTenants(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { company_name: { contains: search, mode: 'insensitive' } },
        { subdomain: { contains: search, mode: 'insensitive' } },
        { legal_business_name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.subscription_status = status;
    }

    const [tenants, total] = await Promise.all([
      this.tenantService['prisma'].tenant.findMany({
        where,
        skip,
        take: limit,
        include: {
          subscription_plan: true,
          _count: {
            select: {
              users: true,
              addresses: true,
              licenses: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      this.tenantService['prisma'].tenant.count({ where }),
    ]);

    return {
      data: tenants,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  @Post('tenants')
  @ApiOperation({ summary: 'Create tenant (admin-only registration)' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  async createTenant(@Request() req, @Body() createTenantDto: CreateTenantDto) {
    return this.tenantService.create(createTenantDto);
  }

  @Patch('tenants/:id/subscription')
  @ApiOperation({ summary: 'Update tenant subscription plan (admin-only)' })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Subscription updated successfully' })
  async updateTenantSubscription(
    @Request() req,
    @Param('id', ParseUUIDPipe) tenantId: string,
    @Body('subscription_plan_id', ParseUUIDPipe) newPlanId: string,
  ) {
    return this.subscriptionService.updateTenantSubscription(
      tenantId,
      newPlanId,
      req.user.id,
    );
  }

  @Patch('tenants/:id/status')
  @ApiOperation({ summary: 'Suspend or activate tenant (admin-only)' })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Tenant status updated successfully' })
  async updateTenantStatus(
    @Request() req,
    @Param('id', ParseUUIDPipe) tenantId: string,
    @Body('action') action: 'suspend' | 'activate',
    @Body('reason') reason?: string,
  ) {
    if (action === 'suspend') {
      return this.tenantService.suspend(tenantId, reason || 'Suspended by admin', req.user.id);
    } else if (action === 'activate') {
      return this.tenantService.reactivate(tenantId, req.user.id);
    } else {
      throw new Error('Invalid action. Must be "suspend" or "activate"');
    }
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: 'Get tenant details (admin-only)' })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Tenant details retrieved' })
  async getTenantById(@Param('id', ParseUUIDPipe) tenantId: string) {
    return this.tenantService.findById(tenantId);
  }

  // ========== LICENSE TYPES MANAGEMENT ==========

  @Get('license-types')
  @ApiOperation({ summary: 'List all license types (admin-only)' })
  @ApiQuery({ name: 'include_inactive', required: false, description: 'Include inactive types' })
  @ApiResponse({ status: 200, description: 'License types retrieved successfully' })
  async getAllLicenseTypes(
    @Query('include_inactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
  ) {
    return this.licenseTypeService.findAll(includeInactive);
  }

  @Post('license-types')
  @ApiOperation({ summary: 'Create license type (admin-only)' })
  @ApiResponse({ status: 201, description: 'License type created successfully' })
  async createLicenseType(@Request() req, @Body() createDto: CreateLicenseTypeDto) {
    return this.licenseTypeService.create(createDto, req.user.id);
  }

  @Patch('license-types/:id')
  @ApiOperation({ summary: 'Update license type (admin-only)' })
  @ApiParam({ name: 'id', description: 'License type ID' })
  @ApiResponse({ status: 200, description: 'License type updated successfully' })
  async updateLicenseType(
    @Request() req,
    @Param('id', ParseUUIDPipe) licenseTypeId: string,
    @Body() updateDto: UpdateLicenseTypeDto,
  ) {
    return this.licenseTypeService.update(licenseTypeId, updateDto, req.user.id);
  }

  @Patch('license-types/:id/deactivate')
  @ApiOperation({ summary: 'Deactivate license type (admin-only)' })
  @ApiParam({ name: 'id', description: 'License type ID' })
  @ApiResponse({ status: 200, description: 'License type deactivated' })
  async deactivateLicenseType(@Request() req, @Param('id', ParseUUIDPipe) licenseTypeId: string) {
    return this.licenseTypeService.deactivate(licenseTypeId, req.user.id);
  }

  @Patch('license-types/:id/reactivate')
  @ApiOperation({ summary: 'Reactivate license type (admin-only)' })
  @ApiParam({ name: 'id', description: 'License type ID' })
  @ApiResponse({ status: 200, description: 'License type reactivated' })
  async reactivateLicenseType(@Request() req, @Param('id', ParseUUIDPipe) licenseTypeId: string) {
    return this.licenseTypeService.reactivate(licenseTypeId, req.user.id);
  }

  @Get('license-types/:id/usage')
  @ApiOperation({ summary: 'Get license type usage statistics (admin-only)' })
  @ApiParam({ name: 'id', description: 'License type ID' })
  @ApiResponse({ status: 200, description: 'Usage statistics retrieved' })
  async getLicenseTypeUsage(@Param('id', ParseUUIDPipe) licenseTypeId: string) {
    return this.licenseTypeService.getUsageStats(licenseTypeId);
  }

  // ========== SUBSCRIPTION PLANS MANAGEMENT ==========

  @Get('subscription-plans')
  @ApiOperation({ summary: 'List all subscription plans (admin-only)' })
  @ApiQuery({ name: 'include_inactive', required: false, description: 'Include inactive plans' })
  @ApiResponse({ status: 200, description: 'Subscription plans retrieved successfully' })
  async getAllSubscriptionPlans(
    @Query('include_inactive', new DefaultValuePipe(false), ParseBoolPipe) includeInactive: boolean,
  ) {
    return this.subscriptionService.findAllPlans(includeInactive);
  }

  @Post('subscription-plans')
  @ApiOperation({ summary: 'Create subscription plan (admin-only)' })
  @ApiResponse({ status: 201, description: 'Subscription plan created successfully' })
  async createSubscriptionPlan(@Request() req, @Body() createDto: CreateSubscriptionPlanDto) {
    return this.subscriptionService.createPlan(createDto, req.user.id);
  }

  @Patch('subscription-plans/:id')
  @ApiOperation({ summary: 'Update subscription plan (admin-only)' })
  @ApiParam({ name: 'id', description: 'Subscription plan ID' })
  @ApiResponse({ status: 200, description: 'Subscription plan updated successfully' })
  async updateSubscriptionPlan(
    @Request() req,
    @Param('id', ParseUUIDPipe) planId: string,
    @Body() updateDto: UpdateSubscriptionPlanDto,
  ) {
    return this.subscriptionService.updatePlan(planId, updateDto, req.user.id);
  }

  @Get('subscription-plans/:id/tenants')
  @ApiOperation({ summary: 'Get tenants using a subscription plan (admin-only)' })
  @ApiParam({ name: 'id', description: 'Subscription plan ID' })
  @ApiResponse({ status: 200, description: 'Tenants retrieved successfully' })
  async getTenantsUsingPlan(@Param('id', ParseUUIDPipe) planId: string) {
    return this.subscriptionService.getTenantsUsingPlan(planId);
  }

  // ========== DASHBOARD & ANALYTICS ==========

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Get platform-wide statistics (admin-only)' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getPlatformStats() {
    const [
      totalTenants,
      activeTenants,
      trialTenants,
      suspendedTenants,
      totalUsers,
    ] = await Promise.all([
      this.tenantService['prisma'].tenant.count(),
      this.tenantService['prisma'].tenant.count({ where: { subscription_status: 'active' } }),
      this.tenantService['prisma'].tenant.count({ where: { subscription_status: 'trial' } }),
      this.tenantService['prisma'].tenant.count({ where: { is_active: false } }),
      this.tenantService['prisma'].user.count(),
    ]);

    return {
      tenants: {
        total: totalTenants,
        active: activeTenants,
        trial: trialTenants,
        suspended: suspendedTenants,
      },
      users: {
        total: totalUsers,
      },
    };
  }
}
