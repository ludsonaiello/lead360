// ============================================================================
// Edit Provider Page (Platform Admin)
// ============================================================================
// Form for editing an existing AI provider
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import ProviderForm from '@/components/voice-ai/admin/providers/ProviderForm';
import Modal, { ModalContent, ModalActions } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import type { VoiceAIProvider, UpdateProviderRequest } from '@/lib/types/voice-ai';
import * as voiceAiApi from '@/lib/api/voice-ai';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function EditProviderPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const providerId = params.id as string;

  const [provider, setProvider] = useState<VoiceAIProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  /**
   * Load provider data
   */
  useEffect(() => {
    const loadProvider = async () => {
      setLoading(true);
      try {
        const providerData = await voiceAiApi.getProviderById(providerId);
        setProvider(providerData);
      } catch (err: any) {
        console.error('[EditProviderPage] Failed to load provider:', err);

        if (err.status === 404) {
          toast.error('Provider not found');
          router.push('/admin/voice-ai/providers');
        } else {
          toast.error('Failed to load provider');
        }
      } finally {
        setLoading(false);
      }
    };

    if (providerId) {
      loadProvider();
    }
  }, [providerId, router]);

  /**
   * Handle form submission
   */
  const handleSubmit = async (data: UpdateProviderRequest) => {
    setSubmitting(true);
    setErrorMessage('');

    try {
      const updatedProvider = await voiceAiApi.updateProvider(providerId, data);
      setProvider(updatedProvider);
      toast.success('Provider updated successfully');
      setSuccessModalOpen(true);
    } catch (err: any) {
      console.error('[EditProviderPage] Failed to update provider:', err);

      // Handle different error types
      if (err.status === 409) {
        setErrorMessage(
          'Provider key already exists. Please choose a different key.'
        );
      } else if (err.status === 400) {
        const messages = Array.isArray(err.data?.message)
          ? err.data.message.join('\n')
          : err.data?.message || 'Validation failed';
        setErrorMessage(messages);
      } else {
        setErrorMessage(err.message || 'Failed to update provider');
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
   * Handle success modal close
   */
  const handleSuccessClose = () => {
    setSuccessModalOpen(false);
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

  // Show loading spinner while loading provider
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Show error if provider not found
  if (!provider) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Provider Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The provider you are looking for does not exist
          </p>
          <Button onClick={() => router.push('/admin/voice-ai/providers')}>
            Back to List
          </Button>
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
          {provider.display_name}
        </span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Edit Provider
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Update provider configuration and settings
        </p>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <ProviderForm
          provider={provider}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={submitting}
        />
      </div>

      {/* Success Modal */}
      <Modal
        isOpen={successModalOpen}
        onClose={handleSuccessClose}
        title="Provider Updated Successfully"
        size="md"
      >
        <ModalContent>
          <p className="text-gray-700 dark:text-gray-300">
            The provider has been updated successfully.
          </p>
        </ModalContent>

        <ModalActions>
          <Button onClick={handleSuccessClose} variant="primary">
            Back to List
          </Button>
        </ModalActions>
      </Modal>

      {/* Error Modal */}
      <Modal
        isOpen={errorModalOpen}
        onClose={() => setErrorModalOpen(false)}
        title="Failed to Update Provider"
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
