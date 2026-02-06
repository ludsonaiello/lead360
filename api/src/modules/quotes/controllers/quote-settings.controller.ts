import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { QuoteSettingsService } from '../services/quote-settings.service';
import { UpdateQuoteSettingsDto } from '../dto/settings';

@ApiTags('Quotes - Settings')
@ApiBearerAuth()
@Controller('quotes/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteSettingsController {
  private readonly logger = new Logger(QuoteSettingsController.name);

  constructor(private readonly settingsService: QuoteSettingsService) {}

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'Get quote settings for tenant',
    description: 'Returns tenant settings with system defaults as fallback',
  })
  @ApiResponse({ status: 200, description: 'Settings retrieved successfully' })
  async getSettings(@Request() req) {
    return this.settingsService.getSettings(req.user.tenant_id);
  }

  @Patch()
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Update quote settings',
    description: 'Updates tenant-specific quote settings',
  })
  @ApiResponse({ status: 200, description: 'Settings updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or validation error' })
  async updateSettings(
    @Request() req,
    @Body() updateSettingsDto: UpdateQuoteSettingsDto,
  ) {
    return this.settingsService.updateSettings(
      req.user.tenant_id,
      req.user.id,
      updateSettingsDto,
    );
  }

  @Post('reset')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Reset settings to system defaults',
    description:
      'Clears tenant-specific settings and reverts to system defaults',
  })
  @ApiResponse({ status: 200, description: 'Settings reset successfully' })
  async resetToDefaults(@Request() req) {
    return this.settingsService.resetToDefaults(
      req.user.tenant_id,
      req.user.id,
    );
  }

  @Get('approval-thresholds')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'Get approval threshold configuration',
    description: 'Returns approval levels and amount thresholds',
  })
  @ApiResponse({
    status: 200,
    description: 'Approval thresholds retrieved successfully',
  })
  async getApprovalThresholds(@Request() req) {
    return this.settingsService.getApprovalThresholds(req.user.tenant_id);
  }
}
