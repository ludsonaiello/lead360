// ============================================================================
// Create Provider Page (Platform Admin)
// ============================================================================
// Form for creating a new AI provider
// ============================================================================

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import ProviderForm from '@/components/voice-ai/admin/providers/ProviderForm';
import Modal, { ModalContent, ModalActions } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { CreateProviderRequest } from '@/lib/types/voice-ai';
import * as voiceAiApi from '@/lib/api/voice-ai';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function CreateProviderPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [createdProviderId, setCreatedProviderId] = useState<string | null>(null);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  /**
   * Handle form submission
   */
  const handleSubmit = async (data: CreateProviderRequest) => {
    setSubmitting(true);
    setErrorMessage('');

    try {
      const provider = await voiceAiApi.createProvider(data);
      setCreatedProviderId(provider.id);
      toast.success(`Provider "${data.display_name}" created successfully`);
      setSuccessModalOpen(true);
    } catch (err: any) {
      console.error('[CreateProviderPage] Failed to create provider:', err);

      // Handle different error types
      if (err.status === 409) {
        setErrorMessage(
          `Provider key "${data.provider_key}" already exists. Please choose a different key.`
        );
      } else if (err.status === 400) {
        const messages = Array.isArray(err.data?.message)
          ? err.data.message.join('\n')
          : err.data?.message || 'Validation failed';
        setErrorMessage(messages);
      } else {
        setErrorMessage(err.message || 'Failed to create provider');
      }

      setErrorModalOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    router.push('/admin/voice-ai/providers');
  };

  /**
   * Handle success modal actions
   */
  const handleViewProvider = () => {
    if (createdProviderId) {
      router.push(`/admin/voice-ai/providers/${createdProviderId}`);
    }
  };

  const handleCreateAnother = () => {
    setSuccessModalOpen(false);
    setCreatedProviderId(null);
    router.refresh(); // Refresh to reset form
  };

  const handleBackToList = () => {
    router.push('/admin/voice-ai/providers');
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
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <Link
          href="/admin/voice-ai/providers"
          className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          Voice AI Providers
        </Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-900 dark:text-gray-100 font-medium">
          Create New Provider
        </span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Create New Provider
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Add a new speech-to-text, language model, or text-to-speech provider
        </p>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <ProviderForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={submitting}
        />
      </div>

      {/* Success Modal */}
      <Modal
        isOpen={successModalOpen}
        onClose={handleBackToList}
        title="Provider Created Successfully"
        size="md"
      >
        <ModalContent>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            The provider has been created successfully. What would you like to do next?
          </p>
        </ModalContent>

        <ModalActions>
          <Button onClick={handleBackToList} variant="secondary">
            Back to List
          </Button>
          <Button onClick={handleCreateAnother} variant="secondary">
            Create Another
          </Button>
          <Button onClick={handleViewProvider} variant="primary">
            View Provider
          </Button>
        </ModalActions>
      </Modal>

      {/* Error Modal */}
      <Modal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Failed to Create Provider"
        size="md"
      >
        <ModalContent>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-200 whitespace-pre-wrap">
              {errorMessage}
            </p>
          </div>
        </ModalContent>

        <ModalActions>
          <Button onClick={() => setErrorModalOpen(false)} variant="primary">
            Close
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
