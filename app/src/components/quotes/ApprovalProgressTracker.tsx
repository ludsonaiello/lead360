/**
 * Approval Progress Tracker Component
 * Visual progress indicator for multi-level approval workflow
 * Uses Wizard-style step indicator with color coding
 */

'use client';

import React from 'react';
import { CheckCircle2, Clock, XCircle, User } from 'lucide-react';
import type { Approval } from '@/lib/api/quote-approvals';

interface ApprovalProgressTrackerProps {
  approvals: Approval[];
  className?: string;
  onApprovalClick?: (approval: Approval) => void;
}

export function ApprovalProgressTracker({
  approvals,
  className = '',
  onApprovalClick,
}: ApprovalProgressTrackerProps) {
  if (approvals.length === 0) {
    return (
      <div className={`text-center py-4 ${className}`}>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No approval workflow configured
        </p>
      </div>
    );
  }

  // Calculate progress
  const completedCount = approvals.filter(
    (a) => a.status === 'approved'
  ).length;
  const rejectedCount = approvals.filter(
    (a) => a.status === 'rejected'
  ).length;
  const progress = (completedCount / approvals.length) * 100;

  // Check if any approval is rejected
  const hasRejection = rejectedCount > 0;

  return (
    <div className={`w-full ${className}`}>
      {/* Step labels */}
      <div className="flex justify-between mb-4">
        {approvals.map((approval, index) => {
          const isCompleted = approval.status === 'approved';
          const isPending = approval.status === 'pending';
          const isRejected = approval.status === 'rejected';

          return (
            <button
              key={approval.id}
              type="button"
              onClick={() => onApprovalClick?.(approval)}
              disabled={!onApprovalClick}
              className={`flex flex-col items-center gap-2 transition-all ${
                isCompleted
                  ? 'text-green-600 dark:text-green-400 font-semibold'
                  : isRejected
                  ? 'text-red-600 dark:text-red-400 font-semibold'
                  : isPending
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-gray-500 dark:text-gray-400 font-medium'
              } ${
                onApprovalClick
                  ? 'hover:scale-105 cursor-pointer'
                  : 'cursor-default'
              }`}
              title={`Level ${approval.level}: ${approval.approver.name} - ${approval.status}`}
            >
              {/* Circle indicator */}
              <div
                className={`
                  relative w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
                  ${
                    isCompleted
                      ? 'bg-green-100 dark:bg-green-900/30 border-green-600 dark:border-green-400 text-green-600 dark:text-green-400'
                      : isRejected
                      ? 'bg-red-100 dark:bg-red-900/30 border-red-600 dark:border-red-400 text-red-600 dark:text-red-400'
                      : isPending
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'
                  }
                `}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : isRejected ? (
                  <XCircle className="w-5 h-5" />
                ) : isPending ? (
                  <Clock className="w-5 h-5" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              {/* Label */}
              <div className="text-center">
                <p className="text-xs font-semibold">Level {approval.level}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 max-w-[80px] truncate">
                  {approval.approver.name}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
        <div
          className={`h-2 rounded-full transition-all duration-300 ease-in-out ${
            hasRejection
              ? 'bg-red-600 dark:bg-red-500'
              : 'bg-green-600 dark:bg-green-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Status summary */}
      <div className="flex items-center justify-center gap-4 text-sm">
        {hasRejection ? (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <XCircle className="w-4 h-4" />
            <span className="font-semibold">Rejected</span>
          </div>
        ) : completedCount === approvals.length ? (
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="font-semibold">Fully Approved</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Clock className="w-4 h-4" />
            <span className="font-semibold">
              {completedCount} of {approvals.length} approved
            </span>
          </div>
        )}
      </div>

      {/* Approval details (expandable list) */}
      <div className="mt-4 space-y-2">
        {approvals.map((approval) => (
          <div
            key={approval.id}
            className={`p-3 rounded-lg border ${
              approval.status === 'approved'
                ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                : approval.status === 'rejected'
                ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                : approval.status === 'pending'
                ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="text-sm font-semibold">
                    Level {approval.level}: {approval.approver.name}
                  </p>
                  {approval.status === 'approved' && approval.approved_at && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Approved {new Date(approval.approved_at).toLocaleDateString()}{' '}
                      at {new Date(approval.approved_at).toLocaleTimeString()}
                    </p>
                  )}
                  {approval.status === 'rejected' && approval.rejected_at && (
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Rejected {new Date(approval.rejected_at).toLocaleDateString()}{' '}
                      at {new Date(approval.rejected_at).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>

              {approval.status === 'approved' ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              ) : approval.status === 'rejected' ? (
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              ) : (
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              )}
            </div>

            {/* Comments */}
            {approval.comments && (
              <div className="mt-2 pl-7">
                <p className="text-xs text-gray-700 dark:text-gray-300 italic">
                  &ldquo;{approval.comments}&rdquo;
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ApprovalProgressTracker;
