/**
 * EntryCard Component
 * Displays a single financial entry in card format
 * Sprint 8 — Task 3
 */

'use client';

import React from 'react';
import {
  Calendar,
  Eye,
  Edit2,
  Trash2,
  Paperclip,
  RefreshCw,
  FolderOpen,
  User,
  CreditCard,
  Tag,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import type { FinancialEntry } from '@/lib/types/financial';

// ========== HELPERS ==========

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPaymentMethod(method: string | null, nickname: string | null): string | null {
  if (!method) return null;
  const label = method
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  if (nickname) return `${label} — ${nickname}`;
  return label;
}

const CATEGORY_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  labor: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300' },
  material: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-300' },
  subcontractor: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-300' },
  equipment: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-800 dark:text-indigo-300' },
  insurance: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-800 dark:text-cyan-300' },
  fuel: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-300' },
  utilities: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-800 dark:text-teal-300' },
  office: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-800 dark:text-gray-300' },
  marketing: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-800 dark:text-pink-300' },
  taxes: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300' },
  tools: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-800 dark:text-emerald-300' },
  other: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-800 dark:text-slate-300' },
};

// ========== ENTRY CARD ==========

interface EntryCardProps {
  entry: FinancialEntry;
  canDelete: boolean;
  onView: (entry: FinancialEntry) => void;
  onEdit: (entry: FinancialEntry) => void;
  onDelete: (entry: FinancialEntry) => void;
  /** Show resubmit button for rejected entries owned by current user */
  canResubmit?: boolean;
  onResubmit?: (entry: FinancialEntry) => void;
}

export function EntryCard({ entry, canDelete, onView, onEdit, onDelete, canResubmit, onResubmit }: EntryCardProps) {
  const amount = parseFloat(entry.amount);
  const isExpense = entry.entry_type === 'expense';
  const typeColors = CATEGORY_TYPE_COLORS[entry.category_type] || CATEGORY_TYPE_COLORS.other;
  const paymentDisplay = formatPaymentMethod(entry.payment_method, entry.payment_method_nickname);
  const isRejected = entry.submission_status === 'denied';

  const purchasedBy = entry.purchased_by_user_name || entry.purchased_by_crew_member_name;

  return (
    <Card className="p-4 sm:p-5 hover:shadow-md transition-shadow flex flex-col">
      {/* Header: Date + Amount */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 flex-shrink-0">
            <Calendar className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {formatDate(entry.entry_date)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isExpense ? (
            <TrendingDown className="h-4 w-4 text-red-500 dark:text-red-400" />
          ) : (
            <TrendingUp className="h-4 w-4 text-green-500 dark:text-green-400" />
          )}
          <span className={`text-lg font-bold ${isExpense ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
            {formatCurrency(amount)}
          </span>
        </div>
      </div>

      {/* Category with type badge */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${typeColors.bg} ${typeColors.text}`}>
          <Tag className="w-3 h-3" />
          {entry.category_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
        </span>
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
          {entry.category_name}
        </span>
      </div>

      {/* Info rows */}
      <div className="space-y-1.5 mb-3 flex-1">
        {/* Project & Task */}
        {entry.project_name && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">
              {entry.project_name}
              {entry.task_title && <span className="text-gray-400 dark:text-gray-500"> — {entry.task_title}</span>}
            </span>
          </div>
        )}

        {/* Supplier/Vendor */}
        {(entry.supplier_name || entry.vendor_name) && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Tag className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{entry.supplier_name || entry.vendor_name}</span>
          </div>
        )}

        {/* Payment Method */}
        {paymentDisplay && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <CreditCard className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{paymentDisplay}</span>
          </div>
        )}

        {/* Purchased by */}
        {purchasedBy && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <User className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">Purchased by {purchasedBy}</span>
          </div>
        )}

        {/* Created by */}
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-500">
          <User className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">Created by {entry.created_by_name}</span>
        </div>
      </div>

      {/* Status badges and indicators */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {/* Submission status */}
        {isRejected ? (
          <Badge variant="danger" label="Denied" />
        ) : entry.submission_status === 'confirmed' ? (
          <Badge variant="success" label="Confirmed" />
        ) : (
          <Badge variant="warning" label="Pending Review" />
        )}

        {/* Receipt indicator */}
        {entry.has_receipt && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400" title="Has receipt">
            <Paperclip className="w-3.5 h-3.5" />
            Receipt
          </span>
        )}

        {/* Recurring indicator */}
        {entry.is_recurring_instance && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400" title="Recurring entry">
            <RefreshCw className="w-3.5 h-3.5" />
            Recurring
          </span>
        )}
      </div>

      {/* Rejection Banner — shown when entry is rejected and user can resubmit */}
      {isRejected && canResubmit && (
        <div className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
                Rejected
              </p>
              {entry.rejection_reason && (
                <p className="text-sm text-amber-700 dark:text-amber-300/80 break-words">
                  &ldquo;{entry.rejection_reason}&rdquo;
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <Button variant="secondary" size="sm" onClick={() => onView(entry)} className="flex-1 min-w-[70px]">
          <Eye className="w-4 h-4" />
          View
        </Button>
        {canResubmit && onResubmit ? (
          <Button variant="primary" size="sm" onClick={() => onResubmit(entry)} className="flex-1 min-w-[70px]">
            <RotateCcw className="w-4 h-4" />
            Resubmit
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => onEdit(entry)} className="flex-1 min-w-[70px]">
            <Edit2 className="w-4 h-4" />
            Edit
          </Button>
        )}
        {canDelete && (
          <Button variant="danger" size="sm" onClick={() => onDelete(entry)} className="flex-1 min-w-[70px]">
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        )}
      </div>
    </Card>
  );
}

// ========== SKELETON ==========

export function EntryCardSkeleton() {
  return (
    <Card className="p-4 sm:p-5 animate-pulse">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
        </div>
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20" />
      </div>
      <div className="flex gap-2 mb-3">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-16" />
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-28" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
      </div>
      <div className="flex gap-2 mb-3">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20" />
      </div>
      <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded flex-1" />
      </div>
    </Card>
  );
}

export default EntryCard;
