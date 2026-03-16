import {
  Controller,
  Get,
  Post,
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
  ApiParam,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Public } from '../../auth/decorators';
import { PortalAuthGuard } from '../guards';
import { CurrentPortalUser } from '../decorators';
import { PortalAuthService } from '../services/portal-auth.service';
import {
  PortalLoginDto,
  PortalChangePasswordDto,
  PortalForgotPasswordDto,
  PortalResetPasswordDto,
} from '../dto';
import type { AuthenticatedPortalUser } from '../entities/portal-jwt-payload.entity';

@ApiTags('Portal Authentication')
@Controller('portal/auth')
export class PortalAuthController {
  constructor(private readonly portalAuthService: PortalAuthService) {}

  @Get('tenant-info/:slug')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get tenant branding by subdomain slug (public, no auth)',
  })
  @ApiParam({
    name: 'slug',
    description: 'Tenant subdomain slug (e.g., "acmeplumbing")',
  })
  @ApiResponse({
    status: 200,
    description: 'Tenant branding returned',
    schema: {
      type: 'object',
      properties: {
        company_name: { type: 'string' },
        logo_file_id: { type: 'string', nullable: true },
        logo_url: { type: 'string', nullable: true },
        primary_color: { type: 'string', nullable: true },
        secondary_color: { type: 'string', nullable: true },
        accent_color: { type: 'string', nullable: true },
        phone: { type: 'string' },
        email: { type: 'string' },
        website: { type: 'string', nullable: true },
        address: {
          type: 'object',
          nullable: true,
          properties: {
            line1: { type: 'string' },
            line2: { type: 'string', nullable: true },
            city: { type: 'string' },
            state: { type: 'string' },
            zip_code: { type: 'string' },
            country: { type: 'string' },
          },
        },
        social_media: {
          type: 'object',
          properties: {
            instagram: { type: 'string', nullable: true },
            facebook: { type: 'string', nullable: true },
            tiktok: { type: 'string', nullable: true },
            youtube: { type: 'string', nullable: true },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async getTenantBranding(@Param('slug') slug: string) {
    return this.portalAuthService.getTenantBranding(slug);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Customer portal login' })
  @ApiBody({ type: PortalLoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful — returns portal JWT token',
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string' },
        customer_slug: { type: 'string' },
        must_change_password: { type: 'boolean' },
        lead: {
          type: 'object',
          properties: {
            first_name: { type: 'string' },
            last_name: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: PortalLoginDto) {
    return this.portalAuthService.login(dto.tenant_slug, dto.email, dto.password);
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset for portal account' })
  @ApiBody({ type: PortalForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Reset email sent (if account exists)',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  async forgotPassword(@Body() dto: PortalForgotPasswordDto) {
    return this.portalAuthService.requestPasswordReset(
      dto.tenant_slug,
      dto.email,
    );
  }

  @Post('reset-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token from email' })
  @ApiBody({ type: PortalResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password reset successful',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  async resetPassword(@Body() dto: PortalResetPasswordDto) {
    return this.portalAuthService.resetPassword(dto.token, dto.new_password);
  }

  @Post('change-password')
  @Public() // Bypass global JwtAuthGuard — PortalAuthGuard handles auth for this endpoint
  @UseGuards(PortalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password (portal token required)' })
  @ApiBody({ type: PortalChangePasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Current password incorrect or validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing portal token' })
  async changePassword(
    @CurrentPortalUser() user: AuthenticatedPortalUser,
    @Body() dto: PortalChangePasswordDto,
  ) {
    return this.portalAuthService.changePassword(
      user.portal_account_id,
      user.tenant_id,
      dto.old_password,
      dto.new_password,
    );
  }
}
