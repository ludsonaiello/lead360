/**
 * Edit Bundle Page
 * Full page form for editing existing bundles
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { BundleForm } from '@/components/bundles/BundleForm';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { getBundleById, replaceBundleWithItems } from '@/lib/api/bundles';
import { CheckCircle, XCircle } from 'lucide-react';
import type { Bundle, UpdateBundleWithItemsDto } from '@/lib/types/quotes';

export default function EditBundlePage() {
  const router = useRouter();
  const params = useParams();
  const bundleId = params.id as string;

  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [loadingBundle, setLoadingBundle] = useState(true);
  const [loading, setLoading] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Load existing bundle
  useEffect(() => {
    const loadBundle = async () => {
      try {
        setLoadingBundle(true);
        const data = await getBundleById(bundleId);
        setBundle(data);
      } catch (err: any) {
        console.error('Failed to load bundle:', err);
        setErrorMessage(err.response?.data?.message || err.message || 'Failed to load bundle');
        setErrorModalOpen(true);
      } finally {
        setLoadingBundle(false);
      }
    };

    loadBundle();
  }, [bundleId]);

  const handleSubmit = async (data: UpdateBundleWithItemsDto) => {
    try {
      setLoading(true);
      await replaceBundleWithItems(bundleId, data);
      setSuccessModalOpen(true);
    } catch (err: any) {
      console.error('Failed to update bundle:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to update bundle');
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessModalOpen(false);
    router.push('/library/bundles');
  };

  const handleErrorClose = () => {
    setErrorModalOpen(false);

    // If error occurred during initial load, go back
    if (!bundle) {
      router.push('/library/bundles');
    }
  };

  if (loadingBundle) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
        </div>
      </div>
    );
  }

  if (!bundle) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <BundleForm bundle={bundle} onSubmit={handleSubmit} loading={loading} />

      {/* Success Modal */}
      <Modal isOpen={successModalOpen} onClose={handleSuccessClose} title="Changes Saved" size="sm">
        <ModalContent>
          <div className="flex flex-col items-center text-center py-4">
            <CheckCircle className="w-16 h-16 text-green-500 dark:text-green-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Bundle successfully updated
            </p>
          </div>
        </ModalContent>
        <ModalActions>
          <Button onClick={handleSuccessClose}>Back to Bundles</Button>
        </ModalActions>
      </Modal>

      {/* Error Modal */}
      <Modal isOpen={errorModalOpen} onClose={handleErrorClose} title="Error" size="sm">
        <ModalContent>
          <div className="flex flex-col items-center text-center py-4">
            <XCircle className="w-16 h-16 text-red-500 dark:text-red-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {bundle ? 'Failed to update bundle' : 'Failed to load bundle'}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{errorMessage}</p>
          </div>
        </ModalContent>
        <ModalActions>
          <Button variant="secondary" onClick={handleErrorClose}>
            {bundle ? 'Close' : 'Back to Bundles'}
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
