// ============================================================================
// Delete Appointment Type Modal
// ============================================================================
// Confirmation modal for deleting (soft-delete) appointment types
// ============================================================================

'use client';

import { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import Button from '@/components/ui/Button';
import * as calendarApi from '@/lib/api/calendar';
import type { AppointmentTypeWithSchedules } from '@/lib/types/calendar';
import toast from 'react-hot-toast';

interface DeleteAppointmentTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  appointmentType: AppointmentTypeWithSchedules | null;
}

export default function DeleteAppointmentTypeModal({
  isOpen,
  onClose,
  onSuccess,
  appointmentType,
}: DeleteAppointmentTypeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!appointmentType) return;

    setLoading(true);
    setError(null);

    try {
      await calendarApi.deleteAppointmentType(appointmentType.id);
      toast.success('Appointment type deleted successfully');

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      console.error('[DeleteAppointmentTypeModal] Error:', err);

      // Extract error message (axios interceptor returns { message, data })
      const errorMessage =
        err?.message ||
        err?.data?.message ||
        'Failed to delete appointment type';

      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!appointmentType) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
          Delete Appointment Type
        </div>
      }
      size="md"
    >
      <ModalContent>
        <div className="space-y-4">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete{' '}
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {appointmentType.name}
            </span>
            ?
          </p>

          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-1">
                  Warning
                </h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  This appointment type will be deactivated and no longer available for booking.
                  {appointmentType.is_default && (
                    <>
                      {' '}
                      Since this is the default appointment type, you'll need to set a new default
                      after deletion.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
        </div>
      </ModalContent>

      <ModalActions>
        <Button type="button" onClick={onClose} variant="secondary" disabled={loading}>
          Cancel
        </Button>
        <Button type="button" onClick={handleDelete} variant="danger" loading={loading}>
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Appointment Type
        </Button>
      </ModalActions>
    </Modal>
  );
}
