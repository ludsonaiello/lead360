/**
 * Plan Upgrade Notice Component
 * Displays when plan doesn't include Voice AI
 */

'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export const PlanUpgradeNotice: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-8 text-center">
        <AlertCircle className="h-12 w-12 text-yellow-600 dark:text-yellow-400 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Voice AI Not Available
        </h3>
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          Your current plan does not include Voice AI. Upgrade to enable intelligent call handling and lead generation.
        </p>
        <Button onClick={() => window.location.href = '/billing'} variant="primary">
          Upgrade Plan
        </Button>
      </div>
    </div>
  );
};

export default PlanUpgradeNotice;
