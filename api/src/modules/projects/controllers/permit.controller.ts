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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PermitService } from '../services/permit.service';
import { CreatePermitDto } from '../dto/create-permit.dto';
import { UpdatePermitDto } from '../dto/update-permit.dto';

@ApiTags('Permits')
@ApiBearerAuth()
@Controller('projects/:projectId/permits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PermitController {
  constructor(private readonly permitService: PermitService) {}

  // -------------------------------------------------------------------------
  // POST /projects/:projectId/permits — Create permit
  // -------------------------------------------------------------------------
  @Post()
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a permit for a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 201, description: 'Permit created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async create(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreatePermitDto,
  ) {
    return this.permitService.create(tenantId, projectId, userId, dto);
  }

  // -------------------------------------------------------------------------
  // GET /projects/:projectId/permits — List permits
  // -------------------------------------------------------------------------
  @Get()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'List permits for a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filter by status (not_required, pending_application, submitted, approved, active, failed, closed)',
  })
  @ApiResponse({ status: 200, description: 'List of permits' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findAll(
    @TenantId() tenantId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('status') status?: string,
  ) {
    return this.permitService.findAll(tenantId, projectId, { status });
  }

  // -------------------------------------------------------------------------
  // GET /projects/:projectId/permits/:id — Get single permit
  // -------------------------------------------------------------------------
  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Get a single permit by ID' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Permit UUID' })
  @ApiResponse({ status: 200, description: 'Permit details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Permit not found' })
  async findOne(
    @TenantId() tenantId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.permitService.findOne(tenantId, projectId, id);
  }

  // -------------------------------------------------------------------------
  // PATCH /projects/:projectId/permits/:id — Update permit
  // -------------------------------------------------------------------------
  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Update a permit' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Permit UUID' })
  @ApiResponse({ status: 200, description: 'Permit updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Permit not found' })
  async update(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePermitDto,
  ) {
    return this.permitService.update(tenantId, projectId, id, userId, dto);
  }

  // -------------------------------------------------------------------------
  // DELETE /projects/:projectId/permits/:id — Hard delete permit
  // -------------------------------------------------------------------------
  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Hard delete a permit (blocked if inspections exist)',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Permit UUID' })
  @ApiResponse({ status: 204, description: 'Permit deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Permit not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete — permit has linked inspections',
  })
  async hardDelete(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.permitService.hardDelete(tenantId, projectId, id, userId);
  }

  // -------------------------------------------------------------------------
  // PATCH /projects/:projectId/permits/:id/deactivate — Soft delete
  // -------------------------------------------------------------------------
  @Patch(':id/deactivate')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Soft delete (deactivate) a permit' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Permit UUID' })
  @ApiResponse({
    status: 200,
    description: 'Permit deactivated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Permit not found' })
  async deactivate(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.permitService.deactivate(tenantId, projectId, id, userId);
  }
}
