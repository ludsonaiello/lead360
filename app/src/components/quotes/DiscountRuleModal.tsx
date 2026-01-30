'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  createDiscountRule,
  updateDiscountRule,
  previewDiscountImpact,
} from '@/lib/api/discount-rules';
import type { DiscountRule, DiscountPreviewResponse } from '@/lib/types/quotes';

interface DiscountRuleModalProps {
  quoteId: string;
  rule?: DiscountRule | null;
  isOpen: boolean;
  onClose: (success?: boolean) => void;
}

export function DiscountRuleModal({
  quoteId,
  rule,
  isOpen,
  onClose,
}: DiscountRuleModalProps) {
  const isEdit = !!rule;

  const [ruleType, setRuleType] = useState<'percentage' | 'fixed_amount'>(
    rule?.rule_type || 'percentage'
  );
  const [value, setValue] = useState<number | null>(rule?.value || null);
  const [reason, setReason] = useState(rule?.reason || '');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<DiscountPreviewResponse | null>(null);

  // Debounced preview
  useEffect(() => {
    if (!value || value <= 0) {
      setPreview(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        const previewData = await previewDiscountImpact(quoteId, {
          rule_type: ruleType,
          value: value,
        });
        setPreview(previewData);
      } catch (err: any) {
        console.error('Failed to load preview:', err);
        setPreview(null);
      } finally {
        setPreviewLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [quoteId, ruleType, value]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Reason validation
    if (!reason.trim()) {
      newErrors.reason = 'Reason is required';
    } else if (reason.length < 3) {
      newErrors.reason = 'Reason must be at least 3 characters';
    } else if (reason.length > 255) {
      newErrors.reason = 'Reason must be 255 characters or less';
    }

    // Value validation
    if (!value || isNaN(value)) {
      newErrors.value = 'Value is required';
    } else if (value <= 0) {
      newErrors.value = 'Value must be greater than 0';
    } else if (ruleType === 'percentage' && value > 100) {
      newErrors.value = 'Percentage cannot exceed 100%';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      setLoading(true);

      const dto = {
        rule_type: ruleType,
        value: value!,
        reason: reason.trim(),
      };

      if (isEdit) {
        await updateDiscountRule(quoteId, rule.id, dto);
      } else {
        await createDiscountRule(quoteId, dto);
      }

      onClose(true);
    } catch (err: any) {
      console.error('Failed to save discount rule:', err);
      setErrors({ submit: err.message || 'Failed to save discount rule' });
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

  const ruleTypeOptions = [
    { value: 'percentage', label: 'Percentage Discount (%)' },
    { value: 'fixed_amount', label: 'Fixed Amount Discount ($)' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !loading && onClose()}
      title={isEdit ? 'Edit Discount Rule' : 'Add Discount Rule'}
    >
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-4">
            {/* Rule Type */}
            <Select
              label="Discount Type"
              value={ruleType}
              onChange={(val) => setRuleType(val as 'percentage' | 'fixed_amount')}
              options={ruleTypeOptions}
              required
            />

            {/* Value Input */}
            {ruleType === 'percentage' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Percentage <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={value?.toString() || ''}
                    onChange={(e) => setValue(parseFloat(e.target.value) || null)}
                    error={errors.value}
                    placeholder="10.00"
                    required
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <span className="text-gray-500 dark:text-gray-400">%</span>
                  </div>
                </div>
                {errors.value && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {errors.value}
                  </p>
                )}
              </div>
            ) : (
              <CurrencyInput
                label="Amount"
                value={value}
                onChange={(val) => setValue(val)}
                error={errors.value}
                required
              />
            )}

            {/* Reason */}
            <Input
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              error={errors.reason}
              placeholder="e.g., Early payment discount"
              required
              helperText="3-255 characters"
            />

            {/* Preview Section */}
            {preview && !previewLoading && (
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
                  💡 Preview Impact
                </h4>

                <div className="space-y-2 text-sm">
                  {/* Current State */}
                  <div className="flex justify-between text-gray-700 dark:text-gray-300">
                    <span>Current Quote Total:</span>
                    <span className="font-medium">{formatCurrency(preview.current_total)}</span>
                  </div>

                  <div className="border-t border-blue-200 dark:border-blue-800 my-2"></div>

                  {/* Discount */}
                  <div className="flex justify-between font-semibold text-red-700 dark:text-red-300">
                    <span>Discount Amount:</span>
                    <span>-{formatCurrency(preview.proposed_discount_amount)}</span>
                  </div>

                  {/* New State */}
                  <div className="flex justify-between font-bold text-green-700 dark:text-green-300 text-base">
                    <span>New Quote Total:</span>
                    <span>
                      {formatCurrency(preview.new_total)}
                    </span>
                  </div>

                  <div className="text-xs text-gray-600 dark:text-gray-400 italic mt-1">
                    * Totals include tax and other charges
                  </div>

                  <div className="border-t border-gray-300 dark:border-gray-600 my-2"></div>

                  {/* Impact */}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 dark:text-gray-300">
                      Impact Amount:
                    </span>
                    <div className="flex items-center gap-1">
                      {preview.impact_amount < 0 ? (
                        <>
                          <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                          <span className="font-semibold text-red-600 dark:text-red-400">
                            {formatCurrency(preview.impact_amount)}
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            {formatCurrency(preview.impact_amount)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-gray-300 dark:border-gray-600 my-2"></div>

                  {/* Margin Impact */}
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 dark:text-gray-300">
                      Margin Change:
                    </span>
                    <div className="flex items-center gap-1">
                      {preview.margin_change !== null && preview.margin_change !== undefined ? (
                        preview.margin_change < 0 ? (
                          <>
                            <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                            <span className="font-semibold text-red-600 dark:text-red-400">
                              {preview.margin_change.toFixed(1)}%
                            </span>
                          </>
                        ) : (
                          <>
                            <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              +{preview.margin_change.toFixed(1)}%
                            </span>
                          </>
                        )
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">N/A</span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Current Margin:</span>
                    <span>{preview.current_margin_percent?.toFixed(1) ?? '0.0'}%</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>New Margin:</span>
                    <span
                      className={
                        (preview.new_margin_percent ?? 0) < 15
                          ? 'text-red-600 dark:text-red-400'
                          : (preview.new_margin_percent ?? 0) < 25
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-green-600 dark:text-green-400'
                      }
                    >
                      {preview.new_margin_percent?.toFixed(1) ?? '0.0'}%
                    </span>
                  </div>

                  {/* Warning if margin too low */}
                  {preview.new_margin_percent !== null && preview.new_margin_percent !== undefined && preview.new_margin_percent < 15 && (
                    <div className="flex items-start gap-2 mt-3 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded">
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-red-800 dark:text-red-200">
                        Warning: This discount will result in a very low profit
                        margin ({preview.new_margin_percent.toFixed(1)}%).
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {previewLoading && (
              <div className="flex justify-center py-4">
                <LoadingSpinner size="sm" />
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
          <Button type="submit" variant="primary" loading={loading}>
            {isEdit ? 'Update Discount' : 'Add Discount'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
