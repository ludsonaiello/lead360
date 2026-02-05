'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, Code } from 'lucide-react';
import { previewComponent } from '@/lib/api/template-builder';
import toast from 'react-hot-toast';

interface ComponentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  componentId: string;
  componentName: string;
}

export default function ComponentPreviewModal({
  isOpen,
  onClose,
  componentId,
  componentName,
}: ComponentPreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [previewHtml, setPreviewHtml] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (isOpen && componentId) {
      loadPreview();
    }
  }, [isOpen, componentId]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      setError(null);

      // Simple sample data - backend will handle component-specific rendering
      const sampleData = {
        company_name: 'Acme Corporation',
        customer_name: 'John Smith',
        quote_number: 'Q-2024-001',
        date: new Date().toISOString().split('T')[0],
        company_logo: 'https://via.placeholder.com/150x50',
        company_address: '123 Business St, City, ST 12345',
        company_phone: '(555) 123-4567',
        company_email: 'info@acme.com',
        customer_email: 'john.smith@example.com',
        customer_phone: '(555) 987-6543',
        customer_address: '456 Customer Ave, City, ST 12345',
        subtotal: 1499.96,
        tax: 119.99,
        discount: -50.0,
        total: 1569.95,
        items: [
          {
            name: 'Premium Service Package',
            description: 'Complete service with all features',
            quantity: 2,
            unit_price: 499.99,
            total: 999.98,
          },
        ],
      };

      const result = await previewComponent(componentId, {
        props: {},
        sample_data: sampleData,
      });

      setPreviewHtml(result.rendered_html);
    } catch (err: any) {
      console.error('Failed to load component preview:', err);
      setError(err.response?.data?.message || 'Failed to load preview');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          margin: 0;
          padding: 20px;
          background: #f9fafb;
        }
      </style>
    </head>
    <body>
      ${previewHtml}
    </body>
    </html>
  `;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {componentName}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Component preview with sample data
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCode(!showCode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                showCode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Code className="w-4 h-4" />
              <span>{showCode ? 'Hide Code' : 'Show Code'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden bg-gray-100 dark:bg-gray-950 p-6">
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
            <div className="h-full overflow-auto">
              {showCode ? (
                /* Code View */
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 px-4 py-2 bg-white dark:bg-gray-900 rounded-t-lg border-b border-gray-200 dark:border-gray-800">
                    Component HTML
                  </h3>
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-b-lg overflow-x-auto text-xs">
                    <code>{previewHtml}</code>
                  </pre>
                </div>
              ) : (
                /* Visual Preview */
                <div className="bg-white shadow-lg rounded-lg overflow-hidden">
                  <iframe
                    srcDoc={fullHtml}
                    className="w-full border-0"
                    style={{ height: '500px', minHeight: '400px' }}
                    sandbox="allow-same-origin"
                    title="Component Preview"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between text-sm">
            <p className="text-gray-600 dark:text-gray-400">
              Preview uses sample data. Actual templates will use real quote information.
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
