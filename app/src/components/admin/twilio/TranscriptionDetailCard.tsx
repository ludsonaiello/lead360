/**
 * Transcription Detail Card Component
 * Sprint 4: Transcription Monitoring
 * Main card displaying transcription metadata and processing details
 */

'use client';

import React from 'react';
import { TranscriptionDetail } from '@/lib/types/twilio-admin';
import { TranscriptionStatusBadge } from './TranscriptionStatusBadge';
import { formatDateTime } from '@/lib/utils/date-formatter';
import { formatCurrency } from '@/lib/utils/currency-formatter';
import { FileText, DollarSign, Clock, Globe, Zap } from 'lucide-react';

interface TranscriptionDetailCardProps {
  transcription: TranscriptionDetail;
}

export function TranscriptionDetailCard({ transcription }: TranscriptionDetailCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            Transcription Details
          </h3>
          <TranscriptionStatusBadge status={transcription.status} size="md" />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Transcription ID */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Transcription ID
          </label>
          <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
            {transcription.id}
          </div>
        </div>

        {/* Provider */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Provider
          </label>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {transcription.transcription_provider}
          </div>
        </div>

        {/* Timestamps */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Created
            </label>
            <div className="text-sm text-gray-900 dark:text-gray-100">
              {formatDateTime(transcription.created_at)}
            </div>
          </div>
          {transcription.completed_at && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Completed
              </label>
              <div className="text-sm text-gray-900 dark:text-gray-100">
                {formatDateTime(transcription.completed_at)}
              </div>
            </div>
          )}
        </div>

        {/* Processing Details Grid */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {/* Language Detected */}
          {transcription.language_detected && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <Globe className="h-3 w-3" />
                Language
              </label>
              <div className="text-sm text-gray-900 dark:text-gray-100 uppercase">
                {transcription.language_detected}
              </div>
            </div>
          )}

          {/* Processing Duration */}
          {transcription.processing_duration_seconds !== undefined && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Processing Time
              </label>
              <div className="text-sm text-gray-900 dark:text-gray-100">
                {transcription.processing_duration_seconds.toFixed(2)}s
              </div>
            </div>
          )}

          {/* Cost */}
          {transcription.cost && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Cost
              </label>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatCurrency(transcription.cost)}
              </div>
            </div>
          )}
        </div>

        {/* Error Message (if failed) */}
        {transcription.status === 'failed' && transcription.error_message && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <label className="block text-xs font-medium text-red-600 dark:text-red-400 mb-2">
              Error Message
            </label>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-400">
                {transcription.error_message}
              </p>
            </div>
          </div>
        )}

        {/* Last Updated */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Last Updated:</span>
            <span className="font-medium">{formatDateTime(transcription.updated_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TranscriptionDetailCard;
