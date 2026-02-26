'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import Breadcrumb from '@/components/ui/Breadcrumb';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorModal from '@/components/ui/ErrorModal';
import SuccessModal from '@/components/ui/SuccessModal';
import GlobalConfigForm from '@/components/voice-ai/admin/config/GlobalConfigForm';
import voiceAiApi from '@/lib/api/voice-ai';
import type { GlobalConfig, UpdateGlobalConfigRequest } from '@/lib/types/voice-ai';
import { Settings } from 'lucide-react';

/**
 * Global Voice AI Configuration Page (Platform Admin Only)
 * Route: /admin/voice-ai/config
 */
export default function GlobalConfigPage() {
  const router = useRouter();
  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await voiceAiApi.getGlobalConfig();
      setConfig(data);
    } catch (err: any) {
      console.error('Failed to fetch global config:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: UpdateGlobalConfigRequest) => {
    try {
      setSubmitting(true);
      setError(null);

      // Clean data for API submission
      const cleanedData = Object.entries(data).reduce((acc, [key, value]) => {
        // For credential fields (passwords), omit if empty to preserve existing values
        if (key === 'livekit_api_key' || key === 'livekit_api_secret') {
          if (value !== '') {
            acc[key] = value; // Only include if user entered a new value
          }
          // If empty, omit completely (undefined) - backend will ignore
        } else {
          // For other fields, convert empty string to null
          if (value === '') {
            acc[key] = null;
          } else {
            acc[key] = value;
          }
        }
        return acc;
      }, {} as any);

      const updatedConfig = await voiceAiApi.updateGlobalConfig(cleanedData);
      setConfig(updatedConfig);
      setSuccessMessage('Global configuration updated successfully!');
    } catch (err: any) {
      console.error('Failed to update global config:', err);
      const errorMsg =
        err.response?.data?.message ||
        (Array.isArray(err.response?.data?.message)
          ? err.response.data.message.join(', ')
          : err.message || 'Failed to update configuration');
      setError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const breadcrumbItems = [
    { label: 'Admin', href: '/admin/dashboard' },
    { label: 'Voice AI', href: '/admin/voice-ai/providers' },
    { label: 'Global Configuration', href: '/admin/voice-ai/config' },
  ];

  return (
    <ProtectedRoute requiredPermission="platform_admin:view_all_tenants">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <Breadcrumb items={breadcrumbItems} />
          <div className="mt-4 flex items-center gap-3">
            <div className="p-3 bg-brand-100 dark:bg-brand-900/20 rounded-lg">
              <Settings className="h-6 w-6 text-brand-600 dark:text-brand-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Global Voice AI Configuration
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Platform-wide defaults for Voice AI agents
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
          ) : config ? (
            <div className="p-6">
              <GlobalConfigForm
                config={config}
                onSubmit={handleSubmit}
                isSubmitting={submitting}
              />
            </div>
          ) : (
            <div className="p-6 text-center text-gray-600 dark:text-gray-400">
              Failed to load configuration. Please refresh the page.
            </div>
          )}
        </div>
      </div>

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
