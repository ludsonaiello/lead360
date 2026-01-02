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
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FeatureFlagGuard } from './guards/feature-flag.guard';

import { TenantService } from './services/tenant.service';
import { TenantAddressService } from './services/tenant-address.service';
import { TenantLicenseService } from './services/tenant-license.service';
import { TenantInsuranceService } from './services/tenant-insurance.service';
import { TenantPaymentTermsService } from './services/tenant-payment-terms.service';
import { TenantBusinessHoursService } from './services/tenant-business-hours.service';
import { TenantServiceAreaService } from './services/tenant-service-area.service';

import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateBrandingDto } from './dto/update-branding.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { CreateLicenseDto } from './dto/create-license.dto';
import { UpdateLicenseDto } from './dto/update-license.dto';
import { UpdateInsuranceDto } from './dto/update-insurance.dto';
import { UpdatePaymentTermsDto } from './dto/update-payment-terms.dto';
import { UpdateBusinessHoursDto } from './dto/update-business-hours.dto';
import { CreateCustomHoursDto } from './dto/create-custom-hours.dto';
import { UpdateCustomHoursDto } from './dto/update-custom-hours.dto';
import { CreateServiceAreaDto } from './dto/create-service-area.dto';
import { UpdateServiceAreaDto } from './dto/update-service-area.dto';

@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('api/v1/tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly addressService: TenantAddressService,
    private readonly licenseService: TenantLicenseService,
    private readonly insuranceService: TenantInsuranceService,
    private readonly paymentTermsService: TenantPaymentTermsService,
    private readonly businessHoursService: TenantBusinessHoursService,
    private readonly serviceAreaService: TenantServiceAreaService,
  ) {}

  // ========== TENANT PROFILE ==========

  @Get('current')
  @ApiOperation({ summary: 'Get current tenant profile (from subdomain)' })
  @ApiResponse({ status: 200, description: 'Tenant profile retrieved successfully' })
  async getCurrentTenant(@Request() req) {
    return this.tenantService.findById(req.tenant_id);
  }

  @Patch('current')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Update current tenant profile' })
  @ApiResponse({ status: 200, description: 'Tenant profile updated successfully' })
  async updateCurrentTenant(@Request() req, @Body() updateTenantDto: UpdateTenantDto) {
    return this.tenantService.update(req.tenant_id, updateTenantDto, req.user.id);
  }

  @Patch('current/branding')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Update tenant branding settings' })
  @ApiResponse({ status: 200, description: 'Branding updated successfully' })
  async updateBranding(@Request() req, @Body() brandingDto: UpdateBrandingDto) {
    return this.tenantService.updateBranding(req.tenant_id, brandingDto, req.user.id);
  }

  @Get('current/statistics')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Get tenant statistics for dashboard' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStatistics(@Request() req) {
    return this.tenantService.getStatistics(req.tenant_id);
  }

  @Post('current/logo')
  @Roles('Owner', 'Admin')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload tenant logo' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Logo file upload',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Logo file (PNG, JPG, JPEG, SVG - max 5MB)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Logo uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  async uploadLogo(@Request() req, @UploadedFile() file: Express.Multer.File) {
    return this.tenantService.uploadLogo(req.tenant_id, file);
  }

  @Get('check-subdomain')
  @ApiOperation({ summary: 'Check subdomain availability (public endpoint)' })
  @ApiQuery({ name: 'subdomain', description: 'Subdomain to check' })
  @ApiResponse({ status: 200, description: 'Availability checked' })
  async checkSubdomainAvailability(@Query('subdomain') subdomain: string) {
    return this.tenantService.checkSubdomainAvailability(subdomain);
  }

  // ========== ADDRESSES ==========

  @Get('current/addresses')
  @ApiOperation({ summary: 'Get all addresses for current tenant' })
  @ApiResponse({ status: 200, description: 'Addresses retrieved successfully' })
  async getAddresses(@Request() req) {
    return this.addressService.findAll(req.tenant_id);
  }

  @Post('current/addresses')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Create a new address' })
  @ApiResponse({ status: 201, description: 'Address created successfully' })
  async createAddress(@Request() req, @Body() createAddressDto: CreateAddressDto) {
    return this.addressService.create(req.tenant_id, createAddressDto, req.user.id);
  }

  @Get('current/addresses/:id')
  @ApiOperation({ summary: 'Get a specific address by ID' })
  @ApiParam({ name: 'id', description: 'Address ID' })
  @ApiResponse({ status: 200, description: 'Address retrieved successfully' })
  async getAddress(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.addressService.findOne(req.tenant_id, id);
  }

  @Patch('current/addresses/:id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Update an address' })
  @ApiParam({ name: 'id', description: 'Address ID' })
  @ApiResponse({ status: 200, description: 'Address updated successfully' })
  async updateAddress(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    return this.addressService.update(req.tenant_id, id, updateAddressDto, req.user.id);
  }

  @Delete('current/addresses/:id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an address' })
  @ApiParam({ name: 'id', description: 'Address ID' })
  @ApiResponse({ status: 204, description: 'Address deleted successfully' })
  async deleteAddress(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.addressService.delete(req.tenant_id, id, req.user.id);
  }

  @Patch('current/addresses/:id/set-default')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Set an address as default for its type' })
  @ApiParam({ name: 'id', description: 'Address ID' })
  @ApiResponse({ status: 200, description: 'Address set as default' })
  async setDefaultAddress(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.addressService.setAsDefault(req.tenant_id, id, req.user.id);
  }

  // ========== LICENSES ==========

  @Get('current/licenses')
  @ApiOperation({ summary: 'Get all licenses for current tenant' })
  @ApiResponse({ status: 200, description: 'Licenses retrieved successfully' })
  async getLicenses(@Request() req) {
    return this.licenseService.findAll(req.tenant_id);
  }

  @Post('current/licenses')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Create a new license' })
  @ApiResponse({ status: 201, description: 'License created successfully' })
  async createLicense(@Request() req, @Body() createLicenseDto: CreateLicenseDto) {
    return this.licenseService.create(req.tenant_id, createLicenseDto, req.user.id);
  }

  @Get('current/licenses/:id')
  @ApiOperation({ summary: 'Get a specific license by ID' })
  @ApiParam({ name: 'id', description: 'License ID' })
  @ApiResponse({ status: 200, description: 'License retrieved successfully' })
  async getLicense(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.licenseService.findOne(req.tenant_id, id);
  }

  @Patch('current/licenses/:id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Update a license' })
  @ApiParam({ name: 'id', description: 'License ID' })
  @ApiResponse({ status: 200, description: 'License updated successfully' })
  async updateLicense(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLicenseDto: UpdateLicenseDto,
  ) {
    return this.licenseService.update(req.tenant_id, id, updateLicenseDto, req.user.id);
  }

  @Delete('current/licenses/:id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a license' })
  @ApiParam({ name: 'id', description: 'License ID' })
  @ApiResponse({ status: 204, description: 'License deleted successfully' })
  async deleteLicense(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.licenseService.delete(req.tenant_id, id, req.user.id);
  }

  @Get('current/licenses/:id/status')
  @ApiOperation({ summary: 'Get license status (expired, expiring soon, valid)' })
  @ApiParam({ name: 'id', description: 'License ID' })
  @ApiResponse({ status: 200, description: 'License status retrieved' })
  async getLicenseStatus(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.licenseService.getLicenseStatus(req.tenant_id, id);
  }

  // ========== INSURANCE ==========

  @Get('current/insurance')
  @ApiOperation({ summary: 'Get insurance information for current tenant' })
  @ApiResponse({ status: 200, description: 'Insurance information retrieved successfully' })
  async getInsurance(@Request() req) {
    return this.insuranceService.findOrCreate(req.tenant_id);
  }

  @Patch('current/insurance')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Update insurance information' })
  @ApiResponse({ status: 200, description: 'Insurance information updated successfully' })
  async updateInsurance(@Request() req, @Body() updateInsuranceDto: UpdateInsuranceDto) {
    return this.insuranceService.update(req.tenant_id, updateInsuranceDto, req.user.id);
  }

  @Get('current/insurance/status')
  @ApiOperation({ summary: 'Get insurance status (GL and WC)' })
  @ApiResponse({ status: 200, description: 'Insurance status retrieved' })
  async getInsuranceStatus(@Request() req) {
    return this.insuranceService.getInsuranceStatus(req.tenant_id);
  }

  @Get('current/insurance/coverage')
  @ApiOperation({ summary: 'Check if both GL and WC insurance are valid' })
  @ApiResponse({ status: 200, description: 'Coverage status retrieved' })
  async checkInsuranceCoverage(@Request() req) {
    return this.insuranceService.checkCoverage(req.tenant_id);
  }

  // ========== PAYMENT TERMS ==========

  @Get('current/payment-terms')
  @ApiOperation({ summary: 'Get payment terms for current tenant' })
  @ApiResponse({ status: 200, description: 'Payment terms retrieved successfully' })
  async getPaymentTerms(@Request() req) {
    return this.paymentTermsService.findOrCreate(req.tenant_id);
  }

  @Patch('current/payment-terms')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Update payment terms' })
  @ApiResponse({ status: 200, description: 'Payment terms updated successfully' })
  async updatePaymentTerms(@Request() req, @Body() updatePaymentTermsDto: UpdatePaymentTermsDto) {
    return this.paymentTermsService.update(req.tenant_id, updatePaymentTermsDto, req.user.id);
  }

  @Get('payment-terms/templates')
  @ApiOperation({ summary: 'Get default payment term templates' })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully' })
  getPaymentTermTemplates() {
    return this.paymentTermsService.getDefaultTemplate();
  }

  // ========== BUSINESS HOURS ==========

  @Get('current/business-hours')
  @ApiOperation({ summary: 'Get business hours for current tenant' })
  @ApiResponse({ status: 200, description: 'Business hours retrieved successfully' })
  async getBusinessHours(@Request() req) {
    return this.businessHoursService.findOrCreate(req.tenant_id);
  }

  @Patch('current/business-hours')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Update business hours' })
  @ApiResponse({ status: 200, description: 'Business hours updated successfully' })
  async updateBusinessHours(@Request() req, @Body() updateBusinessHoursDto: UpdateBusinessHoursDto) {
    return this.businessHoursService.update(req.tenant_id, updateBusinessHoursDto, req.user.id);
  }

  // ========== CUSTOM HOURS (Holidays, Special Dates) ==========

  @Get('current/custom-hours')
  @ApiOperation({ summary: 'Get all custom hours (holidays, special dates)' })
  @ApiResponse({ status: 200, description: 'Custom hours retrieved successfully' })
  async getCustomHours(@Request() req) {
    return this.businessHoursService.findAllCustomHours(req.tenant_id);
  }

  @Post('current/custom-hours')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Create custom hours for a special date' })
  @ApiResponse({ status: 201, description: 'Custom hours created successfully' })
  async createCustomHours(@Request() req, @Body() createCustomHoursDto: CreateCustomHoursDto) {
    return this.businessHoursService.createCustomHours(req.tenant_id, createCustomHoursDto, req.user.id);
  }

  @Patch('current/custom-hours/:id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Update custom hours' })
  @ApiParam({ name: 'id', description: 'Custom hours ID' })
  @ApiResponse({ status: 200, description: 'Custom hours updated successfully' })
  async updateCustomHours(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCustomHoursDto: UpdateCustomHoursDto,
  ) {
    return this.businessHoursService.updateCustomHours(req.tenant_id, id, updateCustomHoursDto, req.user.id);
  }

  @Delete('current/custom-hours/:id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete custom hours' })
  @ApiParam({ name: 'id', description: 'Custom hours ID' })
  @ApiResponse({ status: 204, description: 'Custom hours deleted successfully' })
  async deleteCustomHours(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.businessHoursService.deleteCustomHours(req.tenant_id, id, req.user.id);
  }

  // ========== SERVICE AREAS ==========

  @Get('current/service-areas')
  @ApiOperation({ summary: 'Get all service areas for current tenant' })
  @ApiResponse({ status: 200, description: 'Service areas retrieved successfully' })
  async getServiceAreas(@Request() req) {
    return this.serviceAreaService.findAll(req.tenant_id);
  }

  @Post('current/service-areas')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Create a new service area' })
  @ApiResponse({ status: 201, description: 'Service area created successfully' })
  async createServiceArea(@Request() req, @Body() createServiceAreaDto: CreateServiceAreaDto) {
    return this.serviceAreaService.create(req.tenant_id, createServiceAreaDto, req.user.id);
  }

  @Get('current/service-areas/:id')
  @ApiOperation({ summary: 'Get a specific service area by ID' })
  @ApiParam({ name: 'id', description: 'Service area ID' })
  @ApiResponse({ status: 200, description: 'Service area retrieved successfully' })
  async getServiceArea(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.serviceAreaService.findOne(req.tenant_id, id);
  }

  @Patch('current/service-areas/:id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Update a service area' })
  @ApiParam({ name: 'id', description: 'Service area ID' })
  @ApiResponse({ status: 200, description: 'Service area updated successfully' })
  async updateServiceArea(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateServiceAreaDto: UpdateServiceAreaDto,
  ) {
    return this.serviceAreaService.update(req.tenant_id, id, updateServiceAreaDto, req.user.id);
  }

  @Delete('current/service-areas/:id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a service area' })
  @ApiParam({ name: 'id', description: 'Service area ID' })
  @ApiResponse({ status: 204, description: 'Service area deleted successfully' })
  async deleteServiceArea(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.serviceAreaService.delete(req.tenant_id, id, req.user.id);
  }

  @Get('current/service-areas/check-coverage')
  @ApiOperation({ summary: 'Check if a location is covered by service areas' })
  @ApiQuery({ name: 'lat', description: 'Latitude' })
  @ApiQuery({ name: 'long', description: 'Longitude' })
  @ApiResponse({ status: 200, description: 'Coverage status retrieved' })
  async checkServiceCoverage(
    @Request() req,
    @Query('lat', new DefaultValuePipe(0), ParseIntPipe) lat: number,
    @Query('long', new DefaultValuePipe(0), ParseIntPipe) long: number,
  ) {
    return this.serviceAreaService.checkCoverage(req.tenant_id, lat, long);
  }
}
