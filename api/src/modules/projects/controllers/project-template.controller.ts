import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
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
import { ProjectTemplateService } from '../services/project-template.service';
import { CreateProjectTemplateDto } from '../dto/create-project-template.dto';
import { UpdateProjectTemplateDto } from '../dto/update-project-template.dto';

@ApiTags('Project Templates')
@ApiBearerAuth()
@Controller('project-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectTemplateController {
  constructor(private readonly projectTemplateService: ProjectTemplateService) {}

  @Post()
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a project template (optionally with tasks)' })
  @ApiResponse({ status: 201, description: 'Project template created' })
  @ApiResponse({ status: 400, description: 'Validation error or invalid task dependencies' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — role not allowed' })
  async create(
    @TenantId() tenantId: string,
    @Request() req,
    @Body() dto: CreateProjectTemplateDto,
  ) {
    return this.projectTemplateService.create(tenantId, req.user.id, dto);
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'List project templates (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean })
  @ApiQuery({ name: 'industry_type', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated list of project templates' })
  async findAll(
    @TenantId() tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('is_active') isActive?: string,
    @Query('industry_type') industryType?: string,
  ) {
    return this.projectTemplateService.findAll(tenantId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      is_active: isActive !== undefined ? isActive === 'true' : undefined,
      industry_type: industryType || undefined,
    });
  }

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Get project template detail with tasks' })
  @ApiParam({ name: 'id', description: 'Project template UUID' })
  @ApiResponse({ status: 200, description: 'Project template with tasks' })
  @ApiResponse({ status: 404, description: 'Project template not found' })
  async findOne(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.projectTemplateService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Update project template (replaces tasks if provided)' })
  @ApiParam({ name: 'id', description: 'Project template UUID' })
  @ApiResponse({ status: 200, description: 'Updated project template' })
  @ApiResponse({ status: 400, description: 'Validation error or invalid task dependencies' })
  @ApiResponse({ status: 404, description: 'Project template not found' })
  async update(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectTemplateDto,
  ) {
    return this.projectTemplateService.update(tenantId, id, req.user.id, dto);
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete project template (hard delete, cascades tasks)' })
  @ApiParam({ name: 'id', description: 'Project template UUID' })
  @ApiResponse({ status: 204, description: 'Project template deleted' })
  @ApiResponse({ status: 404, description: 'Project template not found' })
  async delete(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.projectTemplateService.delete(tenantId, id, req.user.id);
  }
}
