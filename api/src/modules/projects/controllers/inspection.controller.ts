import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { InspectionService } from '../services/inspection.service';
import { CreateInspectionDto } from '../dto/create-inspection.dto';
import { UpdateInspectionDto } from '../dto/update-inspection.dto';

@ApiTags('Inspections')
@ApiBearerAuth()
@Controller('projects/:projectId/permits/:permitId/inspections')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InspectionController {
  constructor(private readonly inspectionService: InspectionService) {}

  // -------------------------------------------------------------------------
  // POST /projects/:projectId/permits/:permitId/inspections — Create
  // -------------------------------------------------------------------------
  @Post()
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create an inspection for a permit' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'permitId', description: 'Permit UUID' })
  @ApiResponse({ status: 201, description: 'Inspection created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Permit not found' })
  async create(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @Body() dto: CreateInspectionDto,
  ) {
    return this.inspectionService.create(
      tenantId,
      projectId,
      permitId,
      userId,
      dto,
    );
  }

  // -------------------------------------------------------------------------
  // GET /projects/:projectId/permits/:permitId/inspections — List
  // -------------------------------------------------------------------------
  @Get()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'List inspections for a permit' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'permitId', description: 'Permit UUID' })
  @ApiResponse({ status: 200, description: 'List of inspections' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Permit not found' })
  async findAll(
    @TenantId() tenantId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('permitId', ParseUUIDPipe) permitId: string,
  ) {
    return this.inspectionService.findByPermit(tenantId, projectId, permitId);
  }

  // -------------------------------------------------------------------------
  // PATCH /projects/:projectId/permits/:permitId/inspections/:id — Update
  // -------------------------------------------------------------------------
  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Update an inspection' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'permitId', description: 'Permit UUID' })
  @ApiParam({ name: 'id', description: 'Inspection UUID' })
  @ApiResponse({ status: 200, description: 'Inspection updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Inspection not found' })
  async update(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInspectionDto,
  ) {
    return this.inspectionService.update(
      tenantId,
      projectId,
      permitId,
      id,
      userId,
      dto,
    );
  }

  // -------------------------------------------------------------------------
  // DELETE /projects/:projectId/permits/:permitId/inspections/:id — Hard delete
  // -------------------------------------------------------------------------
  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hard delete an inspection' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'permitId', description: 'Permit UUID' })
  @ApiParam({ name: 'id', description: 'Inspection UUID' })
  @ApiResponse({ status: 204, description: 'Inspection deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Inspection not found' })
  async hardDelete(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('permitId', ParseUUIDPipe) permitId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.inspectionService.hardDelete(
      tenantId,
      projectId,
      permitId,
      id,
      userId,
    );
  }
}
