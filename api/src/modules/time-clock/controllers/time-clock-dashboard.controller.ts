import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../rbac/decorators/roles.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { TimeClockDashboardService } from '../services/time-clock-dashboard.service';

@ApiTags('Time Clock - Dashboard')
@ApiBearerAuth()
@Controller('time-clock/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimeClockDashboardController {
  constructor(private readonly dashboardService: TimeClockDashboardService) {}

  @Get('whos-in')
  @Roles('Owner', 'Admin', 'Project Manager')
  @ApiOperation({ summary: "Get who's currently clocked in" })
  @ApiResponse({
    status: 200,
    description: 'Current clock-in status of all employees',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getWhosIn(@TenantId() tenantId: string) {
    return this.dashboardService.getWhosIn(tenantId);
  }
}
