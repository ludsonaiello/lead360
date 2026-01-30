'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import {
  getDrawSchedule,
  deleteDrawSchedule,
} from '@/lib/api/draw-schedule';
import type { DrawSchedule, DrawEntry } from '@/lib/types/quotes';
import { DrawPaymentModal } from './DrawPaymentModal';

interface DrawScheduleSectionProps {
  quoteId: string;
  quoteTotal: number;
  readOnly?: boolean;
}

export function DrawScheduleSection({
  quoteId,
  quoteTotal,
  readOnly = false,
}: DrawScheduleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<DrawSchedule | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<DrawEntry | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadDrawSchedule = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getDrawSchedule(quoteId);
      setSchedule(data);
    } catch (err: any) {
      // 404 means no schedule exists yet
      if (err.status === 404) {
        setSchedule(null);
      } else {
        console.error('Failed to load draw schedule:', err);
        setError(err.message || 'Failed to load draw schedule');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (quoteId) {
      loadDrawSchedule();
    }
  }, [quoteId]);

  const handleCreateSchedule = () => {
    setSelectedEntry(null);
    setIsModalOpen(true);
  };

  const handleEditEntry = (entry: DrawEntry) => {
    setSelectedEntry(entry);
    setIsModalOpen(true);
  };

  const handleModalClose = async (success?: boolean) => {
    setIsModalOpen(false);
    setSelectedEntry(null);

    if (success) {
      await loadDrawSchedule();
    }
  };

  const handleDeleteSchedule = () => {
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setDeleteLoading(true);
      await deleteDrawSchedule(quoteId);

      setIsDeleteModalOpen(false);
      setSchedule(null);
    } catch (err: any) {
      console.error('Failed to delete draw schedule:', err);
      setError(err.message || 'Failed to delete draw schedule');
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const totalPercentage = schedule?.entries.reduce(
    (sum, entry) => sum + entry.value,
    0
  ) || 0;
  const isValid = schedule?.validation?.is_valid ?? false; // Use API validation result

  return (
    <>
      <Card className="p-6">
        {/* Header */}
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Draw Schedule
            </h3>
            {schedule && schedule.entries.length > 0 && (
              <>
                <Badge variant="neutral">{schedule.entries.length} draws</Badge>
                {isValid ? (
                  <Badge variant="success">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Valid
                  </Badge>
                ) : (
                  <Badge variant="danger">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Invalid
                  </Badge>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!readOnly && schedule && schedule.entries.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSchedule();
                }}
                className="mr-2"
              >
                <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400 mr-1" />
                Delete Schedule
              </Button>
            )}
            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreateSchedule();
                }}
                className="mr-2"
              >
                <Plus className="w-4 h-4 mr-1" />
                {schedule && schedule.entries.length > 0
                  ? 'Edit Schedule'
                  : 'Create Schedule'}
              </Button>
            )}
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-6 space-y-4">
            {/* Loading State */}
            {loading && (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="md" />
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && (!schedule || schedule.entries.length === 0) && (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-2">
                  No draw schedule created yet.
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
                  Create a payment milestone schedule for this quote.
                </p>
                {!readOnly && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCreateSchedule}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create Draw Schedule
                  </Button>
                )}
              </div>
            )}

            {/* Draw Schedule Table */}
            {!loading && !error && schedule && schedule.entries.length > 0 && (
              <>
                {/* Validation Banner */}
                {!isValid && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-red-900 dark:text-red-100">
                        Invalid Draw Schedule
                      </h4>
                      <p className="text-sm text-red-800 dark:text-red-200 mt-1">
                        Draw percentages must sum to exactly 100%. Current total:{' '}
                        {totalPercentage.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                )}

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Draw #
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Percentage
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Running Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {schedule.entries.map((entry) => {
                        return (
                          <tr
                            key={entry.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          >
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                              #{entry.draw_number}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                              {entry.description}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                              {entry.value.toFixed(2)}%
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                              {formatCurrency(entry.calculated_amount)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-green-600 dark:text-green-400">
                              {formatCurrency(entry.running_total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 dark:bg-gray-800/50">
                      <tr>
                        <td
                          colSpan={2}
                          className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100"
                        >
                          Total
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">
                          <span
                            className={
                              isValid
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }
                          >
                            {totalPercentage.toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(schedule.quote_total)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-4">
                  {schedule.entries.map((entry) => {
                    return (
                      <div
                        key={entry.id}
                        className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <Badge variant="neutral" className="mb-2">
                              Draw #{entry.draw_number}
                            </Badge>
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">
                              {entry.description}
                            </h4>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">
                              Percentage:
                            </span>
                            <span className="font-medium">
                              {entry.value.toFixed(2)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600 dark:text-gray-400">
                              Amount:
                            </span>
                            <span className="font-medium">
                              {formatCurrency(entry.calculated_amount)}
                            </span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                            <span className="text-gray-600 dark:text-gray-400">
                              Running Total:
                            </span>
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              {formatCurrency(entry.running_total)} (
                              {entry.percentage_of_total?.toFixed(1) ?? '0.0'}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Mobile Total */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Total Percentage:
                      </span>
                      <span
                        className={`text-sm font-bold ${
                          isValid
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {totalPercentage.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Total Amount:
                      </span>
                      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                        {formatCurrency(schedule.quote_total)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-400">
                      Payment Distribution
                    </span>
                    <span className="font-semibold">{totalPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isValid ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(totalPercentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      {/* Create/Edit Draw Schedule Modal */}
      {isModalOpen && (
        <DrawPaymentModal
          quoteId={quoteId}
          quoteTotal={quoteTotal}
          existingSchedule={schedule}
          isOpen={isModalOpen}
          onClose={handleModalClose}
        />
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <ConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={handleDeleteConfirm}
          title="Delete Draw Schedule"
          message="Are you sure you want to delete the entire draw schedule? This action cannot be undone."
          confirmText="Delete Schedule"
          variant="danger"
          loading={deleteLoading}
        />
      )}
    </>
  );
}
