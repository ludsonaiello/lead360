/**
 * Transcriptions Dashboard Page
 * Sprint 4: Transcription Monitoring
 * Main dashboard for monitoring failed transcriptions and provider statistics
 */

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { TranscriptionProviderCard } from '@/components/admin/twilio/TranscriptionProviderCard';
import { FailedTranscriptionsTable } from '@/components/admin/twilio/FailedTranscriptionsTable';
import { BulkRetryButton } from '@/components/admin/twilio/BulkRetryButton';
import { TranscriptionFilters } from '@/components/admin/twilio/TranscriptionFilters';
import {
  getFailedTranscriptions,
  getTranscriptionProviders,
} from '@/lib/api/twilio-admin';
import type {
  FailedTranscription,
  TranscriptionProvider,
} from '@/lib/types/twilio-admin';
import { FileText, AlertCircle } from 'lucide-react';

export default function TranscriptionsPage() {
  const [failedTranscriptions, setFailedTranscriptions] = useState<FailedTranscription[]>([]);
  const [providers, setProviders] = useState<TranscriptionProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [failedData, providersData] = await Promise.all([
        getFailedTranscriptions(),
        getTranscriptionProviders(),
      ]);

      setFailedTranscriptions(failedData.failed_transcriptions);
      setProviders(providersData.providers);
    } catch (err: any) {
      console.error('[TranscriptionsPage] Error loading data:', err);
      setError(err?.response?.data?.message || 'Failed to load transcription data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Get unique providers from failed transcriptions for filter
  const uniqueProviders = useMemo(() => {
    if (!failedTranscriptions || failedTranscriptions.length === 0) {
      return [];
    }
    const providerSet = new Set(failedTranscriptions.map((t) => t.transcription_provider));
    return Array.from(providerSet).sort();
  }, [failedTranscriptions]);

  // Filter transcriptions based on selected filters
  const filteredTranscriptions = useMemo(() => {
    if (!failedTranscriptions || failedTranscriptions.length === 0) {
      return [];
    }
    return failedTranscriptions.filter((transcription) => {
      // Provider filter
      if (selectedProvider && transcription.transcription_provider !== selectedProvider) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          transcription.call_details.twilio_call_sid.toLowerCase().includes(query) ||
          transcription.id.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [failedTranscriptions, selectedProvider, searchQuery]);

  const handleRetrySuccess = () => {
    // Reload data after successful retry
    loadData();
    // Clear selection
    setSelectedIds([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading transcription data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-md">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-300">
              Error Loading Data
            </h3>
          </div>
          <p className="text-red-700 dark:text-red-400">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Transcription Monitoring
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Monitor failed transcriptions, view provider statistics, and retry processing
        </p>
      </div>

      {/* Provider Statistics Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Provider Statistics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {providers && providers.length > 0 ? (
            providers.map((provider) => (
              <TranscriptionProviderCard key={provider.id} provider={provider} />
            ))
          ) : (
            <div className="col-span-full text-center py-8 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400">No providers configured</p>
            </div>
          )}
        </div>
      </div>

      {/* Failed Transcriptions Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Failed Transcriptions
          </h2>
          {selectedIds.length > 0 && (
            <BulkRetryButton
              selectedIds={selectedIds}
              onSuccess={handleRetrySuccess}
              onClear={() => setSelectedIds([])}
            />
          )}
        </div>

        {/* Filters */}
        <div className="mb-4">
          <TranscriptionFilters
            providers={uniqueProviders}
            selectedProvider={selectedProvider}
            onProviderChange={setSelectedProvider}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>

        {/* Table */}
        <FailedTranscriptionsTable
          transcriptions={filteredTranscriptions}
          onRetrySuccess={handleRetrySuccess}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      </div>
    </div>
  );
}
