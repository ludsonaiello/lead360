import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { Roles } from '../../rbac/decorators/roles.decorator';
import { TimeClockSettingsService } from '../services/time-clock-settings.service';
import { UpdateTimeClockSettingsDto } from '../dto/time-clock-settings.dto';

@ApiTags('Time Clock')
@ApiBearerAuth()
@Controller('time-clock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimeClockSettingsController {
  constructor(private readonly settingsService: TimeClockSettingsService) {}

  // Tenant policy (GPS required? project required? rounding rules?) is read by
  // every clocking user on the clock page boot, so this endpoint is open to
  // any authenticated tenant member. Mutations stay Owner/Admin-only below.
  @Get('settings')
  @ApiOperation({ summary: 'Get tenant time clock settings' })
  @ApiResponse({
    status: 200,
    description:
      'Settings retrieved. Returns default values with id:null if no record exists.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSettings(@Request() req) {
    return this.settingsService.getSettings(req.user.tenant_id);
  }

  @Patch('settings')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Update tenant time clock settings (upsert)' })
  @ApiResponse({ status: 200, description: 'Settings updated or created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateSettings(
    @Request() req,
    @Body() dto: UpdateTimeClockSettingsDto,
  ) {
    return this.settingsService.upsertSettings(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Post('settings/kiosk-token/regenerate')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Regenerate kiosk authentication token' })
  @ApiResponse({
    status: 201,
    description:
      'Token regenerated. Plaintext token returned ONCE — only hash is persisted.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async regenerateKioskToken(@Request() req) {
    return this.settingsService.regenerateKioskToken(
      req.user.tenant_id,
      req.user.id,
    );
  }
}
