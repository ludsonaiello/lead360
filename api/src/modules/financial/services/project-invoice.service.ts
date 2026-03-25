import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { InvoiceNumberGeneratorService } from './invoice-number-generator.service';
import { CreateProjectInvoiceDto } from '../dto/create-project-invoice.dto';
import { UpdateProjectInvoiceDto } from '../dto/update-project-invoice.dto';
import { RecordInvoicePaymentDto } from '../dto/record-invoice-payment.dto';
import { VoidInvoiceDto } from '../dto/void-invoice.dto';
import { ListProjectInvoicesDto } from '../dto/list-project-invoices.dto';

@Injectable()
export class ProjectInvoiceService {
  private readonly logger = new Logger(ProjectInvoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly invoiceNumberGenerator: InvoiceNumberGeneratorService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // create() — Manual invoice creation (not from a milestone)
  // ──────────────────────────────────────────────────────────────────────────
  async create(
    tenantId: string,
    projectId: string,
    userId: string,
    dto: CreateProjectInvoiceDto,
  ) {
    // 1. Verify project exists and belongs to tenant
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    // 2. Generate invoice number and create invoice in a transaction
    const invoice = await this.prisma.$transaction(async (tx) => {
      const invoiceNumber = await this.invoiceNumberGenerator.generate(
        tenantId,
        tx,
      );

      const taxAmount = dto.tax_amount ?? null;
      const amountDue =
        taxAmount !== null
          ? Math.round((dto.amount + taxAmount) * 100) / 100
          : dto.amount;

      return tx.project_invoice.create({
        data: {
          tenant_id: tenantId,
          project_id: projectId,
          invoice_number: invoiceNumber,
          description: dto.description,
          amount: dto.amount,
          tax_amount: taxAmount,
          amount_paid: 0,
          amount_due: amountDue,
          status: 'draft',
          due_date: dto.due_date ? new Date(dto.due_date) : null,
          notes: dto.notes ?? null,
          created_by_user_id: userId,
        },
      });
    });

    // 3. Audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'project_invoice',
      entityId: invoice.id,
      tenantId,
      actorUserId: userId,
      after: invoice,
      description: `Created draft invoice ${invoice.invoice_number} for $${dto.amount.toFixed(2)}`,
    });

    this.logger.log(
      `Created invoice ${invoice.invoice_number} for project ${projectId} (tenant: ${tenantId})`,
    );

    // 4. Return with Decimal conversions
    return {
      ...invoice,
      amount: Number(invoice.amount),
      tax_amount: invoice.tax_amount != null ? Number(invoice.tax_amount) : null,
      amount_paid: Number(invoice.amount_paid),
      amount_due: Number(invoice.amount_due),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // findByProject() — Paginated list with status/date filters
  // ──────────────────────────────────────────────────────────────────────────
  async findByProject(
    tenantId: string,
    projectId: string,
    query: ListProjectInvoicesDto,
  ) {
    // 1. Build where clause
    const where: any = {
      tenant_id: tenantId,
      project_id: projectId,
    };

    if (query.status) where.status = query.status;
    if (query.date_from || query.date_to) {
      where.created_at = {};
      if (query.date_from) where.created_at.gte = new Date(query.date_from);
      if (query.date_to)
        where.created_at.lte = new Date(query.date_to + 'T23:59:59.999Z');
    }

    // 2. Paginate
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    // 3. Query with payment count
    const [invoices, total] = await Promise.all([
      this.prisma.project_invoice.findMany({
        where,
        include: {
          milestone: {
            select: { id: true, description: true, draw_number: true },
          },
          _count: {
            select: { payments: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.project_invoice.count({ where }),
    ]);

    // 4. Map response
    const data = invoices.map((inv) => ({
      id: inv.id,
      invoice_number: inv.invoice_number,
      milestone_id: inv.milestone_id,
      milestone_description: inv.milestone?.description ?? null,
      description: inv.description,
      amount: Number(inv.amount),
      tax_amount: inv.tax_amount != null ? Number(inv.tax_amount) : null,
      amount_paid: Number(inv.amount_paid),
      amount_due: Number(inv.amount_due),
      status: inv.status,
      due_date: inv.due_date,
      sent_at: inv.sent_at,
      paid_at: inv.paid_at,
      voided_at: inv.voided_at,
      payment_count: inv._count.payments,
      created_at: inv.created_at,
    }));

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // findOne() — Single invoice with payments and milestone details
  // ──────────────────────────────────────────────────────────────────────────
  async findOne(tenantId: string, projectId: string, invoiceId: string) {
    const invoice = await this.prisma.project_invoice.findFirst({
      where: { id: invoiceId, project_id: projectId, tenant_id: tenantId },
      include: {
        milestone: {
          select: {
            id: true,
            description: true,
            draw_number: true,
            status: true,
          },
        },
        payments: {
          orderBy: { payment_date: 'asc' },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    // Return with all Decimal fields converted to Number
    return {
      ...invoice,
      amount: Number(invoice.amount),
      tax_amount: invoice.tax_amount != null ? Number(invoice.tax_amount) : null,
      amount_paid: Number(invoice.amount_paid),
      amount_due: Number(invoice.amount_due),
      payments: invoice.payments.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // update() — Only draft invoices are editable
  // ──────────────────────────────────────────────────────────────────────────
  async update(
    tenantId: string,
    projectId: string,
    invoiceId: string,
    userId: string,
    dto: UpdateProjectInvoiceDto,
  ) {
    // 1. Fetch existing invoice
    const existing = await this.prisma.project_invoice.findFirst({
      where: { id: invoiceId, project_id: projectId, tenant_id: tenantId },
    });
    if (!existing) throw new NotFoundException('Invoice not found');

    // 2. Guard: Only draft invoices are editable
    if (existing.status !== 'draft') {
      throw new BadRequestException(
        `Cannot edit invoice in ${existing.status} status — only draft invoices are editable`,
      );
    }

    // 3. Build update data from provided fields
    const data: any = {};
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.tax_amount !== undefined) data.tax_amount = dto.tax_amount;
    if (dto.due_date !== undefined)
      data.due_date = dto.due_date ? new Date(dto.due_date) : null;
    if (dto.notes !== undefined) data.notes = dto.notes;

    // 4. If amount or tax_amount changed, recompute amount_due
    if (dto.amount !== undefined || dto.tax_amount !== undefined) {
      const newAmount = dto.amount ?? Number(existing.amount);
      const newTaxAmount =
        dto.tax_amount !== undefined
          ? dto.tax_amount
          : existing.tax_amount != null
            ? Number(existing.tax_amount)
            : null;
      const currentAmountPaid = Number(existing.amount_paid);
      data.amount_due =
        newTaxAmount !== null
          ? Math.round((newAmount + newTaxAmount - currentAmountPaid) * 100) /
            100
          : Math.round((newAmount - currentAmountPaid) * 100) / 100;
    }

    // 5. Update invoice
    data.updated_by_user_id = userId;

    const updated = await this.prisma.project_invoice.update({
      where: { id: invoiceId },
      data,
    });

    // 6. Audit log with before/after
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'project_invoice',
      entityId: invoiceId,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: `Updated draft invoice ${existing.invoice_number}`,
    });

    this.logger.log(
      `Updated invoice ${existing.invoice_number} (tenant: ${tenantId})`,
    );

    // 7. Return with Decimal conversions
    return {
      ...updated,
      amount: Number(updated.amount),
      tax_amount:
        updated.tax_amount != null ? Number(updated.tax_amount) : null,
      amount_paid: Number(updated.amount_paid),
      amount_due: Number(updated.amount_due),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // markSent() — draft → sent transition
  // ──────────────────────────────────────────────────────────────────────────
  async markSent(
    tenantId: string,
    projectId: string,
    invoiceId: string,
    userId: string,
  ) {
    // 1. Fetch existing invoice
    const existing = await this.prisma.project_invoice.findFirst({
      where: { id: invoiceId, project_id: projectId, tenant_id: tenantId },
    });
    if (!existing) throw new NotFoundException('Invoice not found');

    // 2. Guard: Must be draft
    if (existing.status !== 'draft') {
      throw new BadRequestException(
        `Cannot mark invoice as sent — current status is ${existing.status}. Only draft invoices can be sent.`,
      );
    }

    // 3. Update
    const updated = await this.prisma.project_invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'sent',
        sent_at: new Date(),
        updated_by_user_id: userId,
      },
    });

    // 4. Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'project_invoice',
      entityId: invoiceId,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: `Marked invoice ${existing.invoice_number} as sent`,
    });

    this.logger.log(
      `Marked invoice ${existing.invoice_number} as sent (tenant: ${tenantId})`,
    );

    // 5. Return with Decimal conversions
    return {
      ...updated,
      amount: Number(updated.amount),
      tax_amount:
        updated.tax_amount != null ? Number(updated.tax_amount) : null,
      amount_paid: Number(updated.amount_paid),
      amount_due: Number(updated.amount_due),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // voidInvoice() — Void with milestone reset
  // ──────────────────────────────────────────────────────────────────────────
  async voidInvoice(
    tenantId: string,
    projectId: string,
    invoiceId: string,
    userId: string,
    dto: VoidInvoiceDto,
  ) {
    // 1. Fetch existing invoice
    const existing = await this.prisma.project_invoice.findFirst({
      where: { id: invoiceId, project_id: projectId, tenant_id: tenantId },
    });
    if (!existing) throw new NotFoundException('Invoice not found');

    // 2. Guard: Cannot void an already voided invoice
    if (existing.status === 'voided') {
      throw new BadRequestException('Invoice is already voided');
    }

    // 3. Execute in a single Prisma transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // a. Void the invoice
      const voidedInvoice = await tx.project_invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'voided',
          voided_at: new Date(),
          voided_reason: dto.voided_reason,
          updated_by_user_id: userId,
        },
      });

      // b. If linked to a milestone, reset milestone to pending
      if (existing.milestone_id) {
        await tx.project_draw_milestone.update({
          where: { id: existing.milestone_id },
          data: {
            status: 'pending',
            invoice_id: null,
            invoiced_at: null,
          },
        });
      }

      return voidedInvoice;
    });

    // 4. Audit log with metadata including milestone_reset
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'project_invoice',
      entityId: invoiceId,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: result,
      metadata: {
        milestone_reset: !!existing.milestone_id,
        voided_reason: dto.voided_reason,
      },
      description: `Voided invoice ${existing.invoice_number}${existing.milestone_id ? ' (milestone reset to pending)' : ''}`,
    });

    this.logger.log(
      `Voided invoice ${existing.invoice_number}${existing.milestone_id ? ' — milestone reset to pending' : ''} (tenant: ${tenantId})`,
    );

    // 5. Return with Decimal conversions
    return {
      ...result,
      amount: Number(result.amount),
      tax_amount: result.tax_amount != null ? Number(result.tax_amount) : null,
      amount_paid: Number(result.amount_paid),
      amount_due: Number(result.amount_due),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // recordPayment() — ATOMIC: payment + invoice update + milestone update
  // ──────────────────────────────────────────────────────────────────────────
  async recordPayment(
    tenantId: string,
    projectId: string,
    invoiceId: string,
    userId: string,
    dto: RecordInvoicePaymentDto,
  ) {
    // 1. Fetch existing invoice (outside transaction for initial validation)
    const invoice = await this.prisma.project_invoice.findFirst({
      where: { id: invoiceId, project_id: projectId, tenant_id: tenantId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    // 2. Guard: Cannot pay a voided invoice
    if (invoice.status === 'voided') {
      throw new BadRequestException(
        'Cannot record payment on a voided invoice',
      );
    }

    // 3. Guard: Payment amount cannot exceed amount_due
    const currentAmountDue = Number(invoice.amount_due);
    if (dto.amount > currentAmountDue) {
      throw new BadRequestException(
        `Payment amount ($${dto.amount}) exceeds amount due ($${currentAmountDue.toFixed(2)})`,
      );
    }

    // 4. Execute in a single Prisma transaction
    const payment = await this.prisma.$transaction(async (tx) => {
      // a. Create payment record
      const newPayment = await tx.project_invoice_payment.create({
        data: {
          tenant_id: tenantId,
          invoice_id: invoiceId,
          project_id: projectId,
          amount: dto.amount,
          payment_date: new Date(dto.payment_date),
          payment_method: dto.payment_method,
          payment_method_registry_id: dto.payment_method_registry_id ?? null,
          reference_number: dto.reference_number ?? null,
          notes: dto.notes ?? null,
          created_by_user_id: userId,
        },
      });

      // b. Recompute invoice amounts
      const newAmountPaid =
        Math.round((Number(invoice.amount_paid) + dto.amount) * 100) / 100;
      const invoiceAmount = Number(invoice.amount);
      const taxAmount =
        invoice.tax_amount != null ? Number(invoice.tax_amount) : 0;
      const newAmountDue =
        Math.round((invoiceAmount + taxAmount - newAmountPaid) * 100) / 100;

      // c. Determine new status
      let newStatus = invoice.status;
      let paidAt = invoice.paid_at;

      if (newAmountDue <= 0) {
        newStatus = 'paid';
        paidAt = new Date();
      } else if (newAmountPaid > 0) {
        newStatus = 'partial';
      }

      // d. Update invoice
      await tx.project_invoice.update({
        where: { id: invoiceId },
        data: {
          amount_paid: newAmountPaid,
          amount_due: newAmountDue,
          status: newStatus,
          paid_at: paidAt,
          updated_by_user_id: userId,
        },
      });

      // e. If invoice is now fully paid AND linked to a milestone, update milestone
      if (newStatus === 'paid' && invoice.milestone_id) {
        await tx.project_draw_milestone.update({
          where: { id: invoice.milestone_id },
          data: {
            status: 'paid',
            paid_at: new Date(),
          },
        });
      }

      return newPayment;
    });

    // 5. Audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'project_invoice_payment',
      entityId: payment.id,
      tenantId,
      actorUserId: userId,
      after: payment,
      metadata: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
      },
      description: `Recorded $${dto.amount.toFixed(2)} payment (${dto.payment_method}) on invoice ${invoice.invoice_number}`,
    });

    this.logger.log(
      `Recorded $${dto.amount.toFixed(2)} payment on invoice ${invoice.invoice_number} (tenant: ${tenantId})`,
    );

    // 6. Return payment with Decimal conversions
    return {
      ...payment,
      amount: Number(payment.amount),
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // getPayments() — List payments for an invoice
  // ──────────────────────────────────────────────────────────────────────────
  async getPayments(
    tenantId: string,
    projectId: string,
    invoiceId: string,
  ) {
    // 1. Verify invoice exists
    const invoice = await this.prisma.project_invoice.findFirst({
      where: { id: invoiceId, project_id: projectId, tenant_id: tenantId },
      select: { id: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    // 2. Fetch payments ordered by payment_date ASC
    const payments = await this.prisma.project_invoice_payment.findMany({
      where: { invoice_id: invoiceId, tenant_id: tenantId },
      orderBy: { payment_date: 'asc' },
    });

    // 3. Return with Decimal conversions
    return payments.map((p) => ({
      ...p,
      amount: Number(p.amount),
    }));
  }
}
