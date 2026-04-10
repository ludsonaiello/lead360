import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateCrewPaymentDto } from '../dto/create-crew-payment.dto';
import { UpdateCrewPaymentDto } from '../dto/update-crew-payment.dto';
import { ListCrewPaymentsDto } from '../dto/list-crew-payments.dto';

@Injectable()
export class CrewPaymentService {
  private readonly logger = new Logger(CrewPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Create a crew payment record.
   * Validates: crew_member belongs to tenant, amount > 0, payment_date not future.
   */
  async createPayment(
    tenantId: string,
    userId: string,
    crewMemberId: string,
    dto: CreateCrewPaymentDto,
  ) {
    // Validate crew member belongs to tenant
    await this.validateCrewMemberBelongsToTenant(tenantId, crewMemberId);

    // Validate payment_date is not in the future
    this.validateDateNotFuture(dto.payment_date, 'Payment date');

    // Validate period dates if both provided
    if (dto.period_start_date && dto.period_end_date) {
      const start = new Date(dto.period_start_date);
      const end = new Date(dto.period_end_date);
      if (start > end) {
        throw new BadRequestException('Period start date must be before or equal to period end date');
      }
    }

    const payment = await this.prisma.crew_payment_record.create({
      data: {
        tenant_id: tenantId,
        crew_member_id: crewMemberId,
        project_id: dto.project_id ?? null,
        amount: dto.amount,
        payment_date: new Date(dto.payment_date),
        payment_method: dto.payment_method as any,
        reference_number: dto.reference_number ?? null,
        period_start_date: dto.period_start_date ? new Date(dto.period_start_date) : null,
        period_end_date: dto.period_end_date ? new Date(dto.period_end_date) : null,
        hours_paid: dto.hours_paid ?? null,
        notes: dto.notes ?? null,
        created_by_user_id: userId,
      },
      include: {
        crew_member: {
          select: { id: true, first_name: true, last_name: true },
        },
        project: {
          select: { id: true, name: true, project_number: true },
        },
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'crew_payment_record',
      entityId: payment.id,
      tenantId,
      actorUserId: userId,
      after: payment,
      description: `Created crew payment of $${dto.amount} for crew member ${crewMemberId}`,
    });

    return payment;
  }

  /**
   * Get paginated payment history for a crew member or project.
   */
  async getPaymentHistory(
    tenantId: string,
    crewMemberId: string,
    query: ListCrewPaymentsDto,
  ) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      tenant_id: tenantId,
      crew_member_id: crewMemberId,
    };

    if (query.project_id) {
      where.project_id = query.project_id;
    }

    const [data, total] = await Promise.all([
      this.prisma.crew_payment_record.findMany({
        where,
        include: {
          crew_member: {
            select: { id: true, first_name: true, last_name: true },
          },
          project: {
            select: { id: true, name: true, project_number: true },
          },
        },
        orderBy: { payment_date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.crew_payment_record.count({ where }),
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
   * List all crew payments (paginated, with optional filters).
   */
  async listPayments(tenantId: string, query: ListCrewPaymentsDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = { tenant_id: tenantId };

    if (query.crew_member_id) {
      where.crew_member_id = query.crew_member_id;
    }
    if (query.project_id) {
      where.project_id = query.project_id;
    }

    const [data, total] = await Promise.all([
      this.prisma.crew_payment_record.findMany({
        where,
        include: {
          crew_member: {
            select: { id: true, first_name: true, last_name: true },
          },
          project: {
            select: { id: true, name: true, project_number: true },
          },
        },
        orderBy: { payment_date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.crew_payment_record.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get total paid to a crew member.
   */
  async getTotalPaid(tenantId: string, crewMemberId: string) {
    const result = await this.prisma.crew_payment_record.aggregate({
      where: {
        tenant_id: tenantId,
        crew_member_id: crewMemberId,
      },
      _sum: { amount: true },
      _count: true,
    });

    return {
      crew_member_id: crewMemberId,
      total_paid: result._sum.amount ? Number(result._sum.amount) : 0,
      payment_count: result._count,
    };
  }

  /**
   * Update a crew payment record.
   */
  async updatePayment(
    tenantId: string,
    paymentId: string,
    userId: string,
    dto: UpdateCrewPaymentDto,
  ) {
    const existing = await this.prisma.crew_payment_record.findFirst({
      where: { id: paymentId, tenant_id: tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Crew payment not found');
    }

    if (dto.payment_date) {
      this.validateDateNotFuture(dto.payment_date, 'Payment date');
    }

    // Validate period dates
    const periodStart = dto.period_start_date !== undefined
      ? dto.period_start_date
      : (existing.period_start_date ? existing.period_start_date.toISOString().split('T')[0] : null);
    const periodEnd = dto.period_end_date !== undefined
      ? dto.period_end_date
      : (existing.period_end_date ? existing.period_end_date.toISOString().split('T')[0] : null);

    if (periodStart && periodEnd) {
      const start = new Date(periodStart);
      const end = new Date(periodEnd);
      if (start > end) {
        throw new BadRequestException('Period start date must be before or equal to period end date');
      }
    }

    const updateData: any = {};

    if (dto.amount !== undefined) updateData.amount = dto.amount;
    if (dto.payment_date !== undefined) updateData.payment_date = new Date(dto.payment_date);
    if (dto.payment_method !== undefined) updateData.payment_method = dto.payment_method;
    if (dto.reference_number !== undefined) updateData.reference_number = dto.reference_number || null;
    if (dto.notes !== undefined) updateData.notes = dto.notes || null;
    if (dto.project_id !== undefined) updateData.project_id = dto.project_id || null;
    if (dto.period_start_date !== undefined) updateData.period_start_date = dto.period_start_date ? new Date(dto.period_start_date) : null;
    if (dto.period_end_date !== undefined) updateData.period_end_date = dto.period_end_date ? new Date(dto.period_end_date) : null;
    if (dto.hours_paid !== undefined) updateData.hours_paid = dto.hours_paid ?? null;

    const updated = await this.prisma.crew_payment_record.update({
      where: { id: paymentId },
      data: updateData,
      include: {
        crew_member: {
          select: { id: true, first_name: true, last_name: true },
        },
        project: {
          select: { id: true, name: true, project_number: true },
        },
      },
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'crew_payment_record',
      entityId: paymentId,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: `Updated crew payment ${paymentId}`,
    });

    return updated;
  }

  /**
   * Hard-delete a crew payment record.
   */
  async deletePayment(
    tenantId: string,
    paymentId: string,
    userId: string,
  ) {
    const existing = await this.prisma.crew_payment_record.findFirst({
      where: { id: paymentId, tenant_id: tenantId },
      include: {
        crew_member: {
          select: { id: true, first_name: true, last_name: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Crew payment not found');
    }

    await this.prisma.crew_payment_record.delete({
      where: { id: paymentId },
    });

    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'crew_payment_record',
      entityId: paymentId,
      tenantId,
      actorUserId: userId,
      before: existing,
      description: `Deleted crew payment of $${existing.amount} for ${existing.crew_member.first_name} ${existing.crew_member.last_name}`,
    });

    return { message: 'Payment deleted successfully' };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async validateCrewMemberBelongsToTenant(
    tenantId: string,
    crewMemberId: string,
  ) {
    const crewMember = await this.prisma.crew_member.findFirst({
      where: {
        id: crewMemberId,
        tenant_id: tenantId,
      },
    });

    if (!crewMember) {
      throw new NotFoundException(
        'Crew member not found or does not belong to this tenant',
      );
    }

    return crewMember;
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
