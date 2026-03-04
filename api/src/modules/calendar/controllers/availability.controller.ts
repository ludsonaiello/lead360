import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SlotCalculationService } from '../services/slot-calculation.service';
import { GetAvailabilityDto, AvailabilityResponseDto } from '../dto';

/**
 * AvailabilityController
 *
 * Sprint 07b: Availability API endpoint
 * Provides available time slots for appointment booking
 */
@ApiTags('Calendar - Availability')
@ApiBearerAuth()
@Controller('calendar/availability')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AvailabilityController {
  private readonly logger = new Logger(AvailabilityController.name);

  constructor(
    private readonly slotCalculationService: SlotCalculationService,
  ) {}

  @Get()
  @Roles('Owner', 'Admin', 'Estimator')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get available appointment slots',
    description:
      'Returns available time slots for booking appointments. This is the core scheduling endpoint used by both the UI and Voice AI tools. ' +
      'Generates slots based on appointment type schedule, subtracts existing appointments (scheduled or confirmed), ' +
      'and returns an ordered list of available slots grouped by date.',
  })
  @ApiQuery({
    name: 'appointment_type_id',
    description: 'Appointment type ID to check availability for',
    required: true,
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiQuery({
    name: 'date_from',
    description: 'Start of date range (YYYY-MM-DD)',
    required: true,
    type: String,
    example: '2026-03-02',
  })
  @ApiQuery({
    name: 'date_to',
    description:
      'End of date range (YYYY-MM-DD). Maximum span is determined by the appointment type max_lookahead_weeks setting.',
    required: true,
    type: String,
    example: '2026-03-16',
  })
  @ApiResponse({
    status: 200,
    description: 'Available slots retrieved successfully',
    type: AvailabilityResponseDto,
    schema: {
      example: {
        appointment_type: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          name: 'Quote Visit',
          slot_duration_minutes: 90,
        },
        timezone: 'America/New_York',
        date_range: {
          from: '2026-03-02',
          to: '2026-03-16',
        },
        available_dates: [
          {
            date: '2026-03-02',
            day_name: 'Monday',
            slots: [
              { start_time: '08:00', end_time: '09:30' },
              { start_time: '09:30', end_time: '11:00' },
              { start_time: '10:30', end_time: '12:00' },
            ],
          },
          {
            date: '2026-03-05',
            day_name: 'Thursday',
            slots: [
              { start_time: '08:00', end_time: '09:30' },
              { start_time: '09:30', end_time: '11:00' },
            ],
          },
        ],
        total_available_slots: 5,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid query parameters (e.g., invalid UUID, invalid date format, date range exceeds max_lookahead_weeks)',
  })
  @ApiResponse({
    status: 404,
    description: 'Appointment type not found or is not active',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Owner, Admin, or Estimator role',
  })
  async getAvailability(
    @Request() req,
    @Query() query: GetAvailabilityDto,
  ): Promise<AvailabilityResponseDto> {
    this.logger.log(
      `GET /calendar/availability - Tenant: ${req.user.tenant_id}, Type: ${query.appointment_type_id}, Range: ${query.date_from} to ${query.date_to}`,
    );

    const result = await this.slotCalculationService.getAvailableSlots(
      req.user.tenant_id,
      query.appointment_type_id,
      query.date_from,
      query.date_to,
    );

    this.logger.log(
      `Returning ${result.total_available_slots} available slots across ${result.available_dates.length} dates`,
    );

    return result as AvailabilityResponseDto;
  }
}
