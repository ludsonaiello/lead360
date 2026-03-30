/**
 * EntryDetailModal Component
 * Read-only modal showing all entry fields organized in sections
 * Sprint 8 — Task 4, Sprint 12 — Receipt viewer section
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  FolderOpen,
  Tag,
  CreditCard,
  User,
  Paperclip,
  RefreshCw,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
} from 'lucide-react';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getReceipts } from '@/lib/api/financial';
import { buildFileUrl } from '@/lib/api/files';
import type { FinancialEntry, Receipt } from '@/lib/types/financial';

// ========== HELPERS ==========

function formatCurrency(value: string | number | null): string {
  if (value === null || value === undefined) return '—';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatPaymentMethod(method: string | null): string {
  if (!method) return '—';
  return method
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCategoryType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatClassification(classification: string): string {
  return classification === 'cost_of_goods_sold' ? 'COGS (Cost of Goods Sold)' : 'Operating Expense';
}

// ========== DETAIL ROW ==========

interface DetailRowProps {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3 py-2">
      {icon && (
        <div className="flex-shrink-0 mt-0.5 text-gray-400 dark:text-gray-500">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-0.5">
          {label}
        </p>
        <div className="text-sm font-medium text-gray-900 dark:text-white break-words">
          {value || <span className="text-gray-400 dark:text-gray-500">—</span>}
        </div>
      </div>
    </div>
  );
}

// ========== SECTION ==========

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
        {title}
      </h3>
      <div className="space-y-0.5">
        {children}
      </div>
    </div>
  );
}

// ========== MODAL ==========

interface EntryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: FinancialEntry | null;
  loading: boolean;
}

export function EntryDetailModal({ isOpen, onClose, entry, loading }: EntryDetailModalProps) {
  const isExpense = entry?.entry_type === 'expense';
  const isRejected = entry?.submission_status === 'denied';
  const amount = entry ? parseFloat(entry.amount) : 0;

  // Receipt data for entries with has_receipt
  const [linkedReceipt, setLinkedReceipt] = useState<Receipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !entry?.has_receipt) {
      setLinkedReceipt(null);
      return;
    }

    // Fetch receipt linked to this entry.
    // Receipt's own project_id may differ from the entry's, so we query
    // without project filter and match by financial_entry_id.
    const fetchReceipt = async () => {
      setReceiptLoading(true);
      try {
        const result = await getReceipts({ is_categorized: true, limit: 100 });
        const match = result.data.find((r) => r.financial_entry_id === entry.id);
        if (match) {
          setLinkedReceipt(match);
        }
      } catch {
        // Silently fail — fallback UI shown
      } finally {
        setReceiptLoading(false);
      }
    };

    fetchReceipt();
  }, [isOpen, entry?.has_receipt, entry?.id]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Entry Details" size="lg">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : !entry ? (
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Entry not found</p>
        </div>
      ) : (
        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
          {/* Amount header */}
          <div className="text-center py-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              {isExpense ? 'Expense' : 'Income'}
            </p>
            <p className={`text-3xl font-bold ${isExpense ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {formatCurrency(amount)}
            </p>
            {entry.tax_amount && parseFloat(entry.tax_amount) > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Tax: {formatCurrency(entry.tax_amount)}
              </p>
            )}
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {isRejected ? (
              <Badge variant="danger" icon={XCircle} label="Denied" />
            ) : entry.submission_status === 'confirmed' ? (
              <Badge variant="success" icon={CheckCircle2} label="Confirmed" />
            ) : (
              <Badge variant="warning" icon={AlertCircle} label="Pending Review" />
            )}
            {entry.has_receipt && (
              <Badge variant="info" icon={Paperclip} label="Has Receipt" />
            )}
            {entry.is_recurring_instance && (
              <Badge variant="purple" icon={RefreshCw} label="Recurring" />
            )}
          </div>

          {/* Receipt — shown when has_receipt is true */}
          {entry.has_receipt && (
            <Section title="Receipt">
              {receiptLoading ? (
                <div className="flex items-center justify-center py-4">
                  <LoadingSpinner size="sm" />
                </div>
              ) : linkedReceipt ? (
                <div className="py-2">
                  {linkedReceipt.file_type === 'photo' ? (
                    <a
                      href={buildFileUrl(linkedReceipt.file_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative inline-block"
                      aria-label="View full-size receipt"
                    >
                      <img
                        src={buildFileUrl(linkedReceipt.file_url)}
                        alt={`Receipt: ${linkedReceipt.file_name}`}
                        className="max-h-48 rounded-lg object-contain border border-gray-200 dark:border-gray-600 group-hover:opacity-90 transition-opacity"
                      />
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-black/50 rounded-full p-2">
                          <Eye className="w-5 h-5 text-white" />
                        </div>
                      </div>
                    </a>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                      <FileText className="w-8 h-8 text-red-500 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {linkedReceipt.file_name}
                        </p>
                        <a
                          href={buildFileUrl(linkedReceipt.file_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Open PDF
                        </a>
                      </div>
                    </div>
                  )}
                  {/* OCR extracted info */}
                  {(linkedReceipt.ocr_vendor || linkedReceipt.ocr_amount) && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                      {linkedReceipt.ocr_vendor && (
                        <p>OCR Vendor: {linkedReceipt.ocr_vendor}</p>
                      )}
                      {linkedReceipt.ocr_amount != null && (
                        <p>OCR Amount: {formatCurrency(linkedReceipt.ocr_amount)}</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-3 text-center">
                  <Paperclip className="w-6 h-6 text-gray-400 dark:text-gray-500 mx-auto mb-1" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">Receipt attached but could not be loaded.</p>
                  <button
                    onClick={() => {
                      setLinkedReceipt(null);
                      setReceiptLoading(true);
                      getReceipts({ is_categorized: true, limit: 100 })
                        .then((result) => {
                          const match = result.data.find((r) => r.financial_entry_id === entry.id);
                          if (match) setLinkedReceipt(match);
                        })
                        .catch(() => {})
                        .finally(() => setReceiptLoading(false));
                    }}
                    className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Retry
                  </button>
                </div>
              )}
            </Section>
          )}

          {/* Category & Classification */}
          <Section title="Category">
            <DetailRow
              icon={<Tag className="w-4 h-4" />}
              label="Category"
              value={entry.category_name}
            />
            <DetailRow
              label="Type"
              value={formatCategoryType(entry.category_type)}
            />
            <DetailRow
              label="Classification"
              value={formatClassification(entry.category_classification)}
            />
          </Section>

          {/* Date & Time */}
          <Section title="Date & Time">
            <DetailRow
              icon={<Calendar className="w-4 h-4" />}
              label="Entry Date"
              value={formatDate(entry.entry_date)}
            />
            {entry.entry_time && (
              <DetailRow
                icon={<Clock className="w-4 h-4" />}
                label="Entry Time"
                value={entry.entry_time}
              />
            )}
          </Section>

          {/* Project & Task */}
          {(entry.project_name || entry.task_title) && (
            <Section title="Project">
              <DetailRow
                icon={<FolderOpen className="w-4 h-4" />}
                label="Project"
                value={entry.project_name}
              />
              {entry.task_title && (
                <DetailRow
                  label="Task"
                  value={entry.task_title}
                />
              )}
            </Section>
          )}

          {/* Vendor & Supplier */}
          {(entry.supplier_name || entry.vendor_name) && (
            <Section title="Vendor / Supplier">
              {entry.supplier_name && (
                <DetailRow
                  label="Supplier"
                  value={entry.supplier_name}
                />
              )}
              {entry.vendor_name && (
                <DetailRow
                  label="Vendor Name"
                  value={entry.vendor_name}
                />
              )}
            </Section>
          )}

          {/* Payment */}
          {entry.payment_method && (
            <Section title="Payment">
              <DetailRow
                icon={<CreditCard className="w-4 h-4" />}
                label="Payment Method"
                value={formatPaymentMethod(entry.payment_method)}
              />
              {entry.payment_method_nickname && (
                <DetailRow
                  label="Account"
                  value={entry.payment_method_nickname}
                />
              )}
            </Section>
          )}

          {/* People */}
          <Section title="People">
            {entry.purchased_by_user_name && (
              <DetailRow
                icon={<User className="w-4 h-4" />}
                label="Purchased By (User)"
                value={entry.purchased_by_user_name}
              />
            )}
            {entry.purchased_by_crew_member_name && (
              <DetailRow
                icon={<User className="w-4 h-4" />}
                label="Purchased By (Crew)"
                value={entry.purchased_by_crew_member_name}
              />
            )}
            <DetailRow
              icon={<User className="w-4 h-4" />}
              label="Created By"
              value={entry.created_by_name}
            />
          </Section>

          {/* Line Items */}
          {entry.has_line_items && entry.line_items && entry.line_items.length > 0 && (
            <Section title="Line Items">
              <div className="space-y-2">
                {entry.line_items.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {item.description}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {parseFloat(item.quantity)} {item.unit_of_measure || 'x'} @ ${parseFloat(item.unit_price).toFixed(2)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white ml-3">
                      ${parseFloat(item.total).toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-500 dark:text-gray-400">Items Subtotal</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    ${(entry.items_subtotal || 0).toFixed(2)}
                  </span>
                </div>
                {entry.discount && parseFloat(entry.discount) > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Discount</span>
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      -${parseFloat(entry.discount).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Notes */}
          {entry.notes && (
            <Section title="Notes">
              <DetailRow
                icon={<FileText className="w-4 h-4" />}
                label="Notes"
                value={
                  <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {entry.notes}
                  </p>
                }
              />
            </Section>
          )}

          {/* Rejection History */}
          {isRejected && (
            <Section title="Rejection Details">
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 space-y-2">
                <DetailRow
                  icon={<XCircle className="w-4 h-4 text-red-500" />}
                  label="Rejection Reason"
                  value={
                    entry.rejection_reason ? (
                      <p className="text-red-700 dark:text-red-300">
                        {entry.rejection_reason}
                      </p>
                    ) : null
                  }
                />
                {entry.rejected_by_name && (
                  <DetailRow
                    label="Rejected By"
                    value={entry.rejected_by_name}
                  />
                )}
                {entry.rejected_at && (
                  <DetailRow
                    label="Rejected At"
                    value={formatDateTime(entry.rejected_at)}
                  />
                )}
              </div>
            </Section>
          )}

          {/* Metadata */}
          <Section title="Metadata">
            <DetailRow
              label="Created At"
              value={formatDateTime(entry.created_at)}
            />
            <DetailRow
              label="Updated At"
              value={formatDateTime(entry.updated_at)}
            />
            {entry.is_recurring_instance && entry.recurring_rule_id && (
              <DetailRow
                label="Recurring Rule ID"
                value={
                  <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                    {entry.recurring_rule_id}
                  </span>
                }
              />
            )}
          </Section>
        </div>
      )}

      <ModalActions>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </ModalActions>
    </Modal>
  );
}

export default EntryDetailModal;
