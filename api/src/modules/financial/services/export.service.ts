import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { ExportExpenseQueryDto } from '../dto/export-expense-query.dto';
import { ExportInvoiceQueryDto } from '../dto/export-invoice-query.dto';
import { QualityReportQueryDto } from '../dto/quality-report-query.dto';
import { ExportHistoryQueryDto } from '../dto/export-history-query.dto';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  // Payment method translation: Lead360 enum → QuickBooks display name
  private readonly PAYMENT_METHOD_QB_MAP: Record<string, string> = {
    cash: 'Cash',
    check: 'Check',
    bank_transfer: 'Bank Transfer',
    venmo: 'Venmo',
    zelle: 'Zelle',
    credit_card: 'Credit Card',
    debit_card: 'Debit Card',
    ACH: 'ACH',
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  // ===========================================================================
  // PUBLIC — QuickBooks Exports
  // ===========================================================================

  /**
   * Generate a QuickBooks expense CSV export.
   * Business rules enforced:
   * - BR-01: Only confirmed entries by default (include_pending overrides)
   * - BR-02: Recurring instances excluded by default (include_recurring overrides)
   * - BR-04: Date range capped at 366 days
   * - BR-05: Maximum 50,000 rows per export
   * - BR-06: Every export logged to financial_export_log
   * - BR-07: QuickBooks uses MM/DD/YYYY dates
   * - BR-08: Amounts must be positive
   * - BR-09: Category name used as fallback if no account mapping exists
   */
  async exportQBExpenses(
    tenantId: string,
    userId: string,
    query: ExportExpenseQueryDto,
  ): Promise<{ csv: string; fileName: string; recordCount: number }> {
    // 1. Validate date range
    const { from, to } = this.validateDateRange(query.date_from, query.date_to);

    // 2. Load account mappings for QuickBooks
    const accountMap = await this.loadAccountMappings(tenantId, 'quickbooks');

    // 3. Build Prisma where clause
    const where: any = {
      tenant_id: tenantId,
      entry_date: {
        gte: from,
        lte: to,
      },
    };

    // Default: only confirmed entries
    if (!query.include_pending) {
      where.submission_status = 'confirmed';
    }

    // Default: exclude recurring instances
    if (!query.include_recurring) {
      where.is_recurring_instance = false;
    }

    // Optional filters
    if (query.category_id) {
      where.category_id = query.category_id;
    }
    if (query.project_id) {
      where.project_id = query.project_id;
    }
    if (query.classification) {
      where.category = { classification: query.classification };
    }

    // 4. Query entries with only needed fields
    const entries = await this.prisma.financial_entry.findMany({
      where,
      select: {
        id: true,
        entry_date: true,
        amount: true,
        notes: true,
        vendor_name: true,
        tax_amount: true,
        payment_method: true,
        category_id: true,
        project_id: true,
        category: {
          select: { name: true },
        },
        supplier: {
          select: { name: true },
        },
        project: {
          select: { name: true },
        },
      },
      orderBy: { entry_date: 'asc' },
    });

    // 5. Check record count
    if (entries.length === 0) {
      throw new BadRequestException('No records match the selected filters');
    }
    if (entries.length > 50000) {
      throw new BadRequestException(
        'Export too large. Apply tighter date filters or export by category.',
      );
    }

    // 6. Build CSV
    const header =
      'Date,Description,Amount,Account,Name,Class,Memo,Payment Method,Check No,Tax Amount';

    const rows = entries.map((entry) => {
      const accountInfo = accountMap.get(entry.category_id);
      const accountName = accountInfo
        ? accountInfo.account_name
        : (entry.category?.name || 'Uncategorized');
      const payeeName = entry.supplier?.name || entry.vendor_name || '';
      const description = entry.notes || entry.category?.name || '';
      const projectClass = entry.project?.name || '';
      const paymentMethod = entry.payment_method
        ? (this.PAYMENT_METHOD_QB_MAP[entry.payment_method] ||
            String(entry.payment_method))
        : '';
      const taxAmount = entry.tax_amount ? Number(entry.tax_amount) : '';

      return [
        this.formatDateQB(new Date(entry.entry_date)),
        this.escapeCsvField(description),
        Number(entry.amount).toFixed(2),
        this.escapeCsvField(accountName),
        this.escapeCsvField(payeeName),
        this.escapeCsvField(projectClass),
        this.escapeCsvField(entry.notes || ''),
        this.escapeCsvField(paymentMethod),
        '', // Check No — not applicable
        taxAmount !== '' ? Number(taxAmount).toFixed(2) : '',
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');
    const fileName = `quickbooks-expenses-${query.date_from}-to-${query.date_to}.csv`;

    // 7. Log export
    await this.logExport(
      tenantId,
      userId,
      'quickbooks_expenses',
      query,
      entries.length,
      fileName,
    );

    // 8. Audit log (use generic log() since 'accessed' is not in logTenantChange types)
    await this.auditLogger.log({
      tenant_id: tenantId,
      actor_user_id: userId,
      actor_type: 'user',
      entity_type: 'financial_export',
      entity_id: 'quickbooks_expenses',
      action_type: 'accessed',
      description: `Exported ${entries.length} expense records to QuickBooks CSV`,
      metadata_json: { query, recordCount: entries.length, fileName },
    });

    return { csv, fileName, recordCount: entries.length };
  }

  /**
   * Generate a QuickBooks invoice CSV export.
   * Business rules enforced:
   * - BR-03: Voided invoices NEVER exported
   * - BR-04: Date range capped at 366 days
   * - BR-05: Maximum 50,000 rows per export
   * - BR-06: Every export logged
   * - BR-07: QuickBooks uses MM/DD/YYYY dates
   */
  async exportQBInvoices(
    tenantId: string,
    userId: string,
    query: ExportInvoiceQueryDto,
  ): Promise<{ csv: string; fileName: string; recordCount: number }> {
    // 1. Validate date range
    const { from, to } = this.validateDateRange(query.date_from, query.date_to);

    // 2. Build where clause
    const where: any = {
      tenant_id: tenantId,
      created_at: {
        gte: from,
        lte: to,
      },
    };

    // Never export voided invoices.
    // When a specific status is requested, the DTO validates it is one of
    // draft | sent | partial | paid (never voided), so voided is implicitly
    // excluded. When no status filter is provided, exclude voided explicitly.
    if (query.status) {
      where.status = query.status as any;
    } else {
      where.status = { not: 'voided' };
    }

    // 3. Query invoices
    const invoices = await this.prisma.project_invoice.findMany({
      where,
      select: {
        id: true,
        invoice_number: true,
        amount: true,
        tax_amount: true,
        description: true,
        due_date: true,
        status: true,
        created_at: true,
        project: {
          select: {
            name: true,
            project_number: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    // 4. Check record count
    if (invoices.length === 0) {
      throw new BadRequestException('No records match the selected filters');
    }
    if (invoices.length > 50000) {
      throw new BadRequestException(
        'Export too large. Apply tighter date filters.',
      );
    }

    // 5. Status mapping: Lead360 → QB
    const statusMap: Record<string, string> = {
      draft: 'Draft',
      sent: 'Open',
      partial: 'Partial',
      paid: 'Paid',
    };

    // 6. Build CSV
    const header =
      'Invoice No,Customer,Invoice Date,Due Date,Item,Description,Quantity,Rate,Amount,Tax Amount,Status';

    const rows = invoices.map((inv) => {
      const customerName = inv.project
        ? inv.project.project_number
          ? `${inv.project.name} (${inv.project.project_number})`
          : inv.project.name
        : 'Unknown Project';
      const invoiceDate = this.formatDateQB(new Date(inv.created_at));
      const dueDate = inv.due_date
        ? this.formatDateQB(new Date(inv.due_date))
        : '';
      const status = statusMap[inv.status] || String(inv.status);
      const taxAmount = inv.tax_amount
        ? Number(inv.tax_amount).toFixed(2)
        : '';

      return [
        this.escapeCsvField(inv.invoice_number || ''),
        this.escapeCsvField(customerName),
        invoiceDate,
        dueDate,
        'Services',
        this.escapeCsvField(inv.description || ''),
        '1',
        Number(inv.amount).toFixed(2),
        Number(inv.amount).toFixed(2),
        taxAmount,
        status,
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');
    const fileName = `quickbooks-invoices-${query.date_from}-to-${query.date_to}.csv`;

    // 7. Log export
    await this.logExport(
      tenantId,
      userId,
      'quickbooks_invoices',
      query,
      invoices.length,
      fileName,
    );

    // 8. Audit log (use generic log() since 'accessed' is not in logTenantChange types)
    await this.auditLogger.log({
      tenant_id: tenantId,
      actor_user_id: userId,
      actor_type: 'user',
      entity_type: 'financial_export',
      entity_id: 'quickbooks_invoices',
      action_type: 'accessed',
      description: `Exported ${invoices.length} invoice records to QuickBooks CSV`,
      metadata_json: { query, recordCount: invoices.length, fileName },
    });

    return { csv, fileName, recordCount: invoices.length };
  }

  // ===========================================================================
  // PUBLIC — Xero Exports
  // ===========================================================================

  /**
   * Generate a Xero expense CSV export.
   * Business rules enforced:
   * - BR-01: Only confirmed entries by default (include_pending overrides)
   * - BR-02: Recurring instances excluded by default (include_recurring overrides)
   * - BR-04: Date range capped at 366 days
   * - BR-05: Maximum 50,000 rows per export
   * - BR-06: Every export logged to financial_export_log
   * - BR-07: Xero uses DD/MM/YYYY dates
   * - BR-08: Xero expense amounts must be NEGATIVE (expenditure convention)
   */
  async exportXeroExpenses(
    tenantId: string,
    userId: string,
    query: ExportExpenseQueryDto,
  ): Promise<{ csv: string; fileName: string; recordCount: number }> {
    // 1. Validate date range
    const { from, to } = this.validateDateRange(query.date_from, query.date_to);

    // 2. Load account mappings for Xero
    const accountMap = await this.loadAccountMappings(tenantId, 'xero');

    // 3. Build where clause
    const where: any = {
      tenant_id: tenantId,
      entry_date: {
        gte: from,
        lte: to,
      },
    };

    if (!query.include_pending) {
      where.submission_status = 'confirmed';
    }
    if (!query.include_recurring) {
      where.is_recurring_instance = false;
    }
    if (query.category_id) {
      where.category_id = query.category_id;
    }
    if (query.project_id) {
      where.project_id = query.project_id;
    }
    if (query.classification) {
      where.category = { classification: query.classification };
    }

    // 4. Query entries
    const entries = await this.prisma.financial_entry.findMany({
      where,
      select: {
        id: true,
        entry_date: true,
        amount: true,
        notes: true,
        vendor_name: true,
        tax_amount: true,
        category_id: true,
        project_id: true,
        category: {
          select: { name: true },
        },
        supplier: {
          select: { name: true },
        },
        project: {
          select: { name: true },
        },
      },
      orderBy: { entry_date: 'asc' },
    });

    // 5. Check record count
    if (entries.length === 0) {
      throw new BadRequestException('No records match the selected filters');
    }
    if (entries.length > 50000) {
      throw new BadRequestException(
        'Export too large. Apply tighter date filters or export by category.',
      );
    }

    // 6. Build Xero CSV
    const header =
      'Date,Amount,Payee,Description,Reference,Account Code,Tax Rate,Tracking Name 1';

    const rows = entries.map((entry) => {
      const accountInfo = accountMap.get(entry.category_id);
      const accountCode =
        accountInfo?.account_code ||
        accountInfo?.account_name ||
        (entry.category?.name || 'Uncategorized');
      const payeeName = entry.supplier?.name || entry.vendor_name || '';
      const description = entry.notes || entry.category?.name || '';
      const reference = entry.id.substring(0, 8);
      const trackingName = entry.project?.name || '';

      // Xero tax rate: derive from tax_amount/amount or "Tax Exempt"
      let taxRate = 'Tax Exempt';
      if (
        entry.tax_amount &&
        Number(entry.tax_amount) > 0 &&
        Number(entry.amount) > 0
      ) {
        const pct =
          (Number(entry.tax_amount) / Number(entry.amount)) * 100;
        taxRate = `${pct.toFixed(1)}%`;
      }

      // CRITICAL: Xero uses NEGATIVE amounts for expenditure
      const xeroAmount = -Math.abs(Number(entry.amount));

      return [
        this.formatDateXero(new Date(entry.entry_date)), // DD/MM/YYYY
        xeroAmount.toFixed(2), // NEGATIVE
        this.escapeCsvField(payeeName),
        this.escapeCsvField(description),
        reference,
        this.escapeCsvField(accountCode),
        taxRate,
        this.escapeCsvField(trackingName),
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');
    const fileName = `xero-expenses-${query.date_from}-to-${query.date_to}.csv`;

    // 7. Log export
    await this.logExport(
      tenantId,
      userId,
      'xero_expenses',
      query,
      entries.length,
      fileName,
    );

    // 8. Audit log (use generic log() — 'accessed' is not in logTenantChange types)
    await this.auditLogger.log({
      tenant_id: tenantId,
      actor_user_id: userId,
      actor_type: 'user',
      entity_type: 'financial_export',
      entity_id: 'xero_expenses',
      action_type: 'accessed',
      description: `Exported ${entries.length} expense records to Xero CSV`,
      metadata_json: { query, recordCount: entries.length, fileName },
    });

    return { csv, fileName, recordCount: entries.length };
  }

  /**
   * Generate a Xero invoice CSV export.
   * Business rules enforced:
   * - BR-03: Voided invoices NEVER exported
   * - BR-04: Date range capped at 366 days
   * - BR-05: Maximum 50,000 rows per export
   * - BR-06: Every export logged
   * - BR-07: Xero uses DD/MM/YYYY dates
   * - Xero status values: DRAFT, SUBMITTED, AUTHORISED, PAID
   */
  async exportXeroInvoices(
    tenantId: string,
    userId: string,
    query: ExportInvoiceQueryDto,
  ): Promise<{ csv: string; fileName: string; recordCount: number }> {
    // 1. Validate date range
    const { from, to } = this.validateDateRange(query.date_from, query.date_to);

    // 2. Build where clause
    const where: any = {
      tenant_id: tenantId,
      created_at: {
        gte: from,
        lte: to,
      },
    };

    // Never export voided invoices (same guard as exportQBInvoices).
    if (query.status) {
      where.status = query.status as any;
    } else {
      where.status = { not: 'voided' };
    }

    // 3. Query invoices
    const invoices = await this.prisma.project_invoice.findMany({
      where,
      select: {
        id: true,
        invoice_number: true,
        amount: true,
        tax_amount: true,
        description: true,
        due_date: true,
        status: true,
        created_at: true,
        project: {
          select: {
            name: true,
            project_number: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    // 4. Check record count
    if (invoices.length === 0) {
      throw new BadRequestException('No records match the selected filters');
    }
    if (invoices.length > 50000) {
      throw new BadRequestException(
        'Export too large. Apply tighter date filters.',
      );
    }

    // 5. Xero status mapping
    const xeroStatusMap: Record<string, string> = {
      draft: 'DRAFT',
      sent: 'SUBMITTED',
      partial: 'AUTHORISED',
      paid: 'PAID',
    };

    // 6. Build Xero invoice CSV
    const header =
      'ContactName,InvoiceNumber,InvoiceDate,DueDate,Description,Quantity,UnitAmount,TaxType,AccountCode,TaxAmount,InvoiceStatus';

    const rows = invoices.map((inv) => {
      const contactName = inv.project?.name || 'Unknown Project';
      const invoiceDate = this.formatDateXero(new Date(inv.created_at));
      const dueDate = inv.due_date
        ? this.formatDateXero(new Date(inv.due_date))
        : '';
      const taxType =
        inv.tax_amount && Number(inv.tax_amount) > 0
          ? 'Tax Exclusive'
          : 'No Tax';
      const taxAmount = inv.tax_amount
        ? Number(inv.tax_amount).toFixed(2)
        : '';
      const status =
        xeroStatusMap[inv.status] || String(inv.status).toUpperCase();

      return [
        this.escapeCsvField(contactName),
        this.escapeCsvField(inv.invoice_number || ''),
        invoiceDate,
        dueDate,
        this.escapeCsvField(inv.description || ''),
        '1',
        Number(inv.amount).toFixed(2),
        taxType,
        '', // AccountCode — configurable via category mapping, default empty for revenue
        taxAmount,
        status,
      ].join(',');
    });

    const csv = [header, ...rows].join('\n');
    const fileName = `xero-invoices-${query.date_from}-to-${query.date_to}.csv`;

    // 7. Log export
    await this.logExport(
      tenantId,
      userId,
      'xero_invoices',
      query,
      invoices.length,
      fileName,
    );

    // 8. Audit log (use generic log() — 'accessed' is not in logTenantChange types)
    await this.auditLogger.log({
      tenant_id: tenantId,
      actor_user_id: userId,
      actor_type: 'user',
      entity_type: 'financial_export',
      entity_id: 'xero_invoices',
      action_type: 'accessed',
      description: `Exported ${invoices.length} invoice records to Xero CSV`,
      metadata_json: { query, recordCount: invoices.length, fileName },
    });

    return { csv, fileName, recordCount: invoices.length };
  }

  // ===========================================================================
  // PUBLIC — Quality Report & Export History
  // ===========================================================================

  /**
   * Generate a data quality report for financial entries.
   * Performs 7 distinct quality checks and returns a structured report
   * with severity-ranked issues and per-platform export readiness scores.
   *
   * Checks performed:
   *   1. Missing account mapping (platform-specific, only when platform specified)
   *   2. Missing vendor/supplier (vendor_name null AND supplier_id null)
   *   3. Missing project class (COGS type without project)
   *   4. Zero amount (will be rejected by QB/Xero)
   *   5. Future date (entry_date > today)
   *   6. Missing payment method (field will be blank in export)
   *   7. Duplicate entry risk (same date + amount + supplier)
   *
   * Business rules:
   *   BR-09: Quality report is read-only — it flags issues but does not fix them.
   *   BR-11: Duplicate detection compares by entry_date + amount + supplier_id
   *   BR-12: Issues ordered: error first, warning second, info last
   *   BR-13: export_readiness: errors_present > warnings_present > ready
   */
  async getQualityReport(tenantId: string, query: QualityReportQueryDto) {
    // 1. Build where clause for entries to check
    const where: any = { tenant_id: tenantId };
    if (query.date_from) {
      where.entry_date = { ...where.entry_date, gte: new Date(query.date_from) };
    }
    if (query.date_to) {
      where.entry_date = { ...where.entry_date, lte: new Date(query.date_to) };
    }

    // 2. Load all entries to check
    const entries = await this.prisma.financial_entry.findMany({
      where,
      select: {
        id: true,
        entry_date: true,
        amount: true,
        vendor_name: true,
        supplier_id: true,
        payment_method: true,
        project_id: true,
        category_id: true,
        category: {
          select: {
            name: true,
            type: true,
            classification: true,
          },
        },
        supplier: {
          select: { name: true },
        },
      },
    });

    const issues: Array<{
      severity: 'error' | 'warning' | 'info';
      check_type: string;
      entry_id: string | null;
      entry_date: string | null;
      amount: number | null;
      category_name: string | null;
      supplier_name: string | null;
      message: string;
    }> = [];

    // ====================
    // CHECK 1: Missing account mapping
    // ====================
    if (query.platform) {
      const accountMap = await this.loadAccountMappings(tenantId, query.platform);
      const categoryNamesChecked = new Set<string>();

      for (const entry of entries) {
        if (!accountMap.has(entry.category_id) && !categoryNamesChecked.has(entry.category_id)) {
          categoryNamesChecked.add(entry.category_id);
          const catName = entry.category?.name || 'Unknown';
          issues.push({
            severity: 'warning',
            check_type: 'missing_account_mapping',
            entry_id: null,
            entry_date: null,
            amount: null,
            category_name: catName,
            supplier_name: null,
            message: `Category "${catName}" has no ${query.platform === 'quickbooks' ? 'QB' : 'Xero'} account mapping — will use category name as account`,
          });
        }
      }
    }

    // ====================
    // CHECK 2: Missing vendor/supplier
    // ====================
    for (const entry of entries) {
      if (!entry.vendor_name && !entry.supplier_id) {
        const entryDate = entry.entry_date instanceof Date
          ? entry.entry_date.toISOString().split('T')[0]
          : String(entry.entry_date).split('T')[0];
        issues.push({
          severity: 'warning',
          check_type: 'missing_vendor',
          entry_id: entry.id,
          entry_date: entryDate,
          amount: Number(entry.amount),
          category_name: entry.category?.name || null,
          supplier_name: null,
          message: `Entry on ${entryDate} has no vendor or supplier — payee will be blank in export`,
        });
      }
    }

    // ====================
    // CHECK 3: Missing project class (COGS type without project)
    // ====================
    for (const entry of entries) {
      const classification = (entry.category as any)?.classification;
      if (classification === 'cost_of_goods_sold' && !entry.project_id) {
        const entryDate = entry.entry_date instanceof Date
          ? entry.entry_date.toISOString().split('T')[0]
          : String(entry.entry_date).split('T')[0];
        issues.push({
          severity: 'info',
          check_type: 'missing_project_class',
          entry_id: entry.id,
          entry_date: entryDate,
          amount: Number(entry.amount),
          category_name: entry.category?.name || null,
          supplier_name: entry.supplier?.name || entry.vendor_name || null,
          message: `Entry on ${entryDate} is a project cost but has no project — no Class tracking in QB`,
        });
      }
    }

    // ====================
    // CHECK 4: Zero amount
    // ====================
    for (const entry of entries) {
      if (Number(entry.amount) === 0) {
        const entryDate = entry.entry_date instanceof Date
          ? entry.entry_date.toISOString().split('T')[0]
          : String(entry.entry_date).split('T')[0];
        issues.push({
          severity: 'error',
          check_type: 'zero_amount',
          entry_id: entry.id,
          entry_date: entryDate,
          amount: 0,
          category_name: entry.category?.name || null,
          supplier_name: entry.supplier?.name || entry.vendor_name || null,
          message: `Entry on ${entryDate} has zero amount — will be rejected by QB/Xero`,
        });
      }
    }

    // ====================
    // CHECK 5: Future date
    // ====================
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999); // End of today UTC

    for (const entry of entries) {
      const entryDate = new Date(entry.entry_date);
      if (entryDate > today) {
        const dateStr = entryDate.toISOString().split('T')[0];
        issues.push({
          severity: 'warning',
          check_type: 'future_date',
          entry_id: entry.id,
          entry_date: dateStr,
          amount: Number(entry.amount),
          category_name: entry.category?.name || null,
          supplier_name: entry.supplier?.name || entry.vendor_name || null,
          message: `Entry dated ${dateStr} is in the future — verify this is correct`,
        });
      }
    }

    // ====================
    // CHECK 6: Missing payment method
    // ====================
    for (const entry of entries) {
      if (!entry.payment_method) {
        const entryDate = entry.entry_date instanceof Date
          ? entry.entry_date.toISOString().split('T')[0]
          : String(entry.entry_date).split('T')[0];
        issues.push({
          severity: 'info',
          check_type: 'missing_payment_method',
          entry_id: entry.id,
          entry_date: entryDate,
          amount: Number(entry.amount),
          category_name: entry.category?.name || null,
          supplier_name: entry.supplier?.name || entry.vendor_name || null,
          message: `Entry on ${entryDate} has no payment method — field will be blank in export`,
        });
      }
    }

    // ====================
    // CHECK 7: Duplicate entry risk
    // Use Prisma groupBy to find duplicates in a single query
    // ====================
    const duplicateGroups = await this.prisma.financial_entry.groupBy({
      by: ['entry_date', 'amount', 'supplier_id'],
      where: {
        ...where,
        supplier_id: { not: null },
      },
      _count: { id: true },
      having: {
        id: { _count: { gt: 1 } },
      },
    });

    for (const group of duplicateGroups) {
      const dateStr = group.entry_date instanceof Date
        ? group.entry_date.toISOString().split('T')[0]
        : String(group.entry_date).split('T')[0];

      // Get supplier name for the message (MUST filter by tenant_id for isolation)
      let supplierName = 'Unknown';
      if (group.supplier_id) {
        const supplier = await this.prisma.supplier.findFirst({
          where: { id: group.supplier_id, tenant_id: tenantId },
          select: { name: true },
        });
        supplierName = supplier?.name || 'Unknown';
      }

      issues.push({
        severity: 'warning',
        check_type: 'duplicate_entry_risk',
        entry_id: null,
        entry_date: dateStr,
        amount: Number(group.amount),
        category_name: null,
        supplier_name: supplierName,
        message: `Possible duplicate: ${group._count.id} entries on ${dateStr} for $${Number(group.amount).toFixed(2)} from ${supplierName} — review before export`,
      });
    }

    // ====================
    // Sort issues: error first, warning second, info last
    // Within each severity, order by entry_date DESC
    // ====================
    const severityOrder = { error: 0, warning: 1, info: 2 };
    issues.sort((a, b) => {
      const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (sevDiff !== 0) return sevDiff;
      // Within same severity, sort by date descending
      const dateA = a.entry_date || '';
      const dateB = b.entry_date || '';
      return dateB.localeCompare(dateA);
    });

    // ====================
    // Calculate summary
    // ====================
    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;
    const infoCount = issues.filter((i) => i.severity === 'info').length;

    const getReadiness = (hasErrors: boolean, hasWarnings: boolean): string => {
      if (hasErrors) return 'errors_present';
      if (hasWarnings) return 'warnings_present';
      return 'ready';
    };

    return {
      total_entries_checked: entries.length,
      total_issues: issues.length,
      errors: errorCount,
      warnings: warningCount,
      infos: infoCount,
      issues,
      export_readiness: {
        quickbooks: getReadiness(errorCount > 0, warningCount > 0),
        xero: getReadiness(errorCount > 0, warningCount > 0),
      },
    };
  }

  /**
   * Retrieve paginated export history for a tenant.
   * Business rules:
   *   BR-10: Export history is read-only — records cannot be deleted.
   *   Sorted by created_at descending (most recent first).
   *   filters_applied is parsed from JSON string to object.
   */
  async getExportHistory(tenantId: string, query: ExportHistoryQueryDto) {
    const where: any = { tenant_id: tenantId };

    if (query.export_type) {
      where.export_type = query.export_type as any;
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.financial_export_log.findMany({
        where,
        select: {
          id: true,
          export_type: true,
          date_from: true,
          date_to: true,
          record_count: true,
          file_name: true,
          filters_applied: true,
          exported_by_user_id: true,
          created_at: true,
          exported_by: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.financial_export_log.count({ where }),
    ]);

    // Parse filters_applied JSON for each record
    const parsedData = data.map((record) => ({
      ...record,
      filters_applied: record.filters_applied
        ? JSON.parse(record.filters_applied as string)
        : null,
    }));

    return {
      data: parsedData,
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // ===========================================================================
  // PRIVATE — Date Formatters
  // ===========================================================================

  /**
   * Format date as MM/DD/YYYY for QuickBooks Online import.
   * QuickBooks uses US date format.
   * CRITICAL: Uses getUTC* methods — Prisma returns Date objects in UTC.
   */
  private formatDateQB(date: Date): string {
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${month}/${day}/${year}`;
  }

  /**
   * Format date as DD/MM/YYYY for Xero import.
   * Xero uses international date format.
   * CRITICAL: Uses getUTC* methods — Prisma returns Date objects in UTC.
   */
  private formatDateXero(date: Date): string {
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  // ===========================================================================
  // PRIVATE — Account Mapping Loader
  // ===========================================================================

  /**
   * Load all account mappings for a tenant+platform into a Map keyed by category_id.
   * Called once per export — NOT per row.
   */
  private async loadAccountMappings(
    tenantId: string,
    platform: string,
  ): Promise<
    Map<string, { account_name: string; account_code: string | null }>
  > {
    const mappings =
      await this.prisma.financial_category_account_mapping.findMany({
        where: { tenant_id: tenantId, platform: platform as any },
      });

    const map = new Map<
      string,
      { account_name: string; account_code: string | null }
    >();
    for (const m of mappings) {
      map.set(m.category_id, {
        account_name: m.account_name,
        account_code: m.account_code,
      });
    }
    return map;
  }

  // ===========================================================================
  // PRIVATE — Export Logging
  // ===========================================================================

  /**
   * Write an immutable record to financial_export_log after a successful export.
   * Called AFTER the CSV is generated (not before), because we need the actual record_count.
   */
  private async logExport(
    tenantId: string,
    userId: string,
    exportType: string,
    query: any,
    recordCount: number,
    fileName: string,
  ): Promise<void> {
    await this.prisma.financial_export_log.create({
      data: {
        tenant_id: tenantId,
        export_type: exportType as any,
        date_from: query.date_from ? new Date(query.date_from) : null,
        date_to: query.date_to ? new Date(query.date_to) : null,
        record_count: recordCount,
        file_name: fileName,
        filters_applied: JSON.stringify(query),
        exported_by_user_id: userId,
      },
    });
  }

  // ===========================================================================
  // PRIVATE — Validation
  // ===========================================================================

  /**
   * Validate the 366-day limit and return parsed dates.
   * Throws BadRequestException for invalid dates, inverted range, or excessive range.
   */
  private validateDateRange(
    dateFrom: string,
    dateTo: string,
  ): { from: Date; to: Date } {
    const from = new Date(dateFrom);
    const to = new Date(dateTo);

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw new BadRequestException(
        'Invalid date format for date_from or date_to',
      );
    }

    if (from > to) {
      throw new BadRequestException(
        'date_from must be before or equal to date_to',
      );
    }

    const diffMs = to.getTime() - from.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays > 366) {
      throw new BadRequestException(
        'Date range cannot exceed 366 days. Apply tighter date filters or export in smaller batches.',
      );
    }

    return { from, to };
  }

  // ===========================================================================
  // PRIVATE — CSV Helpers
  // ===========================================================================

  /**
   * Escape a CSV field value that may contain commas, quotes, or newlines.
   * Returns empty string for null/undefined.
   * Wraps in double quotes and doubles internal quotes per RFC 4180.
   */
  private escapeCsvField(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (
      str.includes(',') ||
      str.includes('"') ||
      str.includes('\n') ||
      str.includes('\r')
    ) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
