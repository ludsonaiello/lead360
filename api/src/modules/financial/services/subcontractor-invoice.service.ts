import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { FilesService } from '../../files/files.service';
import { FileCategory } from '../../files/dto/upload-file.dto';
import { CreateSubcontractorInvoiceDto } from '../dto/create-subcontractor-invoice.dto';
import { UpdateSubcontractorInvoiceDto } from '../dto/update-subcontractor-invoice.dto';
import { ListSubcontractorInvoicesDto } from '../dto/list-subcontractor-invoices.dto';

@Injectable()
export class SubcontractorInvoiceService {
  private readonly logger = new Logger(SubcontractorInvoiceService.name);

  // Forward-only status transitions
  private static readonly STATUS_ORDER = ['pending', 'approved', 'paid'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly filesService: FilesService,
  ) {}

  /**
   * Create a subcontractor task invoice.
   * If file is provided, upload via FilesService with category 'invoice'.
   * Status starts as 'pending'.
   */
  async createInvoice(
    tenantId: string,
    userId: string,
    dto: CreateSubcontractorInvoiceDto,
    file?: Express.Multer.File,
  ) {
    // Validate subcontractor belongs to tenant
    await this.validateSubcontractorBelongsToTenant(tenantId, dto.subcontractor_id);

    // Validate project belongs to tenant
    await this.validateProjectBelongsToTenant(tenantId, dto.project_id);

    // Validate task belongs to project
    await this.validateTaskBelongsToProject(tenantId, dto.task_id, dto.project_id);

    // Check invoice_number uniqueness per tenant (if provided)
    if (dto.invoice_number) {
      const existing = await this.prisma.subcontractor_task_invoice.findFirst({
        where: {
          tenant_id: tenantId,
          invoice_number: dto.invoice_number,
        },
      });
      if (existing) {
        throw new ConflictException(
          `Invoice number '${dto.invoice_number}' already exists for this tenant`,
        );
      }
    }

    // Handle file upload if provided
    let fileData: { file_id: string; file_url: string; file_name: string } | null = null;
    if (file) {
      const uploadResult = await this.filesService.uploadFile(
        tenantId,
        userId,
        file,
        {
          category: FileCategory.INVOICE,
          entity_type: 'subcontractor_task_invoice',
        },
      );
      fileData = {
        file_id: uploadResult.file.file_id,
        file_url: uploadResult.url,
        file_name: uploadResult.file.original_filename,
      };
    }

    const invoice = await this.prisma.subcontractor_task_invoice.create({
      data: {
        tenant_id: tenantId,
        subcontractor_id: dto.subcontractor_id,
        task_id: dto.task_id,
        project_id: dto.project_id,
        invoice_number: dto.invoice_number ?? null,
        invoice_date: dto.invoice_date ? new Date(dto.invoice_date) : null,
        amount: dto.amount,
        status: 'pending',
        notes: dto.notes ?? null,
        file_id: fileData?.file_id ?? null,
        file_url: fileData?.file_url ?? null,
        file_name: fileData?.file_name ?? null,
        created_by_user_id: userId,
      },
      include: {
        subcontractor: {
          select: { id: true, business_name: true, trade_specialty: true },
        },
        task: {
          select: { id: true, title: true },
        },
        project: {
          select: { id: true, name: true, project_number: true },
        },
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'subcontractor_task_invoice',
      entityId: invoice.id,
      tenantId,
      actorUserId: userId,
      after: invoice,
      description: `Created subcontractor invoice of $${dto.amount} for task ${dto.task_id}`,
    });

    return invoice;
  }

  /**
   * Update invoice status (forward-only: pending→approved→paid).
   * Amount is updatable only before 'approved' status.
   */
  async updateInvoice(
    tenantId: string,
    invoiceId: string,
    userId: string,
    dto: UpdateSubcontractorInvoiceDto,
  ) {
    const existing = await this.getInvoiceById(tenantId, invoiceId);

    // Validate status transition (forward-only)
    if (dto.status) {
      const currentIdx = SubcontractorInvoiceService.STATUS_ORDER.indexOf(existing.status);
      const newIdx = SubcontractorInvoiceService.STATUS_ORDER.indexOf(dto.status);

      if (newIdx <= currentIdx) {
        throw new BadRequestException(
          `Cannot transition from '${existing.status}' to '${dto.status}'. Status can only move forward: pending → approved → paid`,
        );
      }

      // Skip statuses are not allowed (must go pending→approved→paid, not pending→paid)
      if (newIdx - currentIdx > 1) {
        throw new BadRequestException(
          `Cannot skip status. Must transition from '${existing.status}' to '${SubcontractorInvoiceService.STATUS_ORDER[currentIdx + 1]}' first`,
        );
      }
    }

    // Amount can only be updated before 'approved'
    if (dto.amount !== undefined && existing.status !== 'pending') {
      throw new BadRequestException(
        'Amount can only be updated while invoice is in pending status',
      );
    }

    const data: any = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.notes !== undefined) data.notes = dto.notes ?? null;

    const updated = await this.prisma.subcontractor_task_invoice.update({
      where: { id: invoiceId },
      data,
      include: {
        subcontractor: {
          select: { id: true, business_name: true, trade_specialty: true },
        },
        task: {
          select: { id: true, title: true },
        },
        project: {
          select: { id: true, name: true, project_number: true },
        },
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'subcontractor_task_invoice',
      entityId: invoiceId,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: dto.status
        ? `Updated invoice ${invoiceId} status to '${dto.status}'`
        : `Updated invoice ${invoiceId}`,
    });

    return updated;
  }

  /**
   * Get invoices for a specific task.
   */
  async getTaskInvoices(tenantId: string, taskId: string) {
    return this.prisma.subcontractor_task_invoice.findMany({
      where: {
        tenant_id: tenantId,
        task_id: taskId,
      },
      include: {
        subcontractor: {
          select: { id: true, business_name: true, trade_specialty: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Get invoices for a specific subcontractor.
   */
  async getSubcontractorInvoices(tenantId: string, subcontractorId: string) {
    return this.prisma.subcontractor_task_invoice.findMany({
      where: {
        tenant_id: tenantId,
        subcontractor_id: subcontractorId,
      },
      include: {
        task: {
          select: { id: true, title: true },
        },
        project: {
          select: { id: true, name: true, project_number: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * List invoices (paginated) with optional filters.
   */
  async listInvoices(tenantId: string, query: ListSubcontractorInvoicesDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = { tenant_id: tenantId };

    if (query.subcontractor_id) where.subcontractor_id = query.subcontractor_id;
    if (query.task_id) where.task_id = query.task_id;
    if (query.project_id) where.project_id = query.project_id;
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.subcontractor_task_invoice.findMany({
        where,
        include: {
          subcontractor: {
            select: { id: true, business_name: true, trade_specialty: true },
          },
          task: {
            select: { id: true, title: true },
          },
          project: {
            select: { id: true, name: true, project_number: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.subcontractor_task_invoice.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Aggregate invoice totals by status for a subcontractor.
   * Returns total_invoiced, total_pending, total_approved, total_paid, invoices_count.
   */
  async getInvoiceAggregation(tenantId: string, subcontractorId: string) {
    await this.validateSubcontractorBelongsToTenant(tenantId, subcontractorId);

    const baseWhere = {
      tenant_id: tenantId,
      subcontractor_id: subcontractorId,
    };

    const [totalAgg, pendingAgg, approvedAgg, paidAgg] = await Promise.all([
      this.prisma.subcontractor_task_invoice.aggregate({
        where: baseWhere,
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.subcontractor_task_invoice.aggregate({
        where: { ...baseWhere, status: 'pending' },
        _sum: { amount: true },
      }),
      this.prisma.subcontractor_task_invoice.aggregate({
        where: { ...baseWhere, status: 'approved' },
        _sum: { amount: true },
      }),
      this.prisma.subcontractor_task_invoice.aggregate({
        where: { ...baseWhere, status: 'paid' },
        _sum: { amount: true },
      }),
    ]);

    return {
      subcontractor_id: subcontractorId,
      total_invoiced: totalAgg._sum.amount ? Number(totalAgg._sum.amount) : 0,
      total_pending: pendingAgg._sum.amount ? Number(pendingAgg._sum.amount) : 0,
      total_approved: approvedAgg._sum.amount ? Number(approvedAgg._sum.amount) : 0,
      total_paid_invoices: paidAgg._sum.amount ? Number(paidAgg._sum.amount) : 0,
      invoices_count: totalAgg._count,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async getInvoiceById(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.subcontractor_task_invoice.findFirst({
      where: {
        id: invoiceId,
        tenant_id: tenantId,
      },
      include: {
        subcontractor: {
          select: { id: true, business_name: true, trade_specialty: true },
        },
        task: {
          select: { id: true, title: true },
        },
        project: {
          select: { id: true, name: true, project_number: true },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Subcontractor invoice not found');
    }

    return invoice;
  }

  private async validateSubcontractorBelongsToTenant(
    tenantId: string,
    subcontractorId: string,
  ) {
    const sub = await this.prisma.subcontractor.findFirst({
      where: { id: subcontractorId, tenant_id: tenantId },
    });

    if (!sub) {
      throw new NotFoundException(
        'Subcontractor not found or does not belong to this tenant',
      );
    }
  }

  private async validateProjectBelongsToTenant(
    tenantId: string,
    projectId: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
    });

    if (!project) {
      throw new NotFoundException(
        'Project not found or does not belong to this tenant',
      );
    }
  }

  private async validateTaskBelongsToProject(
    tenantId: string,
    taskId: string,
    projectId: string,
  ) {
    const task = await this.prisma.project_task.findFirst({
      where: {
        id: taskId,
        tenant_id: tenantId,
        project_id: projectId,
      },
    });

    if (!task) {
      throw new NotFoundException(
        'Task not found or does not belong to this project',
      );
    }
  }
}
