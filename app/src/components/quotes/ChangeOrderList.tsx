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
} from 'lucide-react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { CreateChangeOrderModal } from './CreateChangeOrderModal';
import {
  getChangeOrders,
  getTotalImpact,
  approveChangeOrder,
  type ChangeOrder,
  type TotalImpact,
  getStatusLabel,
} from '@/lib/api/change-orders';
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
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [totalImpact, setTotalImpact] = useState<TotalImpact | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Check if quote is approved
  const isApproved = quoteStatus === 'approved' || quoteStatus === 'sent';

  // Fetch change orders
  useEffect(() => {
    if (isApproved) {
      fetchChangeOrders();
    } else {
      setLoading(false);
    }
  }, [quoteId, isApproved]);

  const fetchChangeOrders = async () => {
    setLoading(true);
    try {
      const [ordersData, impactData] = await Promise.all([
        getChangeOrders(quoteId),
        getTotalImpact(quoteId),
      ]);
      setChangeOrders(ordersData.change_orders);
      setTotalImpact(impactData);
    } catch (error: any) {
      console.error('Failed to fetch change orders:', error);
      toast.error('Could not fetch change orders');
    } finally {
      setLoading(false);
    }
  };

  // Handle approve
  const handleApprove = async (changeOrderId: string) => {
    try {
      await approveChangeOrder(changeOrderId);
      toast.success('Change order has been approved and merged');
      fetchChangeOrders();
      onChangeOrderApproved?.();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to approve change order');
    }
  };

  // Format money
  const formatMoney = (amount: number): string => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

  // Get status badge variant
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'approved':
        return 'success';
      case 'rejected':
        return 'danger';
      case 'pending':
        return 'warning';
      default:
        return 'gray';
    }
  };

  // Not approved message
  if (!isApproved) {
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
        {totalImpact && changeOrders.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border-2 border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold mb-3 text-blue-900 dark:text-blue-100">
              Total Impact
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">Original Total</p>
                <p className="font-bold text-gray-900 dark:text-gray-100">
                  {formatMoney(totalImpact.original_total)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">Approved Changes</p>
                <p className={`font-bold ${
                  totalImpact.total_approved_changes >= 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {totalImpact.total_approved_changes >= 0 ? '+' : ''}
                  {formatMoney(totalImpact.total_approved_changes)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">Pending Changes</p>
                <p className="font-bold text-yellow-600 dark:text-yellow-400">
                  {totalImpact.total_pending_changes >= 0 ? '+' : ''}
                  {formatMoney(totalImpact.total_pending_changes)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-xs mb-1">New Total</p>
                <p className="font-bold text-lg text-blue-900 dark:text-blue-100">
                  {formatMoney(totalImpact.new_total)}
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
                          {co.change_order_number}
                        </span>
                        <Badge variant={getStatusBadgeVariant(co.status)}>
                          {getStatusLabel(co.status)}
                        </Badge>
                      </div>
                    </div>

                    <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                      {co.title}
                    </p>
                    {co.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {co.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                      <span>{formatRelativeTime(co.created_at)}</span>
                      {co.approved_at && co.approved_by && (
                        <>
                          <span>•</span>
                          <span>Approved by {co.approved_by.name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Amount & Actions */}
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-2">
                      {co.amount_change >= 0 ? (
                        <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                      )}
                      <p className={`text-lg font-bold ${
                        co.amount_change >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {co.amount_change >= 0 ? '+' : ''}
                        {formatMoney(co.amount_change)}
                      </p>
                    </div>

                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      New total: <span className="font-semibold">{formatMoney(co.new_total)}</span>
                    </p>

                    <div className="flex gap-2 mt-2">
                      <Link
                        href={`/quotes/${co.child_quote_id}`}
                        className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </Link>

                      {co.status === 'pending' && canApproveChangeOrder && (
                        <button
                          onClick={() => handleApprove(co.id)}
                          className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                          title="Approve"
                        >
                          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </button>
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
    </>
  );
}

export default ChangeOrderList;
