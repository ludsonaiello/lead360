'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, Download, Mail, Smartphone, Tablet, Monitor } from 'lucide-react';
import { previewBuilderTemplate, testBuilderTemplatePdf, testBuilderTemplateEmail } from '@/lib/api/template-builder';
import toast from 'react-hot-toast';

interface TemplatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: string;
  templateName: string;
}

export default function TemplatePreviewModal({
  isOpen,
  onClose,
  templateId,
  templateName,
}: TemplatePreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [previewHtml, setPreviewHtml] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    if (isOpen && templateId) {
      loadPreview();
    }
  }, [isOpen, templateId]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      setError(null);

      // Correct payload structure for backend
      const result = await previewBuilderTemplate(templateId, {
        preview_type: 'standard', // Backend generates sample data automatically
        use_real_quote: false,     // Use sample data, not a real quote
      });

      setPreviewHtml(result.rendered_html);
    } catch (err: any) {
      console.error('Failed to load preview:', err);
      setError(err.response?.data?.message || 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setGeneratingPdf(true);
      const result = await testBuilderTemplatePdf(templateId, {
        preview_type: 'standard',
        use_real_quote: false,
      });

      // Open PDF in new tab
      window.open(result.pdf_url, '_blank');
      toast.success('PDF generated successfully!');
    } catch (error) {
      toast.error('Failed to generate PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSendTestEmail = async () => {
    const email = prompt('Enter email address to receive test:');
    if (!email) return;

    try {
      await testBuilderTemplateEmail(templateId, {
        recipient_email: email,
        preview_type: 'standard',
        use_real_quote: false,
      });
      toast.success(`Test email sent to ${email}`);
    } catch (error) {
      toast.error('Failed to send test email');
    }
  };

  if (!isOpen) return null;

  const getFrameWidth = () => {
    switch (viewMode) {
      case 'mobile':
        return '375px';
      case 'tablet':
        return '768px';
      case 'desktop':
      default:
        return '100%';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {templateName}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Live preview with sample data
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('mobile')}
                className={`p-2 rounded transition-all ${
                  viewMode === 'mobile'
                    ? 'bg-white dark:bg-gray-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
                title="Mobile View"
              >
                <Smartphone className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('tablet')}
                className={`p-2 rounded transition-all ${
                  viewMode === 'tablet'
                    ? 'bg-white dark:bg-gray-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
                title="Tablet View"
              >
                <Tablet className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('desktop')}
                className={`p-2 rounded transition-all ${
                  viewMode === 'desktop'
                    ? 'bg-white dark:bg-gray-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
                title="Desktop View"
              >
                <Monitor className="w-4 h-4" />
              </button>
            </div>

            {/* Actions */}
            <button
              onClick={handleDownloadPdf}
              disabled={generatingPdf || loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generatingPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {generatingPdf ? 'Generating...' : 'Download PDF'}
              </span>
            </button>

            <button
              onClick={handleSendTestEmail}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              <span className="hidden sm:inline">Test Email</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-950 p-8">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 font-medium">
                  Generating preview...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Failed to Load Preview
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
                <button
                  onClick={loadPreview}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-start justify-center overflow-auto">
              <div
                className="bg-white shadow-2xl transition-all duration-300 mx-auto"
                style={{
                  width: getFrameWidth(),
                  maxWidth: '100%',
                }}
              >
                <iframe
                  srcDoc={previewHtml}
                  className="w-full border-0"
                  style={{ height: '800px', minHeight: '500px' }}
                  sandbox="allow-same-origin"
                  title="Template Preview"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between text-sm">
            <p className="text-gray-600 dark:text-gray-400">
              Preview uses sample data. Actual quotes will use real customer information.
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
