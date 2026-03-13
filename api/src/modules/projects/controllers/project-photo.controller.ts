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
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { ProjectPhotoService } from '../services/project-photo.service';
import { UploadProjectPhotoDto } from '../dto/upload-project-photo.dto';
import { UpdateProjectPhotoDto } from '../dto/update-project-photo.dto';

@ApiTags('Project Photos')
@ApiBearerAuth()
@Controller('projects/:projectId/photos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectPhotoController {
  constructor(private readonly projectPhotoService: ProjectPhotoService) {}

  // ---------------------------------------------------------------------------
  // POST /projects/:projectId/photos
  // ---------------------------------------------------------------------------

  @Post()
  @Roles('Owner', 'Admin', 'Manager', 'Field')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a photo to a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 201, description: 'Photo uploaded' })
  @ApiResponse({ status: 400, description: 'Validation error or missing file' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Project or task not found' })
  async upload(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadProjectPhotoDto,
  ) {
    return this.projectPhotoService.upload(
      tenantId,
      projectId,
      req.user.id,
      file,
      dto,
    );
  }

  // ---------------------------------------------------------------------------
  // GET /projects/:projectId/photos
  // ---------------------------------------------------------------------------

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Field')
  @ApiOperation({ summary: 'List photos for a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiQuery({
    name: 'task_id',
    required: false,
    type: String,
    description: 'Filter by task UUID',
  })
  @ApiQuery({
    name: 'is_public',
    required: false,
    type: Boolean,
    description: 'Filter by portal visibility',
  })
  @ApiQuery({
    name: 'date_from',
    required: false,
    type: String,
    description: 'Filter by date range start (ISO date: YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'date_to',
    required: false,
    type: String,
    description: 'Filter by date range end (ISO date: YYYY-MM-DD)',
  })
  @ApiResponse({ status: 200, description: 'List of project photos' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findAll(
    @TenantId() tenantId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('task_id') taskId?: string,
    @Query('is_public') isPublic?: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.projectPhotoService.findAll(tenantId, projectId, {
      task_id: taskId || undefined,
      is_public:
        isPublic !== undefined ? isPublic === 'true' : undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    });
  }

  // ---------------------------------------------------------------------------
  // PATCH /projects/:projectId/photos/:id
  // ---------------------------------------------------------------------------

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Update photo metadata (caption, is_public)' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Photo UUID' })
  @ApiResponse({ status: 200, description: 'Updated photo' })
  @ApiResponse({ status: 404, description: 'Photo not found' })
  async update(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectPhotoDto,
  ) {
    return this.projectPhotoService.update(
      tenantId,
      projectId,
      id,
      req.user.id,
      dto,
    );
  }

  // ---------------------------------------------------------------------------
  // DELETE /projects/:projectId/photos/:id
  // ---------------------------------------------------------------------------

  @Delete(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a photo from a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Photo UUID' })
  @ApiResponse({ status: 200, description: 'Photo deleted' })
  @ApiResponse({ status: 404, description: 'Photo not found' })
  async delete(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.projectPhotoService.delete(
      tenantId,
      projectId,
      id,
      req.user.id,
    );
    return { message: 'Photo deleted' };
  }
}
