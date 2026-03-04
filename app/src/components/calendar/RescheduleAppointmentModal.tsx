/**
 * RescheduleAppointmentModal Component
 * Modal for rescheduling appointments with new date/time selection
 * Sprint 36: reschedule_flow (Enhanced with availability slots)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  Calendar as CalendarIcon,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import calendarApi from '@/lib/api/calendar';
import type {
  AppointmentWithRelations,
  AvailabilityResponse,
  AvailabilityDate,
  AvailabilitySlot,
} from '@/lib/types/calendar';

// ============================================================================
// Validation Schema
// ============================================================================

const rescheduleAppointmentSchema = z.object({
  new_scheduled_date: z
    .string()
    .min(1, 'Date is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine(
      (date) => {
        // Validate that date is not in the past
        const selected = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return selected >= today;
      },
      {
        message: 'Date cannot be in the past',
      }
    ),
  new_start_time: z
    .string()
    .min(1, 'Start time is required')
    .regex(/^\d{2}:\d{2}$/, 'Time must be in HH:mm format'),
  reason: z.string().max(500, 'Reason must be less than 500 characters').optional(),
});

type RescheduleAppointmentFormData = z.infer<typeof rescheduleAppointmentSchema>;

// ============================================================================
// Component Props
// ============================================================================

interface RescheduleAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: AppointmentWithRelations;
  onSuccess?: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatShortDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const getTomorrowDate = (): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
};

const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

const getDatePlusWeeks = (weeks: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + weeks * 7);
  return date.toISOString().split('T')[0];
};

// ============================================================================
// Main Component
// ============================================================================

export default function RescheduleAppointmentModal({
  isOpen,
  onClose,
  appointment,
  onSuccess,
}: RescheduleAppointmentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [newAppointmentDetails, setNewAppointmentDetails] = useState<{
    date: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  // Availability state
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [selectedAvailableDate, setSelectedAvailableDate] = useState<string | null>(null);

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
  } = useForm<RescheduleAppointmentFormData>({
    resolver: zodResolver(rescheduleAppointmentSchema),
    defaultValues: {
      new_scheduled_date: getTomorrowDate(),
      new_start_time: appointment.start_time,
      reason: '',
    },
  });

  // ============================================================================
  // Fetch Availability
  // ============================================================================

  useEffect(() => {
    const fetchAvailability = async () => {
      if (!isOpen || !appointment.appointment_type_id) {
        return;
      }

      setLoadingAvailability(true);
      setAvailabilityError(null);

      try {
        const dateFrom = getTodayDate();
        const dateTo = getDatePlusWeeks(appointment.appointment_type?.max_lookahead_weeks || 4);

        const availabilityData = await calendarApi.getAvailability({
          appointment_type_id: appointment.appointment_type_id,
          date_from: dateFrom,
          date_to: dateTo,
        });

        setAvailability(availabilityData);

        // Auto-select first available date if exists
        if (availabilityData.available_dates.length > 0) {
          setSelectedAvailableDate(availabilityData.available_dates[0].date);
        }
      } catch (error: any) {
        console.error('Failed to fetch availability:', error);
        setAvailabilityError('Unable to load available time slots');
        // Don't show error toast - user can still use manual input
      } finally {
        setLoadingAvailability(false);
      }
    };

    fetchAvailability();
  }, [isOpen, appointment.appointment_type_id, appointment.appointment_type?.max_lookahead_weeks]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      reset({
        new_scheduled_date: getTomorrowDate(),
        new_start_time: appointment.start_time,
        reason: '',
      });
      setShowSuccessMessage(false);
      setNewAppointmentDetails(null);
      setSelectedAvailableDate(null);
    }
  }, [isOpen, reset, appointment.start_time]);

  // ============================================================================
  // Form Handlers
  // ============================================================================

  const onSubmit = async (data: RescheduleAppointmentFormData) => {
    setIsSubmitting(true);
    try {
      const response = await calendarApi.rescheduleAppointment(appointment.id, {
        new_scheduled_date: data.new_scheduled_date,
        new_start_time: data.new_start_time,
        reason: data.reason?.trim() || undefined,
      });

      // Debug: Log the response structure
      console.log('[RescheduleModal] API Response:', {
        hasResponse: !!response,
        responseType: typeof response,
        hasNewAppointment: !!response?.newAppointment,
        hasOldAppointment: !!response?.oldAppointment,
        keys: response ? Object.keys(response) : [],
        fullResponse: response,
      });

      // Validate response structure
      if (!response || !response.newAppointment) {
        console.error('[RescheduleModal] Invalid response structure:', response);
        throw new Error('Invalid response from server - missing new appointment data');
      }

      // Store new appointment details for success message
      setNewAppointmentDetails({
        date: response.newAppointment.scheduled_date,
        startTime: response.newAppointment.start_time,
        endTime: response.newAppointment.end_time,
      });

      setShowSuccessMessage(true);
      toast.success('Appointment rescheduled successfully');

      // Wait 2 seconds before closing to show success message
      setTimeout(() => {
        reset();
        onSuccess?.();
      }, 2000);
    } catch (error: any) {
      console.error('Failed to reschedule appointment:', error);
      const errorMessage =
        error.response?.data?.message || error.message || 'Failed to reschedule appointment';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !showSuccessMessage) {
      reset();
      onClose();
    }
  };

  const handleSlotClick = (date: string, slot: AvailabilitySlot) => {
    setValue('new_scheduled_date', date, { shouldValidate: true });
    setValue('new_start_time', slot.start_time, { shouldValidate: true });
    toast.success(`Selected ${formatShortDate(date)} at ${slot.start_time}`);
  };

  const leadFullName = appointment.lead
    ? `${appointment.lead.first_name} ${appointment.lead.last_name}`
    : 'Unknown';

  const watchedDate = watch('new_scheduled_date');
  const watchedTime = watch('new_start_time');

  // Calculate end time based on appointment type duration
  const calculateEndTime = (startTime: string): string => {
    if (!appointment.appointment_type?.slot_duration_minutes) {
      return startTime;
    }

    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + appointment.appointment_type.slot_duration_minutes;
    const endHours = Math.floor(totalMinutes / 60);
    const endMinutes = totalMinutes % 60;

    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  const estimatedEndTime = watchedTime ? calculateEndTime(watchedTime) : '';

  // Get selected date's available slots
  const selectedDateSlots =
    availability?.available_dates.find((d) => d.date === selectedAvailableDate)?.slots || [];

  // ============================================================================
  // Render
  // ============================================================================

  // Success state
  if (showSuccessMessage && newAppointmentDetails) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} size="md">
        <div className="space-y-5 text-center py-4">
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
          </div>

          {/* Success Message */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Appointment Rescheduled!
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              The appointment has been successfully rescheduled to:
            </p>
          </div>

          {/* New Appointment Details */}
          <div className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-center gap-2 text-gray-900 dark:text-gray-100 font-semibold">
                <CalendarIcon className="w-4 h-4" />
                {formatDate(newAppointmentDetails.date)}
              </div>
              <div className="flex items-center justify-center gap-2 text-gray-900 dark:text-gray-100 font-semibold">
                <Clock className="w-4 h-4" />
                {newAppointmentDetails.startTime} - {newAppointmentDetails.endTime}
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400">Closing automatically...</p>
        </div>
      </Modal>
    );
  }

  // Main reschedule form
  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <CalendarIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
              Reschedule Appointment
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Select a new date and time for this appointment
            </p>
          </div>
        </div>

        {/* Current Appointment Info */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
            Current Appointment
          </div>
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
              <span className="text-gray-600 dark:text-gray-400">Current Date:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {new Date(appointment.scheduled_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">Current Time:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {appointment.start_time} - {appointment.end_time}
              </span>
            </div>
          </div>
        </div>

        {/* Available Slots Section */}
        {loadingAvailability ? (
          <div className="p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center justify-center gap-3 text-blue-600 dark:text-blue-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm font-medium">Loading available time slots...</span>
            </div>
          </div>
        ) : availability && availability.available_dates.length > 0 ? (
          <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                Suggested Available Times
              </h4>
            </div>

            {/* Available Dates List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {availability.available_dates.map((availableDate) => (
                <div
                  key={availableDate.date}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                >
                  {/* Date Header */}
                  <button
                    type="button"
                    onClick={() => setSelectedAvailableDate(availableDate.date)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {formatShortDate(availableDate.date)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({availableDate.slots.length} slots)
                      </span>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 text-gray-400 transition-transform ${
                        selectedAvailableDate === availableDate.date ? 'rotate-90' : ''
                      }`}
                    />
                  </button>

                  {/* Time Slots (show if selected) */}
                  {selectedAvailableDate === availableDate.date && (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {availableDate.slots.map((slot, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSlotClick(availableDate.date, slot)}
                          className="px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 border border-blue-300 dark:border-blue-700 rounded-lg transition-colors"
                        >
                          {slot.start_time}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-3 text-xs text-gray-600 dark:text-gray-400 text-center">
              Click a time slot to select it, or use manual entry below
            </p>
          </div>
        ) : availabilityError ? (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  {availabilityError}
                </p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                  You can still manually select a date and time below
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  No available slots found in the next{' '}
                  {appointment.appointment_type?.max_lookahead_weeks || 4} weeks
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Please manually select a date and time below
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Manual Date/Time Selection */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <Clock className="w-4 h-4" />
            Manual Date & Time Selection
          </div>

          {/* New Date Selection */}
          <div>
            <label
              htmlFor="new_scheduled_date"
              className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2"
            >
              <CalendarIcon className="w-4 h-4 inline mr-1.5" />
              New Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              id="new_scheduled_date"
              {...register('new_scheduled_date')}
              disabled={isSubmitting}
              min={getTodayDate()}
              className={`w-full px-4 py-3 border-2 rounded-lg text-base
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
              ${
                errors.new_scheduled_date
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {errors.new_scheduled_date && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.new_scheduled_date.message}
              </p>
            )}
            {watchedDate && (
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                {formatDate(watchedDate)}
              </p>
            )}
          </div>

          {/* New Time Selection */}
          <div>
            <label
              htmlFor="new_start_time"
              className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2"
            >
              <Clock className="w-4 h-4 inline mr-1.5" />
              New Start Time <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              id="new_start_time"
              {...register('new_start_time')}
              disabled={isSubmitting}
              className={`w-full px-4 py-3 border-2 rounded-lg text-base
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
              ${
                errors.new_start_time
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            />
            {errors.new_start_time && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.new_start_time.message}
              </p>
            )}
            {watchedTime && appointment.appointment_type && (
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                Estimated end time: {estimatedEndTime} (
                {appointment.appointment_type.slot_duration_minutes} minutes)
              </p>
            )}
          </div>
        </div>

        {/* Reason (Optional) */}
        <div>
          <label
            htmlFor="reason"
            className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2"
          >
            Reason for Rescheduling{' '}
            <span className="text-xs font-normal text-gray-500">(Optional)</span>
          </label>
          <textarea
            id="reason"
            {...register('reason')}
            disabled={isSubmitting}
            placeholder="E.g., Customer requested different time, scheduling conflict resolved..."
            rows={3}
            maxLength={500}
            className={`w-full px-4 py-3 border-2 rounded-lg text-base
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
              ${
                errors.reason
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
          />
          {errors.reason && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.reason.message}</p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {watch('reason')?.length || 0} / 500 characters
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
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting} className="flex-1">
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Rescheduling...
              </>
            ) : (
              <>
                <CalendarIcon className="w-4 h-4" />
                Reschedule Appointment
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
