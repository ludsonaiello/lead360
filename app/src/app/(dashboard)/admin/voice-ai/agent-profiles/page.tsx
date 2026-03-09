// ============================================================================
// Global Voice Agent Profiles List Page (Platform Admin)
// ============================================================================
// Manage global language/voice templates available to all tenants
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { voiceAiAdminApi } from '@/lib/api/voice-ai-admin';
import type { GlobalAgentProfile } from '@/lib/types/voice-ai';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function GlobalProfilesListPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<GlobalAgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /**
   * Load all global profiles
   */
  const loadProfiles = async () => {
    setLoading(true);
    try {
      const data = await voiceAiAdminApi.globalProfiles.list(!showInactive);
      setProfiles(data);
    } catch (error: any) {
      console.error('[GlobalProfilesListPage] Failed to load profiles:', error);
      toast.error(error?.message || 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfiles();
  }, [showInactive]);

  /**
   * Handle delete profile
   */
  const handleDelete = async (profile: GlobalAgentProfile) => {
    if (!confirm(`Delete profile "${profile.display_name}"? This will deactivate it.`)) {
      return;
    }

    // Check if profile has tenant overrides
    if (profile._count?.tenant_overrides && profile._count.tenant_overrides > 0) {
      toast.error(
        `Cannot delete: ${profile._count.tenant_overrides} tenant(s) are using this profile. Remove overrides first.`,
        { duration: 5000 }
      );
      return;
    }

    setDeletingId(profile.id);
    try {
      await voiceAiAdminApi.globalProfiles.delete(profile.id);
      toast.success('Profile deleted successfully');
      loadProfiles();
    } catch (error: any) {
      console.error('[GlobalProfilesListPage] Failed to delete profile:', error);
      toast.error(error?.message || 'Failed to delete profile');
    } finally {
      setDeletingId(null);
    }
  };

  // Check if user is platform admin
  if (!user?.is_platform_admin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Platform Admin access required
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Global Voice Agent Profiles
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Manage language/voice templates available to all tenants
          </p>
        </div>
        <Button onClick={() => router.push('/admin/voice-ai/agent-profiles/new')}>
          Create Profile
        </Button>
      </div>

      {/* Filter: Show Inactive */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="show-inactive"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label
          htmlFor="show-inactive"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Show inactive profiles
        </label>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            No profiles found. Create your first global profile to get started.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Display Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Language
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Voice ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Tenant Usage
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {profiles.map((profile) => (
                <tr key={profile.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {profile.display_name}
                    </div>
                    {profile.description && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {profile.description}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-gray-100">
                      {profile.language_name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      ({profile.language_code})
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs font-mono text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {profile.voice_id}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {profile.is_active ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {profile._count?.tenant_overrides || 0} tenant(s)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        router.push(`/admin/voice-ai/agent-profiles/${profile.id}/edit`)
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDelete(profile)}
                      disabled={
                        deletingId === profile.id ||
                        (profile._count?.tenant_overrides ?? 0) > 0
                      }
                      loading={deletingId === profile.id}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
