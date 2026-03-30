/**
 * Financial Exports Page
 * Tabbed interface: Export | Quality Report | History | Account Mappings (link)
 * RBAC: Owner, Admin, Bookkeeper
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Download,
  ArrowLeft,
  FileSpreadsheet,
  ClipboardCheck,
  History,
  MapPin,
  ExternalLink,
  Shield,
  AlertTriangle,
  Info,
  CheckCircle2,
  XCircle,
  FileDown,
  Calendar,
  Filter,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { format, differenceInDays, parseISO } from 'date-fns';
import { useRBAC } from '@/contexts/RBACContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import Card from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select, SelectOption } from '@/components/ui/Select';
import { Modal, ModalActions, ModalContent } from '@/components/ui/Modal';
import { PaginationControls } from '@/components/ui/PaginationControls';
import {
  exportQuickbooksExpenses,
  exportQuickbooksInvoices,
  exportXeroExpenses,
  exportXeroInvoices,
  getQualityReport,
  getExportHistory,
  getFinancialCategories,
} from '@/lib/api/financial';
import { getProjects } from '@/lib/api/projects';
import {
  getPageCount,
  type ExportExpenseParams,
  type ExportInvoiceParams,
  type QualityReportResponse,
  type QualityReportIssue,
  type ExportHistoryItem,
  type ExportType,
  type AccountingPlatform,
  type CategoryClassification,
  type InvoiceStatus,
  type FinancialCategory,
  type AlertSeverity,
} from '@/lib/types/financial';
import type { Project } from '@/lib/types/projects';

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'export', label: 'Export', icon: FileSpreadsheet },
  { id: 'quality', label: 'Quality Report', icon: ClipboardCheck },
  { id: 'history', label: 'History', icon: History },
  { id: 'mappings', label: 'Account Mappings', icon: ExternalLink },
];

const EXPORT_TYPE_LABELS: Record<ExportType, string> = {
  quickbooks_expenses: 'QuickBooks Expenses',
  quickbooks_invoices: 'QuickBooks Invoices',
  xero_expenses: 'Xero Expenses',
  xero_invoices: 'Xero Invoices',
  pl_csv: 'P&L Report',
  entries_csv: 'Entries CSV',
};

const EXPORT_TYPE_BADGE_VARIANT: Record<ExportType, 'green' | 'blue' | 'cyan' | 'purple' | 'orange' | 'gray'> = {
  quickbooks_expenses: 'green',
  quickbooks_invoices: 'blue',
  xero_expenses: 'cyan',
  xero_invoices: 'purple',
  pl_csv: 'orange',
  entries_csv: 'gray',
};

const CLASSIFICATION_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Classifications' },
  { value: 'cost_of_goods_sold', label: 'COGS (Cost of Goods Sold)' },
  { value: 'operating_expense', label: 'OpEx (Operating Expense)' },
];

const INVOICE_STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'partial', label: 'Partial' },
  { value: 'paid', label: 'Paid' },
];

const PLATFORM_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Platforms' },
  { value: 'quickbooks', label: 'QuickBooks' },
  { value: 'xero', label: 'Xero' },
];

const HISTORY_FILTER_OPTIONS: SelectOption[] = [
  { value: '', label: 'All Export Types' },
  { value: 'quickbooks_expenses', label: 'QuickBooks Expenses' },
  { value: 'quickbooks_invoices', label: 'QuickBooks Invoices' },
  { value: 'xero_expenses', label: 'Xero Expenses' },
  { value: 'xero_invoices', label: 'Xero Invoices' },
  { value: 'pl_csv', label: 'P&L Report' },
  { value: 'entries_csv', label: 'Entries CSV' },
];

type ExportTarget = {
  platform: 'quickbooks' | 'xero';
  type: 'expenses' | 'invoices';
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const triggerDownload = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const formatDate = (dateStr: string): string => {
  try {
    // Strip time component to avoid timezone shift on date boundaries
    // e.g. "2026-01-01T00:00:00.000Z" in PST would show Dec 31 without this
    const dateOnly = dateStr.split('T')[0];
    return format(parseISO(dateOnly), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
};

const formatDateRange = (from: string, to: string): string => {
  return `${formatDate(from)} — ${formatDate(to)}`;
};

const getSeverityIcon = (severity: AlertSeverity) => {
  switch (severity) {
    case 'error':
      return <XCircle className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />;
    case 'info':
      return <Info className="h-5 w-5 text-blue-500 dark:text-blue-400 flex-shrink-0" />;
  }
};

const getSeverityBorderClass = (severity: AlertSeverity): string => {
  switch (severity) {
    case 'error':
      return 'border-l-4 border-l-red-500 dark:border-l-red-400';
    case 'warning':
      return 'border-l-4 border-l-yellow-500 dark:border-l-yellow-400';
    case 'info':
      return 'border-l-4 border-l-blue-500 dark:border-l-blue-400';
  }
};

const getSeverityLabel = (severity: AlertSeverity): string => {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
};

const getCheckTypeLabel = (checkType: string): string => {
  return checkType
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

// ─── Export Tab ──────────────────────────────────────────────────────────────

function ExportTab({ onExport }: { onExport: (target: ExportTarget) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Choose Export Type</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Select a platform and data type to generate a CSV export for your accounting software.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
        {/* QuickBooks Card */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-900/30">
              <FileSpreadsheet className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">QuickBooks</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">MM/DD/YYYY format</p>
            </div>
          </div>
          <div className="space-y-3">
            <Button
              variant="primary"
              size="sm"
              fullWidth
              onClick={() => onExport({ platform: 'quickbooks', type: 'expenses' })}
              className="!bg-green-600 hover:!bg-green-700 dark:!bg-green-600 dark:hover:!bg-green-700"
            >
              <FileDown className="h-4 w-4" />
              Export Expenses
            </Button>
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              onClick={() => onExport({ platform: 'quickbooks', type: 'invoices' })}
            >
              <FileDown className="h-4 w-4" />
              Export Invoices
            </Button>
          </div>
        </Card>

        {/* Xero Card */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2.5 rounded-lg bg-cyan-50 dark:bg-cyan-900/30">
              <FileSpreadsheet className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Xero</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">DD/MM/YYYY format</p>
            </div>
          </div>
          <div className="space-y-3">
            <Button
              variant="primary"
              size="sm"
              fullWidth
              onClick={() => onExport({ platform: 'xero', type: 'expenses' })}
              className="!bg-cyan-600 hover:!bg-cyan-700 dark:!bg-cyan-600 dark:hover:!bg-cyan-700"
            >
              <FileDown className="h-4 w-4" />
              Export Expenses
            </Button>
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              onClick={() => onExport({ platform: 'xero', type: 'invoices' })}
            >
              <FileDown className="h-4 w-4" />
              Export Invoices
            </Button>
          </div>
        </Card>
      </div>

      {/* Account Mappings Link */}
      <Link
        href="/financial/exports/mappings"
        className="group flex items-center gap-3 p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all"
      >
        <MapPin className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            Account Mappings
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Map categories to QuickBooks or Xero accounts for cleaner exports
          </p>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
      </Link>
    </div>
  );
}

// ─── Export Configuration Modal ──────────────────────────────────────────────

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: ExportTarget | null;
  categories: FinancialCategory[];
  projects: Project[];
}

function ExportConfigModal({ isOpen, onClose, target, categories, projects }: ExportModalProps) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [classification, setClassification] = useState('');
  const [projectId, setProjectId] = useState('');
  const [includeRecurring, setIncludeRecurring] = useState(false);
  const [includePending, setIncludePending] = useState(false);
  const [invoiceStatus, setInvoiceStatus] = useState('');
  const [exporting, setExporting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isExpenses = target?.type === 'expenses';
  const platformLabel = target?.platform === 'quickbooks' ? 'QuickBooks' : 'Xero';
  const typeLabel = isExpenses ? 'Expenses' : 'Invoices';

  // Reset form when modal opens with new target
  useEffect(() => {
    if (isOpen) {
      setDateFrom('');
      setDateTo('');
      setCategoryId('');
      setClassification('');
      setProjectId('');
      setIncludeRecurring(false);
      setIncludePending(false);
      setInvoiceStatus('');
      setExporting(false);
      setErrors({});
    }
  }, [isOpen]);

  const categoryOptions: SelectOption[] = [
    { value: '', label: 'All Categories' },
    ...categories
      .filter((c) => c.is_active)
      .map((c) => ({ value: c.id, label: c.name })),
  ];

  const projectOptions: SelectOption[] = [
    { value: '', label: 'All Projects' },
    ...projects.map((p) => ({ value: p.id, label: `${p.project_number} — ${p.name}` })),
  ];

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!dateFrom) newErrors.dateFrom = 'Start date is required';
    if (!dateTo) newErrors.dateTo = 'End date is required';

    if (dateFrom && dateTo) {
      const daysDiff = differenceInDays(parseISO(dateTo), parseISO(dateFrom));
      if (daysDiff < 0) {
        newErrors.dateTo = 'End date must be after start date';
      } else if (daysDiff > 366) {
        newErrors.dateTo = 'Date range cannot exceed 366 days';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const showRangeWarning =
    dateFrom &&
    dateTo &&
    differenceInDays(parseISO(dateTo), parseISO(dateFrom)) > 180 &&
    differenceInDays(parseISO(dateTo), parseISO(dateFrom)) <= 366;

  const handleExport = async () => {
    if (!validate() || !target) return;

    setExporting(true);
    try {
      let blob: Blob;
      let filename: string;

      if (isExpenses) {
        const params: ExportExpenseParams = {
          date_from: dateFrom,
          date_to: dateTo,
          ...(categoryId && { category_id: categoryId }),
          ...(classification && { classification: classification as CategoryClassification }),
          ...(projectId && { project_id: projectId }),
          include_recurring: includeRecurring,
          include_pending: includePending,
        };

        if (target.platform === 'quickbooks') {
          blob = await exportQuickbooksExpenses(params);
          filename = `quickbooks-expenses-${dateFrom}-to-${dateTo}.csv`;
        } else {
          blob = await exportXeroExpenses(params);
          filename = `xero-expenses-${dateFrom}-to-${dateTo}.csv`;
        }
      } else {
        const params: ExportInvoiceParams = {
          date_from: dateFrom,
          date_to: dateTo,
          ...(invoiceStatus && { status: invoiceStatus as Exclude<InvoiceStatus, 'voided'> }),
        };

        if (target.platform === 'quickbooks') {
          blob = await exportQuickbooksInvoices(params);
          filename = `quickbooks-invoices-${dateFrom}-to-${dateTo}.csv`;
        } else {
          blob = await exportXeroInvoices(params);
          filename = `xero-invoices-${dateFrom}-to-${dateTo}.csv`;
        }
      }

      triggerDownload(blob, filename);
      toast.success(`Export downloaded — ${platformLabel} ${typeLabel}`);
      onClose();
    } catch (err: unknown) {
      const error = err as { response?: { status?: number } };
      if (error?.response?.status === 400) {
        toast.error('No records match your filters. Adjust your date range or filters and try again.');
      } else {
        toast.error('Export failed. Please try again.');
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={target ? `Export ${platformLabel} ${typeLabel}` : 'Export'} size="lg">
      {target && <ModalContent>
        <div className="space-y-4">
          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Date From"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              required
              error={errors.dateFrom}
            />
            <Input
              label="Date To"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              required
              error={errors.dateTo}
            />
          </div>

          {/* Range warning */}
          {showRangeWarning && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Large date range selected ({differenceInDays(parseISO(dateTo), parseISO(dateFrom))} days). Export may take longer and produce a large file.
              </p>
            </div>
          )}

          {/* Expense-specific filters */}
          {isExpenses && (
            <>
              <Select
                label="Category"
                options={categoryOptions}
                value={categoryId}
                onChange={(val) => setCategoryId(val)}
                searchable
                placeholder="All Categories"
              />

              <Select
                label="Classification"
                options={CLASSIFICATION_OPTIONS}
                value={classification}
                onChange={(val) => setClassification(val)}
                placeholder="All Classifications"
              />

              <Select
                label="Project"
                options={projectOptions}
                value={projectId}
                onChange={(val) => setProjectId(val)}
                searchable
                placeholder="All Projects"
              />

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={includeRecurring}
                    onChange={(e) => setIncludeRecurring(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                    Include Recurring Entries
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={includePending}
                    onChange={(e) => setIncludePending(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100">
                    Include Pending Entries
                  </span>
                </label>
              </div>
            </>
          )}

          {/* Invoice-specific filters */}
          {!isExpenses && (
            <Select
              label="Invoice Status"
              options={INVOICE_STATUS_OPTIONS}
              value={invoiceStatus}
              onChange={(val) => setInvoiceStatus(val)}
              placeholder="All Statuses"
              helperText="Voided invoices are never included in exports"
            />
          )}
        </div>
      </ModalContent>}

      {target && <ModalActions>
        <Button variant="secondary" size="sm" onClick={onClose} disabled={exporting}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={handleExport} loading={exporting}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </ModalActions>}
    </Modal>
  );
}

// ─── Quality Report Tab ──────────────────────────────────────────────────────

function QualityReportTab() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [platform, setPlatform] = useState('');
  const [report, setReport] = useState<QualityReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const handleRunReport = async () => {
    setLoading(true);
    setHasRun(true);
    try {
      const params: { date_from?: string; date_to?: string; platform?: AccountingPlatform } = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (platform) params.platform = platform as AccountingPlatform;

      const data = await getQualityReport(params);
      setReport(data);
    } catch {
      toast.error('Failed to run quality report. Please try again.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Data Quality Report</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Check your data for potential issues before exporting to your accounting software.
        </p>
      </div>

      {/* Filters */}
      <Card className="p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Date From"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            label="Date To"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <Select
            label="Platform"
            options={PLATFORM_OPTIONS}
            value={platform}
            onChange={(val) => setPlatform(val)}
            placeholder="All Platforms"
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="primary" size="sm" onClick={handleRunReport} loading={loading}>
            <ClipboardCheck className="h-4 w-4" />
            Run Report
          </Button>
        </div>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center min-h-[200px]">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Results */}
      {!loading && report && report.total_entries_checked > 0 && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Card className="p-4 text-center">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entries Checked</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {report.total_entries_checked}
              </p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs font-medium text-red-500 dark:text-red-400 uppercase tracking-wider">Errors</p>
              <p className={`text-2xl sm:text-3xl font-bold mt-1 ${report.errors > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                {report.errors}
              </p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs font-medium text-yellow-500 dark:text-yellow-400 uppercase tracking-wider">Warnings</p>
              <p className={`text-2xl sm:text-3xl font-bold mt-1 ${report.warnings > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}`}>
                {report.warnings}
              </p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs font-medium text-blue-500 dark:text-blue-400 uppercase tracking-wider">Info</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-1">
                {report.infos}
              </p>
            </Card>
          </div>

          {/* Issues List */}
          {report.issues.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Issues Found</h3>
              <div className="space-y-2">
                {report.issues.map((issue: QualityReportIssue, idx: number) => (
                  <div
                    key={`${issue.entry_id}-${issue.check_type}-${idx}`}
                    className={`p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 ${getSeverityBorderClass(issue.severity)}`}
                  >
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(issue.severity)}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge
                            variant={issue.severity === 'error' ? 'danger' : issue.severity === 'warning' ? 'warning' : 'info'}
                            label={getSeverityLabel(issue.severity)}
                          />
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {getCheckTypeLabel(issue.check_type)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Entry on {formatDate(issue.entry_date)} | {formatCurrency(issue.amount)} | {issue.category_name}
                          {issue.supplier_name && ` | ${issue.supplier_name}`}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 italic">
                          &ldquo;{issue.message}&rdquo;
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Overall Assessment */}
          <div className="space-y-2">
            {report.errors > 0 ? (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <XCircle className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0" />
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  {report.errors} error{report.errors !== 1 ? 's' : ''} found — fix these before exporting to avoid import failures.
                </p>
              </div>
            ) : report.warnings > 0 ? (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                <AlertTriangle className="h-5 w-5 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />
                <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                  {report.warnings} warning{report.warnings !== 1 ? 's' : ''} — entries may have blank fields in the export.
                </p>
              </div>
            ) : report.total_entries_checked > 0 ? (
              <div className="flex items-center gap-2 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-5 w-5 text-green-500 dark:text-green-400 flex-shrink-0" />
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  No errors found — safe to export!
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Empty state before running */}
      {!loading && !report && !hasRun && (
        <div className="flex flex-col items-center justify-center min-h-[200px] text-center px-4">
          <ClipboardCheck className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Configure your filters and click &ldquo;Run Report&rdquo; to check data quality.
          </p>
        </div>
      )}

      {/* Empty state after running with no entries */}
      {!loading && report && report.total_entries_checked === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[120px] text-center px-4">
          <Info className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No entries found for the selected filters.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Export History Tab ──────────────────────────────────────────────────────

function ExportHistoryTab() {
  const [exportType, setExportType] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<ExportHistoryItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params: { export_type?: ExportType; page: number; limit: number } = {
        page,
        limit: 10,
      };
      if (exportType) params.export_type = exportType as ExportType;

      const response = await getExportHistory(params);
      setHistory(response.data);
      setTotalPages(getPageCount(response.meta));
      setTotal(response.meta.total);
    } catch {
      toast.error('Failed to load export history.');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [page, exportType]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleFilterChange = (val: string) => {
    setExportType(val);
    setPage(1);
  };

  const formatFiltersApplied = (filters: Record<string, unknown>): string => {
    const parts: string[] = [];
    if (filters.include_recurring === false) parts.push('No recurring');
    if (filters.include_recurring === true) parts.push('With recurring');
    if (filters.include_pending === false) parts.push('No pending');
    if (filters.include_pending === true) parts.push('With pending');
    if (filters.classification) parts.push(`Classification: ${String(filters.classification)}`);
    if (filters.status) parts.push(`Status: ${String(filters.status)}`);
    return parts.length > 0 ? parts.join(', ') : '';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Export History</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {total} export{total !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="w-full sm:w-64">
          <Select
            options={HISTORY_FILTER_OPTIONS}
            value={exportType}
            onChange={handleFilterChange}
            placeholder="All Export Types"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <Card className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-700 rounded" />
                    <div className="h-3 w-1/3 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* History List */}
      {!loading && history.length > 0 && (
        <div className="space-y-3">
          {history.map((item: ExportHistoryItem) => {
            const filtersText = formatFiltersApplied(item.filters_applied);
            return (
              <Card key={item.id} className="p-4 sm:p-5">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                    <FileDown className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Filename */}
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate" title={item.file_name}>
                      {item.file_name}
                    </p>

                    {/* Type Badge + Record Count */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={EXPORT_TYPE_BADGE_VARIANT[item.export_type] || 'gray'}
                        label={EXPORT_TYPE_LABELS[item.export_type] || item.export_type}
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {item.record_count} record{item.record_count !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {/* Date Range */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>Date Range: {formatDateRange(item.date_from, item.date_to)}</span>
                    </div>

                    {/* Exported by */}
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Exported by {item.exported_by.first_name} {item.exported_by.last_name} &middot; {formatDate(item.created_at)}
                    </p>

                    {/* Filters applied */}
                    {filtersText && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                        <Filter className="h-3 w-3 flex-shrink-0" />
                        <span>{filtersText}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}

          {/* Pagination */}
          {totalPages > 1 && (
            <PaginationControls
              currentPage={page}
              totalPages={totalPages}
              onPrevious={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              onGoToPage={(p) => setPage(p)}
              className="mt-4"
            />
          )}
        </div>
      )}

      {/* Empty State */}
      {!loading && history.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[200px] text-center px-4">
          <History className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {exportType ? 'No exports found for this type.' : 'No exports yet. Generate your first export from the Export tab.'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function FinancialExportsPage() {
  const router = useRouter();
  const { hasRole, loading: rbacLoading } = useRBAC();
  const canView = hasRole(['Owner', 'Admin', 'Bookkeeper']);

  const [activeTab, setActiveTab] = useState('export');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<ExportTarget | null>(null);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  // Load categories and projects for export modal filters
  useEffect(() => {
    if (!canView || rbacLoading) return;

    const loadFilterData = async () => {
      try {
        const [cats, projs] = await Promise.all([
          getFinancialCategories(),
          getProjects({ limit: 200 }),
        ]);
        setCategories(cats);
        setProjects(projs.data);
      } catch {
        // Non-blocking — filters will just have fewer options
      }
    };

    loadFilterData();
  }, [canView, rbacLoading]);

  const handleOpenExport = (target: ExportTarget) => {
    setExportTarget(target);
    setExportModalOpen(true);
  };

  const handleCloseExport = () => {
    setExportModalOpen(false);
    // Don't null target here — let the Modal's leave animation complete first.
    // Target is overwritten on next open via handleOpenExport.
  };

  const handleTabChange = (tabId: string) => {
    if (tabId === 'mappings') {
      router.push('/financial/exports/mappings');
      return;
    }
    setActiveTab(tabId);
  };

  if (rbacLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-4">
        <Shield className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Access Restricted</h2>
        <p className="text-gray-500 dark:text-gray-400">You don&apos;t have permission to view exports.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Financial', href: '/financial' },
          { label: 'Exports' },
        ]}
      />

      {/* Back link */}
      <div>
        <Link
          href="/financial"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Financial
        </Link>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Accounting Exports
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Export financial data to QuickBooks or Xero, check data quality, and view export history.
        </p>
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} activeTab={activeTab} onChange={handleTabChange} />

      {/* Tab Content */}
      <div className="mt-2">
        {activeTab === 'export' && <ExportTab onExport={handleOpenExport} />}
        {activeTab === 'quality' && <QualityReportTab />}
        {activeTab === 'history' && <ExportHistoryTab />}
      </div>

      {/* Export Configuration Modal */}
      <ExportConfigModal
        isOpen={exportModalOpen}
        onClose={handleCloseExport}
        target={exportTarget}
        categories={categories}
        projects={projects}
      />
    </div>
  );
}
