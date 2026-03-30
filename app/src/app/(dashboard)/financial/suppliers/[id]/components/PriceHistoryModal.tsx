/**
 * PriceHistoryModal — Supplier Product Price Change Timeline
 * Sprint 7 — Financial Frontend
 *
 * Shows chronological price changes with old -> new price,
 * who changed it, date, and optional notes.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Calendar, TrendingUp, User, FileText, History } from 'lucide-react';
import { getProductPriceHistory } from '@/lib/api/financial';
import type { PriceHistoryEntry } from '@/lib/types/financial';

// ========== HELPERS ==========

function formatCurrency4(value: string | null): string {
  if (!value) return '\u2014';
  const num = parseFloat(value);
  if (isNaN(num)) return '\u2014';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(num);
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ========== TYPES ==========

interface PriceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  productId: string;
  productName: string;
}

// ========== MAIN MODAL ==========

export default function PriceHistoryModal({
  isOpen,
  onClose,
  supplierId,
  productId,
  productName,
}: PriceHistoryModalProps) {
  const [entries, setEntries] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProductPriceHistory(supplierId, productId);
      setEntries(data);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr?.message || 'Failed to load price history');
    } finally {
      setLoading(false);
    }
  }, [supplierId, productId]);

  useEffect(() => {
    if (isOpen && productId) {
      loadHistory();
    }
  }, [isOpen, productId, loadHistory]);

  const isInitialEntry = (entry: PriceHistoryEntry): boolean => {
    return entry.previous_price === null;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span className="truncate">Price History &mdash; {productName}</span>
        </span>
      }
      size="lg"
    >
      <div className="min-h-[120px]">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-8">
            <TrendingUp className="w-8 h-8 text-red-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{error}</p>
            <Button variant="secondary" size="sm" onClick={loadHistory}>
              Try Again
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && entries.length === 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No price changes recorded
            </p>
          </div>
        )}

        {/* Timeline */}
        {!loading && !error && entries.length > 0 && (
          <div className="relative max-h-[60vh] overflow-y-auto pr-1">
            {/* Timeline line */}
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />

            <div className="space-y-0">
              {entries.map((entry, index) => (
                <div key={entry.id} className="relative pl-10 pb-6 last:pb-0">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-2.5 top-1 w-3 h-3 rounded-full border-2 ${
                      index === 0
                        ? 'bg-blue-500 border-blue-500 dark:bg-blue-400 dark:border-blue-400'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                    }`}
                  />

                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                    {/* Date */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        {formatDateTime(entry.changed_at)}
                      </span>
                      {isInitialEntry(entry) && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          Initial
                        </span>
                      )}
                    </div>

                    {/* Price change */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base font-bold text-gray-900 dark:text-white">
                        {isInitialEntry(entry) ? (
                          <>
                            <span className="text-gray-400 dark:text-gray-500">&mdash;</span>
                            <span className="mx-2 text-gray-400">&rarr;</span>
                            <span className="text-green-600 dark:text-green-400">
                              {formatCurrency4(entry.new_price)}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-gray-500 dark:text-gray-400">
                              {formatCurrency4(entry.previous_price)}
                            </span>
                            <span className="mx-2 text-gray-400">&rarr;</span>
                            <span
                              className={
                                parseFloat(entry.new_price) > parseFloat(entry.previous_price ?? '0')
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-green-600 dark:text-green-400'
                              }
                            >
                              {formatCurrency4(entry.new_price)}
                            </span>
                          </>
                        )}
                      </span>
                    </div>

                    {/* Changed by */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                      <User className="w-3 h-3 flex-shrink-0" />
                      <span>
                        Changed by{' '}
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {entry.changed_by.first_name} {entry.changed_by.last_name}
                        </span>
                      </span>
                    </div>

                    {/* Notes */}
                    {entry.notes && (
                      <div className="flex items-start gap-1.5 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span className="italic">{entry.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Close button */}
      <div className="flex justify-end mt-4">
        <Button variant="secondary" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
