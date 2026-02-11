/**
 * Usage Export Page (Coming Soon)
 * Sprint 3: Usage Tracking & Billing
 * Placeholder for future CSV export functionality
 */

'use client';

import React from 'react';
import { FileDown, CheckCircle, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function UsageExportPage() {
  const router = useRouter();

  const handleBackToDashboard = () => {
    router.push('/admin/communications/twilio/usage');
  };

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <button
        onClick={handleBackToDashboard}
        className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Usage Dashboard
      </button>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        Usage Report Export
      </h1>

      {/* Coming Soon Card */}
      <Card className="p-8 text-center max-w-3xl mx-auto">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full">
            <FileDown className="h-12 w-12 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">
          CSV Export Coming Soon
        </h2>

        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
          Direct CSV export functionality is planned for a future release. In the meantime,
          you can export usage data using the alternative methods below.
        </p>

        {/* Alternative Methods */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 text-left max-w-2xl mx-auto border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">
            Alternative Export Methods:
          </h3>
          <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>Use the browser's "Save Page As" feature on the usage dashboard</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>Copy data from tables and paste into spreadsheet applications</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <span>
                Use the API directly:{' '}
                <code className="bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded text-xs">
                  GET /admin/communication/usage/tenants
                </code>
              </span>
            </li>
          </ul>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Button variant="primary" onClick={handleBackToDashboard}>
            Go to Usage Dashboard
          </Button>
          <Button
            variant="secondary"
            onClick={() => window.open('https://api.lead360.app/api/docs', '_blank')}
          >
            View API Documentation
          </Button>
        </div>
      </Card>

      {/* Future Features Preview */}
      <Card className="p-6 max-w-3xl mx-auto">
        <h3 className="font-semibold mb-3 text-gray-900 dark:text-gray-100">
          Planned Export Features:
        </h3>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-start gap-2">
            <div className="h-2 w-2 bg-blue-600 rounded-full mt-1.5" />
            <span>Export usage data as CSV with customizable date ranges</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="h-2 w-2 bg-blue-600 rounded-full mt-1.5" />
            <span>Export specific tenant usage reports</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="h-2 w-2 bg-blue-600 rounded-full mt-1.5" />
            <span>Schedule automated monthly reports via email</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="h-2 w-2 bg-blue-600 rounded-full mt-1.5" />
            <span>Export data in multiple formats (CSV, Excel, PDF)</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
