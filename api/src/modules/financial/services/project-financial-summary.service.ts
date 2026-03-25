import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  ProjectDateFilterDto,
  ProjectTaskBreakdownQueryDto,
  ProjectReceiptsQueryDto,
  TaskBreakdownSortBy,
  SortOrder,
} from '../dto/project-financial-query.dto';

/** Reusable date range filter shape for Prisma DateTime fields. */
interface DateRangeFilter {
  gte?: Date;
  lte?: Date;
}

@Injectable()
export class ProjectFinancialSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC — Read-Only Aggregation Methods
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Returns a complete financial picture of a project.
   * Runs 6 independent query groups in parallel for optimal performance.
   */
  async getFullSummary(
    tenantId: string,
    projectId: string,
    dateFilter?: ProjectDateFilterDto,
  ) {
    // Step 1: Build date filter condition for financial_entry queries
    const entryDateFilter: DateRangeFilter = {};
    if (dateFilter?.date_from) {
      entryDateFilter.gte = new Date(dateFilter.date_from);
    }
    if (dateFilter?.date_to) {
      entryDateFilter.lte = new Date(dateFilter.date_to);
    }
    const hasDateFilter = Object.keys(entryDateFilter).length > 0;

    // Step 2: Validate project access (tenant isolation guard)
    await this.validateProjectAccess(tenantId, projectId);

    // Step 3: Run 6 independent query groups in parallel
    const [
      projectData,
      costData,
      subcontractorData,
      crewData,
      receiptData,
      revenueData,
    ] = await Promise.all([
      // GROUP 1: Project record with assigned PM
      this.fetchProjectData(tenantId, projectId),
      // GROUP 2: Financial entry aggregations (costs, categories, classification)
      this.fetchCostData(tenantId, projectId, entryDateFilter, hasDateFilter),
      // GROUP 3: Subcontractor invoice + payment aggregations
      this.fetchSubcontractorData(tenantId, projectId),
      // GROUP 4: Crew hours + payment aggregations
      this.fetchCrewData(tenantId, projectId),
      // GROUP 5: Receipt counts (total, categorized, uncategorized)
      this.fetchReceiptData(tenantId, projectId),
      // GROUP 6: Revenue aggregations from project invoices
      this.fetchRevenueData(tenantId, projectId),
    ]);

    // Step 4: Guard against race condition (project deleted between validate and fetch)
    if (!projectData) {
      throw new NotFoundException('Project not found');
    }

    // Step 5: Assemble response
    const contractValue =
      projectData.contract_value !== null
        ? Number(projectData.contract_value)
        : null;
    const estimatedCost =
      projectData.estimated_cost !== null
        ? Number(projectData.estimated_cost)
        : null;

    const actualCostConfirmed = costData.total_expenses;
    const actualCostTotal =
      costData.total_expenses + costData.total_expenses_pending;

    return {
      project: {
        id: projectData.id,
        project_number: projectData.project_number,
        name: projectData.name,
        status: projectData.status,
        progress_percent: Number(projectData.progress_percent),
        start_date: projectData.start_date,
        target_completion_date: projectData.target_completion_date,
        actual_completion_date: projectData.actual_completion_date,
        contract_value: contractValue,
        estimated_cost: estimatedCost,
        assigned_pm: projectData.assigned_pm_user
          ? {
              id: projectData.assigned_pm_user.id,
              first_name: projectData.assigned_pm_user.first_name,
              last_name: projectData.assigned_pm_user.last_name,
            }
          : null,
      },
      cost_summary: {
        total_expenses: costData.total_expenses,
        total_expenses_pending: costData.total_expenses_pending,
        total_tax_paid: costData.total_tax_paid,
        entry_count: costData.entry_count,
        by_category: costData.by_category,
        by_classification: costData.by_classification,
      },
      subcontractor_summary: subcontractorData,
      crew_summary: crewData,
      receipt_summary: receiptData,
      revenue: {
        total_invoiced: revenueData.total_invoiced,
        total_collected: revenueData.total_collected,
        outstanding: revenueData.outstanding,
        invoice_count: revenueData.invoice_count,
        paid_invoices: revenueData.paid_invoices,
        partial_invoices: revenueData.partial_invoices,
        draft_invoices: revenueData.draft_invoices,
      },
      margin_analysis: this.computeMarginAnalysis(
        contractValue,
        estimatedCost,
        actualCostConfirmed,
        actualCostTotal,
        revenueData.total_invoiced,
        revenueData.total_collected,
      ),
    };
  }

  /**
   * Per-task cost breakdown. Shows where money is being spent at the task level.
   * Runs 6 independent queries in parallel to avoid N+1.
   */
  async getTaskBreakdown(
    tenantId: string,
    projectId: string,
    query: ProjectTaskBreakdownQueryDto,
  ) {
    await this.validateProjectAccess(tenantId, projectId);

    // Build date filter for financial entries
    const entryDateFilter: DateRangeFilter = {};
    if (query.date_from) entryDateFilter.gte = new Date(query.date_from);
    if (query.date_to) entryDateFilter.lte = new Date(query.date_to);
    const hasDateFilter = Object.keys(entryDateFilter).length > 0;

    const entryWhere: Prisma.financial_entryWhereInput = {
      tenant_id: tenantId,
      project_id: projectId,
      task_id: { not: null },
      ...(hasDateFilter && { entry_date: entryDateFilter }),
    };

    // Run 6 independent queries in parallel (NOT N+1)
    const [
      tasks,
      expenseGroups,
      taskCategoryBreakdown,
      invoiceGroups,
      hourGroups,
      categories,
    ] = await Promise.all([
      // 1. All project tasks (non-deleted)
      this.prisma.project_task.findMany({
        where: { tenant_id: tenantId, project_id: projectId, deleted_at: null },
        select: {
          id: true,
          title: true,
          status: true,
          order_index: true,
        },
        orderBy: { order_index: 'asc' },
      }),
      // 2. Expenses grouped by task_id (for totals)
      this.prisma.financial_entry.groupBy({
        by: ['task_id'],
        where: entryWhere,
        _sum: { amount: true },
        _count: true,
      }),
      // 3. Expenses grouped by task_id + category_id (for by_category breakdown)
      this.prisma.financial_entry.groupBy({
        by: ['task_id', 'category_id'],
        where: entryWhere,
        _sum: { amount: true },
      }),
      // 4. Subcontractor invoices grouped by task_id
      this.prisma.subcontractor_task_invoice.groupBy({
        by: ['task_id'],
        where: { tenant_id: tenantId, project_id: projectId },
        _sum: { amount: true },
        _count: true,
      }),
      // 5. Crew hours grouped by task_id
      this.prisma.crew_hour_log.groupBy({
        by: ['task_id'],
        where: {
          tenant_id: tenantId,
          project_id: projectId,
          task_id: { not: null },
        },
        _sum: { hours_regular: true, hours_overtime: true },
      }),
      // 6. Category details for by_category breakdown
      this.prisma.financial_category.findMany({
        where: { tenant_id: tenantId },
        select: { id: true, name: true, type: true, classification: true },
      }),
    ]);

    // Build lookup maps
    const expenseMap = new Map(expenseGroups.map((g) => [g.task_id, g]));
    const invoiceMap = new Map(invoiceGroups.map((g) => [g.task_id, g]));
    const hourMap = new Map(hourGroups.map((g) => [g.task_id, g]));
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    // Group category breakdown by task_id
    const taskCatMap = new Map<
      string,
      Array<{ category_id: string; total: number }>
    >();
    for (const row of taskCategoryBreakdown) {
      if (!row.task_id) continue;
      if (!taskCatMap.has(row.task_id)) taskCatMap.set(row.task_id, []);
      taskCatMap.get(row.task_id)!.push({
        category_id: row.category_id,
        total: Number(row._sum.amount ?? 0),
      });
    }

    // Assemble per-task results
    let totalTaskCost = 0;
    const taskResults = tasks.map((task) => {
      const expense = expenseMap.get(task.id);
      const invoice = invoiceMap.get(task.id);
      const hours = hourMap.get(task.id);
      const catBreakdown = taskCatMap.get(task.id) ?? [];

      const expenseTotal = Number(expense?._sum.amount ?? 0);
      totalTaskCost += expenseTotal;

      const regularHours = Number(hours?._sum.hours_regular ?? 0);
      const overtimeHours = Number(hours?._sum.hours_overtime ?? 0);

      return {
        task_id: task.id,
        task_title: task.title,
        task_status: task.status,
        task_order_index: task.order_index,
        expenses: {
          total: expenseTotal,
          by_category: catBreakdown.map((cb) => {
            const cat = categoryMap.get(cb.category_id);
            return {
              category_name: cat?.name ?? 'Unknown',
              category_type: cat?.type ?? 'other',
              classification: cat?.classification ?? 'cost_of_goods_sold',
              total: cb.total,
            };
          }),
          entry_count: expense?._count ?? 0,
        },
        subcontractor_invoices: {
          total_invoiced: Number(invoice?._sum.amount ?? 0),
          invoice_count: invoice?._count ?? 0,
        },
        crew_hours: {
          total_regular_hours: regularHours,
          total_overtime_hours: overtimeHours,
          total_hours: Math.round((regularHours + overtimeHours) * 100) / 100,
        },
      };
    });

    // Sort
    const sortBy = query.sort_by ?? TaskBreakdownSortBy.TOTAL_COST;
    const sortOrder = query.sort_order ?? SortOrder.DESC;

    taskResults.sort((a, b) => {
      let comparison = 0;
      if (sortBy === TaskBreakdownSortBy.TOTAL_COST) {
        comparison = a.expenses.total - b.expenses.total;
      } else {
        comparison = a.task_title.localeCompare(b.task_title);
      }
      return sortOrder === SortOrder.DESC ? -comparison : comparison;
    });

    return {
      project_id: projectId,
      total_task_cost: Math.round(totalTaskCost * 100) / 100,
      tasks: taskResults,
    };
  }

  /**
   * Monthly cost trend. Shows how spending has tracked over time.
   * Zero-fills months without expenses within the date range.
   * Uses UTC date methods because Prisma returns @db.Date fields as midnight UTC.
   */
  async getTimeline(
    tenantId: string,
    projectId: string,
    dateFilter?: ProjectDateFilterDto,
  ) {
    await this.validateProjectAccess(tenantId, projectId);

    // Get project dates for range boundaries
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
      select: { start_date: true, actual_completion_date: true },
    });

    // Determine date range
    let rangeStart: Date;
    let rangeEnd: Date;

    if (dateFilter?.date_from) {
      rangeStart = new Date(dateFilter.date_from);
    } else if (project?.start_date) {
      rangeStart = new Date(project.start_date);
    } else {
      // Fallback: find earliest entry date
      const earliest = await this.prisma.financial_entry.findFirst({
        where: { tenant_id: tenantId, project_id: projectId },
        orderBy: { entry_date: 'asc' },
        select: { entry_date: true },
      });
      rangeStart = earliest?.entry_date ?? new Date();
    }

    if (dateFilter?.date_to) {
      rangeEnd = new Date(dateFilter.date_to);
    } else if (project?.actual_completion_date) {
      rangeEnd = new Date(project.actual_completion_date);
    } else {
      rangeEnd = new Date(); // today
    }

    // Build where clause for entries
    const entryWhere: Prisma.financial_entryWhereInput = {
      tenant_id: tenantId,
      project_id: projectId,
      entry_date: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    };

    // Fetch all entries within range (with category info)
    // Note: Prisma groupBy cannot group by YEAR/MONTH expressions,
    // so we fetch entries and aggregate in JavaScript.
    const entries = await this.prisma.financial_entry.findMany({
      where: entryWhere,
      select: {
        entry_date: true,
        amount: true,
        category: {
          select: { name: true, type: true },
        },
      },
    });

    // Generate all months in range (zero-fill)
    const months: Array<{
      year: number;
      month: number;
      month_label: string;
      total_expenses: number;
      by_category: Array<{
        category_name: string;
        category_type: string;
        total: number;
      }>;
    }> = [];

    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    // IMPORTANT: Use UTC methods because Prisma returns @db.Date fields as midnight UTC.
    // Using local timezone methods (getFullYear/getMonth) would shift dates to the wrong
    // month on servers not running in UTC.
    const startYear = rangeStart.getUTCFullYear();
    const startMonth = rangeStart.getUTCMonth(); // 0-indexed
    const endYear = rangeEnd.getUTCFullYear();
    const endMonth = rangeEnd.getUTCMonth();

    // Build month slots
    let currentYear = startYear;
    let currentMonth = startMonth;
    while (
      currentYear < endYear ||
      (currentYear === endYear && currentMonth <= endMonth)
    ) {
      months.push({
        year: currentYear,
        month: currentMonth + 1, // 1-indexed for response
        month_label: `${monthNames[currentMonth]} ${currentYear}`,
        total_expenses: 0,
        by_category: [],
      });
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
    }

    // Build month index map for O(1) lookup
    const monthIndexMap = new Map<string, number>();
    months.forEach((m, idx) => {
      monthIndexMap.set(`${m.year}-${m.month}`, idx);
    });

    // Aggregate entries into month slots
    const categoryTotals = new Map<
      string,
      Map<string, { name: string; type: string; total: number }>
    >();

    for (const entry of entries) {
      const d = new Date(entry.entry_date);
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth() + 1; // 1-indexed, UTC to match range generation
      const key = `${year}-${month}`;
      const monthIdx = monthIndexMap.get(key);
      if (monthIdx === undefined) continue;

      const amount = Number(entry.amount);
      months[monthIdx].total_expenses += amount;

      // Track by_category per month
      if (!categoryTotals.has(key)) categoryTotals.set(key, new Map());
      const catMap = categoryTotals.get(key)!;
      const catName = entry.category.name;
      if (!catMap.has(catName)) {
        catMap.set(catName, {
          name: entry.category.name,
          type: entry.category.type,
          total: 0,
        });
      }
      catMap.get(catName)!.total += amount;
    }

    // Attach by_category to each month + round totals
    let cumulativeTotal = 0;
    for (const m of months) {
      m.total_expenses = Math.round(m.total_expenses * 100) / 100;
      cumulativeTotal += m.total_expenses;

      const key = `${m.year}-${m.month}`;
      const catMap = categoryTotals.get(key);
      if (catMap) {
        m.by_category = Array.from(catMap.values()).map((c) => ({
          category_name: c.name,
          category_type: c.type,
          total: Math.round(c.total * 100) / 100,
        }));
      }
    }

    return {
      project_id: projectId,
      months,
      cumulative_total: Math.round(cumulativeTotal * 100) / 100,
    };
  }

  /**
   * Paginated list of all receipts attached to the project or its tasks.
   * Joins task titles from a lookup map to avoid N+1 queries.
   */
  async getReceipts(
    tenantId: string,
    projectId: string,
    query: ProjectReceiptsQueryDto,
  ) {
    await this.validateProjectAccess(tenantId, projectId);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    // Get task IDs for this project
    const projectTasks = await this.prisma.project_task.findMany({
      where: { tenant_id: tenantId, project_id: projectId, deleted_at: null },
      select: { id: true, title: true },
    });
    const taskIds = projectTasks.map((t) => t.id);
    const taskTitleMap = new Map(projectTasks.map((t) => [t.id, t.title]));

    // Build where clause
    const where: Prisma.receiptWhereInput = {
      tenant_id: tenantId,
      OR: [
        { project_id: projectId },
        ...(taskIds.length > 0 ? [{ task_id: { in: taskIds } }] : []),
      ],
      ...(query.is_categorized !== undefined && {
        is_categorized: query.is_categorized,
      }),
      ...(query.ocr_status && { ocr_status: query.ocr_status }),
    };

    const [data, total] = await Promise.all([
      this.prisma.receipt.findMany({
        where,
        select: {
          id: true,
          project_id: true,
          task_id: true,
          file_url: true,
          file_name: true,
          file_type: true,
          vendor_name: true,
          amount: true,
          receipt_date: true,
          ocr_status: true,
          ocr_vendor: true,
          ocr_amount: true,
          ocr_date: true,
          is_categorized: true,
          financial_entry_id: true,
          uploaded_by_user: {
            select: { id: true, first_name: true, last_name: true },
          },
          created_at: true,
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.receipt.count({ where }),
    ]);

    // Map response — add task_title from lookup
    const receipts = data.map((r) => ({
      id: r.id,
      project_id: r.project_id,
      task_id: r.task_id,
      task_title: r.task_id ? (taskTitleMap.get(r.task_id) ?? null) : null,
      file_url: r.file_url,
      file_name: r.file_name,
      file_type: r.file_type,
      vendor_name: r.vendor_name,
      amount: r.amount !== null ? Number(r.amount) : null,
      receipt_date: r.receipt_date,
      ocr_status: r.ocr_status,
      ocr_vendor: r.ocr_vendor,
      ocr_amount: r.ocr_amount !== null ? Number(r.ocr_amount) : null,
      ocr_date: r.ocr_date,
      is_categorized: r.is_categorized,
      financial_entry_id: r.financial_entry_id,
      uploaded_by: r.uploaded_by_user
        ? {
            id: r.uploaded_by_user.id,
            first_name: r.uploaded_by_user.first_name,
            last_name: r.uploaded_by_user.last_name,
          }
        : null,
      created_at: r.created_at,
    }));

    return {
      data: receipts,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Consolidated workforce view — crew hours by member, crew payments by member,
   * subcontractor invoices by subcontractor.
   * Uses findMany + JS aggregation (not groupBy) because Prisma groupBy
   * cannot include cross-relation joins.
   */
  async getWorkforceSummary(
    tenantId: string,
    projectId: string,
    dateFilter?: ProjectDateFilterDto,
  ) {
    await this.validateProjectAccess(tenantId, projectId);

    // Date filters apply to respective date fields per sub-section
    const hourDateFilter: DateRangeFilter = {};
    const paymentDateFilter: DateRangeFilter = {};
    if (dateFilter?.date_from) {
      hourDateFilter.gte = new Date(dateFilter.date_from);
      paymentDateFilter.gte = new Date(dateFilter.date_from);
    }
    if (dateFilter?.date_to) {
      hourDateFilter.lte = new Date(dateFilter.date_to);
      paymentDateFilter.lte = new Date(dateFilter.date_to);
    }
    const hasHourDateFilter = Object.keys(hourDateFilter).length > 0;
    const hasPaymentDateFilter = Object.keys(paymentDateFilter).length > 0;

    // Build where clauses
    const hourWhere: Prisma.crew_hour_logWhereInput = {
      tenant_id: tenantId,
      project_id: projectId,
      ...(hasHourDateFilter && { log_date: hourDateFilter }),
    };

    const crewPaymentWhere: Prisma.crew_payment_recordWhereInput = {
      tenant_id: tenantId,
      project_id: projectId,
      ...(hasPaymentDateFilter && { payment_date: paymentDateFilter }),
    };

    // Subcontractor invoices don't have date_from/date_to filtering in this endpoint
    // (the contract applies date filters to log_date and payment_date only)
    const subInvoiceWhere: Prisma.subcontractor_task_invoiceWhereInput = {
      tenant_id: tenantId,
      project_id: projectId,
    };

    const subPaymentWhere: Prisma.subcontractor_payment_recordWhereInput = {
      tenant_id: tenantId,
      project_id: projectId,
      ...(hasPaymentDateFilter && { payment_date: paymentDateFilter }),
    };

    // Fetch all data in parallel
    const [hourLogs, crewPayments, subInvoices, subPayments] =
      await Promise.all([
        // Crew hour logs with crew member info
        this.prisma.crew_hour_log.findMany({
          where: hourWhere,
          select: {
            crew_member_id: true,
            hours_regular: true,
            hours_overtime: true,
            crew_member: {
              select: { id: true, first_name: true, last_name: true },
            },
          },
        }),
        // Crew payments with crew member info
        this.prisma.crew_payment_record.findMany({
          where: crewPaymentWhere,
          select: {
            crew_member_id: true,
            amount: true,
            payment_date: true,
            crew_member: {
              select: { id: true, first_name: true, last_name: true },
            },
          },
        }),
        // Subcontractor invoices with subcontractor info
        this.prisma.subcontractor_task_invoice.findMany({
          where: subInvoiceWhere,
          select: {
            subcontractor_id: true,
            amount: true,
            status: true,
            subcontractor: {
              select: { id: true, business_name: true },
            },
          },
        }),
        // Subcontractor payments with subcontractor info
        this.prisma.subcontractor_payment_record.findMany({
          where: subPaymentWhere,
          select: {
            subcontractor_id: true,
            amount: true,
            subcontractor: {
              select: { id: true, business_name: true },
            },
          },
        }),
      ]);

    // ── Aggregate crew hours by member ──
    const crewHourMap = new Map<
      string,
      {
        crew_member_id: string;
        crew_member_name: string;
        regular_hours: number;
        overtime_hours: number;
        log_count: number;
      }
    >();

    let totalRegularHours = 0;
    let totalOvertimeHours = 0;

    for (const log of hourLogs) {
      const memberId = log.crew_member_id;
      const regular = Number(log.hours_regular);
      const overtime = Number(log.hours_overtime);
      totalRegularHours += regular;
      totalOvertimeHours += overtime;

      if (!crewHourMap.has(memberId)) {
        crewHourMap.set(memberId, {
          crew_member_id: memberId,
          crew_member_name: `${log.crew_member.first_name} ${log.crew_member.last_name}`,
          regular_hours: 0,
          overtime_hours: 0,
          log_count: 0,
        });
      }
      const entry = crewHourMap.get(memberId)!;
      entry.regular_hours += regular;
      entry.overtime_hours += overtime;
      entry.log_count += 1;
    }

    const crewHoursByMember = Array.from(crewHourMap.values()).map((m) => ({
      ...m,
      regular_hours: Math.round(m.regular_hours * 100) / 100,
      overtime_hours: Math.round(m.overtime_hours * 100) / 100,
      total_hours: Math.round((m.regular_hours + m.overtime_hours) * 100) / 100,
    }));

    // ── Aggregate crew payments by member ──
    const crewPaymentMap = new Map<
      string,
      {
        crew_member_id: string;
        crew_member_name: string;
        total_paid: number;
        payment_count: number;
        last_payment_date: Date | null;
      }
    >();

    let totalCrewPaid = 0;

    for (const payment of crewPayments) {
      const memberId = payment.crew_member_id;
      const amount = Number(payment.amount);
      totalCrewPaid += amount;

      if (!crewPaymentMap.has(memberId)) {
        crewPaymentMap.set(memberId, {
          crew_member_id: memberId,
          crew_member_name: `${payment.crew_member.first_name} ${payment.crew_member.last_name}`,
          total_paid: 0,
          payment_count: 0,
          last_payment_date: null,
        });
      }
      const entry = crewPaymentMap.get(memberId)!;
      entry.total_paid += amount;
      entry.payment_count += 1;
      if (
        !entry.last_payment_date ||
        payment.payment_date > entry.last_payment_date
      ) {
        entry.last_payment_date = payment.payment_date;
      }
    }

    const crewPaymentsByMember = Array.from(crewPaymentMap.values()).map(
      (m) => ({
        ...m,
        total_paid: Math.round(m.total_paid * 100) / 100,
      }),
    );

    // ── Aggregate subcontractor invoices + payments by subcontractor ──
    const subMap = new Map<
      string,
      {
        subcontractor_id: string;
        subcontractor_name: string;
        invoiced: number;
        paid: number;
        invoice_count: number;
        pending_invoices: number;
        approved_invoices: number;
        paid_invoices: number;
      }
    >();

    let totalSubInvoiced = 0;

    for (const inv of subInvoices) {
      const subId = inv.subcontractor_id;
      const amount = Number(inv.amount);
      totalSubInvoiced += amount;

      if (!subMap.has(subId)) {
        subMap.set(subId, {
          subcontractor_id: subId,
          subcontractor_name: inv.subcontractor.business_name,
          invoiced: 0,
          paid: 0,
          invoice_count: 0,
          pending_invoices: 0,
          approved_invoices: 0,
          paid_invoices: 0,
        });
      }
      const entry = subMap.get(subId)!;
      entry.invoiced += amount;
      entry.invoice_count += 1;

      // Count by invoice status
      if (inv.status === 'pending') entry.pending_invoices += 1;
      else if (inv.status === 'approved') entry.approved_invoices += 1;
      else if (inv.status === 'paid') entry.paid_invoices += 1;
    }

    let totalSubPaid = 0;

    for (const pay of subPayments) {
      const subId = pay.subcontractor_id;
      const amount = Number(pay.amount);
      totalSubPaid += amount;

      if (!subMap.has(subId)) {
        subMap.set(subId, {
          subcontractor_id: subId,
          subcontractor_name: pay.subcontractor.business_name,
          invoiced: 0,
          paid: 0,
          invoice_count: 0,
          pending_invoices: 0,
          approved_invoices: 0,
          paid_invoices: 0,
        });
      }
      subMap.get(subId)!.paid += amount;
    }

    const subByContractor = Array.from(subMap.values()).map((s) => ({
      ...s,
      invoiced: Math.round(s.invoiced * 100) / 100,
      paid: Math.round(s.paid * 100) / 100,
      outstanding: Math.round((s.invoiced - s.paid) * 100) / 100,
    }));

    return {
      project_id: projectId,
      crew_hours: {
        total_regular_hours: Math.round(totalRegularHours * 100) / 100,
        total_overtime_hours: Math.round(totalOvertimeHours * 100) / 100,
        total_hours:
          Math.round((totalRegularHours + totalOvertimeHours) * 100) / 100,
        by_crew_member: crewHoursByMember,
      },
      crew_payments: {
        total_paid: Math.round(totalCrewPaid * 100) / 100,
        payment_count: crewPayments.length,
        by_crew_member: crewPaymentsByMember,
      },
      subcontractor_invoices: {
        total_invoiced: Math.round(totalSubInvoiced * 100) / 100,
        total_paid: Math.round(totalSubPaid * 100) / 100,
        outstanding: Math.round((totalSubInvoiced - totalSubPaid) * 100) / 100,
        by_subcontractor: subByContractor,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE — Guard Methods
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Validates that a project exists and belongs to the given tenant.
   * Throws NotFoundException if not found — prevents cross-tenant data exposure.
   */
  private async validateProjectAccess(tenantId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        tenant_id: tenantId,
      },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE — Data Fetch Helpers (one per query group)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * GROUP 1: Fetches the project record with assigned PM info.
   */
  private async fetchProjectData(tenantId: string, projectId: string) {
    return this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
      select: {
        id: true,
        project_number: true,
        name: true,
        status: true,
        progress_percent: true,
        start_date: true,
        target_completion_date: true,
        actual_completion_date: true,
        contract_value: true,
        estimated_cost: true,
        assigned_pm_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });
  }

  /**
   * GROUP 2: Aggregates all financial entry data — totals, by_category, by_classification.
   * Only confirmed entries count toward total_expenses.
   * Only pending_review entries count toward total_expenses_pending.
   */
  private async fetchCostData(
    tenantId: string,
    projectId: string,
    entryDateFilter: DateRangeFilter,
    hasDateFilter: boolean,
  ) {
    const baseWhere: Prisma.financial_entryWhereInput = {
      tenant_id: tenantId,
      project_id: projectId,
      ...(hasDateFilter && { entry_date: entryDateFilter }),
    };

    // Run sub-queries in parallel for maximum throughput
    const [
      confirmedAgg,
      pendingAgg,
      taxAgg,
      entryCount,
      categoryBreakdown,
      categories,
    ] = await Promise.all([
      // Total confirmed expenses
      this.prisma.financial_entry.aggregate({
        where: { ...baseWhere, submission_status: 'confirmed' },
        _sum: { amount: true },
      }),
      // Total pending expenses
      this.prisma.financial_entry.aggregate({
        where: { ...baseWhere, submission_status: 'pending_review' },
        _sum: { amount: true },
      }),
      // Total tax paid (all statuses)
      this.prisma.financial_entry.aggregate({
        where: baseWhere,
        _sum: { tax_amount: true },
      }),
      // Total entry count
      this.prisma.financial_entry.count({ where: baseWhere }),
      // Group by category_id for per-category breakdown
      this.prisma.financial_entry.groupBy({
        by: ['category_id'],
        where: baseWhere,
        _sum: { amount: true },
        _count: true,
      }),
      // Fetch all tenant categories for O(1) lookups
      this.prisma.financial_category.findMany({
        where: { tenant_id: tenantId },
        select: {
          id: true,
          name: true,
          type: true,
          classification: true,
        },
      }),
    ]);

    // Build category map for O(1) lookups
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    // Merge category details with aggregation results
    const by_category = categoryBreakdown.map((group) => {
      const cat = categoryMap.get(group.category_id);
      return {
        category_id: group.category_id,
        category_name: cat?.name ?? 'Unknown',
        category_type: cat?.type ?? 'other',
        classification: cat?.classification ?? 'cost_of_goods_sold',
        total: Number(group._sum.amount ?? 0),
        entry_count: group._count,
      };
    });

    // Compute by_classification from by_category data (no extra DB query)
    const by_classification = {
      cost_of_goods_sold: 0,
      operating_expense: 0,
    };
    for (const cat of by_category) {
      if (cat.classification === 'operating_expense') {
        by_classification.operating_expense += cat.total;
      } else {
        by_classification.cost_of_goods_sold += cat.total;
      }
    }

    return {
      total_expenses: Number(confirmedAgg._sum.amount ?? 0),
      total_expenses_pending: Number(pendingAgg._sum.amount ?? 0),
      total_tax_paid: Number(taxAgg._sum.tax_amount ?? 0),
      entry_count: entryCount,
      by_category,
      by_classification: {
        cost_of_goods_sold:
          Math.round(by_classification.cost_of_goods_sold * 100) / 100,
        operating_expense:
          Math.round(by_classification.operating_expense * 100) / 100,
      },
    };
  }

  /**
   * GROUP 3: Aggregates subcontractor invoice amounts and payment amounts.
   */
  private async fetchSubcontractorData(tenantId: string, projectId: string) {
    const [invoiceAgg, paymentAgg] = await Promise.all([
      // Subcontractor invoices for this project
      this.prisma.subcontractor_task_invoice.aggregate({
        where: { tenant_id: tenantId, project_id: projectId },
        _sum: { amount: true },
        _count: true,
      }),
      // Subcontractor payments for this project
      this.prisma.subcontractor_payment_record.aggregate({
        where: { tenant_id: tenantId, project_id: projectId },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const totalInvoiced = Number(invoiceAgg._sum.amount ?? 0);
    const totalPaid = Number(paymentAgg._sum.amount ?? 0);

    return {
      total_invoiced: totalInvoiced,
      total_paid: totalPaid,
      outstanding: Math.round((totalInvoiced - totalPaid) * 100) / 100,
      invoice_count: invoiceAgg._count,
      payment_count: paymentAgg._count,
    };
  }

  /**
   * GROUP 4: Aggregates crew hours and crew payments. Counts distinct crew members.
   */
  private async fetchCrewData(tenantId: string, projectId: string) {
    const [hoursAgg, paymentsAgg, distinctHourMembers, distinctPaymentMembers] =
      await Promise.all([
        // Crew hour totals
        this.prisma.crew_hour_log.aggregate({
          where: { tenant_id: tenantId, project_id: projectId },
          _sum: { hours_regular: true, hours_overtime: true },
        }),
        // Crew payment totals
        this.prisma.crew_payment_record.aggregate({
          where: { tenant_id: tenantId, project_id: projectId },
          _sum: { amount: true },
        }),
        // Distinct crew members with hours on this project
        this.prisma.crew_hour_log.findMany({
          where: { tenant_id: tenantId, project_id: projectId },
          select: { crew_member_id: true },
          distinct: ['crew_member_id'],
        }),
        // Distinct crew members with payments on this project
        this.prisma.crew_payment_record.findMany({
          where: { tenant_id: tenantId, project_id: projectId },
          select: { crew_member_id: true },
          distinct: ['crew_member_id'],
        }),
      ]);

    // Merge distinct crew members from both sources
    const allCrewMemberIds = new Set([
      ...distinctHourMembers.map((m) => m.crew_member_id),
      ...distinctPaymentMembers.map((m) => m.crew_member_id),
    ]);

    const totalRegular = Number(hoursAgg._sum.hours_regular ?? 0);
    const totalOvertime = Number(hoursAgg._sum.hours_overtime ?? 0);

    return {
      total_regular_hours: totalRegular,
      total_overtime_hours: totalOvertime,
      total_hours: Math.round((totalRegular + totalOvertime) * 100) / 100,
      total_crew_payments: Number(paymentsAgg._sum.amount ?? 0),
      crew_member_count: allCrewMemberIds.size,
    };
  }

  /**
   * GROUP 5: Counts receipts — total, categorized, uncategorized.
   * Receipts can be linked to the project directly OR to any of its tasks.
   */
  private async fetchReceiptData(tenantId: string, projectId: string) {
    // Get all task IDs for this project (receipts can be linked to tasks)
    const projectTasks = await this.prisma.project_task.findMany({
      where: { tenant_id: tenantId, project_id: projectId, deleted_at: null },
      select: { id: true },
    });
    const taskIds = projectTasks.map((t) => t.id);

    // Build OR condition: receipt belongs to project directly OR to one of its tasks
    const receiptWhere: Prisma.receiptWhereInput = {
      tenant_id: tenantId,
      OR: [
        { project_id: projectId },
        ...(taskIds.length > 0 ? [{ task_id: { in: taskIds } }] : []),
      ],
    };

    const [total, categorized] = await Promise.all([
      this.prisma.receipt.count({ where: receiptWhere }),
      this.prisma.receipt.count({
        where: { ...receiptWhere, is_categorized: true },
      }),
    ]);

    return {
      total_receipts: total,
      categorized_receipts: categorized,
      uncategorized_receipts: total - categorized,
    };
  }

  /**
   * GROUP 6: Aggregates revenue data from project_invoice tables.
   * Excludes voided invoices from all totals.
   */
  private async fetchRevenueData(tenantId: string, projectId: string) {
    const nonVoidedWhere = {
      tenant_id: tenantId,
      project_id: projectId,
      status: { not: 'voided' as const },
    };

    const [invoiceAgg, invoiceCount, paidCount, partialCount, draftCount] =
      await Promise.all([
        // Sum of amount and amount_paid for non-voided invoices
        this.prisma.project_invoice.aggregate({
          where: nonVoidedWhere,
          _sum: { amount: true, amount_paid: true },
        }),
        // Total count of non-voided invoices
        this.prisma.project_invoice.count({ where: nonVoidedWhere }),
        // Count by status
        this.prisma.project_invoice.count({
          where: { ...nonVoidedWhere, status: 'paid' },
        }),
        this.prisma.project_invoice.count({
          where: { ...nonVoidedWhere, status: 'partial' },
        }),
        this.prisma.project_invoice.count({
          where: { ...nonVoidedWhere, status: 'draft' },
        }),
      ]);

    const totalInvoiced =
      invoiceAgg._sum.amount != null ? Number(invoiceAgg._sum.amount) : 0;
    const totalCollected =
      invoiceAgg._sum.amount_paid != null
        ? Number(invoiceAgg._sum.amount_paid)
        : 0;

    return {
      total_invoiced: Math.round(totalInvoiced * 100) / 100,
      total_collected: Math.round(totalCollected * 100) / 100,
      outstanding: Math.round((totalInvoiced - totalCollected) * 100) / 100,
      invoice_count: invoiceCount,
      paid_invoices: paidCount,
      partial_invoices: partialCount,
      draft_invoices: draftCount,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PRIVATE — Pure Computation Helpers (no DB queries)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Computes margin analysis with full null safety.
   * Never returns NaN. Never divides by zero.
   *
   * - actual_cost_confirmed = confirmed entries only
   * - actual_cost_total = confirmed + pending entries
   * - cost_variance positive = over budget, negative = under budget
   * - gross_margin = contract_value - total_collected (revenue-side)
   * - billing_coverage = (total_invoiced / contract_value) * 100 (% of contract invoiced)
   */
  private computeMarginAnalysis(
    contractValue: number | null,
    estimatedCost: number | null,
    actualCostConfirmed: number,
    actualCostTotal: number,
    totalInvoiced: number,
    totalCollected: number,
  ) {
    const estimated_margin =
      contractValue !== null && estimatedCost !== null
        ? Math.round((contractValue - estimatedCost) * 100) / 100
        : null;

    const actual_margin =
      contractValue !== null
        ? Math.round((contractValue - actualCostConfirmed) * 100) / 100
        : null;

    const cost_variance =
      estimatedCost !== null
        ? Math.round((actualCostConfirmed - estimatedCost) * 100) / 100
        : null;

    // margin_percent: null if contract_value is null or zero (no divide by zero)
    let margin_percent: number | null = null;
    if (
      contractValue !== null &&
      contractValue !== 0 &&
      actual_margin !== null
    ) {
      margin_percent =
        Math.round((actual_margin / contractValue) * 10000) / 100;
    }

    // gross_margin: contract_value - total_collected (only when both exist)
    const gross_margin =
      contractValue !== null && totalCollected > 0
        ? Math.round((contractValue - totalCollected) * 100) / 100
        : null;

    // billing_coverage: (total_invoiced / contract_value) * 100 — % of contract invoiced
    const billing_coverage =
      contractValue !== null && contractValue > 0
        ? Math.round((totalInvoiced / contractValue) * 10000) / 100
        : null;

    return {
      contract_value: contractValue,
      estimated_cost: estimatedCost,
      actual_cost_confirmed: actualCostConfirmed,
      actual_cost_total: actualCostTotal,
      estimated_margin,
      actual_margin,
      cost_variance,
      margin_percent,
      gross_margin,
      billing_coverage,
    };
  }
}
