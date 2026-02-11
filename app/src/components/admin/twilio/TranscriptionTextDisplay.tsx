/**
 * Transcription Text Display Component
 * Sprint 4: Transcription Monitoring
 * Displays transcription text or error messages with formatting
 */

'use client';

import React, { useState } from 'react';
import { Copy, Check, AlertCircle, FileText } from 'lucide-react';

interface TranscriptionTextDisplayProps {
  text?: string;
  errorMessage?: string;
  status: 'completed' | 'failed' | 'queued' | 'processing';
}

export function TranscriptionTextDisplay({
  text,
  errorMessage,
  status,
}: TranscriptionTextDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (text) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Failed state
  if (status === 'failed') {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-red-900 dark:text-red-300 mb-2">
              Transcription Failed
            </h4>
            <p className="text-sm text-red-700 dark:text-red-400">
              {errorMessage || 'Unknown error occurred during transcription'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Processing/Queued state
  if (status === 'processing' || status === 'queued') {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
              {status === 'processing' ? 'Processing Transcription' : 'Transcription Queued'}
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-400">
              {status === 'processing'
                ? 'Transcription is currently being processed. Please check back in a few moments.'
                : 'Transcription is queued and will be processed shortly.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Completed with text
  if (text) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        {/* Header with Copy Button */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Transcription Text
            </h4>
          </div>
          <button
            onClick={handleCopy}
            className="
              inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
              text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800
              border border-gray-300 dark:border-gray-600 rounded-md
              hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
              focus:outline-none focus:ring-2 focus:ring-blue-500
            "
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy Text
              </>
            )}
          </button>
        </div>

        {/* Transcription Content */}
        <div className="p-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
              {text}
            </p>
          </div>
        </div>

        {/* Footer with Character Count */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {text.length.toLocaleString()} characters
          </p>
        </div>
      </div>
    );
  }

  // Completed but no text (edge case)
  return (
    <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-6 w-6 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No Transcription Available
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            The transcription completed but no text was generated.
          </p>
        </div>
      </div>
    </div>
  );
}

export default TranscriptionTextDisplay;
