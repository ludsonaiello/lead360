// ============================================================================
// Plans List Component
// ============================================================================
// Displays all subscription plans with their Voice AI configuration in a table
// ============================================================================

'use client';

import React from 'react';
import type { SubscriptionPlan } from '@/lib/types/voice-ai';
import { Button } from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Settings, CheckCircle, XCircle, DollarSign, Clock } from 'lucide-react';

interface PlansListProps {
  plans: SubscriptionPlan[];
  onEditPlan: (plan: SubscriptionPlan) => void;
}

export default function PlansList({ plans, onEditPlan }: PlansListProps) {
  /**
   * Format overage rate display
   * - null = "Block"
   * - number = "$X.XX/min"
   */
  const formatOverageRate = (rate: string | null): string => {
    if (rate === null) {
      return 'Block';
    }
    const numRate = parseFloat(rate);
    return `$${numRate.toFixed(2)}/min`;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Plan Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Monthly Price
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Voice AI Enabled
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Minutes Included
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Overage Rate
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {plans.map((plan) => (
            <tr
              key={plan.id}
              className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              {/* Plan Name */}
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex flex-col">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {plan.name}
                  </div>
                  {plan.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {plan.description}
                    </div>
                  )}
                  {!plan.is_active && (
                    <Badge variant="danger" size="sm" className="mt-1 w-fit">
                      Inactive
                    </Badge>
                  )}
                </div>
              </td>

              {/* Monthly Price */}
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-1 text-sm text-gray-900 dark:text-gray-100">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  {parseFloat(plan.monthly_price).toFixed(2)}
                </div>
              </td>

              {/* Voice AI Enabled */}
              <td className="px-6 py-4 whitespace-nowrap">
                {plan.voice_ai_enabled ? (
                  <Badge variant="success" size="sm">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="secondary" size="sm">
                    <XCircle className="h-3 w-3 mr-1" />
                    Disabled
                  </Badge>
                )}
              </td>

              {/* Minutes Included */}
              <td className="px-6 py-4 whitespace-nowrap">
                {plan.voice_ai_enabled ? (
                  <div className="flex items-center gap-1 text-sm text-gray-900 dark:text-gray-100">
                    <Clock className="h-4 w-4 text-gray-400" />
                    {plan.voice_ai_minutes_included} min
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                )}
              </td>

              {/* Overage Rate */}
              <td className="px-6 py-4 whitespace-nowrap">
                {plan.voice_ai_enabled ? (
                  <div className="text-sm text-gray-900 dark:text-gray-100">
                    {formatOverageRate(plan.voice_ai_overage_rate)}
                  </div>
                ) : (
                  <span className="text-sm text-gray-400 dark:text-gray-500">—</span>
                )}
              </td>

              {/* Actions */}
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditPlan(plan)}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Edit Voice AI
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
