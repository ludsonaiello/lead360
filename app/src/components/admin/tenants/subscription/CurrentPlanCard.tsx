/**
 * Current Plan Card Component
 * Displays the tenant's current subscription plan details
 */

'use client';

import React from 'react';
import { CreditCard, DollarSign, Users, HardDrive, Check, X } from 'lucide-react';
import type { SubscriptionPlan } from '@/lib/types/admin';
import Card from '@/components/ui/Card';

interface CurrentPlanCardProps {
  plan: SubscriptionPlan;
}

export function CurrentPlanCard({ plan }: CurrentPlanCardProps) {
  // Ensure prices are numbers (API may return strings)
  const monthlyPrice = typeof plan.monthly_price === 'string'
    ? parseFloat(plan.monthly_price)
    : plan.monthly_price;
  const annualPrice = typeof plan.annual_price === 'string'
    ? parseFloat(plan.annual_price)
    : plan.annual_price;
  const maxStorageGB = typeof plan.max_storage_gb === 'string'
    ? parseFloat(plan.max_storage_gb)
    : plan.max_storage_gb;

  // Parse feature flags if they come as a string
  const featureFlags = typeof plan.feature_flags === 'string'
    ? JSON.parse(plan.feature_flags)
    : plan.feature_flags;

  // Calculate annual savings
  const annualTotal = monthlyPrice * 12;
  const annualSavings = annualTotal - annualPrice;
  const savingsPercentage = (annualSavings / annualTotal) * 100;

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
          <CreditCard className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{plan.name}</h2>
          {plan.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400">{plan.description}</p>
          )}
        </div>
      </div>

      {/* Pricing Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Monthly Price</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            ${monthlyPrice.toFixed(2)}
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/month</span>
          </p>
        </div>

        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-green-50 dark:bg-green-900/10">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Annual Price</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            ${annualPrice.toFixed(2)}
            <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/year</span>
          </p>
          {annualSavings > 0 && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Save ${annualSavings.toFixed(2)} ({savingsPercentage.toFixed(0)}% discount)
            </p>
          )}
        </div>
      </div>

      {/* Limits Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Max Users</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {plan.max_users ? plan.max_users.toLocaleString() : 'Unlimited'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
            <HardDrive className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Max Storage</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {maxStorageGB ? `${maxStorageGB} GB` : 'Unlimited'}
            </p>
          </div>
        </div>
      </div>

      {/* Feature Flags Section */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Included Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {Object.entries(featureFlags || {}).map(([key, enabled]) => (
            <div
              key={key}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                enabled
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              }`}
            >
              {enabled ? (
                <Check className="w-4 h-4 flex-shrink-0" />
              ) : (
                <X className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="capitalize">
                {key.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
