/**
 * New Quote Item Page
 * Full page form for adding items to a quote
 */

'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ItemForm } from '@/components/quotes/ItemForm';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { addQuoteItem, saveItemToLibrary } from '@/lib/api/quote-items';
import { CheckCircle, XCircle } from 'lucide-react';
import type { CreateQuoteItemDto, UpdateQuoteItemDto } from '@/lib/types/quotes';

export default function NewQuoteItemPage() {
  const router = useRouter();
  const params = useParams();
  const quoteId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [itemId, setItemId] = useState<string | null>(null);

  const handleSubmit = async (data: CreateQuoteItemDto | UpdateQuoteItemDto, saveToLibrary?: boolean) => {
    try {
      setLoading(true);

      // Create the item
      const newItem = await addQuoteItem(quoteId, data as CreateQuoteItemDto);
      setItemId(newItem.id);

      // If checkbox was checked, save to library
      if (saveToLibrary) {
        try {
          await saveItemToLibrary(quoteId, newItem.id);
        } catch (err) {
          console.error('Failed to save to library:', err);
          // Don't block success - item was still created
        }
      }

      setSuccessModalOpen(true);
    } catch (err: any) {
      console.error('Failed to create item:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to create item');
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessModalOpen(false);
    // Use window.location to ensure clean URL without query params
    window.location.href = `/quotes/${quoteId}#items`;
  };

  const handleErrorClose = () => {
    setErrorModalOpen(false);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <ItemForm quoteId={quoteId} onSubmit={handleSubmit} loading={loading} />

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
              Item successfully added to quote
            </p>
          </div>
        </ModalContent>
        <ModalActions>
          <Button onClick={handleSuccessClose}>Back to Quote</Button>
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
              Failed to create item
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
