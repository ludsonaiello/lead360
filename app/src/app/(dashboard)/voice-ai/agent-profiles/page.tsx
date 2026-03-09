// ============================================================================
// Voice Agent Profiles - Tenant Management (Architecture v2)
// ============================================================================
// Global profiles + tenant overrides architecture
// Sprint 21: Tenant UI + IVR Builder Update
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  voiceAiTenantApi,
  type AvailableGlobalProfile,
  type TenantOverride,
} from '@/lib/api/voice-ai-tenant';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { SuccessModal } from '@/components/ui/SuccessModal';
import toast from 'react-hot-toast';

export default function TenantProfilesPage() {
  const router = useRouter();
  const [availableProfiles, setAvailableProfiles] = useState<AvailableGlobalProfile[]>([]);
  const [overrides, setOverrides] = useState<TenantOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingOverride, setDeletingOverride] = useState<TenantOverride | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [available, myOverrides] = await Promise.all([
        voiceAiTenantApi.availableProfiles.list(true),
        voiceAiTenantApi.overrides.list(false),
      ]);
      setAvailableProfiles(available);
      setOverrides(myOverrides);
    } catch (error: any) {
      console.error('[TenantProfilesPage] Failed to load profiles:', error);
      setErrorMessage('Failed to load profiles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getOverrideForProfile = (profileId: string) => {
    return overrides.find((o) => o.agent_profile_id === profileId);
  };

  const handleCustomize = (profile: AvailableGlobalProfile) => {
    const override = getOverrideForProfile(profile.id);
    if (override) {
      router.push(`/voice-ai/agent-profiles/${override.id}/edit`);
    } else {
      router.push(`/voice-ai/agent-profiles/new?profile=${profile.id}`);
    }
  };

  const handleDelete = async () => {
    if (!deletingOverride) return;

    try {
      await voiceAiTenantApi.overrides.delete(deletingOverride.id);
      setDeletingOverride(null);
      setSuccessMessage('Customization deleted successfully');
      loadData();
    } catch (error: any) {
      console.error('[TenantProfilesPage] Failed to delete override:', error);
      setDeletingOverride(null);
      setErrorMessage(
        error.response?.data?.message || 'Failed to delete customization. Please try again.'
      );
    }
  };

  if (loading) {
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
      <div className="space-y-8">
        {/* Available Profiles Section */}
        <section>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Available Voice Agent Profiles
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Select a profile to customize for your business. These are managed by the platform.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableProfiles.map((profile) => {
              const override = getOverrideForProfile(profile.id);
              return (
                <Card key={profile.id} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100">
                      {profile.display_name}
                    </h3>
                    {override && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                        Customized
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    <div>Language: {profile.language_name}</div>
                    {profile.description && <div className="mt-1">{profile.description}</div>}
                  </div>

                  <details className="text-sm mb-3">
                    <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                      View defaults
                    </summary>
                    <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded">
                      <div className="font-medium text-gray-900 dark:text-gray-100">Greeting:</div>
                      <div className="text-gray-700 dark:text-gray-300">
                        {profile.default_greeting || 'None'}
                      </div>
                      <div className="font-medium text-gray-900 dark:text-gray-100 mt-2">
                        Instructions:
                      </div>
                      <div className="text-gray-700 dark:text-gray-300">
                        {profile.default_instructions || 'None'}
                      </div>
                    </div>
                  </details>

                  <Button
                    size="sm"
                    onClick={() => handleCustomize(profile)}
                    className="w-full"
                  >
                    {override ? 'Edit Customization' : 'Customize'}
                  </Button>
                </Card>
              );
            })}
          </div>
        </section>

        {/* My Customizations Section */}
        {overrides.length > 0 && (
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              My Customized Profiles
            </h2>

            <div className="space-y-4">
              {overrides.map((override) => (
                <Card key={override.id} className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">
                        {override.agent_profile.display_name}
                      </h3>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {override.custom_greeting && (
                          <div className="mb-1">
                            <span className="font-medium">Custom Greeting:</span>{' '}
                            {override.custom_greeting}
                          </div>
                        )}
                        {override.custom_instructions && (
                          <div>
                            <span className="font-medium">Custom Instructions:</span>{' '}
                            {override.custom_instructions}
                          </div>
                        )}
                        {!override.custom_greeting && !override.custom_instructions && (
                          <span className="text-gray-400 dark:text-gray-500">
                            Using global defaults
                          </span>
                        )}
                      </div>
                      <div className="mt-2">
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            override.is_active
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {override.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() =>
                          router.push(`/voice-ai/agent-profiles/${override.id}/edit`)
                        }
                        className="text-sm text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 font-medium px-3 py-1"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingOverride(override)}
                        className="text-sm text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 font-medium px-3 py-1"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Delete Confirmation Modal */}
        {deletingOverride && (
          <DeleteConfirmationModal
            isOpen={!!deletingOverride}
            title="Delete Customization"
            message={
              <p>
                Delete this customization? You can recreate it later. The global profile{' '}
                <strong>{deletingOverride.agent_profile.display_name}</strong> will remain available.
              </p>
            }
            onConfirm={handleDelete}
            onCancel={() => setDeletingOverride(null)}
          />
        )}

        {/* Error Modal */}
        {errorMessage && (
          <ErrorModal
            isOpen={!!errorMessage}
            title="Error"
            message={errorMessage}
            onClose={() => setErrorMessage(null)}
          />
        )}

        {/* Success Modal */}
        {successMessage && (
          <SuccessModal
            isOpen={!!successMessage}
            title="Success"
            message={successMessage}
            onClose={() => setSuccessMessage(null)}
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
