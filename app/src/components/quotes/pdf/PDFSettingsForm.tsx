/**
 * PDF Settings Form Component
 * Options for PDF generation (cost breakdown toggle)
 */

'use client';

import React from 'react';
import { DollarSign, AlertTriangle, RefreshCw } from 'lucide-react';

interface PDFSettingsFormProps {
  includeCostBreakdown: boolean;
  onToggleCostBreakdown: (include: boolean) => void;
  forceRegenerate?: boolean;
  onToggleForceRegenerate?: (force: boolean) => void;
  disabled?: boolean;
}

export function PDFSettingsForm({
  includeCostBreakdown,
  onToggleCostBreakdown,
  forceRegenerate = false,
  onToggleForceRegenerate,
  disabled = false,
}: PDFSettingsFormProps) {
  return (
    <div className="space-y-4">
      {/* Cost Breakdown Toggle */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h4 className="font-semibold text-gray-900 dark:text-white">
                Include Cost Breakdown
              </h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Show detailed cost information including materials, labor, equipment,
              subcontract, and overhead/profit calculations.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={includeCostBreakdown}
              onChange={(e) => onToggleCostBreakdown(e.target.checked)}
              disabled={disabled}
              className="sr-only peer"
            />
            <div
              className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"
            ></div>
          </label>
        </div>
      </div>

      {/* Force Regenerate Toggle (Advanced Option) */}
      {onToggleForceRegenerate && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h4 className="font-semibold text-gray-900 dark:text-white">
                  Force Regenerate
                </h4>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Bypass cache and regenerate PDF even if no changes detected. Use this
                if the cached PDF appears outdated.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={forceRegenerate}
                onChange={(e) => onToggleForceRegenerate(e.target.checked)}
                disabled={disabled}
                className="sr-only peer"
              />
              <div
                className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"
              ></div>
            </label>
          </div>
        </div>
      )}

      {/* Warning for Internal Use */}
      {includeCostBreakdown && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-orange-800 dark:text-orange-200">
              <p className="font-semibold mb-1">Internal Use Only</p>
              <p>
                Cost breakdown PDFs are for internal review and should NOT be shared
                with customers. They contain sensitive pricing information including
                profit margins and markup percentages.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
          PDF Contents
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <li>• Company branding and logo</li>
          <li>• Quote details and line items</li>
          <li>• Photo attachments and QR codes</li>
          <li>• Terms and conditions</li>
          <li>• Payment instructions</li>
          {includeCostBreakdown && (
            <li className="font-semibold">• Detailed cost breakdown (internal)</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default PDFSettingsForm;
