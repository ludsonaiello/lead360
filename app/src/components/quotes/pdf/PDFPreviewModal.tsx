/**
 * PDF Preview Modal Component
 * Displays generated PDF in a modal with download option
 */

'use client';

import { useState, useEffect } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { PdfResponse } from '@/lib/types/quotes';
import { getPdfUrl, downloadPdfFile, openPdfInNewTab } from '@/lib/api/quote-pdf';

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfResponse: PdfResponse;
}

export function PDFPreviewModal({ isOpen, onClose, pdfResponse }: PDFPreviewModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string>('');

  // Use useEffect to calculate pdfUrl after component mounts and pdfResponse is available
  useEffect(() => {
    if (isOpen && pdfResponse?.download_url) {
      const url = getPdfUrl(pdfResponse);
      console.log('🔄 useEffect - Calculating PDF URL:', {
        download_url: pdfResponse.download_url,
        calculated_url: url,
      });
      setPdfUrl(url);
    } else {
      console.warn('⚠️ useEffect - Missing data:', {
        isOpen,
        hasDownloadUrl: !!pdfResponse?.download_url,
      });
      setPdfUrl('');
    }
  }, [isOpen, pdfResponse]);

  if (!isOpen) return null;

  // Defensive check: Validate pdfResponse has download_url
  if (!pdfResponse?.download_url) {
    console.error('❌ PDFPreviewModal: Invalid pdfResponse', {
      pdfResponse,
      hasDownloadUrl: !!pdfResponse?.download_url,
    });
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md">
          <h2 className="text-lg font-bold text-red-600 dark:text-red-400 mb-4">
            PDF Data Missing
          </h2>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            The PDF data is missing or invalid. Please try generating the PDF again.
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Additional safety check: Verify pdfUrl is valid
  if (!pdfUrl) {
    console.error('❌ PDFPreviewModal: pdfUrl is empty (still loading or failed)', {
      pdfResponse,
      download_url: pdfResponse.download_url,
      pdfUrl,
    });
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md">
          <div className="flex items-center justify-center mb-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-center">
            Loading PDF...
          </p>
        </div>
      </div>
    );
  }

  // Debug logging (helps identify issues)
  console.log('✅ PDFPreviewModal - Rendering iframe with URL:', pdfUrl);

  const handleDownload = () => {
    downloadPdfFile(pdfResponse);
  };

  const handleOpenInNewTab = () => {
    openPdfInNewTab(pdfResponse);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-6xl h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              PDF Preview
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {pdfResponse.filename}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button variant="secondary" size="sm" onClick={handleOpenInNewTab}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in New Tab
            </Button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ml-2"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-900">
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            title="PDF Preview"
            onLoad={(e) => {
              const iframe = e.target as HTMLIFrameElement;
              console.log('📄 Iframe loaded:', {
                src_attribute: iframe.src,
                pdfUrl_variable: pdfUrl,
                contentWindow_location: iframe.contentWindow?.location?.href,
              });
            }}
            onError={(e) => {
              console.error('❌ Iframe error:', e);
            }}
          />
        </div>

        {/* Footer Info */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0">
          <div className="flex items-center justify-between text-sm">
            <div className="text-gray-600 dark:text-gray-400">
              <span className="font-semibold">File Size:</span>{' '}
              {(pdfResponse.file_size / 1024).toFixed(2)} KB
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              <span className="font-semibold">Generated:</span>{' '}
              {new Date(pdfResponse.generated_at).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PDFPreviewModal;
