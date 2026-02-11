'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { SuccessModal } from '@/components/ui/SuccessModal';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { TranscriptionProviderCard } from '@/components/admin/twilio/transcription-providers/TranscriptionProviderCard';
import { AddTranscriptionProviderModal } from '@/components/admin/twilio/transcription-providers/AddTranscriptionProviderModal';
import { EditTranscriptionProviderModal } from '@/components/admin/twilio/transcription-providers/EditTranscriptionProviderModal';
import { TestTranscriptionProviderModal } from '@/components/admin/twilio/transcription-providers/TestTranscriptionProviderModal';
import {
  getTranscriptionProviders,
  createTranscriptionProvider,
  updateTranscriptionProvider,
  deleteTranscriptionProvider,
  testTranscriptionProviderConnectivity,
  getAllTenantConfigs,
} from '@/lib/api/twilio-admin';
import type {
  TranscriptionProvider,
  CreateTranscriptionProviderDto,
  UpdateTranscriptionProviderDto,
  Tenant,
} from '@/lib/types/twilio-admin';
import { Loader2, Plus, RefreshCw } from 'lucide-react';

export default function TranscriptionProvidersPage() {
  const [providers, setProviders] = useState<TranscriptionProvider[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<TranscriptionProvider | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [providersData, tenantsData] = await Promise.all([
        getTranscriptionProviders(),
        getAllTenantConfigs(),
      ]);

      setProviders(Array.isArray(providersData) ? providersData : []);

      // Extract unique tenants from configs
      const uniqueTenants = new Map<string, Tenant>();
      if (tenantsData.sms_configs) {
        tenantsData.sms_configs.forEach((config: any) => {
          if (config.tenant) {
            uniqueTenants.set(config.tenant.id, config.tenant);
          }
        });
      }
      if (tenantsData.whatsapp_configs) {
        tenantsData.whatsapp_configs.forEach((config: any) => {
          if (config.tenant) {
            uniqueTenants.set(config.tenant.id, config.tenant);
          }
        });
      }
      setTenants(Array.from(uniqueTenants.values()));
    } catch (error: any) {
      console.error('Failed to load providers:', error);
      setErrorMessage(error?.message || 'Failed to load transcription providers');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCreate = async (dto: CreateTranscriptionProviderDto) => {
    try {
      await createTranscriptionProvider(dto);
      setSuccessMessage('Transcription provider created successfully');
      await loadData();
    } catch (error: any) {
      console.error('Failed to create provider:', error);
      setErrorMessage(error?.message || 'Failed to create transcription provider');
      throw error;
    }
  };

  const handleEdit = (id: string) => {
    const provider = providers.find((p) => p.id === id);
    if (provider) {
      setSelectedProvider(provider);
      setEditModalOpen(true);
    }
  };

  const handleUpdate = async (id: string, dto: UpdateTranscriptionProviderDto) => {
    try {
      await updateTranscriptionProvider(id, dto);
      setSuccessMessage('Transcription provider updated successfully');
      await loadData();
    } catch (error: any) {
      console.error('Failed to update provider:', error);
      setErrorMessage(error?.message || 'Failed to update transcription provider');
      throw error;
    }
  };

  const handleMakeDefault = async (id: string) => {
    try {
      await updateTranscriptionProvider(id, { is_system_default: true });
      setSuccessMessage('Provider set as system default');
      await loadData();
    } catch (error: any) {
      console.error('Failed to set default provider:', error);
      setErrorMessage(error?.message || 'Failed to set default provider');
    }
  };

  const handleDelete = async (id: string) => {
    const provider = providers.find((p) => p.id === id);
    if (!provider) return;

    if (provider.is_system_default) {
      setErrorMessage('Cannot delete system default provider');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${provider.provider_name}?`)) {
      return;
    }

    try {
      await deleteTranscriptionProvider(id);
      setSuccessMessage('Transcription provider deleted successfully');
      await loadData();
    } catch (error: any) {
      console.error('Failed to delete provider:', error);
      setErrorMessage(error?.message || 'Failed to delete transcription provider');
    }
  };

  const handleTest = (id: string) => {
    const provider = providers.find((p) => p.id === id);
    if (provider) {
      setSelectedProvider(provider);
      setTestModalOpen(true);
    }
  };

  const handleTestProvider = async (id: string, audioUrl?: string) => {
    return await testTranscriptionProviderConnectivity(id, audioUrl);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transcription Providers</h1>
          <p className="text-muted-foreground">
            Manage AI transcription providers for voice call recordings
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Provider
          </Button>
        </div>
      </div>

      {/* Providers Grid */}
      {providers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            No transcription providers configured
          </p>
          <Button onClick={() => setAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Provider
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => (
            <TranscriptionProviderCard
              key={provider.id}
              provider={provider}
              onTest={handleTest}
              onEdit={handleEdit}
              onMakeDefault={handleMakeDefault}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <AddTranscriptionProviderModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onCreate={handleCreate}
        tenants={tenants}
      />

      <EditTranscriptionProviderModal
        open={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedProvider(null);
        }}
        provider={selectedProvider}
        onUpdate={handleUpdate}
      />

      <TestTranscriptionProviderModal
        open={testModalOpen}
        onClose={() => {
          setTestModalOpen(false);
          setSelectedProvider(null);
        }}
        provider={selectedProvider}
        onTest={handleTestProvider}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={!!successMessage}
        onClose={() => setSuccessMessage(null)}
        title="Success"
        message={successMessage || ''}
      />

      {/* Error Modal */}
      <ErrorModal
        isOpen={!!errorMessage}
        onClose={() => setErrorMessage(null)}
        title="Error"
        message={errorMessage || ''}
      />
    </div>
  );
}
