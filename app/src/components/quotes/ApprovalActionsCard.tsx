/**
 * Approval Actions Card Component
 * Displays approval status and action buttons on quote detail page
 * Shows Submit/Approve/Reject/Bypass buttons based on user permissions and quote status
 */

'use client';

import React, { useState } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  AlertTriangle,
  Shield,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ApprovalProgressTracker } from './ApprovalProgressTracker';
import { ApproveQuoteModal } from './ApproveQuoteModal';
import { RejectQuoteModal } from './RejectQuoteModal';
import { BypassApprovalModal } from './BypassApprovalModal';
import type { ApprovalStatus } from '@/lib/api/quote-approvals';
import { submitForApproval, approveQuote, rejectQuote, bypassApproval } from '@/lib/api/quote-approvals';
import toast from 'react-hot-toast';

interface ApprovalActionsCardProps {
  quoteId: string;
  quoteNumber: string;
  quoteTitle: string;
  quoteTotal: number;
  approvalStatus: ApprovalStatus;
  currentUserId: string;
  currentUserRole: string;  // 'Owner', 'Admin', 'Manager', etc.
  onStatusUpdate: () => void;
  className?: string;
}

export function ApprovalActionsCard({
  quoteId,
  quoteNumber,
  quoteTitle,
  quoteTotal,
  approvalStatus,
  currentUserId,
  currentUserRole,
  onStatusUpdate,
  className = '',
}: ApprovalActionsCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showBypassModal, setShowBypassModal] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<any>(null);

  // Determine current user's pending approval (if any)
  const userApproval = approvalStatus.approvals.find(
    (approval) =>
      approval.approver_user_id === currentUserId &&
      approval.status === 'pending'
  );

  // Check permissions
  const canSubmit = approvalStatus.status === 'draft';
  const canApprove = !!userApproval;
  const canBypass = currentUserRole === 'Owner' && approvalStatus.status === 'pending_approval';

  // Handle submit for approval
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await submitForApproval(quoteId);
      toast.success('Quote has been submitted for approval');
      onStatusUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to submit quote for approval');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle approve
  const handleApprove = async (comments?: string) => {
    if (!userApproval) return;

    try {
      await approveQuote(quoteId, userApproval.id, { comments });
      toast.success(`Quote approved at level ${userApproval.level}`);
      setShowApproveModal(false);
      onStatusUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to approve quote');
    }
  };

  // Handle reject
  const handleReject = async (comments: string) => {
    if (!userApproval) return;

    try {
      await rejectQuote(quoteId, userApproval.id, { comments });
      toast.success('Quote has been rejected and returned to draft status');
      setShowRejectModal(false);
      onStatusUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reject quote');
    }
  };

  // Handle bypass
  const handleBypass = async (reason: string) => {
    try {
      await bypassApproval(quoteId, { reason });
      toast.success('All approval levels have been bypassed');
      setShowBypassModal(false);
      onStatusUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to bypass approval');
    }
  };

  // Get status badge variant
  const getStatusBadge = () => {
    const hasRejection = approvalStatus.approvals.some(a => a.status === 'rejected');
    const allApproved = approvalStatus.approvals.length > 0 &&
      approvalStatus.approvals.every(a => a.status === 'approved');

    if (hasRejection) {
      return <Badge variant="danger">Rejected</Badge>;
    }
    if (allApproved) {
      return <Badge variant="success">Approved</Badge>;
    }
    if (approvalStatus.status === 'pending_approval') {
      return <Badge variant="warning">Pending Approval</Badge>;
    }
    return <Badge variant="gray">Draft</Badge>;
  };

  return (
    <>
      <Card className={`p-6 ${className}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {approvalStatus.status === 'pending_approval' ? (
              <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            ) : approvalStatus.status === 'approved' ? (
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            ) : (
              <Clock className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            )}
            <div>
              <h3 className="text-lg font-bold">Approval Status</h3>
              {approvalStatus.approvals.length > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Level {approvalStatus.progress.completed + 1} of{' '}
                  {approvalStatus.approvals.length}
                </p>
              )}
            </div>
          </div>
          {getStatusBadge()}
        </div>

        {/* Progress Tracker */}
        {approvalStatus.approvals.length > 0 && (
          <ApprovalProgressTracker
            approvals={approvalStatus.approvals}
            className="mb-6"
          />
        )}

        {/* No approval configured message */}
        {approvalStatus.approvals.length === 0 && approvalStatus.status === 'draft' && (
          <div className="text-center py-4 mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No approval workflow configured. Quote can be sent directly to customer.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {/* Submit for Approval */}
          {canSubmit && approvalStatus.approvals.length === 0 && (
            <div className="w-full p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200 mb-2">
                This quote does not require approval and can be sent directly to the customer.
              </p>
            </div>
          )}

          {canSubmit && approvalStatus.approvals.length > 0 && (
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
              className="flex-1"
            >
              <Send className="w-4 h-4" />
              Submit for Approval
            </Button>
          )}

          {/* Approve Button */}
          {canApprove && (
            <Button
              variant="primary"
              onClick={() => {
                setSelectedApproval(userApproval);
                setShowApproveModal(true);
              }}
              className="flex-1"
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve
            </Button>
          )}

          {/* Reject Button */}
          {canApprove && (
            <Button
              variant="danger"
              onClick={() => {
                setSelectedApproval(userApproval);
                setShowRejectModal(true);
              }}
              className="flex-1"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </Button>
          )}

          {/* Bypass Button (Owner only) */}
          {canBypass && (
            <Button
              variant="secondary"
              onClick={() => setShowBypassModal(true)}
              className="flex-1 border-2 border-yellow-500 dark:border-yellow-600"
            >
              <Shield className="w-4 h-4" />
              Bypass Approval (Owner)
            </Button>
          )}
        </div>

        {/* Pending approval info */}
        {canApprove && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-blue-800 dark:text-blue-200">
                  Your Approval Required
                </p>
                <p className="text-blue-700 dark:text-blue-300 mt-1">
                  This quote is pending your approval at Level {userApproval?.level}.
                  Please review and approve or reject.
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Modals */}
      {showApproveModal && selectedApproval && (
        <ApproveQuoteModal
          isOpen={showApproveModal}
          onClose={() => setShowApproveModal(false)}
          onApprove={handleApprove}
          quoteNumber={quoteNumber}
          quoteTitle={quoteTitle}
          quoteTotal={quoteTotal}
          approvalLevel={selectedApproval.level}
        />
      )}

      {showRejectModal && selectedApproval && (
        <RejectQuoteModal
          isOpen={showRejectModal}
          onClose={() => setShowRejectModal(false)}
          onReject={handleReject}
          quoteNumber={quoteNumber}
          quoteTitle={quoteTitle}
          quoteTotal={quoteTotal}
          approvalLevel={selectedApproval.level}
        />
      )}

      {showBypassModal && (
        <BypassApprovalModal
          isOpen={showBypassModal}
          onClose={() => setShowBypassModal(false)}
          onBypass={handleBypass}
          quoteNumber={quoteNumber}
          quoteTitle={quoteTitle}
        />
      )}
    </>
  );
}

export default ApprovalActionsCard;
