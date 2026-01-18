import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../rbac/guards/platform-admin.guard';
import { CurrentUser } from '../../../auth/decorators';
import type { AuthenticatedUser } from '../../../auth/entities/jwt-payload.entity';
import { PlatformEmailConfigService } from '../../services/platform-email-config.service';
import {
  UpdatePlatformEmailConfigDto,
  TestEmailConfigDto,
} from '../../dto/email-config.dto';

/**
 * Platform Email Config Admin Controller
 *
 * Platform Admin endpoints for managing platform-wide email configuration.
 * This is used for system emails (password reset, welcome, etc.)
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

  @Get()
  @ApiOperation({
    summary: 'Get platform email configuration (Platform Admin)',
    description: 'Get current platform-wide email settings',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'platform-email-config-001' },
        provider_id: { type: 'string', example: 'prov-sendgrid-001' },
        provider: {
          type: 'object',
          properties: {
            provider_key: { type: 'string', example: 'sendgrid' },
            provider_name: { type: 'string', example: 'SendGrid' },
            provider_type: { type: 'string', example: 'email' },
          },
        },
        from_email: { type: 'string', example: 'noreply@lead360.app' },
        from_name: { type: 'string', example: 'Lead360 Platform' },
        reply_to_email: { type: 'string', example: 'support@lead360.app' },
        is_verified: { type: 'boolean', example: true },
        is_active: { type: 'boolean', example: true },
        created_at: { type: 'string', example: '2026-01-18T00:00:00.000Z' },
        updated_at: { type: 'string', example: '2026-01-18T00:00:00.000Z' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  async get() {
    return this.platformEmailConfigService.get();
  }

  @Post()
  @ApiOperation({
    summary: 'Create or update platform email configuration (Platform Admin)',
    description: 'Configure platform-wide email settings with provider credentials',
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
    status: 403,
    description: 'Platform Admin privileges required',
  })
  @ApiResponse({
    status: 404,
    description: 'Provider not found',
  })
  async createOrUpdate(
    @Body() dto: UpdatePlatformEmailConfigDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.platformEmailConfigService.createOrUpdate(dto, currentUser.id);
  }

  @Post('test')
  @ApiOperation({
    summary: 'Send test email using platform configuration (Platform Admin)',
    description: 'Test platform email configuration by sending a test email',
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
    description: 'Platform email not configured',
  })
  @ApiResponse({
    status: 403,
    description: 'Platform Admin privileges required',
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to send test email',
  })
  async sendTestEmail(
    @Body() dto: TestEmailConfigDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.platformEmailConfigService.sendTestEmail(
      dto.to,
      currentUser.id,
    );
  }
}
