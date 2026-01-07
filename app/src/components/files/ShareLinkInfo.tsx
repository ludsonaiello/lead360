/**
 * ShareLinkInfo Component
 * Display share link information with views, downloads, and copy URL functionality
 */

'use client';

import React, { useState } from 'react';
import { Link, Eye, Download, Lock, Calendar, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { buildShareLinkUrl } from '@/lib/api/files';
import { copyToClipboard, formatFileDateTime, isShareLinkExpired, isMaxDownloadsReached } from '@/lib/utils/file-helpers';
import type { ShareLink } from '@/lib/types/files';
import toast from 'react-hot-toast';

interface ShareLinkInfoProps {
  shareLink: ShareLink;
  tenantSubdomain?: string;
  onCopyUrl?: () => void;
  onChangePassword?: () => void;
}

export function ShareLinkInfo({
  shareLink,
  tenantSubdomain,
  onCopyUrl,
  onChangePassword,
}: ShareLinkInfoProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = buildShareLinkUrl(shareLink.share_token, tenantSubdomain);
  const isExpired = shareLink.expires_at && isShareLinkExpired(shareLink.expires_at);
  const maxReached = isMaxDownloadsReached(shareLink.download_count, shareLink.max_downloads);

  const handleCopyUrl = async () => {
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setCopied(true);
      toast.success('Share link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
      onCopyUrl?.();
    } else {
      toast.error('Failed to copy link');
    }
  };

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Shared Link Active
          </span>
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-2">
          {isExpired && (
            <Badge variant="red" label="Expired" />
          )}
          {maxReached && !isExpired && (
            <Badge variant="red" label="Max Downloads" />
          )}
          {!isExpired && !maxReached && shareLink.is_active && (
            <Badge variant="green" label="Active" />
          )}
          {!shareLink.is_active && (
            <Badge variant="gray" label="Revoked" />
          )}
        </div>
      </div>

      {/* Share URL */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={shareUrl}
          readOnly
          className="flex-1 text-xs px-3 py-2 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 rounded text-gray-700 dark:text-gray-300 font-mono"
        />
        <button
          onClick={handleCopyUrl}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors flex items-center gap-1.5"
          title="Copy link"
        >
          {copied ? (
            <>
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span className="text-xs font-medium">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-3">
        {/* Views */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
          <Eye className="w-4 h-4 text-gray-500 dark:text-gray-400 mx-auto mb-1" />
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Views</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {shareLink.view_count || 0}
          </p>
        </div>

        {/* Downloads */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
          <Download className="w-4 h-4 text-gray-500 dark:text-gray-400 mx-auto mb-1" />
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Downloads</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {shareLink.download_count} / {shareLink.max_downloads || '∞'}
          </p>
        </div>

        {/* Password Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
          <Lock className="w-4 h-4 text-gray-500 dark:text-gray-400 mx-auto mb-1" />
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Password</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {shareLink.has_password ? (
              <span className="text-green-600 dark:text-green-400">Yes</span>
            ) : (
              <span className="text-gray-400">No</span>
            )}
          </p>
        </div>

        {/* Expiration */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2 text-center">
          <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400 mx-auto mb-1" />
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Expires</p>
          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
            {shareLink.expires_at ? (
              isExpired ? (
                <span className="text-red-600 dark:text-red-400">Expired</span>
              ) : (
                <span className="truncate block" title={formatFileDateTime(shareLink.expires_at)}>
                  {new Date(shareLink.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )
            ) : (
              <span className="text-gray-400">Never</span>
            )}
          </p>
        </div>
      </div>

      {/* Actions */}
      {shareLink.has_password && onChangePassword && (
        <div className="flex items-center justify-end">
          <button
            onClick={onChangePassword}
            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
          >
            Change Password
          </button>
        </div>
      )}

      {/* Warnings */}
      {(isExpired || maxReached) && (
        <div className="flex items-start gap-2 pt-2 border-t border-blue-200 dark:border-blue-800">
          <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-orange-700 dark:text-orange-300">
            {isExpired && 'This link has expired and can no longer be accessed.'}
            {maxReached && !isExpired && 'Download limit reached. No more downloads allowed.'}
          </p>
        </div>
      )}
    </div>
  );
}
