/**
 * Email Preview Component
 * Shows preview of quote email before sending
 */

'use client';

import React from 'react';
import { Mail, Paperclip, Link as LinkIcon, FileText } from 'lucide-react';

interface EmailPreviewProps {
  quoteNumber: string;
  quoteTitle: string;
  quoteTotal: number;
  recipientEmail: string;
  ccEmails?: string;
  customSubject?: string;
  customMessage?: string;
  companyName?: string;
  className?: string;
}

export function EmailPreview({
  quoteNumber,
  quoteTitle,
  quoteTotal,
  recipientEmail,
  ccEmails,
  customSubject,
  customMessage,
  companyName = 'Your Company',
  className = '',
}: EmailPreviewProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className={`bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
        <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <h3 className="font-semibold text-gray-900 dark:text-white">Email Preview</h3>
      </div>

      {/* Email Headers */}
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex">
          <span className="font-semibold text-gray-700 dark:text-gray-300 w-16">To:</span>
          <span className="text-gray-900 dark:text-white">{recipientEmail || 'customer@example.com'}</span>
        </div>
        {ccEmails && (
          <div className="flex">
            <span className="font-semibold text-gray-700 dark:text-gray-300 w-16">CC:</span>
            <span className="text-gray-900 dark:text-white">{ccEmails}</span>
          </div>
        )}
        <div className="flex">
          <span className="font-semibold text-gray-700 dark:text-gray-300 w-16">Subject:</span>
          <span className="text-gray-900 dark:text-white">
            {customSubject || `Quote ${quoteNumber} - ${quoteTitle}`}
          </span>
        </div>
      </div>

      {/* Email Body Preview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 text-sm space-y-3">
        <p className="text-gray-700 dark:text-gray-300">
          Thank you for your interest! We're pleased to present quote {quoteNumber}.
        </p>

        {customMessage && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-600 pl-4 py-2">
            <p className="text-gray-800 dark:text-gray-200 italic whitespace-pre-line">
              "{customMessage}"
            </p>
          </div>
        )}

        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
            Quote Summary
          </h4>
          <div className="space-y-1 text-gray-700 dark:text-gray-300">
            <div className="flex justify-between">
              <span>Quote Number:</span>
              <span className="font-medium">{quoteNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Title:</span>
              <span className="font-medium">{quoteTitle}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="font-semibold">Total:</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(quoteTotal)}
              </span>
            </div>
          </div>
        </div>

        <p className="text-gray-700 dark:text-gray-300">
          Click the button below to view your quote online:
        </p>

        <div className="text-center py-2">
          <div className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold">
            View Quote Online
          </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-3">
          This quote is valid for 30 days from the date of issue. Please review and let us know if you have any questions.
        </p>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-2 text-xs text-gray-600 dark:text-gray-400">
          <p className="font-semibold mb-1">Best regards,</p>
          <p>{companyName}</p>
        </div>
      </div>

      {/* Attachments Info */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Attachments:
        </p>
        <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <FileText className="w-4 h-4" />
            <span>PDF Quote</span>
          </div>
          <div className="flex items-center gap-1">
            <LinkIcon className="w-4 h-4" />
            <span>Public Viewing Link</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmailPreview;
