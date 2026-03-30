/**
 * Receipts Management Page
 * Global list of all receipts with filters, preview, and delete for unlinked receipts.
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  FileText,
  Eye,
  Trash2,
  Filter,
  X,
  FileImage,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  Link2,
  Unlink,
  Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRBAC } from '@/contexts/RBACContext';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import {
  getReceipts,
  deleteReceipt,
  unlinkReceipt,
} from '@/lib/api/financial';
import { getProjects } from '@/lib/api/projects';
import { buildFileUrl } from '@/lib/api/files';
import type { Receipt, PaginatedResponse, OcrStatus } from '@/lib/types/financial';
import { getPageCount } from '@/lib/types/financial';
import type { Project } from '@/lib/types/projects';
import { ReceiptUploadModal } from '@/app/(dashboard)/financial/entries/components/ReceiptUploadModal';

// ========== CONSTANTS ==========

const PAGE_SIZE = 20;

const CAN_VIEW_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];
const CAN_DELETE_ROLES = ['Owner', 'Admin', 'Manager', 'Bookkeeper'];

const LINKED_STATUS_OPTIONS = [
  { value: '', label: 'All Receipts' },
  { value: 'true', label: 'Linked' },
  { value: 'false', label: 'Unlinked' },
];

const OCR_STATUS_OPTIONS = [
  { value: '', label: 'All OCR Status' },
  { value: 'complete', label: 'Complete' },
  { value: 'processing', label: 'Processing' },
  { value: 'failed', label: 'Failed' },
  { value: 'not_processed', label: 'Not Processed' },
];

// ========== HELPERS ==========

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
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
      return { variant: 'success' as const, icon: CheckCircle, label: 'OCR Complete' };
    case 'processing':
      return { variant: 'blue' as const, icon: Loader2, label: 'Processing' };
    case 'failed':
      return { variant: 'danger' as const, icon: AlertCircle, label: 'OCR Failed' };
    case 'not_processed':
      return { variant: 'gray' as const, icon: Clock, label: 'Not Processed' };
    default:
      return { variant: 'gray' as const, icon: Clock, label: status };
  }
}

// ========== COMPONENT ==========

export default function ReceiptsPage() {
  const { hasRole } = useRBAC();
  const canView = hasRole(CAN_VIEW_ROLES);
  const canDelete = hasRole(CAN_DELETE_ROLES);

  // Data
  const [receipts, setReceipts] = useState<PaginatedResponse<Receipt> | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [linkedFilter, setLinkedFilter] = useState('');
  const [ocrFilter, setOcrFilter] = useState('');
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Upload modal
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Preview modal
  const [previewReceipt, setPreviewReceipt] = useState<Receipt | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<Receipt | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Search debounce
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  // Load projects for filter dropdown
  useEffect(() => {
    getProjects({ limit: 200 })
      .then((res) => setProjects(res.data))
      .catch(() => setProjects([]));
  }, []);

  // Load receipts
  const loadReceipts = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params: Record<string, string | number | boolean> = {
        page: currentPage,
        limit: PAGE_SIZE,
      };
      if (projectFilter) params.project_id = projectFilter;
      if (linkedFilter) params.is_categorized = linkedFilter === 'true';
      // Note: search and ocr_status filtering are done client-side since the API
      // may not support these filters yet. If backend adds them, move to params.

      const data = await getReceipts(params);
      setReceipts(data);
      setTotalPages(getPageCount(data.meta));
    } catch {
      setFetchError('Failed to load receipts');
      toast.error('Failed to load receipts');
    } finally {
      setLoading(false);
    }
  }, [currentPage, projectFilter, linkedFilter]);

  useEffect(() => {
    if (canView) loadReceipts();
  }, [loadReceipts, canView]);

  // Client-side filtering for search and OCR status
  const filteredReceipts = receipts?.data.filter((r) => {
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      const matchVendor = r.vendor_name?.toLowerCase().includes(q);
      const matchFile = r.file_name?.toLowerCase().includes(q);
      if (!matchVendor && !matchFile) return false;
    }
    if (ocrFilter && r.ocr_status !== ocrFilter) return false;
    return true;
  }) ?? [];

  // Delete handler — unlinks first if linked, then deletes
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // If linked, unlink first
      if (deleteTarget.is_categorized && deleteTarget.financial_entry_id) {
        await unlinkReceipt(deleteTarget.id);
      }
      await deleteReceipt(deleteTarget.id);
      toast.success('Receipt deleted');
      setDeleteTarget(null);
      loadReceipts();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to delete receipt');
    } finally {
      setDeleting(false);
    }
  };

  // Clear filters
  const clearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setProjectFilter('');
    setLinkedFilter('');
    setOcrFilter('');
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || projectFilter || linkedFilter || ocrFilter;

  // Project options for filter
  const projectOptions = [
    { value: '', label: 'All Projects' },
    ...projects.map((p) => ({ value: p.id, label: p.name })),
  ];

  // Find project name for a receipt
  const getProjectName = (projectId: string | null) => {
    if (!projectId) return '-';
    return projects.find((p) => p.id === projectId)?.name || '-';
  };

  // RBAC guard
  if (!canView) {
    return (
      <div className="p-6">
        <Card className="p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">You do not have permission to view receipts.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: 'Financial', href: '/financial' },
          { label: 'Receipts' },
        ]}
        showHome
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Receipts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage uploaded receipts, view OCR results, and clean up unlinked files.
          </p>
        </div>
        <Button onClick={() => setShowUploadModal(true)} className="flex items-center gap-1.5">
          <Upload className="w-4 h-4" />
          Upload Receipt
        </Button>
      </div>

      {/* Search + Filter Toggle */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by vendor or file name..."
              leftIcon={<Search className="w-5 h-5" />}
              rightIcon={
                searchQuery ? (
                  <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                ) : undefined
              }
            />
          </div>
          <Button
            variant={showFilters ? 'primary' : 'secondary'}
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5"
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 w-2 h-2 rounded-full bg-blue-400" />
            )}
          </Button>
        </div>

        {/* Filter row */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Select
              options={projectOptions}
              value={projectFilter}
              onChange={(v) => { setProjectFilter(v); setCurrentPage(1); }}
              placeholder="All Projects"
              searchable
            />
            <Select
              options={LINKED_STATUS_OPTIONS}
              value={linkedFilter}
              onChange={(v) => { setLinkedFilter(v); setCurrentPage(1); }}
              placeholder="All Receipts"
            />
            <Select
              options={OCR_STATUS_OPTIONS}
              value={ocrFilter}
              onChange={(v) => { setOcrFilter(v); setCurrentPage(1); }}
              placeholder="All OCR Status"
            />
            {hasActiveFilters && (
              <div className="sm:col-span-3">
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Content */}
      {loading ? (
        <Card className="p-12">
          <LoadingSpinner size="lg" centered />
        </Card>
      ) : fetchError ? (
        <Card className="p-12 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 dark:text-gray-300">{fetchError}</p>
          <Button variant="secondary" onClick={loadReceipts} className="mt-4">
            Retry
          </Button>
        </Card>
      ) : filteredReceipts.length === 0 ? (
        <Card className="p-12 text-center">
          <FileImage className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            {hasActiveFilters ? 'No receipts match your filters.' : 'No receipts uploaded yet.'}
          </p>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
              Clear filters
            </button>
          )}
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block">
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="py-3 px-3 text-left font-semibold text-gray-600 dark:text-gray-300 w-12" />
                      <th className="py-3 px-3 text-left font-semibold text-gray-600 dark:text-gray-300">File</th>
                      <th className="py-3 px-3 text-left font-semibold text-gray-600 dark:text-gray-300">Vendor</th>
                      <th className="py-3 px-3 text-right font-semibold text-gray-600 dark:text-gray-300">Amount</th>
                      <th className="py-3 px-3 text-left font-semibold text-gray-600 dark:text-gray-300">Date</th>
                      <th className="py-3 px-3 text-center font-semibold text-gray-600 dark:text-gray-300">OCR</th>
                      <th className="py-3 px-3 text-center font-semibold text-gray-600 dark:text-gray-300">Status</th>
                      <th className="py-3 px-3 text-left font-semibold text-gray-600 dark:text-gray-300">Project</th>
                      <th className="py-3 px-3 text-right font-semibold text-gray-600 dark:text-gray-300 w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReceipts.map((r) => {
                      const ocrBadge = getOcrBadge(r.ocr_status);
                      const imageUrl = r.file_type === 'photo' ? buildFileUrl(r.file_url) : null;
                      return (
                        <tr
                          key={r.id}
                          className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          {/* Thumbnail */}
                          <td className="py-2 px-3">
                            <div
                              className="w-10 h-10 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden cursor-pointer flex items-center justify-center"
                              onClick={() => setPreviewReceipt(r)}
                            >
                              {imageUrl ? (
                                <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <FileText className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                          </td>
                          {/* File name */}
                          <td className="py-3 px-3">
                            <button
                              onClick={() => setPreviewReceipt(r)}
                              className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate max-w-[180px] block text-left"
                            >
                              {r.file_name}
                            </button>
                            <p className="text-xs text-gray-400">{formatFileSize(r.file_size_bytes)}</p>
                          </td>
                          {/* Vendor */}
                          <td className="py-3 px-3 text-gray-700 dark:text-gray-300">
                            {r.vendor_name || r.ocr_vendor || '-'}
                          </td>
                          {/* Amount */}
                          <td className="py-3 px-3 text-right font-medium text-gray-900 dark:text-white whitespace-nowrap">
                            {formatCurrency(r.amount ?? r.ocr_amount)}
                          </td>
                          {/* Date */}
                          <td className="py-3 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {formatDate(r.receipt_date || r.ocr_date)}
                          </td>
                          {/* OCR status */}
                          <td className="py-3 px-3 text-center">
                            <Badge variant={ocrBadge.variant} icon={ocrBadge.icon}>
                              {ocrBadge.label}
                            </Badge>
                          </td>
                          {/* Linked status */}
                          <td className="py-3 px-3 text-center">
                            {r.is_categorized ? (
                              <Badge variant="success" icon={Link2}>Linked</Badge>
                            ) : (
                              <Badge variant="warning" icon={Unlink}>Unlinked</Badge>
                            )}
                          </td>
                          {/* Project */}
                          <td className="py-3 px-3 text-gray-500 dark:text-gray-400 truncate max-w-[150px]">
                            {getProjectName(r.project_id)}
                          </td>
                          {/* Actions */}
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setPreviewReceipt(r)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                aria-label="Preview receipt"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              {canDelete && (
                                <button
                                  onClick={() => setDeleteTarget(r)}
                                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                  aria-label="Delete receipt"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filteredReceipts.map((r) => {
              const ocrBadge = getOcrBadge(r.ocr_status);
              const imageUrl = r.file_type === 'photo' ? buildFileUrl(r.file_url) : null;
              return (
                <Card key={r.id} className="p-4">
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    <div
                      className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0 cursor-pointer flex items-center justify-center"
                      onClick={() => setPreviewReceipt(r)}
                    >
                      {imageUrl ? (
                        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <FileText className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {r.vendor_name || r.file_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatDate(r.receipt_date || r.ocr_date)}
                        {r.amount !== null && ` \u00B7 ${formatCurrency(r.amount)}`}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={ocrBadge.variant} className="text-[10px]">{ocrBadge.label}</Badge>
                        {r.is_categorized ? (
                          <Badge variant="success" className="text-[10px]">Linked</Badge>
                        ) : (
                          <Badge variant="warning" className="text-[10px]">Unlinked</Badge>
                        )}
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setPreviewReceipt(r)}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
                        aria-label="Preview receipt"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canDelete && !r.is_categorized && (
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-red-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
                          aria-label="Delete receipt"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              onNext={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              onPrevious={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            />
          )}
        </>
      )}

      {/* Preview Modal */}
      {previewReceipt && (
        <Modal
          isOpen={!!previewReceipt}
          onClose={() => setPreviewReceipt(null)}
          title={previewReceipt.vendor_name || previewReceipt.file_name}
          size="xl"
        >
          <div className="space-y-4">
            {previewReceipt.file_type === 'photo' ? (
              <img
                src={buildFileUrl(previewReceipt.file_url)}
                alt={previewReceipt.file_name}
                className="w-full rounded-lg"
              />
            ) : (
              <div className="text-center py-8">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">PDF file</p>
                <a
                  href={buildFileUrl(previewReceipt.file_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm mt-2 inline-block"
                >
                  Open PDF
                </a>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Vendor:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{previewReceipt.vendor_name || previewReceipt.ocr_vendor || '-'}</span>
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
                <span className="text-gray-500 dark:text-gray-400">Project:</span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {getProjectName(previewReceipt.project_id)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">File:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{previewReceipt.file_name}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Size:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{formatFileSize(previewReceipt.file_size_bytes)}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Uploaded:</span>
                <span className="ml-2 text-gray-900 dark:text-white">{formatDate(previewReceipt.created_at)}</span>
              </div>
              {previewReceipt.uploaded_by && (
                <div>
                  <span className="text-gray-500 dark:text-gray-400">By:</span>
                  <span className="ml-2 text-gray-900 dark:text-white">
                    {previewReceipt.uploaded_by.first_name} {previewReceipt.uploaded_by.last_name}
                  </span>
                </div>
              )}
            </div>

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
            ? `"${deleteTarget?.vendor_name || deleteTarget?.file_name}" is linked to a financial entry. This will unlink the receipt from the entry and permanently delete the file. The financial entry will remain. This action cannot be undone.`
            : `Are you sure you want to delete "${deleteTarget?.vendor_name || deleteTarget?.file_name}"? This will permanently remove the receipt and its file. This action cannot be undone.`
        }
        confirmText={deleteTarget?.is_categorized ? 'Unlink & Delete' : 'Delete'}
        cancelText="Cancel"
        variant="danger"
        loading={deleting}
      />

      {/* Upload Receipt Modal */}
      <ReceiptUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => {
          setShowUploadModal(false);
          loadReceipts();
        }}
      />
    </div>
  );
}
