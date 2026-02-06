import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { FilesService } from '../../files/files.service';
import { QrCodeGeneratorService } from './qr-code-generator.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  CreateQuoteAttachmentDto,
  UpdateQuoteAttachmentDto,
  ReorderAttachmentsDto,
  QuoteAttachmentResponseDto,
  FileInfoDto,
} from '../dto/attachment';
import { attachment_type, grid_layout } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * QuoteAttachmentService
 *
 * Manages quote attachments including:
 * - Photo attachments (cover, full-page, grid)
 * - URL attachments with QR code generation
 * - Attachment ordering
 * - File validation
 *
 * Business Rules:
 * - Only 1 cover photo allowed per quote
 * - QR codes auto-generated for URL attachments
 * - Grid photos require grid_layout specification
 * - All attachments tenant-isolated
 *
 * @author Backend Developer
 */
@Injectable()
export class QuoteAttachmentService {
  private readonly logger = new Logger(QuoteAttachmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    private readonly qrCodeService: QrCodeGeneratorService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Create new attachment for a quote
   *
   * @param tenantId - Tenant ID
   * @param quoteId - Quote UUID
   * @param dto - Attachment creation data
   * @param userId - User creating attachment
   * @returns Created attachment with file data
   */
  async createAttachment(
    tenantId: string,
    quoteId: string,
    dto: CreateQuoteAttachmentDto,
    userId: string,
  ): Promise<QuoteAttachmentResponseDto> {
    this.logger.log(
      `Creating attachment for quote ${quoteId} (tenant: ${tenantId})`,
    );

    // 1. Validate quote exists and belongs to tenant, get tenant subdomain
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
      include: {
        tenant: {
          select: { subdomain: true },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote ${quoteId} not found`);
    }

    // 2. Validate attachment type specific rules
    this.validateAttachmentType(dto);

    // 3. For photo types: validate file exists and belongs to tenant
    if (
      ['cover_photo', 'full_page_photo', 'grid_photo'].includes(
        dto.attachment_type,
      )
    ) {
      if (!dto.file_id) {
        throw new BadRequestException(
          'file_id is required for photo attachments',
        );
      }
      await this.validatePhotoFile(tenantId, dto.file_id);
    }

    // 4. For cover_photo: check if one already exists (only 1 allowed)
    if (dto.attachment_type === 'cover_photo') {
      const existingCoverPhoto = await this.prisma.quote_attachment.findFirst({
        where: {
          quote_id: quoteId,
          attachment_type: 'cover_photo',
        },
      });

      if (existingCoverPhoto) {
        this.logger.log(
          `Deleting existing cover photo ${existingCoverPhoto.id} before creating new one`,
        );
        await this.deleteAttachment(
          tenantId,
          quoteId,
          existingCoverPhoto.id,
          userId,
        );
      }
    }

    // 5. Generate QR code for URL attachments
    let qrCodeFileId: string | null = null;
    if (dto.attachment_type === 'url_attachment' && dto.url) {
      try {
        qrCodeFileId = await this.qrCodeService.generateAndSave(
          tenantId,
          dto.url,
          userId,
          quoteId,
        );
        this.logger.log(
          `QR code generated for URL attachment: ${qrCodeFileId}`,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to generate QR code: ${error.message}. Continuing without QR code.`,
        );
        // Graceful degradation - attachment created without QR code
      }
    }

    // 6. Determine order_index (max + 1 if not provided)
    const orderIndex =
      dto.order_index ?? (await this.getNextOrderIndex(quoteId));

    // 7. Create attachment record
    const attachment = await this.prisma.quote_attachment.create({
      data: {
        id: randomUUID(),
        quote_id: quoteId,
        attachment_type: dto.attachment_type,
        file_id: dto.file_id || null,
        url: dto.url || null,
        title: dto.title || null,
        qr_code_file_id: qrCodeFileId,
        grid_layout: dto.grid_layout || null,
        order_index: orderIndex,
      },
      include: {
        file: true,
        qr_code_file: true,
      },
    });

    // 8. Audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'quote_attachment',
      entityId: attachment.id,
      tenantId,
      actorUserId: userId,
      after: attachment,
      description: `Quote attachment created: ${dto.attachment_type}`,
    });

    this.logger.log(`Attachment ${attachment.id} created successfully`);
    return this.mapToResponseDto(attachment, quote.tenant.subdomain);
  }

  /**
   * Update existing attachment
   *
   * @param tenantId - Tenant ID
   * @param quoteId - Quote UUID
   * @param attachmentId - Attachment UUID
   * @param dto - Update data
   * @param userId - User updating attachment
   * @returns Updated attachment
   */
  async updateAttachment(
    tenantId: string,
    quoteId: string,
    attachmentId: string,
    dto: UpdateQuoteAttachmentDto,
    userId: string,
  ): Promise<QuoteAttachmentResponseDto> {
    this.logger.log(
      `Updating attachment ${attachmentId} (quote: ${quoteId}, tenant: ${tenantId})`,
    );

    // 1. Get tenant subdomain
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subdomain: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant not found`);
    }

    // 2. Validate attachment exists and belongs to tenant/quote
    const attachment = await this.getAttachmentOrFail(
      tenantId,
      quoteId,
      attachmentId,
    );

    // 2. If URL changed: regenerate QR code
    let qrCodeFileId = attachment.qr_code_file_id;
    if (
      dto.url &&
      dto.url !== attachment.url &&
      attachment.attachment_type === 'url_attachment'
    ) {
      this.logger.log(`URL changed, regenerating QR code`);
      try {
        // Delete old QR code file if exists
        if (attachment.qr_code_file_id) {
          // Note: File deletion handled by cascade in database
        }

        // Generate new QR code
        qrCodeFileId = await this.qrCodeService.generateAndSave(
          tenantId,
          dto.url,
          userId,
          quoteId,
        );
        this.logger.log(`New QR code generated: ${qrCodeFileId}`);
      } catch (error) {
        this.logger.warn(`Failed to regenerate QR code: ${error.message}`);
        // Continue with update even if QR code fails
      }
    }

    // 3. Validate grid_layout if provided
    if (dto.grid_layout && attachment.attachment_type !== 'grid_photo') {
      throw new BadRequestException(
        'grid_layout can only be set for grid_photo attachment type',
      );
    }

    // 4. Update attachment
    const updated = await this.prisma.quote_attachment.update({
      where: { id: attachmentId },
      data: {
        title: dto.title ?? attachment.title,
        url: dto.url ?? attachment.url,
        qr_code_file_id: qrCodeFileId,
        grid_layout: dto.grid_layout ?? attachment.grid_layout,
        order_index: dto.order_index ?? attachment.order_index,
      },
      include: {
        file: true,
        qr_code_file: true,
      },
    });

    // 5. Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'quote_attachment',
      entityId: attachmentId,
      tenantId,
      actorUserId: userId,
      before: attachment,
      after: updated,
      description: `Quote attachment updated: ${attachment.attachment_type}`,
    });

    this.logger.log(`Attachment ${attachmentId} updated successfully`);
    return this.mapToResponseDto(updated, tenant.subdomain);
  }

  /**
   * Delete attachment
   *
   * @param tenantId - Tenant ID
   * @param quoteId - Quote UUID
   * @param attachmentId - Attachment UUID
   * @param userId - User deleting attachment
   */
  async deleteAttachment(
    tenantId: string,
    quoteId: string,
    attachmentId: string,
    userId: string,
  ): Promise<void> {
    this.logger.log(
      `Deleting attachment ${attachmentId} (quote: ${quoteId}, tenant: ${tenantId})`,
    );

    // 1. Validate attachment exists and get file references
    const attachment = await this.getAttachmentOrFail(
      tenantId,
      quoteId,
      attachmentId,
    );

    // 2. Delete associated files from storage BEFORE deleting attachment record
    // This ensures files are cleaned up properly
    if (attachment.file_id) {
      try {
        this.logger.log(`Deleting file ${attachment.file_id} from storage`);
        await this.filesService.delete(tenantId, attachment.file_id, userId);
        this.logger.log(`File ${attachment.file_id} deleted successfully`);
      } catch (error) {
        this.logger.warn(
          `Failed to delete file ${attachment.file_id}: ${error.message}`,
        );
        // Continue with attachment deletion even if file deletion fails
        // This prevents orphaned attachment records
      }
    }

    // 3. Delete QR code file if exists
    if (attachment.qr_code_file_id) {
      try {
        this.logger.log(
          `Deleting QR code file ${attachment.qr_code_file_id} from storage`,
        );
        await this.filesService.delete(
          tenantId,
          attachment.qr_code_file_id,
          userId,
        );
        this.logger.log(
          `QR code file ${attachment.qr_code_file_id} deleted successfully`,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to delete QR code file ${attachment.qr_code_file_id}: ${error.message}`,
        );
        // Continue with attachment deletion
      }
    }

    // 4. Delete attachment record from database
    await this.prisma.quote_attachment.delete({
      where: { id: attachmentId },
    });

    // 5. Audit log
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'quote_attachment',
      entityId: attachmentId,
      tenantId,
      actorUserId: userId,
      before: attachment,
      description: `Quote attachment deleted: ${attachment.attachment_type}`,
    });

    this.logger.log(
      `Attachment ${attachmentId} and associated files deleted successfully`,
    );
  }

  /**
   * List all attachments for a quote
   *
   * @param tenantId - Tenant ID
   * @param quoteId - Quote UUID
   * @returns Array of attachments ordered by type and order_index
   */
  async listAttachments(
    tenantId: string,
    quoteId: string,
  ): Promise<QuoteAttachmentResponseDto[]> {
    this.logger.log(
      `Listing attachments for quote ${quoteId} (tenant: ${tenantId})`,
    );

    // 1. Validate quote exists and get tenant subdomain
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
      include: {
        tenant: {
          select: { subdomain: true },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote ${quoteId} not found`);
    }

    // 2. Fetch attachments ordered by type and order_index
    const attachments = await this.prisma.quote_attachment.findMany({
      where: { quote_id: quoteId },
      include: {
        file: true,
        qr_code_file: true,
      },
      orderBy: [
        { attachment_type: 'asc' }, // cover_photo first, then full_page, grid, url
        { order_index: 'asc' },
      ],
    });

    return attachments.map((att) =>
      this.mapToResponseDto(att, quote.tenant.subdomain),
    );
  }

  /**
   * Get single attachment
   *
   * @param tenantId - Tenant ID
   * @param quoteId - Quote UUID
   * @param attachmentId - Attachment UUID
   * @returns Attachment with file data
   */
  async getAttachment(
    tenantId: string,
    quoteId: string,
    attachmentId: string,
  ): Promise<QuoteAttachmentResponseDto> {
    this.logger.log(
      `Getting attachment ${attachmentId} (quote: ${quoteId}, tenant: ${tenantId})`,
    );

    // Get tenant subdomain
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subdomain: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant not found`);
    }

    const attachment = await this.prisma.quote_attachment.findFirst({
      where: {
        id: attachmentId,
        quote_id: quoteId,
        quote: { tenant_id: tenantId },
      },
      include: {
        file: true,
        qr_code_file: true,
      },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }

    return this.mapToResponseDto(attachment, tenant.subdomain);
  }

  /**
   * Reorder attachments in bulk
   *
   * @param tenantId - Tenant ID
   * @param quoteId - Quote UUID
   * @param dto - Array of attachment IDs with new order indices
   * @param userId - User reordering attachments
   */
  async reorderAttachments(
    tenantId: string,
    quoteId: string,
    dto: ReorderAttachmentsDto,
    userId: string,
  ): Promise<void> {
    this.logger.log(
      `Reordering ${dto.attachments.length} attachments for quote ${quoteId}`,
    );

    // 1. Validate quote exists
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException(`Quote ${quoteId} not found`);
    }

    // 2. Validate all attachment IDs belong to this quote
    const attachmentIds = dto.attachments.map((a) => a.id);
    const existingAttachments = await this.prisma.quote_attachment.findMany({
      where: {
        id: { in: attachmentIds },
        quote_id: quoteId,
      },
    });

    if (existingAttachments.length !== attachmentIds.length) {
      throw new BadRequestException(
        'One or more attachment IDs do not belong to this quote',
      );
    }

    // 3. Update order indices in transaction
    await this.prisma.$transaction(
      dto.attachments.map((item) =>
        this.prisma.quote_attachment.update({
          where: { id: item.id },
          data: { order_index: item.order_index },
        }),
      ),
    );

    // 4. Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'quote',
      entityId: quoteId,
      tenantId,
      actorUserId: userId,
      after: { attachments_reordered: dto.attachments.length },
      description: `Quote attachments reordered (${dto.attachments.length} items)`,
    });

    this.logger.log(`Attachments reordered successfully for quote ${quoteId}`);
  }

  // ========== PRIVATE HELPER METHODS ==========

  /**
   * Validate attachment type specific rules
   */
  private validateAttachmentType(dto: CreateQuoteAttachmentDto): void {
    if (dto.attachment_type === 'url_attachment') {
      if (!dto.url) {
        throw new BadRequestException(
          'url is required for url_attachment type',
        );
      }
      if (dto.file_id) {
        throw new BadRequestException(
          'file_id must be null for url_attachment type',
        );
      }
    }

    if (
      ['cover_photo', 'full_page_photo', 'grid_photo'].includes(
        dto.attachment_type,
      )
    ) {
      if (!dto.file_id) {
        throw new BadRequestException(
          `file_id is required for ${dto.attachment_type} type`,
        );
      }
      if (dto.url) {
        throw new BadRequestException(
          'url must be null for photo attachment types',
        );
      }
    }

    if (dto.attachment_type === 'grid_photo') {
      if (!dto.grid_layout) {
        throw new BadRequestException(
          'grid_layout is required for grid_photo type',
        );
      }
    } else {
      if (dto.grid_layout) {
        throw new BadRequestException(
          'grid_layout can only be set for grid_photo type',
        );
      }
    }
  }

  /**
   * Validate photo file exists and belongs to tenant
   */
  private async validatePhotoFile(
    tenantId: string,
    fileId: string,
  ): Promise<void> {
    const file = await this.prisma.file.findFirst({
      where: {
        file_id: fileId,
        tenant_id: tenantId,
      },
    });

    if (!file) {
      throw new NotFoundException(
        `File ${fileId} not found or does not belong to tenant`,
      );
    }

    // Validate it's an image
    if (!file.mime_type.startsWith('image/')) {
      throw new BadRequestException(
        `File ${fileId} is not an image (mime_type: ${file.mime_type})`,
      );
    }
  }

  /**
   * Get next order_index for quote attachments
   */
  private async getNextOrderIndex(quoteId: string): Promise<number> {
    const maxOrder = await this.prisma.quote_attachment.aggregate({
      where: { quote_id: quoteId },
      _max: { order_index: true },
    });

    return (maxOrder._max.order_index ?? -1) + 1;
  }

  /**
   * Get attachment or throw NotFoundException
   */
  private async getAttachmentOrFail(
    tenantId: string,
    quoteId: string,
    attachmentId: string,
  ) {
    const attachment = await this.prisma.quote_attachment.findFirst({
      where: {
        id: attachmentId,
        quote_id: quoteId,
        quote: { tenant_id: tenantId },
      },
    });

    if (!attachment) {
      throw new NotFoundException(`Attachment ${attachmentId} not found`);
    }

    return attachment;
  }

  /**
   * Map Prisma model to response DTO
   */
  private mapToResponseDto(
    attachment: any,
    tenantSubdomain: string,
  ): QuoteAttachmentResponseDto {
    return {
      id: attachment.id,
      quote_id: attachment.quote_id,
      attachment_type: attachment.attachment_type,
      file_id: attachment.file_id,
      url: attachment.url,
      title: attachment.title,
      qr_code_file_id: attachment.qr_code_file_id,
      grid_layout: attachment.grid_layout,
      order_index: attachment.order_index,
      created_at: attachment.created_at,
      file: attachment.file
        ? this.mapFileInfo(attachment.file, tenantSubdomain)
        : undefined,
      qr_code_file: attachment.qr_code_file
        ? this.mapFileInfo(attachment.qr_code_file, tenantSubdomain)
        : undefined,
    };
  }

  /**
   * Map file data to FileInfoDto
   */
  private mapFileInfo(file: any, tenantSubdomain: string): FileInfoDto {
    // Construct URL using app.lead360.app (tenant subdomains don't serve uploads)
    // storage_path format: /public/{tenant_id}/files/{file_id}.ext or /var/www/.../public/{tenant_id}/files/{file_id}.ext
    // Result: https://app.lead360.app/uploads/public/{tenant_id}/files/{file_id}.ext
    const appUrl = 'https://app.lead360.app';

    let url: string | undefined;
    if (file.storage_path) {
      // Extract the relative path from storage_path
      // If it's an absolute path like /var/www/lead360.app/app/uploads/public/{tenant_id}/files/{file}.jpg
      // Extract everything after 'uploads/'
      let relativePath = file.storage_path;
      if (relativePath.includes('/uploads/public/')) {
        const parts = relativePath.split('/uploads/public/');
        relativePath = `/public/${parts[1]}`;
      }
      // If it starts with /public/{tenant_id}, prepend /uploads
      if (relativePath.startsWith('/public/')) {
        relativePath = `/uploads${relativePath}`;
      }
      url = `${appUrl}${relativePath}`;
    }

    // Same for thumbnail
    let thumbnail_url: string | undefined;
    if (file.thumbnail_path) {
      let relativePath = file.thumbnail_path;
      if (relativePath.includes('/uploads/public/')) {
        const parts = relativePath.split('/uploads/public/');
        relativePath = `/public/${parts[1]}`;
      }
      if (relativePath.startsWith('/public/')) {
        relativePath = `/uploads${relativePath}`;
      }
      thumbnail_url = `${appUrl}${relativePath}`;
    }

    return {
      file_id: file.file_id,
      original_filename: file.original_filename,
      mime_type: file.mime_type,
      size_bytes: file.size_bytes,
      url: url,
      width: file.width,
      height: file.height,
      thumbnail_url: thumbnail_url,
    };
  }
}
