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

export function BusinessHoursEditor() {
  const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasBreak, setHasBreak] = useState<Record<string, boolean>>({});

  const { register, handleSubmit, watch, setValue } = useForm<UpdateBusinessHoursData>();

  useEffect(() => {
    loadBusinessHours();
  }, []);

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
      toast.error(error?.response?.data?.message || 'Failed to load business hours');
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: UpdateBusinessHoursData) => {
    try {
      setIsSubmitting(true);
      await tenantApi.updateBusinessHours(data);
      toast.success('Business hours updated successfully');
      loadBusinessHours();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update business hours');
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
                        <div className="flex items-center gap-4">
                          <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
                          <div className="flex items-center gap-3 flex-1">
                            <TimePicker
                              {...register(`${key}_open1` as any)}
                              placeholder="Open"
                              className="flex-1"
                            />
                            <span className="text-gray-500 dark:text-gray-400">to</span>
                            <TimePicker
                              {...register(`${key}_close1` as any)}
                              placeholder="Close"
                              className="flex-1"
                            />
                          </div>
                        </div>

                        {/* Second time slot (lunch break) */}
                        {hasLunchBreak ? (
                          <div className="flex items-center gap-4">
                            <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            <div className="flex items-center gap-3 flex-1">
                              <TimePicker
                                {...register(`${key}_open2` as any)}
                                placeholder="Reopen"
                                className="flex-1"
                              />
                              <span className="text-gray-500 dark:text-gray-400">to</span>
                              <TimePicker
                                {...register(`${key}_close2` as any)}
                                placeholder="Close"
                                className="flex-1"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveBreak(key)}
                                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors flex-shrink-0"
                                title="Remove break"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddBreak(key)}
                            className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
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
          <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Business Hours'}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default BusinessHoursEditor;
