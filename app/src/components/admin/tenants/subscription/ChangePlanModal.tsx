/**
 * Change Plan Modal Component
 * Modal for changing a tenant's subscription plan
 */

'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, DollarSign, Check, AlertCircle } from 'lucide-react';
import { updateTenantSubscriptionPlan, getSubscriptionPlans } from '@/lib/api/admin';
import type { TenantDetail, SubscriptionPlan } from '@/lib/types/admin';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { toast } from 'react-hot-toast';

interface ChangePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: TenantDetail;
  currentPlan?: SubscriptionPlan; // Optional - may be undefined when assigning first plan
  onSuccess: () => void;
}

export function ChangePlanModal({ isOpen, onClose, tenant, currentPlan, onSuccess }: ChangePlanModalProps) {
  const [loading, setLoading] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Helper to safely convert price to number
  const toPrice = (price: number | string): number => {
    return typeof price === 'string' ? parseFloat(price) : price;
  };

  useEffect(() => {
    if (isOpen) {
      loadPlans();
      setSelectedPlanId(''); // Reset selection when modal opens
    }
  }, [isOpen]);

  const loadPlans = async () => {
    try {
      setLoadingPlans(true);
      const response = await getSubscriptionPlans();
      // Filter out current plan (if exists) and only show active plans
      const plans = (response.plans || []).filter(
        (p) => p.is_active && (!currentPlan || p.id !== currentPlan.id)
      );
      setAvailablePlans(plans);
    } catch (error) {
      console.error('Failed to load plans:', error);
      toast.error('Failed to load subscription plans');
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedPlanId) {
      toast.error('Please select a plan');
      return;
    }

    try {
      setLoading(true);
      await updateTenantSubscriptionPlan(tenant.id, selectedPlanId);
      toast.success(currentPlan ? 'Subscription plan changed successfully!' : 'Subscription plan assigned successfully!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to change plan:', error);
      toast.error(error.response?.data?.message || `Failed to ${currentPlan ? 'change' : 'assign'} subscription plan`);
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = availablePlans.find((p) => p.id === selectedPlanId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {currentPlan ? 'Change Subscription Plan' : 'Assign Subscription Plan'}
            </div>
            <div className="text-sm font-normal text-gray-600 dark:text-gray-400">
              {tenant.company_name}
            </div>
          </div>
        </div>
      }
      size="xl"
    >
      <ModalContent>
        <div className="space-y-4">
          {/* Current Plan - only show if tenant has a plan */}
          {currentPlan && (
            <div className="p-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Plan</span>
                <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                  Active
                </span>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{currentPlan.name}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                <span>${toPrice(currentPlan.monthly_price).toFixed(2)}/mo</span>
                <span>•</span>
                <span>${toPrice(currentPlan.annual_price).toFixed(2)}/yr</span>
              </div>
            </div>
          )}

          {/* New Plan Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {currentPlan ? 'Select New Plan *' : 'Select Plan *'}
            </label>
            {loadingPlans ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : availablePlans.length === 0 ? (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-300">
                  <AlertCircle className="w-5 h-5" />
                  <p className="text-sm">No other active plans available</p>
                </div>
              </div>
            ) : (
              <Select
                options={availablePlans.map((plan) => ({
                  value: plan.id,
                  label: `${plan.name} - $${toPrice(plan.monthly_price).toFixed(2)}/mo or $${toPrice(plan.annual_price).toFixed(2)}/yr`,
                }))}
                value={selectedPlanId}
                onChange={setSelectedPlanId}
                placeholder="Choose a plan..."
              />
            )}
          </div>

          {/* Plan Comparison */}
          {selectedPlan && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
              <h4 className="font-medium text-blue-900 dark:text-blue-300">
                {currentPlan ? 'New Plan: ' : 'Selected Plan: '}{selectedPlan.name}
              </h4>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-1">Monthly Price</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    ${toPrice(selectedPlan.monthly_price).toFixed(2)}/mo
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-1">Annual Price</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    ${toPrice(selectedPlan.annual_price).toFixed(2)}/yr
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-1">Max Users</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {selectedPlan.max_users || 'Unlimited'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400 mb-1">Max Storage</p>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {toPrice(selectedPlan.max_storage_gb || 0) > 0 ? `${toPrice(selectedPlan.max_storage_gb || 0)} GB` : 'Unlimited'}
                  </p>
                </div>
              </div>

              {selectedPlan.description && (
                <p className="text-sm text-gray-700 dark:text-gray-300 pt-2 border-t border-blue-200 dark:border-blue-700">
                  {selectedPlan.description}
                </p>
              )}
            </div>
          )}
        </div>
      </ModalContent>

      <ModalActions>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={loading} disabled={!selectedPlanId || loadingPlans}>
          <Check className="w-4 h-4 mr-2" />
          {currentPlan ? 'Change Plan' : 'Assign Plan'}
        </Button>
      </ModalActions>
    </Modal>
  );
}
