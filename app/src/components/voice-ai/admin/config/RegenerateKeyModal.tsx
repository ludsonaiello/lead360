'use client';

import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { AlertTriangle, Copy, Check, Key } from 'lucide-react';
import voiceAiApi from '@/lib/api/voice-ai';
import ErrorModal from '@/components/ui/ErrorModal';

interface RegenerateKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (preview: string) => void;
}

/**
 * Regenerate Agent API Key Modal
 * Two-step modal: Warning confirmation → Display plain key once
 */
export default function RegenerateKeyModal({
  isOpen,
  onClose,
  onSuccess,
}: RegenerateKeyModalProps) {
  const [step, setStep] = useState<'warning' | 'display'>('warning');
  const [plainKey, setPlainKey] = useState('');
  const [preview, setPreview] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    // Reset state
    setStep('warning');
    setPlainKey('');
    setPreview('');
    setCopied(false);
    setError(null);
    onClose();
  };

  const handleConfirm = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await voiceAiApi.regenerateAgentKey();
      setPlainKey(response.plain_key);
      setPreview(response.preview);
      setStep('display');
      onSuccess(response.preview);
    } catch (err: any) {
      console.error('Failed to regenerate key:', err);
      setError(err.response?.data?.message || err.message || 'Failed to regenerate key');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(plainKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} title="Regenerate Agent API Key">
        {step === 'warning' && (
          <div className="space-y-6">
            {/* Warning Content */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 shrink-0" />
                <div className="space-y-2">
                  <h4 className="font-semibold text-yellow-800 dark:text-yellow-300">
                    Warning: This action will invalidate the current key
                  </h4>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1 list-disc list-inside">
                    <li>All agents using the old key will stop working immediately</li>
                    <li>You must update all agents with the new key</li>
                    <li>The new key will be shown only ONCE</li>
                    <li>This action cannot be undone</li>
                  </ul>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to regenerate the agent API key?
            </p>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleConfirm} loading={loading}>
                Yes, Regenerate Key
              </Button>
            </div>
          </div>
        )}

        {step === 'display' && (
          <div className="space-y-6">
            {/* Success Header */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex gap-3">
                <Key className="h-6 w-6 text-green-600 dark:text-green-400 shrink-0" />
                <div className="space-y-1">
                  <h4 className="font-semibold text-green-800 dark:text-green-300">
                    New Agent API Key Generated
                  </h4>
                  <p className="text-sm text-green-700 dark:text-green-400">
                    Copy this key now. It will not be shown again.
                  </p>
                </div>
              </div>
            </div>

            {/* Plain Key Display */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Agent API Key (Copy Now)
              </label>
              <div className="relative">
                <div className="font-mono text-sm bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-4 pr-12 break-all select-all">
                  {plainKey}
                </div>
                <button
                  onClick={handleCopy}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <Copy className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  )}
                </button>
              </div>
              {copied && (
                <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                  <Check className="h-4 w-4" />
                  Copied to clipboard!
                </p>
              )}
            </div>

            {/* Warning Notice */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-300 font-semibold">
                ⚠️ Save this key now. It will not be shown again.
              </p>
              <p className="text-sm text-red-700 dark:text-red-400 mt-1">
                Once you close this modal, you will only see the masked preview: {preview}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button onClick={handleClose} disabled={!copied}>
                {copied ? 'Close' : 'Copy Key First'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Error Modal */}
      {error && step === 'warning' && (
        <ErrorModal
          isOpen={!!error}
          onClose={() => setError(null)}
          message={error}
        />
      )}
    </>
  );
}
