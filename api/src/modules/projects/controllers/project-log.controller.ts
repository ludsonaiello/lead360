import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import { ProjectLogService } from '../services/project-log.service';
import { CreateProjectLogDto } from '../dto/create-project-log.dto';

@ApiTags('Project Logs')
@ApiBearerAuth()
@Controller('projects/:projectId/logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectLogController {
  constructor(private readonly projectLogService: ProjectLogService) {}

  // ---------------------------------------------------------------------------
  // POST /projects/:projectId/logs
  // ---------------------------------------------------------------------------

  @Post()
  @Roles('Owner', 'Admin', 'Manager', 'Field')
  @UseInterceptors(FilesInterceptor('attachments', 10))
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a project log entry with optional attachments' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 201, description: 'Log created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or empty content' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Project or task not found' })
  async create(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: CreateProjectLogDto,
  ) {
    return this.projectLogService.create(
      tenantId,
      projectId,
      req.user.id,
      dto,
      files ?? [],
    );
  }

  // ---------------------------------------------------------------------------
  // GET /projects/:projectId/logs
  // ---------------------------------------------------------------------------

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Field')
  @ApiOperation({ summary: 'List project logs (paginated)' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiQuery({
    name: 'is_public',
    required: false,
    type: Boolean,
    description: 'Filter by portal visibility',
  })
  @ApiQuery({
    name: 'has_attachments',
    required: false,
    type: Boolean,
    description: 'Filter by whether log has attachments (true/false)',
  })
  @ApiQuery({
    name: 'date_from',
    required: false,
    type: String,
    description: 'Filter by log_date range start (ISO date: YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'date_to',
    required: false,
    type: String,
    description: 'Filter by log_date range end (ISO date: YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiResponse({ status: 200, description: 'Paginated list of project logs' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findAll(
    @TenantId() tenantId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('is_public') isPublic?: string,
    @Query('has_attachments') hasAttachments?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.projectLogService.findAll(tenantId, projectId, {
      is_public:
        isPublic !== undefined ? isPublic === 'true' : undefined,
      has_attachments:
        hasAttachments !== undefined ? hasAttachments === 'true' : undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  // ---------------------------------------------------------------------------
  // GET /projects/:projectId/logs/:logId/attachments
  // ---------------------------------------------------------------------------

  @Get(':logId/attachments')
  @Roles('Owner', 'Admin', 'Manager', 'Field')
  @ApiOperation({ summary: 'List attachments for a specific log entry' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'logId', description: 'Log UUID' })
  @ApiResponse({
    status: 200,
    description: 'List of attachments for the log entry',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Project or log not found' })
  async findAttachments(
    @TenantId() tenantId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('logId', ParseUUIDPipe) logId: string,
  ) {
    return this.projectLogService.findAttachments(
      tenantId,
      projectId,
      logId,
    );
  }

  // ---------------------------------------------------------------------------
  // DELETE /projects/:projectId/logs/:id
  // ---------------------------------------------------------------------------

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a project log and cascade attachments' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Log UUID' })
  @ApiResponse({ status: 200, description: 'Log deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Log not found' })
  async delete(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.projectLogService.delete(
      tenantId,
      projectId,
      id,
      req.user.id,
    );
    return { message: 'Log deleted' };
  }
}
