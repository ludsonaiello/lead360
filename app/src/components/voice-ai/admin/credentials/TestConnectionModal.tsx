'use client';

// ============================================================================
// TestConnectionModal Component
// ============================================================================
// Modal displaying test connection results for provider credentials
// ============================================================================

import React from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { ProviderWithCredential, TestConnectionResponse } from '@/lib/types/voice-ai';

interface TestConnectionModalProps {
  provider: ProviderWithCredential;
  result: TestConnectionResponse;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * TestConnectionModal - Display test connection results
 */
export default function TestConnectionModal({
  provider,
  result,
  isOpen,
  onClose,
}: TestConnectionModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg ${
                result.success
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : 'bg-red-100 dark:bg-red-900/30'
              }`}
            >
              {result.success ? (
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              ) : (
                <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {result.success ? 'Connection Successful' : 'Connection Failed'}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {provider.display_name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Result Message */}
        <div
          className={`rounded-lg p-4 ${
            result.success
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}
        >
          <p
            className={`text-sm ${
              result.success
                ? 'text-green-800 dark:text-green-200'
                : 'text-red-800 dark:text-red-200'
            }`}
          >
            {result.message}
          </p>
        </div>

        {/* Additional Information */}
        {result.success ? (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p>
              The {provider.display_name} API key is valid and working correctly. You can now
              use this provider for voice AI operations.
            </p>
          </div>
        ) : (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="mb-2">Please check the following:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Verify the API key is correct</li>
              <li>Ensure the API key has not expired</li>
              <li>Check that the provider service is operational</li>
              <li>Confirm your account has sufficient credits/quota</li>
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
