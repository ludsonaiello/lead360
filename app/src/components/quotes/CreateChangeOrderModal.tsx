/**
 * Create Change Order Modal Component
 * Modal for creating change orders on approved quotes
 * Creates a new child quote - items are added separately after creation
 */

'use client';

import React, { useState } from 'react';
import { FileText, AlertCircle, ArrowRight } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { createChangeOrder } from '@/lib/api/change-orders';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface CreateChangeOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentQuoteId: string;
  onCreated: () => void;
}

export function CreateChangeOrderModal({
  isOpen,
  onClose,
  parentQuoteId,
  onCreated,
}: CreateChangeOrderModalProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});

  // Validate form
  const validate = (): boolean => {
    const newErrors: { title?: string; description?: string } = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    } else if (title.trim().length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle create
  const handleCreate = async () => {
    if (!validate()) return;

    setLoading(true);

    try {
      const response = await createChangeOrder(parentQuoteId, {
        title: title.trim(),
        description: description.trim() || undefined,
      });

      toast.success(response.message || 'Change order has been created');

      // Navigate to the child quote to add items
      router.push(`/quotes/${response.child_quote.id}`);

      handleClose();
      onCreated();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create change order');
    } finally {
      setLoading(false);
    }
  };

  // Handle close
  const handleClose = () => {
    if (!loading) {
      setTitle('');
      setDescription('');
      setErrors({});
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalContent
        icon={<FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
        title="Create Change Order"
        description="Create a change order for this approved quote"
      >
        {/* Info Message */}
        <div className="flex items-start gap-3 mb-6 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
              How Change Orders Work
            </p>
            <ul className="text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
              <li>A new child quote will be created for the changes</li>
              <li>Add/remove items on the child quote after creation</li>
              <li>Approve the change order to merge changes into parent quote</li>
              <li>All changes are tracked and audited</li>
            </ul>
          </div>
        </div>

        {/* Title Field */}
        <div className="mb-4">
          <Input
            label="Change Order Title *"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors({ ...errors, title: undefined });
            }}
            placeholder="Additional tile work, Change in scope, etc."
            required
            error={errors.title}
          />
        </div>

        {/* Description Field */}
        <div className="mb-4">
          <Textarea
            label="Description (Optional)"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (errors.description) setErrors({ ...errors, description: undefined });
            }}
            placeholder="Customer requested additional tile in bathroom, expanding project scope..."
            rows={3}
            error={errors.description}
          />
        </div>

        {/* Next Steps Info */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-3">
            <ArrowRight className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Next Steps
              </p>
              <p className="text-gray-700 dark:text-gray-300">
                After creating the change order, you'll be redirected to the child quote where you can add items, adjust quantities, and configure the changes needed.
              </p>
            </div>
          </div>
        </div>
      </ModalContent>

      <ModalActions>
        <Button variant="ghost" onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleCreate}
          loading={loading}
          disabled={loading || !title.trim()}
        >
          <FileText className="w-4 h-4" />
          Create Change Order
        </Button>
      </ModalActions>
    </Modal>
  );
}

export default CreateChangeOrderModal;
