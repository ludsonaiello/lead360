/**
 * Failed Transcriptions Table Component
 * Sprint 4: Transcription Monitoring
 * Displays failed transcriptions with selection and retry capabilities
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { FailedTranscription } from '@/lib/types/twilio-admin';
import { formatRelativeTime, formatDuration } from '@/lib/utils/date-formatter';
import { RetryTranscriptionButton } from './RetryTranscriptionButton';
import { AlertCircle } from 'lucide-react';

interface FailedTranscriptionsTableProps {
  transcriptions: FailedTranscription[];
  onRetrySuccess?: () => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function FailedTranscriptionsTable({
  transcriptions,
  onRetrySuccess,
  selectedIds,
  onSelectionChange,
}: FailedTranscriptionsTableProps) {
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(transcriptions.map((t) => t.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((selectedId) => selectedId !== id));
    }
  };

  const allSelected = transcriptions.length > 0 && selectedIds.length === transcriptions.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < transcriptions.length;

  if (transcriptions.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
            <AlertCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">
              No Failed Transcriptions
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              All transcriptions are processing successfully!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th scope="col" className="px-4 py-3 text-left w-12">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="
                    h-4 w-4 rounded border-gray-300 dark:border-gray-600
                    text-blue-600 focus:ring-blue-500 dark:bg-gray-800
                    cursor-pointer
                  "
                  aria-label="Select all transcriptions"
                />
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Call SID
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Provider
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Error Message
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Duration
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Failed
              </th>
              <th
                scope="col"
                className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {transcriptions.map((transcription) => (
              <tr
                key={transcription.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(transcription.id)}
                    onChange={(e) => handleSelectOne(transcription.id, e.target.checked)}
                    className="
                      h-4 w-4 rounded border-gray-300 dark:border-gray-600
                      text-blue-600 focus:ring-blue-500 dark:bg-gray-800
                      cursor-pointer
                    "
                    aria-label={`Select transcription ${transcription.call_details.twilio_call_sid}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/communications/twilio/transcriptions/${transcription.id}`}
                    className="
                      text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300
                      font-mono text-sm font-medium hover:underline
                    "
                  >
                    {transcription.call_details.twilio_call_sid}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  {transcription.transcription_provider}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-start gap-2 max-w-md">
                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-red-600 dark:text-red-400 line-clamp-2">
                      {transcription.error_message}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {formatDuration(transcription.call_details.recording_duration_seconds)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {formatRelativeTime(transcription.created_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <RetryTranscriptionButton
                    transcriptionId={transcription.id}
                    onSuccess={onRetrySuccess}
                    size="sm"
                    variant="secondary"
                    showIcon={false}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Table Footer with Summary */}
      <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-600 dark:text-gray-400">
            Showing <span className="font-medium text-gray-900 dark:text-gray-100">{transcriptions.length}</span> failed
            transcription{transcriptions.length !== 1 ? 's' : ''}
          </div>
          {selectedIds.length > 0 && (
            <div className="text-blue-600 dark:text-blue-400 font-medium">
              {selectedIds.length} selected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FailedTranscriptionsTable;
