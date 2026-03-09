// ============================================================================
// Create Voice Agent Profile Override
// ============================================================================
// Allow tenant to select a global profile and customize it
// Sprint 21: Tenant UI
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  voiceAiTenantApi,
  type AvailableGlobalProfile,
} from '@/lib/api/voice-ai-tenant';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorModal } from '@/components/ui/ErrorModal';
import toast from 'react-hot-toast';

export default function CreateOverridePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profileId = searchParams.get('profile');

  const [loading, setLoading] = useState(false);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<AvailableGlobalProfile | null>(null);
  const [availableProfiles, setAvailableProfiles] = useState<AvailableGlobalProfile[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    agent_profile_id: profileId || '',
    custom_greeting: '',
    custom_instructions: '',
    is_active: true,
  });

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    if (formData.agent_profile_id && availableProfiles.length > 0) {
      const profile = availableProfiles.find((p) => p.id === formData.agent_profile_id);
      setSelectedProfile(profile || null);
    }
  }, [formData.agent_profile_id, availableProfiles]);

  const loadProfiles = async () => {
    try {
      setLoadingProfiles(true);
      const profiles = await voiceAiTenantApi.availableProfiles.list(true);
      setAvailableProfiles(profiles);
    } catch (error: any) {
      console.error('[CreateOverridePage] Failed to load profiles:', error);
      setErrorMessage('Failed to load available profiles. Please try again.');
    } finally {
      setLoadingProfiles(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.agent_profile_id) {
      setErrorMessage('Please select a profile');
      return;
    }

    setLoading(true);

    try {
      await voiceAiTenantApi.overrides.create(formData);
      toast.success('Profile customization created successfully');
      router.push('/voice-ai/agent-profiles');
    } catch (error: any) {
      console.error('[CreateOverridePage] Failed to create override:', error);
      setLoading(false);

      if (error.response?.status === 409) {
        setErrorMessage(
          error.response.data.message ||
          'You already have a customization for this profile. Edit the existing one instead.'
        );
      } else if (error.response?.status === 403) {
        setErrorMessage(
          error.response.data.message ||
          'Plan limit reached. Upgrade your plan or deactivate an existing profile.'
        );
      } else {
        setErrorMessage(
          error.response?.data?.message || 'Failed to create customization. Please try again.'
        );
      }
    }
  };

  if (loadingProfiles) {
    return (
      <ProtectedRoute requiredPermission="voice_ai:manage">
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requiredPermission="voice_ai:manage">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Customize Voice Agent Profile
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
          {/* Profile Selector */}
          <div>
            <label htmlFor="agent_profile_id" className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Select Profile <span className="text-red-500">*</span>
            </label>
            <select
              id="agent_profile_id"
              className="w-full px-4 py-3 border-2 rounded-lg text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              value={formData.agent_profile_id}
              onChange={(e) =>
                setFormData({ ...formData, agent_profile_id: e.target.value })
              }
              required
            >
              <option value="">-- Select a profile --</option>
              {availableProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.display_name} ({profile.language_name})
                </option>
              ))}
            </select>
          </div>

          {/* Show defaults for selected profile */}
          {selectedProfile && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded border border-blue-200 dark:border-blue-800">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Default Settings</h3>
              <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
                <div>
                  <span className="font-medium">Default Greeting:</span>
                  <div className="mt-1">{selectedProfile.default_greeting || 'None'}</div>
                </div>
                <div>
                  <span className="font-medium">Default Instructions:</span>
                  <div className="mt-1">{selectedProfile.default_instructions || 'None'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Custom Greeting */}
          <Textarea
            id="custom_greeting"
            label="Custom Greeting (Optional)"
            helperText="Leave empty to use the default. Use {business_name} as a placeholder."
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
            helperText="Leave empty to use the default. Provide specific guidance for your business."
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
              Activate immediately
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Customization'}
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
