import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  Query,
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
import { TenantEmailConfigService } from '../services/tenant-email-config.service';
import { CommunicationProviderService } from '../services/communication-provider.service';
import {
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

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'Get current tenant email configuration',
    description: 'Get tenant-specific email settings (credentials hidden)',
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

  @Post()
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Create or update tenant email configuration',
    description: 'Configure tenant-specific email settings with provider credentials',
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
    return this.tenantEmailConfigService.sendTestEmail(
      req.user.tenant_id,
      dto.to,
      req.user.id,
    );
  }
}
