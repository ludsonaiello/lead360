// ============================================================================
// Voice AI Tenants Management Page (Platform Admin)
// ============================================================================
// Manage tenant Voice AI overrides with search and pagination
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import TenantsList from '@/components/voice-ai/admin/tenants/TenantsList';
import TenantOverrideModal from '@/components/voice-ai/admin/tenants/TenantOverrideModal';
import type {
  TenantVoiceAISummary,
  TenantFilters,
  VoiceAIProvider
} from '@/lib/types/voice-ai';
import * as voiceAiApi from '@/lib/api/voice-ai';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';

export default function TenantsPage() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<TenantVoiceAISummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<TenantVoiceAISummary | null>(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [providers, setProviders] = useState<VoiceAIProvider[]>([]);
  const [filters, setFilters] = useState<TenantFilters>({
    page: 1,
    limit: 20,
  });
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  /**
   * Load all tenants with filters
   */
  const loadTenants = async (currentFilters: TenantFilters) => {
    setLoading(true);
    try {
      const result = await voiceAiApi.getAllTenants(currentFilters);
      setTenants(result.data);
      setTotalPages(result.meta.total_pages);
      setTotal(result.meta.total);
    } catch (err) {
      console.error('[TenantsPage] Failed to load tenants:', err);
      toast.error('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load providers for override dropdowns
   */
  const loadProviders = async () => {
    try {
      const providersData = await voiceAiApi.getAllProviders();
      setProviders(providersData);
    } catch (err) {
      console.error('[TenantsPage] Failed to load providers:', err);
      toast.error('Failed to load providers');
    }
  };

  useEffect(() => {
    loadTenants(filters);
  }, [filters]);

  useEffect(() => {
    loadProviders();
  }, []);

  /**
   * Handle override settings for a tenant
   */
  const handleOverride = (tenant: TenantVoiceAISummary) => {
    setSelectedTenant(tenant);
    setOverrideModalOpen(true);
  };

  /**
   * Handle filter change
   */
  const handleFilterChange = (newFilters: TenantFilters) => {
    setFilters(newFilters);
  };

  /**
   * Handle page change
   */
  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
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
          Voice AI Tenant Management
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage Voice AI overrides and quotas for tenants
        </p>
      </div>

      {/* Tenants List */}
      <TenantsList
        tenants={tenants}
        loading={loading}
        onOverride={handleOverride}
        onFilterChange={handleFilterChange}
        currentFilters={filters}
        totalPages={totalPages}
        total={total}
        onPageChange={handlePageChange}
      />

      {/* Override Modal */}
      {selectedTenant && (
        <TenantOverrideModal
          tenant={selectedTenant}
          providers={providers}
          isOpen={overrideModalOpen}
          onClose={() => {
            setOverrideModalOpen(false);
            setSelectedTenant(null);
          }}
          onSuccess={() => {
            setOverrideModalOpen(false);
            setSelectedTenant(null);
            loadTenants(filters);
          }}
        />
      )}
    </div>
  );
}
