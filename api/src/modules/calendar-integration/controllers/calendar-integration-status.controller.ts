import { Controller, Get, UseGuards, Logger } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import { CalendarProviderConnectionService } from '../services/calendar-provider-connection.service';
import { CalendarConnectionStatusDto } from '../dto';

/**
 * Controller for calendar integration status
 * Returns general connection status for any provider
 */
@ApiTags('Calendar Integration')
@Controller('calendar/integration')
export class CalendarIntegrationStatusController {
  private readonly logger = new Logger(
    CalendarIntegrationStatusController.name,
  );

  constructor(
    private readonly connectionService: CalendarProviderConnectionService,
  ) {}

  /**
   * Get current calendar connection status
   * Returns connection details if active, or null if not connected
   */
  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Owner', 'Admin', 'Estimator')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get calendar connection status',
    description:
      'Returns the current calendar integration status for the tenant. Shows whether a calendar is connected and sync health.',
  })
  @ApiResponse({
    status: 200,
    description: 'Connection status retrieved successfully',
    type: CalendarConnectionStatusDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - JWT missing or invalid',
  })
  async getConnectionStatus(
    @TenantId() tenantId: string,
  ): Promise<CalendarConnectionStatusDto> {
    this.logger.log(`Fetching connection status for tenant ${tenantId}`);

    const connection =
      await this.connectionService.getActiveConnection(tenantId);

    if (!connection) {
      return {
        connected: false,
      };
    }

    return {
      connected: true,
      providerType: connection.providerType,
      connectedCalendarId: connection.connectedCalendarId,
      connectedCalendarName: connection.connectedCalendarName || undefined,
      syncStatus: connection.syncStatus,
      lastSyncAt: connection.lastSyncAt?.toISOString(),
      errorMessage: connection.errorMessage || undefined,
      createdAt: connection.createdAt.toISOString(),
    };
  }
}
