'use client';

// ============================================================================
// UsageKPICards Component
// ============================================================================
// KPI summary cards showing total calls, minutes used, remaining, and cost
// ============================================================================

import React from 'react';
import { Phone, Clock, Hourglass, DollarSign } from 'lucide-react';

interface UsageKPICardsProps {
  totalCalls: number;
  minutesUsed: number;
  minutesRemaining: number;
  estimatedCost: number;
}

/**
 * KPI Card Component
 */
interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  iconBgColor: string;
  iconColor: string;
}

function KPICard({ icon, label, value, iconBgColor, iconColor }: KPICardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <div className="flex items-start gap-4">
        <div className={`p-3 ${iconBgColor} rounded-lg flex-shrink-0`}>
          <div className={iconColor}>{icon}</div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            {label}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * UsageKPICards Component
 */
export function UsageKPICards({
  totalCalls,
  minutesUsed,
  minutesRemaining,
  estimatedCost,
}: UsageKPICardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Calls */}
      <KPICard
        icon={<Phone className="h-6 w-6" />}
        label="Total Calls"
        value={totalCalls.toLocaleString()}
        iconBgColor="bg-blue-100 dark:bg-blue-900/20"
        iconColor="text-blue-600 dark:text-blue-400"
      />

      {/* Minutes Used */}
      <KPICard
        icon={<Clock className="h-6 w-6" />}
        label="Minutes Used"
        value={minutesUsed.toLocaleString()}
        iconBgColor="bg-purple-100 dark:bg-purple-900/20"
        iconColor="text-purple-600 dark:text-purple-400"
      />

      {/* Minutes Remaining */}
      <KPICard
        icon={<Hourglass className="h-6 w-6" />}
        label="Minutes Remaining"
        value={minutesRemaining.toLocaleString()}
        iconBgColor="bg-green-100 dark:bg-green-900/20"
        iconColor="text-green-600 dark:text-green-400"
      />

      {/* Estimated Cost */}
      <KPICard
        icon={<DollarSign className="h-6 w-6" />}
        label="Estimated Cost"
        value={`$${estimatedCost.toFixed(2)}`}
        iconBgColor="bg-orange-100 dark:bg-orange-900/20"
        iconColor="text-orange-600 dark:text-orange-400"
      />
    </div>
  );
}
