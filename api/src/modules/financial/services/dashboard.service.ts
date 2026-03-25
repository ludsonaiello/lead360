import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { RecurringExpenseService } from './recurring-expense.service';

@Injectable()
export class DashboardService {
  private readonly monthLabels = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly recurringExpenseService: RecurringExpenseService,
  ) {}

  // ==========================================================================
  // Public — getPL()
  // ==========================================================================

  async getPL(
    tenantId: string,
    year: number,
    month?: number,
    includePending?: boolean,
  ) {
    const months: number[] = month
      ? [month]
      : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    const monthlyData = await Promise.all(
      months.map((m) =>
        this.calculateMonthPL(tenantId, year, m, includePending),
      ),
    );

    // Compute totals across all months (JavaScript reduce — NOT a DB query)
    const totalIncome = monthlyData.reduce((s, m) => s + m.income.total, 0);
    const totalExpenses = monthlyData.reduce((s, m) => s + m.expenses.total, 0);
    const totalGrossProfit = monthlyData.reduce(
      (s, m) => s + m.gross_profit,
      0,
    );
    const totalOperatingProfit = monthlyData.reduce(
      (s, m) => s + m.operating_profit,
      0,
    );
    const totalTaxCollected = monthlyData.reduce(
      (s, m) => s + m.tax.tax_collected,
      0,
    );
    const totalTaxPaid = monthlyData.reduce(
      (s, m) => s + m.tax.tax_paid,
      0,
    );

    // Best / worst month by net_profit
    let bestMonth = { month_label: monthlyData[0].month_label, net_profit: monthlyData[0].net_profit };
    let worstMonth = { month_label: monthlyData[0].month_label, net_profit: monthlyData[0].net_profit };

    for (const md of monthlyData) {
      if (md.net_profit > bestMonth.net_profit) {
        bestMonth = { month_label: md.month_label, net_profit: md.net_profit };
      }
      if (md.net_profit < worstMonth.net_profit) {
        worstMonth = { month_label: md.month_label, net_profit: md.net_profit };
      }
    }

    const totals = {
      total_income: this.toNum(totalIncome),
      total_expenses: this.toNum(totalExpenses),
      total_gross_profit: this.toNum(totalGrossProfit),
      total_operating_profit: this.toNum(totalOperatingProfit),
      total_tax_collected: this.toNum(totalTaxCollected),
      total_tax_paid: this.toNum(totalTaxPaid),
      avg_monthly_income: this.toNum(totalIncome / months.length),
      avg_monthly_expenses: this.toNum(totalExpenses / months.length),
      best_month: bestMonth,
      worst_month: worstMonth,
    };

    return {
      year,
      period: month ? 'single_month' : 'monthly',
      currency: 'USD',
      months: monthlyData,
      totals,
    };
  }

  // ==========================================================================
  // Private — calculateMonthPL()
  // ==========================================================================

  private async calculateMonthPL(
    tenantId: string,
    year: number,
    month: number,
    includePending?: boolean,
  ) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 1);
    const monthLabel = `${this.monthLabels[month - 1]} ${year}`;

    // Run all 10 independent queries in parallel
    const [
      incomeTotal,
      invoiceCount,
      byProject,
      expenseTotal,
      expenseWithPending,
      taxPaid,
      cogsTotal,
      opexTotal,
      byCategoryRaw,
      topSuppliersRaw,
    ] = await Promise.all([
      // Query 1 — Total income (sum of payments received this month)
      this.prisma.project_invoice_payment.aggregate({
        _sum: { amount: true },
        where: {
          tenant_id: tenantId,
          payment_date: { gte: monthStart, lt: monthEnd },
        },
      }),

      // Query 2 — Invoice count (unique invoices that received payment)
      this.prisma.project_invoice_payment.findMany({
        where: {
          tenant_id: tenantId,
          payment_date: { gte: monthStart, lt: monthEnd },
        },
        select: { invoice_id: true },
        distinct: ['invoice_id'],
      }),

      // Query 3 — Income by project
      this.prisma.project_invoice_payment.groupBy({
        by: ['project_id'],
        _sum: { amount: true },
        where: {
          tenant_id: tenantId,
          payment_date: { gte: monthStart, lt: monthEnd },
        },
      }),

      // Query 4 — Total expenses (confirmed only)
      this.prisma.financial_entry.aggregate({
        _sum: { amount: true },
        where: {
          tenant_id: tenantId,
          entry_date: { gte: monthStart, lt: monthEnd },
          submission_status: 'confirmed',
        },
      }),

      // Query 5 — Total expenses with pending (confirmed + pending_review)
      // Only runs the combined query when includePending is true; otherwise returns null
      // so total_with_pending falls back to the confirmed-only total
      includePending
        ? this.prisma.financial_entry.aggregate({
            _sum: { amount: true },
            where: {
              tenant_id: tenantId,
              entry_date: { gte: monthStart, lt: monthEnd },
              submission_status: { in: ['confirmed', 'pending_review'] },
            },
          })
        : Promise.resolve({ _sum: { amount: null } }),

      // Query 6 — Tax paid on expenses
      this.prisma.financial_entry.aggregate({
        _sum: { tax_amount: true },
        where: {
          tenant_id: tenantId,
          entry_date: { gte: monthStart, lt: monthEnd },
          submission_status: 'confirmed',
        },
      }),

      // Query 7 — COGS total (cost_of_goods_sold classification)
      this.prisma.financial_entry.aggregate({
        _sum: { amount: true },
        where: {
          tenant_id: tenantId,
          entry_date: { gte: monthStart, lt: monthEnd },
          submission_status: 'confirmed',
          category: { classification: 'cost_of_goods_sold' },
        },
      }),

      // Query 8 — Operating expense total
      this.prisma.financial_entry.aggregate({
        _sum: { amount: true },
        where: {
          tenant_id: tenantId,
          entry_date: { gte: monthStart, lt: monthEnd },
          submission_status: 'confirmed',
          category: { classification: 'operating_expense' },
        },
      }),

      // Query 9 — Expenses grouped by category
      this.prisma.financial_entry.groupBy({
        by: ['category_id'],
        _sum: { amount: true },
        _count: { id: true },
        where: {
          tenant_id: tenantId,
          entry_date: { gte: monthStart, lt: monthEnd },
          submission_status: 'confirmed',
        },
      }),

      // Query 10 — Top 5 suppliers by spend
      this.prisma.financial_entry.groupBy({
        by: ['vendor_name'],
        _sum: { amount: true },
        _count: { id: true },
        where: {
          tenant_id: tenantId,
          entry_date: { gte: monthStart, lt: monthEnd },
          submission_status: 'confirmed',
          vendor_name: { not: null },
        },
        orderBy: { _sum: { amount: 'desc' } },
        take: 5,
      }),
    ]);

    // -----------------------------------------------------------------------
    // Post-parallel processing
    // -----------------------------------------------------------------------

    // Fetch project names for income by-project breakdown
    const projectIds = byProject.map((p) => p.project_id);
    const projects =
      projectIds.length > 0
        ? await this.prisma.project.findMany({
            where: { id: { in: projectIds }, tenant_id: tenantId },
            select: { id: true, name: true, project_number: true },
          })
        : [];

    const projectMap = new Map(projects.map((p) => [p.id, p]));
    const incomeByProject = byProject.map((p) => ({
      project_id: p.project_id,
      project_name: projectMap.get(p.project_id)?.name ?? 'Unknown',
      project_number: projectMap.get(p.project_id)?.project_number ?? '',
      collected: this.toNum(p._sum.amount),
    }));

    // Fetch category details for by-category breakdown
    const categoryIds = byCategoryRaw.map((c) => c.category_id);
    const categories =
      categoryIds.length > 0
        ? await this.prisma.financial_category.findMany({
            where: { id: { in: categoryIds }, tenant_id: tenantId },
            select: { id: true, name: true, type: true, classification: true },
          })
        : [];

    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const byCategory = byCategoryRaw.map((c) => ({
      category_id: c.category_id,
      category_name: categoryMap.get(c.category_id)?.name ?? 'Unknown',
      category_type: categoryMap.get(c.category_id)?.type ?? 'unknown',
      classification:
        categoryMap.get(c.category_id)?.classification ?? 'unknown',
      total: this.toNum(c._sum.amount),
      entry_count: c._count.id,
    }));

    // Map top suppliers
    const topSuppliers = topSuppliersRaw.map((s) => ({
      supplier_id: null as string | null,
      supplier_name: s.vendor_name ?? 'Unknown',
      total: this.toNum(s._sum.amount),
      transaction_count: s._count.id,
    }));

    // Query 11 — Tax collected (reuse invoiceCount result from Query 2)
    const taxCollected =
      invoiceCount.length > 0
        ? await this.prisma.project_invoice.aggregate({
            _sum: { tax_amount: true },
            where: {
              id: { in: invoiceCount.map((p) => p.invoice_id) },
              tenant_id: tenantId,
            },
          })
        : { _sum: { tax_amount: null } };

    // -----------------------------------------------------------------------
    // Monetary values
    // -----------------------------------------------------------------------
    const incomeTotalNum = this.toNum(incomeTotal._sum.amount);
    const expenseTotalNum = this.toNum(expenseTotal._sum.amount);
    const expenseWithPendingNum = includePending
      ? this.toNum(expenseWithPending._sum.amount)
      : expenseTotalNum;
    const taxPaidNum = this.toNum(taxPaid._sum.tax_amount);
    const cogsTotalNum = this.toNum(cogsTotal._sum.amount);
    const opexTotalNum = this.toNum(opexTotal._sum.amount);
    const taxCollectedNum = this.toNum(taxCollected._sum.tax_amount);

    // -----------------------------------------------------------------------
    // Profit calculations
    // -----------------------------------------------------------------------
    const grossProfit = this.toNum(incomeTotalNum - cogsTotalNum);
    const operatingProfit = this.toNum(grossProfit - opexTotalNum);
    const netProfit = operatingProfit; // same for now — no separate tax line deduction

    const grossMarginPercent =
      incomeTotalNum > 0
        ? Number(((grossProfit / incomeTotalNum) * 100).toFixed(2))
        : null;

    const netTaxPosition = this.toNum(taxCollectedNum - taxPaidNum);

    return {
      year,
      month,
      month_label: monthLabel,
      income: {
        total: incomeTotalNum,
        invoice_count: invoiceCount.length,
        by_project: incomeByProject,
      },
      expenses: {
        total: expenseTotalNum,
        total_with_pending: expenseWithPendingNum,
        total_tax_paid: taxPaidNum,
        by_classification: {
          cost_of_goods_sold: cogsTotalNum,
          operating_expense: opexTotalNum,
        },
        by_category: byCategory,
        top_suppliers: topSuppliers,
      },
      gross_profit: grossProfit,
      operating_profit: operatingProfit,
      net_profit: netProfit,
      gross_margin_percent: grossMarginPercent,
      tax: {
        tax_collected: taxCollectedNum,
        tax_paid: taxPaidNum,
        net_tax_position: netTaxPosition,
      },
    };
  }

  // ==========================================================================
  // Public — getAR() — Accounts Receivable
  // ==========================================================================

  async getAR(
    tenantId: string,
    query: { status?: string; overdue_only?: boolean },
  ) {
    // Step 1 — Build the where clause (voided is ALWAYS excluded — BR-AR3)
    const where: any = {
      tenant_id: tenantId,
      status: { not: 'voided' },
    };

    // Apply status filter only if provided AND not 'voided'
    if (query.status && query.status !== 'voided') {
      where.status = query.status;
    }

    // Step 2 — Fetch all matching invoices with project details
    const invoices = await this.prisma.project_invoice.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true, project_number: true },
        },
      },
      orderBy: [{ due_date: 'asc' }],
    });

    // Step 3 — Compute today's date (midnight-normalized)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Step 4 — Map invoices to processed array with computed fields
    const processedInvoices = invoices.map((invoice) => {
      const amountDue = this.toNum(invoice.amount_due);
      const dueDate = invoice.due_date ? new Date(invoice.due_date) : null;

      // days_outstanding: days since sent (null if not sent) — BR-AR6
      const daysOutstanding = invoice.sent_at
        ? Math.floor(
            (today.getTime() - new Date(invoice.sent_at).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : null;

      // is_overdue: past due_date and has amount_due > 0
      const isOverdue = dueDate !== null && dueDate < today && amountDue > 0;

      // days_overdue: null if not overdue — BR-AR7
      const daysOverdue = isOverdue
        ? Math.floor(
            (today.getTime() - dueDate!.getTime()) / (1000 * 60 * 60 * 24),
          )
        : null;

      return {
        ...invoice,
        amountDue,
        dueDate,
        daysOutstanding,
        isOverdue,
        daysOverdue,
      };
    });

    // Step 5 — Assign aging buckets (based on due_date — BR-AR1)
    const agingBuckets = {
      current: 0,
      days_1_30: 0,
      days_31_60: 0,
      days_61_90: 0,
      days_over_90: 0,
    };

    for (const inv of processedInvoices) {
      if (inv.amountDue <= 0) continue;

      // BR-AR2: No due_date or not yet due → current
      if (inv.dueDate === null || inv.dueDate >= today) {
        agingBuckets.current += inv.amountDue;
      } else if (inv.daysOverdue! <= 30) {
        agingBuckets.days_1_30 += inv.amountDue;
      } else if (inv.daysOverdue! <= 60) {
        agingBuckets.days_31_60 += inv.amountDue;
      } else if (inv.daysOverdue! <= 90) {
        agingBuckets.days_61_90 += inv.amountDue;
      } else {
        agingBuckets.days_over_90 += inv.amountDue;
      }
    }

    // Step 6 — Compute summary (across ALL non-voided invoices)
    const invoicesWithBalance = processedInvoices.filter(
      (i) => i.amountDue > 0,
    );
    const overdueInvoices = processedInvoices.filter((i) => i.isOverdue);

    const summary = {
      total_invoiced: this.toNum(
        processedInvoices.reduce((sum, i) => sum + this.toNum(i.amount), 0),
      ),
      total_collected: this.toNum(
        processedInvoices.reduce(
          (sum, i) => sum + this.toNum(i.amount_paid),
          0,
        ),
      ),
      total_outstanding: this.toNum(
        invoicesWithBalance.reduce((sum, i) => sum + i.amountDue, 0),
      ),
      total_overdue: this.toNum(
        overdueInvoices.reduce((sum, i) => sum + i.amountDue, 0),
      ),
      invoice_count: invoicesWithBalance.length,
      overdue_count: overdueInvoices.length,
      avg_days_outstanding: (() => {
        const withDaysOutstanding = invoicesWithBalance.filter(
          (i) => i.daysOutstanding !== null,
        );
        if (withDaysOutstanding.length === 0) return 0;
        const totalDays = withDaysOutstanding.reduce(
          (sum, i) => sum + i.daysOutstanding!,
          0,
        );
        return this.toNum(totalDays / withDaysOutstanding.length);
      })(),
    };

    // Step 7 — Apply overdue_only filter AFTER computing summary — BR-AR4
    let invoiceList = processedInvoices.filter((i) => i.amountDue > 0);
    if (query.overdue_only) {
      invoiceList = invoiceList.filter((i) => i.isOverdue);
    }

    // Step 8 — Sort: days_overdue DESC, then amount_due DESC — BR-AR5
    invoiceList.sort((a, b) => {
      const aOverdue = a.daysOverdue ?? -1;
      const bOverdue = b.daysOverdue ?? -1;
      if (bOverdue !== aOverdue) return bOverdue - aOverdue;
      return b.amountDue - a.amountDue;
    });

    // Step 9 — Return response
    return {
      summary,
      aging_buckets: {
        current: this.toNum(agingBuckets.current),
        days_1_30: this.toNum(agingBuckets.days_1_30),
        days_31_60: this.toNum(agingBuckets.days_31_60),
        days_61_90: this.toNum(agingBuckets.days_61_90),
        days_over_90: this.toNum(agingBuckets.days_over_90),
      },
      invoices: invoiceList.map((inv) => ({
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        project_id: inv.project_id,
        project_name: inv.project?.name ?? '',
        project_number: inv.project?.project_number ?? '',
        amount: this.toNum(inv.amount),
        amount_paid: this.toNum(inv.amount_paid),
        amount_due: this.toNum(inv.amount_due),
        status: inv.status,
        due_date: inv.due_date,
        days_outstanding: inv.daysOutstanding,
        days_overdue: inv.daysOverdue,
        is_overdue: inv.isOverdue,
      })),
    };
  }

  // ==========================================================================
  // Public — getAP() — Accounts Payable
  // ==========================================================================

  async getAP(tenantId: string, daysAhead: number = 30) {
    // Step 1 — Run all independent queries in parallel
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonthStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
    );
    const currentMonthEnd = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      1,
    );

    const [subInvoicesRaw, recurringPreview, crewHoursData, crewMemberCount] =
      await Promise.all([
        // Subcontractor invoices (pending + approved) — BR-AP1
        this.prisma.subcontractor_task_invoice.findMany({
          where: {
            tenant_id: tenantId,
            status: { in: ['pending', 'approved'] },
          },
          include: {
            subcontractor: {
              select: { id: true, business_name: true },
            },
          },
        }),

        // Recurring expense preview — BR-AP4
        this.recurringExpenseService.getPreview(tenantId, daysAhead),

        // Crew hours this month
        this.prisma.crew_hour_log.aggregate({
          _sum: {
            hours_regular: true,
            hours_overtime: true,
          },
          where: {
            tenant_id: tenantId,
            log_date: { gte: currentMonthStart, lt: currentMonthEnd },
          },
        }),

        // Unique crew members with hours this month
        this.prisma.crew_hour_log.findMany({
          where: {
            tenant_id: tenantId,
            log_date: { gte: currentMonthStart, lt: currentMonthEnd },
          },
          select: { crew_member_id: true },
          distinct: ['crew_member_id'],
        }),
      ]);

    // Step 2 — Process subcontractor invoices grouped by subcontractor
    const subByContractor = new Map<
      string,
      {
        subcontractor_id: string;
        subcontractor_name: string;
        pending_amount: number;
        approved_amount: number;
        outstanding: number;
        oldest_invoice_date: Date | null;
      }
    >();

    for (const inv of subInvoicesRaw) {
      const subId = inv.subcontractor_id;
      const existing = subByContractor.get(subId) || {
        subcontractor_id: subId,
        subcontractor_name:
          inv.subcontractor?.business_name ?? 'Unknown Subcontractor',
        pending_amount: 0,
        approved_amount: 0,
        outstanding: 0,
        oldest_invoice_date: null,
      };

      const amount = this.toNum(inv.amount);
      if (inv.status === 'pending') {
        existing.pending_amount += amount;
      } else if (inv.status === 'approved') {
        existing.approved_amount += amount;
      }
      existing.outstanding = existing.pending_amount + existing.approved_amount;

      // Track oldest invoice date
      if (inv.invoice_date || inv.created_at) {
        const invoiceDate = inv.invoice_date
          ? new Date(inv.invoice_date)
          : new Date(inv.created_at);
        if (
          !existing.oldest_invoice_date ||
          invoiceDate < existing.oldest_invoice_date
        ) {
          existing.oldest_invoice_date = invoiceDate;
        }
      }

      subByContractor.set(subId, existing);
    }

    // Step 3 — Compute subcontractor summary
    const subValues = Array.from(subByContractor.values());
    const subInvoices = {
      total_pending: subValues.reduce((sum, s) => sum + s.pending_amount, 0),
      total_approved: subValues.reduce((sum, s) => sum + s.approved_amount, 0),
      total_outstanding: subValues.reduce((sum, s) => sum + s.outstanding, 0),
      invoice_count: subInvoicesRaw.length,
      by_subcontractor: subValues,
    };

    // Step 4 — Process recurring preview occurrences
    const recurringUpcoming = recurringPreview.occurrences.map((occ) => {
      const dueDate = new Date(occ.due_date);
      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        rule_id: occ.rule_id,
        rule_name: occ.rule_name,
        amount: this.toNum(occ.amount),
        due_date: occ.due_date,
        frequency: occ.frequency,
        supplier_name: occ.supplier_name ?? null,
        category_name: occ.category_name,
        days_until_due: daysUntilDue,
      };
    });

    // Step 5 — Build AP summary — BR-AP2, BR-AP5
    const summary = {
      subcontractor_outstanding: this.toNum(subInvoices.total_outstanding),
      crew_unpaid_estimate: 0, // BR-AP2: Always 0 — no hourly rate data available yet
      recurring_upcoming: this.toNum(recurringPreview.total_obligations),
      total_ap_estimate: this.toNum(
        subInvoices.total_outstanding +
          this.toNum(recurringPreview.total_obligations),
      ),
    };

    // Step 6 — Return response
    return {
      summary,
      subcontractor_invoices: {
        total_pending: this.toNum(subInvoices.total_pending),
        total_approved: this.toNum(subInvoices.total_approved),
        total_outstanding: this.toNum(subInvoices.total_outstanding),
        invoice_count: subInvoices.invoice_count,
        by_subcontractor: subInvoices.by_subcontractor.map((s) => ({
          subcontractor_id: s.subcontractor_id,
          subcontractor_name: s.subcontractor_name,
          pending_amount: this.toNum(s.pending_amount),
          approved_amount: this.toNum(s.approved_amount),
          outstanding: this.toNum(s.outstanding),
          oldest_invoice_date: s.oldest_invoice_date,
        })),
      },
      recurring_upcoming: recurringUpcoming,
      crew_hours_summary: {
        // BR-AP3: Note text MUST be included exactly as specified
        note: 'Crew payment estimates require hourly rates to be configured. This section shows hours only.',
        total_regular_hours_this_month: this.toNum(
          crewHoursData._sum.hours_regular,
        ),
        total_overtime_hours_this_month: this.toNum(
          crewHoursData._sum.hours_overtime,
        ),
        crew_member_count: crewMemberCount.length,
      },
    };
  }

  // ==========================================================================
  // Public — getForecast() — Cash Flow Forecasting
  // ==========================================================================

  async getForecast(tenantId: string, days: number) {
    // Step 1 — Calculate date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const forecastEnd = new Date(today);
    forecastEnd.setDate(forecastEnd.getDate() + days);

    // Step 2 — Run inflow and outflow queries in parallel
    const [inflowInvoices, outflowPreview] = await Promise.all([
      // Expected inflows: invoices with due_date in period and amount_due > 0
      this.prisma.project_invoice.findMany({
        where: {
          tenant_id: tenantId,
          due_date: { gte: today, lte: forecastEnd },
          amount_due: { gt: 0 },
          status: { not: 'voided' },
        },
        include: {
          project: { select: { name: true } },
        },
        orderBy: { due_date: 'asc' },
      }),
      // Expected outflows: from recurring expense preview (BR-F2)
      this.recurringExpenseService.getPreview(tenantId, days),
    ]);

    // Step 3 — Process inflows
    const inflowItems = inflowInvoices.map((inv) => {
      const dueDate = new Date(inv.due_date!);
      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        type: 'invoice_due' as const,
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        project_name: inv.project?.name ?? '',
        amount_due: this.toNum(inv.amount_due),
        due_date: inv.due_date,
        days_until_due: daysUntilDue,
      };
    });

    const totalInflows = inflowItems.reduce(
      (sum, item) => sum + item.amount_due,
      0,
    );

    // Step 4 — Process outflows
    const outflowItems = outflowPreview.occurrences.map((occ) => {
      const dueDate = new Date(occ.due_date);
      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        type: 'recurring_expense' as const,
        rule_id: occ.rule_id,
        rule_name: occ.rule_name,
        amount: this.toNum(occ.amount),
        due_date: occ.due_date,
        days_until_due: daysUntilDue,
        supplier_name: occ.supplier_name ?? null,
        category_name: occ.category_name,
      };
    });

    const totalOutflows = outflowItems.reduce(
      (sum, item) => sum + item.amount,
      0,
    );

    // Step 5 — Calculate net forecast (BR-F3)
    const netForecast = this.toNum(totalInflows - totalOutflows);

    let netForecastLabel: 'Positive' | 'Negative' | 'Breakeven';
    if (netForecast > 100) {
      netForecastLabel = 'Positive';
    } else if (netForecast < -100) {
      netForecastLabel = 'Negative';
    } else {
      netForecastLabel = 'Breakeven';
    }

    // Step 6 — Return response
    return {
      period_days: days,
      forecast_start: today,
      forecast_end: forecastEnd,
      expected_inflows: {
        total: this.toNum(totalInflows),
        items: inflowItems,
      },
      expected_outflows: {
        total: this.toNum(totalOutflows),
        items: outflowItems,
      },
      net_forecast: netForecast,
      net_forecast_label: netForecastLabel,
    };
  }

  // ==========================================================================
  // Public — getAlerts() — Financial Health Alerts
  // ==========================================================================

  async getAlerts(tenantId: string) {
    // Alert item type — used throughout this method
    type AlertItem = {
      id: string;
      type: string;
      severity: 'critical' | 'warning' | 'info';
      title: string;
      message: string;
      entity_type: string;
      entity_id: string;
      entity_name: string;
      amount: number | null;
      action_url: string | null;
      created_at: Date;
    };

    // Step 1 — Compute today and threshold dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const threeDaysFromNow = new Date(today);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    // Step 2 — Run all independent queries in parallel
    const [
      allOverdueInvoices,
      pendingSubs,
      dueSoonRules,
      overdueRules,
      pendingReviewCount,
      candidateProjects,
    ] = await Promise.all([
      // All overdue invoices — single query, split by duration in memory (BR-A1, BR-A2)
      this.prisma.project_invoice.findMany({
        where: {
          tenant_id: tenantId,
          due_date: { lt: today },
          amount_due: { gt: 0 },
          status: { notIn: ['voided', 'paid'] },
        },
        include: {
          project: { select: { name: true } },
        },
      }),

      // Subcontractor invoices pending > 7 days
      this.prisma.subcontractor_task_invoice.findMany({
        where: {
          tenant_id: tenantId,
          status: 'pending',
          created_at: { lt: sevenDaysAgo },
        },
        include: {
          subcontractor: { select: { id: true, business_name: true } },
        },
      }),

      // Recurring rules due within 3 days (BR-A8)
      this.prisma.recurring_expense_rule.findMany({
        where: {
          tenant_id: tenantId,
          status: 'active',
          next_due_date: { gte: today, lte: threeDaysFromNow },
        },
      }),

      // Recurring rules overdue (BR-A9)
      this.prisma.recurring_expense_rule.findMany({
        where: {
          tenant_id: tenantId,
          status: 'active',
          next_due_date: { lt: today },
        },
      }),

      // Expenses pending review count (BR-A6)
      this.prisma.financial_entry.count({
        where: {
          tenant_id: tenantId,
          submission_status: 'pending_review',
        },
      }),

      // Projects in_progress with 50%+ completion — candidates for no-invoice alert (BR-A7)
      this.prisma.project.findMany({
        where: {
          tenant_id: tenantId,
          status: 'in_progress',
          progress_percent: { gte: 50 },
        },
        select: {
          id: true,
          name: true,
          project_number: true,
          progress_percent: true,
        },
      }),
    ]);

    // -----------------------------------------------------------------------
    // Split overdue invoices by duration for deduplication (BR-A1, BR-A2)
    // -----------------------------------------------------------------------
    const overdue60: Array<{
      inv: (typeof allOverdueInvoices)[0];
      daysOverdue: number;
    }> = [];
    const overdue30: Array<{
      inv: (typeof allOverdueInvoices)[0];
      daysOverdue: number;
    }> = [];
    const overdueBasic: Array<{
      inv: (typeof allOverdueInvoices)[0];
      daysOverdue: number;
    }> = [];

    for (const inv of allOverdueInvoices) {
      const dueDate = new Date(inv.due_date!);
      const daysOverdue = Math.floor(
        (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysOverdue >= 60) {
        overdue60.push({ inv, daysOverdue });
      } else if (daysOverdue >= 30) {
        overdue30.push({ inv, daysOverdue });
      } else {
        overdueBasic.push({ inv, daysOverdue });
      }
    }

    // -----------------------------------------------------------------------
    // Build alert objects for each type
    // -----------------------------------------------------------------------

    // invoice_overdue_60 — critical
    const invoiceAlerts60: AlertItem[] = overdue60.map(
      ({ inv, daysOverdue }) => ({
        id: `invoice_overdue_60_${inv.id}`,
        type: 'invoice_overdue_60',
        severity: 'critical',
        title: `Invoice ${inv.invoice_number} is 60+ days overdue`,
        message: `Invoice ${inv.invoice_number} for project "${inv.project?.name}" is ${daysOverdue} days past due with $${this.toNum(inv.amount_due)} outstanding.`,
        entity_type: 'invoice',
        entity_id: inv.id,
        entity_name: inv.invoice_number,
        amount: this.toNum(inv.amount_due),
        action_url: `/projects/${inv.project_id}/invoices/${inv.id}`,
        created_at: inv.due_date!,
      }),
    );

    // invoice_overdue_30 — warning
    const invoiceAlerts30: AlertItem[] = overdue30.map(
      ({ inv, daysOverdue }) => ({
        id: `invoice_overdue_30_${inv.id}`,
        type: 'invoice_overdue_30',
        severity: 'warning',
        title: `Invoice ${inv.invoice_number} is 30+ days overdue`,
        message: `Invoice ${inv.invoice_number} is ${daysOverdue} days past due with $${this.toNum(inv.amount_due)} outstanding.`,
        entity_type: 'invoice',
        entity_id: inv.id,
        entity_name: inv.invoice_number,
        amount: this.toNum(inv.amount_due),
        action_url: `/projects/${inv.project_id}/invoices/${inv.id}`,
        created_at: inv.due_date!,
      }),
    );

    // invoice_overdue (basic <30 days) — critical
    const invoiceAlertsBasic: AlertItem[] = overdueBasic.map(
      ({ inv, daysOverdue }) => ({
        id: `invoice_overdue_${inv.id}`,
        type: 'invoice_overdue',
        severity: 'critical',
        title: `Invoice ${inv.invoice_number} is overdue`,
        message: `Invoice ${inv.invoice_number} is ${daysOverdue} days past due with $${this.toNum(inv.amount_due)} outstanding.`,
        entity_type: 'invoice',
        entity_id: inv.id,
        entity_name: inv.invoice_number,
        amount: this.toNum(inv.amount_due),
        action_url: `/projects/${inv.project_id}/invoices/${inv.id}`,
        created_at: inv.due_date!,
      }),
    );

    // sub_invoice_pending — warning
    // NOTE: Schema uses business_name (not first_name/last_name as sprint spec shows)
    const subInvoiceAlerts: AlertItem[] = pendingSubs.map((inv) => ({
      id: `sub_invoice_pending_${inv.id}`,
      type: 'sub_invoice_pending',
      severity: 'warning',
      title: `Subcontractor invoice from ${inv.subcontractor?.business_name ?? 'Unknown'} awaiting approval`,
      message: `Invoice for $${this.toNum(inv.amount)} has been pending for more than 7 days.`,
      entity_type: 'subcontractor_invoice',
      entity_id: inv.id,
      entity_name: inv.subcontractor?.business_name ?? 'Unknown Subcontractor',
      amount: this.toNum(inv.amount),
      action_url: `/financial/subcontractor-invoices/${inv.id}`,
      created_at: inv.created_at,
    }));

    // recurring_due_soon — info
    const recurringDueSoonAlerts: AlertItem[] = dueSoonRules.map((rule) => {
      const daysUntil = Math.ceil(
        (new Date(rule.next_due_date).getTime() - today.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return {
        id: `recurring_due_soon_${rule.id}`,
        type: 'recurring_due_soon',
        severity: 'info' as const,
        title: `${rule.name} is due in ${daysUntil} days`,
        message: `Recurring expense "${rule.name}" for $${this.toNum(rule.amount)} is due on ${rule.next_due_date}.`,
        entity_type: 'recurring_rule',
        entity_id: rule.id,
        entity_name: rule.name,
        amount: this.toNum(rule.amount),
        action_url: `/financial/recurring-rules/${rule.id}`,
        created_at: rule.next_due_date,
      };
    });

    // recurring_overdue — critical
    const recurringOverdueAlerts: AlertItem[] = overdueRules.map((rule) => ({
      id: `recurring_overdue_${rule.id}`,
      type: 'recurring_overdue',
      severity: 'critical',
      title: `${rule.name} recurring expense is overdue`,
      message: `Recurring expense "${rule.name}" for $${this.toNum(rule.amount)} was due on ${rule.next_due_date} and has not been processed.`,
      entity_type: 'recurring_rule',
      entity_id: rule.id,
      entity_name: rule.name,
      amount: this.toNum(rule.amount),
      action_url: `/financial/recurring-rules/${rule.id}`,
      created_at: rule.next_due_date,
    }));

    // expense_pending_review — info (only fires when count > 5 — BR-A6)
    const expensePendingAlerts: AlertItem[] =
      pendingReviewCount > 5
        ? [
            {
              id: `expense_pending_review_${tenantId}`,
              type: 'expense_pending_review',
              severity: 'info',
              title: `${pendingReviewCount} expenses awaiting your review`,
              message: `There are ${pendingReviewCount} expense entries with status "pending review" that need attention.`,
              entity_type: 'financial_entry',
              entity_id: tenantId,
              entity_name: 'Pending Expenses',
              amount: null,
              action_url: '/financial/entries?status=pending_review',
              created_at: new Date(),
            },
          ]
        : [];

    // project_no_invoice — warning (BR-A7)
    // Requires follow-up query to check which candidate projects have non-voided invoices
    const projectNoInvoiceAlerts: AlertItem[] = [];

    if (candidateProjects.length > 0) {
      const projectsWithInvoices =
        await this.prisma.project_invoice.findMany({
          where: {
            tenant_id: tenantId,
            project_id: { in: candidateProjects.map((p) => p.id) },
            status: { not: 'voided' },
          },
          select: { project_id: true },
          distinct: ['project_id'],
        });

      const projectIdsWithInvoices = new Set(
        projectsWithInvoices.map((p) => p.project_id),
      );
      const projectsWithoutInvoices = candidateProjects.filter(
        (p) => !projectIdsWithInvoices.has(p.id),
      );

      for (const proj of projectsWithoutInvoices) {
        projectNoInvoiceAlerts.push({
          id: `project_no_invoice_${proj.id}`,
          type: 'project_no_invoice',
          severity: 'warning',
          title: `Project ${proj.name} is 50%+ complete with no invoice sent`,
          message: `Project "${proj.name}" (${proj.project_number}) is ${Number(proj.progress_percent)}% complete but has no invoices.`,
          entity_type: 'project',
          entity_id: proj.id,
          entity_name: proj.name,
          amount: null,
          action_url: `/projects/${proj.id}`,
          created_at: new Date(),
        });
      }
    }

    // -----------------------------------------------------------------------
    // Step 4 — Combine all alerts
    // -----------------------------------------------------------------------
    const allAlerts: AlertItem[] = [
      ...invoiceAlerts60,
      ...invoiceAlerts30,
      ...invoiceAlertsBasic,
      ...subInvoiceAlerts,
      ...recurringDueSoonAlerts,
      ...recurringOverdueAlerts,
      ...expensePendingAlerts,
      ...projectNoInvoiceAlerts,
    ];

    // Step 5 — Sort by severity (critical first, then warning, then info),
    // then by amount DESC within severity (BR-A4)
    const severityOrder: Record<string, number> = {
      critical: 0,
      warning: 1,
      info: 2,
    };

    allAlerts.sort((a, b) => {
      const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return (b.amount ?? 0) - (a.amount ?? 0);
    });

    // Step 6 — Apply 50-alert cap (BR-A4)
    const totalAlertsTruncated = allAlerts.length > 50;
    const alerts = allAlerts.slice(0, 50);

    // Step 7 — Return response
    return {
      alert_count: alerts.length,
      alerts,
      ...(totalAlertsTruncated ? { total_alerts_truncated: true } : {}),
    };
  }

  // ==========================================================================
  // Public — getOverview() — Combined Dashboard
  // ==========================================================================

  async getOverview(
    tenantId: string,
    query: { forecast_days?: number },
  ) {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    // Validate forecast_days to exactly 30, 60, or 90 — default to 30 (BR-F4)
    const validForecastDays = [30, 60, 90].includes(
      Number(query.forecast_days),
    )
      ? (Number(query.forecast_days) as 30 | 60 | 90)
      : 30;

    // BR-O1: All 5 methods run in parallel via Promise.all()
    const [pl, ar, ap, forecast, alerts] = await Promise.all([
      this.getPL(tenantId, currentYear, currentMonth), // BR-O2: current month only
      this.getAR(tenantId, {}),
      this.getAP(tenantId, 30),
      this.getForecast(tenantId, validForecastDays),
      this.getAlerts(tenantId),
    ]);

    return {
      pl_summary: pl,
      ar_summary: ar,
      ap_summary: ap,
      forecast,
      alerts: alerts.alerts,
      generated_at: new Date(),
    };
  }

  // ==========================================================================
  // Public — exportPL() — P&L CSV Export
  // ==========================================================================

  async exportPL(
    tenantId: string,
    year: number,
    month?: number,
  ): Promise<Buffer> {
    // Step 1 — Get P&L data (confirmed entries only)
    const plData = await this.getPL(tenantId, year, month, false);

    // Step 2 — Build CSV lines
    const lines: string[] = [];

    // Section 1 — Monthly Summary header
    lines.push(
      'Month,Total Income,Total Expenses (Confirmed),COGS,Operating Expense,Gross Profit,Net Profit,Tax Collected,Tax Paid',
    );

    // Section 1 — Monthly Summary data
    for (const m of plData.months) {
      lines.push(
        [
          m.month_label,
          m.income.total,
          m.expenses.total,
          m.expenses.by_classification.cost_of_goods_sold,
          m.expenses.by_classification.operating_expense,
          m.gross_profit,
          m.net_profit,
          m.tax.tax_collected,
          m.tax.tax_paid,
        ].join(','),
      );
    }

    // Blank row separator between sections
    lines.push('');

    // Section 2 — Expense Detail header
    lines.push(
      'Month,Date,Category,Classification,Supplier/Vendor,Amount,Tax,Payment Method,Project,Notes',
    );

    // Section 2 — Query individual expense entries for the detail section
    const entries = await this.prisma.financial_entry.findMany({
      where: {
        tenant_id: tenantId,
        entry_date: {
          gte: new Date(year, month ? month - 1 : 0, 1),
          lt: new Date(year, month ? month : 12, 1),
        },
        submission_status: 'confirmed',
      },
      include: {
        category: { select: { name: true, classification: true } },
        project: { select: { name: true } },
      },
      orderBy: { entry_date: 'asc' },
    });

    // Section 2 — Expense Detail data
    for (const entry of entries) {
      const entryDate = new Date(entry.entry_date);
      const monthLabel = `${this.monthLabels[entryDate.getMonth()]} ${entryDate.getFullYear()}`;
      lines.push(
        [
          monthLabel,
          entry.entry_date.toISOString().split('T')[0],
          this.escapeCsvField(entry.category?.name ?? ''),
          entry.category?.classification ?? '',
          this.escapeCsvField(entry.vendor_name ?? ''),
          this.toNum(entry.amount),
          this.toNum(entry.tax_amount),
          entry.payment_method ?? '',
          this.escapeCsvField(entry.project?.name ?? ''),
          this.escapeCsvField(entry.notes ?? ''),
        ].join(','),
      );
    }

    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  // ==========================================================================
  // Private — CSV field escaping helper
  // ==========================================================================

  private escapeCsvField(value: string): string {
    if (
      value.includes(',') ||
      value.includes('"') ||
      value.includes('\n')
    ) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  // ==========================================================================
  // Private — Decimal conversion helper
  // ==========================================================================

  private toNum(val: any): number {
    if (val === null || val === undefined) return 0;
    return Number(Number(val).toFixed(2));
  }
}
