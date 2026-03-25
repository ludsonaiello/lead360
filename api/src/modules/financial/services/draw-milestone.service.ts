import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { InvoiceNumberGeneratorService } from './invoice-number-generator.service';
import { CreateDrawMilestoneDto } from '../dto/create-draw-milestone.dto';
import { UpdateDrawMilestoneDto } from '../dto/update-draw-milestone.dto';
import { GenerateMilestoneInvoiceDto } from '../dto/generate-milestone-invoice.dto';

@Injectable()
export class DrawMilestoneService {
  private readonly logger = new Logger(DrawMilestoneService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly invoiceNumberGenerator: InvoiceNumberGeneratorService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. seedFromQuote
  // ---------------------------------------------------------------------------

  /**
   * Seed draw milestones from a quote's draw schedule entries.
   * Called from ProjectService.createFromQuote() — accepts an optional Prisma
   * transaction client so all writes occur inside the same atomic transaction.
   */
  async seedFromQuote(
    tenantId: string,
    projectId: string,
    quoteId: string,
    userId: string,
    transaction?: any,
  ): Promise<void> {
    const db = transaction || this.prisma;

    // Fetch draw schedule entries for this quote
    const entries = await db.draw_schedule_entry.findMany({
      where: { quote_id: quoteId },
      orderBy: { draw_number: 'asc' },
    });

    if (entries.length === 0) {
      this.logger.log(
        `No draw schedule entries for quote ${quoteId} — skipping milestone seeding`,
      );
      return;
    }

    // Fetch project's contract_value for percentage calculations
    const project = await db.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
      select: { contract_value: true },
    });

    // Build milestone data array with calculated amounts
    const milestoneData = entries.map((entry) => {
      const contractValue =
        project?.contract_value != null
          ? Number(project.contract_value)
          : null;
      const entryValue = Number(entry.value);

      let calculatedAmount: number;
      let notes: string | null = null;

      if (entry.calculation_type === 'percentage') {
        if (contractValue !== null) {
          calculatedAmount =
            Math.round((entryValue / 100) * contractValue * 100) / 100;
        } else {
          calculatedAmount = entryValue;
          notes =
            'contract_value was null at seed time — calculated_amount set to raw value';
        }
      } else {
        // fixed_amount
        calculatedAmount = entryValue;
      }

      return {
        tenant_id: tenantId,
        project_id: projectId,
        quote_draw_entry_id: entry.id,
        draw_number: entry.draw_number,
        description: entry.description,
        calculation_type: entry.calculation_type,
        value: entryValue,
        calculated_amount: calculatedAmount,
        status: 'pending' as const,
        notes,
        created_by_user_id: userId,
      };
    });

    await db.project_draw_milestone.createMany({
      data: milestoneData,
    });

    this.logger.log(
      `Seeded ${milestoneData.length} draw milestones for project ${projectId} from quote ${quoteId}`,
    );
  }

  // ---------------------------------------------------------------------------
  // 2. findByProject
  // ---------------------------------------------------------------------------

  async findByProject(tenantId: string, projectId: string) {
    const milestones = await this.prisma.project_draw_milestone.findMany({
      where: {
        tenant_id: tenantId,
        project_id: projectId,
      },
      include: {
        invoice: {
          select: { id: true, invoice_number: true, status: true },
        },
      },
      orderBy: { draw_number: 'asc' },
    });

    return milestones.map((m) => ({
      id: m.id,
      draw_number: m.draw_number,
      description: m.description,
      calculation_type: m.calculation_type,
      value: Number(m.value),
      calculated_amount: Number(m.calculated_amount),
      status: m.status,
      invoice_id: m.invoice_id,
      invoice_number: m.invoice?.invoice_number ?? null,
      invoiced_at: m.invoiced_at,
      paid_at: m.paid_at,
      notes: m.notes,
      created_at: m.created_at,
    }));
  }

  // ---------------------------------------------------------------------------
  // 3. create
  // ---------------------------------------------------------------------------

  async create(
    tenantId: string,
    projectId: string,
    userId: string,
    dto: CreateDrawMilestoneDto,
  ) {
    // Verify project exists and belongs to tenant
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
      select: { id: true, contract_value: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    // Check for duplicate draw_number within this project
    const existing = await this.prisma.project_draw_milestone.findFirst({
      where: { project_id: projectId, draw_number: dto.draw_number },
    });
    if (existing) {
      throw new ConflictException(
        `Draw number ${dto.draw_number} already exists for this project`,
      );
    }

    // Validate percentage value
    if (dto.calculation_type === 'percentage' && dto.value > 100) {
      throw new BadRequestException('Percentage value cannot exceed 100');
    }

    // Compute calculated_amount if not provided
    let calculatedAmount = dto.calculated_amount;
    if (calculatedAmount === undefined || calculatedAmount === null) {
      if (dto.calculation_type === 'percentage') {
        const contractValue =
          project.contract_value != null
            ? Number(project.contract_value)
            : null;
        if (contractValue !== null) {
          calculatedAmount =
            Math.round((dto.value / 100) * contractValue * 100) / 100;
        } else {
          calculatedAmount = dto.value;
        }
      } else {
        calculatedAmount = dto.value;
      }
    }

    const milestone = await this.prisma.project_draw_milestone.create({
      data: {
        tenant_id: tenantId,
        project_id: projectId,
        draw_number: dto.draw_number,
        description: dto.description,
        calculation_type: dto.calculation_type,
        value: dto.value,
        calculated_amount: calculatedAmount,
        status: 'pending',
        notes: dto.notes ?? null,
        created_by_user_id: userId,
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'project_draw_milestone',
      entityId: milestone.id,
      tenantId,
      actorUserId: userId,
      after: milestone,
      description: `Created draw milestone #${dto.draw_number}: "${dto.description}" for project ${projectId}`,
    });

    return {
      ...milestone,
      value: Number(milestone.value),
      calculated_amount: Number(milestone.calculated_amount),
    };
  }

  // ---------------------------------------------------------------------------
  // 4. update
  // ---------------------------------------------------------------------------

  async update(
    tenantId: string,
    projectId: string,
    milestoneId: string,
    userId: string,
    dto: UpdateDrawMilestoneDto,
  ) {
    const existing = await this.prisma.project_draw_milestone.findFirst({
      where: { id: milestoneId, project_id: projectId, tenant_id: tenantId },
    });
    if (!existing) throw new NotFoundException('Milestone not found');

    // Guard: calculated_amount cannot be changed if milestone is invoiced or paid
    if (dto.calculated_amount !== undefined && existing.status !== 'pending') {
      throw new BadRequestException(
        'Cannot modify calculated_amount on an invoiced or paid milestone',
      );
    }

    // Build update data — only provided fields
    const data: any = {};
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.calculated_amount !== undefined)
      data.calculated_amount = dto.calculated_amount;
    if (dto.notes !== undefined) data.notes = dto.notes;

    const updated = await this.prisma.project_draw_milestone.update({
      where: { id: milestoneId },
      data,
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'project_draw_milestone',
      entityId: milestoneId,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: `Updated draw milestone #${existing.draw_number} for project ${projectId}`,
    });

    return {
      ...updated,
      value: Number(updated.value),
      calculated_amount: Number(updated.calculated_amount),
    };
  }

  // ---------------------------------------------------------------------------
  // 5. delete
  // ---------------------------------------------------------------------------

  async delete(
    tenantId: string,
    projectId: string,
    milestoneId: string,
    userId: string,
  ) {
    const existing = await this.prisma.project_draw_milestone.findFirst({
      where: { id: milestoneId, project_id: projectId, tenant_id: tenantId },
    });
    if (!existing) throw new NotFoundException('Milestone not found');

    // Guard: only pending milestones can be deleted
    if (existing.status !== 'pending') {
      throw new BadRequestException(
        `Cannot delete milestone in ${existing.status} status — only pending milestones can be deleted`,
      );
    }

    await this.prisma.project_draw_milestone.delete({
      where: { id: milestoneId },
    });

    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'project_draw_milestone',
      entityId: milestoneId,
      tenantId,
      actorUserId: userId,
      before: existing,
      description: `Deleted draw milestone #${existing.draw_number} for project ${projectId}`,
    });

    return { message: `Milestone #${existing.draw_number} deleted` };
  }

  // ---------------------------------------------------------------------------
  // 6. generateInvoice
  // ---------------------------------------------------------------------------

  async generateInvoice(
    tenantId: string,
    projectId: string,
    milestoneId: string,
    userId: string,
    dto: GenerateMilestoneInvoiceDto,
  ) {
    // Fetch milestone
    const milestone = await this.prisma.project_draw_milestone.findFirst({
      where: { id: milestoneId, project_id: projectId, tenant_id: tenantId },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');

    // Guard: must be pending
    if (milestone.status !== 'pending') {
      throw new BadRequestException(
        `Milestone is already ${milestone.status} — can only generate invoice from pending milestones`,
      );
    }

    // Execute atomically in a single Prisma transaction
    const invoice = await this.prisma.$transaction(async (tx) => {
      // a. Generate invoice number (atomic within same transaction)
      const invoiceNumber = await this.invoiceNumberGenerator.generate(
        tenantId,
        tx,
      );

      // b. Compute amounts
      const amount = Number(milestone.calculated_amount);
      const taxAmount = dto.tax_amount ?? null;
      const amountDue =
        taxAmount !== null
          ? Math.round((amount + taxAmount) * 100) / 100
          : amount;

      // c. Create project_invoice record
      const newInvoice = await tx.project_invoice.create({
        data: {
          tenant_id: tenantId,
          project_id: projectId,
          invoice_number: invoiceNumber,
          milestone_id: milestone.id,
          description: dto.description || milestone.description,
          amount,
          tax_amount: taxAmount,
          amount_paid: 0,
          amount_due: amountDue,
          status: 'draft',
          due_date: dto.due_date ? new Date(dto.due_date) : null,
          notes: dto.notes ?? null,
          created_by_user_id: userId,
        },
      });

      // d. Update milestone status within same transaction
      await tx.project_draw_milestone.update({
        where: { id: milestoneId },
        data: {
          status: 'invoiced',
          invoice_id: newInvoice.id,
          invoiced_at: new Date(),
        },
      });

      return newInvoice;
    });

    // Audit log (outside transaction for non-blocking behavior)
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'project_invoice',
      entityId: invoice.id,
      tenantId,
      actorUserId: userId,
      after: invoice,
      metadata: {
        milestone_id: milestoneId,
        generated_from: 'draw_milestone',
      },
      description: `Generated invoice ${invoice.invoice_number} ($${Number(invoice.amount).toFixed(2)}) from milestone #${milestone.draw_number}: "${milestone.description}"`,
    });

    return {
      ...invoice,
      amount: Number(invoice.amount),
      tax_amount:
        invoice.tax_amount != null ? Number(invoice.tax_amount) : null,
      amount_paid: Number(invoice.amount_paid),
      amount_due: Number(invoice.amount_due),
    };
  }
}
