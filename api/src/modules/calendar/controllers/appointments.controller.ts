import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
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
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AppointmentsService } from '../services/appointments.service';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  ListAppointmentsDto,
} from '../dto';

@ApiTags('Calendar - Appointments')
@ApiBearerAuth()
@Controller('calendar/appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  private readonly logger = new Logger(AppointmentsController.name);

  constructor(private readonly appointmentsService: AppointmentsService) {}

  // ========== APPOINTMENT CRUD ==========

  @Post()
  @Roles('Owner', 'Admin', 'Estimator')
  @ApiOperation({
    summary: 'Create a new appointment',
    description:
      'Creates a new appointment for a lead. Validates that the lead, appointment type, and service request (if provided) belong to the tenant.',
  })
  @ApiResponse({
    status: 201,
    description: 'Appointment created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or validation error',
  })
  @ApiResponse({
    status: 404,
    description: 'Lead, appointment type, or service request not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Owner, Admin, or Estimator role',
  })
  async create(@Request() req, @Body() createDto: CreateAppointmentDto) {
    return this.appointmentsService.create(
      req.user.tenant_id,
      req.user.id,
      createDto,
    );
  }

  @Get()
  @Roles('Owner', 'Admin', 'Estimator', 'Employee')
  @ApiOperation({
    summary: 'Get all appointments with filters and pagination',
    description:
      'Retrieves all appointments for the current tenant with optional filtering by status, date range, and lead ID.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (max 100)',
    example: 50,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by status',
    enum: [
      'scheduled',
      'confirmed',
      'in_progress',
      'completed',
      'cancelled',
      'no_show',
    ],
  })
  @ApiQuery({
    name: 'lead_id',
    required: false,
    type: String,
    description: 'Filter by lead ID',
  })
  @ApiQuery({
    name: 'date_from',
    required: false,
    type: String,
    description: 'Filter appointments from this date (YYYY-MM-DD)',
    example: '2026-03-01',
  })
  @ApiQuery({
    name: 'date_to',
    required: false,
    type: String,
    description: 'Filter appointments up to this date (YYYY-MM-DD)',
    example: '2026-03-31',
  })
  @ApiQuery({
    name: 'sort_by',
    required: false,
    type: String,
    description: 'Sort field',
    enum: ['scheduled_date', 'created_at', 'updated_at'],
  })
  @ApiQuery({
    name: 'sort_order',
    required: false,
    type: String,
    description: 'Sort order',
    enum: ['asc', 'desc'],
  })
  @ApiResponse({
    status: 200,
    description: 'Appointments retrieved successfully',
  })
  async findAll(@Request() req, @Query() listDto: ListAppointmentsDto) {
    return this.appointmentsService.findAll(req.user.tenant_id, listDto);
  }

  @Get(':id')
  @Roles('Owner', 'Admin', 'Estimator', 'Employee')
  @ApiOperation({
    summary: 'Get a single appointment by ID',
    description:
      'Retrieves detailed information about a specific appointment including lead, service request, and assigned user details.',
  })
  @ApiParam({
    name: 'id',
    description: 'Appointment UUID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Appointment not found',
  })
  async findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentsService.findOne(req.user.tenant_id, id);
  }

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Estimator')
  @ApiOperation({
    summary: 'Update an appointment',
    description:
      'Updates appointment notes and assigned user. Sprint 05a supports updating notes and assigned_user_id only.',
  })
  @ApiParam({
    name: 'id',
    description: 'Appointment UUID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Appointment not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Owner, Admin, or Estimator role',
  })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(
      req.user.tenant_id,
      id,
      req.user.id,
      updateDto,
    );
  }
}
