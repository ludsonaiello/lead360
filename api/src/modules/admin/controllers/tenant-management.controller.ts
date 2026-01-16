import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { TenantManagementService } from '../services/tenant-management.service';
import { ServiceService } from '../../tenant/services/service.service';
import { TenantBusinessHoursService } from '../../tenant/services/tenant-business-hours.service';
import { TenantAddressService } from '../../tenant/services/tenant-address.service';
import { TenantLicenseService } from '../../tenant/services/tenant-license.service';
import { TenantInsuranceService } from '../../tenant/services/tenant-insurance.service';
import { CreateTenantManuallyDto, SuspendTenantDto, TenantListFiltersDto } from '../dto';
import { TenantServiceAreaService } from '../../tenant/services/tenant-service-area.service';
import { TenantPaymentTermsService } from '../../tenant/services/tenant-payment-terms.service';
import { TenantService } from '../../tenant/services/tenant.service';

@ApiTags('Admin - Tenant Management')
@ApiBearerAuth()
@Controller('admin/tenants')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class TenantManagementController {
  constructor(
    private readonly tenantManagementService: TenantManagementService,
    private readonly serviceService: ServiceService,
    private readonly tenantBusinessHoursService: TenantBusinessHoursService,
    private readonly tenantAddressService: TenantAddressService,
    private readonly tenantLicenseService: TenantLicenseService,
    private readonly tenantInsuranceService: TenantInsuranceService,
    private readonly tenantServiceAreaService: TenantServiceAreaService,
    private readonly tenantPaymentTermsService: TenantPaymentTermsService,
    private readonly tenantService: TenantService,
  ) {}

  /**
   * GET /admin/tenants
   * List all tenants with filters and pagination
   */
  @Get()
  @ApiOperation({ summary: 'List all tenants', description: 'Get paginated list of tenants with optional filters' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'suspended', 'deleted'] })
  @ApiQuery({ name: 'created_from', required: false, type: String, description: 'ISO date string' })
  @ApiQuery({ name: 'created_to', required: false, type: String, description: 'ISO date string' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search subdomain, company name, or email' })
  @ApiResponse({ status: 200, description: 'Tenants list retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async listTenants(@Query() filters: any) {
    return this.tenantManagementService.listTenants(filters);
  }

  /**
   * GET /admin/tenants/:id
   * Get tenant details with full relations
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get tenant details', description: 'Get full tenant details including users, stats, storage, and jobs' })
  @ApiParam({ name: 'id', description: 'Tenant ID (hex string)' })
  @ApiResponse({ status: 200, description: 'Tenant details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async getTenantDetails(@Param('id') id: string) {
    return this.tenantManagementService.getTenantDetails(id);
  }

  /**
   * POST /admin/tenants
   * Create tenant manually
   */
  @Post()
  @ApiOperation({ summary: 'Create tenant manually', description: 'Create new tenant with owner user by Platform Admin' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['subdomain', 'business_name', 'owner_email', 'owner_password', 'owner_first_name', 'owner_last_name'],
      properties: {
        subdomain: { type: 'string', example: 'acme-roofing', pattern: '^[a-z0-9-]{3,63}$' },
        business_name: { type: 'string', example: 'Acme Roofing LLC' },
        business_entity_type: { type: 'string', example: 'LLC', enum: ['LLC', 'Corporation', 'Sole Proprietorship', 'Partnership'] },
        state_of_registration: { type: 'string', example: 'NY' },
        ein: { type: 'string', example: '12-3456789', nullable: true },
        owner_email: { type: 'string', format: 'email', example: 'owner@acme-roofing.com' },
        owner_password: { type: 'string', format: 'password', example: 'SecurePass123!' },
        owner_first_name: { type: 'string', example: 'John' },
        owner_last_name: { type: 'string', example: 'Doe' },
        owner_phone: { type: 'string', example: '5551234567', nullable: true },
        skip_email_verification: { type: 'boolean', example: false, description: 'If true, owner account is activated immediately' },
      },
    },
  })
  @ApiBody({ type: CreateTenantManuallyDto })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'Subdomain or email already exists' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async createTenant(@Request() req, @Body() createDto: CreateTenantManuallyDto) {
    return this.tenantManagementService.createTenantManually(createDto, req.user.id);
  }

  /**
   * PATCH /admin/tenants/:id
   * Update tenant details
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update tenant', description: 'Update tenant information' })
  @ApiParam({ name: 'id', description: 'Tenant ID (UUID)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        company_name: { type: 'string', example: 'Acme Roofing LLC' },
        legal_business_name: { type: 'string', example: 'Acme Roofing Limited Liability Company' },
        business_entity_type: { type: 'string', example: 'LLC' },
        state_of_registration: { type: 'string', example: 'NY' },
        ein: { type: 'string', example: '12-3456789' },
        primary_contact_phone: { type: 'string', example: '5551234567' },
        primary_contact_email: { type: 'string', format: 'email', example: 'contact@acme-roofing.com' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async updateTenant(@Param('id') id: string, @Body() updateDto: any) {
    // Implementation would be added to service
    return { message: 'Update endpoint - to be implemented' };
  }

  /**
   * PATCH /admin/tenants/:id/suspend
   * Suspend tenant
   */
  @Patch(':id/suspend')
  @ApiOperation({ summary: 'Suspend tenant', description: 'Suspend tenant and invalidate all user sessions' })
  @ApiParam({ name: 'id', description: 'Tenant ID (UUID)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', example: 'Payment overdue', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Tenant suspended successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 409, description: 'Tenant is already suspended' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async suspendTenant(@Request() req, @Param('id') id: string, @Body() body?: { reason?: string }) {
    return this.tenantManagementService.suspendTenant(id, req.user.id, body?.reason);
  }

  /**
   * PATCH /admin/tenants/:id/activate
   * Activate tenant
   */
  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activate tenant', description: 'Reactivate a suspended tenant' })
  @ApiParam({ name: 'id', description: 'Tenant ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Tenant activated successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 409, description: 'Tenant is already active' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async activateTenant(@Request() req, @Param('id') id: string) {
    return this.tenantManagementService.activateTenant(id, req.user.id);
  }

  /**
   * DELETE /admin/tenants/:id
   * Soft delete tenant
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete tenant', description: 'Soft delete tenant (90-day retention period)' })
  @ApiParam({ name: 'id', description: 'Tenant ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Tenant deleted successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 409, description: 'Tenant is already deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async deleteTenant(@Request() req, @Param('id') id: string) {
    return this.tenantManagementService.deleteTenant(id, req.user.id);
  }

  /**
   * PATCH /admin/tenants/:id/restore
   * Restore tenant from trash (undo soft delete)
   */
  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore tenant', description: 'Restore soft-deleted tenant from trash' })
  @ApiParam({ name: 'id', description: 'Tenant ID (hex string)' })
  @ApiResponse({ status: 200, description: 'Tenant restored successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 409, description: 'Tenant is not deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async restoreTenant(@Request() req, @Param('id') id: string) {
    return this.tenantManagementService.restoreTenant(id, req.user.id);
  }

  /**
   * DELETE /admin/tenants/:id/permanent
   * Permanently delete tenant (hard delete - IRREVERSIBLE)
   */
  @Delete(':id/permanent')
  @ApiOperation({
    summary: 'Permanently delete tenant',
    description: 'DANGER: Permanently delete tenant and all related data. This action is IRREVERSIBLE. Use with extreme caution.',
  })
  @ApiParam({ name: 'id', description: 'Tenant ID (hex string)' })
  @ApiResponse({ status: 200, description: 'Tenant permanently deleted' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async permanentlyDeleteTenant(@Request() req, @Param('id') id: string) {
    return this.tenantManagementService.permanentlyDeleteTenant(id, req.user.id);
  }

  /**
   * GET /admin/tenants/:id/assigned-services
   * Get tenant's assigned services (admin view)
   */
  @Get(':id/assigned-services')
  @ApiOperation({ summary: 'Get tenant assigned services', description: 'Get services assigned to a specific tenant' })
  @ApiParam({ name: 'id', description: 'Tenant ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Assigned services retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async getTenantAssignedServices(@Param('id') tenantId: string) {
    return this.serviceService.getTenantServices(tenantId);
  }

  /**
   * GET /admin/tenants/:id/business-hours
   * Get tenant's business hours
   */
  @Get(':id/business-hours')
  @ApiOperation({ summary: 'Get tenant business hours', description: 'Get regular business hours for a specific tenant' })
  @ApiParam({ name: 'id', description: 'Tenant ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Business hours retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async getTenantBusinessHours(@Param('id') tenantId: string) {
    return this.tenantBusinessHoursService.findOrCreate(tenantId);
  }

  /**
   * GET /admin/tenants/:id/custom-hours
   * Get tenant's custom hours (holidays/special dates)
   */
  @Get(':id/custom-hours')
  @ApiOperation({ summary: 'Get tenant custom hours', description: 'Get custom business hours (holidays/special dates) for a specific tenant' })
  @ApiParam({ name: 'id', description: 'Tenant ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Custom hours retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async getTenantCustomHours(@Param('id') tenantId: string) {
    return this.tenantBusinessHoursService.findAllCustomHours(tenantId);
  }

  /**
   * GET /admin/tenants/:id/addresses
   * Get tenant's addresses
   */
  @Get(':id/addresses')
  @ApiOperation({ summary: 'Get tenant addresses', description: 'Get all addresses for a specific tenant' })
  @ApiParam({ name: 'id', description: 'Tenant ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Addresses retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async getTenantAddresses(@Param('id') tenantId: string) {
    return this.tenantAddressService.findAll(tenantId);
  }

  /**
   * GET /admin/tenants/:id/licenses
   * Get tenant's licenses
   */
  @Get(':id/licenses')
  @ApiOperation({ summary: 'Get tenant licenses', description: 'Get all licenses for a specific tenant' })
  @ApiParam({ name: 'id', description: 'Tenant ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Licenses retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async getTenantLicenses(@Param('id') tenantId: string) {
    return this.tenantLicenseService.findAll(tenantId);
  }

  /**
   * GET /admin/tenants/:id/insurance
   * Get tenant's insurance information
   */
  @Get(':id/insurance')
  @ApiOperation({ summary: 'Get tenant insurance', description: 'Get insurance information for a specific tenant' })
  @ApiParam({ name: 'id', description: 'Tenant ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Insurance retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async getTenantInsurance(@Param('id') tenantId: string) {
    return this.tenantInsuranceService.findOrCreate(tenantId);
  }

  /**
   * GET /admin/tenants/:id/service-areas
   * Get tenant's service areas
   */
  @Get(':id/service-areas')
  @ApiOperation({ summary: 'Get tenant service areas', description: 'Get all service areas for a specific tenant' })
  @ApiParam({ name: 'id', description: 'Tenant ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Service areas retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async getTenantServiceAreas(@Param('id') tenantId: string) {
    return this.tenantServiceAreaService.findAll(tenantId);
  }

  /**
   * GET /admin/tenants/:id/payment-terms
   * Get tenant's payment terms
   */
  @Get(':id/payment-terms')
  @ApiOperation({ summary: 'Get tenant payment terms', description: 'Get payment terms for a specific tenant' })
  @ApiParam({ name: 'id', description: 'Tenant ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Payment terms retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async getTenantPaymentTerms(@Param('id') tenantId: string) {
    return this.tenantPaymentTermsService.findOrCreate(tenantId);
  }

  /**
   * GET /admin/tenants/:id/statistics
   * Get tenant statistics (user count, active resources, etc.)
   */
  @Get(':id/statistics')
  @ApiOperation({ summary: 'Get tenant statistics', description: 'Get statistics for a specific tenant' })
  @ApiParam({ name: 'id', description: 'Tenant ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async getTenantStatistics(@Param('id') tenantId: string) {
    return this.tenantService.getStatistics(tenantId);
  }

  /**
   * PATCH /admin/tenants/:id/subscription
   * Change tenant's subscription plan
   */
  @Patch(':id/subscription')
  @ApiOperation({ summary: 'Change subscription plan', description: 'Change tenant subscription plan (admin-only)' })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['subscription_plan_id'],
      properties: {
        subscription_plan_id: { type: 'string', example: '4a9f36ba-ab93-4f3a-975a-be009f5aa5c6', description: 'New subscription plan UUID' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Subscription plan changed successfully' })
  @ApiResponse({ status: 404, description: 'Tenant or subscription plan not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async changeSubscriptionPlan(
    @Request() req,
    @Param('id') tenantId: string,
    @Body() body: { subscription_plan_id: string },
  ) {
    return this.tenantManagementService.changeSubscriptionPlan(tenantId, body.subscription_plan_id, req.user.id);
  }

  /**
   * PATCH /admin/tenants/:id/subscription-details
   * Update tenant subscription details (status, billing cycle, dates)
   */
  @Patch(':id/subscription-details')
  @ApiOperation({ summary: 'Update subscription details', description: 'Update subscription status, billing cycle, and dates (admin-only)' })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        subscription_status: { type: 'string', enum: ['trial', 'active', 'canceled'], example: 'active', nullable: true },
        trial_end_date: { type: 'string', format: 'date-time', example: '2026-02-15T00:00:00Z', nullable: true },
        billing_cycle: { type: 'string', enum: ['monthly', 'annual'], example: 'monthly', nullable: true },
        next_billing_date: { type: 'string', format: 'date-time', example: '2026-02-01T00:00:00Z', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Subscription details updated successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 400, description: 'Invalid subscription details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async updateSubscriptionDetails(
    @Request() req,
    @Param('id') tenantId: string,
    @Body() updateDto: any,
  ) {
    return this.tenantManagementService.updateSubscriptionDetails(tenantId, updateDto, req.user.id);
  }

  /**
   * GET /admin/tenants/:id/subscription-history
   * Get tenant subscription change history
   */
  @Get(':id/subscription-history')
  @ApiOperation({ summary: 'Get subscription history', description: 'Get subscription plan change history for a tenant (admin-only)' })
  @ApiParam({ name: 'id', description: 'Tenant ID' })
  @ApiResponse({ status: 200, description: 'Subscription history retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin access required' })
  async getSubscriptionHistory(@Param('id') tenantId: string) {
    return this.tenantManagementService.getSubscriptionHistory(tenantId);
  }
}
