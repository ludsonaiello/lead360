import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import { CalendarDashboardService } from '../services/calendar-dashboard.service';
import {
  GetUpcomingAppointmentsDto,
  GetNewAppointmentsDto,
  UpcomingAppointmentsResponseDto,
  NewAppointmentsResponseDto,
  AcknowledgeAppointmentResponseDto,
} from '../dto';

/**
 * CalendarDashboardController
 *
 * Dashboard helper endpoints for upcoming and new appointments
 * Sprint 10: Dashboard endpoints
 *
 * Endpoints:
 * - GET /calendar/dashboard/upcoming - Get upcoming appointments
 * - GET /calendar/dashboard/new - Get new (unacknowledged) appointments
 * - PATCH /calendar/dashboard/new/:id/acknowledge - Acknowledge a new appointment
 *
 * RBAC: Owner, Admin, Estimator
 */
@ApiTags('Calendar - Dashboard')
@ApiBearerAuth()
@Controller('calendar/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CalendarDashboardController {
  private readonly logger = new Logger(CalendarDashboardController.name);

  constructor(
    private readonly dashboardService: CalendarDashboardService,
  ) {}

  /**
   * GET /calendar/dashboard/upcoming
   *
   * Get upcoming appointments for dashboard banner
   * Returns next N appointments in chronological order (scheduled or confirmed status only)
   */
  @Get('upcoming')
  @Roles('Owner', 'Admin', 'Estimator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get upcoming appointments for dashboard banner',
    description:
      'Returns the next N appointments in chronological order (scheduled or confirmed status only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Upcoming appointments returned successfully',
    type: UpcomingAppointmentsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Tenant ID is required',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have required role',
  })
  async getUpcoming(
    @Query() query: GetUpcomingAppointmentsDto,
    @TenantId() tenantId: string | null,
  ): Promise<UpcomingAppointmentsResponseDto> {
    // CRITICAL: Tenant ID must be present (platform admins don't have calendar data)
    if (!tenantId) {
      this.logger.error(
        'Upcoming appointments request without tenant_id - Platform admin cannot access tenant-specific calendar data',
      );
      throw new BadRequestException(
        'Tenant ID is required. Platform admins cannot access tenant-specific calendar data.',
      );
    }

    const limit = query.limit ?? 5;

    this.logger.log(
      `GET /calendar/dashboard/upcoming - tenant: ${tenantId}, limit: ${limit}`,
    );

    return await this.dashboardService.getUpcomingAppointments(
      tenantId,
      limit,
    );
  }

  /**
   * GET /calendar/dashboard/new
   *
   * Get newly booked appointments (not yet acknowledged)
   * Returns appointments where acknowledged_at IS NULL, ordered by creation date DESC
   */
  @Get('new')
  @Roles('Owner', 'Admin', 'Estimator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get newly booked appointments (not yet acknowledged)',
    description:
      'Returns appointments that have not been acknowledged yet (acknowledged_at IS NULL), ordered by creation date DESC',
  })
  @ApiResponse({
    status: 200,
    description: 'New appointments returned successfully',
    type: NewAppointmentsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Tenant ID is required',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have required role',
  })
  async getNew(
    @Query() query: GetNewAppointmentsDto,
    @TenantId() tenantId: string | null,
  ): Promise<NewAppointmentsResponseDto> {
    // CRITICAL: Tenant ID must be present (platform admins don't have calendar data)
    if (!tenantId) {
      this.logger.error(
        'New appointments request without tenant_id - Platform admin cannot access tenant-specific calendar data',
      );
      throw new BadRequestException(
        'Tenant ID is required. Platform admins cannot access tenant-specific calendar data.',
      );
    }

    const limit = query.limit ?? 10;

    this.logger.log(
      `GET /calendar/dashboard/new - tenant: ${tenantId}, limit: ${limit}`,
    );

    return await this.dashboardService.getNewAppointments(tenantId, limit);
  }

  /**
   * PATCH /calendar/dashboard/new/:id/acknowledge
   *
   * Mark a new appointment as acknowledged
   * Sets acknowledged_at to current timestamp
   */
  @Patch('new/:id/acknowledge')
  @Roles('Owner', 'Admin', 'Estimator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a new appointment as acknowledged',
    description:
      'Sets acknowledged_at timestamp to mark that the appointment has been seen',
  })
  @ApiParam({
    name: 'id',
    description: 'Appointment ID',
    type: String,
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment acknowledged successfully',
    type: AcknowledgeAppointmentResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Tenant ID is required',
  })
  @ApiResponse({
    status: 404,
    description: 'Appointment not found or access denied',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - User does not have required role',
  })
  async acknowledge(
    @Param('id') appointmentId: string,
    @TenantId() tenantId: string | null,
  ): Promise<AcknowledgeAppointmentResponseDto> {
    // CRITICAL: Tenant ID must be present (platform admins don't have calendar data)
    if (!tenantId) {
      this.logger.error(
        `Acknowledge appointment request without tenant_id - Platform admin cannot access tenant-specific calendar data`,
      );
      throw new BadRequestException(
        'Tenant ID is required. Platform admins cannot access tenant-specific calendar data.',
      );
    }

    this.logger.log(
      `PATCH /calendar/dashboard/new/${appointmentId}/acknowledge - tenant: ${tenantId}`,
    );

    return await this.dashboardService.acknowledgeAppointment(
      tenantId,
      appointmentId,
    );
  }
}
