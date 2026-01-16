/**
 * Edit Subscription Modal Component
 * Modal for editing subscription details (status, billing cycle, dates)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, DollarSign, Check } from 'lucide-react';
import { updateTenantSubscriptionDetails } from '@/lib/api/admin';
import type { TenantDetail, UpdateTenantSubscriptionDetailsDto } from '@/lib/types/admin';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { toast } from 'react-hot-toast';

interface EditSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenant: TenantDetail;
  onSuccess: () => void;
}

export function EditSubscriptionModal({ isOpen, onClose, tenant, onSuccess }: EditSubscriptionModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<UpdateTenantSubscriptionDetailsDto>({
    subscription_status: tenant.subscription_status,
    trial_end_date: tenant.trial_end_date?.split('T')[0] || '',
    billing_cycle: (tenant.billing_cycle as 'monthly' | 'annual') || 'monthly',
    next_billing_date: tenant.next_billing_date?.split('T')[0] || '',
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        subscription_status: tenant.subscription_status,
        trial_end_date: tenant.trial_end_date?.split('T')[0] || '',
        billing_cycle: (tenant.billing_cycle as 'monthly' | 'annual') || 'monthly',
        next_billing_date: tenant.next_billing_date?.split('T')[0] || '',
      });
    }
  }, [isOpen, tenant]);

  const handleSubmit = async () => {
    // Validate based on status
    if (formData.subscription_status === 'trial' && !formData.trial_end_date) {
      toast.error('Trial end date is required for trial status');
      return;
    }

    if (formData.subscription_status === 'active') {
      if (!formData.billing_cycle) {
        toast.error('Billing cycle is required for active status');
        return;
      }
      if (!formData.next_billing_date) {
        toast.error('Next billing date is required for active status');
        return;
      }
    }

    try {
      setLoading(true);

      // Prepare DTO - only include fields relevant to the status
      const dto: UpdateTenantSubscriptionDetailsDto = {
        subscription_status: formData.subscription_status,
      };

      if (formData.subscription_status === 'trial') {
        dto.trial_end_date = formData.trial_end_date;
      } else if (formData.subscription_status === 'active') {
        dto.billing_cycle = formData.billing_cycle;
        dto.next_billing_date = formData.next_billing_date;
      }

      await updateTenantSubscriptionDetails(tenant.id, dto);
      toast.success('Subscription details updated successfully!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to update subscription:', error);
      toast.error(error.response?.data?.message || 'Failed to update subscription details');
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
            <Calendar className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              Edit Subscription Details
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
          {/* Subscription Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Subscription Status *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['trial', 'active', 'cancelled', 'past_due', 'expired'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, subscription_status: status }))}
                  className={`p-3 border-2 rounded-lg transition-all text-left ${
                    formData.subscription_status === status
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                      {status.replace('_', ' ')}
                    </span>
                    {formData.subscription_status === status && (
                      <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Trial Fields */}
          {formData.subscription_status === 'trial' && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Trial Configuration
              </h4>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Trial End Date *
                </label>
                <input
                  type="date"
                  value={formData.trial_end_date || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, trial_end_date: e.target.value }))}
                  min={today}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  When the trial period will end
                </p>
              </div>
            </div>
          )}

          {/* Active Subscription Fields */}
          {formData.subscription_status === 'active' && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-4">
              <h4 className="font-medium text-green-900 dark:text-green-300 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Active Subscription Configuration
              </h4>

              {/* Billing Cycle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Billing Cycle *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['monthly', 'annual'] as const).map((cycle) => (
                    <button
                      key={cycle}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, billing_cycle: cycle }))}
                      className={`p-3 border-2 rounded-lg transition-all ${
                        formData.billing_cycle === cycle
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                          : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                          {cycle}
                        </span>
                        {formData.billing_cycle === cycle && (
                          <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Next Billing Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Next Billing Date *
                </label>
                <input
                  type="date"
                  value={formData.next_billing_date || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, next_billing_date: e.target.value }))}
                  min={today}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  When the tenant will be billed next
                </p>
              </div>
            </div>
          )}
        </div>
      </ModalContent>

      <ModalActions>
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} loading={loading}>
          <Check className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </ModalActions>
    </Modal>
  );
}
