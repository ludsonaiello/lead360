/**
 * Edit Quote Item Page
 * Full page form for editing existing quote items
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ItemForm } from '@/components/quotes/ItemForm';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { getQuoteItemById, updateQuoteItem } from '@/lib/api/quote-items';
import { CheckCircle, XCircle } from 'lucide-react';
import type { QuoteItem, UpdateQuoteItemDto } from '@/lib/types/quotes';

export default function EditQuoteItemPage() {
  const router = useRouter();
  const params = useParams();
  const quoteId = params.id as string;
  const itemId = params.itemId as string;

  const [item, setItem] = useState<QuoteItem | null>(null);
  const [loadingItem, setLoadingItem] = useState(true);
  const [loading, setLoading] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Load existing item
  useEffect(() => {
    const loadItem = async () => {
      try {
        setLoadingItem(true);
        const data = await getQuoteItemById(quoteId, itemId);
        setItem(data);
      } catch (err: any) {
        console.error('Failed to load item:', err);
        setErrorMessage(err.response?.data?.message || err.message || 'Failed to load item');
        setErrorModalOpen(true);
      } finally {
        setLoadingItem(false);
      }
    };

    loadItem();
  }, [quoteId, itemId]);

  const handleSubmit = async (data: UpdateQuoteItemDto) => {
    try {
      setLoading(true);
      await updateQuoteItem(quoteId, itemId, data);
      setSuccessModalOpen(true);
    } catch (err: any) {
      console.error('Failed to update item:', err);
      setErrorMessage(err.response?.data?.message || err.message || 'Failed to update item');
      setErrorModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessModalOpen(false);
    // Use replace to avoid keeping query params from history
    window.location.href = `/quotes/${quoteId}#items`;
  };

  const handleErrorClose = () => {
    setErrorModalOpen(false);

    // If error occurred during initial load, go back
    if (!item) {
      window.location.href = `/quotes/${quoteId}#items`;
    }
  };

  if (loadingItem) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
        </div>
      </div>
    );
  }

  if (!item) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <ItemForm quoteId={quoteId} item={item} onSubmit={handleSubmit} loading={loading} />

      {/* Success Modal */}
      <Modal
        isOpen={successModalOpen}
        onClose={handleSuccessClose}
        title="Changes Saved"
        size="sm"
      >
        <ModalContent>
          <div className="flex flex-col items-center text-center py-4">
            <CheckCircle className="w-16 h-16 text-green-500 dark:text-green-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Item successfully updated
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
              {item ? 'Failed to update item' : 'Failed to load item'}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{errorMessage}</p>
          </div>
        </ModalContent>
        <ModalActions>
          <Button variant="secondary" onClick={handleErrorClose}>
            {item ? 'Close' : 'Back to Quote'}
          </Button>
        </ModalActions>
      </Modal>
    </div>
  );
}
