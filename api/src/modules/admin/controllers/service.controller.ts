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
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { ServiceService } from '../../tenant/services/service.service';
import { CreateServiceDto } from '../../tenant/dto/create-service.dto';
import { UpdateServiceDto } from '../../tenant/dto/update-service.dto';

@ApiTags('Admin - Services')
@ApiBearerAuth()
@Controller('admin/services')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  /**
   * GET /admin/services
   * List all services with optional active filter
   */
  @Get()
  @ApiOperation({ summary: 'List all services' })
  @ApiQuery({
    name: 'active_only',
    required: false,
    type: Boolean,
    description: 'Only return active services',
    example: 'true',
  })
  @ApiResponse({
    status: 200,
    description: 'Services retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'abc123def456' },
          name: { type: 'string', example: 'Roofing' },
          slug: { type: 'string', example: 'roofing' },
          description: {
            type: 'string',
            example: 'Residential and commercial roofing services',
          },
          is_active: { type: 'boolean', example: true },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async listServices(@Query('active_only') activeOnly?: string) {
    return this.serviceService.findAll(activeOnly === 'true');
  }

  /**
   * GET /admin/services/:id
   * Get single service by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get service by ID' })
  @ApiParam({ name: 'id', description: 'Service ID (hex string)' })
  @ApiResponse({
    status: 200,
    description: 'Service retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'abc123def456' },
        name: { type: 'string', example: 'Roofing' },
        slug: { type: 'string', example: 'roofing' },
        description: {
          type: 'string',
          example: 'Residential and commercial roofing services',
        },
        is_active: { type: 'boolean', example: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async getService(@Param('id') id: string) {
    return this.serviceService.findOne(id);
  }

  /**
   * POST /admin/services
   * Create new service
   */
  @Post()
  @ApiOperation({ summary: 'Create new service' })
  @ApiBody({ type: CreateServiceDto })
  @ApiResponse({
    status: 201,
    description: 'Service created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'abc123def456' },
        name: { type: 'string', example: 'Pool Cleaning' },
        slug: { type: 'string', example: 'pool-cleaning' },
        description: {
          type: 'string',
          example: 'Pool maintenance and cleaning services',
        },
        is_active: { type: 'boolean', example: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Service with same name or slug already exists',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async createService(@Request() req, @Body() createDto: CreateServiceDto) {
    return this.serviceService.create(createDto, req.user.id);
  }

  /**
   * PATCH /admin/services/:id
   * Update existing service
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update service' })
  @ApiParam({ name: 'id', description: 'Service ID (hex string)' })
  @ApiBody({ type: UpdateServiceDto })
  @ApiResponse({
    status: 200,
    description: 'Service updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'abc123def456' },
        name: { type: 'string', example: 'Pool Cleaning' },
        slug: { type: 'string', example: 'pool-cleaning' },
        description: {
          type: 'string',
          example: 'Professional pool maintenance and cleaning services',
        },
        is_active: { type: 'boolean', example: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({
    status: 409,
    description: 'Conflict - Service with same name or slug already exists',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async updateService(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDto: UpdateServiceDto,
  ) {
    return this.serviceService.update(id, updateDto, req.user.id);
  }

  /**
   * DELETE /admin/services/:id
   * Delete service (with validation)
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete service' })
  @ApiParam({ name: 'id', description: 'Service ID (hex string)' })
  @ApiResponse({
    status: 200,
    description: 'Service deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Service deleted successfully' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Service not found' })
  @ApiResponse({
    status: 409,
    description: 'Service is in use by tenants',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        message: {
          type: 'string',
          example:
            'Cannot delete service "Roofing". It is assigned to 5 tenant(s)',
        },
        error: { type: 'string', example: 'Conflict' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async deleteService(@Request() req, @Param('id') id: string) {
    return this.serviceService.delete(id, req.user.id);
  }
}
