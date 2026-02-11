'use client';

/**
 * UsageCategoryCard Component
 * Sprint 3: Usage Tracking & Billing
 * Displays a usage category with icon, count, metrics, and cost
 */

import React from 'react';
import { LucideIcon } from 'lucide-react';
import Card from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils/currency-formatter';

interface UsageCategoryCardProps {
  title: string;
  icon: LucideIcon;
  count?: number;
  minutes?: number;
  storage?: string;
  cost?: string;
  iconColor?: string;
  costColor?: string;
}

export default function UsageCategoryCard({
  title,
  icon: Icon,
  count = 0,
  minutes,
  storage,
  cost = '0',
  iconColor = 'text-blue-600 dark:text-blue-400',
  costColor = 'text-blue-600',
}: UsageCategoryCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {count.toLocaleString()}
            </p>
          </div>
        </div>
        {(minutes !== undefined || storage !== undefined) && (
          <div className="text-right">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {minutes !== undefined ? 'Minutes' : 'Storage'}
            </div>
            <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {minutes !== undefined ? minutes.toLocaleString() : storage}
            </div>
          </div>
        )}
      </div>
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-gray-600 dark:text-gray-400">Cost</span>
          <span className={`text-xl font-bold ${costColor}`}>
            {formatCurrency(cost)}
          </span>
        </div>
      </div>
    </Card>
  );
}
