import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../rbac/guards/platform-admin.guard';
import { CurrentUser } from '../../../auth/decorators';
import type { AuthenticatedUser } from '../../../auth/entities/jwt-payload.entity';
import { PlatformEmailConfigService } from '../../services/platform-email-config.service';
import {
  CreatePlatformEmailConfigDto,
  UpdatePlatformEmailConfigDto,
  TestEmailConfigDto,
} from '../../dto/email-config.dto';

/**
 * Platform Email Config Admin Controller
 *
 * Platform Admin endpoints for managing platform-wide email configurations.
 * This is used for system emails (password reset, welcome, etc.)
 *
 * NOW SUPPORTS MULTI-PROVIDER:
 * - Configure multiple email providers (SendGrid, Brevo, Amazon SES, SMTP)
 * - Switch between providers easily
 * - Only one provider active at a time
 *
 * Requires:
 * - JWT authentication
 * - Platform Admin privileges (is_platform_admin = true)
 */
@ApiTags('Admin - Platform Email Config')
@Controller('admin/communication/platform-email-config')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@ApiBearerAuth()
export class PlatformEmailConfigAdminController {
  constructor(
    private readonly platformEmailConfigService: PlatformEmailConfigService,
  ) {}

  /**
   * List all platform email configurations
   */
  @Get('configurations')
  @ApiOperation({
    summary: 'List all platform email configurations (Platform Admin)',
    description: 'Get all configured email providers for the platform',
  })
  @ApiResponse({
    status: 200,
    description: 'Configurations retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'cfg-001' },
          provider_id: { type: 'string', example: 'prov-sendgrid-001' },
          provider: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              provider_key: { type: 'string', example: 'sendgrid' },
              provider_name: { type: 'string', example: 'SendGrid' },
              provider_type: { type: 'string', example: 'email' },
              is_active: { type: 'boolean', example: true },
            },
          },
          from_email: { type: 'string', example: 'noreply@lead360.app' },
          from_name: { type: 'string', example: 'Lead360 Platform' },
          reply_to_email: { type: 'string', example: 'support@lead360.app' },
          is_active: { type: 'boolean', example: true },
          is_verified: { type: 'boolean', example: true },
          credentials_configured: { type: 'boolean', example: true },
          created_at: { type: 'string' },
          updated_at: { type: 'string' },
        },
      },
    },
  })
  async listConfigurations() {
    return this.platformEmailConfigService.listConfigurations();
  }

  /**
   * Get active platform email configuration
   */
  @Get('configurations/active')
  @ApiOperation({
    summary: 'Get active platform email configuration (Platform Admin)',
    description: 'Get the currently active email provider for the platform',
  })
  @ApiResponse({
    status: 200,
    description: 'Active configuration retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'No active configuration found',
  })
  async getActiveConfiguration() {
    return this.platformEmailConfigService.getActiveConfiguration();
  }

  /**
   * Get specific platform email configuration (with full credentials)
   */
  @Get('configurations/:configId')
  @ApiOperation({
    summary: 'Get specific platform email configuration (Platform Admin)',
    description: 'Get full configuration including decrypted credentials',
  })
  @ApiParam({
    name: 'configId',
    description: 'Configuration ID',
    example: 'cfg-001',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration retrieved successfully (includes credentials)',
  })
  @ApiResponse({
    status: 404,
    description: 'Configuration not found',
  })
  async getConfiguration(@Param('configId') configId: string) {
    return this.platformEmailConfigService.getConfiguration(configId);
  }

  /**
   * Create new platform email configuration
   */
  @Post('configurations')
  @ApiOperation({
    summary: 'Create platform email configuration (Platform Admin)',
    description: 'Add a new email provider configuration for the platform',
  })
  @ApiResponse({
    status: 201,
    description: 'Configuration created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid credentials or validation error',
  })
  @ApiResponse({
    status: 409,
    description: 'Configuration already exists for this provider',
  })
  async createConfiguration(
    @Body() dto: CreatePlatformEmailConfigDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.platformEmailConfigService.createConfiguration(dto, currentUser.id);
  }

  /**
   * Update platform email configuration
   */
  @Patch('configurations/:configId')
  @ApiOperation({
    summary: 'Update platform email configuration (Platform Admin)',
    description: 'Update an existing email provider configuration',
  })
  @ApiParam({
    name: 'configId',
    description: 'Configuration ID',
    example: 'cfg-001',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid credentials or validation error',
  })
  @ApiResponse({
    status: 404,
    description: 'Configuration not found',
  })
  async updateConfiguration(
    @Param('configId') configId: string,
    @Body() dto: UpdatePlatformEmailConfigDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.platformEmailConfigService.updateConfiguration(
      configId,
      dto,
      currentUser.id,
    );
  }

  /**
   * Activate platform email configuration
   */
  @Post('configurations/:configId/activate')
  @ApiOperation({
    summary: 'Activate platform email configuration (Platform Admin)',
    description: 'Set this configuration as the active provider (deactivates all others)',
  })
  @ApiParam({
    name: 'configId',
    description: 'Configuration ID',
    example: 'cfg-001',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration activated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Configuration not found',
  })
  async activateConfiguration(
    @Param('configId') configId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.platformEmailConfigService.activateConfiguration(
      configId,
      currentUser.id,
    );
  }

  /**
   * Delete platform email configuration
   */
  @Delete('configurations/:configId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete platform email configuration (Platform Admin)',
    description: 'Remove an email provider configuration (cannot delete active config)',
  })
  @ApiParam({
    name: 'configId',
    description: 'Configuration ID',
    example: 'cfg-001',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete active configuration',
  })
  @ApiResponse({
    status: 404,
    description: 'Configuration not found',
  })
  async deleteConfiguration(
    @Param('configId') configId: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.platformEmailConfigService.deleteConfiguration(configId, currentUser.id);
  }

  /**
   * Test platform email configuration
   */
  @Post('configurations/:configId/test')
  @ApiOperation({
    summary: 'Test platform email configuration (Platform Admin)',
    description: 'Send a test email using a specific configuration',
  })
  @ApiParam({
    name: 'configId',
    description: 'Configuration ID',
    example: 'cfg-001',
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
    status: 404,
    description: 'Configuration not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to send test email',
  })
  async sendTestEmail(
    @Param('configId') configId: string,
    @Body() dto: TestEmailConfigDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.platformEmailConfigService.sendTestEmail(
      configId,
      dto.to,
      currentUser.id,
    );
  }
}
