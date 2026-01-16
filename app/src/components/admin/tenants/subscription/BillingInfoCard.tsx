/**
 * Billing Info Card Component
 * Displays billing information and subscription status
 */

'use client';

import React from 'react';
import { Calendar, Clock, DollarSign, AlertCircle } from 'lucide-react';
import type { TenantDetail } from '@/lib/types/admin';
import Card from '@/components/ui/Card';

interface BillingInfoCardProps {
  tenant: TenantDetail;
}

export function BillingInfoCard({ tenant }: BillingInfoCardProps) {
  // Calculate days until next event
  const getDaysUntil = (dateString: string | null) => {
    if (!dateString) return null;
    const targetDate = new Date(dateString);
    const today = new Date();
    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const trialDaysRemaining = getDaysUntil(tenant.trial_end_date ?? null);
  const daysUntilBilling = getDaysUntil(tenant.next_billing_date ?? null);

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'trial':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'past_due':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'expired':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Billing Information</h2>

      <div className="space-y-4">
        {/* Subscription Status */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</span>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(tenant.subscription_status ?? 'active')}`}>
            {(tenant.subscription_status ?? 'active').charAt(0).toUpperCase() + (tenant.subscription_status ?? 'active').slice(1).replace('_', ' ')}
          </span>
        </div>

        {/* Trial Information */}
        {tenant.subscription_status === 'trial' && tenant.trial_end_date && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
            <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300">
              <Clock className="w-5 h-5" />
              <span className="font-medium">Trial Period</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700 dark:text-gray-300">Trial End Date</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {new Date(tenant.trial_end_date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>

            {trialDaysRemaining !== null && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Days Remaining</span>
                <span className={`text-sm font-bold ${
                  trialDaysRemaining < 7
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-blue-600 dark:text-blue-400'
                }`}>
                  {trialDaysRemaining > 0 ? `${trialDaysRemaining} days` : 'Expired'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Active Subscription Information */}
        {tenant.subscription_status === 'active' && (
          <div className="space-y-3">
            {/* Billing Cycle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Billing Cycle</span>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                {tenant.billing_cycle || 'Monthly'}
              </span>
            </div>

            {/* Next Billing Date */}
            {tenant.next_billing_date && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-green-900 dark:text-green-300">
                  <DollarSign className="w-5 h-5" />
                  <span className="font-medium">Next Billing</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Billing Date</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {new Date(tenant.next_billing_date).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>

                {daysUntilBilling !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">Days Until Billing</span>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">
                      {daysUntilBilling > 0 ? `${daysUntilBilling} days` : 'Due today'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Cancelled/Expired Information */}
        {(tenant.subscription_status === 'cancelled' || tenant.subscription_status === 'expired') && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2 text-red-900 dark:text-red-300 mb-2">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">
                {tenant.subscription_status === 'cancelled' ? 'Subscription Cancelled' : 'Subscription Expired'}
              </span>
            </div>
            <p className="text-sm text-red-700 dark:text-red-300">
              This tenant's subscription is no longer active. Please update their subscription status or plan.
            </p>
          </div>
        )}

        {/* Past Due Information */}
        {tenant.subscription_status === 'past_due' && (
          <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <div className="flex items-center gap-2 text-orange-900 dark:text-orange-300 mb-2">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Payment Past Due</span>
            </div>
            <p className="text-sm text-orange-700 dark:text-orange-300">
              This tenant has a past due payment. Please follow up or update their subscription status.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
