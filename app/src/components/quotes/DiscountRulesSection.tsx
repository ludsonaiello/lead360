'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Edit2,
  Trash2,
  GripVertical,
  Percent,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { SortableList } from '@/components/ui/SortableList';
import { SortableItem } from '@/components/ui/SortableItem';
import {
  listDiscountRules,
  deleteDiscountRule,
  reorderDiscountRules,
} from '@/lib/api/discount-rules';
import type { DiscountRule } from '@/lib/types/quotes';
import { DiscountRuleModal } from './DiscountRuleModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface DiscountRulesSectionProps {
  quoteId: string;
  onDiscountChanged?: () => void;
  readOnly?: boolean;
}

export function DiscountRulesSection({
  quoteId,
  onDiscountChanged,
  readOnly = false,
}: DiscountRulesSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [subtotalBefore, setSubtotalBefore] = useState(0);
  const [subtotalAfter, setSubtotalAfter] = useState(0);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<DiscountRule | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [ruleToDelete, setRuleToDelete] = useState<DiscountRule | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadDiscountRules = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await listDiscountRules(quoteId);

      setRules(response.discount_rules || []);
      // API uses nested "summary" object
      setTotalDiscount(response.summary?.total_discount_amount || 0);
      setSubtotalBefore(response.summary?.subtotal_before_discounts || 0);
      setSubtotalAfter(response.summary?.subtotal_after_discounts || 0);
    } catch (err: any) {
      console.error('Failed to load discount rules:', err);
      setError(err.message || 'Failed to load discount rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (quoteId) {
      loadDiscountRules();
    }
  }, [quoteId]);

  const handleReorder = async (reorderedRules: DiscountRule[]) => {
    // Optimistic update
    const previousRules = [...rules];
    setRules(reorderedRules);

    try {
      // NOTE: Reorder endpoint is currently broken in backend (validation fails)
      // Keeping this code for when it's fixed
      const ruleOrders = reorderedRules.map((rule, index) => ({
        id: rule.id,
        new_order_index: index,
      }));

      await reorderDiscountRules(quoteId, { discount_rules: ruleOrders });

      // Refresh to get updated totals (order affects compound calculation)
      await loadDiscountRules();
      onDiscountChanged?.();
    } catch (err: any) {
      console.error('Failed to reorder discount rules:', err);
      // Revert on error
      setRules(previousRules);
      setError(err.message || 'Failed to reorder discount rules');
    }
  };

  const handleCreate = () => {
    setSelectedRule(null);
    setIsModalOpen(true);
  };

  const handleEdit = (rule: DiscountRule) => {
    setSelectedRule(rule);
    setIsModalOpen(true);
  };

  const handleModalClose = async (success?: boolean) => {
    setIsModalOpen(false);
    setSelectedRule(null);

    if (success) {
      await loadDiscountRules();
      onDiscountChanged?.();
    }
  };

  const handleDeleteClick = (rule: DiscountRule) => {
    setRuleToDelete(rule);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!ruleToDelete) return;

    try {
      setDeleteLoading(true);
      await deleteDiscountRule(quoteId, ruleToDelete.id);

      setIsDeleteModalOpen(false);
      setRuleToDelete(null);

      await loadDiscountRules();
      onDiscountChanged?.();
    } catch (err: any) {
      console.error('Failed to delete discount rule:', err);
      setError(err.message || 'Failed to delete discount rule');
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
              Discount Rules
            </h3>
            {rules.length > 0 && (
              <Badge variant="neutral">{rules.length}</Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isExpanded && rules.length > 0 && (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Total: {formatCurrency(totalDiscount)}
              </span>
            )}
            {!readOnly && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCreate}
                className="mr-2"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Discount
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
            {/* Warning Banner */}
            {rules.length > 1 && (
              <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-900 dark:text-yellow-100">
                    Order Matters!
                  </h4>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                    Percentage discounts compound sequentially. For example: 10%
                    off, then 5% off ≠ 5% off, then 10% off. Drag to reorder.
                  </p>
                </div>
              </div>
            )}

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
            {!loading && !error && rules.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">
                  No discount rules added yet.
                </p>
                {!readOnly && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCreate}
                    className="mt-4"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Discount
                  </Button>
                )}
              </div>
            )}

            {/* Discount Rules List */}
            {!loading && !error && Array.isArray(rules) && rules.length > 0 && (
              <>
                <SortableList
                  items={rules}
                  onReorder={handleReorder}
                  getItemId={(rule) => rule.id}
                >
                  {(rule, index) => (
                    <SortableItem id={rule.id} key={rule.id}>
                      <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors">
                        {/* Drag Handle */}
                        {!readOnly && (
                          <div className="cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-5 h-5 text-gray-400" />
                          </div>
                        )}

                        {/* Rule Type Icon */}
                        <div className="flex-shrink-0">
                          {rule.rule_type === 'percentage' ? (
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                              <Percent className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                          ) : (
                            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                              <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                            </div>
                          )}
                        </div>

                        {/* Rule Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant={
                                rule.rule_type === 'percentage' ? 'blue' : 'green'
                              }
                            >
                              {rule.rule_type === 'percentage'
                                ? `${rule.value}%`
                                : formatCurrency(rule.value)}
                            </Badge>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {rule.reason}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        {!readOnly && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(rule)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(rule)}
                            >
                              <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </SortableItem>
                  )}
                </SortableList>

                {/* Total Summary */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Subtotal Before Discounts:
                    </span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrency(subtotalBefore)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                      Total Discount:
                    </span>
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      -{formatCurrency(totalDiscount)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      Subtotal After Discounts:
                    </span>
                    <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      {formatCurrency(subtotalAfter)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Card>

      {/* Add/Edit Discount Modal */}
      {isModalOpen && (
        <DiscountRuleModal
          quoteId={quoteId}
          rule={selectedRule}
          isOpen={isModalOpen}
          onClose={handleModalClose}
        />
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && ruleToDelete && (
        <ConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setRuleToDelete(null);
          }}
          onConfirm={handleDeleteConfirm}
          title="Delete Discount Rule"
          message={`Are you sure you want to delete the discount "${ruleToDelete.reason}"? This will recalculate the quote total.`}
          confirmText="Delete"
          variant="danger"
          loading={deleteLoading}
        />
      )}
    </>
  );
}
