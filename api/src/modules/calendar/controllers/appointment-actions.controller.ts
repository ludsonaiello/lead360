import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Logger,
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
import { AppointmentLifecycleService } from '../services/appointment-lifecycle.service';
import {
  ConfirmAppointmentDto,
  CancelAppointmentDto,
  RescheduleAppointmentDto,
  CompleteAppointmentDto,
  NoShowAppointmentDto,
} from '../dto';

/**
 * Sprint 06: Appointment Lifecycle Actions Controller
 *
 * Handles appointment status transitions via dedicated endpoints.
 * All actions enforce the state machine rules in AppointmentLifecycleService.
 *
 * RBAC: Owner, Admin, Estimator can perform all lifecycle actions
 */
@ApiTags('Calendar - Appointment Actions')
@ApiBearerAuth()
@Controller('calendar/appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentActionsController {
  private readonly logger = new Logger(AppointmentActionsController.name);

  constructor(
    private readonly lifecycleService: AppointmentLifecycleService,
  ) {}

  // ========== CONFIRM APPOINTMENT ==========

  @Post(':id/confirm')
  @Roles('Owner', 'Admin', 'Estimator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm an appointment',
    description:
      'Transitions appointment from "scheduled" to "confirmed". Only appointments in "scheduled" status can be confirmed.',
  })
  @ApiParam({
    name: 'id',
    description: 'Appointment UUID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment confirmed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid transition (e.g., appointment is already confirmed or in terminal state)',
  })
  @ApiResponse({
    status: 404,
    description: 'Appointment not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Owner, Admin, or Estimator role',
  })
  async confirmAppointment(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmAppointmentDto,
  ) {
    this.logger.log(
      `User ${req.user.id} confirming appointment ${id} for tenant ${req.user.tenant_id}`,
    );
    return this.lifecycleService.confirmAppointment(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }

  // ========== CANCEL APPOINTMENT ==========

  @Post(':id/cancel')
  @Roles('Owner', 'Admin', 'Estimator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel an appointment',
    description:
      'Cancels an appointment with a required reason. Can only cancel appointments in "scheduled" or "confirmed" status. Updates linked service_request status to "new".',
  })
  @ApiParam({
    name: 'id',
    description: 'Appointment UUID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment cancelled successfully',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid transition or missing required fields (e.g., cancellation_notes required when reason is "other")',
  })
  @ApiResponse({
    status: 404,
    description: 'Appointment not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Owner, Admin, or Estimator role',
  })
  async cancelAppointment(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelAppointmentDto,
  ) {
    this.logger.log(
      `User ${req.user.id} cancelling appointment ${id} for tenant ${req.user.tenant_id}`,
    );
    return this.lifecycleService.cancelAppointment(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }

  // ========== RESCHEDULE APPOINTMENT ==========

  @Post(':id/reschedule')
  @Roles('Owner', 'Admin', 'Estimator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reschedule an appointment to a new date/time',
    description:
      'Creates a new appointment with the new date/time and marks the old appointment as "rescheduled". The new appointment links back to the old one via rescheduled_from_id. Can only reschedule appointments in "scheduled" or "confirmed" status.',
  })
  @ApiParam({
    name: 'id',
    description: 'Appointment UUID to reschedule',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment rescheduled successfully. Returns the NEW appointment.',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid transition or date in the past',
  })
  @ApiResponse({
    status: 404,
    description: 'Appointment not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Owner, Admin, or Estimator role',
  })
  async rescheduleAppointment(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    this.logger.log(
      `User ${req.user.id} rescheduling appointment ${id} for tenant ${req.user.tenant_id}`,
    );
    const result = await this.lifecycleService.rescheduleAppointment(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
    this.logger.log(`[RESCHEDULE DEBUG] Controller received from service: ${JSON.stringify({
      hasOldAppointment: !!result.oldAppointment,
      hasNewAppointment: !!result.newAppointment,
      resultType: typeof result,
      resultKeys: Object.keys(result),
      isNewAppointmentOnly: result.id !== undefined
    })}`);
    return result;
  }

  // ========== COMPLETE APPOINTMENT ==========

  @Post(':id/complete')
  @Roles('Owner', 'Admin', 'Estimator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark appointment as completed',
    description:
      'Transitions appointment to "completed" status. Only appointments in "scheduled" or "confirmed" status can be marked as completed. This is a terminal state - no further changes allowed.',
  })
  @ApiParam({
    name: 'id',
    description: 'Appointment UUID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment marked as completed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid transition (e.g., appointment already in terminal state)',
  })
  @ApiResponse({
    status: 404,
    description: 'Appointment not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Owner, Admin, or Estimator role',
  })
  async completeAppointment(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteAppointmentDto,
  ) {
    this.logger.log(
      `User ${req.user.id} marking appointment ${id} as completed for tenant ${req.user.tenant_id}`,
    );
    return this.lifecycleService.completeAppointment(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }

  // ========== MARK AS NO-SHOW ==========

  @Post(':id/no-show')
  @Roles('Owner', 'Admin', 'Estimator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark appointment as no-show',
    description:
      'Marks appointment as "no_show" when the lead did not arrive at the scheduled time. Can only mark appointments in "scheduled" or "confirmed" status as no-show. Updates linked service_request status to "new". This is a terminal state - no further changes allowed.',
  })
  @ApiParam({
    name: 'id',
    description: 'Appointment UUID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment marked as no-show successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid transition (e.g., appointment already in terminal state)',
  })
  @ApiResponse({
    status: 404,
    description: 'Appointment not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Owner, Admin, or Estimator role',
  })
  async markAsNoShow(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NoShowAppointmentDto,
  ) {
    this.logger.log(
      `User ${req.user.id} marking appointment ${id} as no-show for tenant ${req.user.tenant_id}`,
    );
    return this.lifecycleService.markAsNoShow(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }
}
