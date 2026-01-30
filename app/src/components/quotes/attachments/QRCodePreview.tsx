/**
 * QR Code Preview Component
 * Displays QR code with click-to-enlarge functionality
 * Used for URL attachments
 */

'use client';

import React, { useState } from 'react';
import { X, Download, ExternalLink, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Image from 'next/image';

interface QRCodePreviewProps {
  qrCodeUrl: string;
  targetUrl: string;
  title?: string;
  size?: 'small' | 'medium' | 'large';
  showActions?: boolean;
  className?: string;
}

export function QRCodePreview({
  qrCodeUrl,
  targetUrl,
  title,
  size = 'small',
  showActions = true,
  className = '',
}: QRCodePreviewProps) {
  const [showEnlarged, setShowEnlarged] = useState(false);

  const sizeClasses = {
    small: 'w-16 h-16',
    medium: 'w-32 h-32',
    large: 'w-64 h-64',
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `qr-code-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      // Toast notification would go here
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  return (
    <>
      {/* Thumbnail */}
      <div className={`flex flex-col gap-2 ${className}`}>
        <button
          onClick={() => setShowEnlarged(true)}
          className={`${sizeClasses[size]} relative rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden hover:border-blue-500 dark:hover:border-blue-400 transition-colors cursor-pointer group`}
          title="Click to enlarge"
        >
          <Image
            src={qrCodeUrl}
            alt={title || 'QR Code'}
            fill
            className="object-contain p-1"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-colors flex items-center justify-center">
            <QrCode className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>

        {showActions && (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              className="flex-1"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.open(targetUrl, '_blank')}
              className="flex-1"
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Enlarged Modal */}
      {showEnlarged && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowEnlarged(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  QR Code
                </h3>
                {title && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {title}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowEnlarged(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* QR Code Image */}
            <div className="bg-white rounded-lg p-8 mb-4 flex items-center justify-center">
              <div className="relative w-96 h-96">
                <Image
                  src={qrCodeUrl}
                  alt={title || 'QR Code'}
                  fill
                  className="object-contain"
                />
              </div>
            </div>

            {/* URL Display */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">
                Target URL
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm text-gray-900 dark:text-white break-all">
                  {targetUrl}
                </code>
                <Button variant="secondary" size="sm" onClick={handleCopyUrl}>
                  Copy
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="primary"
                onClick={handleDownload}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Download QR Code
              </Button>
              <Button
                variant="secondary"
                onClick={() => window.open(targetUrl, '_blank')}
                className="flex-1"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open URL
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default QRCodePreview;
