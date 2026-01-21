import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  UseGuards,
  Request,
  Query,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantEmailConfigService } from '../services/tenant-email-config.service';
import { CommunicationProviderService } from '../services/communication-provider.service';
import {
  CreateTenantEmailConfigDto,
  UpdateTenantEmailConfigDto,
  TestEmailConfigDto,
} from '../dto/email-config.dto';

/**
 * Tenant Email Config Controller
 *
 * Tenant-scoped endpoints for managing email configuration.
 * Each tenant can configure their own email provider for outbound emails.
 *
 * RBAC: View (all roles), Edit (Owner, Admin only)
 */
@ApiTags('Communication - Tenant Email Config')
@Controller('communication/tenant-email-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TenantEmailConfigController {
  constructor(
    private readonly tenantEmailConfigService: TenantEmailConfigService,
    private readonly providerService: CommunicationProviderService,
  ) {}

  @Get('providers')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'List available email providers',
    description: 'Get all active email providers that can be configured',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['email', 'sms', 'whatsapp'],
    description: 'Filter by provider type',
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
          credentials_schema: { type: 'object' },
          config_schema: { type: 'object' },
          default_config: { type: 'object' },
          supports_webhooks: { type: 'boolean', example: true },
          documentation_url: {
            type: 'string',
            example: 'https://docs.sendgrid.com',
          },
        },
      },
    },
  })
  async listProviders(@Query('type') type?: string) {
    return this.providerService.getActiveProviders(type);
  }

  @Get('configurations')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'List all email provider configurations',
    description: 'Get all provider configurations for this tenant (active provider listed first)',
  })
  @ApiResponse({
    status: 200,
    description: 'Configurations retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'config-001' },
          tenant_id: { type: 'string', example: 'tenant-acme-plumbing' },
          provider_id: { type: 'string', example: 'prov-sendgrid-001' },
          provider: {
            type: 'object',
            properties: {
              provider_key: { type: 'string', example: 'sendgrid' },
              provider_name: { type: 'string', example: 'SendGrid' },
            },
          },
          from_email: { type: 'string', example: 'info@acmeplumbing.com' },
          from_name: { type: 'string', example: 'Acme Plumbing' },
          reply_to_email: { type: 'string', example: 'support@acmeplumbing.com' },
          is_active: { type: 'boolean', example: true },
          is_verified: { type: 'boolean', example: true },
          created_at: { type: 'string', example: '2026-01-18T00:00:00.000Z' },
          updated_at: { type: 'string', example: '2026-01-18T00:00:00.000Z' },
        },
      },
    },
  })
  async listConfigurations(@Request() req) {
    return this.tenantEmailConfigService.listProviderConfigs(req.user.tenant_id);
  }

  @Get('configurations/active')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'Get active email provider configuration',
    description: 'Get the currently active provider configuration for this tenant',
  })
  @ApiResponse({
    status: 200,
    description: 'Active configuration retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'config-001' },
        tenant_id: { type: 'string', example: 'tenant-acme-plumbing' },
        provider_id: { type: 'string', example: 'prov-sendgrid-001' },
        provider: {
          type: 'object',
          properties: {
            provider_key: { type: 'string', example: 'sendgrid' },
            provider_name: { type: 'string', example: 'SendGrid' },
          },
        },
        from_email: { type: 'string', example: 'info@acmeplumbing.com' },
        from_name: { type: 'string', example: 'Acme Plumbing' },
        reply_to_email: { type: 'string', example: 'support@acmeplumbing.com' },
        is_active: { type: 'boolean', example: true },
        is_verified: { type: 'boolean', example: true },
        created_at: { type: 'string', example: '2026-01-18T00:00:00.000Z' },
        updated_at: { type: 'string', example: '2026-01-18T00:00:00.000Z' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'No active email provider configured',
  })
  async getActiveConfiguration(@Request() req) {
    return this.tenantEmailConfigService.getActiveProvider(req.user.tenant_id);
  }

  @Get('configurations/:configId')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Get specific provider configuration with credentials',
    description: 'Get a specific provider configuration including decrypted credentials (Owner/Admin only)',
  })
  @ApiParam({
    name: 'configId',
    description: 'Provider configuration ID',
    example: 'config-001',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration retrieved successfully with decrypted credentials',
  })
  @ApiResponse({
    status: 404,
    description: 'Configuration not found',
  })
  async getConfiguration(@Request() req, @Param('configId') configId: string) {
    return this.tenantEmailConfigService.getProviderConfig(req.user.tenant_id, configId);
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: '[DEPRECATED] Get current tenant email configuration',
    description: 'DEPRECATED: Use GET /configurations/active instead. Get tenant-specific email settings (credentials hidden)',
    deprecated: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'tenant-email-001' },
        tenant_id: { type: 'string', example: 'tenant-acme-plumbing' },
        provider_id: { type: 'string', example: 'prov-sendgrid-001' },
        provider: {
          type: 'object',
          properties: {
            provider_key: { type: 'string', example: 'sendgrid' },
            provider_name: { type: 'string', example: 'SendGrid' },
          },
        },
        from_email: { type: 'string', example: 'info@acmeplumbing.com' },
        from_name: { type: 'string', example: 'Acme Plumbing' },
        reply_to_email: { type: 'string', example: 'support@acmeplumbing.com' },
        is_verified: { type: 'boolean', example: true },
        is_active: { type: 'boolean', example: true },
        created_at: { type: 'string', example: '2026-01-18T00:00:00.000Z' },
        updated_at: { type: 'string', example: '2026-01-18T00:00:00.000Z' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Email configuration not found for this tenant',
  })
  async get(@Request() req) {
    return this.tenantEmailConfigService.get(req.user.tenant_id);
  }

  @Post('configurations')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Create new email provider configuration',
    description: 'Add a new email provider configuration for this tenant',
  })
  @ApiResponse({
    status: 201,
    description: 'Configuration created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'config-001' },
        tenant_id: { type: 'string', example: 'tenant-acme-plumbing' },
        provider_id: { type: 'string', example: 'prov-sendgrid-001' },
        from_email: { type: 'string', example: 'info@acmeplumbing.com' },
        from_name: { type: 'string', example: 'Acme Plumbing' },
        is_active: { type: 'boolean', example: true },
        is_verified: { type: 'boolean', example: false },
        created_at: { type: 'string', example: '2026-01-18T00:00:00.000Z' },
        updated_at: { type: 'string', example: '2026-01-18T00:00:00.000Z' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Provider configuration already exists or validation error',
  })
  @ApiResponse({
    status: 404,
    description: 'Provider not found',
  })
  async createConfiguration(
    @Request() req,
    @Body() dto: CreateTenantEmailConfigDto,
  ) {
    return this.tenantEmailConfigService.createProviderConfig(
      req.user.tenant_id,
      dto,
      req.user.id,
    );
  }

  @Patch('configurations/:configId')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Update email provider configuration',
    description: 'Update an existing email provider configuration',
  })
  @ApiParam({
    name: 'configId',
    description: 'Provider configuration ID',
    example: 'config-001',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Configuration not found',
  })
  async updateConfiguration(
    @Request() req,
    @Param('configId') configId: string,
    @Body() dto: UpdateTenantEmailConfigDto,
  ) {
    return this.tenantEmailConfigService.updateProviderConfig(
      req.user.tenant_id,
      configId,
      dto,
      req.user.id,
    );
  }

  @Patch('configurations/:configId/activate')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Set email provider as active',
    description: 'Activate this provider configuration for sending emails (deactivates others)',
  })
  @ApiParam({
    name: 'configId',
    description: 'Provider configuration ID',
    example: 'config-001',
  })
  @ApiResponse({
    status: 200,
    description: 'Provider activated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Configuration not found',
  })
  async activateConfiguration(
    @Request() req,
    @Param('configId') configId: string,
  ) {
    return this.tenantEmailConfigService.setActiveProvider(
      req.user.tenant_id,
      configId,
      req.user.id,
    );
  }

  @Delete('configurations/:configId')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Delete email provider configuration',
    description: 'Remove a provider configuration from this tenant',
  })
  @ApiParam({
    name: 'configId',
    description: 'Provider configuration ID',
    example: 'config-001',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Provider configuration deleted successfully' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Configuration not found',
  })
  async deleteConfiguration(
    @Request() req,
    @Param('configId') configId: string,
  ) {
    return this.tenantEmailConfigService.deleteProviderConfig(
      req.user.tenant_id,
      configId,
      req.user.id,
    );
  }

  @Post()
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: '[DEPRECATED] Create or update tenant email configuration',
    description: 'DEPRECATED: Use POST /configurations to create or PATCH /configurations/:id to update. Configure tenant-specific email settings with provider credentials',
    deprecated: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration created/updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'tenant-email-001' },
        tenant_id: { type: 'string', example: 'tenant-acme-plumbing' },
        provider_id: { type: 'string', example: 'prov-sendgrid-001' },
        from_email: { type: 'string', example: 'info@acmeplumbing.com' },
        from_name: { type: 'string', example: 'Acme Plumbing' },
        is_verified: { type: 'boolean', example: false },
        is_active: { type: 'boolean', example: true },
        created_at: { type: 'string', example: '2026-01-18T00:00:00.000Z' },
        updated_at: { type: 'string', example: '2026-01-18T00:00:00.000Z' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid credentials or validation error',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions (Owner, Admin only)',
  })
  @ApiResponse({
    status: 404,
    description: 'Provider not found',
  })
  async createOrUpdate(
    @Request() req,
    @Body() dto: UpdateTenantEmailConfigDto,
  ) {
    return this.tenantEmailConfigService.createOrUpdate(
      req.user.tenant_id,
      dto,
      req.user.id,
    );
  }

  @Post('test')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Send test email using tenant configuration',
    description: 'Test tenant email configuration by sending a test email',
  })
  @ApiResponse({
    status: 200,
    description: 'Test email sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Test email sent successfully' },
        provider_response: {
          type: 'object',
          properties: {
            messageId: { type: 'string', example: 'abc123' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Tenant email not configured',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions (Owner, Admin only)',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to send test email',
  })
  async sendTestEmail(@Request() req, @Body() dto: TestEmailConfigDto) {
    // Get active provider config to test
    const activeConfig = await this.tenantEmailConfigService.getActiveProvider(
      req.user.tenant_id,
    );

    return this.tenantEmailConfigService.sendTestEmail(
      req.user.tenant_id,
      activeConfig.id,
      dto.to,
      req.user.id,
    );
  }
}
