import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import {
  CreateRecurringRuleDto,
  RecurringFrequency,
} from '../dto/create-recurring-rule.dto';
import { UpdateRecurringRuleDto } from '../dto/update-recurring-rule.dto';
import { ListRecurringRulesDto } from '../dto/list-recurring-rules.dto';
import { SkipRecurringRuleDto } from '../dto/skip-recurring-rule.dto';
import { RecurringRuleHistoryDto } from '../dto/recurring-rule-history.dto';
import { FinancialEntryService } from './financial-entry.service';
import { Decimal } from '@prisma/client/runtime/library';
import {
  addDays,
  addMonths,
  addYears,
  getDaysInMonth,
  getDay,
  startOfDay,
} from 'date-fns';

/**
 * Shared Prisma include for recurring_expense_rule queries.
 * Returns enriched relation data for category, supplier, and payment method.
 */
const RULE_INCLUDE = {
  category: { select: { id: true, name: true, type: true } },
  supplier: { select: { id: true, name: true } },
  payment_method: { select: { id: true, nickname: true, type: true } },
} as const;

@Injectable()
export class RecurringExpenseService {
  private readonly logger = new Logger(RecurringExpenseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly financialEntryService: FinancialEntryService,
    @InjectQueue('recurring-expense-generation')
    private readonly recurringExpenseQueue: Queue,
  ) {}

  // ===========================================================================
  // PUBLIC — Core Scheduling Algorithm
  // ===========================================================================

  /**
   * Calculate the next due date based on frequency, interval, and the current due date.
   *
   * This is a **pure function** — no database calls, no side effects.
   * It is public so it can be unit-tested and called from the BullMQ processor.
   *
   * @param frequency  - 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'
   * @param interval   - Every N frequencies (e.g. interval=2 + monthly = every 2 months)
   * @param currentDueDate - The date to advance from
   * @param dayOfMonth - Preferred day of month (1-28) for monthly/quarterly/annual
   * @param dayOfWeek  - Preferred day of week (0=Sunday, 6=Saturday) for weekly
   * @returns The next occurrence date
   */
  calculateNextDueDate(
    frequency: string,
    interval: number,
    currentDueDate: Date,
    dayOfMonth?: number | null,
    dayOfWeek?: number | null,
  ): Date {
    switch (frequency) {
      case 'daily':
        return addDays(currentDueDate, interval);

      case 'weekly': {
        const advancedWeek = addDays(currentDueDate, interval * 7);
        if (dayOfWeek != null) {
          return this.advanceToWeekday(advancedWeek, dayOfWeek);
        }
        return advancedWeek;
      }

      case 'monthly': {
        const advancedMonth = addMonths(currentDueDate, interval);
        if (dayOfMonth != null) {
          return this.resolveDay(advancedMonth, dayOfMonth);
        }
        // Fallback when dayOfMonth is not stored. Uses the current due date's
        // day, which may be a snapped value (e.g. 28 after Feb snap from 31).
        // In practice this path is not reached for rules created through
        // create(), which auto-populates day_of_month for monthly/quarterly/annual.
        return this.resolveDay(advancedMonth, currentDueDate.getDate());
      }

      case 'quarterly': {
        const advancedQuarter = addMonths(currentDueDate, interval * 3);
        if (dayOfMonth != null) {
          return this.resolveDay(advancedQuarter, dayOfMonth);
        }
        return this.resolveDay(advancedQuarter, currentDueDate.getDate());
      }

      case 'annual': {
        const advancedYear = addYears(currentDueDate, interval);
        if (dayOfMonth != null) {
          return this.resolveDay(advancedYear, dayOfMonth);
        }
        // Handle leap year edge case: Feb 29 → Feb 28 in non-leap years
        return this.resolveDay(advancedYear, currentDueDate.getDate());
      }

      default:
        throw new BadRequestException(`Unsupported frequency: ${frequency}`);
    }
  }

  // ===========================================================================
  // PUBLIC — CRUD Operations
  // ===========================================================================

  /**
   * Create a new recurring expense rule.
   *
   * Validations (in order):
   * 1. Max 100 active rules per tenant
   * 2. category_id belongs to tenant and is active
   * 3. supplier_id (if provided) belongs to tenant
   * 4. payment_method_registry_id (if provided) belongs to tenant
   * 5. start_date is today or in the future
   * 6. end_date > start_date (if both provided)
   * 7. tax_amount < amount (if both provided)
   */
  async create(tenantId: string, userId: string, dto: CreateRecurringRuleDto) {
    // 1. Validate max active rules (100 per tenant)
    const activeCount = await this.prisma.recurring_expense_rule.count({
      where: { tenant_id: tenantId, status: 'active' },
    });
    if (activeCount >= 100) {
      throw new BadRequestException(
        'Maximum of 100 active recurring rules per tenant',
      );
    }

    // 2. Validate category_id belongs to tenant and is active
    const category = await this.prisma.financial_category.findFirst({
      where: { id: dto.category_id, tenant_id: tenantId, is_active: true },
    });
    if (!category) {
      throw new BadRequestException('Category not found or inactive');
    }

    // 3. Validate supplier_id (if provided) belongs to tenant
    if (dto.supplier_id) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplier_id, tenant_id: tenantId },
      });
      if (!supplier) {
        throw new BadRequestException('Supplier not found in tenant');
      }
    }

    // 4. Validate payment_method_registry_id (if provided) belongs to tenant
    if (dto.payment_method_registry_id) {
      const pm = await this.prisma.payment_method_registry.findFirst({
        where: { id: dto.payment_method_registry_id, tenant_id: tenantId },
      });
      if (!pm) {
        throw new BadRequestException('Payment method not found in tenant');
      }
    }

    // 5. Validate start_date is today or in the future
    const startDate = new Date(dto.start_date);
    const today = startOfDay(new Date());
    if (startDate < today) {
      throw new BadRequestException(
        'start_date must be today or in the future',
      );
    }

    // 6. Validate end_date > start_date (if both provided)
    if (dto.end_date) {
      const endDate = new Date(dto.end_date);
      if (endDate <= startDate) {
        throw new BadRequestException('end_date must be after start_date');
      }
    }

    // 7. Validate tax_amount < amount (if both provided)
    if (dto.tax_amount !== undefined && dto.tax_amount >= dto.amount) {
      throw new BadRequestException('tax_amount must be less than amount');
    }

    // 8. Auto-populate day_of_month from start_date when null.
    //    Without this, a rule starting Jan 31 would snap to Feb 28 and STAY on 28 forever.
    //    With this stored, calculateNextDueDate always has the preferred day:
    //    Jan 31 → Feb 28 → Mar 31 → Apr 30 → May 31
    let resolvedDayOfMonth = dto.day_of_month ?? null;
    if (
      resolvedDayOfMonth === null &&
      (
        [
          RecurringFrequency.MONTHLY,
          RecurringFrequency.QUARTERLY,
          RecurringFrequency.ANNUAL,
        ] as string[]
      ).includes(dto.frequency)
    ) {
      resolvedDayOfMonth = startDate.getDate();
    }

    // Same for day_of_week on weekly rules
    let resolvedDayOfWeek = dto.day_of_week ?? null;
    if (
      resolvedDayOfWeek === null &&
      dto.frequency === RecurringFrequency.WEEKLY
    ) {
      resolvedDayOfWeek = startDate.getDay();
    }

    // 9. Set next_due_date = start_date
    const nextDueDate = startDate;

    // 10. Create the rule
    const rule = await this.prisma.recurring_expense_rule.create({
      data: {
        tenant_id: tenantId,
        name: dto.name,
        description: dto.description ?? null,
        category_id: dto.category_id,
        amount: dto.amount,
        tax_amount: dto.tax_amount ?? null,
        supplier_id: dto.supplier_id ?? null,
        vendor_name: dto.vendor_name ?? null,
        payment_method_registry_id: dto.payment_method_registry_id ?? null,
        frequency: dto.frequency,
        interval: dto.interval ?? 1,
        day_of_month: resolvedDayOfMonth,
        day_of_week: resolvedDayOfWeek,
        start_date: startDate,
        end_date: dto.end_date ? new Date(dto.end_date) : null,
        recurrence_count: dto.recurrence_count ?? null,
        next_due_date: nextDueDate,
        auto_confirm: dto.auto_confirm ?? true,
        notes: dto.notes ?? null,
        status: 'active',
        created_by_user_id: userId,
      },
      include: RULE_INCLUDE,
    });

    // 11. Audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'recurring_expense_rule',
      entityId: rule.id,
      tenantId,
      actorUserId: userId,
      after: rule,
      description: `Created recurring expense rule: ${dto.name} (${dto.frequency}, $${dto.amount})`,
    });

    return rule;
  }

  /**
   * List recurring expense rules with pagination, filtering, sorting,
   * and a monthly obligation summary across ALL active rules.
   */
  async findAll(tenantId: string, query: ListRecurringRulesDto) {
    // Build where clause
    const where: Record<string, unknown> = { tenant_id: tenantId };
    if (query.status) {
      where.status = query.status;
    } else {
      where.status = 'active'; // Default filter
    }
    if (query.category_id) where.category_id = query.category_id;
    if (query.frequency) where.frequency = query.frequency;

    // Pagination
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    // Sorting
    const sortBy = query.sort_by ?? 'next_due_date';
    const sortOrder = query.sort_order ?? 'asc';
    const orderBy = { [sortBy]: sortOrder };

    // Query with count
    const [rules, total] = await Promise.all([
      this.prisma.recurring_expense_rule.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: RULE_INCLUDE,
      }),
      this.prisma.recurring_expense_rule.count({ where }),
    ]);

    // Calculate monthly obligation summary across ALL active rules (not just current page)
    const activeRules = await this.prisma.recurring_expense_rule.findMany({
      where: { tenant_id: tenantId, status: 'active' },
      select: { amount: true, frequency: true, interval: true },
    });

    let monthlyObligation = 0;
    for (const rule of activeRules) {
      const amount = Number(rule.amount);
      const interval = rule.interval;
      // Normalization formulas — convert any frequency to monthly equivalent.
      // Note: The original contract line 295 shows `daily: amount * interval * 30`
      // which produces incorrect results for interval > 1. Using the corrected
      // formula `amount * 30 / interval` instead.
      switch (rule.frequency) {
        case 'daily':
          monthlyObligation += (amount * 30) / interval;
          break;
        case 'weekly':
          monthlyObligation += amount * (30 / (interval * 7));
          break;
        case 'monthly':
          monthlyObligation += amount / interval;
          break;
        case 'quarterly':
          monthlyObligation += amount / (interval * 3);
          break;
        case 'annual':
          monthlyObligation += amount / (interval * 12);
          break;
      }
    }

    return {
      data: rules,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
      summary: {
        total_active_rules: activeRules.length,
        monthly_obligation: Math.round(monthlyObligation * 100) / 100,
      },
    };
  }

  /**
   * Get a single recurring rule by ID with enriched relations,
   * last generated entry info, and next 3 occurrence date preview.
   */
  async findOne(tenantId: string, ruleId: string) {
    const rule = await this.prisma.recurring_expense_rule.findFirst({
      where: { id: ruleId, tenant_id: tenantId },
      include: RULE_INCLUDE,
    });

    if (!rule) {
      throw new NotFoundException('Recurring rule not found');
    }

    // Fetch last generated entry (if last_generated_entry_id is set)
    let lastGeneratedEntry: {
      id: string;
      amount: Decimal;
      entry_date: Date;
      submission_status: string;
    } | null = null;
    if (rule.last_generated_entry_id) {
      lastGeneratedEntry = await this.prisma.financial_entry.findFirst({
        where: { id: rule.last_generated_entry_id, tenant_id: tenantId },
        select: {
          id: true,
          amount: true,
          entry_date: true,
          submission_status: true,
        },
      });
    }

    // Calculate next 3 occurrence dates
    const nextOccurrences: Date[] = [];
    let nextDate = new Date(rule.next_due_date);

    for (let i = 0; i < 3; i++) {
      if (i === 0) {
        nextOccurrences.push(nextDate);
      } else {
        nextDate = this.calculateNextDueDate(
          rule.frequency,
          rule.interval,
          nextDate,
          rule.day_of_month,
          rule.day_of_week,
        );
        // Check end_date boundary
        if (rule.end_date && nextDate > new Date(rule.end_date)) break;
        // Check recurrence_count boundary
        if (
          rule.recurrence_count &&
          rule.occurrences_generated + i >= rule.recurrence_count
        )
          break;
        nextOccurrences.push(nextDate);
      }
    }

    return {
      ...rule,
      last_generated_entry: lastGeneratedEntry,
      next_occurrence_preview: nextOccurrences.map(
        (d) => d.toISOString().split('T')[0],
      ),
    };
  }

  /**
   * Update a recurring expense rule.
   *
   * - Cancelled/completed rules cannot be updated.
   * - If schedule fields change (frequency, interval, day_of_month, day_of_week, amount),
   *   next_due_date is recalculated from the current next_due_date.
   * - If recalculated date is in the past, advances until a future date is found.
   */
  async update(
    tenantId: string,
    ruleId: string,
    userId: string,
    dto: UpdateRecurringRuleDto,
  ) {
    // 1. Fetch existing rule
    const existing = await this.prisma.recurring_expense_rule.findFirst({
      where: { id: ruleId, tenant_id: tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Recurring rule not found');
    }

    // 2. Check status — cannot update cancelled or completed
    if (existing.status === 'cancelled' || existing.status === 'completed') {
      throw new BadRequestException(`Cannot update a ${existing.status} rule`);
    }

    // 3. Validate FKs if provided
    if (dto.category_id) {
      const category = await this.prisma.financial_category.findFirst({
        where: { id: dto.category_id, tenant_id: tenantId, is_active: true },
      });
      if (!category) {
        throw new BadRequestException('Category not found or inactive');
      }
    }

    if (dto.supplier_id) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.supplier_id, tenant_id: tenantId },
      });
      if (!supplier) {
        throw new BadRequestException('Supplier not found in tenant');
      }
    }

    if (dto.payment_method_registry_id) {
      const pm = await this.prisma.payment_method_registry.findFirst({
        where: { id: dto.payment_method_registry_id, tenant_id: tenantId },
      });
      if (!pm) {
        throw new BadRequestException('Payment method not found in tenant');
      }
    }

    // 4. Validate end_date > start_date if end_date changes
    if (dto.end_date) {
      const startDate = existing.start_date;
      if (new Date(dto.end_date) <= startDate) {
        throw new BadRequestException('end_date must be after start_date');
      }
    }

    // 5. Validate tax_amount < amount if both are resolvable
    if (dto.tax_amount !== undefined) {
      const effectiveAmount =
        dto.amount !== undefined ? dto.amount : Number(existing.amount);
      if (dto.tax_amount >= effectiveAmount) {
        throw new BadRequestException('tax_amount must be less than amount');
      }
    }

    // 6. Determine if schedule fields changed.
    // Note: amount is included per spec. An amount-only change will recalculate
    // next_due_date, which advances past the current pending date. This is the
    // specified behavior — if it needs to change, update the sprint contract.
    const scheduleFieldsChanged =
      dto.frequency !== undefined ||
      dto.interval !== undefined ||
      dto.day_of_month !== undefined ||
      dto.day_of_week !== undefined ||
      dto.amount !== undefined;

    // 7. Build update data
    const updateData: Record<string, unknown> = {
      updated_by_user_id: userId,
    };

    // Map DTO fields to update data, only including defined fields
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.category_id !== undefined) updateData.category_id = dto.category_id;
    if (dto.amount !== undefined) updateData.amount = dto.amount;
    if (dto.tax_amount !== undefined) updateData.tax_amount = dto.tax_amount;
    if (dto.supplier_id !== undefined) updateData.supplier_id = dto.supplier_id;
    if (dto.vendor_name !== undefined) updateData.vendor_name = dto.vendor_name;
    if (dto.payment_method_registry_id !== undefined)
      updateData.payment_method_registry_id = dto.payment_method_registry_id;
    if (dto.frequency !== undefined) updateData.frequency = dto.frequency;
    if (dto.interval !== undefined) updateData.interval = dto.interval;
    if (dto.day_of_month !== undefined)
      updateData.day_of_month = dto.day_of_month;
    if (dto.day_of_week !== undefined) updateData.day_of_week = dto.day_of_week;
    if (dto.end_date !== undefined)
      updateData.end_date = dto.end_date ? new Date(dto.end_date) : null;
    if (dto.recurrence_count !== undefined)
      updateData.recurrence_count = dto.recurrence_count;
    if (dto.auto_confirm !== undefined)
      updateData.auto_confirm = dto.auto_confirm;
    if (dto.notes !== undefined) updateData.notes = dto.notes;

    // 8. Recalculate next_due_date if schedule changed
    if (scheduleFieldsChanged) {
      const newFrequency = dto.frequency ?? existing.frequency;
      const newInterval = dto.interval ?? existing.interval;
      const newDayOfMonth =
        dto.day_of_month !== undefined
          ? dto.day_of_month
          : existing.day_of_month;
      const newDayOfWeek =
        dto.day_of_week !== undefined ? dto.day_of_week : existing.day_of_week;

      // Recalculate from the current next_due_date
      let recalculated = this.calculateNextDueDate(
        newFrequency,
        newInterval,
        new Date(existing.next_due_date),
        newDayOfMonth,
        newDayOfWeek,
      );

      // If recalculated date is in the past, advance to future
      const today = startOfDay(new Date());
      while (recalculated < today) {
        recalculated = this.calculateNextDueDate(
          newFrequency,
          newInterval,
          recalculated,
          newDayOfMonth,
          newDayOfWeek,
        );
      }

      updateData.next_due_date = recalculated;
    }

    // 9. Update the rule
    const updated = await this.prisma.recurring_expense_rule.update({
      where: { id: ruleId },
      data: updateData,
      include: RULE_INCLUDE,
    });

    // 10. Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'recurring_expense_rule',
      entityId: ruleId,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: `Updated recurring rule: ${updated.name}${scheduleFieldsChanged ? ' (schedule modified)' : ''}`,
    });

    return updated;
  }

  /**
   * Cancel a recurring expense rule (soft delete).
   * Sets status to 'cancelled'. Does NOT delete the record.
   * Previously generated entries are unaffected (BR-8).
   */
  async cancel(tenantId: string, ruleId: string, userId: string) {
    const rule = await this.prisma.recurring_expense_rule.findFirst({
      where: { id: ruleId, tenant_id: tenantId },
    });
    if (!rule) {
      throw new NotFoundException('Recurring rule not found');
    }

    if (rule.status === 'cancelled') {
      throw new BadRequestException('Rule is already cancelled');
    }

    if (rule.status === 'completed') {
      throw new BadRequestException('Cannot cancel a completed rule');
    }

    const updated = await this.prisma.recurring_expense_rule.update({
      where: { id: ruleId },
      data: { status: 'cancelled', updated_by_user_id: userId },
      include: RULE_INCLUDE,
    });

    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'recurring_expense_rule',
      entityId: ruleId,
      tenantId,
      actorUserId: userId,
      before: rule,
      after: updated,
      description: `Cancelled recurring rule: ${rule.name}`,
    });

    return updated;
  }

  // ===========================================================================
  // PUBLIC — Lifecycle Operations
  // ===========================================================================

  /**
   * Pause an active recurring expense rule.
   * Preserves next_due_date — when resumed, rule picks up where it left off.
   * If next_due_date is in the past at resume time, resume() will advance it.
   */
  async pause(tenantId: string, ruleId: string, userId: string) {
    const rule = await this.prisma.recurring_expense_rule.findFirst({
      where: { id: ruleId, tenant_id: tenantId },
    });
    if (!rule) throw new NotFoundException('Recurring rule not found');

    if (rule.status !== 'active') {
      throw new BadRequestException('Only active rules can be paused');
    }

    const updated = await this.prisma.recurring_expense_rule.update({
      where: { id: ruleId },
      data: { status: 'paused', updated_by_user_id: userId },
      include: RULE_INCLUDE,
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'recurring_expense_rule',
      entityId: ruleId,
      tenantId,
      actorUserId: userId,
      before: rule,
      after: updated,
      description: `Paused recurring rule: ${rule.name}`,
    });

    return updated;
  }

  /**
   * Resume a paused recurring expense rule.
   * If next_due_date is in the past, advances to the next future occurrence.
   * Does NOT back-generate missed entries (BR-3).
   */
  async resume(tenantId: string, ruleId: string, userId: string) {
    const rule = await this.prisma.recurring_expense_rule.findFirst({
      where: { id: ruleId, tenant_id: tenantId },
    });
    if (!rule) throw new NotFoundException('Recurring rule not found');

    if (rule.status !== 'paused') {
      throw new BadRequestException('Only paused rules can be resumed');
    }

    // If next_due_date is in the past, advance to next future occurrence
    const today = startOfDay(new Date());
    let nextDueDate = new Date(rule.next_due_date);

    if (nextDueDate < today) {
      while (nextDueDate < today) {
        nextDueDate = this.calculateNextDueDate(
          rule.frequency,
          rule.interval,
          nextDueDate,
          rule.day_of_month,
          rule.day_of_week,
        );
      }
    }

    const updated = await this.prisma.recurring_expense_rule.update({
      where: { id: ruleId },
      data: {
        status: 'active',
        next_due_date: nextDueDate,
        updated_by_user_id: userId,
      },
      include: RULE_INCLUDE,
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'recurring_expense_rule',
      entityId: ruleId,
      tenantId,
      actorUserId: userId,
      before: rule,
      after: updated,
      description: `Resumed recurring rule: ${rule.name}. Next due: ${nextDueDate.toISOString().split('T')[0]}`,
    });

    return updated;
  }

  /**
   * Skip the next occurrence of an active recurring rule.
   * Advances next_due_date by one occurrence without generating an entry.
   * Skipping counts toward recurrence_count (BR-6).
   * Termination conditions are checked after every skip (BR-7).
   */
  async skipNext(
    tenantId: string,
    ruleId: string,
    userId: string,
    dto: SkipRecurringRuleDto,
  ) {
    const rule = await this.prisma.recurring_expense_rule.findFirst({
      where: { id: ruleId, tenant_id: tenantId },
    });
    if (!rule) throw new NotFoundException('Recurring rule not found');

    if (rule.status !== 'active') {
      throw new BadRequestException('Only active rules can skip occurrences');
    }

    // Calculate the NEXT occurrence after current next_due_date
    const newNextDueDate = this.calculateNextDueDate(
      rule.frequency,
      rule.interval,
      new Date(rule.next_due_date),
      rule.day_of_month,
      rule.day_of_week,
    );

    // Increment occurrences_generated (skip counts toward recurrence_count)
    const newOccurrencesGenerated = rule.occurrences_generated + 1;

    // Check termination conditions (BR-7)
    let newStatus: string = rule.status;
    if (rule.end_date && newNextDueDate > new Date(rule.end_date)) {
      newStatus = 'completed';
    }
    if (
      rule.recurrence_count &&
      newOccurrencesGenerated >= rule.recurrence_count
    ) {
      newStatus = 'completed';
    }

    const updated = await this.prisma.recurring_expense_rule.update({
      where: { id: ruleId },
      data: {
        next_due_date: newNextDueDate,
        occurrences_generated: newOccurrencesGenerated,
        status: newStatus as any,
        updated_by_user_id: userId,
      },
      include: RULE_INCLUDE,
    });

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'recurring_expense_rule',
      entityId: ruleId,
      tenantId,
      actorUserId: userId,
      before: rule,
      after: updated,
      metadata: {
        skipped_date: rule.next_due_date,
        reason: dto.reason,
      },
      description: `Skipped occurrence on ${new Date(rule.next_due_date).toISOString().split('T')[0]} for rule: ${rule.name}${dto.reason ? ` (reason: ${dto.reason})` : ''}`,
    });

    return updated;
  }

  /**
   * Manually trigger entry generation for a recurring rule.
   * Validates the rule is not cancelled or completed.
   * Enqueues a high-priority job on the recurring-expense-generation queue.
   */
  async triggerNow(tenantId: string, ruleId: string, userId: string) {
    const rule = await this.prisma.recurring_expense_rule.findFirst({
      where: { id: ruleId, tenant_id: tenantId },
    });
    if (!rule) throw new NotFoundException('Recurring rule not found');

    if (rule.status === 'cancelled' || rule.status === 'completed') {
      throw new BadRequestException(`Cannot trigger a ${rule.status} rule`);
    }

    await this.recurringExpenseQueue.add(
      'recurring-expense-generate',
      {
        ruleId,
        tenantId,
      },
      {
        priority: 1, // High priority — manual trigger should process quickly
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { age: 86400, count: 100 },
        removeOnFail: false,
      },
    );

    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'recurring_expense_rule',
      entityId: ruleId,
      tenantId,
      actorUserId: userId,
      description: `Manually triggered entry generation for rule: ${rule.name}`,
    });

    return { message: 'Entry generation triggered', rule_id: ruleId };
  }

  /**
   * Core entry generation — creates a financial_entry from the recurring rule
   * and updates the rule atomically within a Prisma interactive transaction.
   *
   * Business rules enforced:
   * - BR-9:  Generates ONE entry (the next occurrence), not all past-due
   * - BR-10: auto_confirm → submission_status = confirmed; else pending_review
   * - BR-11: Duplicate prevention — checks if entry already exists for rule+date
   * - BR-7:  Termination checked after generation (end_date, recurrence_count)
   */
  async processRule(ruleId: string, tenantId: string) {
    const rule = await this.prisma.recurring_expense_rule.findFirst({
      where: { id: ruleId, tenant_id: tenantId },
    });

    if (!rule) {
      this.logger.warn(
        `Rule ${ruleId} not found for tenant ${tenantId} — skipping`,
      );
      return;
    }

    // Verify rule is still active and due
    const today = startOfDay(new Date());
    if (rule.status !== 'active') {
      this.logger.log(`Rule ${ruleId} is ${rule.status} — skipping`);
      return;
    }

    if (new Date(rule.next_due_date) > today) {
      this.logger.log(
        `Rule ${ruleId} not yet due (next: ${rule.next_due_date}) — skipping`,
      );
      return;
    }

    // Duplicate prevention (BR-11):
    // Check if an entry with this rule's next_due_date already exists
    const ruleDueDate = new Date(rule.next_due_date);
    const nextDay = new Date(ruleDueDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const existingEntry = await this.prisma.financial_entry.findFirst({
      where: {
        recurring_rule_id: ruleId,
        tenant_id: tenantId,
        entry_date: {
          gte: ruleDueDate,
          lt: nextDay,
        },
      },
    });

    if (existingEntry) {
      this.logger.warn(
        `Entry already exists for rule ${ruleId} on ${ruleDueDate.toISOString().split('T')[0]} — skipping duplicate`,
      );
      return;
    }

    // Use Prisma interactive transaction for atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      // Create entry directly via Prisma (inside transaction for atomicity)
      const entry = await tx.financial_entry.create({
        data: {
          tenant_id: tenantId,
          category_id: rule.category_id,
          entry_type: 'expense',
          amount: rule.amount,
          tax_amount: rule.tax_amount,
          entry_date: new Date(rule.next_due_date),
          vendor_name: rule.vendor_name,
          supplier_id: rule.supplier_id,
          payment_method_registry_id: rule.payment_method_registry_id,
          notes: rule.notes,
          is_recurring_instance: true,
          recurring_rule_id: rule.id,
          submission_status: rule.auto_confirm ? 'confirmed' : 'pending_review',
          has_receipt: false,
          created_by_user_id: rule.created_by_user_id,
        },
      });

      // Calculate next due date
      const nextDueDate = this.calculateNextDueDate(
        rule.frequency,
        rule.interval,
        new Date(rule.next_due_date),
        rule.day_of_month,
        rule.day_of_week,
      );

      const newOccurrences = rule.occurrences_generated + 1;

      // Check termination conditions (BR-7)
      let newStatus: string = rule.status;
      if (rule.end_date && nextDueDate > new Date(rule.end_date)) {
        newStatus = 'completed';
      }
      if (rule.recurrence_count && newOccurrences >= rule.recurrence_count) {
        newStatus = 'completed';
      }

      // Update the rule
      await tx.recurring_expense_rule.update({
        where: { id: ruleId },
        data: {
          occurrences_generated: newOccurrences,
          last_generated_at: new Date(),
          last_generated_entry_id: entry.id,
          next_due_date: nextDueDate,
          status: newStatus as any,
        },
      });

      return entry;
    });

    this.logger.log(
      `Generated entry ${result.id} for recurring rule ${ruleId}`,
    );
    return result;
  }

  /**
   * Get paginated history of financial entries generated by a specific recurring rule.
   * Supports date_from/date_to filtering.
   */
  async getHistory(
    tenantId: string,
    ruleId: string,
    query: RecurringRuleHistoryDto,
  ) {
    // Verify rule exists and belongs to tenant
    const rule = await this.prisma.recurring_expense_rule.findFirst({
      where: { id: ruleId, tenant_id: tenantId },
    });
    if (!rule) throw new NotFoundException('Recurring rule not found');

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      recurring_rule_id: ruleId,
      tenant_id: tenantId,
    };

    if (query.date_from) {
      where.entry_date = {
        ...(where.entry_date as object),
        gte: new Date(query.date_from),
      };
    }
    if (query.date_to) {
      where.entry_date = {
        ...(where.entry_date as object),
        lte: new Date(query.date_to),
      };
    }

    const [entries, total] = await Promise.all([
      this.prisma.financial_entry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { entry_date: 'desc' },
        include: {
          category: { select: { id: true, name: true, type: true } },
        },
      }),
      this.prisma.financial_entry.count({ where }),
    ]);

    return {
      data: entries,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Preview all upcoming recurring expense occurrences within a given day window
   * (30, 60, or 90 days). Read-only — never creates entries.
   *
   * Respects end_date and recurrence_count boundaries.
   * Safety: max 365 occurrences per rule to prevent infinite loops.
   */
  async getPreview(tenantId: string, days: number) {
    // Fetch all active rules for this tenant
    const activeRules = await this.prisma.recurring_expense_rule.findMany({
      where: { tenant_id: tenantId, status: 'active' },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        payment_method: { select: { id: true, nickname: true } },
      },
    });

    const today = startOfDay(new Date());
    const endDate = addDays(today, days);

    const occurrences: Array<{
      rule_id: string;
      rule_name: string;
      amount: number;
      tax_amount: number | null;
      category_name: string;
      due_date: string;
      frequency: string;
      supplier_name: string | null;
      payment_method_nickname: string | null;
    }> = [];

    let totalObligations = 0;

    for (const rule of activeRules) {
      let nextDate = new Date(rule.next_due_date);
      let occurrenceCount = 0;

      // Generate all occurrences within the preview window
      while (nextDate <= endDate) {
        // Check recurrence_count limit BEFORE adding the occurrence
        if (
          rule.recurrence_count &&
          rule.occurrences_generated + occurrenceCount >= rule.recurrence_count
        )
          break;

        // Check end_date BEFORE adding
        if (rule.end_date && nextDate > new Date(rule.end_date)) break;

        if (nextDate >= today) {
          const amount = Number(rule.amount);
          const taxAmount = rule.tax_amount ? Number(rule.tax_amount) : null;

          occurrences.push({
            rule_id: rule.id,
            rule_name: rule.name,
            amount,
            tax_amount: taxAmount,
            category_name: rule.category?.name ?? 'Unknown',
            due_date: nextDate.toISOString().split('T')[0],
            frequency: rule.frequency,
            supplier_name: rule.supplier?.name ?? null,
            payment_method_nickname: rule.payment_method?.nickname ?? null,
          });

          totalObligations += amount;
        }

        // Advance to next occurrence
        nextDate = this.calculateNextDueDate(
          rule.frequency,
          rule.interval,
          nextDate,
          rule.day_of_month,
          rule.day_of_week,
        );

        occurrenceCount++;

        // Safety: prevent infinite loops (max 365 occurrences in any preview)
        if (occurrenceCount > 365) break;
      }
    }

    // Sort occurrences by due_date
    occurrences.sort((a, b) => a.due_date.localeCompare(b.due_date));

    return {
      period_days: days,
      total_obligations: Math.round(totalObligations * 100) / 100,
      occurrences,
    };
  }

  // ===========================================================================
  // PRIVATE — Helpers
  // ===========================================================================

  /**
   * Resolve a preferred day within a target month, snapping to the last day
   * if the month doesn't have enough days.
   *
   * Examples:
   *   resolveDay(Feb 2026, 31) → Feb 28 (non-leap year)
   *   resolveDay(Feb 2028, 29) → Feb 29 (leap year)
   *   resolveDay(Apr 2026, 31) → Apr 30
   *   resolveDay(Mar 2026, 31) → Mar 31
   */
  private resolveDay(targetDate: Date, preferredDay: number): Date {
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();
    const daysInMonth = getDaysInMonth(targetDate);
    const actualDay = Math.min(preferredDay, daysInMonth);
    return new Date(year, month, actualDay);
  }

  /**
   * Advance a date to the next occurrence of a specific weekday (0=Sunday, 6=Saturday).
   * If the date already falls on that weekday, returns it unchanged.
   */
  private advanceToWeekday(date: Date, targetDayOfWeek: number): Date {
    const currentDay = getDay(date);
    if (currentDay === targetDayOfWeek) return date;
    const daysUntilTarget = (targetDayOfWeek - currentDay + 7) % 7;
    return addDays(date, daysUntilTarget);
  }
}
