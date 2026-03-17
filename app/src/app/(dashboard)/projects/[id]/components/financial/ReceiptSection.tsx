'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { MoneyInput } from '@/components/ui/MoneyInput';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { PaginationControls } from '@/components/ui/PaginationControls';
import {
  Upload,
  Camera,
  FileText,
  Link2,
  X,
  Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  uploadReceipt,
  getReceipts,
  linkReceiptToEntry,
  getFinancialEntries,
} from '@/lib/api/financial';
import { formatCurrency, formatDate, getFileUrl } from '@/lib/api/projects';
import type { Receipt, FinancialEntry, PaginatedResponse } from '@/lib/types/financial';

interface ReceiptSectionProps {
  projectId: string;
  onDataChange: () => void;
}

export default function ReceiptSection({ projectId, onDataChange }: ReceiptSectionProps) {
  const [receipts, setReceipts] = useState<PaginatedResponse<Receipt> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);

  // Upload form
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadVendor, setUploadVendor] = useState('');
  const [uploadAmount, setUploadAmount] = useState(0);
  const [uploadDate, setUploadDate] = useState('');

  // Link modal
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkReceipt, setLinkReceipt] = useState<Receipt | null>(null);
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState('');
  const [linking, setLinking] = useState(false);

  // Preview modal
  const [previewReceipt, setPreviewReceipt] = useState<Receipt | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Accepted: JPG, PNG, WebP, PDF');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size must be under 25 MB');
      return;
    }

    setUploadFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setUploadPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setUploadPreview(null);
    }
    setShowUploadModal(true);
  };

  const loadReceipts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getReceipts({ project_id: projectId, page, limit: 20 });
      setReceipts(data);
    } catch {
      toast.error('Failed to load receipts');
    } finally {
      setLoading(false);
    }
  }, [projectId, page]);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Accepted: JPG, PNG, WebP, PDF');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File size must be under 25 MB');
      return;
    }

    setUploadFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setUploadPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setUploadPreview(null);
    }
    setShowUploadModal(true);
  };

  const handleUpload = async () => {
    if (!uploadFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('project_id', projectId);
      if (uploadVendor) formData.append('vendor_name', uploadVendor);
      if (uploadAmount > 0) formData.append('amount', uploadAmount.toString());
      if (uploadDate) formData.append('receipt_date', uploadDate);

      await uploadReceipt(formData);
      toast.success('Receipt uploaded');
      resetUploadForm();
      setShowUploadModal(false);
      loadReceipts();
      onDataChange();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to upload receipt');
    } finally {
      setUploading(false);
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadPreview(null);
    setUploadVendor('');
    setUploadAmount(0);
    setUploadDate('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const openLinkModal = async (receipt: Receipt) => {
    setLinkReceipt(receipt);
    setSelectedEntryId('');
    setShowLinkModal(true);

    try {
      const data = await getFinancialEntries({ project_id: projectId, limit: 100 });
      // Only show entries that don't already have a receipt
      setEntries(data.data.filter((e) => !e.has_receipt));
    } catch {
      toast.error('Failed to load cost entries');
    }
  };

  const handleLink = async () => {
    if (!linkReceipt || !selectedEntryId) return;

    setLinking(true);
    try {
      await linkReceiptToEntry(linkReceipt.id, { financial_entry_id: selectedEntryId });
      toast.success('Receipt linked to cost entry');
      setShowLinkModal(false);
      setLinkReceipt(null);
      loadReceipts();
      onDataChange();
    } catch (err: unknown) {
      const error = err as { message?: string };
      toast.error(error.message || 'Failed to link receipt');
    } finally {
      setLinking(false);
    }
  };

  const getReceiptImageUrl = (receipt: Receipt): string | null => {
    if (receipt.file_type === 'photo') {
      return getFileUrl(receipt.file_url);
    }
    return null;
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Receipts</h3>
          <div className="flex items-center gap-2">
            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Camera button (mobile) */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-1.5 sm:hidden"
            >
              <Camera className="w-4 h-4" />
              Camera
            </Button>

            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4" />
              Upload
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-12"><LoadingSpinner size="lg" centered /></div>
        ) : !receipts || receipts.data.length === 0 ? (
          <div
            className={`py-12 text-center border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
              isDragging
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-3">
              <Upload className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              {isDragging ? 'Drop receipt here' : 'Drag & drop or click to upload'}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">JPG, PNG, WebP, or PDF up to 25 MB</p>
          </div>
        ) : (
          <>
            <div
              className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-2 rounded-lg transition-colors ${
                isDragging ? 'border-2 border-dashed border-blue-400 bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {receipts.data.map((receipt) => {
                const imageUrl = getReceiptImageUrl(receipt);
                return (
                  <div
                    key={receipt.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden group"
                  >
                    {/* Thumbnail */}
                    <div
                      className="relative aspect-square bg-gray-100 dark:bg-gray-800 cursor-pointer"
                      onClick={() => setPreviewReceipt(receipt)}
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={receipt.file_name}
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
                    <div className="p-2">
                      <p className="text-xs text-gray-900 dark:text-white font-medium truncate">
                        {receipt.vendor_name || receipt.file_name}
                      </p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {receipt.amount !== null ? formatCurrency(receipt.amount) : '-'}
                        </span>
                        {receipt.is_categorized ? (
                          <Badge variant="success" className="text-[10px] px-1.5 py-0.5">Linked</Badge>
                        ) : (
                          <button
                            onClick={() => openLinkModal(receipt)}
                            className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                          >
                            <Link2 className="w-3 h-3" />
                            Link
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {receipts.meta.pages > 1 && (
              <div className="mt-4">
                <PaginationControls
                  currentPage={page}
                  totalPages={receipts.meta.pages}
                  onNext={() => setPage((p) => p + 1)}
                  onPrevious={() => setPage((p) => p - 1)}
                />
              </div>
            )}
          </>
        )}
      </Card>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => { setShowUploadModal(false); resetUploadForm(); }}
        title="Upload Receipt"
        size="lg"
      >
        <div className="space-y-4">
          {/* Preview */}
          {uploadPreview ? (
            <div className="relative">
              <img src={uploadPreview} alt="Receipt preview" className="max-h-48 rounded-lg mx-auto" />
              <button
                onClick={resetUploadForm}
                className="absolute top-2 right-2 p-1 bg-gray-900/70 rounded-full text-white hover:bg-gray-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : uploadFile ? (
            <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <FileText className="w-8 h-8 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{uploadFile.name}</p>
                <p className="text-xs text-gray-500">{(uploadFile.size / 1024).toFixed(0)} KB</p>
              </div>
            </div>
          ) : null}

          <Input
            label="Vendor Name"
            value={uploadVendor}
            onChange={(e) => setUploadVendor(e.target.value)}
            placeholder="e.g., Home Depot"
            maxLength={200}
          />

          <MoneyInput
            label="Amount"
            value={uploadAmount}
            onChange={setUploadAmount}
          />

          <DatePicker
            label="Receipt Date"
            value={uploadDate}
            onChange={(e) => setUploadDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
          />

          <ModalActions>
            <Button
              variant="secondary"
              onClick={() => { setShowUploadModal(false); resetUploadForm(); }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button onClick={handleUpload} loading={uploading} disabled={!uploadFile || uploading}>
              Upload Receipt
            </Button>
          </ModalActions>
        </div>
      </Modal>

      {/* Link Modal */}
      <Modal
        isOpen={showLinkModal}
        onClose={() => { setShowLinkModal(false); setLinkReceipt(null); }}
        title="Link Receipt to Cost Entry"
        size="lg"
      >
        <div className="space-y-4">
          {linkReceipt && (
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
              <p className="font-medium text-gray-900 dark:text-white">{linkReceipt.vendor_name || linkReceipt.file_name}</p>
              {linkReceipt.amount !== null && (
                <p className="text-gray-500">{formatCurrency(linkReceipt.amount)}</p>
              )}
            </div>
          )}

          <Select
            label="Select Cost Entry"
            required
            searchable
            options={entries.map((e) => ({
              value: e.id,
              label: `${formatDate(e.entry_date)} - ${e.category.name} - ${formatCurrency(typeof e.amount === 'string' ? parseFloat(e.amount) : e.amount)}${e.vendor_name ? ` (${e.vendor_name})` : ''}`,
            }))}
            value={selectedEntryId}
            onChange={setSelectedEntryId}
            placeholder="Select a cost entry to link"
          />

          <ModalActions>
            <Button
              variant="secondary"
              onClick={() => { setShowLinkModal(false); setLinkReceipt(null); }}
              disabled={linking}
            >
              Cancel
            </Button>
            <Button onClick={handleLink} loading={linking} disabled={!selectedEntryId || linking}>
              Link Receipt
            </Button>
          </ModalActions>
        </div>
      </Modal>

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
                src={getFileUrl(previewReceipt.file_url) || ''}
                alt={previewReceipt.file_name}
                className="w-full rounded-lg"
              />
            ) : (
              <div className="text-center py-8">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">PDF file</p>
                <a
                  href={getFileUrl(previewReceipt.file_url) || '#'}
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
                <span className="ml-2 text-gray-900 dark:text-white">{previewReceipt.vendor_name || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Amount:</span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {previewReceipt.amount !== null ? formatCurrency(previewReceipt.amount) : '-'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Date:</span>
                <span className="ml-2 text-gray-900 dark:text-white">
                  {previewReceipt.receipt_date ? formatDate(previewReceipt.receipt_date) : '-'}
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
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
