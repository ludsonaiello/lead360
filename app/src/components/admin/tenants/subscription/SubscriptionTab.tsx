/**
 * Subscription Tab Component
 * Main tab content for tenant subscription management
 */

'use client';

import React, { useState } from 'react';
import { Edit2, RefreshCw, AlertCircle } from 'lucide-react';
import type { TenantDetail, SubscriptionPlan } from '@/lib/types/admin';
import { CurrentPlanCard } from './CurrentPlanCard';
import { BillingInfoCard } from './BillingInfoCard';
import { ChangePlanModal } from './ChangePlanModal';
import { EditSubscriptionModal } from './EditSubscriptionModal';
import { SubscriptionHistory } from './SubscriptionHistory';
import { Button } from '@/components/ui/Button';

interface SubscriptionTabProps {
  tenant: TenantDetail;
  onRefresh: () => void;
}

export function SubscriptionTab({ tenant, onRefresh }: SubscriptionTabProps) {
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [showEditSubscriptionModal, setShowEditSubscriptionModal] = useState(false);

  // Check if tenant has a subscription plan
  const hasSubscriptionPlan = tenant.subscription_plan && tenant.subscription_plan_id;

  if (!hasSubscriptionPlan) {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-lg font-medium text-yellow-900 dark:text-yellow-200 mb-2">
                  No Subscription Plan Assigned
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  This tenant does not have a subscription plan assigned. Please assign a plan to manage their subscription.
                </p>
              </div>
            </div>
            <Button onClick={() => setShowChangePlanModal(true)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Assign Plan
            </Button>
          </div>
        </div>

        {/* Still show billing info even if no plan */}
        <BillingInfoCard tenant={tenant} />

        {/* Show subscription history */}
        <SubscriptionHistory tenantId={tenant.id} />

        {/* Assign Plan Modal */}
        <ChangePlanModal
          isOpen={showChangePlanModal}
          onClose={() => setShowChangePlanModal(false)}
          tenant={tenant}
          currentPlan={undefined}
          onSuccess={onRefresh}
        />
      </div>
    );
  }

  const currentPlan = tenant.subscription_plan as SubscriptionPlan;

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="secondary"
          onClick={() => setShowEditSubscriptionModal(true)}
        >
          <Edit2 className="w-4 h-4 mr-2" />
          Edit Subscription
        </Button>
        <Button onClick={() => setShowChangePlanModal(true)}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Change Plan
        </Button>
      </div>

      {/* Current Plan Details */}
      <CurrentPlanCard plan={currentPlan} />

      {/* Billing Information */}
      <BillingInfoCard tenant={tenant} />

      {/* Subscription History */}
      <SubscriptionHistory tenantId={tenant.id} />

      {/* Modals */}
      <ChangePlanModal
        isOpen={showChangePlanModal}
        onClose={() => setShowChangePlanModal(false)}
        tenant={tenant}
        currentPlan={currentPlan}
        onSuccess={onRefresh}
      />

      <EditSubscriptionModal
        isOpen={showEditSubscriptionModal}
        onClose={() => setShowEditSubscriptionModal(false)}
        tenant={tenant}
        onSuccess={onRefresh}
      />
    </div>
  );
}
