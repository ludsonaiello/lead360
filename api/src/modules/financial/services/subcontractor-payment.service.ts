import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateSubcontractorPaymentDto } from '../dto/create-subcontractor-payment.dto';
import { ListSubcontractorPaymentsDto } from '../dto/list-subcontractor-payments.dto';

@Injectable()
export class SubcontractorPaymentService {
  private readonly logger = new Logger(SubcontractorPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Create a subcontractor payment record.
   * Validates: subcontractor belongs to tenant, amount > 0, payment_date not future.
   */
  async createPayment(
    tenantId: string,
    userId: string,
    subcontractorId: string,
    dto: CreateSubcontractorPaymentDto,
  ) {
    // Validate subcontractor belongs to tenant
    await this.validateSubcontractorBelongsToTenant(tenantId, subcontractorId);

    // Validate payment_date is not in the future
    this.validateDateNotFuture(dto.payment_date, 'Payment date');

    const payment = await this.prisma.subcontractor_payment_record.create({
      data: {
        tenant_id: tenantId,
        subcontractor_id: subcontractorId,
        project_id: dto.project_id ?? null,
        amount: dto.amount,
        payment_date: new Date(dto.payment_date),
        payment_method: dto.payment_method as any,
        reference_number: dto.reference_number ?? null,
        notes: dto.notes ?? null,
        created_by_user_id: userId,
      },
      include: {
        subcontractor: {
          select: { id: true, business_name: true, trade_specialty: true },
        },
        project: {
          select: { id: true, name: true, project_number: true },
        },
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'subcontractor_payment_record',
      entityId: payment.id,
      tenantId,
      actorUserId: userId,
      after: payment,
      description: `Created subcontractor payment of $${dto.amount} for subcontractor ${subcontractorId}`,
    });

    return payment;
  }

  /**
   * Get paginated payment history for a subcontractor.
   */
  async getPaymentHistory(
    tenantId: string,
    subcontractorId: string,
    query: ListSubcontractorPaymentsDto,
  ) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      tenant_id: tenantId,
      subcontractor_id: subcontractorId,
    };

    if (query.project_id) {
      where.project_id = query.project_id;
    }

    const [data, total] = await Promise.all([
      this.prisma.subcontractor_payment_record.findMany({
        where,
        include: {
          subcontractor: {
            select: { id: true, business_name: true, trade_specialty: true },
          },
          project: {
            select: { id: true, name: true, project_number: true },
          },
        },
        orderBy: { payment_date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.subcontractor_payment_record.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * List all subcontractor payments (paginated, with optional filters).
   */
  async listPayments(tenantId: string, query: ListSubcontractorPaymentsDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = { tenant_id: tenantId };

    if (query.subcontractor_id) {
      where.subcontractor_id = query.subcontractor_id;
    }
    if (query.project_id) {
      where.project_id = query.project_id;
    }

    const [data, total] = await Promise.all([
      this.prisma.subcontractor_payment_record.findMany({
        where,
        include: {
          subcontractor: {
            select: { id: true, business_name: true, trade_specialty: true },
          },
          project: {
            select: { id: true, name: true, project_number: true },
          },
        },
        orderBy: { payment_date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.subcontractor_payment_record.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get total paid to a subcontractor.
   */
  async getTotalPaid(tenantId: string, subcontractorId: string) {
    const result = await this.prisma.subcontractor_payment_record.aggregate({
      where: {
        tenant_id: tenantId,
        subcontractor_id: subcontractorId,
      },
      _sum: { amount: true },
      _count: true,
    });

    return {
      subcontractor_id: subcontractorId,
      total_paid: result._sum.amount ? Number(result._sum.amount) : 0,
      payment_count: result._count,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async validateSubcontractorBelongsToTenant(
    tenantId: string,
    subcontractorId: string,
  ) {
    const subcontractor = await this.prisma.subcontractor.findFirst({
      where: {
        id: subcontractorId,
        tenant_id: tenantId,
      },
    });

    if (!subcontractor) {
      throw new NotFoundException(
        'Subcontractor not found or does not belong to this tenant',
      );
    }

    return subcontractor;
  }

  private validateDateNotFuture(dateStr: string, fieldName: string) {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (date > today) {
      throw new BadRequestException(`${fieldName} cannot be in the future`);
    }
  }
}
