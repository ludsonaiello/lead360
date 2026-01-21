/**
 * Provider Management Page (Admin Only)
 * View and manage communication providers
 * Features: List, filter, toggle active/inactive, view stats
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Search, Layers, CheckCircle, XCircle, TrendingUp, ExternalLink } from 'lucide-react';
import { getProviders, toggleProvider, getProviderStats } from '@/lib/api/communication';
import type { CommunicationProvider } from '@/lib/types/communication';
import { Input } from '@/components/ui/Input';
import { Select, SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'react-hot-toast';

export default function ProvidersPage() {
  const [providers, setProviders] = useState<CommunicationProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'email' | 'sms' | 'whatsapp' | ''>('');
  const [selectedProvider, setSelectedProvider] = useState<CommunicationProvider | null>(null);
  const [providerStats, setProviderStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Fetch providers
  const fetchProviders = async () => {
    try {
      setLoading(true);
      const data = await getProviders({
        type: (typeFilter || undefined) as 'email' | 'sms' | 'whatsapp' | undefined,
        include_system: true,
      });
      setProviders(data);
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      toast.error('Failed to load providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, [typeFilter]);

  // Toggle provider active status
  const handleToggle = async (providerKey: string) => {
    try {
      await toggleProvider(providerKey);
      toast.success('Provider status updated');
      fetchProviders();
    } catch (error: any) {
      console.error('Failed to toggle provider:', error);
      toast.error(error?.response?.data?.message || 'Failed to update provider');
    }
  };

  // View provider details
  const handleViewDetails = async (provider: CommunicationProvider) => {
    setSelectedProvider(provider);
    try {
      setLoadingStats(true);
      const stats = await getProviderStats(provider.provider_key);
      setProviderStats(stats);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      toast.error('Failed to load provider statistics');
    } finally {
      setLoadingStats(false);
    }
  };

  // Filter providers by search query
  const filteredProviders = providers.filter(provider =>
    provider.provider_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    provider.provider_key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const typeOptions: SelectOption[] = [
    { value: '', label: 'All Types' },
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'call', label: 'Call' },
    { value: 'push', label: 'Push Notification' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Communication Providers
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Manage available communication providers
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Search providers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
        <div className="sm:w-48">
          <Select
            options={typeOptions}
            value={typeFilter}
            onChange={(value) => setTypeFilter(value as 'email' | 'sms' | 'whatsapp' | '')}
          />
        </div>
      </div>

      {/* Providers Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
        </div>
      ) : filteredProviders.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <Layers className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            No providers found
          </h3>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProviders.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onToggle={() => handleToggle(provider.provider_key)}
              onViewDetails={() => handleViewDetails(provider)}
            />
          ))}
        </div>
      )}

      {/* Provider Details Modal */}
      {selectedProvider && (
        <Modal
          isOpen
          onClose={() => {
            setSelectedProvider(null);
            setProviderStats(null);
          }}
          title={selectedProvider.provider_name}
          size="lg"
        >
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Provider Key
                </h4>
                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 font-mono">
                  {selectedProvider.provider_key}
                </p>
              </div>
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </h4>
                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 capitalize">
                  {selectedProvider.provider_type}
                </p>
              </div>
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </h4>
                <p className="text-sm mt-1">
                  {selectedProvider.is_active ? (
                    <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Active
                    </span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                      <XCircle className="h-4 w-4" />
                      Inactive
                    </span>
                  )}
                </p>
              </div>
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  System Provider
                </h4>
                <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">
                  {selectedProvider.is_system ? 'Yes' : 'No'}
                </p>
              </div>
            </div>

            {/* Webhooks */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Webhooks
              </h4>
              <p className="text-sm text-gray-900 dark:text-gray-100">
                {selectedProvider.supports_webhooks ? (
                  <>
                    Supported
                    {selectedProvider.webhook_verification_method && (
                      <span className="text-gray-600 dark:text-gray-400">
                        {' '}({selectedProvider.webhook_verification_method})
                      </span>
                    )}
                  </>
                ) : (
                  'Not supported'
                )}
              </p>
              {selectedProvider.webhook_events && selectedProvider.webhook_events.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedProvider.webhook_events.map((event) => (
                    <span
                      key={event}
                      className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
                    >
                      {event}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Statistics */}
            {loadingStats ? (
              <div className="flex justify-center py-6">
                <LoadingSpinner />
              </div>
            ) : providerStats ? (
              <div>
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  Statistics
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      Configurations
                    </p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
                      {providerStats.total_configs || 0}
                    </p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                    <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                      Events Sent
                    </p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
                      {providerStats.total_events || 0}
                    </p>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                    <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                      Success Rate
                    </p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-1">
                      {providerStats.success_rate ? `${providerStats.success_rate}%` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Documentation Link */}
            {selectedProvider.documentation_url && (
              <div>
                <a
                  href={selectedProvider.documentation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  <ExternalLink className="h-4 w-4" />
                  View Provider Documentation
                </a>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                onClick={() => handleToggle(selectedProvider.provider_key)}
                variant="secondary"
              >
                {selectedProvider.is_active ? 'Deactivate' : 'Activate'} Provider
              </Button>
              <Button
                onClick={() => {
                  setSelectedProvider(null);
                  setProviderStats(null);
                }}
                variant="secondary"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Provider Card Component
function ProviderCard({
  provider,
  onToggle,
  onViewDetails,
}: {
  provider: CommunicationProvider;
  onToggle: () => void;
  onViewDetails: () => void;
}) {
  const typeColors: Record<string, string> = {
    email: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    sms: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    whatsapp: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    call: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    push: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  };

  const typeColor = typeColors[provider.provider_type] || typeColors['email'];

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          {provider.logo_url && (
            <img
              src={provider.logo_url}
              alt={provider.provider_name}
              className="h-8 w-auto mb-2"
            />
          )}
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {provider.provider_name}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
            {provider.provider_key}
          </p>
        </div>
        <span className={`ml-2 px-2 py-0.5 text-xs font-semibold rounded ${typeColor}`}>
          {provider.provider_type}
        </span>
      </div>

      {/* Features */}
      <div className="flex items-center gap-2 mb-3 text-xs text-gray-600 dark:text-gray-400">
        {provider.supports_webhooks && (
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
            Webhooks
          </span>
        )}
        {provider.is_system && (
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
            System
          </span>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center gap-2 mb-3 text-sm">
        {provider.is_active ? (
          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            Active
          </span>
        ) : (
          <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
            <XCircle className="h-4 w-4" />
            Inactive
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onViewDetails}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
        >
          <TrendingUp className="h-4 w-4" />
          View Details
        </button>
        <button
          onClick={onToggle}
          className="flex items-center justify-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
        >
          {provider.is_active ? 'Deactivate' : 'Activate'}
        </button>
      </div>
    </div>
  );
}
