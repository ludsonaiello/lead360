import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreatePaymentMethodRegistryDto } from '../dto/create-payment-method-registry.dto';
import { UpdatePaymentMethodRegistryDto } from '../dto/update-payment-method-registry.dto';
import { ListPaymentMethodsDto } from '../dto/list-payment-methods.dto';

@Injectable()
export class PaymentMethodRegistryService {
  private readonly logger = new Logger(PaymentMethodRegistryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  /**
   * Create a new payment method for a tenant.
   * Enforces: 50-active limit, case-insensitive nickname uniqueness,
   * atomic default management via $transaction.
   */
  async create(
    tenantId: string,
    userId: string,
    dto: CreatePaymentMethodRegistryDto,
  ) {
    // 1. Check the 50-active-method limit
    const activeCount = await this.prisma.payment_method_registry.count({
      where: { tenant_id: tenantId, is_active: true },
    });
    if (activeCount >= 50) {
      throw new BadRequestException(
        'Maximum 50 active payment methods per tenant',
      );
    }

    // 2. Check nickname uniqueness (case-insensitive via MySQL collation)
    const existing = await this.prisma.payment_method_registry.findFirst({
      where: {
        tenant_id: tenantId,
        nickname: dto.nickname,
      },
    });
    if (existing) {
      throw new ConflictException(
        'A payment method with this nickname already exists',
      );
    }

    // 3. Handle is_default atomically within a Prisma transaction
    let record;
    try {
      record = await this.prisma.$transaction(async (tx) => {
        // If is_default=true, unset all other defaults first
        if (dto.is_default) {
          await tx.payment_method_registry.updateMany({
            where: { tenant_id: tenantId, is_default: true },
            data: { is_default: false },
          });
        }

        return tx.payment_method_registry.create({
          data: {
            tenant_id: tenantId,
            nickname: dto.nickname,
            type: dto.type as any,
            bank_name: dto.bank_name ?? null,
            last_four: dto.last_four ?? null,
            notes: dto.notes ?? null,
            is_default: dto.is_default ?? false,
            is_active: true,
            created_by_user_id: userId,
          },
        });
      });
    } catch (error) {
      // P2002: Unique constraint violation — race condition safety net
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A payment method with this nickname already exists',
        );
      }
      throw error;
    }

    // 4. Audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'payment_method_registry',
      entityId: record.id,
      tenantId,
      actorUserId: userId,
      after: record,
      description: `Created payment method: ${dto.nickname}`,
    });

    // 5. Return enriched with computed fields
    return this.enrichWithUsageData(record);
  }

  // ---------------------------------------------------------------------------
  // FIND ALL
  // ---------------------------------------------------------------------------

  /**
   * List all payment methods for a tenant.
   * Defaults to active-only. Pass is_active=false to show all.
   * Returns a flat array (NOT paginated envelope) — max 50 records per tenant.
   */
  async findAll(tenantId: string, query: ListPaymentMethodsDto) {
    const where: any = { tenant_id: tenantId };

    // Default to is_active=true if not specified
    if (query.is_active === undefined || query.is_active === true) {
      where.is_active = true;
    } else if (query.is_active === false) {
      // Do not filter by is_active — show all
    }

    if (query.type) {
      where.type = query.type;
    }

    const records = await this.prisma.payment_method_registry.findMany({
      where,
      orderBy: [{ is_default: 'desc' }, { nickname: 'asc' }],
    });

    // Enrich each record with computed usage data
    const enrichedRecords = await Promise.all(
      records.map((record) => this.enrichWithUsageData(record)),
    );

    return enrichedRecords;
  }

  // ---------------------------------------------------------------------------
  // FIND ONE
  // ---------------------------------------------------------------------------

  /**
   * Get a single payment method by ID, scoped to tenant.
   * Throws 404 if not found.
   */
  async findOne(tenantId: string, id: string) {
    const record = await this.prisma.payment_method_registry.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!record) {
      throw new NotFoundException('Payment method not found');
    }

    return this.enrichWithUsageData(record);
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  /**
   * Update a payment method. is_default is NOT updatable through this method.
   * Enforces case-insensitive nickname uniqueness when nickname changes.
   */
  async update(
    tenantId: string,
    id: string,
    userId: string,
    dto: UpdatePaymentMethodRegistryDto,
  ) {
    // 1. Find existing record (throws 404 if not found)
    const existing = await this.findOne(tenantId, id);

    // 2. If nickname is changing, check uniqueness (case-insensitive via MySQL collation, exclude self)
    if (dto.nickname !== undefined) {
      const duplicate = await this.prisma.payment_method_registry.findFirst({
        where: {
          tenant_id: tenantId,
          nickname: dto.nickname,
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new ConflictException(
          'A payment method with this nickname already exists',
        );
      }
    }

    // 3. Build update data object (only include provided fields)
    const data: any = { updated_by_user_id: userId };

    if (dto.nickname !== undefined) data.nickname = dto.nickname;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.bank_name !== undefined) data.bank_name = dto.bank_name;
    if (dto.last_four !== undefined) data.last_four = dto.last_four;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.is_active !== undefined) data.is_active = dto.is_active;

    // 4. Update the record
    let updated;
    try {
      updated = await this.prisma.payment_method_registry.update({
        where: { id },
        data,
      });
    } catch (error) {
      // P2002: Unique constraint violation — race condition safety net
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A payment method with this nickname already exists',
        );
      }
      throw error;
    }

    // 5. Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'payment_method_registry',
      entityId: id,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: `Updated payment method: ${updated.nickname}`,
    });

    // 6. Return enriched record
    return this.enrichWithUsageData(updated);
  }

  // ---------------------------------------------------------------------------
  // SOFT DELETE
  // ---------------------------------------------------------------------------

  /**
   * Soft-delete a payment method by setting is_active=false.
   * If the deleted record was the default, auto-reassigns to the most recently
   * created active method.
   * Returns 200 with the deactivated object (NOT 204).
   */
  async softDelete(tenantId: string, id: string, userId: string) {
    // 1. Find existing record (throws 404 if not found)
    const existing = await this.findOne(tenantId, id);

    // 2. Atomic: soft-delete + default reassignment in a single transaction
    const deactivated = await this.prisma.$transaction(async (tx) => {
      // 2a. Soft-delete by setting is_active = false
      const record = await tx.payment_method_registry.update({
        where: { id },
        data: {
          is_active: false,
          updated_by_user_id: userId,
        },
      });

      // 2b. If the deleted record was the default, reassign default
      if (existing.is_default) {
        const newDefault = await tx.payment_method_registry.findFirst({
          where: {
            tenant_id: tenantId,
            is_active: true,
            id: { not: id },
          },
          orderBy: { created_at: 'desc' },
        });

        if (newDefault) {
          await tx.payment_method_registry.update({
            where: { id: newDefault.id },
            data: { is_default: true },
          });
        }
      }

      return record;
    });

    // 3. Audit log
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'payment_method_registry',
      entityId: id,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: deactivated,
      description: `Deactivated payment method: ${existing.nickname}`,
    });

    // 4. Return the deactivated record with usage data
    return this.enrichWithUsageData(deactivated);
  }

  // ---------------------------------------------------------------------------
  // HARD DELETE
  // ---------------------------------------------------------------------------

  /**
   * Permanently delete a payment method from the database.
   * Only allowed when the method has ZERO usage across:
   *   - financial_entry
   *   - recurring_expense_rule
   *   - project_invoice_payment
   * Throws 400 if the record is still referenced anywhere.
   */
  async hardDelete(tenantId: string, id: string, userId: string) {
    // 1. Find existing record (throws 404 if not found)
    const existing = await this.findOne(tenantId, id);

    // 2. Check all tables that reference payment_method_registry_id
    const [entryCount, recurringCount, invoicePaymentCount] = await Promise.all([
      this.prisma.financial_entry.count({
        where: { payment_method_registry_id: id },
      }),
      this.prisma.recurring_expense_rule.count({
        where: { payment_method_registry_id: id },
      }),
      this.prisma.project_invoice_payment.count({
        where: { payment_method_registry_id: id },
      }),
    ]);

    const totalUsage = entryCount + recurringCount + invoicePaymentCount;

    if (totalUsage > 0) {
      const references: string[] = [];
      if (entryCount > 0) references.push(`${entryCount} financial entry(ies)`);
      if (recurringCount > 0) references.push(`${recurringCount} recurring rule(s)`);
      if (invoicePaymentCount > 0) references.push(`${invoicePaymentCount} invoice payment(s)`);
      throw new BadRequestException(
        `Cannot permanently delete: payment method is referenced by ${references.join(', ')}`,
      );
    }

    // 3. Hard delete
    await this.prisma.payment_method_registry.delete({
      where: { id },
    });

    // 4. Audit log
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'payment_method_registry',
      entityId: id,
      tenantId,
      actorUserId: userId,
      before: existing,
      description: `Permanently deleted payment method: ${existing.nickname}`,
    });

    return { message: `Payment method "${existing.nickname}" permanently deleted` };
  }

  // ---------------------------------------------------------------------------
  // SET DEFAULT
  // ---------------------------------------------------------------------------

  /**
   * Set a payment method as the tenant's default.
   * Atomic: unsets all existing defaults, then sets this one — within $transaction.
   * Throws 400 if the record is inactive.
   */
  async setDefault(tenantId: string, id: string, userId: string) {
    // 1. Find the record (throws 404 if not found)
    const record = await this.findOne(tenantId, id);

    // 2. Check if inactive
    if (!record.is_active) {
      throw new BadRequestException(
        'Cannot set an inactive payment method as default',
      );
    }

    // 3. Atomic transaction — unset all, then set this one
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.payment_method_registry.updateMany({
        where: { tenant_id: tenantId, is_default: true },
        data: { is_default: false },
      });

      return tx.payment_method_registry.update({
        where: { id },
        data: {
          is_default: true,
          updated_by_user_id: userId,
        },
      });
    });

    // 4. Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'payment_method_registry',
      entityId: id,
      tenantId,
      actorUserId: userId,
      before: record,
      after: updated,
      description: `Set payment method as default: ${record.nickname}`,
    });

    // 5. Return enriched
    return this.enrichWithUsageData(updated);
  }

  // ---------------------------------------------------------------------------
  // FIND DEFAULT
  // ---------------------------------------------------------------------------

  /**
   * Find the tenant's default payment method.
   * Returns null if no default exists — does NOT throw.
   * Designed for Sprint F-04 expense entry pre-population.
   */
  async findDefault(tenantId: string) {
    const record = await this.prisma.payment_method_registry.findFirst({
      where: {
        tenant_id: tenantId,
        is_default: true,
        is_active: true,
      },
    });

    if (!record) {
      return null;
    }

    return this.enrichWithUsageData(record);
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Enrich a payment method record with computed usage data from financial_entry.
   * usage_count and last_used_date are NEVER stored — always computed at query time.
   */
  private async enrichWithUsageData(record: any) {
    const [usageCount, lastUsed] = await Promise.all([
      this.prisma.financial_entry.count({
        where: { payment_method_registry_id: record.id },
      }),
      this.prisma.financial_entry.findFirst({
        where: { payment_method_registry_id: record.id },
        orderBy: { entry_date: 'desc' },
        select: { entry_date: true },
      }),
    ]);

    return {
      ...record,
      usage_count: usageCount,
      last_used_date: lastUsed?.entry_date ?? null,
    };
  }
}
