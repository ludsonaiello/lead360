/**
 * CustomHoursFormModal Component
 * Modal form for creating/editing custom hours (holidays, special dates)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';
import { Plus, X, Clock, AlertCircle } from 'lucide-react';
import { customHoursSchema, type CustomHoursFormData } from '@/lib/utils/validation';
import { tenantApi } from '@/lib/api/tenant';
import { CustomHours, CreateCustomHoursData, UpdateCustomHoursData } from '@/lib/types/tenant';
import Modal, { ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { TimePicker } from '@/components/ui/TimePicker';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';

// Helper to extract date from datetime string
const extractDate = (datetime: string | null | undefined): string => {
  if (!datetime) return '';
  return datetime.split('T')[0];
};

interface CustomHoursFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customHours?: CustomHours | null;
}

export function CustomHoursFormModal({
  isOpen,
  onClose,
  onSuccess,
  customHours,
}: CustomHoursFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasBreak, setHasBreak] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<CustomHoursFormData>({
    resolver: zodResolver(customHoursSchema),
    defaultValues: {
      date: extractDate(customHours?.date),
      reason: customHours?.reason || '',
      closed: customHours?.closed || false,
      open_time1: customHours?.open_time1 || null,
      close_time1: customHours?.close_time1 || null,
      open_time2: customHours?.open_time2 || null,
      close_time2: customHours?.close_time2 || null,
    },
  });

  // Reset form when customHours changes
  useEffect(() => {
    // Clear API error when modal opens/closes or customHours changes
    setApiError(null);

    if (customHours) {
      reset({
        date: extractDate(customHours.date),
        reason: customHours.reason,
        closed: customHours.closed,
        open_time1: customHours.open_time1,
        close_time1: customHours.close_time1,
        open_time2: customHours.open_time2,
        close_time2: customHours.close_time2,
      });
      setHasBreak(!!(customHours.open_time2 && customHours.close_time2));
    } else {
      reset({
        date: '',
        reason: '',
        closed: false,
        open_time1: null,
        close_time1: null,
        open_time2: null,
        close_time2: null,
      });
      setHasBreak(false);
    }
  }, [customHours, reset]);

  const onSubmit = async (data: CustomHoursFormData) => {
    try {
      setIsSubmitting(true);
      setApiError(null); // Clear any previous errors

      if (customHours) {
        // Update existing custom hours
        const updateData: UpdateCustomHoursData = {
          date: data.date,
          reason: data.reason,
          closed: data.closed,
          open_time1: data.closed ? null : data.open_time1 || null,
          close_time1: data.closed ? null : data.close_time1 || null,
          open_time2: data.closed || !hasBreak ? null : data.open_time2 || null,
          close_time2: data.closed || !hasBreak ? null : data.close_time2 || null,
        };
        await tenantApi.updateCustomHours(customHours.id, updateData);
        toast.success('Custom hours updated successfully');
      } else {
        // Create new custom hours
        const createData: CreateCustomHoursData = {
          date: data.date,
          reason: data.reason,
          closed: data.closed,
          open_time1: data.closed ? undefined : data.open_time1 || undefined,
          close_time1: data.closed ? undefined : data.close_time1 || undefined,
          open_time2: data.closed || !hasBreak ? undefined : data.open_time2 || undefined,
          close_time2: data.closed || !hasBreak ? undefined : data.close_time2 || undefined,
        };
        await tenantApi.createCustomHours(createData);
        toast.success('Custom hours created successfully');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Custom hours save error:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to save custom hours';
      setApiError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isClosed = watch('closed');

  const handleAddBreak = () => {
    setHasBreak(true);
  };

  const handleRemoveBreak = () => {
    setValue('open_time2', null);
    setValue('close_time2', null);
    setHasBreak(false);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={customHours ? 'Edit Custom Hours' : 'Add Custom Hours'}
      size="xl"
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <ModalContent>
          <div className="space-y-6">
            {/* Date and Label */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <DatePicker
                {...register('date')}
                label="Date"
                error={errors.date?.message}
                required
              />

              <Input
                {...register('reason')}
                label="Reason"
                error={errors.reason?.message}
                placeholder="e.g., Christmas, Thanksgiving"
                required
              />
            </div>

            {/* Closed Toggle */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <ToggleSwitch
                label="Closed"
                enabled={isClosed}
                onChange={(checked) => setValue('closed', checked)}
              />
            </div>

            {/* Hours (only if not closed) */}
            {!isClosed && (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Operating Hours
                </h4>

                {/* First time slot */}
                <div className="flex items-center gap-4">
                  <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  <div className="flex items-center gap-3 flex-1">
                    <TimePicker
                      {...register('open_time1')}
                      label="Open"
                      error={errors.open_time1?.message}
                      className="flex-1"
                    />
                    <span className="text-gray-500 dark:text-gray-400 mt-6">to</span>
                    <TimePicker
                      {...register('close_time1')}
                      label="Close"
                      error={errors.close_time1?.message}
                      className="flex-1"
                    />
                  </div>
                </div>

                {/* Second time slot (break) */}
                {hasBreak ? (
                  <div className="flex items-center gap-4">
                    <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <div className="flex items-center gap-3 flex-1">
                      <TimePicker
                        {...register('open_time2')}
                        label="Reopen"
                        error={errors.open_time2?.message}
                        className="flex-1"
                      />
                      <span className="text-gray-500 dark:text-gray-400 mt-6">to</span>
                      <TimePicker
                        {...register('close_time2')}
                        label="Close"
                        error={errors.close_time2?.message}
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveBreak}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors flex-shrink-0 mt-6"
                        title="Remove break"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleAddBreak}
                    className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add lunch break
                  </button>
                )}
              </div>
            )}
          </div>
        </ModalContent>

        {/* API Error Display */}
        {apiError && (
          <div className="mx-6 mt-6 mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">Error</p>
                <p className="text-sm text-red-700 dark:text-red-400">{apiError}</p>
              </div>
              <button
                type="button"
                onClick={() => setApiError(null)}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <ModalActions>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {isSubmitting
              ? 'Saving...'
              : customHours
              ? 'Update Custom Hours'
              : 'Add Custom Hours'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}

export default CustomHoursFormModal;
