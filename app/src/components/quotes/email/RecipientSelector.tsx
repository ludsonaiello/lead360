/**
 * Recipient Selector Component
 * Email input with validation and CC support
 */

'use client';

import React from 'react';
import { Mail, AlertCircle, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { isValidEmail } from '@/lib/api/quote-email';

interface RecipientSelectorProps {
  recipientEmail: string;
  ccEmails: string;
  onRecipientChange: (email: string) => void;
  onCcChange: (emails: string) => void;
  defaultEmail?: string;
  disabled?: boolean;
}

export function RecipientSelector({
  recipientEmail,
  ccEmails,
  onRecipientChange,
  onCcChange,
  defaultEmail,
  disabled = false,
}: RecipientSelectorProps) {
  const showRecipientValidation = recipientEmail.length > 0;
  const recipientIsValid = isValidEmail(recipientEmail);

  const parseCcEmails = () => {
    if (!ccEmails) return [];
    return ccEmails
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  };

  const ccEmailList = parseCcEmails();
  const allCcValid = ccEmailList.every((email) => isValidEmail(email));
  const showCcValidation = ccEmails.length > 0;

  return (
    <div className="space-y-4">
      {/* Recipient Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Recipient Email <span className="text-red-500">*</span>
        </label>

        {/* Use Default Email Button */}
        {defaultEmail && !recipientEmail && (
          <button
            type="button"
            onClick={() => onRecipientChange(defaultEmail)}
            disabled={disabled}
            className="mb-2 inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            <UserCheck className="w-4 h-4" />
            Use customer email: {defaultEmail}
          </button>
        )}

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Mail className="w-5 h-5 text-gray-400" />
          </div>
          <Input
            type="email"
            value={recipientEmail}
            onChange={(e) => onRecipientChange(e.target.value)}
            placeholder={defaultEmail || 'customer@example.com'}
            disabled={disabled}
            className={`pl-10 ${
              showRecipientValidation
                ? recipientIsValid
                  ? 'border-green-500 dark:border-green-600'
                  : 'border-red-500 dark:border-red-600'
                : ''
            }`}
          />
        </div>

        {/* Validation Message */}
        {showRecipientValidation && !recipientIsValid && (
          <div className="flex items-center gap-2 mt-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Please enter a valid email address</span>
          </div>
        )}

        {!recipientEmail && defaultEmail && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Defaults to customer's email: {defaultEmail}
          </p>
        )}
      </div>

      {/* CC Emails */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          CC (Optional)
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Mail className="w-5 h-5 text-gray-400" />
          </div>
          <Input
            type="text"
            value={ccEmails}
            onChange={(e) => onCcChange(e.target.value)}
            placeholder="manager@company.com, owner@company.com"
            disabled={disabled}
            className={`pl-10 ${
              showCcValidation
                ? allCcValid
                  ? 'border-green-500 dark:border-green-600'
                  : 'border-red-500 dark:border-red-600'
                : ''
            }`}
          />
        </div>

        {/* CC Validation */}
        {showCcValidation && !allCcValid && (
          <div className="flex items-center gap-2 mt-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>One or more email addresses are invalid</span>
          </div>
        )}

        {showCcValidation && allCcValid && (
          <div className="mt-2 flex flex-wrap gap-2">
            {ccEmailList.map((email, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                <Mail className="w-3 h-3" />
                {email}
              </span>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Separate multiple email addresses with commas
        </p>
      </div>
    </div>
  );
}

export default RecipientSelector;
