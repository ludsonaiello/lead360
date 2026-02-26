// ============================================================================
// Voice AI Credentials Management Page (Platform Admin)
// ============================================================================
// Manage encrypted API credentials for Voice AI providers with security focus
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import CredentialsList from '@/components/voice-ai/admin/credentials/CredentialsList';
import CredentialFormModal from '@/components/voice-ai/admin/credentials/CredentialFormModal';
import DeleteCredentialModal from '@/components/voice-ai/admin/credentials/DeleteCredentialModal';
import TestConnectionModal from '@/components/voice-ai/admin/credentials/TestConnectionModal';
import type {
  VoiceAIProvider,
  VoiceAICredential,
  ProviderWithCredential,
  TestConnectionResponse,
} from '@/lib/types/voice-ai';
import * as voiceAiApi from '@/lib/api/voice-ai';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function CredentialsPage() {
  const { user } = useAuth();
  const [providers, setProviders] = useState<VoiceAIProvider[]>([]);
  const [credentials, setCredentials] = useState<VoiceAICredential[]>([]);
  const [mergedData, setMergedData] = useState<ProviderWithCredential[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);

  // Selected items
  const [selectedProvider, setSelectedProvider] = useState<ProviderWithCredential | null>(
    null
  );
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);
  const [testing, setTesting] = useState(false);

  /**
   * Load all providers and credentials
   */
  const loadData = async () => {
    setLoading(true);
    try {
      const [providersData, credentialsData] = await Promise.all([
        voiceAiApi.getAllProviders(),
        voiceAiApi.getAllCredentials(),
      ]);

      setProviders(providersData);
      setCredentials(credentialsData);

      // Merge providers with credentials
      const merged: ProviderWithCredential[] = providersData.map((provider) => {
        const credential = credentialsData.find((c) => c.provider_id === provider.id);
        return {
          ...provider,
          has_credential: !!credential,
          credential_id: credential?.id || null,
          credential_masked_key: credential?.masked_api_key || null,
        };
      });

      setMergedData(merged);
    } catch (err) {
      console.error('[CredentialsPage] Failed to load data:', err);
      toast.error('Failed to load credentials');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /**
   * Handle add credential
   */
  const handleAddCredential = (provider: ProviderWithCredential) => {
    setSelectedProvider(provider);
    setFormModalOpen(true);
  };

  /**
   * Handle update credential
   */
  const handleUpdateCredential = (provider: ProviderWithCredential) => {
    setSelectedProvider(provider);
    setFormModalOpen(true);
  };

  /**
   * Handle delete credential
   */
  const handleDeleteCredential = (provider: ProviderWithCredential) => {
    setSelectedProvider(provider);
    setDeleteModalOpen(true);
  };

  /**
   * Handle test connection
   */
  const handleTestConnection = async (provider: ProviderWithCredential) => {
    setTesting(true);
    setSelectedProvider(provider);
    try {
      const result = await voiceAiApi.testCredential(provider.id);
      setTestResult(result);
      setTestModalOpen(true);
    } catch (err: any) {
      console.error('[CredentialsPage] Test connection failed:', err);
      setTestResult({
        success: false,
        message: err.response?.data?.message || 'Connection test failed',
      });
      setTestModalOpen(true);
    } finally {
      setTesting(false);
    }
  };

  /**
   * Handle success (reload data)
   */
  const handleSuccess = () => {
    loadData();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Provider Credentials
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage encrypted API keys for Voice AI providers. All keys are encrypted before
          storage.
        </p>
      </div>

      {/* Credentials List */}
      <CredentialsList
        providers={mergedData}
        loading={loading}
        onAddCredential={handleAddCredential}
        onUpdateCredential={handleUpdateCredential}
        onDeleteCredential={handleDeleteCredential}
        onTestConnection={handleTestConnection}
        testing={testing}
      />

      {/* Credential Form Modal */}
      {selectedProvider && (
        <CredentialFormModal
          provider={selectedProvider}
          isOpen={formModalOpen}
          onClose={() => {
            setFormModalOpen(false);
            setSelectedProvider(null);
          }}
          onSuccess={() => {
            setFormModalOpen(false);
            setSelectedProvider(null);
            handleSuccess();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {selectedProvider && (
        <DeleteCredentialModal
          provider={selectedProvider}
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setSelectedProvider(null);
          }}
          onSuccess={() => {
            setDeleteModalOpen(false);
            setSelectedProvider(null);
            handleSuccess();
          }}
        />
      )}

      {/* Test Connection Result Modal */}
      {selectedProvider && testResult && (
        <TestConnectionModal
          provider={selectedProvider}
          result={testResult}
          isOpen={testModalOpen}
          onClose={() => {
            setTestModalOpen(false);
            setSelectedProvider(null);
            setTestResult(null);
          }}
        />
      )}
    </div>
  );
}
