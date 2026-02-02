/**
 * Change Order List Component
 * Displays list of change orders for an approved quote
 * Shows status, impact, and actions for each change order
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  TrendingUp,
  TrendingDown,
  Trash2,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { CreateChangeOrderModal } from './CreateChangeOrderModal';
import { ApproveChangeOrderModal } from './ApproveChangeOrderModal';
import { RejectChangeOrderModal } from './RejectChangeOrderModal';
import {
  getChangeOrders,
  getParentQuoteTotals,
  type ChangeOrderSummary,
  type ParentQuoteTotals,
  getStatusLabel,
  getStatusBadgeVariant,
  canApproveChangeOrder as canApproveStatus,
  canCreateChangeOrderForParent,
} from '@/lib/api/change-orders';
import { deleteQuote } from '@/lib/api/quotes';
import toast from 'react-hot-toast';

interface ChangeOrderListProps {
  quoteId: string;
  quoteStatus: string;
  canCreateChangeOrder?: boolean;
  canApproveChangeOrder?: boolean;
  onChangeOrderCreated?: () => void;
  onChangeOrderApproved?: () => void;
  className?: string;
}

export function ChangeOrderList({
  quoteId,
  quoteStatus,
  canCreateChangeOrder = false,
  canApproveChangeOrder = false,
  onChangeOrderCreated,
  onChangeOrderApproved,
  className = '',
}: ChangeOrderListProps) {
  const [changeOrders, setChangeOrders] = useState<ChangeOrderSummary[]>([]);
  const [totals, setTotals] = useState<ParentQuoteTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedChangeOrder, setSelectedChangeOrder] = useState<ChangeOrderSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Check if parent quote can have change orders (approved, started, or concluded)
  const canHaveChangeOrders = canCreateChangeOrderForParent(quoteStatus);

  // Fetch change orders
  useEffect(() => {
    if (canHaveChangeOrders) {
      fetchChangeOrders();
    } else {
      setLoading(false);
    }
  }, [quoteId, canHaveChangeOrders]);

  const fetchChangeOrders = async () => {
    setLoading(true);
    try {
      const [ordersData, totalsData] = await Promise.all([
        getChangeOrders(quoteId),
        getParentQuoteTotals(quoteId),
      ]);
      setChangeOrders(ordersData.change_orders);
      setTotals(totalsData);
    } catch (error: any) {
      console.error('Failed to fetch change orders:', error);
      toast.error('Could not fetch change orders');
    } finally {
      setLoading(false);
    }
  };

  // Handle approve modal
  const handleOpenApproveModal = (changeOrder: ChangeOrderSummary) => {
    setSelectedChangeOrder(changeOrder);
    setShowApproveModal(true);
  };

  // Handle reject modal
  const handleOpenRejectModal = (changeOrder: ChangeOrderSummary) => {
    setSelectedChangeOrder(changeOrder);
    setShowRejectModal(true);
  };

  // Handle delete modal
  const handleOpenDeleteModal = (changeOrder: ChangeOrderSummary) => {
    setSelectedChangeOrder(changeOrder);
    setShowDeleteModal(true);
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedChangeOrder) return;

    setDeleting(true);
    try {
      await deleteQuote(selectedChangeOrder.id);
      toast.success(`Change order ${selectedChangeOrder.quote_number} has been deleted`);
      setShowDeleteModal(false);
      setSelectedChangeOrder(null);
      fetchChangeOrders();
      onChangeOrderApproved?.(); // Refresh parent quote totals
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to delete change order';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  // Handle modal actions complete
  const handleModalActionComplete = () => {
    fetchChangeOrders();
    onChangeOrderApproved?.();
    setSelectedChangeOrder(null);
  };

  // Format money
  const formatMoney = (amount: number | null | undefined): string => {
    // Handle null, undefined, NaN, and convert to number
    const numValue = Number(amount);
    const value = isNaN(numValue) ? 0 : numValue;
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Format relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Not in valid status message
  if (!canHaveChangeOrders) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center py-8">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" />
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            Change orders are only available for approved quotes
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Submit and approve this quote first
          </p>
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className={`p-6 ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-lg font-bold">Change Orders</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {changeOrders.length} change order{changeOrders.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          {canCreateChangeOrder && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-4 h-4" />
              Create Change Order
            </Button>
          )}
        </div>

        {/* Total Impact Summary */}
        {totals && changeOrders.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border-2 border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold mb-3 text-blue-900 dark:text-blue-100">
              Total Impact
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">Original Total</p>
                <p className="font-bold text-gray-900 dark:text-gray-100">
                  {formatMoney(totals.original_total)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">Approved Changes</p>
                <p className={`font-bold ${
                  (totals.approved_change_orders_total ?? 0) >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {(totals.approved_change_orders_total ?? 0) >= 0 ? '+' : ''}
                  {formatMoney(totals.approved_change_orders_total)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">Pending Changes</p>
                <p className="font-bold text-yellow-600 dark:text-yellow-400">
                  {(totals.pending_change_orders_total ?? 0) >= 0 ? '+' : ''}
                  {formatMoney(totals.pending_change_orders_total)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">Revised Total</p>
                <p className="font-bold text-lg text-blue-900 dark:text-blue-100">
                  {formatMoney(totals.revised_total)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Change Orders List */}
        {changeOrders.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" />
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              No change orders yet
            </p>
            {canCreateChangeOrder && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowCreateModal(true)}
                className="mt-3"
              >
                <Plus className="w-4 h-4" />
                Create First Change Order
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {changeOrders.map((co) => (
              <div
                key={co.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Change Order Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 dark:text-gray-100">
                          {co.quote_number}
                        </span>
                        <Badge variant={getStatusBadgeVariant(co.status) as any}>
                          {getStatusLabel(co.status)}
                        </Badge>
                      </div>
                    </div>

                    <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      {co.title}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                      <span>{formatRelativeTime(co.created_at)}</span>
                      {co.approved_at && (
                        <>
                          <span>•</span>
                          <span>Approved {formatRelativeTime(co.approved_at)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Amount & Actions */}
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      {(co.total ?? 0) >= 0 ? (
                        <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                      )}
                      <p className={`text-lg font-bold ${
                        (co.total ?? 0) >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {formatMoney(co.total)}
                      </p>
                    </div>

                    <div className="flex gap-2 mt-2">
                      <Link
                        href={`/quotes/${co.id}`}
                        className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </Link>

                      <button
                        onClick={() => handleOpenDeleteModal(co)}
                        className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </button>

                      {canApproveStatus(co.status) && canApproveChangeOrder && (
                        <>
                          <button
                            onClick={() => handleOpenApproveModal(co)}
                            className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                            title="Approve"
                          >
                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                          </button>
                          <button
                            onClick={() => handleOpenRejectModal(co)}
                            className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create Change Order Modal */}
      {showCreateModal && (
        <CreateChangeOrderModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          parentQuoteId={quoteId}
          onCreated={() => {
            setShowCreateModal(false);
            fetchChangeOrders();
            onChangeOrderCreated?.();
          }}
        />
      )}

      {/* Approve Change Order Modal */}
      {showApproveModal && selectedChangeOrder && (
        <ApproveChangeOrderModal
          isOpen={showApproveModal}
          onClose={() => {
            setShowApproveModal(false);
            setSelectedChangeOrder(null);
          }}
          changeOrderId={selectedChangeOrder.id}
          changeOrderNumber={selectedChangeOrder.quote_number}
          changeOrderTitle={selectedChangeOrder.title}
          changeOrderTotal={selectedChangeOrder.total}
          onApproved={handleModalActionComplete}
        />
      )}

      {/* Reject Change Order Modal */}
      {showRejectModal && selectedChangeOrder && (
        <RejectChangeOrderModal
          isOpen={showRejectModal}
          onClose={() => {
            setShowRejectModal(false);
            setSelectedChangeOrder(null);
          }}
          changeOrderId={selectedChangeOrder.id}
          changeOrderNumber={selectedChangeOrder.quote_number}
          onRejected={handleModalActionComplete}
        />
      )}

      {/* Delete Change Order Modal */}
      {showDeleteModal && selectedChangeOrder && (
        <DeleteConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedChangeOrder(null);
          }}
          onConfirm={handleDelete}
          title="Delete Change Order"
          message={`Are you sure you want to delete change order ${selectedChangeOrder.quote_number}? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          isDeleting={deleting}
        />
      )}
    </>
  );
}

export default ChangeOrderList;
