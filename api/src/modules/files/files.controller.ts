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
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
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
import { Roles } from '../auth/decorators/roles.decorator';
import { FilesService } from './files.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { FileQueryDto } from './dto/file-query.dto';

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
          enum: ['quote', 'invoice', 'license', 'insurance', 'misc'],
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
    return this.filesService.uploadFile(req.user.tenant_id, req.user.id, file, uploadDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all files with filters and pagination' })
  @ApiQuery({ name: 'category', required: false, enum: ['quote', 'invoice', 'license', 'insurance', 'misc'] })
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
  @ApiOperation({ summary: 'Get all orphan files (not attached to any entity)' })
  @ApiResponse({ status: 200, description: 'Orphan files retrieved successfully' })
  async findOrphans(@Request() req) {
    return this.filesService.findOrphans(req.user.tenant_id);
  }

  @Post('orphans/trash')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Move orphan files (>30 days) to trash' })
  @ApiResponse({ status: 200, description: 'Orphan files moved to trash' })
  async moveOrphansToTrash(@Request() req) {
    return this.filesService.moveOrphansToTrash(req.user.tenant_id, req.user.id);
  }

  @Delete('trash/cleanup')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete trashed files (>30 days in trash)' })
  @ApiResponse({ status: 200, description: 'Trashed files permanently deleted' })
  async cleanupTrashedFiles(@Request() req) {
    return this.filesService.cleanupTrashedFiles(req.user.tenant_id, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single file by ID' })
  @ApiParam({ name: 'id', description: 'File ID (file_id)' })
  @ApiResponse({ status: 200, description: 'File retrieved successfully' })
  async findOne(@Request() req, @Param('id') id: string) {
    return this.filesService.findOne(req.user.tenant_id, id);
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
}
