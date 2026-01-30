/**
 * GroupFormModal Component
 * Modal for creating/editing quote groups (2 fields - simple form)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Modal, ModalActions, ModalContent } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AlertCircle } from 'lucide-react';
import type { QuoteGroup } from '@/lib/types/quotes';

interface GroupFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string }) => Promise<void>;
  group?: QuoteGroup; // undefined = create, defined = edit
  loading?: boolean;
}

export function GroupFormModal({
  isOpen,
  onClose,
  onSubmit,
  group,
  loading = false,
}: GroupFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{ name?: string }>({});

  const isEdit = !!group;

  useEffect(() => {
    if (group) {
      setName(group.name);
      setDescription(group.description || '');
    } else {
      setName('');
      setDescription('');
    }
    setErrors({});
  }, [group, isOpen]);

  const validate = (): boolean => {
    const newErrors: { name?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Group name is required';
    } else if (name.length > 200) {
      newErrors.name = 'Group name must be 200 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err) {
      // Error handled by parent
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEdit ? 'Edit Group' : 'Create Group'}
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-4">
            <Input
              label="Group Name"
              placeholder="e.g., Flooring, Electrical, Plumbing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              required
              disabled={loading}
              autoFocus
            />

            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Description (Optional)
              </label>
              <textarea
                rows={3}
                className="w-full px-4 py-3 border-2 rounded-lg text-gray-900 dark:text-gray-100 font-medium bg-white dark:bg-gray-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="Optional details about this group"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        </ModalContent>

        <ModalActions>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEdit ? 'Save Changes' : 'Create Group'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
