/**
 * New Library Item Page
 * Full page form for creating library items
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LibraryItemForm } from '@/components/library/LibraryItemForm';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { createLibraryItem } from '@/lib/api/library-items';
import { CheckCircle, XCircle } from 'lucide-react';
import type { CreateLibraryItemDto, UpdateLibraryItemDto } from '@/lib/types/quotes';

export default function NewLibraryItemPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (data: CreateLibraryItemDto | UpdateLibraryItemDto) => {
    try {
      setLoading(true);
      await createLibraryItem(data as CreateLibraryItemDto);
      setSuccessModalOpen(true);
    } catch (err: any) {
      console.error('Failed to create library item:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to create library item');
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessModalOpen(false);
    router.push('/library/items');
  };

  const handleErrorClose = () => {
    setErrorModalOpen(false);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <LibraryItemForm onSubmit={handleSubmit} loading={loading} />

      {/* Success Modal */}
      <Modal
        isOpen={successModalOpen}
        onClose={handleSuccessClose}
        title="Item Added"
        size="sm"
      >
        <ModalContent>
          <div className="flex flex-col items-center text-center py-4">
            <CheckCircle className="w-16 h-16 text-green-500 dark:text-green-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Library item successfully created
            </p>
          </div>
        </ModalContent>
        <ModalActions>
          <Button onClick={handleSuccessClose}>Back to Library</Button>
        </ModalActions>
      </Modal>

      {/* Error Modal */}
      <Modal
        isOpen={errorModalOpen}
        onClose={handleErrorClose}
        title="Error"
        size="sm"
      >
        <ModalContent>
          <div className="flex flex-col items-center text-center py-4">
            <XCircle className="w-16 h-16 text-red-500 dark:text-red-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Failed to create library item
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
