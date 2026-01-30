/**
 * Public URL Modal Component
 * Generate and manage public quote URLs with password protection
 */

'use client';

import React, { useState } from 'react';
import { X, Link as LinkIcon, Lock, Calendar, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import toast from 'react-hot-toast';
import type { PublicAccessUrl } from '@/lib/types/quotes';
import { generatePublicUrl } from '@/lib/api/quote-public-access';

interface PublicURLModalProps {
  isOpen: boolean;
  onClose: () => void;
  quoteId: string;
  onSuccess: (publicAccess: PublicAccessUrl) => void;
}

export function PublicURLModal({
  isOpen,
  onClose,
  quoteId,
  onSuccess,
}: PublicURLModalProps) {
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordHint, setPasswordHint] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<PublicAccessUrl | null>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setUsePassword(false);
    setPassword('');
    setPasswordHint('');
    setExpiresAt('');
    setShowSuccess(false);
    setGeneratedUrl(null);
  };

  const handleClose = () => {
    if (!isGenerating) {
      handleReset();
      onClose();
    }
  };

  const validateForm = () => {
    if (usePassword) {
      if (!password || password.length < 4) {
        toast.error('Password must be at least 4 characters');
        return false;
      }
      if (password.length > 50) {
        toast.error('Password must be 50 characters or less');
        return false;
      }
    }

    if (passwordHint && passwordHint.length > 100) {
      toast.error('Password hint must be 100 characters or less');
      return false;
    }

    if (expiresAt) {
      const expDate = new Date(expiresAt);
      if (expDate <= new Date()) {
        toast.error('Expiration date must be in the future');
        return false;
      }
    }

    return true;
  };

  const handleGenerate = async () => {
    if (!validateForm()) return;

    setIsGenerating(true);

    try {
      const dto: any = {};

      if (usePassword && password) {
        dto.password = password;
      }

      if (passwordHint) {
        dto.password_hint = passwordHint;
      }

      if (expiresAt) {
        dto.expires_at = new Date(expiresAt).toISOString();
      }

      const result = await generatePublicUrl(quoteId, dto);
      setGeneratedUrl(result);
      setShowSuccess(true);
      toast.success('Public URL generated successfully!');
      onSuccess(result);
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate public URL');
    } finally {
      setIsGenerating(false);
    }
  };

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateString = minDate.toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {showSuccess ? 'Public URL Generated!' : 'Generate Public Quote Link'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            disabled={isGenerating}
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          {!showSuccess ? (
            <>
              {/* Info Box */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <LinkIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900 dark:text-blue-100">
                    <p className="font-semibold mb-1">About Public Links</p>
                    <p>
                      Generate a shareable link that allows customers to view this quote
                      without logging in. You can add password protection and set an
                      expiration date for security.
                    </p>
                  </div>
                </div>
              </div>

              {/* Password Protection Toggle */}
              <div className="mb-6">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={usePassword}
                    onChange={(e) => setUsePassword(e.target.checked)}
                    disabled={isGenerating}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <div className="flex items-center gap-2">
                    <Lock className="w-5 h-5 text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        Password Protection
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Require a password to view this quote
                      </p>
                    </div>
                  </div>
                </label>
              </div>

              {/* Password Fields */}
              {usePassword && (
                <div className="space-y-4 mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Password <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter a secure password"
                      disabled={isGenerating}
                      maxLength={50}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Minimum 4 characters, maximum 50 characters
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Password Hint (Optional)
                    </label>
                    <Input
                      type="text"
                      value={passwordHint}
                      onChange={(e) => setPasswordHint(e.target.value)}
                      placeholder="e.g., Your job site address"
                      disabled={isGenerating}
                      maxLength={100}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Helps customers remember the password (max 100 characters)
                    </p>
                  </div>
                </div>
              )}

              {/* Expiration Date */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Expiration Date (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="w-5 h-5 text-gray-400" />
                  </div>
                  <Input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    min={minDateString}
                    disabled={isGenerating}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Leave blank for no expiration
                </p>
              </div>

              {/* Warning */}
              {!usePassword && (
                <div className="flex items-start gap-2 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg mb-6">
                  <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-orange-900 dark:text-orange-100">
                    <p className="font-semibold mb-1">Public Access Warning</p>
                    <p>
                      Without password protection, anyone with this link can view the
                      quote. Consider adding a password for sensitive quotes.
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleClose}
                  disabled={isGenerating}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleGenerate}
                  disabled={isGenerating || (usePassword && !password)}
                  loading={isGenerating}
                  className="flex-1"
                >
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Generate Public Link
                </Button>
              </div>
            </>
          ) : (
            /* Success State */
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Public Link Created!
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Your public quote link is ready to share with customers.
              </p>

              {generatedUrl && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6 text-left max-w-md mx-auto">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                    Link Details:
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="text-gray-600 dark:text-gray-400 mb-1">Public URL:</p>
                      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 break-all">
                        <code className="text-xs text-blue-600 dark:text-blue-400">
                          {generatedUrl.public_url}
                        </code>
                      </div>
                    </div>

                    {generatedUrl.has_password && (
                      <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                        <Lock className="w-4 h-4" />
                        <span>Password Protected</span>
                      </div>
                    )}

                    {generatedUrl.password_hint && (
                      <div>
                        <p className="text-gray-600 dark:text-gray-400 mb-1">Password Hint:</p>
                        <p className="text-gray-900 dark:text-white italic">
                          "{generatedUrl.password_hint}"
                        </p>
                      </div>
                    )}

                    {generatedUrl.expires_at && (
                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Expires: {new Date(generatedUrl.expires_at).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Button variant="primary" onClick={handleClose}>
                Done
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PublicURLModal;
