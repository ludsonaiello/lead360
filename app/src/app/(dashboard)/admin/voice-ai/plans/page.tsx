'use client';

import React, { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import Breadcrumb from '@/components/ui/Breadcrumb';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorModal from '@/components/ui/ErrorModal';
import SuccessModal from '@/components/ui/SuccessModal';
import PlansList from '@/components/voice-ai/admin/plans/PlansList';
import PlanVoiceConfigModal from '@/components/voice-ai/admin/plans/PlanVoiceConfigModal';
import voiceAiApi from '@/lib/api/voice-ai';
import type { SubscriptionPlan } from '@/lib/types/voice-ai';
import { Receipt } from 'lucide-react';

/**
 * Voice AI Plan Configuration Page (Platform Admin Only)
 * Route: /admin/voice-ai/plans
 */
export default function VoiceAiPlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await voiceAiApi.getAllPlans();
      setPlans(data);
    } catch (err: any) {
      console.error('Failed to fetch plans:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedPlan(null);
  };

  const handleSuccess = (message: string) => {
    setSuccessMessage(message);
    setModalOpen(false);
    setSelectedPlan(null);
    fetchPlans(); // Refresh the list
  };

  const breadcrumbItems = [
    { label: 'Admin', href: '/admin/dashboard' },
    { label: 'Voice AI', href: '/admin/voice-ai/providers' },
    { label: 'Plan Configuration', href: '/admin/voice-ai/plans' },
  ];

  return (
    <ProtectedRoute requiredPermission="platform_admin:view_all_tenants">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Breadcrumb items={breadcrumbItems} />
          <div className="mt-4 flex items-center gap-3">
            <div className="p-3 bg-brand-100 dark:bg-brand-900/20 rounded-lg">
              <Receipt className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Voice AI Plan Configuration
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Configure Voice AI settings for subscription plans
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : plans.length > 0 ? (
            <PlansList plans={plans} onEditPlan={handleEditPlan} />
          ) : (
            <div className="p-6 text-center text-gray-600 dark:text-gray-400">
              No subscription plans found.
            </div>
          )}
        </div>
      </div>

      {/* Edit Voice Config Modal */}
      {selectedPlan && (
        <PlanVoiceConfigModal
          plan={selectedPlan}
          isOpen={modalOpen}
          onClose={handleCloseModal}
          onSuccess={handleSuccess}
          onError={setError}
        />
      )}

      {/* Error Modal */}
      {error && (
        <ErrorModal
          isOpen={!!error}
          onClose={() => setError(null)}
          title="Error"
          message={error}
        />
      )}

      {/* Success Modal */}
      {successMessage && (
        <SuccessModal
          isOpen={!!successMessage}
          onClose={() => setSuccessMessage(null)}
          title="Success"
          message={successMessage}
        />
      )}
    </ProtectedRoute>
  );
}
