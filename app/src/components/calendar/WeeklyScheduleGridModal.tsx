// ============================================================================
// Weekly Schedule Grid Modal
// ============================================================================
// Edit weekly availability schedule with dual time window support for each day
// Sprint 38: Weekly Schedule Grid
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { Calendar, Save, Plus, Trash2, AlertCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import Button from '@/components/ui/Button';
import TimePicker from '@/components/ui/TimePicker';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import * as calendarApi from '@/lib/api/calendar';
import type { AppointmentTypeSchedule } from '@/lib/types/calendar';
import toast from 'react-hot-toast';

interface WeeklyScheduleGridModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  appointmentTypeId: string;
  appointmentTypeName: string;
  currentSchedules: AppointmentTypeSchedule[];
}

interface DayScheduleState {
  day_of_week: number;
  is_available: boolean;
  window1_start: string;
  window1_end: string;
  window2_start: string;
  window2_end: string;
  hasWindow2: boolean;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function WeeklyScheduleGridModal({
  isOpen,
  onClose,
  onSuccess,
  appointmentTypeId,
  appointmentTypeName,
  currentSchedules,
}: WeeklyScheduleGridModalProps) {
  const [schedules, setSchedules] = useState<DayScheduleState[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});

  // Initialize schedules from props
  useEffect(() => {
    if (isOpen) {
      initializeSchedules();
      setError(null);
      setValidationErrors({});
    }
  }, [isOpen, currentSchedules]);

  const initializeSchedules = () => {
    // Create schedule for all 7 days
    const initialSchedules: DayScheduleState[] = [];

    for (let day = 0; day <= 6; day++) {
      const existing = currentSchedules.find((s) => s.day_of_week === day);

      if (existing) {
        initialSchedules.push({
          day_of_week: day,
          is_available: existing.is_available,
          window1_start: existing.window1_start || '09:00',
          window1_end: existing.window1_end || '17:00',
          window2_start: existing.window2_start || '13:00',
          window2_end: existing.window2_end || '18:00',
          hasWindow2: !!(existing.window2_start && existing.window2_end),
        });
      } else {
        // Default schedule: unavailable
        initialSchedules.push({
          day_of_week: day,
          is_available: false,
          window1_start: '09:00',
          window1_end: '17:00',
          window2_start: '13:00',
          window2_end: '18:00',
          hasWindow2: false,
        });
      }
    }

    setSchedules(initialSchedules);
  };

  const handleToggleDay = (dayOfWeek: number, enabled: boolean) => {
    setSchedules((prev) =>
      prev.map((schedule) =>
        schedule.day_of_week === dayOfWeek
          ? { ...schedule, is_available: enabled }
          : schedule
      )
    );
    // Clear validation error for this day
    setValidationErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[dayOfWeek];
      return newErrors;
    });
  };

  const handleTimeChange = (
    dayOfWeek: number,
    field: 'window1_start' | 'window1_end' | 'window2_start' | 'window2_end',
    value: string
  ) => {
    setSchedules((prev) =>
      prev.map((schedule) =>
        schedule.day_of_week === dayOfWeek
          ? { ...schedule, [field]: value }
          : schedule
      )
    );
    // Clear validation error for this day
    setValidationErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[dayOfWeek];
      return newErrors;
    });
  };

  const handleAddWindow2 = (dayOfWeek: number) => {
    setSchedules((prev) =>
      prev.map((schedule) =>
        schedule.day_of_week === dayOfWeek
          ? { ...schedule, hasWindow2: true }
          : schedule
      )
    );
  };

  const handleRemoveWindow2 = (dayOfWeek: number) => {
    setSchedules((prev) =>
      prev.map((schedule) =>
        schedule.day_of_week === dayOfWeek
          ? { ...schedule, hasWindow2: false, window2_start: '', window2_end: '' }
          : schedule
      )
    );
  };

  const validateSchedules = (): boolean => {
    const errors: Record<number, string> = {};

    schedules.forEach((schedule) => {
      if (!schedule.is_available) return;

      // Validate Window 1
      if (!schedule.window1_start || !schedule.window1_end) {
        errors[schedule.day_of_week] = 'Window 1 start and end times are required';
        return;
      }

      if (schedule.window1_start >= schedule.window1_end) {
        errors[schedule.day_of_week] = 'Window 1 end time must be after start time';
        return;
      }

      // Validate Window 2 if enabled
      if (schedule.hasWindow2) {
        if (!schedule.window2_start || !schedule.window2_end) {
          errors[schedule.day_of_week] = 'Window 2 start and end times are required when enabled';
          return;
        }

        if (schedule.window2_start >= schedule.window2_end) {
          errors[schedule.day_of_week] = 'Window 2 end time must be after start time';
          return;
        }

        // Check for overlap between windows
        if (schedule.window2_start < schedule.window1_end) {
          errors[schedule.day_of_week] = 'Window 2 must start after Window 1 ends';
          return;
        }
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    // Validate
    if (!validateSchedules()) {
      toast.error('Please fix validation errors before saving');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Transform to API format
      const schedulesForApi = schedules.map((schedule) => ({
        day_of_week: schedule.day_of_week,
        is_available: schedule.is_available,
        window1_start: schedule.is_available ? schedule.window1_start : null,
        window1_end: schedule.is_available ? schedule.window1_end : null,
        window2_start:
          schedule.is_available && schedule.hasWindow2 ? schedule.window2_start : null,
        window2_end:
          schedule.is_available && schedule.hasWindow2 ? schedule.window2_end : null,
      }));

      // Call API
      await calendarApi.bulkUpdateSchedule(appointmentTypeId, {
        schedules: schedulesForApi,
      });

      toast.success('Weekly schedule updated successfully');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      console.error('[WeeklyScheduleGrid] Failed to save schedule:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to save schedule';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-brand-600 dark:text-brand-400" />
          <div>
            <span>Edit Weekly Schedule</span>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-normal mt-1">
              {appointmentTypeName}
            </p>
          </div>
        </div>
      }
    >
      <ModalContent>
        <div className="space-y-4">
          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <p className="font-semibold mb-1">Configure your weekly availability</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                  <li>Toggle each day on or off to set availability</li>
                  <li>Set your primary working hours in Window 1</li>
                  <li>Add Window 2 for split shifts (e.g., morning and afternoon)</li>
                  <li>Window 2 must start after Window 1 ends</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Schedule Grid */}
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {schedules.map((schedule) => (
              <div
                key={schedule.day_of_week}
                className={`border-2 rounded-lg p-4 transition-all ${
                  schedule.is_available
                    ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10'
                    : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                } ${validationErrors[schedule.day_of_week] ? 'border-red-400 dark:border-red-600' : ''}`}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {DAY_NAMES[schedule.day_of_week]}
                  </h3>
                  <ToggleSwitch
                    enabled={schedule.is_available}
                    onChange={(enabled) => handleToggleDay(schedule.day_of_week, enabled)}
                    label={schedule.is_available ? 'Available' : 'Unavailable'}
                  />
                </div>

                {/* Validation Error */}
                {validationErrors[schedule.day_of_week] && (
                  <div className="mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-sm text-red-800 dark:text-red-200">
                      {validationErrors[schedule.day_of_week]}
                    </p>
                  </div>
                )}

                {/* Time Windows (only show when available) */}
                {schedule.is_available && (
                  <div className="space-y-4">
                    {/* Window 1 */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <label className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          Window 1 (Primary Hours)
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <TimePicker
                          label="Start Time"
                          value={schedule.window1_start}
                          onChange={(e) =>
                            handleTimeChange(
                              schedule.day_of_week,
                              'window1_start',
                              e.target.value
                            )
                          }
                          required
                        />
                        <TimePicker
                          label="End Time"
                          value={schedule.window1_end}
                          onChange={(e) =>
                            handleTimeChange(
                              schedule.day_of_week,
                              'window1_end',
                              e.target.value
                            )
                          }
                          required
                        />
                      </div>
                    </div>

                    {/* Window 2 */}
                    {schedule.hasWindow2 ? (
                      <div className="border-t-2 border-gray-200 dark:border-gray-700 pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                            Window 2 (Second Shift)
                          </label>
                          <Button
                            onClick={() => handleRemoveWindow2(schedule.day_of_week)}
                            variant="danger"
                            size="sm"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            Remove
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <TimePicker
                            label="Start Time"
                            value={schedule.window2_start}
                            onChange={(e) =>
                              handleTimeChange(
                                schedule.day_of_week,
                                'window2_start',
                                e.target.value
                              )
                            }
                            required
                          />
                          <TimePicker
                            label="End Time"
                            value={schedule.window2_end}
                            onChange={(e) =>
                              handleTimeChange(
                                schedule.day_of_week,
                                'window2_end',
                                e.target.value
                              )
                            }
                            required
                          />
                        </div>
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleAddWindow2(schedule.day_of_week)}
                        variant="secondary"
                        size="sm"
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Second Shift (Window 2)
                      </Button>
                    )}
                  </div>
                )}

                {/* Unavailable Message */}
                {!schedule.is_available && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    No appointments available on this day
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </ModalContent>

      <ModalActions>
        <Button onClick={handleCancel} variant="secondary" size="md" disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="primary" size="md" disabled={loading} loading={loading}>
          <Save className="w-4 h-4 mr-2" />
          {loading ? 'Saving...' : 'Save Schedule'}
        </Button>
      </ModalActions>
    </Modal>
  );
}
