/**
 * ReceiptSection Component — Project Financial Tab
 * Displays receipts grid for a project with upload (via ReceiptUploadModal),
 * preview with OCR data, OCR status badges, and delete with confirmation.
 *
 * Sprint 12 Integration: Uses the shared ReceiptUploadModal that includes
 * OCR polling, create-entry-from-receipt, link-to-entry, retry OCR,
 * camera capture, and orphan cleanup.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PaginationControls } from '@/components/ui/PaginationControls';
import {
  Upload,
  FileText,
  Eye,
  Trash2,
  AlertCircle,
  Link2,
  Unlink,
  FileImage,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRBAC } from '@/contexts/RBACContext';
import { getReceipts, deleteReceipt, unlinkReceipt } from '@/lib/api/financial';
import { buildFileUrl } from '@/lib/api/files';
import type { Receipt, PaginatedResponse, OcrStatus } from '@/lib/types/financial';
import { getPageCount } from '@/lib/types/financial';
import { ReceiptUploadModal } from '@/app/(dashboard)/financial/entries/components/ReceiptUploadModal';

// ========== CONSTANTS ==========

const PAGE_SIZE = 20;
const CAN_DELETE_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];

// ========== HELPERS ==========

function formatCurrency(value: number | string | null): string {
  if (value === null || value === undefined) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '-';
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

function getOcrBadge(status: OcrStatus) {
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

interface ReceiptSectionProps {
  projectId: string;
  onDataChange: () => void;
}

// ========== COMPONENT ==========

export default function ReceiptSection({ projectId, onDataChange }: ReceiptSectionProps) {
  const { hasRole } = useRBAC();
  const canDelete = hasRole(CAN_DELETE_ROLES);

  const [receipts, setReceipts] = useState<PaginatedResponse<Receipt> | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Upload modal (uses shared ReceiptUploadModal)
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Preview modal
  const [previewReceipt, setPreviewReceipt] = useState<Receipt | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Receipt | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ===== LOAD RECEIPTS =====
  const loadReceipts = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await getReceipts({ project_id: projectId, page, limit: PAGE_SIZE });
      setReceipts(data);
    } catch {
      setFetchError('Failed to load receipts');
      toast.error('Failed to load receipts');
    } finally {
      setLoading(false);
    }
  }, [projectId, page]);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  // ===== DELETE HANDLER =====
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // If linked to an entry, unlink first (backend rejects delete on linked receipts)
      if (deleteTarget.is_categorized && deleteTarget.financial_entry_id) {
        await unlinkReceipt(deleteTarget.id);
      }
      await deleteReceipt(deleteTarget.id);
      toast.success('Receipt deleted');
      setDeleteTarget(null);
      loadReceipts();
      onDataChange();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to delete receipt');
    } finally {
      setDeleting(false);
    }
  };

  // ===== RECEIPT IMAGE URL =====
  const getReceiptImageUrl = (receipt: Receipt): string | null => {
    if (receipt.file_type === 'photo') {
      return buildFileUrl(receipt.file_url);
    }
    return null;
  };

  // ===== TOTAL PAGES =====
  const totalPages = receipts ? getPageCount(receipts.meta) : 1;

  return (
    <>
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Receipts</h3>
          <Button
            size="sm"
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5"
          >
            <Upload className="w-4 h-4" />
            Upload Receipt
          </Button>
        </div>

        {loading ? (
          <div className="py-12"><LoadingSpinner size="lg" centered /></div>
        ) : fetchError ? (
          <div className="py-12 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-gray-700 dark:text-gray-300">{fetchError}</p>
            <Button variant="secondary" size="sm" onClick={loadReceipts} className="mt-4">
              Retry
            </Button>
          </div>
        ) : !receipts || receipts.data.length === 0 ? (
          /* Empty state */
          <div className="py-12 text-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
            <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
              <FileImage className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">No receipts uploaded yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              Upload a receipt to get started with OCR analysis
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setShowUploadModal(true)}
              className="mt-4"
            >
              <Upload className="w-4 h-4" />
              Upload Receipt
            </Button>
          </div>
        ) : (
          <>
            {/* Receipt Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {receipts.data.map((receipt) => {
                const imageUrl = getReceiptImageUrl(receipt);
                const ocrBadge = getOcrBadge(receipt.ocr_status);
                const displayVendor = receipt.vendor_name || receipt.ocr_vendor;
                const displayAmount = receipt.amount ?? receipt.ocr_amount;

                return (
                  <div
                    key={receipt.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden group"
                  >
                    {/* Thumbnail */}
                    <div
                      className="relative aspect-square bg-gray-100 dark:bg-gray-800 cursor-pointer"
                      onClick={() => setPreviewReceipt(receipt)}
                      role="button"
                      tabIndex={0}
                      aria-label={`Preview receipt: ${displayVendor || receipt.file_name}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setPreviewReceipt(receipt);
                        }
                      }}
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={`Receipt: ${displayVendor || receipt.file_name}`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FileText className="w-10 h-10 text-gray-400" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Eye className="w-6 h-6 text-white" />
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-2 space-y-1">
                      <p className="text-xs text-gray-900 dark:text-white font-medium truncate">
                        {displayVendor || receipt.file_name}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {displayAmount !== null && displayAmount !== undefined
                            ? formatCurrency(displayAmount)
                            : '-'}
                        </span>
                        {receipt.is_categorized ? (
                          <Badge variant="success" className="text-[10px] px-1.5 py-0.5">
                            <Link2 className="w-2.5 h-2.5 mr-0.5" />
                            Linked
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="text-[10px] px-1.5 py-0.5">
                            <Unlink className="w-2.5 h-2.5 mr-0.5" />
                            Unlinked
                          </Badge>
                        )}
                      </div>
                      {/* OCR status + delete */}
                      <div className="flex items-center justify-between">
                        <Badge variant={ocrBadge.variant} className="text-[10px] px-1.5 py-0.5">
                          {ocrBadge.label}
                        </Badge>
                        {canDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(receipt);
                            }}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                            aria-label={`Delete receipt: ${displayVendor || receipt.file_name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4">
                <PaginationControls
                  currentPage={page}
                  totalPages={totalPages}
                  onNext={() => setPage((p) => Math.min(p + 1, totalPages))}
                  onPrevious={() => setPage((p) => Math.max(p - 1, 1))}
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* Upload Receipt Modal (shared component with OCR polling) */}
      <ReceiptUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => {
          setShowUploadModal(false);
          loadReceipts();
          onDataChange();
        }}
        defaultProjectId={projectId}
      />

      {/* Preview Modal with OCR data */}
      {previewReceipt && (
        <Modal
          isOpen={!!previewReceipt}
          onClose={() => setPreviewReceipt(null)}
          title={previewReceipt.vendor_name || previewReceipt.ocr_vendor || previewReceipt.file_name}
          size="xl"
        >
          <div className="space-y-4">
            {/* Receipt image/PDF */}
            {previewReceipt.file_type === 'photo' ? (
              <a
                href={buildFileUrl(previewReceipt.file_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block"
                aria-label="View full-size receipt image"
              >
                <img
                  src={buildFileUrl(previewReceipt.file_url)}
                  alt={`Receipt: ${previewReceipt.file_name}`}
                  className="w-full rounded-lg group-hover:opacity-90 transition-opacity"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-black/50 rounded-full p-3">
                    <Eye className="w-6 h-6 text-white" />
                  </div>
                </div>
              </a>
            ) : (
              <div className="text-center py-8">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">PDF Document</p>
                {previewReceipt.file_size_bytes && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {formatFileSize(previewReceipt.file_size_bytes)}
                  </p>
                )}
                <a
                  href={buildFileUrl(previewReceipt.file_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm mt-2 inline-block"
                >
                  Open PDF
                </a>
              </div>
            )}

            {/* Receipt metadata */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Vendor:</span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {previewReceipt.vendor_name || previewReceipt.ocr_vendor || '-'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {formatCurrency(previewReceipt.amount ?? previewReceipt.ocr_amount)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Date:</span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {formatDate(previewReceipt.receipt_date || previewReceipt.ocr_date)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Status:</span>
                <span className="ml-2">
                  {previewReceipt.is_categorized ? (
                    <Badge variant="success">Linked</Badge>
                  ) : (
                    <Badge variant="warning">Unlinked</Badge>
                  )}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">OCR:</span>
                <span className="ml-2">
                  <Badge variant={getOcrBadge(previewReceipt.ocr_status).variant}>
                    {getOcrBadge(previewReceipt.ocr_status).label}
                  </Badge>
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">File:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{previewReceipt.file_name}</span>
              </div>
              {previewReceipt.file_size_bytes && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Size:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">
                    {formatFileSize(previewReceipt.file_size_bytes)}
                  </span>
                </div>
              )}
              <div>
                <span className="text-gray-500 dark:text-gray-400">Uploaded:</span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {formatDate(previewReceipt.created_at)}
                </span>
              </div>
            </div>

            {/* OCR Extracted Data (when OCR is complete) */}
            {previewReceipt.ocr_status === 'complete' && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                  OCR Extracted Data
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
                  {previewReceipt.ocr_vendor && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Vendor</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {previewReceipt.ocr_vendor}
                      </span>
                    </div>
                  )}
                  {previewReceipt.ocr_date && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Date</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {formatDate(previewReceipt.ocr_date)}
                        {previewReceipt.ocr_time ? ` at ${previewReceipt.ocr_time}` : ''}
                      </span>
                    </div>
                  )}
                  {previewReceipt.ocr_entry_type && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Type</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                        {previewReceipt.ocr_entry_type === 'refund' ? 'Refund (Income)' : 'Expense'}
                      </span>
                    </div>
                  )}

                  {/* Line items */}
                  {previewReceipt.ocr_line_items && previewReceipt.ocr_line_items.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-600 space-y-1">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                        Items
                      </span>
                      {previewReceipt.ocr_line_items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="text-gray-700 dark:text-gray-300 truncate mr-2">
                            {item.quantity > 1 ? `${item.quantity}\u00D7 ` : ''}
                            {item.description}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                            {formatCurrency(item.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Totals */}
                  <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-600 space-y-1">
                    {previewReceipt.ocr_subtotal != null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                        <span className="text-gray-900 dark:text-gray-100">
                          {formatCurrency(previewReceipt.ocr_subtotal)}
                        </span>
                      </div>
                    )}
                    {previewReceipt.ocr_tax != null && previewReceipt.ocr_tax > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Tax</span>
                        <span className="text-gray-900 dark:text-gray-100">
                          {formatCurrency(previewReceipt.ocr_tax)}
                        </span>
                      </div>
                    )}
                    {previewReceipt.ocr_discount != null && previewReceipt.ocr_discount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Discount</span>
                        <span className="text-green-600 dark:text-green-400">
                          -{formatCurrency(previewReceipt.ocr_discount)}
                        </span>
                      </div>
                    )}
                    {previewReceipt.ocr_amount != null && (
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-gray-700 dark:text-gray-300">Total</span>
                        <span className="text-gray-900 dark:text-gray-100">
                          {formatCurrency(previewReceipt.ocr_amount)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {previewReceipt.ocr_notes && (
                    <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-600">
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {previewReceipt.ocr_notes}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Delete from preview */}
            {canDelete && (
              <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setDeleteTarget(previewReceipt);
                    setPreviewReceipt(null);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete Receipt
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Receipt"
        message={
          deleteTarget?.is_categorized
            ? `"${deleteTarget?.vendor_name || deleteTarget?.ocr_vendor || deleteTarget?.file_name}" is linked to a financial entry. This will unlink the receipt from the entry and permanently delete the file. The financial entry will remain. This action cannot be undone.`
            : `Are you sure you want to delete "${deleteTarget?.vendor_name || deleteTarget?.ocr_vendor || deleteTarget?.file_name}"? This will permanently remove the receipt and its file. This action cannot be undone.`
        }
        confirmText={deleteTarget?.is_categorized ? 'Unlink & Delete' : 'Delete'}
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      />
    </>
  );
}
