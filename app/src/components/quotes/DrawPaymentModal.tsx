'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  createDrawSchedule,
  updateDrawSchedule,
} from '@/lib/api/draw-schedule';
import type { DrawSchedule } from '@/lib/types/quotes';

interface DrawPaymentModalProps {
  quoteId: string;
  quoteTotal: number;
  existingSchedule?: DrawSchedule | null;
  isOpen: boolean;
  onClose: (success?: boolean) => void;
}

interface DrawEntryForm {
  draw_number: number;
  description: string;
  value: string; // Changed from "percentage" to match API
}

export function DrawPaymentModal({
  quoteId,
  quoteTotal,
  existingSchedule,
  isOpen,
  onClose,
}: DrawPaymentModalProps) {
  const isEdit = !!existingSchedule && existingSchedule.entries.length > 0;

  const [entries, setEntries] = useState<DrawEntryForm[]>(() => {
    if (isEdit && existingSchedule) {
      return existingSchedule.entries.map((e) => ({
        draw_number: e.draw_number,
        description: e.description,
        value: e.value.toString(), // API uses "value" not "percentage"
      }));
    }
    return [
      {
        draw_number: 1,
        description: '',
        value: '',
      },
    ];
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const addEntry = () => {
    setEntries([
      ...entries,
      {
        draw_number: entries.length + 1,
        description: '',
        value: '',
      },
    ]);
  };

  const removeEntry = (index: number) => {
    if (entries.length === 1) return;

    const newEntries = entries.filter((_, i) => i !== index);
    // Renumber entries
    newEntries.forEach((entry, i) => {
      entry.draw_number = i + 1;
    });
    setEntries(newEntries);
  };

  const updateEntry = <K extends keyof DrawEntryForm>(
    index: number,
    field: K,
    value: DrawEntryForm[K]
  ) => {
    const newEntries = [...entries];
    newEntries[index][field] = value;
    setEntries(newEntries);
  };

  const calculateAmount = (value: string): number => {
    const pct = parseFloat(value) || 0;
    return (quoteTotal * pct) / 100;
  };

  const totalPercentage = entries.reduce((sum, entry) => {
    const pct = parseFloat(entry.value) || 0;
    return sum + pct;
  }, 0);

  const isValid = Math.abs(totalPercentage - 100) < 0.01;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Check total percentage
    if (!isValid) {
      newErrors.total = `Total percentage must equal 100%. Current total: ${totalPercentage.toFixed(2)}%`;
    }

    // Check each entry
    entries.forEach((entry, index) => {
      if (!entry.description.trim()) {
        newErrors[`description_${index}`] = 'Description is required';
      } else if (entry.description.length > 255) {
        newErrors[`description_${index}`] =
          'Description must be 255 characters or less';
      }

      const pct = parseFloat(entry.value);
      if (!entry.value || isNaN(pct)) {
        newErrors[`value_${index}`] = 'Percentage is required';
      } else if (pct <= 0) {
        newErrors[`value_${index}`] =
          'Percentage must be greater than 0';
      } else if (pct > 100) {
        newErrors[`value_${index}`] =
          'Percentage cannot exceed 100%';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      setLoading(true);

      const dto = {
        calculation_type: 'percentage' as const, // Required by API!
        entries: entries.map((entry) => ({
          draw_number: entry.draw_number,
          description: entry.description.trim(),
          value: parseFloat(entry.value), // API uses "value" not "percentage"
        })),
      };

      if (isEdit) {
        await updateDrawSchedule(quoteId, dto);
      } else {
        await createDrawSchedule(quoteId, dto);
      }

      onClose(true);
    } catch (err: any) {
      console.error('Failed to save draw schedule:', err);
      setErrors({ submit: err.message || 'Failed to save draw schedule' });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !loading && onClose()}
      title={isEdit ? 'Edit Draw Schedule' : 'Create Draw Schedule'}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-4">
            {/* Info Banner */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Create a payment milestone schedule. Total percentage must equal
                exactly 100%.
              </p>
            </div>

            {/* Entries */}
            <div className="space-y-4">
              {entries.map((entry, index) => {
                const amount = calculateAmount(entry.value);
                const runningTotal = entries
                  .slice(0, index + 1)
                  .reduce((sum, e) => sum + calculateAmount(e.value), 0);
                const runningPercentage = entries
                  .slice(0, index + 1)
                  .reduce((sum, e) => {
                    const pct = parseFloat(e.value) || 0;
                    return sum + pct;
                  }, 0);

                return (
                  <div
                    key={index}
                    className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">
                        Draw #{entry.draw_number}
                      </h4>
                      {entries.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeEntry(index)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {/* Description */}
                      <div>
                        <Input
                          label="Description"
                          value={entry.description}
                          onChange={(e) =>
                            updateEntry(index, 'description', e.target.value)
                          }
                          placeholder="e.g., Initial deposit"
                          error={errors[`description_${index}`]}
                          required
                        />
                      </div>

                      {/* Percentage */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Percentage <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max="100"
                            value={entry.value}
                            onChange={(e) =>
                              updateEntry(index, 'value', e.target.value)
                            }
                            placeholder="30.00"
                            error={errors[`value_${index}`]}
                            required
                          />
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <span className="text-gray-500 dark:text-gray-400">
                              %
                            </span>
                          </div>
                        </div>
                        {entry.value && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Amount: {formatCurrency(amount)}
                          </p>
                        )}
                        {errors[`value_${index}`] && (
                          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                            {errors[`value_${index}`]}
                          </p>
                        )}
                      </div>

                      {/* Running Total */}
                      {index > 0 && (
                        <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">
                              Running Total:
                            </span>
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              {formatCurrency(runningTotal)} (
                              {runningPercentage.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add Entry Button */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addEntry}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Draw Entry
            </Button>

            {/* Total Summary */}
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
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Total Amount:
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {formatCurrency(quoteTotal)}
                </span>
              </div>

              {/* Validation Status */}
              <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                {isValid ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">
                      Schedule is valid (100%)
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <span className="text-sm font-medium text-red-600 dark:text-red-400">
                      Schedule must total exactly 100%
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Total Error */}
            {errors.total && (
              <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {errors.total}
                </p>
              </div>
            )}

            {/* Submit Error */}
            {errors.submit && (
              <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {errors.submit}
                </p>
              </div>
            )}
          </div>
        </ModalContent>

        <ModalActions>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onClose()}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={!isValid}
          >
            {isEdit ? 'Update Schedule' : 'Create Schedule'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
