/**
 * CancelAppointmentModal Component
 * Modal for cancelling appointments with reason selection
 * Sprint 35: appointment_detail_cancel
 */

'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import calendarApi from '@/lib/api/calendar';
import type { AppointmentWithRelations } from '@/lib/types/calendar';

// ============================================================================
// Validation Schema
// ============================================================================

const cancelAppointmentSchema = z
  .object({
    cancellation_reason: z.enum(
      ['customer_cancelled', 'business_cancelled', 'no_show', 'rescheduled', 'other'],
      {
        required_error: 'Please select a cancellation reason',
      }
    ),
    cancellation_notes: z.string().max(1000, 'Notes must be less than 1000 characters').optional(),
  })
  .refine(
    (data) => {
      // If reason is "other", notes are required
      if (data.cancellation_reason === 'other') {
        return data.cancellation_notes && data.cancellation_notes.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Notes are required when cancellation reason is "Other"',
      path: ['cancellation_notes'],
    }
  );

type CancelAppointmentFormData = z.infer<typeof cancelAppointmentSchema>;

// ============================================================================
// Component Props
// ============================================================================

interface CancelAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AppointmentWithRelations;
  onSuccess?: () => void;
}

// ============================================================================
// Cancellation Reason Options
// ============================================================================

const cancellationReasonOptions = [
  { value: 'customer_cancelled', label: 'Customer Cancelled' },
  { value: 'business_cancelled', label: 'Business Cancelled' },
  { value: 'no_show', label: 'No Show' },
  { value: 'rescheduled', label: 'Rescheduled' },
  { value: 'other', label: 'Other' },
];

// ============================================================================
// Main Component
// ============================================================================

export default function CancelAppointmentModal({
  isOpen,
  onClose,
  appointment,
  onSuccess,
}: CancelAppointmentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ============================================================================
  // Form Setup
  // ============================================================================

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<CancelAppointmentFormData>({
    resolver: zodResolver(cancelAppointmentSchema),
    defaultValues: {
      cancellation_reason: undefined,
      cancellation_notes: '',
    },
  });

  const watchedReason = watch('cancellation_reason');
  const isReasonOther = watchedReason === 'other';

  // ============================================================================
  // Form Handlers
  // ============================================================================

  const onSubmit = async (data: CancelAppointmentFormData) => {
    setIsSubmitting(true);
    try {
      await calendarApi.cancelAppointment(appointment.id, {
        cancellation_reason: data.cancellation_reason,
        cancellation_notes: data.cancellation_notes?.trim() || undefined,
      });

      toast.success('Appointment cancelled successfully');
      reset();
      onSuccess?.();
    } catch (error: any) {
      console.error('Failed to cancel appointment:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'Failed to cancel appointment';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      reset();
      onClose();
    }
  };

  const leadFullName = appointment.lead
    ? `${appointment.lead.first_name} ${appointment.lead.last_name}`
    : 'Unknown';

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
              Cancel Appointment
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to cancel this appointment?
            </p>
          </div>
        </div>

        {/* Appointment Info */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Customer:</span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">{leadFullName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Type:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {appointment.appointment_type?.name || 'Appointment'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Date:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {new Date(appointment.scheduled_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Time:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {appointment.start_time} - {appointment.end_time}
              </span>
            </div>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            This action cannot be undone. The appointment status will be changed to "Cancelled" and the
            linked service request will be reset to "New" status.
          </p>
        </div>

        {/* Cancellation Reason */}
        <div>
          <label
            htmlFor="cancellation_reason"
            className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2"
          >
            Cancellation Reason <span className="text-red-500">*</span>
          </label>
          <select
            id="cancellation_reason"
            {...register('cancellation_reason')}
            disabled={isSubmitting}
            className={`w-full px-3 py-3 border-2 rounded-lg
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              focus:outline-none focus:ring-2 focus:ring-red-500
              disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
              ${
                errors.cancellation_reason
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
          >
            <option value="">Select a reason...</option>
            {cancellationReasonOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.cancellation_reason && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.cancellation_reason.message}
            </p>
          )}
        </div>

        {/* Cancellation Notes */}
        <div>
          <label
            htmlFor="cancellation_notes"
            className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2"
          >
            Additional Notes {isReasonOther && <span className="text-red-500">*</span>}
            {isReasonOther && <span className="text-xs font-normal text-gray-500">(Required)</span>}
          </label>
          <textarea
            id="cancellation_notes"
            {...register('cancellation_notes')}
            disabled={isSubmitting}
            placeholder={
              isReasonOther
                ? 'Please provide details about the cancellation...'
                : 'Add any additional details about the cancellation (optional)...'
            }
            rows={4}
            maxLength={1000}
            className={`w-full px-3 py-3 border-2 rounded-lg
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              focus:outline-none focus:ring-2 focus:ring-red-500
              disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
              ${
                errors.cancellation_notes
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
          />
          {errors.cancellation_notes && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.cancellation_notes.message}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {watch('cancellation_notes')?.length || 0} / 1000 characters
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1"
          >
            Keep Appointment
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={isSubmitting}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4" />
                Cancel Appointment
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
