/**
 * Public URL Card Component
 * Displays active public URL with copy, deactivate, and analytics actions
 */

'use client';

import React, { useState } from 'react';
import { Link as LinkIcon, Copy, Eye, Lock, Calendar, XCircle, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';
import type { PublicAccessUrl } from '@/lib/types/quotes';
import { deactivatePublicUrl } from '@/lib/api/quote-public-access';

interface PublicURLCardProps {
  publicAccess: PublicAccessUrl;
  onViewAnalytics: () => void;
  onDeactivate: () => void;
  className?: string;
}

export function PublicURLCard({
  publicAccess,
  onViewAnalytics,
  onDeactivate,
  className = '',
}: PublicURLCardProps) {
  const [isCopying, setIsCopying] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const handleCopyUrl = async () => {
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(publicAccess.public_url);
      toast.success('Public URL copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy URL');
    } finally {
      setIsCopying(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm('Are you sure you want to deactivate this public URL? It will no longer be accessible.')) {
      return;
    }

    setIsDeactivating(true);
    try {
      await deactivatePublicUrl(publicAccess.public_url.split('/').pop()!);
      toast.success('Public URL deactivated successfully');
      onDeactivate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to deactivate URL');
    } finally {
      setIsDeactivating(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isExpired = publicAccess.expires_at
    ? new Date(publicAccess.expires_at) < new Date()
    : false;

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
            <LinkIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Public Quote Link
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Share this link with customers
            </p>
          </div>
        </div>
        {isExpired && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
            Expired
          </span>
        )}
      </div>

      {/* URL Display */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Public URL
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400 break-all font-mono">
              {publicAccess.public_url}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyUrl}
            loading={isCopying}
            className="flex-shrink-0"
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Password Protected */}
        <div className="flex items-start gap-2">
          <Lock
            className={`w-4 h-4 mt-0.5 ${
              publicAccess.has_password
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-400 dark:text-gray-600'
            }`}
          />
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Protection</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {publicAccess.has_password ? 'Password Protected' : 'Public Access'}
            </p>
            {publicAccess.has_password && publicAccess.password_hint && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Hint: {publicAccess.password_hint}
              </p>
            )}
          </div>
        </div>

        {/* Expiration */}
        <div className="flex items-start gap-2">
          <Calendar className="w-4 h-4 mt-0.5 text-gray-400" />
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Expires</p>
            <p
              className={`text-sm font-semibold ${
                isExpired
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-900 dark:text-white'
              }`}
            >
              {formatDate(publicAccess.expires_at)}
            </p>
          </div>
        </div>

        {/* Created */}
        <div className="flex items-start gap-2">
          <Eye className="w-4 h-4 mt-0.5 text-gray-400" />
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Created</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {formatDate(publicAccess.created_at)}
            </p>
          </div>
        </div>

        {/* Access Token */}
        <div className="flex items-start gap-2">
          <LinkIcon className="w-4 h-4 mt-0.5 text-gray-400" />
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Token</p>
            <p className="text-sm font-mono text-gray-900 dark:text-white">
              {publicAccess.access_token.substring(0, 8)}...
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          variant="secondary"
          onClick={onViewAnalytics}
          className="w-full sm:flex-1"
        >
          <BarChart3 className="w-4 h-4 mr-2" />
          View Analytics
        </Button>
        <Button
          variant="danger"
          onClick={handleDeactivate}
          loading={isDeactivating}
          disabled={isDeactivating}
          className="w-full sm:w-auto sm:flex-shrink-0"
        >
          <XCircle className="w-4 h-4 mr-2" />
          Deactivate
        </Button>
      </div>
    </div>
  );
}

export default PublicURLCard;
