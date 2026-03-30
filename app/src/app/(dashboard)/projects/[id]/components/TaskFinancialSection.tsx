'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Upload,
  FileText,
  FileImage,
  Eye,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { useRBAC } from '@/contexts/RBACContext';
import {
  getTaskCosts,
  getTaskReceipts,
  getTaskInvoices,
  uploadTaskReceipt,
} from '@/lib/api/financial';
import { buildFileUrl } from '@/lib/api/files';
import type { RawFinancialEntry, Receipt, SubcontractorInvoice, SubcontractorInvoiceStatus } from '@/lib/types/financial';
import type { ProjectTask } from '@/lib/types/projects';
import CostEntryFormModal from './financial/CostEntryFormModal';
import { ReceiptUploadModal } from '@/app/(dashboard)/financial/entries/components/ReceiptUploadModal';

// ========== CONSTANTS ==========

const CAN_MANAGE_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];
const CAN_UPLOAD_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper', 'Field'];

// ========== HELPERS ==========

function formatCurrency(value: number | string | null): string {
  if (value === null || value === undefined) return '$0.00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getStatusBadge(status: string): { variant: 'success' | 'warning' | 'blue' | 'gray'; label: string } {
  switch (status) {
    case 'confirmed':
      return { variant: 'success', label: 'Confirmed' };
    case 'pending_review':
      return { variant: 'warning', label: 'Pending' };
    case 'denied':
      return { variant: 'gray', label: 'Denied' };
    default:
      return { variant: 'gray', label: status };
  }
}

function getInvoiceStatusBadge(status: SubcontractorInvoiceStatus): { variant: 'warning' | 'blue' | 'success'; label: string } {
  switch (status) {
    case 'pending':
      return { variant: 'warning', label: 'Pending' };
    case 'approved':
      return { variant: 'blue', label: 'Approved' };
    case 'paid':
      return { variant: 'success', label: 'Paid' };
    default:
      return { variant: 'warning', label: status };
  }
}

function getOcrBadge(status: string) {
  switch (status) {
    case 'complete':
      return { variant: 'success' as const, label: 'OCR Complete' };
    case 'processing':
      return { variant: 'blue' as const, label: 'Processing' };
    case 'failed':
      return { variant: 'danger' as const, label: 'OCR Failed' };
    case 'not_processed':
      return { variant: 'gray' as const, label: 'Not Processed' };
    default:
      return { variant: 'gray' as const, label: status };
  }
}

// ========== TYPES ==========

interface TaskFinancialSectionProps {
  task: ProjectTask;
  projectId: string;
}

type SubTab = 'costs' | 'receipts' | 'invoices';

// ========== COMPONENT ==========

export default function TaskFinancialSection({
  task,
  projectId,
}: TaskFinancialSectionProps) {
  const { hasRole } = useRBAC();
  const canManageFinancials = hasRole(CAN_MANAGE_ROLES);
  const canUpload = hasRole(CAN_UPLOAD_ROLES);

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('costs');

  // Costs state
  const [costs, setCosts] = useState<RawFinancialEntry[]>([]);
  const [costsLoading, setCostsLoading] = useState(true);
  const [costsError, setCostsError] = useState<string | null>(null);
  const [showAddCost, setShowAddCost] = useState(false);

  // Receipts state
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(true);
  const [receiptsError, setReceiptsError] = useState<string | null>(null);
  const [showUploadReceipt, setShowUploadReceipt] = useState(false);
  const [previewReceipt, setPreviewReceipt] = useState<Receipt | null>(null);

  // Invoices state
  const [invoices, setInvoices] = useState<SubcontractorInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);

  // ========== DATA LOADING ==========

  const loadCosts = useCallback(async () => {
    setCostsLoading(true);
    setCostsError(null);
    try {
      const data = await getTaskCosts(projectId, task.id);
      setCosts(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setCostsError(e.message || 'Failed to load costs');
    } finally {
      setCostsLoading(false);
    }
  }, [projectId, task.id]);

  const loadReceipts = useCallback(async () => {
    setReceiptsLoading(true);
    setReceiptsError(null);
    try {
      const data = await getTaskReceipts(projectId, task.id);
      setReceipts(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setReceiptsError(e.message || 'Failed to load receipts');
    } finally {
      setReceiptsLoading(false);
    }
  }, [projectId, task.id]);

  const loadInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    setInvoicesError(null);
    try {
      const data = await getTaskInvoices(projectId, task.id);
      setInvoices(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setInvoicesError(e.message || 'Failed to load invoices');
    } finally {
      setInvoicesLoading(false);
    }
  }, [projectId, task.id]);

  useEffect(() => {
    loadCosts();
    loadReceipts();
    loadInvoices();
  }, [loadCosts, loadReceipts, loadInvoices]);

  // ========== COMPUTED ==========

  const totalCosts = costs.reduce((sum, entry) => sum + parseFloat(entry.amount || '0'), 0);
  const totalInvoiced = invoices.reduce((sum, inv) => sum + parseFloat(inv.amount || '0'), 0);
  const categorizedReceipts = receipts.filter((r) => r.is_categorized).length;

  // ========== SUB-TAB DEFINITIONS ==========

  const subTabs: { id: SubTab; label: string; count: number }[] = [
    { id: 'costs', label: 'Costs', count: costs.length },
    { id: 'receipts', label: 'Receipts', count: receipts.length },
    { id: 'invoices', label: 'Invoices', count: invoices.length },
  ];

  // ========== RENDER ==========

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 pb-0">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeSubTab === tab.id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-gray-100 dark:bg-gray-700 text-[10px] font-bold text-gray-600 dark:text-gray-300 px-1">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeSubTab === 'costs' && (
        <CostsSubSection
          costs={costs}
          loading={costsLoading}
          error={costsError}
          total={totalCosts}
          canManage={canManageFinancials}
          onAddCost={() => setShowAddCost(true)}
          onRetry={loadCosts}
        />
      )}

      {activeSubTab === 'receipts' && (
        <ReceiptsSubSection
          receipts={receipts}
          loading={receiptsLoading}
          error={receiptsError}
          categorizedCount={categorizedReceipts}
          canUpload={canUpload}
          onUpload={() => setShowUploadReceipt(true)}
          onPreview={(r) => setPreviewReceipt(r)}
          onRetry={loadReceipts}
        />
      )}

      {activeSubTab === 'invoices' && (
        <InvoicesSubSection
          invoices={invoices}
          loading={invoicesLoading}
          error={invoicesError}
          total={totalInvoiced}
          onRetry={loadInvoices}
        />
      )}

      {/* Add Cost Modal */}
      <CostEntryFormModal
        isOpen={showAddCost}
        onClose={() => setShowAddCost(false)}
        onSuccess={() => {
          setShowAddCost(false);
          loadCosts();
        }}
        projectId={projectId}
        defaultTaskId={task.id}
        taskLocked
      />

      {/* Receipt Upload Modal */}
      <ReceiptUploadModal
        isOpen={showUploadReceipt}
        onClose={() => setShowUploadReceipt(false)}
        onSuccess={() => {
          setShowUploadReceipt(false);
          loadReceipts();
        }}
        defaultProjectId={projectId}
        defaultTaskId={task.id}
        customUploadFn={(formData) => uploadTaskReceipt(projectId, task.id, formData)}
      />

      {/* Receipt Preview Modal */}
      {previewReceipt && (
        <ReceiptPreviewModal
          receipt={previewReceipt}
          onClose={() => setPreviewReceipt(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// COSTS SUB-SECTION
// ============================================================

function CostsSubSection({
  costs,
  loading,
  error,
  total,
  canManage,
  onAddCost,
  onRetry,
}: {
  costs: RawFinancialEntry[];
  loading: boolean;
  error: string | null;
  total: number;
  canManage: boolean;
  onAddCost: () => void;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-red-500 dark:text-red-400 mb-3">{error}</p>
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with action */}
      {canManage && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onAddCost}>
            <Plus className="w-4 h-4" />
            Add Cost
          </Button>
        </div>
      )}

      {/* Empty state */}
      {costs.length === 0 ? (
        <div className="text-center py-8">
          <DollarSign className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No cost entries for this task</p>
          {canManage && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Click &quot;Add Cost&quot; to create the first entry
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Cost entries list */}
          <div className="space-y-2">
            {costs.map((entry) => {
              const statusBadge = getStatusBadge(entry.submission_status);
              return (
                <div
                  key={entry.id}
                  className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(entry.amount)}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {entry.category.name}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {formatDate(entry.entry_date)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={statusBadge.variant} label={statusBadge.label} />
                        {entry.vendor_name && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {entry.vendor_name}
                          </span>
                        )}
                        {entry.has_receipt && (
                          <FileText className="w-3.5 h-3.5 text-green-500 flex-shrink-0" aria-label="Has receipt" />
                        )}
                      </div>
                      {entry.notes && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-1">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total row */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              Total: {costs.length} {costs.length === 1 ? 'entry' : 'entries'}
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(total)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// RECEIPTS SUB-SECTION
// ============================================================

function ReceiptsSubSection({
  receipts,
  loading,
  error,
  categorizedCount,
  canUpload,
  onUpload,
  onPreview,
  onRetry,
}: {
  receipts: Receipt[];
  loading: boolean;
  error: string | null;
  categorizedCount: number;
  canUpload: boolean;
  onUpload: () => void;
  onPreview: (r: Receipt) => void;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-red-500 dark:text-red-400 mb-3">{error}</p>
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with action */}
      {canUpload && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onUpload}>
            <Upload className="w-4 h-4" />
            Upload Receipt
          </Button>
        </div>
      )}

      {/* Empty state */}
      {receipts.length === 0 ? (
        <div className="text-center py-8">
          <FileImage className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No receipts for this task</p>
          {canUpload && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Click &quot;Upload Receipt&quot; to add one
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Receipt list */}
          <div className="space-y-2">
            {receipts.map((receipt) => {
              const ocrBadge = getOcrBadge(receipt.ocr_status);
              const isImage = receipt.file_type === 'photo';
              return (
                <div
                  key={receipt.id}
                  className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-start gap-3">
                    {/* Thumbnail / Icon */}
                    <div className="flex-shrink-0 w-10 h-10 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                      {isImage && receipt.file_url ? (
                        <img
                          src={buildFileUrl(receipt.file_url)}
                          alt={receipt.file_name}
                          className="w-10 h-10 object-cover rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement!.innerHTML =
                              '<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
                          }}
                        />
                      ) : (
                        <FileText className="w-5 h-5 text-gray-400" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {receipt.file_name}
                        </span>
                        {receipt.amount !== null && (
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {formatCurrency(receipt.amount)}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {formatDate(receipt.receipt_date || receipt.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {receipt.vendor_name && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Vendor: {receipt.vendor_name}
                          </span>
                        )}
                        <Badge variant={ocrBadge.variant} label={ocrBadge.label} />
                        {receipt.file_size_bytes && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {formatFileSize(receipt.file_size_bytes)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <button
                      onClick={() => onPreview(receipt)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors flex-shrink-0"
                      aria-label="View receipt"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary row */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              Total: {receipts.length} {receipts.length === 1 ? 'receipt' : 'receipts'} ({categorizedCount} categorized)
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// INVOICES SUB-SECTION (read-only)
// ============================================================

function InvoicesSubSection({
  invoices,
  loading,
  error,
  total,
  onRetry,
}: {
  invoices: SubcontractorInvoice[];
  loading: boolean;
  error: string | null;
  total: number;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-red-500 dark:text-red-400 mb-3">{error}</p>
        <Button variant="ghost" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="text-center py-8">
        <ExternalLink className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">No subcontractor invoices for this task</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Subcontractor invoices are managed from the Subcontractor Invoices page
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Invoice list */}
      <div className="space-y-2">
        {invoices.map((invoice) => {
          const statusBadge = getInvoiceStatusBadge(invoice.status);
          return (
            <div
              key={invoice.id}
              className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {invoice.subcontractor?.business_name || 'Unknown Subcontractor'}
                    </span>
                    {invoice.invoice_number && (
                      <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                        {invoice.invoice_number}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(invoice.amount)}
                    </span>
                    <Badge variant={statusBadge.variant} label={statusBadge.label} />
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatDate(invoice.invoice_date)}
                    </span>
                  </div>
                  {invoice.notes && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 line-clamp-1">
                      {invoice.notes}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Total row */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
          Total Invoiced: {invoices.length} {invoices.length === 1 ? 'invoice' : 'invoices'}
        </span>
        <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}

// ============================================================
// RECEIPT PREVIEW MODAL
// ============================================================

function ReceiptPreviewModal({
  receipt,
  onClose,
}: {
  receipt: Receipt;
  onClose: () => void;
}) {
  const isImage = receipt.file_type === 'photo';
  const fileUrl = buildFileUrl(receipt.file_url);

  return (
    <Modal isOpen onClose={onClose} title={receipt.file_name} size="lg">
      <div className="space-y-4">
        {/* Image or PDF */}
        <div className="flex justify-center">
          {isImage ? (
            <img
              src={fileUrl}
              alt={receipt.file_name}
              className="max-h-[50vh] max-w-full object-contain rounded-lg"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 py-8">
              <FileText className="w-12 h-12 text-gray-400" />
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Download PDF
              </a>
            </div>
          )}
        </div>

        {/* Receipt details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {receipt.vendor_name && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Vendor</p>
              <p className="text-gray-900 dark:text-gray-100">{receipt.vendor_name}</p>
            </div>
          )}
          {receipt.amount !== null && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Amount</p>
              <p className="text-gray-900 dark:text-gray-100">{formatCurrency(receipt.amount)}</p>
            </div>
          )}
          {receipt.receipt_date && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Date</p>
              <p className="text-gray-900 dark:text-gray-100">{formatDate(receipt.receipt_date)}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">OCR Status</p>
            <Badge variant={getOcrBadge(receipt.ocr_status).variant} label={getOcrBadge(receipt.ocr_status).label} />
          </div>
          {receipt.file_size_bytes && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">File Size</p>
              <p className="text-gray-900 dark:text-gray-100">{formatFileSize(receipt.file_size_bytes)}</p>
            </div>
          )}
        </div>

        {/* OCR extracted data if complete */}
        {receipt.ocr_status === 'complete' && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">OCR Extracted Data</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {receipt.ocr_vendor && (
                <div>
                  <span className="text-xs text-gray-400">Vendor:</span>{' '}
                  <span className="text-gray-900 dark:text-gray-100">{receipt.ocr_vendor}</span>
                </div>
              )}
              {receipt.ocr_amount !== null && (
                <div>
                  <span className="text-xs text-gray-400">Amount:</span>{' '}
                  <span className="text-gray-900 dark:text-gray-100">{formatCurrency(receipt.ocr_amount)}</span>
                </div>
              )}
              {receipt.ocr_date && (
                <div>
                  <span className="text-xs text-gray-400">Date:</span>{' '}
                  <span className="text-gray-900 dark:text-gray-100">{formatDate(receipt.ocr_date)}</span>
                </div>
              )}
              {receipt.ocr_tax !== null && (
                <div>
                  <span className="text-xs text-gray-400">Tax:</span>{' '}
                  <span className="text-gray-900 dark:text-gray-100">{formatCurrency(receipt.ocr_tax)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Close button */}
        <div className="flex justify-end pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
