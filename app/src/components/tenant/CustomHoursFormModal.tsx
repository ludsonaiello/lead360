/**
 * CustomHoursFormModal Component
 * Modal form for creating/editing custom hours (holidays, special dates)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';
import { Plus, X, Clock } from 'lucide-react';
import { customHoursSchema, type CustomHoursFormData } from '@/lib/utils/validation';
import { tenantApi } from '@/lib/api/tenant';
import { CustomHours, CreateCustomHoursData, UpdateCustomHoursData } from '@/lib/types/tenant';
import Modal, { ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { TimePicker } from '@/components/ui/TimePicker';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';

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
      date: customHours?.date || '',
      label: customHours?.label || '',
      is_closed: customHours?.is_closed || false,
      open1: customHours?.open1 || null,
      close1: customHours?.close1 || null,
      open2: customHours?.open2 || null,
      close2: customHours?.close2 || null,
    },
  });

  // Reset form when customHours changes
  useEffect(() => {
    if (customHours) {
      reset({
        date: customHours.date,
        label: customHours.label,
        is_closed: customHours.is_closed,
        open1: customHours.open1,
        close1: customHours.close1,
        open2: customHours.open2,
        close2: customHours.close2,
      });
      setHasBreak(!!(customHours.open2 && customHours.close2));
    } else {
      reset({
        date: '',
        label: '',
        is_closed: false,
        open1: null,
        close1: null,
        open2: null,
        close2: null,
      });
      setHasBreak(false);
    }
  }, [customHours, reset]);

  const onSubmit = async (data: CustomHoursFormData) => {
    try {
      setIsSubmitting(true);

      if (customHours) {
        // Update existing custom hours
        const updateData: UpdateCustomHoursData = {
          date: data.date,
          label: data.label,
          is_closed: data.is_closed,
          open1: data.is_closed ? null : data.open1 || null,
          close1: data.is_closed ? null : data.close1 || null,
          open2: data.is_closed || !hasBreak ? null : data.open2 || null,
          close2: data.is_closed || !hasBreak ? null : data.close2 || null,
        };
        await tenantApi.updateCustomHours(customHours.id, updateData);
        toast.success('Custom hours updated successfully');
      } else {
        // Create new custom hours
        const createData: CreateCustomHoursData = {
          date: data.date,
          label: data.label,
          is_closed: data.is_closed,
          open1: data.is_closed ? undefined : data.open1 || undefined,
          close1: data.is_closed ? undefined : data.close1 || undefined,
          open2: data.is_closed || !hasBreak ? undefined : data.open2 || undefined,
          close2: data.is_closed || !hasBreak ? undefined : data.close2 || undefined,
        };
        await tenantApi.createCustomHours(createData);
        toast.success('Custom hours created successfully');
      }

      onSuccess();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save custom hours');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isClosed = watch('is_closed');

  const handleAddBreak = () => {
    setHasBreak(true);
  };

  const handleRemoveBreak = () => {
    setValue('open2', null);
    setValue('close2', null);
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
                {...register('label')}
                label="Label"
                error={errors.label?.message}
                placeholder="e.g., Christmas, Thanksgiving"
                required
              />
            </div>

            {/* Closed Toggle */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <ToggleSwitch
                label="Closed all day"
                enabled={isClosed}
                onChange={(checked) => setValue('is_closed', checked)}
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
                      {...register('open1')}
                      label="Open"
                      error={errors.open1?.message}
                      className="flex-1"
                    />
                    <span className="text-gray-500 dark:text-gray-400 mt-6">to</span>
                    <TimePicker
                      {...register('close1')}
                      label="Close"
                      error={errors.close1?.message}
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
                        {...register('open2')}
                        label="Reopen"
                        error={errors.open2?.message}
                        className="flex-1"
                      />
                      <span className="text-gray-500 dark:text-gray-400 mt-6">to</span>
                      <TimePicker
                        {...register('close2')}
                        label="Close"
                        error={errors.close2?.message}
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
