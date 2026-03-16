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
import { ChecklistTemplateService } from '../services/checklist-template.service';
import { CreateChecklistTemplateDto } from '../dto/create-checklist-template.dto';
import { UpdateChecklistTemplateDto } from '../dto/update-checklist-template.dto';

@ApiTags('Checklist Templates (Settings)')
@ApiBearerAuth()
@Controller('settings/checklist-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChecklistTemplateController {
  constructor(
    private readonly checklistTemplateService: ChecklistTemplateService,
  ) {}

  @Post()
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a completion checklist template with items' })
  @ApiResponse({ status: 201, description: 'Checklist template created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — role not allowed' })
  @ApiResponse({ status: 409, description: 'Template with this name already exists' })
  async create(
    @TenantId() tenantId: string,
    @Request() req,
    @Body() dto: CreateChecklistTemplateDto,
  ) {
    return this.checklistTemplateService.create(tenantId, req.user.id, dto);
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'List checklist templates (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Paginated list of checklist templates' })
  async findAll(
    @TenantId() tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('is_active') isActive?: string,
  ) {
    return this.checklistTemplateService.findAll(tenantId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      is_active: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Get checklist template detail with items' })
  @ApiParam({ name: 'id', description: 'Checklist template UUID' })
  @ApiResponse({ status: 200, description: 'Checklist template with items' })
  @ApiResponse({ status: 404, description: 'Checklist template not found' })
  async findOne(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.checklistTemplateService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Update checklist template (replaces items if provided)' })
  @ApiParam({ name: 'id', description: 'Checklist template UUID' })
  @ApiResponse({ status: 200, description: 'Updated checklist template' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Checklist template not found' })
  @ApiResponse({ status: 409, description: 'Template with this name already exists' })
  async update(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChecklistTemplateDto,
  ) {
    return this.checklistTemplateService.update(
      tenantId,
      id,
      req.user.id,
      dto,
    );
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete checklist template (hard delete, cascades items)' })
  @ApiParam({ name: 'id', description: 'Checklist template UUID' })
  @ApiResponse({ status: 204, description: 'Checklist template deleted' })
  @ApiResponse({ status: 404, description: 'Checklist template not found' })
  async delete(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.checklistTemplateService.delete(tenantId, id, req.user.id);
  }
}
