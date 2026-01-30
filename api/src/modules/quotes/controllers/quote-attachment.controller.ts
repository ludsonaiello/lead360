import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { QuoteAttachmentService } from '../services/quote-attachment.service';
import {
  CreateQuoteAttachmentDto,
  UpdateQuoteAttachmentDto,
  ReorderAttachmentsDto,
  QuoteAttachmentResponseDto,
} from '../dto/attachment';

/**
 * QuoteAttachmentController
 *
 * Manages quote attachments (photos and URL links with QR codes)
 *
 * Endpoints:
 * - POST   /quotes/:quoteId/attachments              - Create attachment
 * - GET    /quotes/:quoteId/attachments              - List all attachments
 * - GET    /quotes/:quoteId/attachments/:id          - Get single attachment
 * - PATCH  /quotes/:quoteId/attachments/:id          - Update attachment
 * - DELETE /quotes/:quoteId/attachments/:id          - Delete attachment
 * - PATCH  /quotes/:quoteId/attachments/reorder      - Reorder attachments
 *
 * @author Backend Developer
 */
@ApiTags('Quotes - Attachments')
@ApiBearerAuth()
@Controller('quotes/:quoteId/attachments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteAttachmentController {
  private readonly logger = new Logger(QuoteAttachmentController.name);

  constructor(private readonly attachmentService: QuoteAttachmentService) {}

  // ========== ATTACHMENT CRUD ==========

  @Post()
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Add attachment to quote',
    description: 'Create a photo or URL attachment. URL attachments automatically generate QR codes. Only 1 cover photo allowed per quote.'
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({
    status: 201,
    description: 'Attachment created successfully',
    type: QuoteAttachmentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Quote or file not found' })
  @ApiResponse({
    status: 400,
    description: 'Invalid attachment type rules (e.g., url_attachment requires url field)',
  })
  async create(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Body() dto: CreateQuoteAttachmentDto,
  ): Promise<QuoteAttachmentResponseDto> {
    this.logger.log(`Creating attachment for quote ${quoteId} (type: ${dto.attachment_type})`);
    return this.attachmentService.createAttachment(
      req.user.tenant_id,
      quoteId,
      dto,
      req.user.id,
    );
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'List all attachments for quote',
    description: 'Returns all attachments ordered by type and order_index'
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({
    status: 200,
    description: 'Attachments retrieved successfully',
    type: [QuoteAttachmentResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async list(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
  ): Promise<QuoteAttachmentResponseDto[]> {
    this.logger.log(`Listing attachments for quote ${quoteId}`);
    return this.attachmentService.listAttachments(
      req.user.tenant_id,
      quoteId,
    );
  }

  @Patch('reorder')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Reorder attachments',
    description: 'Bulk update order_index for multiple attachments. All attachment IDs must belong to the quote.'
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({
    status: 200,
    description: 'Attachments reordered successfully',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Attachments reordered successfully' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  @ApiResponse({
    status: 400,
    description: 'One or more attachment IDs do not belong to this quote',
  })
  async reorder(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Body() dto: ReorderAttachmentsDto,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Reordering ${dto.attachments.length} attachments for quote ${quoteId}`);
    await this.attachmentService.reorderAttachments(
      req.user.tenant_id,
      quoteId,
      dto,
      req.user.id,
    );
    return {
      success: true,
      message: 'Attachments reordered successfully',
    };
  }

  @Get(':attachmentId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get single attachment with file data' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({ name: 'attachmentId', description: 'Attachment UUID' })
  @ApiResponse({
    status: 200,
    description: 'Attachment retrieved successfully',
    type: QuoteAttachmentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Quote or attachment not found' })
  async get(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ): Promise<QuoteAttachmentResponseDto> {
    this.logger.log(`Getting attachment ${attachmentId} for quote ${quoteId}`);
    return this.attachmentService.getAttachment(
      req.user.tenant_id,
      quoteId,
      attachmentId,
    );
  }

  @Patch(':attachmentId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Update attachment',
    description: 'Update title, URL (triggers QR regeneration), grid_layout, or order_index. Cannot change attachment_type or file_id.'
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({ name: 'attachmentId', description: 'Attachment UUID' })
  @ApiResponse({
    status: 200,
    description: 'Attachment updated successfully',
    type: QuoteAttachmentResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Quote or attachment not found' })
  @ApiResponse({
    status: 400,
    description: 'Invalid update (e.g., grid_layout on non-grid_photo)',
  })
  async update(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Body() dto: UpdateQuoteAttachmentDto,
  ): Promise<QuoteAttachmentResponseDto> {
    this.logger.log(`Updating attachment ${attachmentId} for quote ${quoteId}`);
    return this.attachmentService.updateAttachment(
      req.user.tenant_id,
      quoteId,
      attachmentId,
      dto,
      req.user.id,
    );
  }

  @Delete(':attachmentId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete attachment',
    description: 'Deletes attachment and associated QR code file (if applicable)'
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({ name: 'attachmentId', description: 'Attachment UUID' })
  @ApiResponse({ status: 204, description: 'Attachment deleted successfully' })
  @ApiResponse({ status: 404, description: 'Quote or attachment not found' })
  async delete(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ): Promise<void> {
    this.logger.log(`Deleting attachment ${attachmentId} for quote ${quoteId}`);
    await this.attachmentService.deleteAttachment(
      req.user.tenant_id,
      quoteId,
      attachmentId,
      req.user.id,
    );
  }
}
