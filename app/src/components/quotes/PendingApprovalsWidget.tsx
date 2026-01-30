/**
 * Pending Approvals Widget Component
 * Dashboard widget showing quotes pending current user's approval
 * Auto-refreshes and provides quick approve/reject actions
 */

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle2, XCircle, RotateCcw, Clock, ArrowRight } from 'lucide-react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ApproveQuoteModal } from './ApproveQuoteModal';
import { RejectQuoteModal } from './RejectQuoteModal';
import {
  getPendingApprovals,
  approveQuote,
  rejectQuote,
  type PendingApproval,
} from '@/lib/api/quote-approvals';
import toast from 'react-hot-toast';

interface PendingApprovalsWidgetProps {
  autoRefreshInterval?: number;  // milliseconds (default: 30000 = 30 seconds)
  className?: string;
}

export function PendingApprovalsWidget({
  autoRefreshInterval = 30000,
  className = '',
}: PendingApprovalsWidgetProps) {
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Fetch pending approvals
  const fetchPendingApprovals = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await getPendingApprovals();
      setPendingApprovals(data.pending_approvals);
      setCount(data.count);
    } catch (error: any) {
      console.error('Failed to fetch pending approvals:', error);
      toast.error('Could not fetch pending approvals');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  // Auto-refresh
  useEffect(() => {
    if (autoRefreshInterval > 0) {
      const interval = setInterval(() => {
        fetchPendingApprovals(true);
      }, autoRefreshInterval);

      return () => clearInterval(interval);
    }
  }, [autoRefreshInterval]);

  // Manual refresh
  const handleRefresh = () => {
    fetchPendingApprovals(true);
  };

  // Quick approve
  const handleQuickApprove = async (approval: PendingApproval, comments?: string) => {
    await approveQuote(approval.quote_id, approval.approval_id, { comments });
    toast.success(`Quote ${approval.quote_number} approved successfully!`);
    setShowApproveModal(false);
    setSelectedApproval(null);
    fetchPendingApprovals();
  };

  // Quick reject
  const handleQuickReject = async (approval: PendingApproval, comments: string) => {
    await rejectQuote(approval.quote_id, approval.approval_id, { comments });
    toast.success(`Quote ${approval.quote_number} has been rejected`);
    setShowRejectModal(false);
    setSelectedApproval(null);
    fetchPendingApprovals();
  };

  // Format relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <>
      <Card className={`p-6 ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h3 className="text-lg font-bold">Pending My Approval</h3>
              {count > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {count} quote{count > 1 ? 's' : ''} awaiting review
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {count > 0 && (
              <Badge variant="warning" className="px-3 py-1">
                {count}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RotateCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="md" />
          </div>
        ) : pendingApprovals.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-400 dark:text-green-600" />
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              No quotes pending your approval
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              You're all caught up!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingApprovals.map((approval) => (
              <div
                key={approval.approval_id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Quote Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/quotes/${approval.quote_id}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                    >
                      {approval.quote_number}
                    </Link>
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 truncate">
                      {approval.quote_title}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-600 dark:text-gray-400">
                      <span>
                        Submitted {formatRelativeTime(approval.submitted_at)}
                      </span>
                      <span>•</span>
                      <span>by {approval.submitted_by.name}</span>
                      <span>•</span>
                      <Badge variant="info" className="text-xs">
                        Level {approval.level}
                      </Badge>
                    </div>
                  </div>

                  {/* Amount & Actions */}
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                      ${approval.quote_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedApproval(approval);
                          setShowApproveModal(true);
                        }}
                        className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                        title="Approve"
                      >
                        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedApproval(approval);
                          setShowRejectModal(true);
                        }}
                        className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                        title="Reject"
                      >
                        <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </button>
                      <Link
                        href={`/quotes/${approval.quote_id}`}
                        className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                        title="View Details"
                      >
                        <ArrowRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* View All Link */}
        {count > 3 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Link
              href="/quotes?filter=pending_my_approval"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium flex items-center justify-center gap-2"
            >
              View all {count} pending approvals
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </Card>

      {/* Modals */}
      {selectedApproval && showApproveModal && (
        <ApproveQuoteModal
          isOpen={showApproveModal}
          onClose={() => {
            setShowApproveModal(false);
            setSelectedApproval(null);
          }}
          onApprove={(comments) => handleQuickApprove(selectedApproval, comments)}
          quoteNumber={selectedApproval.quote_number}
          quoteTitle={selectedApproval.quote_title}
          quoteTotal={selectedApproval.quote_total}
          approvalLevel={selectedApproval.level}
        />
      )}

      {selectedApproval && showRejectModal && (
        <RejectQuoteModal
          isOpen={showRejectModal}
          onClose={() => {
            setShowRejectModal(false);
            setSelectedApproval(null);
          }}
          onReject={(comments) => handleQuickReject(selectedApproval, comments)}
          quoteNumber={selectedApproval.quote_number}
          quoteTitle={selectedApproval.quote_title}
          quoteTotal={selectedApproval.quote_total}
          approvalLevel={selectedApproval.level}
        />
      )}
    </>
  );
}

export default PendingApprovalsWidget;
