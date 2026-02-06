import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { TenantService } from '../../tenant/services/tenant.service';

@ApiTags('Admin - Validation')
@ApiBearerAuth()
@Controller('admin/validation')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminValidationController {
  constructor(private readonly tenantService: TenantService) {}

  /**
   * GET /admin/validation/subdomain
   * Check if subdomain is available for new tenant creation
   * Used by admin panel when creating tenants manually
   */
  @Get('subdomain')
  @ApiOperation({ summary: 'Check subdomain availability' })
  @ApiQuery({
    name: 'subdomain',
    description: 'Subdomain to check (lowercase, alphanumeric with hyphens)',
    required: true,
    example: 'acme-roofing',
  })
  @ApiResponse({
    status: 200,
    description: 'Subdomain availability checked successfully',
    schema: {
      type: 'object',
      properties: {
        available: { type: 'boolean', example: true },
        subdomain: { type: 'string', example: 'acme-roofing' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid subdomain format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async checkSubdomainAvailability(@Query('subdomain') subdomain: string) {
    return this.tenantService.checkSubdomainAvailability(subdomain);
  }
}
