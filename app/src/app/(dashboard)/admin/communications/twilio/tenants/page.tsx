/**
 * Tenant Communication Overview Page
 * Sprint 2: Cross-Tenant Communication Monitoring (Enhanced for 1000+ tenants)
 * View all tenant communication configurations with advanced filtering
 */

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Search, X, Filter, RefreshCw } from 'lucide-react';
import { getAllTenantConfigs } from '@/lib/api/twilio-admin';
import type { TenantConfigsResponse, TenantSMSConfig, TenantWhatsAppConfig, TenantIVRConfig } from '@/lib/types/twilio-admin';
import { TenantConfigCard } from '@/components/admin/twilio/TenantConfigCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'react-hot-toast';

interface TenantConfigGroup {
  tenant_id: string;
  tenant_name: string;
  subdomain: string;
  smsConfig?: TenantSMSConfig;
  whatsappConfig?: TenantWhatsAppConfig;
  ivrConfig?: TenantIVRConfig;
}

type StatusFilter = 'all' | 'active' | 'inactive';
type ConfigTypeFilter = 'all' | 'has_sms' | 'has_whatsapp' | 'has_ivr';
type VerificationFilter = 'all' | 'verified' | 'pending';

export default function TenantCommunicationOverviewPage() {
  const router = useRouter();
  const [tenantConfigs, setTenantConfigs] = useState<TenantConfigGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [configTypeFilter, setConfigTypeFilter] = useState<ConfigTypeFilter>('all');
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>('all');

  // Debounce search input (300ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchTenantConfigs();
  }, []);

  const fetchTenantConfigs = async () => {
    try {
      setLoading(true);
      const response = await getAllTenantConfigs();

      // Group configs by tenant
      const groupedConfigs = groupConfigsByTenant(response);
      setTenantConfigs(groupedConfigs);
    } catch (error: any) {
      console.error('Failed to load tenant configs:', error);
      toast.error(error.response?.data?.message || 'Failed to load tenant configurations');
    } finally {
      setLoading(false);
    }
  };

  const groupConfigsByTenant = (response: TenantConfigsResponse): TenantConfigGroup[] => {
    const tenantMap = new Map<string, TenantConfigGroup>();

    // Process SMS configs
    response.sms_configs.forEach((config) => {
      if (config.tenant) {
        if (!tenantMap.has(config.tenant.id)) {
          tenantMap.set(config.tenant.id, {
            tenant_id: config.tenant.id,
            tenant_name: config.tenant.company_name,
            subdomain: config.tenant.subdomain,
          });
        }
        const group = tenantMap.get(config.tenant.id)!;
        group.smsConfig = config;
      }
    });

    // Process WhatsApp configs
    response.whatsapp_configs.forEach((config) => {
      if (config.tenant) {
        if (!tenantMap.has(config.tenant.id)) {
          tenantMap.set(config.tenant.id, {
            tenant_id: config.tenant.id,
            tenant_name: config.tenant.company_name,
            subdomain: config.tenant.subdomain,
          });
        }
        const group = tenantMap.get(config.tenant.id)!;
        group.whatsappConfig = config;
      }
    });

    // Process IVR configs
    response.ivr_configs.forEach((config) => {
      if (config.tenant) {
        if (!tenantMap.has(config.tenant.id)) {
          tenantMap.set(config.tenant.id, {
            tenant_id: config.tenant.id,
            tenant_name: config.tenant.company_name,
            subdomain: config.tenant.subdomain,
          });
        }
        const group = tenantMap.get(config.tenant.id)!;
        group.ivrConfig = config;
      }
    });

    return Array.from(tenantMap.values()).sort((a, b) =>
      a.tenant_name.localeCompare(b.tenant_name)
    );
  };

  // Memoized filtering for performance
  const filteredConfigs = useMemo(() => {
    return tenantConfigs.filter((config) => {
      // Search filter
      if (debouncedSearch.trim() !== '') {
        const query = debouncedSearch.toLowerCase();
        const matchesSearch =
          config.tenant_name.toLowerCase().includes(query) ||
          config.subdomain.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const hasActiveConfig =
          (config.smsConfig?.is_active) ||
          (config.whatsappConfig?.is_active) ||
          (config.ivrConfig?.ivr_enabled);

        if (statusFilter === 'active' && !hasActiveConfig) return false;
        if (statusFilter === 'inactive' && hasActiveConfig) return false;
      }

      // Config type filter
      if (configTypeFilter !== 'all') {
        if (configTypeFilter === 'has_sms' && !config.smsConfig) return false;
        if (configTypeFilter === 'has_whatsapp' && !config.whatsappConfig) return false;
        if (configTypeFilter === 'has_ivr' && !config.ivrConfig) return false;
      }

      // Verification filter
      if (verificationFilter !== 'all') {
        const hasVerifiedConfig =
          (config.smsConfig?.is_verified) ||
          (config.whatsappConfig?.is_verified);
        const hasPendingConfig =
          (config.smsConfig && !config.smsConfig.is_verified) ||
          (config.whatsappConfig && !config.whatsappConfig.is_verified);

        if (verificationFilter === 'verified' && !hasVerifiedConfig) return false;
        if (verificationFilter === 'pending' && !hasPendingConfig) return false;
      }

      return true;
    });
  }, [tenantConfigs, debouncedSearch, statusFilter, configTypeFilter, verificationFilter]);

  const handleViewDetails = useCallback((tenantId: string) => {
    router.push(`/admin/communications/twilio/tenants/${tenantId}`);
  }, [router]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setConfigTypeFilter('all');
    setVerificationFilter('all');
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    statusFilter !== 'all' ||
    configTypeFilter !== 'all' ||
    verificationFilter !== 'all';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
          <Building2 className="h-8 w-8" />
          Tenant Communication Overview
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          View and filter communication configurations across all tenants
        </p>
      </div>

      {/* Search Bar - Prominent */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search tenants by company name or subdomain..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-12 py-3.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base shadow-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Advanced Filters</h2>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="ml-auto text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              Reset All
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Config Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Config Type
            </label>
            <Select value={configTypeFilter} onValueChange={(value) => setConfigTypeFilter(value as ConfigTypeFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="has_sms">Has SMS</SelectItem>
                <SelectItem value="has_whatsapp">Has WhatsApp</SelectItem>
                <SelectItem value="has_ivr">Has IVR</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Verification Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Verification
            </label>
            <Select value={verificationFilter} onValueChange={(value) => setVerificationFilter(value as VerificationFilter)}>
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="pending">Pending Verification</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {/* Results Summary */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {hasActiveFilters ? (
                <>
                  Showing <span className="font-semibold text-gray-900 dark:text-gray-100">{filteredConfigs.length}</span> of{' '}
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{tenantConfigs.length}</span> tenants
                </>
              ) : (
                <>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{tenantConfigs.length}</span> total tenants
                </>
              )}
            </div>

            {hasActiveFilters && filteredConfigs.length === 0 && (
              <button
                onClick={handleResetFilters}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
              >
                <RefreshCw className="h-4 w-4" />
                Clear filters
              </button>
            )}
          </div>

          {/* Tenant Cards Grid */}
          {filteredConfigs.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <Building2 className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {hasActiveFilters ? 'No tenants match your filters' : 'No configurations found'}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {hasActiveFilters
                  ? 'Try adjusting your search query or filters.'
                  : 'No tenants have communication configurations yet.'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredConfigs.map((config) => (
                <TenantConfigCard
                  key={config.tenant_id}
                  tenantId={config.tenant_id}
                  tenantName={config.tenant_name}
                  subdomain={config.subdomain}
                  smsConfig={config.smsConfig}
                  whatsappConfig={config.whatsappConfig}
                  ivrConfig={config.ivrConfig}
                  onViewDetails={() => handleViewDetails(config.tenant_id)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
