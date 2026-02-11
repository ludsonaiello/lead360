/**
 * WebhookEventDetailModal Component
 * Modal for viewing webhook event details
 */

'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { WebhookEvent } from '@/lib/types/twilio-admin';
import { format } from 'date-fns';

export interface WebhookEventDetailModalProps {
  open: boolean;
  onClose: () => void;
  event: WebhookEvent | null;
}

export function WebhookEventDetailModal({
  open,
  onClose,
  event
}: WebhookEventDetailModalProps) {
  if (!event) return null;

  const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' => {
    switch (status) {
      case 'processed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'danger';
      default:
        return 'warning';
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} size="lg">
      <ModalContent title="Webhook Event Details">
        <div className="space-y-6">
          {/* Event Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Event ID
              </p>
              <p className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                {event.id}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Type
              </p>
              <p className="text-sm text-gray-900 dark:text-gray-100 capitalize">
                {event.webhook_type}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Status
              </p>
              <Badge variant={getStatusVariant(event.status)}>
                {event.status}
              </Badge>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Processing Attempts
              </p>
              <p className="text-sm text-gray-900 dark:text-gray-100">
                {event.processing_attempts}
              </p>
            </div>
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Created At
              </p>
              <p className="text-sm text-gray-900 dark:text-gray-100">
                {format(new Date(event.created_at), 'PPpp')}
              </p>
            </div>
            {event.processed_at && (
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Processed At
                </p>
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  {format(new Date(event.processed_at), 'PPpp')}
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {event.last_error && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                Error Message
              </p>
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200 font-mono">
                  {event.last_error}
                </p>
              </div>
            </div>
          )}

          {/* Payload */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Webhook Payload
            </p>
            <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-h-96 overflow-auto">
              <pre className="text-xs font-mono text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-all">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </ModalContent>

      <ModalActions>
        <Button onClick={onClose} variant="outline">
          Close
        </Button>
      </ModalActions>
    </Modal>
  );
}
