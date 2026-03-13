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
import { ProjectDocumentService } from '../services/project-document.service';
import { UploadProjectDocumentDto } from '../dto/upload-project-document.dto';

@ApiTags('Project Documents')
@ApiBearerAuth()
@Controller('projects/:projectId/documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectDocumentController {
  constructor(
    private readonly projectDocumentService: ProjectDocumentService,
  ) {}

  // ---------------------------------------------------------------------------
  // POST /projects/:projectId/documents
  // ---------------------------------------------------------------------------

  @Post()
  @Roles('Owner', 'Admin', 'Manager')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a document to a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 201, description: 'Document uploaded' })
  @ApiResponse({ status: 400, description: 'Validation error or missing file' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async upload(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadProjectDocumentDto,
  ) {
    return this.projectDocumentService.upload(
      tenantId,
      projectId,
      req.user.id,
      file,
      dto,
    );
  }

  // ---------------------------------------------------------------------------
  // GET /projects/:projectId/documents
  // ---------------------------------------------------------------------------

  @Get()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'List documents for a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiQuery({
    name: 'document_type',
    required: false,
    type: String,
    enum: ['contract', 'permit', 'blueprint', 'agreement', 'photo', 'other'],
    description: 'Filter by document type',
  })
  @ApiResponse({ status: 200, description: 'List of project documents' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async findAll(
    @TenantId() tenantId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('document_type') documentType?: string,
  ) {
    return this.projectDocumentService.findAll(tenantId, projectId, {
      document_type: documentType || undefined,
    });
  }

  // ---------------------------------------------------------------------------
  // DELETE /projects/:projectId/documents/:id
  // ---------------------------------------------------------------------------

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a document from a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiResponse({ status: 200, description: 'Document deleted' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async delete(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.projectDocumentService.delete(
      tenantId,
      projectId,
      id,
      req.user.id,
    );
    return { message: 'Document deleted' };
  }
}
