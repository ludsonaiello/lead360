/**
 * BusinessHoursEditor Component
 * Manage weekly business hours with support for lunch breaks
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { Clock, Plus, X } from 'lucide-react';
import { tenantApi } from '@/lib/api/tenant';
import { BusinessHours, UpdateBusinessHoursData } from '@/lib/types/tenant';
import { Button } from '@/components/ui/Button';
import { TimePicker } from '@/components/ui/TimePicker';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

interface TimeError {
  open1?: string;
  close1?: string;
  open2?: string;
  close2?: string;
}

export function BusinessHoursEditor() {
  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasBreak, setHasBreak] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, TimeError>>({});

  const { register, handleSubmit, watch, setValue } = useForm<UpdateBusinessHoursData>();

  useEffect(() => {
    loadBusinessHours();
  }, []);

  // Validate times for a specific day
  const validateDay = (day: string, data: UpdateBusinessHoursData): TimeError => {
    const error: TimeError = {};
    const closedKey = `${day}_closed` as keyof UpdateBusinessHoursData;
    const open1Key = `${day}_open1` as keyof UpdateBusinessHoursData;
    const close1Key = `${day}_close1` as keyof UpdateBusinessHoursData;
    const open2Key = `${day}_open2` as keyof UpdateBusinessHoursData;
    const close2Key = `${day}_close2` as keyof UpdateBusinessHoursData;

    const isClosed = data[closedKey];
    const open1 = data[open1Key] as string | null;
    const close1 = data[close1Key] as string | null;
    const open2 = data[open2Key] as string | null;
    const close2 = data[close2Key] as string | null;

    // Skip validation if day is closed
    if (isClosed) return error;

    // Validate first period (open1 must be before close1)
    if (open1 && close1) {
      if (open1 >= close1) {
        error.open1 = 'Opening time must be before closing time';
        error.close1 = 'Closing time must be after opening time';
      }
    }

    // Validate second period if exists (lunch break scenario)
    if (open2 && close2) {
      // open2 must be before close2
      if (open2 >= close2) {
        error.open2 = 'Afternoon opening must be before afternoon closing';
        error.close2 = 'Afternoon closing must be after afternoon opening';
      }

      // close1 must be before open2 (lunch break must be after morning closes)
      if (close1 && close1 >= open2) {
        if (!error.close1) error.close1 = 'Morning closing must be before afternoon opening';
        if (!error.open2) error.open2 = 'Afternoon opening must be after morning closing';
      }

      // open1 must be before open2
      if (open1 && open1 >= open2) {
        if (!error.open1) error.open1 = 'Morning opening must be before afternoon opening';
        if (!error.open2) error.open2 = 'Afternoon opening must be after morning opening';
      }

      // close1 must be before close2
      if (close1 && close1 >= close2) {
        if (!error.close1) error.close1 = 'Morning closing must be before afternoon closing';
        if (!error.close2) error.close2 = 'Afternoon closing must be after morning closing';
      }
    }

    return error;
  };

  // Watch all form values and validate in real-time
  useEffect(() => {
    const subscription = watch((data) => {
      const newErrors: Record<string, TimeError> = {};
      DAYS.forEach(({ key }) => {
        const dayError = validateDay(key, data as UpdateBusinessHoursData);
        if (Object.keys(dayError).length > 0) {
          newErrors[key] = dayError;
        }
      });
      setErrors(newErrors);
    });
    return () => subscription.unsubscribe();
  }, [watch]);

  const loadBusinessHours = async () => {
    try {
      setIsLoading(true);
      const data = await tenantApi.getBusinessHours();
      setBusinessHours(data);

      // Set form values and detect breaks
      const breaks: Record<string, boolean> = {};
      DAYS.forEach(({ key }) => {
        const closedKey = `${key}_closed` as keyof BusinessHours;
        const open1Key = `${key}_open1` as keyof BusinessHours;
        const close1Key = `${key}_close1` as keyof BusinessHours;
        const open2Key = `${key}_open2` as keyof BusinessHours;
        const close2Key = `${key}_close2` as keyof BusinessHours;

        setValue(closedKey as any, data[closedKey] as boolean);
        setValue(open1Key as any, data[open1Key] as string | null);
        setValue(close1Key as any, data[close1Key] as string | null);
        setValue(open2Key as any, data[open2Key] as string | null);
        setValue(close2Key as any, data[close2Key] as string | null);

        breaks[key] = !!(data[open2Key] && data[close2Key]);
      });
      setHasBreak(breaks);
    } catch (error: any) {
      console.error('Business hours load error:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to load business hours';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: UpdateBusinessHoursData) => {
    try {
      // Check if there are any validation errors
      if (Object.keys(errors).length > 0) {
        toast.error('Please fix the time validation errors before saving');
        return;
      }

      setIsSubmitting(true);
      await tenantApi.updateBusinessHours(data);
      toast.success('Business hours updated successfully');
      loadBusinessHours();
    } catch (error: any) {
      console.error('Business hours update error:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to update business hours';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddBreak = (day: string) => {
    setHasBreak({ ...hasBreak, [day]: true });
  };

  const handleRemoveBreak = (day: string) => {
    setValue(`${day}_open2` as any, null);
    setValue(`${day}_close2` as any, null);
    setHasBreak({ ...hasBreak, [day]: false });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Business Hours</h2>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {DAYS.map(({ key, label }) => {
              const isClosed = watch(`${key}_closed` as any);
              const hasLunchBreak = hasBreak[key];
              const dayErrors = errors[key] || {};

              return (
                <div key={key} className="p-6">
                  <div className="flex items-start gap-6">
                    {/* Day Label */}
                    <div className="w-32 flex-shrink-0">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-4">
                        {label}
                      </h3>
                      <ToggleSwitch
                        label="Closed"
                        enabled={isClosed || false}
                        onChange={(checked) => setValue(`${key}_closed` as any, checked)}
                      />
                    </div>

                    {/* Hours */}
                    {!isClosed && (
                      <div className="flex-1 space-y-4">
                        {/* First time slot */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-4">
                            <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            <div className="flex items-start gap-3 flex-1 flex-col">
                              <div className="flex items-center gap-3 w-full">
                                <div className="flex-1">
                                  <TimePicker
                                    {...register(`${key}_open1` as any)}
                                    placeholder="Open"
                                    className={`w-full ${dayErrors.open1 ? 'border-red-500 dark:border-red-500' : ''}`}
                                  />
                                  {dayErrors.open1 && (
                                    <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                                      {dayErrors.open1}
                                    </p>
                                  )}
                                </div>
                                <span className="text-gray-500 dark:text-gray-400 mt-2">to</span>
                                <div className="flex-1">
                                  <TimePicker
                                    {...register(`${key}_close1` as any)}
                                    placeholder="Close"
                                    className={`w-full ${dayErrors.close1 ? 'border-red-500 dark:border-red-500' : ''}`}
                                  />
                                  {dayErrors.close1 && (
                                    <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                                      {dayErrors.close1}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Second time slot (lunch break) */}
                        {hasLunchBreak ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-4">
                              <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
                              <div className="flex items-start gap-3 flex-1 flex-col">
                                <div className="flex items-center gap-3 w-full">
                                  <div className="flex-1">
                                    <TimePicker
                                      {...register(`${key}_open2` as any)}
                                      placeholder="Reopen"
                                      className={`w-full ${dayErrors.open2 ? 'border-red-500 dark:border-red-500' : ''}`}
                                    />
                                    {dayErrors.open2 && (
                                      <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                                        {dayErrors.open2}
                                      </p>
                                    )}
                                  </div>
                                  <span className="text-gray-500 dark:text-gray-400 mt-2">to</span>
                                  <div className="flex-1">
                                    <TimePicker
                                      {...register(`${key}_close2` as any)}
                                      placeholder="Close"
                                      className={`w-full ${dayErrors.close2 ? 'border-red-500 dark:border-red-500' : ''}`}
                                    />
                                    {dayErrors.close2 && (
                                      <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
                                        {dayErrors.close2}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBreak(key)}
                                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors flex-shrink-0 mt-2"
                                    title="Remove break"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddBreak(key)}
                            className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors ml-9"
                          >
                            <Plus className="w-4 h-4" />
                            Add lunch break
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isSubmitting}
            disabled={isSubmitting || Object.keys(errors).length > 0}
          >
            {isSubmitting ? 'Saving...' : 'Save Business Hours'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default BusinessHoursEditor;
