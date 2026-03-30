import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { SupplierService } from './supplier.service';
import { CreateFinancialEntryDto } from '../dto/create-financial-entry.dto';
import { UpdateFinancialEntryDto } from '../dto/update-financial-entry.dto';
import { ListFinancialEntriesDto } from '../dto/list-financial-entries.dto';
import { ListFinancialEntriesQueryDto } from '../dto/list-financial-entries-query.dto';
import { ListPendingEntriesQueryDto } from '../dto/list-pending-entries-query.dto';
import { ApproveEntryDto } from '../dto/approve-entry.dto';
import { RejectEntryDto } from '../dto/reject-entry.dto';
import { ResubmitEntryDto } from '../dto/resubmit-entry.dto';

@Injectable()
export class FinancialEntryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly supplierService: SupplierService,
  ) {}

  // ===========================================================================
  // PUBLIC — Read Operations
  // ===========================================================================

  /**
   * Get a single entry by ID with enriched response.
   * Enforces Employee ownership check — Employees can only view their own entries.
   */
  async getEntryById(
    tenantId: string,
    entryId: string,
    userId: string,
    userRoles: string[],
  ) {
    const entry = await this.fetchEntryOrFail(tenantId, entryId);

    // Employee scoping: can only view own entries
    if (!this.isPrivilegedRole(userRoles)) {
      if (entry.created_by_user_id !== userId) {
        throw new ForbiddenException(
          'Access denied. You can only view your own entries.',
        );
      }
    }

    return this.transformToEnrichedResponse(entry);
  }

  /**
   * Get paginated entries with full filtering, sorting, search, and summary aggregations.
   * Employees are silently scoped to their own entries.
   */
  async getEntries(
    tenantId: string,
    userId: string,
    userRoles: string[],
    query: ListFinancialEntriesQueryDto,
  ) {
    const where = this.buildEntryWhereClause(tenantId, userId, userRoles, query);

    // Pagination
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    // Sorting
    const sortBy = query.sort_by || 'entry_date';
    const sortOrder = query.sort_order || 'desc';
    const orderBy = { [sortBy]: sortOrder };

    // Execute query + count + summary aggregations in parallel
    const [data, total, expenseSum, incomeSum, taxSum] = await Promise.all([
      this.prisma.financial_entry.findMany({
        where,
        include: this.getEnrichedInclude(),
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.financial_entry.count({ where }),
      this.prisma.financial_entry.aggregate({
        where: { ...where, entry_type: 'expense' },
        _sum: { amount: true },
      }),
      this.prisma.financial_entry.aggregate({
        where: { ...where, entry_type: 'income' },
        _sum: { amount: true },
      }),
      this.prisma.financial_entry.aggregate({
        where,
        _sum: { tax_amount: true },
      }),
    ]);

    return {
      data: data.map((entry) => this.transformToEnrichedResponse(entry)),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
      summary: {
        total_expenses: Number(expenseSum._sum.amount || 0),
        total_income: Number(incomeSum._sum.amount || 0),
        total_tax: Number(taxSum._sum.tax_amount || 0),
        entry_count: total,
      },
    };
  }

  /**
   * Get paginated entries with submission_status = pending_review.
   * Used by Manager/Admin/Owner/Bookkeeper approval queue.
   */
  async getPendingEntries(
    tenantId: string,
    query: ListPendingEntriesQueryDto,
  ) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      tenant_id: tenantId,
      submission_status: 'pending_review',
    };

    if (query.submitted_by_user_id) {
      where.created_by_user_id = query.submitted_by_user_id;
    }

    if (query.date_from || query.date_to) {
      where.entry_date = {};
      if (query.date_from) where.entry_date.gte = new Date(query.date_from);
      if (query.date_to) where.entry_date.lte = new Date(query.date_to);
    }

    const [data, total, expenseSum, incomeSum, taxSum] = await Promise.all([
      this.prisma.financial_entry.findMany({
        where,
        include: this.getEnrichedInclude(),
        orderBy: { entry_date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.financial_entry.count({ where }),
      this.prisma.financial_entry.aggregate({
        where: { ...where, entry_type: 'expense' },
        _sum: { amount: true },
      }),
      this.prisma.financial_entry.aggregate({
        where: { ...where, entry_type: 'income' },
        _sum: { amount: true },
      }),
      this.prisma.financial_entry.aggregate({
        where,
        _sum: { tax_amount: true },
      }),
    ]);

    return {
      data: data.map((entry) => this.transformToEnrichedResponse(entry)),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
      summary: {
        total_expenses: Number(expenseSum._sum.amount || 0),
        total_income: Number(incomeSum._sum.amount || 0),
        total_tax: Number(taxSum._sum.tax_amount || 0),
        entry_count: total,
      },
    };
  }

  // ===========================================================================
  // PUBLIC — Legacy Read Operations (NOT modified — Sprint 4_3 note)
  // ===========================================================================

  /**
   * Get paginated entries for a project with optional filters.
   */
  async getProjectEntries(
    tenantId: string,
    query: ListFinancialEntriesDto,
  ) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      tenant_id: tenantId,
    };

    if (query.project_id) {
      where.project_id = query.project_id;
    }

    if (query.task_id) {
      where.task_id = query.task_id;
    }

    if (query.category_id) {
      where.category_id = query.category_id;
    }

    if (query.date_from || query.date_to) {
      where.entry_date = {};
      if (query.date_from) {
        where.entry_date.gte = new Date(query.date_from);
      }
      if (query.date_to) {
        where.entry_date.lte = new Date(query.date_to);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.financial_entry.findMany({
        where,
        include: {
          category: {
            select: { id: true, name: true, type: true },
          },
        },
        orderBy: { entry_date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.financial_entry.count({ where }),
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
   * Get all entries for a specific task.
   */
  async getTaskEntries(tenantId: string, taskId: string) {
    return this.prisma.financial_entry.findMany({
      where: {
        tenant_id: tenantId,
        task_id: taskId,
      },
      include: {
        category: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: { entry_date: 'desc' },
    });
  }

  // ===========================================================================
  // PUBLIC — Write Operations (Sprint 4_4 — Full CRUD with Role Logic & Hooks)
  // ===========================================================================

  /**
   * Create a new financial entry with full F-04 role-based logic.
   * Enforces: FK validation, purchased-by mutual exclusion, tax validation,
   * role-based submission_status defaulting, supplier spend hooks.
   */
  async createEntry(
    tenantId: string,
    userId: string,
    userRoles: string[],
    dto: CreateFinancialEntryDto,
  ) {
    // 1. Validate category belongs to tenant
    await this.validateCategoryBelongsToTenant(tenantId, dto.category_id);

    // 2. Validate project belongs to tenant (if provided)
    if (dto.project_id) {
      await this.validateProjectBelongsToTenant(tenantId, dto.project_id);
    }

    // 3. Validate task belongs to tenant (if provided)
    if (dto.task_id) {
      await this.validateTaskBelongsToTenant(tenantId, dto.task_id);
    }

    // 4. Validate supplier belongs to tenant and is active (if provided)
    if (dto.supplier_id) {
      await this.validateSupplierBelongsToTenant(tenantId, dto.supplier_id);
    }

    // 5. Determine payment_method value
    let resolvedPaymentMethod: string | null = dto.payment_method ?? null;
    if (dto.payment_method_registry_id) {
      // Validate registry and auto-copy its type (overrides any client-provided payment_method)
      const registryType = await this.validatePaymentMethodRegistry(
        tenantId,
        dto.payment_method_registry_id,
      );
      resolvedPaymentMethod = registryType;
    }

    // 6. Validate purchased_by mutual exclusion
    this.validatePurchasedByMutualExclusion(
      dto.purchased_by_user_id,
      dto.purchased_by_crew_member_id,
    );

    // 7. Validate purchased_by_user_id belongs to tenant
    if (dto.purchased_by_user_id) {
      await this.validateUserBelongsToTenant(tenantId, dto.purchased_by_user_id);
    }

    // 8. Validate purchased_by_crew_member_id belongs to tenant
    if (dto.purchased_by_crew_member_id) {
      await this.validateCrewMemberBelongsToTenant(tenantId, dto.purchased_by_crew_member_id);
    }

    // 9. Validate tax_amount < amount (if both provided)
    if (dto.tax_amount !== undefined && dto.tax_amount !== null) {
      this.validateTaxAmount(dto.amount, dto.tax_amount);
    }

    // Validate entry_date is not in the future (preserved from prior implementation)
    this.validateEntryDateNotFuture(dto.entry_date);

    // 10. Determine submission_status based on role
    let resolvedSubmissionStatus: string;
    if (!this.isPrivilegedRole(userRoles)) {
      // BR-06: Employee creates always get pending_review — forced, non-negotiable
      resolvedSubmissionStatus = 'pending_review';
    } else {
      // BR-07: Owner/Admin/Manager/Bookkeeper default to confirmed, can opt for pending_review
      resolvedSubmissionStatus = dto.submission_status || 'confirmed';
    }

    // 11. Create the entry record
    const entry = await this.prisma.financial_entry.create({
      data: {
        tenant_id: tenantId,
        project_id: dto.project_id ?? null,
        task_id: dto.task_id ?? null,
        category_id: dto.category_id,
        entry_type: dto.entry_type as any,
        amount: dto.amount,
        tax_amount: dto.tax_amount ?? null,
        discount: dto.discount ?? null,
        entry_date: new Date(dto.entry_date),
        entry_time: dto.entry_time ? new Date(`1970-01-01T${dto.entry_time}`) : null,
        vendor_name: dto.vendor_name ?? null,
        supplier_id: dto.supplier_id ?? null,
        payment_method: resolvedPaymentMethod as any,
        payment_method_registry_id: dto.payment_method_registry_id ?? null,
        purchased_by_user_id: dto.purchased_by_user_id ?? null,
        purchased_by_crew_member_id: dto.purchased_by_crew_member_id ?? null,
        submission_status: resolvedSubmissionStatus as any,
        is_recurring_instance: false,
        recurring_rule_id: null,
        has_receipt: false,
        notes: dto.notes ?? null,
        created_by_user_id: userId,
      },
      include: this.getEnrichedInclude(),
    });

    // 12. Update supplier spend totals
    if (dto.supplier_id) {
      await this.supplierService.updateSpendTotals(tenantId, dto.supplier_id);
    }

    // 13. Audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'financial_entry',
      entityId: entry.id,
      tenantId,
      actorUserId: userId,
      after: entry,
      description: dto.project_id
        ? `Created financial entry of $${dto.amount} for project ${dto.project_id}`
        : `Created business-level financial entry of $${dto.amount}`,
    });

    // 14. Return enriched response
    return this.transformToEnrichedResponse(entry);
  }

  /**
   * Update a financial entry with full F-04 role enforcement.
   * Uses fetchEntryOrFail() for internal lookup — does its own RBAC.
   * Enforces: Employee edit restrictions, FK validation, payment method auto-copy,
   * purchased-by mutual exclusion, tax validation, supplier spend hooks.
   */
  async updateEntry(
    tenantId: string,
    entryId: string,
    userId: string,
    userRoles: string[],
    dto: UpdateFinancialEntryDto,
  ) {
    // 1. Fetch existing entry (no role check — we do RBAC below)
    const existing = await this.fetchEntryOrFail(tenantId, entryId);

    // 2. Role enforcement
    if (!this.isPrivilegedRole(userRoles)) {
      // BR-13: Employee can only edit own entries in pending_review status
      if (existing.created_by_user_id !== userId) {
        throw new ForbiddenException(
          'Access denied. You can only edit your own entries.',
        );
      }
      if (existing.submission_status !== 'pending_review' && existing.submission_status !== 'denied') {
        throw new ForbiddenException(
          'Access denied. You can only edit entries with pending_review or denied status.',
        );
      }
    }

    // 3a. Validate category if changed
    if (dto.category_id) {
      await this.validateCategoryBelongsToTenant(tenantId, dto.category_id);
    }

    // 3b. Validate supplier if changed and not null
    if (dto.supplier_id !== undefined && dto.supplier_id !== null) {
      await this.validateSupplierBelongsToTenant(tenantId, dto.supplier_id);
    }

    // 3c. Validate purchased_by_user_id if changed
    if (dto.purchased_by_user_id !== undefined && dto.purchased_by_user_id !== null) {
      await this.validateUserBelongsToTenant(tenantId, dto.purchased_by_user_id);
    }

    // 3d. Validate purchased_by_crew_member_id if changed
    if (dto.purchased_by_crew_member_id !== undefined && dto.purchased_by_crew_member_id !== null) {
      await this.validateCrewMemberBelongsToTenant(tenantId, dto.purchased_by_crew_member_id);
    }

    // 3e. Validate tax vs amount on the RESULTING state
    const resultingAmount = dto.amount !== undefined ? dto.amount : Number(existing.amount);
    const resultingTax = dto.tax_amount !== undefined
      ? dto.tax_amount
      : (existing.tax_amount ? Number(existing.tax_amount) : null);
    if (resultingTax !== null && resultingTax >= resultingAmount) {
      throw new BadRequestException('Tax amount must be less than the entry amount');
    }

    // 3f. Validate entry_date not in the future (if changed)
    if (dto.entry_date) {
      this.validateEntryDateNotFuture(dto.entry_date);
    }

    // 4. Determine payment_method value if payment_method_registry_id changed
    let resolvedPaymentMethod: string | null | undefined = undefined;
    let resolvedRegistryId: string | null | undefined = undefined;
    if (dto.payment_method_registry_id !== undefined) {
      if (dto.payment_method_registry_id !== null) {
        // New registry ID provided → validate and auto-copy type
        const registryType = await this.validatePaymentMethodRegistry(
          tenantId,
          dto.payment_method_registry_id,
        );
        resolvedPaymentMethod = registryType;
        resolvedRegistryId = dto.payment_method_registry_id;
      } else {
        // Explicitly null → clear both payment_method and registry_id
        resolvedPaymentMethod = null;
        resolvedRegistryId = null;
      }
    }

    // 5. Validate purchased_by mutual exclusion on RESULTING state
    const resultingPurchasedByUserId =
      dto.purchased_by_user_id !== undefined
        ? dto.purchased_by_user_id
        : existing.purchased_by_user_id;
    const resultingPurchasedByCrewMemberId =
      dto.purchased_by_crew_member_id !== undefined
        ? dto.purchased_by_crew_member_id
        : existing.purchased_by_crew_member_id;
    this.validatePurchasedByMutualExclusion(
      resultingPurchasedByUserId,
      resultingPurchasedByCrewMemberId,
    );

    // 6. Track supplier change
    const oldSupplierId = existing.supplier_id;
    const newSupplierId = dto.supplier_id !== undefined
      ? dto.supplier_id
      : existing.supplier_id;

    // 7. Build update data object (only include fields that were provided in dto)
    const data: any = {
      updated_by_user_id: userId,
    };

    if (dto.category_id !== undefined) data.category_id = dto.category_id;
    if (dto.entry_type !== undefined) data.entry_type = dto.entry_type;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.tax_amount !== undefined) data.tax_amount = dto.tax_amount ?? null;
    if (dto.discount !== undefined) data.discount = dto.discount ?? null;
    if (dto.entry_date !== undefined) data.entry_date = new Date(dto.entry_date);
    if (dto.entry_time !== undefined) {
      data.entry_time = dto.entry_time
        ? new Date(`1970-01-01T${dto.entry_time}`)
        : null;
    }
    if (dto.vendor_name !== undefined) data.vendor_name = dto.vendor_name ?? null;
    if (dto.supplier_id !== undefined) data.supplier_id = dto.supplier_id ?? null;
    if (dto.notes !== undefined) data.notes = dto.notes ?? null;

    // Payment method fields — registry auto-copy takes precedence
    if (resolvedRegistryId !== undefined) {
      data.payment_method_registry_id = resolvedRegistryId;
    }
    if (resolvedPaymentMethod !== undefined) {
      data.payment_method = resolvedPaymentMethod;
    } else if (dto.payment_method !== undefined) {
      // Manual payment_method update (no registry change)
      data.payment_method = dto.payment_method ?? null;
    }

    if (dto.purchased_by_user_id !== undefined) {
      data.purchased_by_user_id = dto.purchased_by_user_id ?? null;
    }
    if (dto.purchased_by_crew_member_id !== undefined) {
      data.purchased_by_crew_member_id = dto.purchased_by_crew_member_id ?? null;
    }

    // 8. Execute Prisma update with enriched include
    const updated = await this.prisma.financial_entry.update({
      where: { id: entryId },
      data,
      include: this.getEnrichedInclude(),
    });

    // 9. Supplier spend update
    if (oldSupplierId !== newSupplierId) {
      // Supplier changed — recalculate both old and new
      if (oldSupplierId) {
        await this.supplierService.updateSpendTotals(tenantId, oldSupplierId);
      }
      if (newSupplierId) {
        await this.supplierService.updateSpendTotals(tenantId, newSupplierId);
      }
    } else if (newSupplierId && dto.amount !== undefined) {
      // Amount changed but supplier stayed the same — still recalculate
      await this.supplierService.updateSpendTotals(tenantId, newSupplierId);
    }

    // 10. Audit log with before/after
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'financial_entry',
      entityId: entryId,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: `Updated financial entry ${entryId}`,
    });

    // 11. Return enriched response
    return this.transformToEnrichedResponse(updated);
  }

  /**
   * Hard delete a financial entry with full F-04 role enforcement.
   * Uses fetchEntryOrFail() for internal lookup — does its own RBAC.
   * BR-14: Manager/Bookkeeper cannot delete. BR-15: Only Owner/Admin can delete confirmed.
   * Employee can delete own pending_review entries only.
   */
  async deleteEntry(
    tenantId: string,
    entryId: string,
    userId: string,
    userRoles: string[],
  ) {
    // 1. Fetch existing entry (no role check — we do RBAC below)
    const existing = await this.fetchEntryOrFail(tenantId, entryId);

    // 2. Role enforcement (from contract matrix)
    const highestRole = this.getHighestRole(userRoles);

    if (highestRole === 'Owner' || highestRole === 'Admin') {
      // Can delete any entry in any status — no restrictions
    } else if (highestRole === 'Manager' || highestRole === 'Bookkeeper') {
      // BR-14: Managers and Bookkeepers cannot delete entries — 403 always
      throw new ForbiddenException(
        'Managers and Bookkeepers are not authorized to delete financial entries.',
      );
    } else {
      // Employee: can delete own entries ONLY when pending_review
      if (existing.created_by_user_id !== userId) {
        throw new ForbiddenException(
          'Access denied. You can only delete your own entries.',
        );
      }
      if (existing.submission_status !== 'pending_review' && existing.submission_status !== 'denied') {
        throw new ForbiddenException(
          'Access denied. You can only delete entries with pending_review or denied status.',
        );
      }
    }

    const supplierId = existing.supplier_id;

    // 3. Execute hard delete
    await this.prisma.financial_entry.delete({
      where: { id: entryId },
    });

    // 4. Update supplier spend totals
    if (supplierId) {
      await this.supplierService.updateSpendTotals(tenantId, supplierId);
    }

    // 5. Audit log with before data
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'financial_entry',
      entityId: entryId,
      tenantId,
      actorUserId: userId,
      before: existing,
      description: `Deleted financial entry ${entryId} ($${existing.amount})`,
    });

    // 6. Return success message
    return { message: 'Entry deleted successfully' };
  }

  // ===========================================================================
  // PUBLIC — Workflow Operations (Sprint 4_5 — Approve, Reject, Resubmit)
  // ===========================================================================

  /**
   * Approve a pending_review or denied entry — sets submission_status to 'confirmed'.
   * Does NOT clear rejection fields — preserves audit trail per BR-23.
   */
  async approveEntry(
    tenantId: string,
    entryId: string,
    approverId: string,
    dto: ApproveEntryDto,
  ) {
    // 1. Fetch entry with enriched include
    const existing = await this.fetchEntryOrFail(tenantId, entryId);

    // 2. Verify entry is pending_review or denied (BR-17)
    if (existing.submission_status !== 'pending_review' && existing.submission_status !== 'denied') {
      throw new BadRequestException(
        'Only pending or denied entries can be approved.',
      );
    }

    // 3. Update submission_status to confirmed
    const updated = await this.prisma.financial_entry.update({
      where: { id: entryId },
      data: {
        submission_status: 'confirmed',
        updated_by_user_id: approverId,
      },
      include: this.getEnrichedInclude(),
    });

    // 4. Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'financial_entry',
      entityId: entryId,
      tenantId,
      actorUserId: approverId,
      before: existing,
      after: updated,
      metadata: { workflow_action: 'EXPENSE_APPROVED', approval_notes: dto.notes },
      description: `Approved financial entry ${entryId}`,
    });

    // 5. Return enriched response
    return this.transformToEnrichedResponse(updated);
  }

  /**
   * Reject a pending_review entry — sets submission_status to 'denied' and
   * attaches rejection reason and metadata.
   */
  async rejectEntry(
    tenantId: string,
    entryId: string,
    rejectorId: string,
    dto: RejectEntryDto,
  ) {
    // 1. Fetch entry with enriched include
    const existing = await this.fetchEntryOrFail(tenantId, entryId);

    // 2. Verify entry is pending_review (BR-18)
    if (existing.submission_status !== 'pending_review') {
      throw new BadRequestException(
        'Entry is not in pending_review status. Only pending entries can be rejected.',
      );
    }

    // 3. Defense-in-depth: verify rejection_reason is not empty
    //    (class-validator @IsNotEmpty handles this, but double-check at service layer)
    if (!dto.rejection_reason || dto.rejection_reason.trim().length === 0) {
      throw new BadRequestException('Rejection reason is required');
    }

    // 4. Update rejection fields and set submission_status to 'denied'
    const updated = await this.prisma.financial_entry.update({
      where: { id: entryId },
      data: {
        submission_status: 'denied',
        rejection_reason: dto.rejection_reason,
        rejected_by_user_id: rejectorId,
        rejected_at: new Date(),
        updated_by_user_id: rejectorId,
      },
      include: this.getEnrichedInclude(),
    });

    // 5. Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'financial_entry',
      entityId: entryId,
      tenantId,
      actorUserId: rejectorId,
      before: existing,
      after: updated,
      metadata: { workflow_action: 'EXPENSE_REJECTED', rejection_reason: dto.rejection_reason },
      description: `Rejected financial entry ${entryId}: ${dto.rejection_reason}`,
    });

    // 6. Return enriched response
    return this.transformToEnrichedResponse(updated);
  }

  /**
   * Resubmit a denied entry — clears rejection fields, resets status to
   * pending_review, and optionally updates entry data.
   * Employees can only resubmit their own entries. Privileged roles can resubmit any.
   * Only entries with submission_status = 'denied' can be resubmitted.
   */
  async resubmitEntry(
    tenantId: string,
    entryId: string,
    userId: string,
    userRoles: string[],
    dto: ResubmitEntryDto,
  ) {
    // 1. Fetch entry with enriched include
    const existing = await this.fetchEntryOrFail(tenantId, entryId);

    // 2. Employee ownership check
    if (!this.isPrivilegedRole(userRoles)) {
      if (existing.created_by_user_id !== userId) {
        throw new ForbiddenException(
          'Access denied. You can only resubmit your own entries.',
        );
      }
    }

    // 3. Verify entry is denied — only denied entries can be resubmitted
    if (existing.submission_status !== 'denied') {
      throw new BadRequestException(
        'Only denied entries can be resubmitted.',
      );
    }

    // 4. Build update data — clear rejection fields and reset to pending_review
    const data: any = {
      submission_status: 'pending_review',
      rejection_reason: null,
      rejected_by_user_id: null,
      rejected_at: null,
      updated_by_user_id: userId,
    };

    // 5. Validate and apply optional field updates (same logic as updateEntry)

    // 5a. Validate category if changed
    if (dto.category_id) {
      await this.validateCategoryBelongsToTenant(tenantId, dto.category_id);
      data.category_id = dto.category_id;
    }

    // 5b. Validate supplier if changed
    if (dto.supplier_id !== undefined && dto.supplier_id !== null) {
      await this.validateSupplierBelongsToTenant(tenantId, dto.supplier_id);
    }
    if (dto.supplier_id !== undefined) {
      data.supplier_id = dto.supplier_id ?? null;
    }

    // 5c. Validate purchased_by_user_id if changed
    if (dto.purchased_by_user_id !== undefined && dto.purchased_by_user_id !== null) {
      await this.validateUserBelongsToTenant(tenantId, dto.purchased_by_user_id);
    }

    // 5d. Validate purchased_by_crew_member_id if changed
    if (dto.purchased_by_crew_member_id !== undefined && dto.purchased_by_crew_member_id !== null) {
      await this.validateCrewMemberBelongsToTenant(tenantId, dto.purchased_by_crew_member_id);
    }

    // 5e. Payment method registry auto-copy
    if (dto.payment_method_registry_id !== undefined) {
      if (dto.payment_method_registry_id !== null) {
        const registryType = await this.validatePaymentMethodRegistry(
          tenantId,
          dto.payment_method_registry_id,
        );
        data.payment_method = registryType;
        data.payment_method_registry_id = dto.payment_method_registry_id;
      } else {
        data.payment_method = null;
        data.payment_method_registry_id = null;
      }
    } else if (dto.payment_method !== undefined) {
      data.payment_method = dto.payment_method ?? null;
    }

    // 5f. Validate purchased_by mutual exclusion on RESULTING state
    const resultingPurchasedByUserId =
      dto.purchased_by_user_id !== undefined
        ? dto.purchased_by_user_id
        : existing.purchased_by_user_id;
    const resultingPurchasedByCrewMemberId =
      dto.purchased_by_crew_member_id !== undefined
        ? dto.purchased_by_crew_member_id
        : existing.purchased_by_crew_member_id;
    this.validatePurchasedByMutualExclusion(
      resultingPurchasedByUserId,
      resultingPurchasedByCrewMemberId,
    );

    // 5g. Validate tax vs amount on RESULTING state
    const resultingAmount = dto.amount !== undefined ? dto.amount : Number(existing.amount);
    const resultingTax = dto.tax_amount !== undefined
      ? dto.tax_amount
      : (existing.tax_amount ? Number(existing.tax_amount) : null);
    if (resultingTax !== null && resultingTax >= resultingAmount) {
      throw new BadRequestException('Tax amount must be less than the entry amount');
    }

    // 5h. Validate entry_date not in the future (if changed)
    if (dto.entry_date) {
      this.validateEntryDateNotFuture(dto.entry_date);
    }

    // 5i. Apply remaining field updates to data object
    if (dto.entry_type !== undefined) data.entry_type = dto.entry_type;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.tax_amount !== undefined) data.tax_amount = dto.tax_amount ?? null;
    if (dto.discount !== undefined) data.discount = dto.discount ?? null;
    if (dto.entry_date !== undefined) data.entry_date = new Date(dto.entry_date);
    if (dto.entry_time !== undefined) {
      data.entry_time = dto.entry_time
        ? new Date(`1970-01-01T${dto.entry_time}`)
        : null;
    }
    if (dto.vendor_name !== undefined) data.vendor_name = dto.vendor_name ?? null;
    if (dto.notes !== undefined) data.notes = dto.notes ?? null;
    if (dto.purchased_by_user_id !== undefined) {
      data.purchased_by_user_id = dto.purchased_by_user_id ?? null;
    }
    if (dto.purchased_by_crew_member_id !== undefined) {
      data.purchased_by_crew_member_id = dto.purchased_by_crew_member_id ?? null;
    }

    // 6. Track supplier change for spend update
    const oldSupplierId = existing.supplier_id;
    const newSupplierId = dto.supplier_id !== undefined
      ? dto.supplier_id
      : existing.supplier_id;

    // 7. Execute Prisma update with enriched include
    const updated = await this.prisma.financial_entry.update({
      where: { id: entryId },
      data,
      include: this.getEnrichedInclude(),
    });

    // 8. Supplier spend update (same logic as updateEntry)
    if (oldSupplierId !== newSupplierId) {
      if (oldSupplierId) {
        await this.supplierService.updateSpendTotals(tenantId, oldSupplierId);
      }
      if (newSupplierId) {
        await this.supplierService.updateSpendTotals(tenantId, newSupplierId);
      }
    } else if (newSupplierId && dto.amount !== undefined) {
      await this.supplierService.updateSpendTotals(tenantId, newSupplierId);
    }

    // 9. Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'financial_entry',
      entityId: entryId,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      metadata: { workflow_action: 'EXPENSE_RESUBMITTED' },
      description: `Resubmitted financial entry ${entryId}`,
    });

    // 10. Return enriched response
    return this.transformToEnrichedResponse(updated);
  }

  // ===========================================================================
  // PUBLIC — Export Operations (Sprint 4_5 — CSV Export)
  // ===========================================================================

  /**
   * Export filtered entries as CSV string.
   * Uses the same filter logic as getEntries() via shared buildEntryWhereClause().
   * Limited to 10,000 rows (BR-24). Does NOT paginate (BR-25).
   */
  async exportEntries(
    tenantId: string,
    userId: string,
    userRoles: string[],
    query: ListFinancialEntriesQueryDto,
  ): Promise<string> {
    // 1. Build where clause using shared filter builder
    const where = this.buildEntryWhereClause(tenantId, userId, userRoles, query);

    // 2. Count total matching entries
    const count = await this.prisma.financial_entry.count({ where });

    // 3. Enforce 10,000 row limit (BR-24)
    if (count > 10000) {
      throw new BadRequestException(
        'Export limit exceeded. Apply date filters to narrow the result set.',
      );
    }

    // 4. Fetch entries with SELECT (not full include — optimized for CSV)
    const entries = await this.prisma.financial_entry.findMany({
      where,
      select: {
        entry_date: true,
        entry_time: true,
        entry_type: true,
        amount: true,
        tax_amount: true,
        discount: true,
        vendor_name: true,
        payment_method: true,
        submission_status: true,
        notes: true,
        created_at: true,
        category: { select: { name: true, type: true, classification: true } },
        project: { select: { name: true } },
        task: { select: { title: true } },
        supplier: { select: { name: true } },
        payment_method_registry_rel: { select: { nickname: true } },
        purchased_by_user: { select: { first_name: true, last_name: true } },
        purchased_by_crew_member: { select: { first_name: true, last_name: true } },
        created_by: { select: { first_name: true, last_name: true } },
      },
      orderBy: { entry_date: 'desc' },
    });

    // 5. Build CSV string
    const header =
      'Date,Time,Type,Category,Classification,Project,Task,Supplier,Vendor Name,Amount,Tax Amount,Discount,Payment Method,Payment Account,Purchased By,Submitted By,Status,Notes,Created At';

    const rows = entries.map((entry) => {
      // Format date as YYYY-MM-DD
      const date = entry.entry_date
        ? new Date(entry.entry_date).toISOString().split('T')[0]
        : '';

      // Format time as HH:MM:SS (stored as DateTime with 1970-01-01 base)
      let time = '';
      if (entry.entry_time) {
        const t = new Date(entry.entry_time);
        const hh = String(t.getUTCHours()).padStart(2, '0');
        const mm = String(t.getUTCMinutes()).padStart(2, '0');
        const ss = String(t.getUTCSeconds()).padStart(2, '0');
        time = `${hh}:${mm}:${ss}`;
      }

      // Resolve purchased_by name (user or crew member)
      const purchasedBy = entry.purchased_by_user
        ? `${entry.purchased_by_user.first_name} ${entry.purchased_by_user.last_name}`
        : entry.purchased_by_crew_member
          ? `${entry.purchased_by_crew_member.first_name} ${entry.purchased_by_crew_member.last_name}`
          : '';

      const submittedBy = `${entry.created_by.first_name} ${entry.created_by.last_name}`;

      return [
        this.escapeCsvField(date),
        this.escapeCsvField(time),
        this.escapeCsvField(entry.entry_type),
        this.escapeCsvField(entry.category?.name),
        this.escapeCsvField(entry.category?.classification),
        this.escapeCsvField(entry.project?.name),
        this.escapeCsvField(entry.task?.title),
        this.escapeCsvField(entry.supplier?.name),
        this.escapeCsvField(entry.vendor_name),
        entry.amount != null ? String(entry.amount) : '',
        entry.tax_amount != null ? String(entry.tax_amount) : '',
        entry.discount != null ? String(entry.discount) : '',
        this.escapeCsvField(entry.payment_method),
        this.escapeCsvField(entry.payment_method_registry_rel?.nickname),
        this.escapeCsvField(purchasedBy || null),
        this.escapeCsvField(submittedBy),
        this.escapeCsvField(entry.submission_status),
        this.escapeCsvField(entry.notes),
        entry.created_at ? entry.created_at.toISOString() : '',
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  // ===========================================================================
  // PUBLIC — Summary Operations (NOT modified — Sprint 4_3 note)
  // ===========================================================================

  /**
   * Get project cost summary — aggregates by category type.
   */
  async getProjectCostSummary(tenantId: string, projectId: string) {
    const entries = await this.prisma.financial_entry.findMany({
      where: {
        tenant_id: tenantId,
        project_id: projectId,
      },
      include: {
        category: {
          select: { type: true },
        },
      },
    });

    const costByCategory: Record<string, number> = {
      labor: 0,
      material: 0,
      subcontractor: 0,
      equipment: 0,
      insurance: 0,
      fuel: 0,
      utilities: 0,
      office: 0,
      marketing: 0,
      taxes: 0,
      tools: 0,
      other: 0,
    };

    let totalActualCost = 0;

    for (const entry of entries) {
      const amount = Number(entry.amount);
      const categoryType = entry.category.type;
      costByCategory[categoryType] = (costByCategory[categoryType] || 0) + amount;
      totalActualCost += amount;
    }

    return {
      project_id: projectId,
      total_actual_cost: Math.round(totalActualCost * 100) / 100,
      cost_by_category: {
        labor: Math.round(costByCategory.labor * 100) / 100,
        material: Math.round(costByCategory.material * 100) / 100,
        subcontractor: Math.round(costByCategory.subcontractor * 100) / 100,
        equipment: Math.round(costByCategory.equipment * 100) / 100,
        insurance: Math.round(costByCategory.insurance * 100) / 100,
        fuel: Math.round(costByCategory.fuel * 100) / 100,
        utilities: Math.round(costByCategory.utilities * 100) / 100,
        office: Math.round(costByCategory.office * 100) / 100,
        marketing: Math.round(costByCategory.marketing * 100) / 100,
        taxes: Math.round(costByCategory.taxes * 100) / 100,
        tools: Math.round(costByCategory.tools * 100) / 100,
        other: Math.round(costByCategory.other * 100) / 100,
      },
      entry_count: entries.length,
    };
  }

  /**
   * Get task cost summary — returns total cost and entry count.
   */
  async getTaskCostSummary(tenantId: string, taskId: string) {
    const entries = await this.prisma.financial_entry.findMany({
      where: {
        tenant_id: tenantId,
        task_id: taskId,
      },
      select: { amount: true },
    });

    let totalActualCost = 0;
    for (const entry of entries) {
      totalActualCost += Number(entry.amount);
    }

    return {
      task_id: taskId,
      total_actual_cost: Math.round(totalActualCost * 100) / 100,
      entry_count: entries.length,
    };
  }

  // ===========================================================================
  // PRIVATE — Enriched Query Infrastructure (Sprint 4_3)
  // ===========================================================================

  /**
   * Shared enriched include clause used by ALL entry queries that return
   * entries to the client. Ensures a consistent, enriched response shape
   * with human-readable labels for all FK references.
   */
  private getEnrichedInclude() {
    return {
      category: {
        select: {
          id: true,
          name: true,
          type: true,
          classification: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      task: {
        select: {
          id: true,
          title: true,
        },
      },
      supplier: {
        select: {
          id: true,
          name: true,
        },
      },
      payment_method_registry_rel: {
        select: {
          id: true,
          nickname: true,
        },
      },
      purchased_by_user: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
        },
      },
      purchased_by_crew_member: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
        },
      },
      created_by: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
        },
      },
      rejected_by: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
        },
      },
      line_items: {
        select: {
          id: true,
          description: true,
          quantity: true,
          unit_price: true,
          total: true,
          unit_of_measure: true,
          supplier_product_id: true,
          order_index: true,
          notes: true,
        },
        orderBy: { order_index: 'asc' as const },
      },
    };
  }

  /**
   * Transforms a raw Prisma result (with enriched includes) into the flat
   * enriched response shape specified by the API contract.
   */
  private transformToEnrichedResponse(entry: any) {
    return {
      id: entry.id,
      tenant_id: entry.tenant_id,
      project_id: entry.project_id,
      project_name: entry.project?.name ?? null,
      task_id: entry.task_id,
      task_title: entry.task?.title ?? null,
      category_id: entry.category_id,
      category_name: entry.category.name,
      category_type: entry.category.type,
      category_classification: entry.category.classification,
      entry_type: entry.entry_type,
      amount: entry.amount,
      tax_amount: entry.tax_amount,
      entry_date: entry.entry_date,
      entry_time: entry.entry_time,
      vendor_name: entry.vendor_name,
      supplier_id: entry.supplier_id,
      supplier_name: entry.supplier?.name ?? null,
      payment_method: entry.payment_method,
      payment_method_registry_id: entry.payment_method_registry_id,
      payment_method_nickname: entry.payment_method_registry_rel?.nickname ?? null,
      purchased_by_user_id: entry.purchased_by_user_id,
      purchased_by_user_name: entry.purchased_by_user
        ? `${entry.purchased_by_user.first_name} ${entry.purchased_by_user.last_name}`
        : null,
      purchased_by_crew_member_id: entry.purchased_by_crew_member_id,
      purchased_by_crew_member_name: entry.purchased_by_crew_member
        ? `${entry.purchased_by_crew_member.first_name} ${entry.purchased_by_crew_member.last_name}`
        : null,
      submission_status: entry.submission_status,
      rejection_reason: entry.rejection_reason,
      rejected_by_user_id: entry.rejected_by_user_id,
      rejected_by_name: entry.rejected_by
        ? `${entry.rejected_by.first_name} ${entry.rejected_by.last_name}`
        : null,
      rejected_at: entry.rejected_at,
      is_recurring_instance: entry.is_recurring_instance,
      recurring_rule_id: entry.recurring_rule_id,
      has_receipt: entry.has_receipt,
      discount: entry.discount,
      notes: entry.notes,
      created_by_user_id: entry.created_by_user_id,
      created_by_name: `${entry.created_by.first_name} ${entry.created_by.last_name}`,
      created_at: entry.created_at,
      updated_at: entry.updated_at,
      // Line items
      line_items: entry.line_items ?? [],
      has_line_items: (entry.line_items?.length ?? 0) > 0,
      items_subtotal: (entry.line_items ?? []).reduce(
        (sum: number, item: any) => sum + Number(item.total ?? 0),
        0,
      ),
    };
  }

  // ===========================================================================
  // PRIVATE — Role Helpers (Sprint 4_3)
  // ===========================================================================

  /**
   * Determine highest-priority role from the user's role array.
   * Priority: Owner > Admin > Manager > Bookkeeper > Employee
   */
  private getHighestRole(roles: string[]): string {
    const priority = ['Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee'];
    for (const role of priority) {
      if (roles.includes(role)) {
        return role;
      }
    }
    return 'Employee'; // Fallback — most restrictive
  }

  /**
   * Check if user has a privileged role (Owner, Admin, Manager, or Bookkeeper).
   * Employees are NOT privileged and are subject to ownership scoping.
   */
  private isPrivilegedRole(roles: string[]): boolean {
    const privileged = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];
    return roles.some((r) => privileged.includes(r));
  }

  // ===========================================================================
  // PRIVATE — Internal Fetch (Sprint 4_3)
  // ===========================================================================

  /**
   * Internal fetch — no role checks. Used by service methods that do their own RBAC.
   * Fetches entry with enriched include and throws NotFoundException if not found.
   */
  private async fetchEntryOrFail(tenantId: string, entryId: string) {
    const entry = await this.prisma.financial_entry.findFirst({
      where: {
        id: entryId,
        tenant_id: tenantId,
      },
      include: this.getEnrichedInclude(),
    });

    if (!entry) {
      throw new NotFoundException('Financial entry not found');
    }

    return entry;
  }

  // ===========================================================================
  // PRIVATE — Validation Helpers
  // ===========================================================================

  private async validateCategoryBelongsToTenant(
    tenantId: string,
    categoryId: string,
  ) {
    const category = await this.prisma.financial_category.findFirst({
      where: {
        id: categoryId,
        tenant_id: tenantId,
        is_active: true,
      },
    });

    if (!category) {
      throw new NotFoundException(
        'Financial category not found or inactive',
      );
    }

    return category;
  }

  private validateEntryDateNotFuture(entryDate: string) {
    const date = new Date(entryDate);
    const today = new Date();
    // Compare date-only (strip time)
    today.setHours(23, 59, 59, 999);

    if (date > today) {
      throw new BadRequestException('Entry date cannot be in the future');
    }
  }

  private async validateProjectBelongsToTenant(
    tenantId: string,
    projectId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  private async validateTaskBelongsToTenant(
    tenantId: string,
    taskId: string,
  ): Promise<void> {
    const task = await this.prisma.project_task.findFirst({
      where: { id: taskId, tenant_id: tenantId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
  }

  private async validateSupplierBelongsToTenant(
    tenantId: string,
    supplierId: string,
  ): Promise<void> {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenant_id: tenantId, is_active: true },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found or inactive');
    }
  }

  private async validatePaymentMethodRegistry(
    tenantId: string,
    registryId: string,
  ): Promise<string> {
    const registry = await this.prisma.payment_method_registry.findFirst({
      where: { id: registryId, tenant_id: tenantId, is_active: true },
    });
    if (!registry) {
      throw new NotFoundException('Payment method not found or inactive');
    }
    return registry.type;
  }

  private async validateUserBelongsToTenant(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.prisma.user_tenant_membership.findFirst({
      where: { user_id: userId, tenant_id: tenantId, status: 'ACTIVE' },
    });
    if (!membership) {
      throw new NotFoundException('User not found in this tenant');
    }
  }

  private async validateCrewMemberBelongsToTenant(
    tenantId: string,
    crewMemberId: string,
  ): Promise<void> {
    const member = await this.prisma.crew_member.findFirst({
      where: { id: crewMemberId, tenant_id: tenantId, is_active: true },
    });
    if (!member) {
      throw new NotFoundException('Crew member not found or inactive');
    }
  }

  private validateTaxAmount(amount: number, taxAmount: number): void {
    if (taxAmount >= amount) {
      throw new BadRequestException(
        'Tax amount must be less than the entry amount',
      );
    }
  }

  private validatePurchasedByMutualExclusion(
    userId?: string | null,
    crewMemberId?: string | null,
  ): void {
    if (userId && crewMemberId) {
      throw new BadRequestException(
        'Cannot assign purchase to both a user and a crew member. Provide only one.',
      );
    }
  }

  // ===========================================================================
  // PRIVATE — Shared Filter Builder (Sprint 4_5 — DRY refactor)
  // ===========================================================================

  /**
   * Build the Prisma where clause for financial entries.
   * Shared between getEntries() and exportEntries() to ensure identical filtering.
   * Includes Employee scoping, optional filters, date range, search, and boolean filters.
   */
  private buildEntryWhereClause(
    tenantId: string,
    userId: string,
    userRoles: string[],
    query: ListFinancialEntriesQueryDto,
  ): any {
    const where: any = { tenant_id: tenantId };

    // EMPLOYEE SCOPING — forced, cannot be bypassed
    if (!this.isPrivilegedRole(userRoles)) {
      where.created_by_user_id = userId;
    }

    // Optional filters
    if (query.project_id) where.project_id = query.project_id;
    if (query.task_id) where.task_id = query.task_id;
    if (query.category_id) where.category_id = query.category_id;
    if (query.entry_type) where.entry_type = query.entry_type;
    if (query.supplier_id) where.supplier_id = query.supplier_id;
    if (query.payment_method) where.payment_method = query.payment_method;
    if (query.submission_status) where.submission_status = query.submission_status;
    if (query.purchased_by_user_id) where.purchased_by_user_id = query.purchased_by_user_id;
    if (query.purchased_by_crew_member_id) where.purchased_by_crew_member_id = query.purchased_by_crew_member_id;

    // Category type filter (requires join)
    if (query.category_type) {
      where.category = { ...where.category, type: query.category_type };
    }

    // Classification filter (requires join)
    if (query.classification) {
      where.category = { ...where.category, classification: query.classification };
    }

    // Date range
    if (query.date_from || query.date_to) {
      where.entry_date = {};
      if (query.date_from) where.entry_date.gte = new Date(query.date_from);
      if (query.date_to) where.entry_date.lte = new Date(query.date_to);
    }

    // Boolean filters
    if (query.has_receipt !== undefined) where.has_receipt = query.has_receipt;
    if (query.is_recurring_instance !== undefined) where.is_recurring_instance = query.is_recurring_instance;

    // Search (vendor_name and notes)
    if (query.search) {
      where.OR = [
        { vendor_name: { contains: query.search } },
        { notes: { contains: query.search } },
      ];
    }

    return where;
  }

  // ===========================================================================
  // PRIVATE — CSV Export Helpers (Sprint 4_5)
  // ===========================================================================

  /**
   * Escape a value for safe CSV inclusion.
   * Wraps fields containing commas, quotes, or newlines in double quotes.
   * Escapes internal double quotes by doubling them.
   */
  private escapeCsvField(value: string | null | undefined): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
