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
import { IndustryService } from '../services/industry.service';
import { CreateIndustryDto, UpdateIndustryDto } from '../dto';

@ApiTags('Admin - Industries')
@ApiBearerAuth()
@Controller('admin/industries')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class IndustryController {
  constructor(private readonly industryService: IndustryService) {}

  /**
   * GET /admin/industries
   * List all industries with optional active filter
   */
  @Get()
  @ApiOperation({ summary: 'List all industries' })
  @ApiQuery({
    name: 'active_only',
    required: false,
    type: Boolean,
    description: 'Only return active industries',
    example: 'true',
  })
  @ApiResponse({
    status: 200,
    description: 'Industries retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'uuid-here' },
          name: { type: 'string', example: 'Roofing' },
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
  async listIndustries(@Query('active_only') activeOnly?: string) {
    return this.industryService.findAll(activeOnly === 'true');
  }

  /**
   * GET /admin/industries/:id
   * Get single industry by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get industry by ID' })
  @ApiParam({ name: 'id', description: 'Industry ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Industry retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid-here' },
        name: { type: 'string', example: 'Roofing' },
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
  @ApiResponse({ status: 404, description: 'Industry not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async getIndustry(@Param('id', ParseUUIDPipe) id: string) {
    return this.industryService.findById(id);
  }

  /**
   * POST /admin/industries
   * Create new industry
   */
  @Post()
  @ApiOperation({ summary: 'Create new industry' })
  @ApiBody({ type: CreateIndustryDto })
  @ApiResponse({
    status: 201,
    description: 'Industry created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid-here' },
        name: { type: 'string', example: 'Pool Services' },
        description: {
          type: 'string',
          example: 'Pool installation and maintenance',
        },
        is_active: { type: 'boolean', example: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async createIndustry(@Request() req, @Body() createDto: CreateIndustryDto) {
    return this.industryService.create(createDto, req.user.id);
  }

  /**
   * PATCH /admin/industries/:id
   * Update existing industry
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update industry' })
  @ApiParam({ name: 'id', description: 'Industry ID (UUID)' })
  @ApiBody({ type: UpdateIndustryDto })
  @ApiResponse({
    status: 200,
    description: 'Industry updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'uuid-here' },
        name: { type: 'string', example: 'Pool Services' },
        description: {
          type: 'string',
          example: 'Pool installation and maintenance',
        },
        is_active: { type: 'boolean', example: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Industry not found' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Platform Admin access required',
  })
  async updateIndustry(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateIndustryDto,
  ) {
    return this.industryService.update(id, updateDto, req.user.id);
  }

  /**
   * DELETE /admin/industries/:id
   * Delete industry (with validation)
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete industry' })
  @ApiParam({ name: 'id', description: 'Industry ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Industry deleted successfully',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Industry deleted successfully' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Industry not found' })
  @ApiResponse({
    status: 409,
    description: 'Industry is in use by tenants',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        message: {
          type: 'string',
          example:
            'Cannot delete industry "Roofing" - 5 tenant(s) are using it',
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
  async deleteIndustry(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.industryService.delete(id, req.user.id);
  }
}
