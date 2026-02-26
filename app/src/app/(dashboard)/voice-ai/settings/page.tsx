/**
 * Voice AI Tenant Settings Page
 * Route: /(dashboard)/voice-ai/settings
 * Permission: Owner, Admin, Manager (view); Owner, Admin (edit)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { Settings, AlertCircle } from 'lucide-react';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import Breadcrumb from '@/components/ui/Breadcrumb';
import { Button } from '@/components/ui/Button';
import { VoiceAISettingsForm } from '@/components/voice-ai/tenant/settings/VoiceAISettingsForm';
import { BusinessHoursSummary } from '@/components/voice-ai/tenant/settings/BusinessHoursSummary';
import { IndustriesSummary } from '@/components/voice-ai/tenant/settings/IndustriesSummary';
import { ServicesSummary } from '@/components/voice-ai/tenant/settings/ServicesSummary';

export default function VoiceAISettingsPage() {
  const { user } = useAuth();
  const router = useRouter();

  // View: Owner, Admin, Manager
  // Edit: Owner, Admin only

  const canEdit = user?.roles?.includes('Owner') || user?.roles?.includes('Admin');

  // Setup banner state - always show for users with edit permissions
  const [showSetupBanner, setShowSetupBanner] = useState(false);

  // Check setup status on mount - always show banner, only hide if manually dismissed
  useEffect(() => {
    const bannerDismissed = localStorage.getItem('voice_ai_setup_banner_dismissed');
    setShowSetupBanner(!bannerDismissed && Boolean(canEdit));
  }, [canEdit]);

  const breadcrumbItems = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Voice AI Settings', href: '/voice-ai/settings' },
  ];

  return (
    <ProtectedRoute requiredRole={['Owner', 'Admin', 'Manager']}>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div>
          <Breadcrumb items={breadcrumbItems} />
          <div className="mt-4 flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Settings className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Voice AI Settings
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Configure Voice AI agent behavior for your business
              </p>
            </div>
          </div>
        </div>

        {/* Read-only notice for Managers */}
        {!canEdit && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <span className="font-semibold">View-Only Mode:</span> You have read-only access to these settings.
              Contact an Owner or Admin to make changes.
            </p>
          </div>
        )}

        {/* Setup Banner */}
        {showSetupBanner && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  Complete Voice AI Setup
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
                  Configure essential information to help the Voice AI agent provide the best experience for your callers.
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => router.push('/voice-ai/setup-wizard')}
                  >
                    Start Setup Wizard
                  </Button>
                  <button
                    onClick={() => {
                      localStorage.setItem('voice_ai_setup_banner_dismissed', 'true');
                      setShowSetupBanner(false);
                    }}
                    className="text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline"
                  >
                    Hide
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Show Setup Helper Link (when banner is hidden) */}
        {!showSetupBanner && canEdit && (
          <div className="mb-4">
            <button
              onClick={() => {
                localStorage.removeItem('voice_ai_setup_banner_dismissed');
                setShowSetupBanner(true);
              }}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              Show setup helper →
            </button>
          </div>
        )}

        {/* Agent Context Information Section */}
        <div className="mb-8">
          {/* Section Header */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Agent Context Information
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              The Voice AI agent uses this information to provide accurate, helpful responses to callers.
              Keep this information up-to-date to ensure the best caller experience.
            </p>
          </div>

          {/* 2-Column Grid for Context Components */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <BusinessHoursSummary />
            <IndustriesSummary />
            <ServicesSummary />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-700 my-8"></div>

        {/* Voice AI Behavior Settings Section Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Voice AI Behavior Settings
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Configure how your Voice AI agent behaves during calls
          </p>
        </div>

        {/* Settings Form */}
        <VoiceAISettingsForm readOnly={!canEdit} />
      </div>
    </ProtectedRoute>
  );
}
