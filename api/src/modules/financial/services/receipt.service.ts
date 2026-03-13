import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { FilesService } from '../../files/files.service';
import { FileCategory } from '../../files/dto/upload-file.dto';
import { UploadReceiptDto } from '../dto/upload-receipt.dto';
import { UpdateReceiptDto } from '../dto/update-receipt.dto';
import { LinkReceiptDto } from '../dto/link-receipt.dto';
import { ListReceiptsDto } from '../dto/list-receipts.dto';

/** MIME types that map to receipt_file_type = 'photo' */
const PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

/** MIME types that map to receipt_file_type = 'pdf' */
const PDF_MIME_TYPES = new Set(['application/pdf']);

/** Max file size enforced at the service layer (25 MB) */
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

/** Accepted MIME types (must match FilesService 'receipt' category rules) */
const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly filesService: FilesService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. uploadReceipt
  // ---------------------------------------------------------------------------

  /**
   * Upload a receipt file and create a receipt record.
   *
   * Steps:
   *  1. Validate file type and size.
   *  2. Delegate file storage to FilesService (category: 'receipt').
   *  3. Determine file_type (photo | pdf) from MIME.
   *  4. Persist receipt row with ocr_status='not_processed', is_categorized=false.
   *  5. Write audit log.
   */
  async uploadReceipt(
    tenantId: string,
    userId: string,
    file: Express.Multer.File,
    dto: UploadReceiptDto,
  ) {
    // --- Guard: file must be present ---
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // --- Guard: MIME type ---
    if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Accepted types: jpg, png, webp, pdf',
      );
    }

    // --- Guard: file size (25 MB) ---
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        'File size exceeds the 25 MB limit for receipts',
      );
    }

    // --- Guard: task must belong to project (if both provided) ---
    if (dto.task_id && dto.project_id) {
      await this.validateTaskBelongsToProject(
        tenantId,
        dto.task_id,
        dto.project_id,
      );
    } else if (dto.task_id && !dto.project_id) {
      // Auto-resolve project_id from task
      const task = await this.prisma.project_task.findFirst({
        where: { id: dto.task_id, tenant_id: tenantId, deleted_at: null },
        select: { project_id: true },
      });
      if (!task) {
        throw new NotFoundException('Task not found');
      }
      dto.project_id = task.project_id;
    }

    // --- Upload file via FilesService ---
    const uploadResult = await this.filesService.uploadFile(
      tenantId,
      userId,
      file,
      {
        category: FileCategory.RECEIPT,
        entity_type: 'receipt',
        // entity_id will be updated after receipt row is created (orphan → linked)
      },
    );

    // --- Determine file_type enum value from MIME ---
    const fileType = this.resolveFileType(file.mimetype);

    // --- Create receipt record ---
    const receipt = await this.prisma.receipt.create({
      data: {
        tenant_id: tenantId,
        financial_entry_id: null,
        project_id: dto.project_id ?? null,
        task_id: dto.task_id ?? null,
        file_id: uploadResult.file.file_id,
        file_url: uploadResult.file.url,
        file_name: file.originalname,
        file_type: fileType,
        file_size_bytes: uploadResult.file.size_bytes ?? null,
        vendor_name: dto.vendor_name ?? null,
        amount: dto.amount != null ? dto.amount : null,
        receipt_date: dto.receipt_date ? new Date(dto.receipt_date) : null,
        ocr_raw: null,
        ocr_status: 'not_processed',
        ocr_vendor: null,
        ocr_amount: null,
        ocr_date: null,
        is_categorized: false,
        uploaded_by_user_id: userId,
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'receipt',
      entityId: receipt.id,
      tenantId,
      actorUserId: userId,
      after: receipt,
      description: `Receipt uploaded: ${file.originalname} (${fileType})`,
    });

    return this.formatReceiptResponse(receipt);
  }

  // ---------------------------------------------------------------------------
  // 2. linkReceiptToEntry
  // ---------------------------------------------------------------------------

  /**
   * Link a receipt to a financial entry (1:1 relationship enforced here).
   *
   * Business rules:
   *  - Receipt must exist and belong to the tenant.
   *  - Financial entry must exist and belong to the tenant.
   *  - A receipt can only be linked to one entry (already linked → error).
   *  - A financial entry can only have one receipt (already has one → error).
   *  - Sets receipt.is_categorized = true and financial_entry.has_receipt = true.
   *  - Both updates run in a transaction.
   */
  async linkReceiptToEntry(
    tenantId: string,
    receiptId: string,
    dto: LinkReceiptDto,
  ) {
    const { financial_entry_id } = dto;

    const receipt = await this.findReceiptOrThrow(tenantId, receiptId);

    // Guard: already linked
    if (receipt.financial_entry_id) {
      throw new BadRequestException(
        'This receipt is already linked to a financial entry. Unlink it first.',
      );
    }

    // Guard: target entry must exist and belong to tenant
    const entry = await this.prisma.financial_entry.findFirst({
      where: { id: financial_entry_id, tenant_id: tenantId },
    });
    if (!entry) {
      throw new NotFoundException('Financial entry not found');
    }

    // Guard: entry already has a receipt (enforce 1:1)
    if (entry.has_receipt) {
      const existingReceipt = await this.prisma.receipt.findFirst({
        where: {
          financial_entry_id,
          tenant_id: tenantId,
        },
        select: { id: true },
      });
      if (existingReceipt) {
        throw new BadRequestException(
          'This financial entry already has a receipt linked to it',
        );
      }
    }

    // Execute atomically
    const [updatedReceipt] = await this.prisma.$transaction([
      this.prisma.receipt.update({
        where: { id: receiptId },
        data: {
          financial_entry_id,
          is_categorized: true,
        },
      }),
      this.prisma.financial_entry.update({
        where: { id: financial_entry_id },
        data: { has_receipt: true },
      }),
    ]);

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'receipt',
      entityId: receiptId,
      tenantId,
      // No actorUserId available in link endpoint — use system marker
      actorUserId: receipt.uploaded_by_user_id,
      before: { financial_entry_id: null, is_categorized: false },
      after: { financial_entry_id, is_categorized: true },
      description: `Receipt ${receiptId} linked to financial entry ${financial_entry_id}`,
    });

    return this.formatReceiptResponse(updatedReceipt);
  }

  // ---------------------------------------------------------------------------
  // 3. updateReceipt
  // ---------------------------------------------------------------------------

  /**
   * Update editable metadata on a receipt: vendor_name, amount, receipt_date.
   * File data, OCR fields, and categorization status are not updatable here.
   */
  async updateReceipt(
    tenantId: string,
    receiptId: string,
    userId: string,
    dto: UpdateReceiptDto,
  ) {
    const existing = await this.findReceiptOrThrow(tenantId, receiptId);

    const data: Record<string, unknown> = {};

    if (dto.vendor_name !== undefined) {
      data.vendor_name = dto.vendor_name ?? null;
    }
    if (dto.amount !== undefined) {
      data.amount = dto.amount ?? null;
    }
    if (dto.receipt_date !== undefined) {
      data.receipt_date = dto.receipt_date ? new Date(dto.receipt_date) : null;
    }

    // Nothing to update — return current state without a write
    if (Object.keys(data).length === 0) {
      return this.formatReceiptResponse(existing);
    }

    const updated = await this.prisma.receipt.update({
      where: { id: receiptId },
      data,
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'receipt',
      entityId: receiptId,
      tenantId,
      actorUserId: userId,
      before: {
        vendor_name: existing.vendor_name,
        amount: existing.amount,
        receipt_date: existing.receipt_date,
      },
      after: {
        vendor_name: updated.vendor_name,
        amount: updated.amount,
        receipt_date: updated.receipt_date,
      },
      description: `Receipt ${receiptId} metadata updated`,
    });

    return this.formatReceiptResponse(updated);
  }

  // ---------------------------------------------------------------------------
  // 4. getProjectReceipts
  // ---------------------------------------------------------------------------

  /**
   * Paginated list of receipts for a project with optional filters.
   * Results ordered by created_at DESC (most recent first).
   */
  async getProjectReceipts(tenantId: string, query: ListReceiptsDto) {
    if (!query.project_id && !query.task_id) {
      throw new BadRequestException(
        'At least one of project_id or task_id is required',
      );
    }

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { tenant_id: tenantId };

    if (query.project_id) where.project_id = query.project_id;
    if (query.task_id) where.task_id = query.task_id;
    if (query.is_categorized !== undefined) {
      where.is_categorized = query.is_categorized;
    }

    const [data, total] = await Promise.all([
      this.prisma.receipt.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.receipt.count({ where }),
    ]);

    return {
      data: data.map((r) => this.formatReceiptResponse(r)),
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 5. getTaskReceipts
  // ---------------------------------------------------------------------------

  /**
   * All receipts for a specific task (no pagination — tasks are bounded).
   * Results ordered by created_at DESC.
   */
  async getTaskReceipts(tenantId: string, taskId: string) {
    // Validate task belongs to tenant
    const task = await this.prisma.project_task.findFirst({
      where: { id: taskId, tenant_id: tenantId, deleted_at: null },
      select: { id: true },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const receipts = await this.prisma.receipt.findMany({
      where: { tenant_id: tenantId, task_id: taskId },
      orderBy: { created_at: 'desc' },
    });

    return receipts.map((r) => this.formatReceiptResponse(r));
  }

  // ---------------------------------------------------------------------------
  // 6. getReceiptById
  // ---------------------------------------------------------------------------

  /**
   * Get a single receipt by ID, scoped to the tenant.
   */
  async getReceiptById(tenantId: string, receiptId: string) {
    const receipt = await this.findReceiptOrThrow(tenantId, receiptId);
    return this.formatReceiptResponse(receipt);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async findReceiptOrThrow(tenantId: string, receiptId: string) {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id: receiptId, tenant_id: tenantId },
    });
    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }
    return receipt;
  }

  private async validateTaskBelongsToProject(
    tenantId: string,
    taskId: string,
    projectId: string,
  ) {
    const task = await this.prisma.project_task.findFirst({
      where: {
        id: taskId,
        project_id: projectId,
        tenant_id: tenantId,
        deleted_at: null,
      },
      select: { id: true },
    });
    if (!task) {
      throw new BadRequestException(
        'Task does not belong to the specified project',
      );
    }
  }

  /**
   * Maps MIME type to Prisma enum `receipt_file_type`.
   * photo: image/jpeg | image/jpg | image/png | image/webp
   * pdf:   application/pdf
   */
  private resolveFileType(mimeType: string): 'photo' | 'pdf' {
    if (PHOTO_MIME_TYPES.has(mimeType)) return 'photo';
    if (PDF_MIME_TYPES.has(mimeType)) return 'pdf';
    // Should never reach here given ACCEPTED_MIME_TYPES guard above
    throw new BadRequestException(`Unsupported MIME type: ${mimeType}`);
  }

  /**
   * Serialize a receipt Prisma record into the canonical API response shape.
   * Decimal values are converted to numbers for JSON serialization.
   */
  private formatReceiptResponse(receipt: any) {
    return {
      id: receipt.id,
      tenant_id: receipt.tenant_id,
      financial_entry_id: receipt.financial_entry_id,
      project_id: receipt.project_id,
      task_id: receipt.task_id,
      file_id: receipt.file_id,
      file_url: receipt.file_url,
      file_name: receipt.file_name,
      file_type: receipt.file_type,
      file_size_bytes: receipt.file_size_bytes,
      vendor_name: receipt.vendor_name,
      amount: receipt.amount != null ? Number(receipt.amount) : null,
      receipt_date: receipt.receipt_date,
      ocr_status: receipt.ocr_status,
      // OCR fields are reserved — always return null in Phase 1
      ocr_vendor: null,
      ocr_amount: null,
      ocr_date: null,
      is_categorized: receipt.is_categorized,
      uploaded_by_user_id: receipt.uploaded_by_user_id,
      created_at: receipt.created_at,
      updated_at: receipt.updated_at,
    };
  }
}
