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
  ParseUUIDPipe,
  Logger,
  HttpCode,
  HttpStatus,
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
import { ServiceRequestsService } from '../services/service-requests.service';
import { CreateServiceRequestDto, UpdateServiceRequestDto } from '../dto';

@ApiTags('Service Requests')
@ApiBearerAuth()
@Controller('service-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceRequestsController {
  private readonly logger = new Logger(ServiceRequestsController.name);

  constructor(
    private readonly serviceRequestsService: ServiceRequestsService,
  ) {}

  // ========== SERVICE REQUESTS ==========

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get all service requests with filters' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'scheduled', 'completed', 'cancelled'],
  })
  @ApiQuery({
    name: 'urgency',
    required: false,
    enum: ['low', 'medium', 'high', 'emergency'],
  })
  @ApiQuery({ name: 'service_type', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 50 })
  @ApiResponse({
    status: 200,
    description: 'Service requests retrieved successfully',
  })
  async findAll(
    @Request() req,
    @Query('status') status?: string,
    @Query('urgency') urgency?: string,
    @Query('service_type') service_type?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.serviceRequestsService.findAll(
      req.user.tenant_id,
      { status, urgency, service_type },
      page,
      limit,
    );
  }

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get a single service request by ID' })
  @ApiParam({ name: 'id', description: 'Service Request UUID' })
  @ApiResponse({
    status: 200,
    description: 'Service request retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Service request not found' })
  async findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.serviceRequestsService.findOne(req.user.tenant_id, id);
  }

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Update a service request' })
  @ApiParam({ name: 'id', description: 'Service Request UUID' })
  @ApiResponse({
    status: 200,
    description: 'Service request updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid urgency or status' })
  @ApiResponse({ status: 404, description: 'Service request not found' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateServiceRequestDto: UpdateServiceRequestDto,
  ) {
    return this.serviceRequestsService.update(
      req.user.tenant_id,
      id,
      req.user.id,
      updateServiceRequestDto,
    );
  }

  @Delete(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a service request (hard delete)' })
  @ApiParam({ name: 'id', description: 'Service Request UUID' })
  @ApiResponse({
    status: 204,
    description: 'Service request deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Service request not found' })
  async delete(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    await this.serviceRequestsService.delete(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }

  @Post('leads/:leadId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Create a service request for a lead' })
  @ApiParam({ name: 'leadId', description: 'Lead UUID' })
  @ApiQuery({
    name: 'addressId',
    required: true,
    description: 'Address UUID where service will be performed',
  })
  @ApiResponse({
    status: 201,
    description: 'Service request created successfully',
  })
  @ApiResponse({ status: 404, description: 'Lead or address not found' })
  async create(
    @Request() req,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Query('addressId', ParseUUIDPipe) addressId: string,
    @Body() createServiceRequestDto: CreateServiceRequestDto,
  ) {
    return this.serviceRequestsService.create(
      req.user.tenant_id,
      leadId,
      addressId,
      req.user.id,
      createServiceRequestDto,
    );
  }
}
