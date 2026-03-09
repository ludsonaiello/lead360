import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AppointmentTypesService } from '../services/appointment-types.service';
import {
  CreateAppointmentTypeDto,
  UpdateAppointmentTypeDto,
  ListAppointmentTypesDto,
} from '../dto';

@ApiTags('Calendar - Appointment Types')
@ApiBearerAuth()
@Controller('calendar/appointment-types')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentTypesController {
  private readonly logger = new Logger(AppointmentTypesController.name);

  constructor(
    private readonly appointmentTypesService: AppointmentTypesService,
  ) {}

  // ========== APPOINTMENT TYPE CRUD ==========

  @Post()
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Create a new appointment type',
    description:
      'Creates a new appointment type. If is_default is true, automatically unsets the previous default.',
  })
  @ApiResponse({
    status: 201,
    description: 'Appointment type created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or validation error',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Owner or Admin role',
  })
  async create(@Request() req, @Body() createDto: CreateAppointmentTypeDto) {
    return this.appointmentTypesService.create(
      req.user.tenant_id,
      req.user.id,
      createDto,
    );
  }

  @Get()
  @Roles('Owner', 'Admin', 'Estimator')
  @ApiOperation({
    summary: 'Get all appointment types with filters and pagination',
    description:
      'Retrieves all appointment types for the current tenant with optional filtering by active status, default status, and search.',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment types retrieved successfully',
  })
  async findAll(@Request() req, @Query() listDto: ListAppointmentTypesDto) {
    return this.appointmentTypesService.findAll(req.user.tenant_id, listDto);
  }

  @Get(':id')
  @Roles('Owner', 'Admin', 'Estimator')
  @ApiOperation({
    summary: 'Get a single appointment type by ID',
    description:
      'Retrieves detailed information about a specific appointment type including schedules.',
  })
  @ApiParam({
    name: 'id',
    description: 'Appointment Type UUID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment type retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Appointment type not found',
  })
  async findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.appointmentTypesService.findOne(req.user.tenant_id, id);
  }

  @Patch(':id')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Update an appointment type',
    description:
      'Updates an appointment type. If is_default is set to true, automatically unsets the previous default.',
  })
  @ApiParam({
    name: 'id',
    description: 'Appointment Type UUID',
    type: 'string',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment type updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Appointment type not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Owner or Admin role',
  })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateAppointmentTypeDto,
  ) {
    return this.appointmentTypesService.update(
      req.user.tenant_id,
      id,
      req.user.id,
      updateDto,
    );
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Soft delete an appointment type',
    description:
      'Deactivates an appointment type (sets is_active = false). Prevents deletion if there are active appointments.',
  })
  @ApiParam({
    name: 'id',
    description: 'Appointment Type UUID',
    type: 'string',
  })
  @ApiResponse({
    status: 204,
    description: 'Appointment type deactivated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot deactivate - active appointments exist',
  })
  @ApiResponse({
    status: 404,
    description: 'Appointment type not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Owner or Admin role',
  })
  async delete(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    await this.appointmentTypesService.delete(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }

  @Delete(':id/permanent')
  @Roles('Owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Hard delete an appointment type (PERMANENT)',
    description:
      'Permanently removes an appointment type from the database. This is a DESTRUCTIVE operation that cannot be undone. ' +
      'Prevents deletion if there are ANY appointments (active or historical) associated with this type. ' +
      'Owner role required. Use soft delete (deactivate) for normal operations.',
  })
  @ApiParam({
    name: 'id',
    description: 'Appointment Type UUID',
    type: 'string',
  })
  @ApiResponse({
    status: 204,
    description: 'Appointment type permanently deleted',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete - appointments exist in history',
  })
  @ApiResponse({
    status: 404,
    description: 'Appointment type not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Requires Owner role only',
  })
  async hardDelete(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    await this.appointmentTypesService.hardDelete(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }
}
