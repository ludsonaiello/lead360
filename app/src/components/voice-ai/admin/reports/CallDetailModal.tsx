import React from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { CallLog } from '@/lib/types/voice-ai';
import { X, Clock, Phone, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

interface CallDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  call: CallLog | null;
  tenantName?: string;
}

/**
 * Modal displaying full call details including transcript
 */
export default function CallDetailModal({
  isOpen,
  onClose,
  call,
  tenantName,
}: CallDetailModalProps) {
  if (!call) return null;

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20';
      case 'failed':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20';
      case 'in_progress':
        return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20';
      case 'transferred':
        return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/20';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  const getOutcomeColor = (outcome: string | null) => {
    if (!outcome) return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/20';
    switch (outcome) {
      case 'lead_created':
        return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/20';
      case 'transferred':
        return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/20';
      case 'abandoned':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/20';
      case 'completed':
        return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/20';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/20';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Call Details
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {formatDate(call.started_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Call Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Call SID
            </label>
            <p className="text-sm text-gray-900 dark:text-gray-100 font-mono">
              {call.call_sid}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tenant
            </label>
            <p className="text-sm text-gray-900 dark:text-gray-100">
              {tenantName || call.tenant_id}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              From
            </label>
            <p className="text-sm text-gray-900 dark:text-gray-100 font-mono">
              {call.from_number}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              To
            </label>
            <p className="text-sm text-gray-900 dark:text-gray-100 font-mono">
              {call.to_number}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Direction
            </label>
            <p className="text-sm text-gray-900 dark:text-gray-100 capitalize">
              {call.direction}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <span
              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                call.status
              )}`}
            >
              {call.status}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Outcome
            </label>
            <span
              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getOutcomeColor(
                call.outcome
              )}`}
            >
              {call.outcome || 'N/A'}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Duration
            </label>
            <div className="flex items-center gap-2 text-sm text-gray-900 dark:text-gray-100">
              <Clock className="h-4 w-4" />
              <span>{formatDuration(call.duration_seconds)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Is Overage
            </label>
            <div className="flex items-center gap-2">
              {call.is_overage ? (
                <>
                  <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm text-red-600 dark:text-red-400">Yes</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-green-600 dark:text-green-400">No</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Transcript Summary */}
        {call.transcript_summary && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Transcript Summary
            </label>
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                {call.transcript_summary}
              </p>
            </div>
          </div>
        )}

        {/* Full Transcript */}
        {call.full_transcript && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Full Transcript
            </label>
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg max-h-96 overflow-y-auto">
              <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap font-mono">
                {call.full_transcript}
              </p>
            </div>
          </div>
        )}

        {/* Actions Taken */}
        {call.actions_taken && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Actions Taken
            </label>
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                {call.actions_taken}
              </p>
            </div>
          </div>
        )}

        {/* Lead Link */}
        {call.lead_id && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Related Lead
            </label>
            <Link
              href={`/leads/${call.lead_id}`}
              className="inline-flex items-center gap-2 text-sm text-brand-600 dark:text-brand-400 hover:underline"
            >
              View Lead
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
