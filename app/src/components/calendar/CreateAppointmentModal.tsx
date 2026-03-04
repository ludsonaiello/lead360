'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import LeadAutocomplete from '@/components/calendar/LeadAutocomplete';
import { DatePicker } from '@/components/ui/DatePicker';
import { Loader2, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import calendarApi from '@/lib/api/calendar';
import { getLeadById } from '@/lib/api/leads';
import type { Lead } from '@/lib/types/leads';
import type {
  AppointmentType,
  CreateAppointmentRequest,
  AvailabilitySlot,
  AvailabilityDate
} from '@/lib/types/calendar';

// ============================================================================
// Validation Schema
// ============================================================================

const createAppointmentSchema = z.object({
  appointment_type_id: z.string().uuid('Please select an appointment type'),
  lead: z.object({
    id: z.string().uuid(),
  }).nullable().refine((val) => val !== null, {
    message: 'Please select a lead',
  }),
  service_request_id: z.string().uuid().optional().or(z.literal('')),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  time_slot: z.string().min(1, 'Please select a time slot'),
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').optional(),
  assigned_user_id: z.string().uuid().optional().or(z.literal('')),
});

type CreateAppointmentFormData = z.infer<typeof createAppointmentSchema>;

// ============================================================================
// Service Request Type (simplified)
// ============================================================================

interface ServiceRequest {
  id: string;
  service_name: string;
  service_type: string;
  status: string;
}

// ============================================================================
// Component Props
// ============================================================================

interface CreateAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (appointmentId: string) => void;
  preselectedDate?: string; // YYYY-MM-DD format
  preselectedLead?: Lead;
}

// ============================================================================
// Main Component
// ============================================================================

export default function CreateAppointmentModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedDate,
  preselectedLead,
}: CreateAppointmentModalProps) {
  // ============================================================================
  // State
  // ============================================================================

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [loadingAppointmentTypes, setLoadingAppointmentTypes] = useState(false);
  const [loadingServiceRequests, setLoadingServiceRequests] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(preselectedLead || null);

  // Sprint 34: Availability slots
  const [availableSlots, setAvailableSlots] = useState<AvailabilityDate[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdAppointmentId, setCreatedAppointmentId] = useState<string | null>(null);

  // ============================================================================
  // Form Setup
  // ============================================================================

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<CreateAppointmentFormData>({
    resolver: zodResolver(createAppointmentSchema),
    defaultValues: {
      appointment_type_id: '',
      lead: preselectedLead || null,
      service_request_id: '',
      scheduled_date: preselectedDate || '',
      time_slot: '',
      notes: '',
      assigned_user_id: '',
    },
  });

  const watchedLead = watch('lead');
  const watchedAppointmentTypeId = watch('appointment_type_id');
  const watchedScheduledDate = watch('scheduled_date');

  // ============================================================================
  // Data Fetching Functions (must be defined before useEffects that use them)
  // ============================================================================

  // Sprint 34: Fetch available slots for selected date
  const fetchAvailableSlots = useCallback(async (appointmentTypeId: string, selectedDate: string) => {
    try {
      setLoadingSlots(true);

      // Fetch slots for selected date only (single day)
      const response = await calendarApi.getAvailability({
        appointment_type_id: appointmentTypeId,
        date_from: selectedDate,
        date_to: selectedDate,
      });

      setAvailableSlots(response.available_dates);

      // Reset slot selection when slots change
      setValue('time_slot', '');
    } catch (error: any) {
      console.error('Failed to fetch available slots:', error);
      toast.error('Failed to load available time slots');
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [setValue]);

  // ============================================================================
  // Effects
  // ============================================================================

  // Fetch appointment types on mount
  useEffect(() => {
    if (isOpen) {
      fetchAppointmentTypes();
    }
  }, [isOpen]);

  // Fetch service requests when lead changes
  useEffect(() => {
    if (watchedLead?.id) {
      setSelectedLead(watchedLead as unknown as Lead);
      fetchServiceRequests(watchedLead.id);
    } else {
      setSelectedLead(null);
      setServiceRequests([]);
    }
  }, [watchedLead]);

  // Sprint 34: Fetch available slots when appointment type or date changes
  useEffect(() => {
    if (watchedAppointmentTypeId && watchedScheduledDate) {
      fetchAvailableSlots(watchedAppointmentTypeId, watchedScheduledDate);
    } else {
      setAvailableSlots([]);
      setValue('time_slot', '');
    }
  }, [watchedAppointmentTypeId, watchedScheduledDate, fetchAvailableSlots, setValue]);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  const fetchAppointmentTypes = async () => {
    try {
      setLoadingAppointmentTypes(true);
      const response = await calendarApi.getAppointmentTypes({
        is_active: true,
        limit: 100,
        sort_by: 'name',
        sort_order: 'asc',
      });
      setAppointmentTypes(response.items);

      // Auto-select default appointment type if exists
      const defaultType = response.items.find((t) => t.is_default);
      if (defaultType && !watchedAppointmentTypeId) {
        setValue('appointment_type_id', defaultType.id);
      }
    } catch (error: any) {
      console.error('Failed to fetch appointment types:', error);
      toast.error('Failed to load appointment types');
    } finally {
      setLoadingAppointmentTypes(false);
    }
  };

  const fetchServiceRequests = async (leadId: string) => {
    try {
      setLoadingServiceRequests(true);
      // Fetch lead with all relations including service requests
      const lead = await getLeadById(leadId);

      // Extract service requests from lead (Lead type includes service_requests array)
      if (lead && lead.service_requests && lead.service_requests.length > 0) {
        // Map to match our ServiceRequest interface
        setServiceRequests(
          lead.service_requests.map((sr) => ({
            id: sr.id,
            service_name: sr.service_name,
            service_type: sr.service_type,
            status: sr.status,
          }))
        );
      } else {
        setServiceRequests([]);
      }
    } catch (error: any) {
      console.error('Failed to fetch service requests:', error);
      setServiceRequests([]);
    } finally {
      setLoadingServiceRequests(false);
    }
  };

  // ============================================================================
  // Helper Functions
  // ============================================================================

  const getTodayDate = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // ============================================================================
  // Form Handlers
  // ============================================================================

  const onSubmit = async (data: CreateAppointmentFormData) => {
    if (!data.lead) {
      toast.error('Please select a lead');
      return;
    }

    // Parse time slot (format: "HH:mm-HH:mm")
    const [start_time, end_time] = data.time_slot.split('-');
    if (!start_time || !end_time) {
      toast.error('Invalid time slot selected');
      return;
    }

    setIsSubmitting(true);
    try {
      const requestData: CreateAppointmentRequest = {
        appointment_type_id: data.appointment_type_id,
        lead_id: data.lead.id,
        scheduled_date: data.scheduled_date,
        start_time,
        end_time,
        source: 'manual',
      };

      // Add optional fields if provided
      if (data.service_request_id && data.service_request_id !== '') {
        requestData.service_request_id = data.service_request_id;
      }
      if (data.notes && data.notes.trim()) {
        requestData.notes = data.notes.trim();
      }
      if (data.assigned_user_id && data.assigned_user_id !== '') {
        requestData.assigned_user_id = data.assigned_user_id;
      }

      const appointment = await calendarApi.createAppointment(requestData);

      // Sprint 34: Show success modal instead of toast
      setCreatedAppointmentId(appointment.id);
      setShowSuccessModal(true);
    } catch (error: any) {
      console.error('Failed to create appointment:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to create appointment';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      reset();
      setSelectedLead(null);
      setServiceRequests([]);
      setAvailableSlots([]);
      onClose();
    }
  };

  const handleSuccessModalClose = () => {
    setShowSuccessModal(false);
    handleClose();
    if (createdAppointmentId) {
      onSuccess?.(createdAppointmentId);
    }
  };

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <>
      {/* Main Create Appointment Modal */}
      <Modal isOpen={isOpen} onClose={handleClose} title="Create Appointment" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Lead Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Lead <span className="text-red-500">*</span>
          </label>
          <Controller
            name="lead"
            control={control}
            render={({ field }) => (
              <LeadAutocomplete
                value={field.value as unknown as Lead}
                onChange={field.onChange}
                error={errors.lead?.message}
                disabled={isSubmitting}
              />
            )}
          />
        </div>

        {/* Appointment Type */}
        <div>
          <label htmlFor="appointment_type_id" className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Appointment Type <span className="text-red-500">*</span>
          </label>
          {loadingAppointmentTypes ? (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading appointment types...
            </div>
          ) : (
            <select
              id="appointment_type_id"
              {...register('appointment_type_id')}
              disabled={isSubmitting || loadingAppointmentTypes}
              className={`w-full px-3 py-3 border-2 rounded-lg
                bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                focus:outline-none focus:ring-2 focus:ring-blue-500
                disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
                ${errors.appointment_type_id
                  ? 'border-red-400 dark:border-red-500'
                  : 'border-gray-300 dark:border-gray-600'}`}
            >
              <option value="">Select appointment type</option>
              {appointmentTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name} ({type.slot_duration_minutes} min)
                </option>
              ))}
            </select>
          )}
          {errors.appointment_type_id && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.appointment_type_id.message}
            </p>
          )}
        </div>

        {/* Service Request (Optional) */}
        {selectedLead && (
          <div>
            <label htmlFor="service_request_id" className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Service Request (Optional)
            </label>
            {loadingServiceRequests ? (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading service requests...
              </div>
            ) : (
              <select
                id="service_request_id"
                {...register('service_request_id')}
                disabled={isSubmitting || loadingServiceRequests}
                className="w-full px-3 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                  focus:outline-none focus:ring-2 focus:ring-blue-500
                  disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
              >
                <option value="">No service request</option>
                {serviceRequests.map((sr) => (
                  <option key={sr.id} value={sr.id}>
                    {sr.service_name} - {sr.service_type}
                  </option>
                ))}
              </select>
            )}
            {serviceRequests.length === 0 && !loadingServiceRequests && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                No service requests found for this lead
              </p>
            )}
          </div>
        )}

        {/* Date and Time Slot Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Date Picker */}
          <div>
            <Controller
              name="scheduled_date"
              control={control}
              render={({ field }) => (
                <DatePicker
                  label="Date"
                  required
                  min={getTodayDate()}
                  error={errors.scheduled_date?.message}
                  disabled={isSubmitting}
                  {...field}
                />
              )}
            />
          </div>

          {/* Available Time Slots */}
          <div>
            <Controller
              name="time_slot"
              control={control}
              render={({ field }) => {
                // Generate slot options from available slots
                const slotOptions = availableSlots.flatMap((dateSlot) =>
                  dateSlot.slots.map((slot) => ({
                    value: `${slot.start_time}-${slot.end_time}`,
                    label: `${slot.start_time} - ${slot.end_time}`,
                  }))
                );

                return (
                  <Select
                    label="Available Time Slots"
                    required
                    options={slotOptions}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={
                      loadingSlots
                        ? 'Loading slots...'
                        : !watchedAppointmentTypeId
                        ? 'Select appointment type first'
                        : !watchedScheduledDate
                        ? 'Select a date first'
                        : slotOptions.length === 0
                        ? 'No slots available'
                        : 'Select a time slot'
                    }
                    disabled={
                      isSubmitting ||
                      loadingSlots ||
                      !watchedAppointmentTypeId ||
                      !watchedScheduledDate ||
                      slotOptions.length === 0
                    }
                    error={errors.time_slot?.message}
                  />
                );
              }}
            />
            {loadingSlots && (
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading available time slots...
              </div>
            )}
            {!loadingSlots && watchedScheduledDate && watchedAppointmentTypeId && availableSlots.length === 0 && (
              <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                No available time slots for this date. Please select a different date.
              </p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Notes (Optional)
          </label>
          <textarea
            id="notes"
            {...register('notes')}
            disabled={isSubmitting}
            placeholder="Add any notes or special instructions..."
            rows={3}
            maxLength={2000}
            className={`w-full px-3 py-3 border-2 rounded-lg
              bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
              focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
              ${errors.notes
                ? 'border-red-400 dark:border-red-500'
                : 'border-gray-300 dark:border-gray-600'}`}
          />
          {errors.notes && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {errors.notes.message}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            type="submit"
            disabled={isSubmitting || loadingAppointmentTypes}
            className="flex-1"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <CalendarIcon className="w-4 h-4" />
                Create Appointment
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Modal>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={handleSuccessModalClose}
        size="md"
        showCloseButton={false}
      >
        <div className="text-center py-6">
          {/* Success Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>

          {/* Success Message */}
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Appointment Created Successfully!
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
            The appointment has been added to your calendar. The customer will receive a confirmation if reminders are enabled.
          </p>

          {/* Action Button */}
          <Button onClick={handleSuccessModalClose} className="w-full">
            Done
          </Button>
        </div>
      </Modal>
    </>
  );
}
