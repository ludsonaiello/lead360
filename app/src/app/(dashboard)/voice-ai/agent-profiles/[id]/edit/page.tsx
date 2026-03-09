// ============================================================================
// Edit Voice Agent Profile Override
// ============================================================================
// Allow tenant to edit their profile customization
// Sprint 21: Tenant UI
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  voiceAiTenantApi,
  type TenantOverride,
} from '@/lib/api/voice-ai-tenant';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorModal } from '@/components/ui/ErrorModal';
import toast from 'react-hot-toast';

export default function EditOverridePage() {
  const router = useRouter();
  const params = useParams();
  const overrideId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [loadingOverride, setLoadingOverride] = useState(true);
  const [override, setOverride] = useState<TenantOverride | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    custom_greeting: '',
    custom_instructions: '',
    is_active: true,
  });

  useEffect(() => {
    loadOverride();
  }, [overrideId]);

  const loadOverride = async () => {
    try {
      setLoadingOverride(true);
      const data = await voiceAiTenantApi.overrides.get(overrideId);
      setOverride(data);
      setFormData({
        custom_greeting: data.custom_greeting || '',
        custom_instructions: data.custom_instructions || '',
        is_active: data.is_active,
      });
    } catch (error: any) {
      console.error('[EditOverridePage] Failed to load override:', error);
      if (error.response?.status === 404) {
        setErrorMessage('Customization not found. It may have been deleted.');
        setTimeout(() => router.push('/voice-ai/agent-profiles'), 3000);
      } else {
        setErrorMessage('Failed to load customization. Please try again.');
      }
    } finally {
      setLoadingOverride(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await voiceAiTenantApi.overrides.update(overrideId, formData);
      toast.success('Profile customization updated successfully');
      router.push('/voice-ai/agent-profiles');
    } catch (error: any) {
      console.error('[EditOverridePage] Failed to update override:', error);
      setLoading(false);
      setErrorMessage(
        error.response?.data?.message || 'Failed to update customization. Please try again.'
      );
    }
  };

  if (loadingOverride) {
    return (
      <ProtectedRoute requiredPermission="voice_ai:manage">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </ProtectedRoute>
    );
  }

  if (!override) {
    return (
      <ProtectedRoute requiredPermission="voice_ai:manage">
        <div className="max-w-2xl mx-auto">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded border border-yellow-200 dark:border-yellow-800">
            <p className="text-yellow-800 dark:text-yellow-200">
              Customization not found. Redirecting...
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredPermission="voice_ai:manage">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Edit Profile Customization
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Editing: <strong>{override.agent_profile.display_name}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          {/* Show global profile defaults */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Global Profile Defaults
            </h3>
            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
              <div>
                <span className="font-medium">Profile:</span> {override.agent_profile.display_name}
              </div>
              <div>
                <span className="font-medium">Language:</span> {override.agent_profile.language_name}
              </div>
              <div>
                <span className="font-medium">Default Greeting:</span>
                <div className="mt-1">{override.agent_profile.default_greeting || 'None'}</div>
              </div>
              <div>
                <span className="font-medium">Default Instructions:</span>
                <div className="mt-1">{override.agent_profile.default_instructions || 'None'}</div>
              </div>
            </div>
          </div>

          {/* Custom Greeting */}
          <Textarea
            id="custom_greeting"
            label="Custom Greeting (Optional)"
            helperText="Leave empty to use the global default. Use {business_name} as a placeholder."
            value={formData.custom_greeting}
            onChange={(e) =>
              setFormData({ ...formData, custom_greeting: e.target.value })
            }
            placeholder="Welcome to our business! How can we help?"
            rows={3}
          />

          {/* Custom Instructions */}
          <Textarea
            id="custom_instructions"
            label="Custom Instructions (Optional)"
            helperText="Leave empty to use the global default. Provide specific guidance for your business."
            value={formData.custom_instructions}
            onChange={(e) =>
              setFormData({ ...formData, custom_instructions: e.target.value })
            }
            placeholder="Mention our 24/7 emergency service..."
            rows={5}
          />

          {/* Active Toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Active
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>

        {/* Error Modal */}
        {errorMessage && (
          <ErrorModal
            isOpen={!!errorMessage}
            title="Error"
            message={errorMessage}
            onClose={() => setErrorMessage(null)}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
