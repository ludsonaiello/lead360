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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../rbac/guards/platform-admin.guard';
import { CurrentUser } from '../../../auth/decorators';
import type { AuthenticatedUser } from '../../../auth/entities/jwt-payload.entity';
import { CommunicationProviderService } from '../../services/communication-provider.service';
import {
  CreateProviderDto,
  UpdateProviderDto,
  FilterProvidersDto,
} from '../../dto/provider.dto';

/**
 * Communication Providers Admin Controller
 *
 * Platform Admin endpoints for managing communication providers.
 * Requires:
 * - JWT authentication
 * - Platform Admin privileges (is_platform_admin = true)
 *
 * Manages provider registry (SMTP, SendGrid, Amazon SES, Brevo, Twilio, etc.)
 */
@ApiTags('Admin - Communication Providers')
@Controller('admin/communication/providers')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@ApiBearerAuth()
export class CommunicationProvidersAdminController {
  constructor(
    private readonly providerService: CommunicationProviderService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List all communication providers (Platform Admin)',
    description:
      'Get all providers with optional filtering by type and active status',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['email', 'sms', 'call', 'whatsapp'],
    description: 'Filter by provider type',
  })
  @ApiQuery({
    name: 'is_active',
    required: false,
    type: Boolean,
    description: 'Filter by active status',
  })
  @ApiQuery({
    name: 'include_system',
    required: false,
    type: Boolean,
    description: 'Include system providers',
  })
  @ApiResponse({
    status: 200,
    description: 'Providers retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'prov-sendgrid-001' },
          provider_key: { type: 'string', example: 'sendgrid' },
          provider_name: { type: 'string', example: 'SendGrid' },
          provider_type: { type: 'string', example: 'email' },
          supports_webhooks: { type: 'boolean', example: true },
          is_active: { type: 'boolean', example: true },
          is_system: { type: 'boolean', example: true },
          created_at: { type: 'string', example: '2026-01-18T00:00:00.000Z' },
          _count: {
            type: 'object',
            properties: {
              platform_email_configs: { type: 'number', example: 1 },
              tenant_email_configs: { type: 'number', example: 5 },
              communication_events: { type: 'number', example: 123 },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Platform Admin privileges required' })
  async findAll(@Query() filters: FilterProvidersDto) {
    return this.providerService.findAll(filters);
  }

  @Get(':key')
  @ApiOperation({
    summary: 'Get provider by key (Platform Admin)',
    description: 'Get detailed provider information including JSON schemas',
  })
  @ApiParam({
    name: 'key',
    description: 'Provider key (e.g., sendgrid, twilio_sms)',
  })
  @ApiResponse({
    status: 200,
    description: 'Provider retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        provider_key: { type: 'string' },
        provider_name: { type: 'string' },
        provider_type: { type: 'string' },
        credentials_schema: { type: 'object' },
        config_schema: { type: 'object' },
        default_config: { type: 'object' },
        supports_webhooks: { type: 'boolean' },
        webhook_events: { type: 'array', items: { type: 'string' } },
        webhook_verification_method: { type: 'string' },
        documentation_url: { type: 'string' },
        logo_url: { type: 'string' },
        is_active: { type: 'boolean' },
        is_system: { type: 'boolean' },
        created_at: { type: 'string' },
        updated_at: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Platform Admin privileges required' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async findOne(@Param('key') key: string) {
    return this.providerService.getProvider(key);
  }

  @Post()
  @ApiOperation({
    summary: 'Create new provider (Platform Admin)',
    description: 'Add a new communication provider to the registry',
  })
  @ApiResponse({
    status: 201,
    description: 'Provider created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid JSON schema or validation error',
  })
  @ApiResponse({ status: 403, description: 'Platform Admin privileges required' })
  @ApiResponse({
    status: 409,
    description: 'Provider key already exists',
  })
  async create(
    @Body() createProviderDto: CreateProviderDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.providerService.create(createProviderDto, currentUser.id);
  }

  @Patch(':key')
  @ApiOperation({
    summary: 'Update provider (Platform Admin)',
    description: 'Update provider configuration and schemas',
  })
  @ApiParam({
    name: 'key',
    description: 'Provider key',
  })
  @ApiResponse({
    status: 200,
    description: 'Provider updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid JSON schema or validation error',
  })
  @ApiResponse({ status: 403, description: 'Platform Admin privileges required' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async update(
    @Param('key') key: string,
    @Body() updateProviderDto: UpdateProviderDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.providerService.update(key, updateProviderDto, currentUser.id);
  }

  @Patch(':key/toggle')
  @ApiOperation({
    summary: 'Toggle provider active status (Platform Admin)',
    description: 'Activate or deactivate a provider',
  })
  @ApiParam({
    name: 'key',
    description: 'Provider key',
  })
  @ApiResponse({
    status: 200,
    description: 'Provider status toggled successfully',
  })
  @ApiResponse({ status: 403, description: 'Platform Admin privileges required' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async toggleActive(
    @Param('key') key: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.providerService.toggleActive(key, currentUser.id);
  }

  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete provider (Platform Admin)',
    description: 'Delete a provider (cannot delete system providers or providers in use)',
  })
  @ApiParam({
    name: 'key',
    description: 'Provider key',
  })
  @ApiResponse({
    status: 204,
    description: 'Provider deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete system provider or provider in use',
  })
  @ApiResponse({ status: 403, description: 'Platform Admin privileges required' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async delete(
    @Param('key') key: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    await this.providerService.delete(key, currentUser.id);
  }

  @Get(':key/stats')
  @ApiOperation({
    summary: 'Get provider usage statistics (Platform Admin)',
    description: 'Get usage counts for provider across platform',
  })
  @ApiParam({
    name: 'key',
    description: 'Provider key',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        platform_configs: { type: 'number', example: 1 },
        tenant_configs: { type: 'number', example: 15 },
        total_events: { type: 'number', example: 1234 },
        events_last_24h: { type: 'number', example: 456 },
        failed_events_count: { type: 'number', example: 5 },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Platform Admin privileges required' })
  @ApiResponse({ status: 404, description: 'Provider not found' })
  async getStats(@Param('key') key: string) {
    return this.providerService.getStats(key);
  }
}
