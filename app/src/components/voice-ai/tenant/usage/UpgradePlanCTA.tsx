'use client';

// ============================================================================
// UpgradePlanCTA Component
// ============================================================================
// Call-to-action displayed when quota is exceeded
// ============================================================================

import React from 'react';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

interface UpgradePlanCTAProps {
  overageMinutes: number;
  planMinutesIncluded: number;
}

/**
 * UpgradePlanCTA Component
 * Shows when quota is exceeded and plan blocks calls
 */
export function UpgradePlanCTA({
  overageMinutes,
  planMinutesIncluded,
}: UpgradePlanCTAProps) {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">
            ⚠️ QUOTA EXCEEDED
          </h3>
          <p className="text-sm text-red-800 dark:text-red-200 mb-2">
            You have used {(planMinutesIncluded + overageMinutes).toLocaleString()} minutes of
            your {planMinutesIncluded.toLocaleString()} minute monthly quota.
          </p>
          <p className="text-sm text-red-800 dark:text-red-200 mb-2">
            Overage: {overageMinutes.toLocaleString()} minutes
          </p>
          <p className="text-sm text-red-700 dark:text-red-300 mb-4">
            Your plan blocks calls when quota is exceeded. Upgrade your plan to increase your
            monthly minutes.
          </p>
          <Link
            href="/billing/upgrade"
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Upgrade Plan
          </Link>
        </div>
      </div>
    </div>
  );
}
