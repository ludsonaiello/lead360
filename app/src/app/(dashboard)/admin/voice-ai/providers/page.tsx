// ============================================================================
// Voice AI Providers List Page (Platform Admin)
// ============================================================================
// Manage AI providers (STT, LLM, TTS) with search, filtering, and CRUD actions
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import ProviderList from '@/components/voice-ai/admin/providers/ProviderList';
import DeleteProviderModal from '@/components/voice-ai/admin/providers/DeleteProviderModal';
import type { VoiceAIProvider, ProviderFilters } from '@/lib/types/voice-ai';
import * as voiceAiApi from '@/lib/api/voice-ai';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

export default function ProvidersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [providers, setProviders] = useState<VoiceAIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState<VoiceAIProvider | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [filters, setFilters] = useState<ProviderFilters>({});

  /**
   * Load all providers with filters
   */
  const loadProviders = async (currentFilters?: ProviderFilters) => {
    setLoading(true);
    try {
      const providersData = await voiceAiApi.getAllProviders(currentFilters);
      setProviders(providersData);
    } catch (err) {
      console.error('[ProvidersPage] Failed to load providers:', err);
      toast.error('Failed to load providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProviders(filters);
  }, [filters]);

  /**
   * Handle edit provider
   */
  const handleEdit = (providerId: string) => {
    router.push(`/admin/voice-ai/providers/${providerId}`);
  };

  /**
   * Handle delete provider
   */
  const handleDelete = (providerId: string) => {
    const provider = providers.find((p) => p.id === providerId);
    if (provider) {
      setSelectedProvider(provider);
      setDeleteModalOpen(true);
    }
  };

  /**
   * Handle create new provider
   */
  const handleCreate = () => {
    router.push('/admin/voice-ai/providers/new');
  };

  /**
   * Handle filter change
   */
  const handleFilterChange = (newFilters: ProviderFilters) => {
    setFilters(newFilters);
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Voice AI Providers
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage speech-to-text, language model, and text-to-speech providers
        </p>
      </div>

      {/* Provider List */}
      <ProviderList
        providers={providers}
        loading={loading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onCreate={handleCreate}
        onFilterChange={handleFilterChange}
        currentFilters={filters}
      />

      {/* Delete Modal */}
      {selectedProvider && (
        <DeleteProviderModal
          provider={selectedProvider}
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setSelectedProvider(null);
          }}
          onSuccess={() => {
            setDeleteModalOpen(false);
            setSelectedProvider(null);
            loadProviders(filters);
          }}
        />
      )}
    </div>
  );
}
