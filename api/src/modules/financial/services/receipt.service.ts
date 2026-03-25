import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { FilesService } from '../../files/files.service';
import { FileCategory } from '../../files/dto/upload-file.dto';
import { UploadReceiptDto } from '../dto/upload-receipt.dto';
import { UpdateReceiptDto } from '../dto/update-receipt.dto';
import { LinkReceiptDto } from '../dto/link-receipt.dto';
import { ListReceiptsDto } from '../dto/list-receipts.dto';
import { CreateEntryFromReceiptDto } from '../dto/create-entry-from-receipt.dto';
import { SupplierService } from './supplier.service';

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
    @InjectQueue('ocr-processing') private readonly ocrQueue: Queue,
    private readonly supplierService: SupplierService,
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
   *  4. Persist receipt row with ocr_status='processing', is_categorized=false.
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

    // --- Resolve project_id / validate task ownership ---
    let resolvedProjectId = dto.project_id ?? null;
    const resolvedTaskId = dto.task_id ?? null;

    if (resolvedTaskId && resolvedProjectId) {
      await this.validateTaskBelongsToProject(
        tenantId,
        resolvedTaskId,
        resolvedProjectId,
      );
    } else if (resolvedTaskId && !resolvedProjectId) {
      // Auto-resolve project_id from task
      const task = await this.prisma.project_task.findFirst({
        where: { id: resolvedTaskId, tenant_id: tenantId, deleted_at: null },
        select: { project_id: true },
      });
      if (!task) {
        throw new NotFoundException('Task not found');
      }
      resolvedProjectId = task.project_id;
    }

    this.logger.log(
      `Uploading receipt for tenant ${tenantId} by user ${userId} — ${file.originalname} (${file.mimetype}, ${file.size} bytes)`,
    );

    // --- Upload file via FilesService ---
    const uploadResult = await this.filesService.uploadFile(
      tenantId,
      userId,
      file,
      {
        category: FileCategory.RECEIPT,
        entity_type: 'receipt',
      },
    );

    // --- Determine file_type enum value from MIME ---
    const fileType = this.resolveFileType(file.mimetype);

    // --- Create receipt record ---
    const receipt = await this.prisma.receipt.create({
      data: {
        tenant_id: tenantId,
        financial_entry_id: null,
        project_id: resolvedProjectId,
        task_id: resolvedTaskId,
        file_id: uploadResult.file.file_id,
        file_url: uploadResult.file.url,
        file_name: file.originalname,
        file_type: fileType,
        file_size_bytes: uploadResult.file.size_bytes ?? null,
        vendor_name: dto.vendor_name ?? null,
        amount: dto.amount != null ? dto.amount : null,
        receipt_date: dto.receipt_date ? new Date(dto.receipt_date) : null,
        ocr_raw: null,
        ocr_status: 'processing',
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

    // Enqueue OCR job (non-blocking — receipt is returned immediately)
    this.enqueueOcrJob(receipt.id, tenantId, receipt.file_id).catch((err) => {
      this.logger.error(`Failed to enqueue OCR for receipt ${receipt.id}: ${err.message}`);
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
    userId: string,
    dto: LinkReceiptDto,
  ) {
    const { financial_entry_id } = dto;

    this.logger.log(
      `Linking receipt ${receiptId} to entry ${financial_entry_id} (tenant: ${tenantId})`,
    );

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
      actorUserId: userId,
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
    this.logger.log(
      `Updating receipt ${receiptId} metadata (tenant: ${tenantId}, user: ${userId})`,
    );

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
  // 7. getOcrStatus
  // ---------------------------------------------------------------------------

  /**
   * Get OCR processing status for a receipt.
   * Used by the frontend to poll for OCR completion.
   *
   * Roles: All roles can access. Employee can only access their own receipts.
   */
  async getOcrStatus(
    tenantId: string,
    receiptId: string,
    userId: string,
    userRoles: string[],
  ) {
    // Build where clause — Employee can only see their own receipts
    const where: Record<string, unknown> = {
      id: receiptId,
      tenant_id: tenantId,
    };

    const isEmployee = userRoles.length === 1 && userRoles[0] === 'Field';
    if (isEmployee) {
      where.uploaded_by_user_id = userId;
    }

    const receipt = await this.prisma.receipt.findFirst({
      where,
      select: {
        id: true,
        ocr_status: true,
        ocr_vendor: true,
        ocr_amount: true,
        ocr_date: true,
      },
    });

    if (!receipt) {
      throw new NotFoundException('Receipt not found');
    }

    const hasSuggestions =
      receipt.ocr_vendor != null ||
      receipt.ocr_amount != null ||
      receipt.ocr_date != null;

    return {
      receipt_id: receipt.id,
      ocr_status: receipt.ocr_status,
      ocr_vendor: receipt.ocr_vendor ?? null,
      ocr_amount: receipt.ocr_amount != null ? Number(receipt.ocr_amount) : null,
      ocr_date: receipt.ocr_date ?? null,
      has_suggestions: hasSuggestions,
    };
  }

  // ---------------------------------------------------------------------------
  // 8. createEntryFromReceipt
  // ---------------------------------------------------------------------------

  /**
   * Create a financial entry from OCR-parsed receipt data.
   * OCR fields are used as fallback when request body fields are not provided.
   * Links the receipt to the newly created entry.
   *
   * Uses a Prisma interactive transaction to ensure atomicity:
   * entry creation + receipt link must both succeed or neither persists.
   */
  async createEntryFromReceipt(
    tenantId: string,
    receiptId: string,
    userId: string,
    userRoles: string[],
    dto: CreateEntryFromReceiptDto,
  ) {
    this.logger.log(
      `Creating entry from receipt ${receiptId} (tenant: ${tenantId}, user: ${userId})`,
    );

    // 1. Fetch receipt
    const receipt = await this.findReceiptOrThrow(tenantId, receiptId);

    // 2. Guard: receipt already linked to an entry
    // Check financial_entry_id alone (authoritative FK) — matches existing linkReceiptToEntry pattern.
    // Do NOT use `is_categorized &&` — if state is inconsistent, the FK is the source of truth.
    if (receipt.financial_entry_id) {
      throw new BadRequestException(
        'This receipt is already linked to a financial entry. Cannot create another entry from it.',
      );
    }

    // 3. Resolve fields with OCR fallbacks
    const resolvedAmount = dto.amount ?? (receipt.ocr_amount != null ? Number(receipt.ocr_amount) : null);
    const resolvedVendor = dto.vendor_name ?? receipt.ocr_vendor ?? null;
    const resolvedDate = dto.entry_date ?? (receipt.ocr_date ? receipt.ocr_date.toISOString().split('T')[0] : null);

    // 4. Validate required fields (after OCR fallback resolution)
    if (resolvedAmount == null || resolvedAmount <= 0) {
      throw new BadRequestException(
        'Amount is required. Provide it in the request body or ensure OCR detected an amount.',
      );
    }
    if (!resolvedDate) {
      throw new BadRequestException(
        'Entry date is required. Provide it in the request body or ensure OCR detected a date.',
      );
    }

    // 5. Validate category belongs to tenant
    const category = await this.prisma.financial_category.findFirst({
      where: { id: dto.category_id, tenant_id: tenantId },
      select: { id: true, name: true, type: true },
    });
    if (!category) {
      throw new NotFoundException('Financial category not found or does not belong to this tenant');
    }

    // 5b. Validate project belongs to tenant
    const project = await this.prisma.project.findFirst({
      where: { id: dto.project_id, tenant_id: tenantId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // 5c. Validate task belongs to tenant (if provided in DTO)
    if (dto.task_id) {
      const task = await this.prisma.project_task.findFirst({
        where: { id: dto.task_id, tenant_id: tenantId },
      });
      if (!task) {
        throw new NotFoundException('Task not found');
      }
    }

    // 6. Validate entry_date is not in the future
    const entryDate = new Date(resolvedDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (entryDate > today) {
      throw new BadRequestException('Entry date cannot be in the future');
    }

    // 7. Validate supplier belongs to tenant and is active (if provided)
    if (dto.supplier_id) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplier_id, tenant_id: tenantId, is_active: true },
      });
      if (!supplier) {
        throw new NotFoundException('Supplier not found or inactive');
      }
    }

    // 8. Resolve payment_method from registry (if provided)
    let resolvedPaymentMethod: string | null = dto.payment_method ?? null;
    if (dto.payment_method_registry_id) {
      const registry = await this.prisma.payment_method_registry.findFirst({
        where: { id: dto.payment_method_registry_id, tenant_id: tenantId, is_active: true },
      });
      if (!registry) {
        throw new NotFoundException('Payment method not found or inactive');
      }
      resolvedPaymentMethod = registry.type;
    }

    // 9. Validate purchased_by mutual exclusion
    if (dto.purchased_by_user_id && dto.purchased_by_crew_member_id) {
      throw new BadRequestException(
        'Cannot assign purchase to both a user and a crew member. Provide only one.',
      );
    }

    // 10. Validate purchased_by_user_id belongs to tenant
    if (dto.purchased_by_user_id) {
      const membership = await this.prisma.user_tenant_membership.findFirst({
        where: { user_id: dto.purchased_by_user_id, tenant_id: tenantId, status: 'ACTIVE' },
      });
      if (!membership) {
        throw new NotFoundException('User not found in this tenant');
      }
    }

    // 11. Validate purchased_by_crew_member_id belongs to tenant
    if (dto.purchased_by_crew_member_id) {
      const member = await this.prisma.crew_member.findFirst({
        where: { id: dto.purchased_by_crew_member_id, tenant_id: tenantId, is_active: true },
      });
      if (!member) {
        throw new NotFoundException('Crew member not found or inactive');
      }
    }

    // 12. Validate tax_amount < resolvedAmount (if both provided)
    if (dto.tax_amount !== undefined && dto.tax_amount !== null) {
      if (dto.tax_amount >= resolvedAmount) {
        throw new BadRequestException('Tax amount must be less than the entry amount');
      }
    }

    // 13. Determine submission_status based on role (BR-06 / BR-07)
    const privilegedRoles = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];
    const isPrivileged = userRoles.some((r) => privilegedRoles.includes(r));
    let resolvedSubmissionStatus: string;
    if (!isPrivileged) {
      // BR-06: Employee creates always get pending_review — forced, non-negotiable
      resolvedSubmissionStatus = 'pending_review';
    } else {
      // BR-07: Owner/Admin/Manager/Bookkeeper default to confirmed, can opt for pending_review
      resolvedSubmissionStatus = dto.submission_status || 'confirmed';
    }

    // 14. Execute in transaction: create entry + link receipt
    const result = await this.prisma.$transaction(async (tx) => {
      // Create the financial entry
      const entry = await tx.financial_entry.create({
        data: {
          tenant_id: tenantId,
          project_id: dto.project_id,
          task_id: dto.task_id ?? receipt.task_id ?? null,
          category_id: dto.category_id,
          entry_type: 'expense',
          amount: resolvedAmount,
          tax_amount: dto.tax_amount ?? null,
          entry_date: entryDate,
          entry_time: dto.entry_time ? new Date(`1970-01-01T${dto.entry_time}`) : null,
          vendor_name: resolvedVendor,
          supplier_id: dto.supplier_id ?? null,
          payment_method: resolvedPaymentMethod as any,
          payment_method_registry_id: dto.payment_method_registry_id ?? null,
          purchased_by_user_id: dto.purchased_by_user_id ?? null,
          purchased_by_crew_member_id: dto.purchased_by_crew_member_id ?? null,
          crew_member_id: dto.crew_member_id ?? null,
          subcontractor_id: dto.subcontractor_id ?? null,
          submission_status: resolvedSubmissionStatus as any,
          notes: dto.notes ?? null,
          has_receipt: true,
          created_by_user_id: userId,
        },
        include: {
          category: {
            select: { id: true, name: true, type: true },
          },
        },
      });

      // Link receipt to entry
      const updatedReceipt = await tx.receipt.update({
        where: { id: receiptId },
        data: {
          financial_entry_id: entry.id,
          is_categorized: true,
        },
      });

      return { entry, receipt: updatedReceipt };
    });

    // 15. Update supplier spend totals (outside transaction — non-critical)
    if (dto.supplier_id) {
      await this.supplierService.updateSpendTotals(tenantId, dto.supplier_id);
    }

    // 16. Audit log (outside transaction — audit log failure should not roll back the entry)
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'financial_entry',
      entityId: result.entry.id,
      tenantId,
      actorUserId: userId,
      after: result.entry,
      metadata: { created_from_receipt: receiptId, ocr_used: true },
      description: `Financial entry created from receipt OCR: $${resolvedAmount} at ${resolvedVendor || 'unknown vendor'}`,
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'receipt',
      entityId: receiptId,
      tenantId,
      actorUserId: userId,
      before: { financial_entry_id: null, is_categorized: false },
      after: { financial_entry_id: result.entry.id, is_categorized: true },
      description: `Receipt ${receiptId} linked to entry ${result.entry.id} via OCR create-entry`,
    });

    return {
      entry: result.entry,
      receipt: this.formatReceiptResponse(result.receipt),
    };
  }

  // ---------------------------------------------------------------------------
  // 9. retryOcr
  // ---------------------------------------------------------------------------

  /**
   * Retry OCR processing for a failed or not-processed receipt.
   * Resets OCR fields and enqueues a new processing job.
   *
   * Roles: Owner, Admin, Manager, Bookkeeper only (no Employee/Field).
   */
  async retryOcr(
    tenantId: string,
    receiptId: string,
    userId: string,
  ) {
    this.logger.log(
      `Retrying OCR for receipt ${receiptId} (tenant: ${tenantId}, user: ${userId})`,
    );

    const receipt = await this.findReceiptOrThrow(tenantId, receiptId);

    // Guard: can only retry if status is 'failed' or 'not_processed'
    if (receipt.ocr_status === 'processing') {
      throw new BadRequestException(
        'This receipt is currently being processed. Wait for processing to complete before retrying.',
      );
    }
    if (receipt.ocr_status === 'complete') {
      throw new BadRequestException(
        'OCR processing is already complete for this receipt. No retry needed.',
      );
    }

    // Reset OCR fields and set status to processing
    const updated = await this.prisma.receipt.update({
      where: { id: receiptId },
      data: {
        ocr_status: 'processing',
        ocr_vendor: null,
        ocr_amount: null,
        ocr_date: null,
        ocr_raw: null,
      },
    });

    // Enqueue new OCR job
    await this.enqueueOcrJob(receiptId, tenantId, receipt.file_id);

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'receipt',
      entityId: receiptId,
      tenantId,
      actorUserId: userId,
      before: { ocr_status: receipt.ocr_status },
      after: { ocr_status: 'processing' },
      description: `OCR retry triggered for receipt ${receiptId}`,
    });

    return this.formatReceiptResponse(updated);
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

  // ---------------------------------------------------------------------------
  // Private: enqueueOcrJob
  // ---------------------------------------------------------------------------

  /**
   * Enqueue an OCR processing job for a receipt.
   * Called after receipt upload and on retry.
   */
  private async enqueueOcrJob(
    receiptId: string,
    tenantId: string,
    fileId: string,
  ): Promise<void> {
    try {
      await this.ocrQueue.add(
        'process-receipt',
        { receiptId, tenantId, fileId },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
      this.logger.log(
        `OCR job enqueued for receipt ${receiptId} (tenant: ${tenantId}, fileId: ${fileId})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue OCR job for receipt ${receiptId}: ${error.message}`,
      );
      // Don't throw — receipt is still created, just won't get OCR
      // Update status to indicate the enqueue failed
      await this.prisma.receipt.update({
        where: { id: receiptId },
        data: { ocr_status: 'failed' },
      });
    }
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
      ocr_vendor: receipt.ocr_vendor ?? null,
      ocr_amount: receipt.ocr_amount != null ? Number(receipt.ocr_amount) : null,
      ocr_date: receipt.ocr_date ?? null,
      is_categorized: receipt.is_categorized,
      uploaded_by_user_id: receipt.uploaded_by_user_id,
      created_at: receipt.created_at,
      updated_at: receipt.updated_at,
    };
  }
}
