/**
 * New Bundle Page
 * Full page form for creating bundles
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BundleForm } from '@/components/bundles/BundleForm';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { createBundle } from '@/lib/api/bundles';
import { CheckCircle, XCircle } from 'lucide-react';
import type { CreateBundleDto, UpdateBundleDto } from '@/lib/types/quotes';

export default function NewBundlePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (data: CreateBundleDto | UpdateBundleDto) => {
    try {
      setLoading(true);
      await createBundle(data as CreateBundleDto);
      setSuccessModalOpen(true);
    } catch (err: any) {
      console.error('Failed to create bundle:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to create bundle');
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
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <BundleForm onSubmit={handleSubmit} loading={loading} />

      {/* Success Modal */}
      <Modal isOpen={successModalOpen} onClose={handleSuccessClose} title="Bundle Created" size="sm">
        <ModalContent>
          <div className="flex flex-col items-center text-center py-4">
            <CheckCircle className="w-16 h-16 text-green-500 dark:text-green-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Bundle successfully created
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
              Failed to create bundle
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{errorMessage}</p>
          </div>
        </ModalContent>
        <ModalActions>
          <Button variant="secondary" onClick={handleErrorClose}>
            Close
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
