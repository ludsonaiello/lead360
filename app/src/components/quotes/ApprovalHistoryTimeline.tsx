/**
 * Approval History Timeline Component
 * Displays complete approval workflow history for a quote
 * Shows all past approval attempts, rejections, and current workflow
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  User,
  MessageSquare,
  Star,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  getApprovalHistory,
  type ApprovalHistoryResponse,
  type ApprovalWorkflow,
} from '@/lib/api/quote-approvals';
import toast from 'react-hot-toast';

interface ApprovalHistoryTimelineProps {
  quoteId: string;
  className?: string;
}

export function ApprovalHistoryTimeline({
  quoteId,
  className = '',
}: ApprovalHistoryTimelineProps) {
  const [history, setHistory] = useState<ApprovalHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());

  // Fetch approval history
  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const data = await getApprovalHistory(quoteId);
        setHistory(data);

        // Auto-expand current workflow
        if (data.current_workflow_id) {
          setExpandedWorkflows(new Set([data.current_workflow_id]));
        }
      } catch (error: any) {
        console.error('Failed to fetch approval history:', error);
        toast.error('Could not load approval history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [quoteId]);

  // Toggle workflow expansion
  const toggleWorkflow = (workflowId: string) => {
    const newExpanded = new Set(expandedWorkflows);
    if (newExpanded.has(workflowId)) {
      newExpanded.delete(workflowId);
    } else {
      newExpanded.add(workflowId);
    }
    setExpandedWorkflows(newExpanded);
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="success">Approved</Badge>;
      case 'rejected':
        return <Badge variant="danger">Rejected</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending</Badge>;
      default:
        return <Badge variant="gray">{status}</Badge>;
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  if (loading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="flex justify-center">
          <LoadingSpinner size="md" />
        </div>
      </Card>
    );
  }

  if (!history || history.total_workflows === 0) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="text-center py-8">
          <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            No approval history available
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            This quote hasn't been submitted for approval yet
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-6 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          Approval History
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {history.total_workflows} approval workflow{history.total_workflows > 1 ? 's' : ''}
        </p>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

        <div className="space-y-6">
          {history.workflows.map((workflow, index) => {
            const isExpanded = expandedWorkflows.has(workflow.workflow_id);
            const rejectedApproval = workflow.approvals.find(a => a.status === 'rejected');

            return (
              <div key={workflow.workflow_id} className="relative pl-12">
                {/* Timeline dot */}
                <div className="absolute left-4 top-2 w-4 h-4 rounded-full bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center">
                  {workflow.is_current && (
                    <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                  )}
                </div>

                {/* Workflow card */}
                <div
                  className={`border rounded-lg overflow-hidden ${
                    workflow.is_current
                      ? 'border-blue-500 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/10'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                >
                  {/* Workflow header */}
                  <button
                    onClick={() => toggleWorkflow(workflow.workflow_id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(workflow.status)}
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-gray-900 dark:text-white">
                            Workflow #{history.total_workflows - index}
                          </h4>
                          {workflow.is_current && (
                            <Star className="w-4 h-4 text-blue-600 dark:text-blue-400 fill-current" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Submitted {formatDate(workflow.submitted_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(workflow.status)}
                      <span className="text-xs text-gray-500 dark:text-gray-500">
                        {workflow.progress.completed}/{workflow.progress.total} approved
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {/* Workflow details */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
                      {/* Rejection notice */}
                      {rejectedApproval && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
                          <div className="flex items-start gap-2">
                            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold text-red-800 dark:text-red-200">
                                Rejected at Level {rejectedApproval.level}
                              </p>
                              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                By {rejectedApproval.approver.name}
                              </p>
                              {rejectedApproval.comments && (
                                <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/20 rounded">
                                  <p className="text-sm text-red-900 dark:text-red-100">
                                    <MessageSquare className="w-4 h-4 inline mr-1" />
                                    {rejectedApproval.comments}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Approval levels */}
                      <div className="space-y-3">
                        {workflow.approvals.map((approval) => (
                          <div
                            key={approval.id}
                            className={`p-3 rounded-lg border ${
                              approval.status === 'approved'
                                ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                                : approval.status === 'rejected'
                                ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                                : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                {getStatusIcon(approval.status)}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-900 dark:text-white">
                                      Level {approval.level}
                                    </span>
                                    {getStatusBadge(approval.status)}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-600 dark:text-gray-400">
                                    <User className="w-4 h-4" />
                                    <span>{approval.approver.name}</span>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-xs">{approval.approver.email}</span>
                                  </div>
                                  {approval.decided_at && (
                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                      {approval.status === 'approved' ? 'Approved' : 'Rejected'} on{' '}
                                      {formatDate(approval.decided_at)}
                                    </p>
                                  )}
                                  {approval.comments && (
                                    <div className="mt-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                      <p className="text-sm text-gray-700 dark:text-gray-300">
                                        <MessageSquare className="w-4 h-4 inline mr-1" />
                                        {approval.comments}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

export default ApprovalHistoryTimeline;
