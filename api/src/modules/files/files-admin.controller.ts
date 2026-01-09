import {
  Controller,
  Get,
  Delete,
  Query,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../rbac/guards/platform-admin.guard';
import { FilesService } from './files.service';
import { AdminFileQueryDto, AdminShareLinksQueryDto } from './dto/admin-file-query.dto';

/**
 * Admin Files Controller
 * Platform Admin only - Bypasses tenant isolation
 * Allows Platform Admins to manage files across all tenants
 */
@Controller('admin/files')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@ApiTags('Admin - Files')
@ApiBearerAuth()
export class FilesAdminController {
  constructor(private readonly filesService: FilesService) {}

  /**
   * List all files across all tenants (or filter by tenant_id)
   * GET /admin/files?tenant_id=xxx&page=1&limit=50&status=active&mime_type=application/pdf&search=invoice
   */
  @Get()
  @ApiOperation({
    summary: 'List all files (Platform Admin)',
    description: 'Returns all files across all tenants. Optionally filter by tenant_id, status, mime_type, or search filename.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of files with pagination',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              file_id: { type: 'string' },
              tenant_id: { type: 'string' },
              original_filename: { type: 'string' },
              mime_type: { type: 'string' },
              size_bytes: { type: 'number' },
              category: { type: 'string' },
              storage_provider: { type: 'string' },
              is_deleted: { type: 'boolean' },
              created_at: { type: 'string' },
              tenant_file_tenant_idTotenant: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  company_name: { type: 'string' },
                },
              },
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  first_name: { type: 'string' },
                  last_name: { type: 'string' },
                  email: { type: 'string' },
                },
              },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            current_page: { type: 'number' },
            total_pages: { type: 'number' },
            total_count: { type: 'number' },
            limit: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin required' })
  @ApiQuery({ name: 'tenant_id', required: false, description: 'Filter by tenant ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 50, max: 100)' })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'deleted'], description: 'Filter by status' })
  @ApiQuery({ name: 'mime_type', required: false, description: 'Filter by MIME type' })
  @ApiQuery({ name: 'search', required: false, description: 'Search filename (partial match)' })
  @ApiQuery({ name: 'category', required: false, enum: ['quote', 'invoice', 'license', 'insurance', 'logo', 'contract', 'receipt', 'photo', 'report', 'signature', 'misc'], description: 'Filter by file category' })
  @ApiQuery({ name: 'entity_type', required: false, description: 'Filter by entity type (e.g., "invoice", "user")' })
  @ApiQuery({ name: 'file_type', required: false, enum: ['image', 'document', 'other'], description: 'Filter by file type' })
  async listAllFiles(@Query() query: AdminFileQueryDto) {
    return this.filesService.findAllForAdmin(query);
  }

  /**
   * Get platform-wide file statistics
   * GET /admin/files/stats
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get platform-wide file statistics (Platform Admin)',
    description: 'Returns aggregate statistics for all files across all tenants.',
  })
  @ApiResponse({
    status: 200,
    description: 'Platform file statistics',
    schema: {
      type: 'object',
      properties: {
        total_files: { type: 'number' },
        total_deleted: { type: 'number' },
        total_size_bytes: { type: 'number' },
        total_size_mb: { type: 'string' },
        orphan_files: { type: 'number' },
        by_category: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
        by_mime_type: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              mime_type: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin required' })
  async getFileStats() {
    return this.filesService.getFileStatsForAdmin();
  }

  /**
   * Get storage statistics by tenant
   * GET /admin/files/storage-stats
   */
  @Get('storage-stats')
  @ApiOperation({
    summary: 'Get storage usage by tenant (Platform Admin)',
    description: 'Returns storage consumption per tenant, sorted by usage.',
  })
  @ApiResponse({
    status: 200,
    description: 'Storage statistics by tenant',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tenant_id: { type: 'string' },
          tenant_name: { type: 'string' },
          industry: { type: 'string' },
          file_count: { type: 'number' },
          total_bytes: { type: 'number' },
          total_mb: { type: 'string' },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin required' })
  async getStorageStatsByTenant() {
    return this.filesService.getStorageStatsByTenant();
  }

  /**
   * Get all share links across all tenants
   * GET /admin/files/shares?tenant_id=xxx&active_only=true&page=1&limit=50
   */
  @Get('shares')
  @ApiOperation({
    summary: 'List all file share links (Platform Admin)',
    description: 'Returns all share links across all tenants. Optionally filter by tenant_id or active status.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of share links with pagination',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              file_id: { type: 'string' },
              tenant_id: { type: 'string' },
              public_token: { type: 'string' },
              is_password_protected: { type: 'boolean' },
              expires_at: { type: 'string', nullable: true },
              access_count: { type: 'number' },
              is_active: { type: 'boolean' },
              created_at: { type: 'string' },
              file: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  original_filename: { type: 'string' },
                  mime_type: { type: 'string' },
                  size_bytes: { type: 'number' },
                  category: { type: 'string' },
                },
              },
              tenant: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  company_name: { type: 'string' },
                },
              },
              creator: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  first_name: { type: 'string' },
                  last_name: { type: 'string' },
                  email: { type: 'string' },
                },
              },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            current_page: { type: 'number' },
            total_pages: { type: 'number' },
            total_count: { type: 'number' },
            limit: { type: 'number' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin required' })
  @ApiQuery({ name: 'tenant_id', required: false, description: 'Filter by tenant ID' })
  @ApiQuery({ name: 'active_only', required: false, description: 'Show only active links (default: false)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 50, max: 100)' })
  async getAllShareLinks(@Query() query: AdminShareLinksQueryDto) {
    return this.filesService.getAllShareLinksForAdmin(query);
  }

  /**
   * Get file details by ID (any tenant)
   * GET /admin/files/:id
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get file details by ID (Platform Admin)',
    description: 'Returns file details for any tenant (bypasses tenant isolation).',
  })
  @ApiResponse({
    status: 200,
    description: 'File details with tenant info and share links',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        file_id: { type: 'string' },
        tenant_id: { type: 'string' },
        original_filename: { type: 'string' },
        mime_type: { type: 'string' },
        size_bytes: { type: 'number' },
        category: { type: 'string' },
        storage_provider: { type: 'string' },
        is_deleted: { type: 'boolean' },
        created_at: { type: 'string' },
        tenant_file_tenant_idTotenant: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            company_name: { type: 'string' },
          },
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            email: { type: 'string' },
          },
        },
        file_share_links: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              share_token: { type: 'string' },
              password_hash: { type: 'string', nullable: true },
              expires_at: { type: 'string', nullable: true },
              download_count: { type: 'number' },
              view_count: { type: 'number' },
              is_active: { type: 'boolean' },
              created_at: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'File not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin required' })
  @ApiParam({ name: 'id', description: 'File ID' })
  async getFileById(@Param('id') id: string) {
    return this.filesService.getFileByIdForAdmin(id);
  }

  /**
   * Delete file by ID (any tenant)
   * DELETE /admin/files/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete file by ID (Platform Admin)',
    description: 'Soft deletes file from database and removes from storage. Works for any tenant.',
  })
  @ApiResponse({
    status: 200,
    description: 'File deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'File not found' })
  @ApiResponse({ status: 400, description: 'File is already deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin required' })
  @ApiParam({ name: 'id', description: 'File ID' })
  async deleteFile(@Param('id') id: string, @Request() req) {
    return this.filesService.deleteFileForAdmin(id, req.user.id);
  }
}
