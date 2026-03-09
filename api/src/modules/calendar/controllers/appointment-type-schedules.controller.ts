import {
  Controller,
  Get,
  Put,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
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
import { AppointmentTypeSchedulesService } from '../services/appointment-type-schedules.service';
import { BulkUpdateScheduleDto, UpdateSingleDayScheduleDto } from '../dto';

@ApiTags('Calendar - Appointment Type Schedules')
@ApiBearerAuth()
@Controller('calendar/appointment-types/:typeId/schedule')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentTypeSchedulesController {
  private readonly logger = new Logger(AppointmentTypeSchedulesController.name);

  constructor(
    private readonly schedulesService: AppointmentTypeSchedulesService,
  ) {}

  // ========== SCHEDULE CRUD ==========

  @Get()
  @Roles('Owner', 'Admin', 'Estimator')
  @ApiOperation({
    summary: 'Get weekly schedule for an appointment type',
    description:
      'Retrieves the 7-day weekly schedule configuration for an appointment type. Returns availability windows for each day.',
  })
  @ApiParam({
    name: 'typeId',
    description: 'Appointment Type ID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Schedule retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'uuid' },
          appointment_type_id: { type: 'string', example: 'uuid' },
          day_of_week: {
            type: 'integer',
            example: 1,
            description: '0=Sunday, 1=Monday, ..., 6=Saturday',
          },
          is_available: { type: 'boolean', example: true },
          window1_start: { type: 'string', example: '09:00', nullable: true },
          window1_end: { type: 'string', example: '12:00', nullable: true },
          window2_start: { type: 'string', example: '13:00', nullable: true },
          window2_end: { type: 'string', example: '17:00', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Appointment type not found',
  })
  async getSchedules(@Request() req, @Param('typeId') typeId: string) {
    return this.schedulesService.findSchedules(req.user.tenant_id, typeId);
  }

  @Put()
  @Roles('Owner', 'Admin', 'Estimator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bulk update weekly schedule (all 7 days)',
    description:
      'Updates the entire weekly schedule for an appointment type. Must provide exactly 7 schedule entries (one for each day of the week).',
  })
  @ApiParam({
    name: 'typeId',
    description: 'Appointment Type ID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Schedule updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or validation error',
  })
  @ApiResponse({
    status: 404,
    description: 'Appointment type not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Owner, Admin, or Estimator role',
  })
  async bulkUpdateSchedule(
    @Request() req,
    @Param('typeId') typeId: string,
    @Body() bulkUpdateDto: BulkUpdateScheduleDto,
  ) {
    return this.schedulesService.bulkUpdateSchedules(
      req.user.tenant_id,
      typeId,
      req.user.id,
      bulkUpdateDto,
    );
  }

  @Patch(':dayOfWeek')
  @Roles('Owner', 'Admin', 'Estimator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update schedule for a single day',
    description:
      'Updates the schedule for a specific day of the week. Day 0 = Sunday, 1 = Monday, ..., 6 = Saturday.',
  })
  @ApiParam({
    name: 'typeId',
    description: 'Appointment Type ID',
    type: 'string',
  })
  @ApiParam({
    name: 'dayOfWeek',
    description: 'Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)',
    type: 'integer',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Day schedule updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or validation error',
  })
  @ApiResponse({
    status: 404,
    description: 'Appointment type not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Owner, Admin, or Estimator role',
  })
  async updateSingleDay(
    @Request() req,
    @Param('typeId') typeId: string,
    @Param('dayOfWeek', ParseIntPipe) dayOfWeek: number,
    @Body() updateDto: UpdateSingleDayScheduleDto,
  ) {
    return this.schedulesService.updateSingleDaySchedule(
      req.user.tenant_id,
      typeId,
      dayOfWeek,
      req.user.id,
      updateDto,
    );
  }
}
