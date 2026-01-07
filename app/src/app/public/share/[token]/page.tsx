/**
 * Public Share Link Page
 * No authentication required - download file via share token
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Download, Lock, AlertCircle, CheckCircle, FileX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { FileThumbnail } from '@/components/files/FileThumbnail';
import { accessSharedFile, downloadSharedFile, buildFileUrl } from '@/lib/api/files';
import type { AccessSharedFileResponse, File } from '@/lib/types/files';
import { formatFileSize, formatFileDateTime, isShareLinkExpired, isMaxDownloadsReached } from '@/lib/utils/file-helpers';
import toast from 'react-hot-toast';

export default function PublicSharePage() {
  const params = useParams();
  const token = params.token as string;

  const [password, setPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [fileData, setFileData] = useState<AccessSharedFileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load file info on mount
  useEffect(() => {
    loadFileInfo();
  }, [token]);

  const loadFileInfo = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Use /access endpoint to view file info (increments view_count only)
      // Only pass password if it's not empty
      const response = await accessSharedFile(token, password ? password : undefined);
      setFileData(response);
      setShowPasswordInput(false); // Hide password input if successful
    } catch (err: any) {
      // Axios interceptor returns structured error: { status, message, error, data }
      const status = err?.status;
      const message = err?.message;

      console.log('[Share Page] Error loading file:', { status, message, fullError: err });

      // Check for password requirement (401 Unauthorized)
      if (status === 401) {
        // Password required or invalid password - always show password form
        setShowPasswordInput(true);
        setError(null); // Clear error so we show password form
        setIsLoading(false); // Stop loading to show password form
        return;
      }

      // Other errors
      if (status === 404) {
        setError('Share link not found');
      } else if (status === 403) {
        if (message?.toLowerCase().includes('expired')) {
          setError('This link has expired');
        } else if (message?.toLowerCase().includes('max downloads')) {
          setError('Download limit reached');
        } else if (message?.toLowerCase().includes('revoked')) {
          setError('This link has been revoked');
        } else {
          setError(message || 'Access denied');
        }
      } else {
        setError(message || 'Failed to load file');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password) {
      toast.error('Please enter a password');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await accessSharedFile(token, password);
      setFileData(response);
      setShowPasswordInput(false);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message;
      if (message?.toLowerCase().includes('invalid password')) {
        toast.error('Invalid password');
      } else {
        toast.error(message || 'Failed to access file');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);

      // Use /download endpoint (increments download_count)
      const response = await downloadSharedFile(token, password ? password : undefined);

      // Trigger browser download
      if (response.file?.url) {
        const fileUrl = buildFileUrl(response.file.url);

        const link = document.createElement('a');
        link.href = fileUrl;
        link.download = response.file.original_filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      toast.success('Download started');

      // Reload file info to update download count
      setTimeout(() => loadFileInfo(), 1000);
    } catch (err: any) {
      const status = err?.status || err?.response?.status;
      const message = err?.message || err?.response?.data?.message;

      if (status === 403 && message?.toLowerCase().includes('max downloads')) {
        toast.error('Download limit reached');
      } else if (status === 401 && message?.toLowerCase().includes('password')) {
        toast.error('Invalid password');
      } else {
        toast.error(message || 'Failed to download file');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoadingSpinner className="w-12 h-12 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading file...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !showPasswordInput) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileX className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Unable to Access File
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  // Password required
  if (showPasswordInput && !fileData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 text-center">
            Password Protected
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
            This file is password protected. Please enter the password to continue.
          </p>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoFocus
            />

            <Button type="submit" variant="primary" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <LoadingSpinner className="w-4 h-4 mr-2" />
                  Verifying...
                </>
              ) : (
                'Access File'
              )}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // File loaded - show download page
  if (!fileData) return null;

  const { file, share_info } = fileData;

  // Check if link is still valid
  const isExpired = share_info.expires_at && isShareLinkExpired(share_info.expires_at);
  const maxReached = isMaxDownloadsReached(share_info.download_count, share_info.max_downloads);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6">
            <h1 className="text-2xl font-bold text-white mb-2">🔗 Shared File</h1>
            <p className="text-blue-100">You've received a file</p>
          </div>

          {/* File Preview */}
          <div className="p-8">
            <div className="flex justify-center mb-6">
              <FileThumbnail file={file as any} size="lg" />
            </div>

            {/* File Info */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {file.original_filename}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {formatFileSize(file.size_bytes)}
              </p>
            </div>

            {/* Download Status */}
            <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Views</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {share_info.view_count || 0}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Downloads</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {share_info.download_count} / {share_info.max_downloads || '∞'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Expires</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {share_info.expires_at ? formatFileDateTime(share_info.expires_at) : 'Never'}
                </p>
              </div>
            </div>

            {/* Download Button */}
            {isExpired ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 mx-auto mb-2" />
                <p className="text-red-700 dark:text-red-300 font-medium">
                  This link has expired
                </p>
              </div>
            ) : maxReached ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
                <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 mx-auto mb-2" />
                <p className="text-red-700 dark:text-red-300 font-medium">
                  Download limit reached
                </p>
              </div>
            ) : (
              <Button
                onClick={handleDownload}
                variant="primary"
                className="w-full"
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <>
                    <LoadingSpinner className="w-5 h-5 mr-2" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5 mr-2" />
                    Download File
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-500 dark:text-gray-400">
          <p>Powered by Lead360</p>
        </div>
      </div>
    </div>
  );
}
