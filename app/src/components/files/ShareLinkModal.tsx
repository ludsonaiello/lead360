/**
 * ShareLinkModal Component
 * Create temporary public share links with password protection
 */

'use client';

import React, { useState } from 'react';
import { Copy, Check, Eye, EyeOff, Calendar, Download } from 'lucide-react';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useFileShare } from '@/lib/hooks/useFileShare';
import { useAuth } from '@/lib/hooks/useAuth';
import { copyToClipboard } from '@/lib/utils/file-helpers';
import { buildShareLinkUrl } from '@/lib/api/files';
import { getCurrentTenant } from '@/lib/api/tenant';
import type { File } from '@/lib/types/files';
import toast from 'react-hot-toast';
import { useEffect } from 'react';

interface ShareLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
}

export function ShareLinkModal({ isOpen, onClose, file }: ShareLinkModalProps) {
  const { createShareLink, shareLink, isCreating, error, reset } = useFileShare();
  const { user } = useAuth();

  const [expiryDays, setExpiryDays] = useState('7');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [maxDownloads, setMaxDownloads] = useState('');
  const [copied, setCopied] = useState(false);
  const [tenantSubdomain, setTenantSubdomain] = useState<string | undefined>();

  // Fetch tenant subdomain on mount
  useEffect(() => {
    const fetchTenantSubdomain = async () => {
      try {
        const tenant = await getCurrentTenant();
        setTenantSubdomain(tenant.subdomain);
      } catch (err) {
        console.error('[ShareLinkModal] Failed to fetch tenant subdomain:', err);
      }
    };

    if (user?.tenant_id) {
      fetchTenantSubdomain();
    }
  }, [user?.tenant_id]);

  if (!file) return null;

  const handleGenerate = async () => {
    const expiresAt = expiryDays
      ? new Date(Date.now() + parseInt(expiryDays) * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    const result = await createShareLink({
      file_id: file.file_id,
      password: password || undefined,
      expires_at: expiresAt,
      max_downloads: maxDownloads ? parseInt(maxDownloads) : undefined,
    });

    if (result) {
      toast.success('Share link created successfully');
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;

    // Extract token from share_url (e.g., "/public/share/abc123" -> "abc123")
    const token = shareLink.share_url.split('/').pop() || '';
    const fullUrl = buildShareLinkUrl(token, tenantSubdomain);

    const success = await copyToClipboard(fullUrl);
    if (success) {
      setCopied(true);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error('Failed to copy link');
    }
  };

  const handleClose = () => {
    reset();
    setExpiryDays('7');
    setPassword('');
    setMaxDownloads('');
    setCopied(false);
    onClose();
  };

  const expiryOptions = [
    { value: '1', label: '1 day' },
    { value: '7', label: '7 days' },
    { value: '30', label: '30 days' },
    { value: '90', label: '90 days' },
    { value: '', label: 'Never expires' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Share File" size="lg">
      <ModalContent>
        <div className="space-y-6">
          {/* File Info */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Sharing</p>
            <p className="text-base font-medium text-gray-900 dark:text-gray-100 mt-1">
              {file.original_filename}
            </p>
          </div>

          {/* Share Link Created - Success State */}
          {shareLink ? (
            <div className="space-y-4">
              {/* Success Message */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm font-medium text-green-900 dark:text-green-100">
                  ✓ Share link created successfully!
                </p>
              </div>

              {/* Share URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Share URL
                </label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={buildShareLinkUrl(shareLink.share_url.split('/').pop() || '', tenantSubdomain)}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button onClick={handleCopyLink} variant="secondary">
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Share Details */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Expires</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100 mt-1">
                    {shareLink.expires_at
                      ? new Date(shareLink.expires_at).toLocaleDateString()
                      : 'Never'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Downloads</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100 mt-1">
                    {shareLink.download_count} / {shareLink.max_downloads || '∞'}
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500 dark:text-gray-400">Password Protected</span>
                  <p className="font-medium text-gray-900 dark:text-gray-100 mt-1">
                    {shareLink.has_password ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  Share this link with anyone. {shareLink.has_password && 'They will need the password to access the file.'}
                </p>
              </div>
            </div>
          ) : (
            /* Share Link Configuration - Initial State */
            <div className="space-y-4">
              {/* Expiry */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Link expires in
                </label>
                <Select
                  value={expiryDays}
                  onChange={(value) => setExpiryDays(value)}
                  options={expiryOptions}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password (optional)
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Leave blank for no password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Max Downloads */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Maximum downloads (optional)
                </label>
                <Input
                  type="number"
                  min="1"
                  value={maxDownloads}
                  onChange={(e) => setMaxDownloads(e.target.value)}
                  placeholder="Leave blank for unlimited"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </ModalContent>

      <ModalActions>
        <Button onClick={handleClose} variant="ghost">
          {shareLink ? 'Done' : 'Cancel'}
        </Button>
        {!shareLink && (
          <Button onClick={handleGenerate} variant="primary" disabled={isCreating}>
            {isCreating ? (
              <>
                <LoadingSpinner className="w-4 h-4 mr-2" />
                Generating...
              </>
            ) : (
              'Generate Link'
            )}
          </Button>
        )}
      </ModalActions>
    </Modal>
  );
}
