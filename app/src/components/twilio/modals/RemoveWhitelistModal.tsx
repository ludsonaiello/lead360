/**
 * Remove from Whitelist Confirmation Modal
 * Allows Owner/Admin to remove a phone number from office bypass whitelist
 * This is a soft delete - status is set to inactive, data is retained for audit
 */

'use client';

import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';

import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';

import { removeFromWhitelist } from '@/lib/api/twilio-tenant';
import type { OfficeWhitelistEntry } from '@/lib/types/twilio-tenant';

interface RemoveWhitelistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  entry: OfficeWhitelistEntry | null;
}

export function RemoveWhitelistModal({
  isOpen,
  onClose,
  onSuccess,
  entry,
}: RemoveWhitelistModalProps) {
  const [loading, setLoading] = useState(false);

  // Format phone number for display (from +19781234567 to +1 (978) 123-4567)
  const formatPhoneNumber = (phone: string): string => {
    if (!phone) return '';

    // Remove + prefix
    const cleaned = phone.replace('+', '');

    // US/Canada format: +1 (XXX) XXX-XXXX
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }

    // Default: just add + back
    return `+${cleaned}`;
  };

  const handleRemove = async () => {
    if (!entry) return;

    try {
      setLoading(true);

      await removeFromWhitelist(entry.id);

      toast.success('Whitelist entry deleted permanently');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error deleting from whitelist:', error);

      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to delete entry');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalContent
        title="Delete Whitelist Entry?"
        description="This will permanently delete this entry from the whitelist. This action cannot be undone."
        icon={<AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />}
      >
        <div className="space-y-4">
          {/* Entry Details */}
          {entry && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-md p-4 space-y-2">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Phone Number
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {formatPhoneNumber(entry.phone_number)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Label
                </p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {entry.label}
                </p>
              </div>
            </div>
          )}

          {/* Warning Message */}
          <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-800 dark:text-red-300">
            <p className="font-medium mb-1">⚠️ Warning: This action is permanent!</p>
            <ul className="list-disc list-inside space-y-1 text-xs ml-2">
              <li>Entry will be completely removed from the database</li>
              <li>This action cannot be undone</li>
              <li>To temporarily disable, use the &quot;Deactivate&quot; button instead</li>
              <li>You will need to re-add this number if deleted by mistake</li>
            </ul>
          </div>
        </div>
      </ModalContent>

      <ModalActions>
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={handleRemove}
          loading={loading}
        >
          Delete Permanently
        </Button>
      </ModalActions>
    </Modal>
  );
}
