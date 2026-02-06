import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionGuard } from '../rbac/guards/permission.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermission } from '../rbac/decorators/require-permission.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { FilesService } from './files.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { FileQueryDto } from './dto/file-query.dto';
import { CreateShareLinkDto } from './dto/create-share-link.dto';
import { AccessShareLinkDto } from './dto/access-share-link.dto';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { BulkDownloadDto } from './dto/bulk-download.dto';

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'category'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload',
        },
        category: {
          type: 'string',
          enum: [
            'quote',
            'invoice',
            'license',
            'insurance',
            'logo',
            'contract',
            'receipt',
            'photo',
            'report',
            'signature',
            'misc',
          ],
          description: 'File category',
        },
        entity_type: {
          type: 'string',
          description: 'Entity type this file is attached to (optional)',
        },
        entity_id: {
          type: 'string',
          description: 'Entity ID this file is attached to (optional)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'File uploaded successfully' })
  async uploadFile(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: UploadFileDto,
  ) {
    // Debug: Check if file was extracted
    console.log('[FilesController] Upload details:', {
      hasFile: !!file,
      fileDetails: file
        ? {
            fieldname: file.fieldname,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
          }
        : 'NO FILE',
      contentType: req.headers['content-type'],
      body: uploadDto,
    });

    if (!file) {
      throw new BadRequestException(
        'No file uploaded. The file field is missing from the multipart request.',
      );
    }

    return this.filesService.uploadFile(
      req.user.tenant_id,
      req.user.id,
      file,
      uploadDto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get all files with filters and pagination' })
  @ApiQuery({
    name: 'category',
    required: false,
    enum: [
      'quote',
      'invoice',
      'license',
      'insurance',
      'logo',
      'contract',
      'receipt',
      'photo',
      'report',
      'signature',
      'misc',
    ],
  })
  @ApiQuery({ name: 'entity_type', required: false, type: String })
  @ApiQuery({ name: 'entity_id', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Files retrieved successfully' })
  async findAll(@Request() req, @Query() query: FileQueryDto) {
    return this.filesService.findAll(req.user.tenant_id, query);
  }

  @Get('orphans')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Get all orphan files (not attached to any entity)',
  })
  @ApiResponse({
    status: 200,
    description: 'Orphan files retrieved successfully',
  })
  async findOrphans(@Request() req) {
    return this.filesService.findOrphans(req.user.tenant_id);
  }

  @Post('orphans/trash')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Move orphan files (>30 days) to trash' })
  @ApiResponse({ status: 200, description: 'Orphan files moved to trash' })
  async moveOrphansToTrash(@Request() req) {
    return this.filesService.moveOrphansToTrash(
      req.user.tenant_id,
      req.user.id,
    );
  }

  @Delete('trash/cleanup')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Permanently delete trashed files (>30 days in trash)',
  })
  @ApiResponse({
    status: 200,
    description: 'Trashed files permanently deleted',
  })
  async cleanupTrashedFiles(@Request() req) {
    return this.filesService.cleanupTrashedFiles(
      req.user.tenant_id,
      req.user.id,
    );
  }

  @Get('storage/usage')
  @ApiOperation({ summary: 'Get tenant storage usage statistics' })
  @ApiResponse({
    status: 200,
    description: 'Storage usage retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        current_usage_bytes: { type: 'number', example: 157286400 },
        current_usage_gb: { type: 'number', example: 0.15 },
        max_storage_gb: { type: 'number', example: 50, nullable: true },
        percentage_used: { type: 'number', example: 0.3, nullable: true },
        is_unlimited: { type: 'boolean', example: false },
        file_count: { type: 'number', example: 42 },
      },
    },
  })
  async getStorageUsage(@Request() req) {
    return this.filesService.getTenantStorageUsage(req.user.tenant_id);
  }

  @Get(':id')
  @Public() // Allow public access for files in public quotes (logo, signature, attachments, PDF)
  @ApiOperation({ summary: 'Get a single file by ID' })
  @ApiParam({ name: 'id', description: 'File ID (file_id)' })
  @ApiResponse({ status: 200, description: 'File retrieved successfully' })
  async findOne(@Request() req, @Param('id') id: string) {
    // Allow public access (no tenant filtering) or authenticated access (with tenant filtering)
    const tenantId = req.user?.tenant_id || null;
    return this.filesService.findOne(tenantId, id);
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a file (hard delete immediately)' })
  @ApiParam({ name: 'id', description: 'File ID (file_id)' })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  async delete(@Request() req, @Param('id') id: string) {
    return this.filesService.delete(req.user.tenant_id, id, req.user.id);
  }

  // Share Link Endpoints

  @Post('share')
  @ApiOperation({ summary: 'Create a temporary share link for a file' })
  @ApiResponse({ status: 201, description: 'Share link created successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async createShareLink(@Request() req, @Body() dto: CreateShareLinkDto) {
    return this.filesService.createShareLink(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Get('share/list')
  @ApiOperation({
    summary: 'List all share links (optionally filter by file_id)',
  })
  @ApiQuery({
    name: 'file_id',
    required: false,
    type: String,
    description: 'Filter by file ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Share links retrieved successfully',
  })
  async listShareLinks(@Request() req, @Query('file_id') fileId?: string) {
    return this.filesService.listShareLinks(req.user.tenant_id, fileId);
  }

  @Delete('share/:id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a share link' })
  @ApiParam({ name: 'id', description: 'Share link ID' })
  @ApiResponse({ status: 200, description: 'Share link revoked successfully' })
  async revokeShareLink(@Request() req, @Param('id') id: string) {
    return this.filesService.revokeShareLink(
      req.user.tenant_id,
      req.user.id,
      id,
    );
  }

  // Bulk Operations

  @Post('bulk/delete')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Bulk delete multiple files' })
  @ApiResponse({ status: 200, description: 'Files deleted successfully' })
  @ApiResponse({
    status: 400,
    description: 'Some files not found or validation error',
  })
  async bulkDelete(@Request() req, @Body() dto: BulkDeleteDto) {
    return this.filesService.bulkDelete(req.user.tenant_id, req.user.id, dto);
  }

  @Post('bulk/download')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('files', 'view')
  @ApiOperation({ summary: 'Bulk download multiple files as ZIP' })
  @ApiResponse({ status: 200, description: 'ZIP file created' })
  async bulkDownload(@Request() req, @Body() dto: BulkDownloadDto, @Res() res) {
    const zipBuffer = await this.filesService.bulkDownload(
      req.user.tenant_id,
      req.user.id,
      dto,
    );

    const zipName = dto.zip_name || 'files.zip';

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"`,
      'Content-Length': zipBuffer.length,
    });

    res.send(zipBuffer);
  }
}

// Public Share Link Controller (no authentication required)
@ApiTags('Public File Sharing')
@Controller('public/share')
export class PublicShareController {
  constructor(private readonly filesService: FilesService) {}

  @Post(':token/access')
  @Public()
  @ApiOperation({
    summary: 'View a shared file (increments view count, not download count)',
  })
  @ApiParam({ name: 'token', description: 'Share token (64-char hex)' })
  @ApiBody({
    type: AccessShareLinkDto,
    description: 'Optional password for protected files',
  })
  @ApiResponse({
    status: 200,
    description:
      'File information retrieved successfully (view_count incremented)',
  })
  @ApiResponse({
    status: 401,
    description: 'Password required or invalid password',
  })
  @ApiResponse({ status: 404, description: 'Share link not found' })
  @ApiResponse({ status: 400, description: 'Share link expired or revoked' })
  async accessShareLink(
    @Param('token') token: string,
    @Body() dto: AccessShareLinkDto,
  ) {
    return this.filesService.viewShareLink(token, dto);
  }

  @Post(':token/download')
  @Public()
  @ApiOperation({
    summary: 'Download a shared file (increments download count)',
  })
  @ApiParam({ name: 'token', description: 'Share token (64-char hex)' })
  @ApiBody({
    type: AccessShareLinkDto,
    description: 'Optional password for protected files',
  })
  @ApiResponse({
    status: 200,
    description: 'File download link provided (download_count incremented)',
  })
  @ApiResponse({
    status: 401,
    description: 'Password required or invalid password',
  })
  @ApiResponse({ status: 404, description: 'Share link not found' })
  @ApiResponse({
    status: 400,
    description: 'Share link expired, revoked, or max downloads reached',
  })
  async downloadSharedFile(
    @Param('token') token: string,
    @Body() dto: AccessShareLinkDto,
  ) {
    return this.filesService.downloadShareLink(token, dto);
  }
}
