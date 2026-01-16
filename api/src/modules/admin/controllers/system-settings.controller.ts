import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { FeatureFlagService } from '../services/feature-flag.service';
import { MaintenanceModeService } from '../services/maintenance-mode.service';
import { SystemSettingService } from '../services/system-setting.service';

@ApiTags('Admin - System Settings')
@ApiBearerAuth()
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class SystemSettingsController {
  constructor(
    private readonly featureFlagService: FeatureFlagService,
    private readonly maintenanceModeService: MaintenanceModeService,
    private readonly systemSettingService: SystemSettingService,
  ) {}

  /**
   * GET /admin/settings/feature-flags
   */
  @Get('feature-flags')
  @ApiOperation({ summary: 'Get all feature flags' })
  @ApiResponse({ status: 200, description: 'Feature flags retrieved' })
  async getFeatureFlags() {
    return this.featureFlagService.listFlags();
  }

  /**
   * PATCH /admin/settings/feature-flags/:key
   */
  @Patch('feature-flags/:key')
  @ApiOperation({ summary: 'Update feature flag' })
  @ApiParam({ name: 'key', example: 'file_storage' })
  @ApiBody({
    schema: {
      properties: {
        is_enabled: { type: 'boolean' },
        name: { type: 'string' },
        description: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Feature flag updated' })
  async updateFeatureFlag(@Request() req, @Param('key') key: string, @Body() updateDto: any) {
    return this.featureFlagService.updateFlag(key, updateDto, req.user.id);
  }

  /**
   * GET /admin/settings/maintenance
   */
  @Get('maintenance')
  @ApiOperation({ summary: 'Get maintenance mode configuration' })
  @ApiResponse({ status: 200, description: 'Maintenance config retrieved' })
  async getMaintenanceConfig() {
    return this.maintenanceModeService.getMaintenanceConfig();
  }

  /**
   * PATCH /admin/settings/maintenance
   */
  @Patch('maintenance')
  @ApiOperation({ summary: 'Update maintenance mode' })
  @ApiBody({
    schema: {
      properties: {
        is_enabled: { type: 'boolean' },
        mode: { type: 'string', enum: ['immediate', 'scheduled'] },
        start_time: { type: 'string', format: 'date-time', nullable: true },
        end_time: { type: 'string', format: 'date-time', nullable: true },
        message: { type: 'string', nullable: true },
        allowed_ips: { type: 'string', description: 'Comma-separated IP addresses', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Maintenance mode updated' })
  async updateMaintenanceMode(@Request() req, @Body() updateDto: any) {
    return this.maintenanceModeService.updateMaintenanceMode(updateDto, req.user.id);
  }

  /**
   * GET /admin/settings/global
   */
  @Get('global')
  @ApiOperation({ summary: 'Get all global settings grouped by category' })
  @ApiResponse({ status: 200, description: 'Global settings retrieved' })
  async getGlobalSettings() {
    return this.systemSettingService.listSettings();
  }

  /**
   * PATCH /admin/settings/global
   */
  @Patch('global')
  @ApiOperation({ summary: 'Update global settings (bulk)' })
  @ApiBody({
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string', example: 'max_file_upload_size_mb' },
          value: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
        },
        required: ['key', 'value'],
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  async updateGlobalSettings(@Request() req, @Body() settings: Array<{ key: string; value: any }>) {
    return this.systemSettingService.updateSettings(settings, req.user.id);
  }
}
