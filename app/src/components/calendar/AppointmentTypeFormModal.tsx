// ============================================================================
// Appointment Type Form Modal
// ============================================================================
// Create or edit appointment type with duration, max lookahead, and reminder toggles
// ============================================================================

'use client';

import { useState, useEffect } from 'react';
import { Clock, Save } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import ToggleSwitch from '@/components/ui/ToggleSwitch';
import * as calendarApi from '@/lib/api/calendar';
import type { AppointmentTypeWithSchedules } from '@/lib/types/calendar';
import toast from 'react-hot-toast';

interface AppointmentTypeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  appointmentType?: AppointmentTypeWithSchedules | null;
}

// Duration options (15 to 480 minutes per REST API spec)
const DURATION_OPTIONS = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '1 hour' },
  { value: '90', label: '1.5 hours' },
  { value: '120', label: '2 hours' },
  { value: '150', label: '2.5 hours' },
  { value: '180', label: '3 hours' },
  { value: '240', label: '4 hours' },
  { value: '300', label: '5 hours' },
  { value: '360', label: '6 hours' },
  { value: '420', label: '7 hours' },
  { value: '480', label: '8 hours' },
];

// Max lookahead options (1 to 52 weeks per REST API spec)
const LOOKAHEAD_OPTIONS = [
  { value: '1', label: '1 week' },
  { value: '2', label: '2 weeks' },
  { value: '4', label: '4 weeks (1 month)' },
  { value: '8', label: '8 weeks (2 months)' },
  { value: '12', label: '12 weeks (3 months)' },
  { value: '16', label: '16 weeks (4 months)' },
  { value: '26', label: '26 weeks (6 months)' },
  { value: '52', label: '52 weeks (1 year)' },
];

export default function AppointmentTypeFormModal({
  isOpen,
  onClose,
  onSuccess,
  appointmentType,
}: AppointmentTypeFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [slotDurationMinutes, setSlotDurationMinutes] = useState('60');
  const [maxLookaheadWeeks, setMaxLookaheadWeeks] = useState('8');
  const [reminder24hEnabled, setReminder24hEnabled] = useState(true);
  const [reminder1hEnabled, setReminder1hEnabled] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!appointmentType;

  // Reset form when modal opens or appointmentType changes
  useEffect(() => {
    if (appointmentType) {
      setName(appointmentType.name);
      setDescription(appointmentType.description || '');
      setSlotDurationMinutes(appointmentType.slot_duration_minutes.toString());
      setMaxLookaheadWeeks(appointmentType.max_lookahead_weeks.toString());
      setReminder24hEnabled(appointmentType.reminder_24h_enabled);
      setReminder1hEnabled(appointmentType.reminder_1h_enabled);
      setIsDefault(appointmentType.is_default);
      setIsActive(appointmentType.is_active);
    } else {
      setName('');
      setDescription('');
      setSlotDurationMinutes('60');
      setMaxLookaheadWeeks('8');
      setReminder24hEnabled(true);
      setReminder1hEnabled(true);
      setIsDefault(false);
      setIsActive(true);
    }
    setError(null);
  }, [appointmentType, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validation
      const trimmedName = name.trim();
      if (!trimmedName || trimmedName.length < 1 || trimmedName.length > 100) {
        setError('Name must be between 1 and 100 characters');
        setLoading(false);
        return;
      }

      const trimmedDescription = description.trim();
      if (trimmedDescription.length > 500) {
        setError('Description cannot exceed 500 characters');
        setLoading(false);
        return;
      }

      const duration = parseInt(slotDurationMinutes, 10);
      if (isNaN(duration) || duration < 15 || duration > 480) {
        setError('Duration must be between 15 and 480 minutes');
        setLoading(false);
        return;
      }

      const lookahead = parseInt(maxLookaheadWeeks, 10);
      if (isNaN(lookahead) || lookahead < 1 || lookahead > 52) {
        setError('Max lookahead must be between 1 and 52 weeks');
        setLoading(false);
        return;
      }

      const payload = {
        name: trimmedName,
        description: trimmedDescription || undefined,
        slot_duration_minutes: duration,
        max_lookahead_weeks: lookahead,
        reminder_24h_enabled: reminder24hEnabled,
        reminder_1h_enabled: reminder1hEnabled,
        is_default: isDefault,
        is_active: isActive,
      };

      if (isEditing && appointmentType) {
        await calendarApi.updateAppointmentType(appointmentType.id, payload);
        toast.success('Appointment type updated successfully');
      } else {
        await calendarApi.createAppointmentType(payload);
        toast.success('Appointment type created successfully');
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (err: any) {
      console.error('[AppointmentTypeFormModal] Error:', err);
      const errorMessage = err?.message || err?.data?.message || 'Failed to save appointment type';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Clock className="w-6 h-6 text-brand-600 dark:text-brand-400" />
          {isEditing ? 'Edit Appointment Type' : 'Create Appointment Type'}
        </div>
      }
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        <ModalContent>
          <div className="space-y-4">
            {/* Name */}
            <Input
              label="Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Quote Visit, Follow-up Call"
              maxLength={100}
              required
              autoFocus
            />

            {/* Description */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description of this appointment type"
                maxLength={500}
                rows={3}
                className="w-full px-4 py-3 border-2 rounded-lg text-gray-900 dark:text-gray-100 font-medium bg-white dark:bg-gray-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300 dark:border-gray-600 transition-all duration-200"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {description.length}/500 characters
              </p>
            </div>

            {/* Duration */}
            <Select
              label="Appointment Duration"
              options={DURATION_OPTIONS}
              value={slotDurationMinutes}
              onChange={setSlotDurationMinutes}
              required
            />

            {/* Max Lookahead */}
            <Select
              label="Maximum Booking Window"
              options={LOOKAHEAD_OPTIONS}
              value={maxLookaheadWeeks}
              onChange={setMaxLookaheadWeeks}
              helperText="How far in advance customers can book this appointment type"
              required
            />

            {/* Reminders */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Reminders
              </h4>
              <div className="space-y-3">
                <ToggleSwitch
                  enabled={reminder24hEnabled}
                  onChange={setReminder24hEnabled}
                  label="24-hour reminder"
                  description="Send reminder 24 hours before appointment"
                />
                <ToggleSwitch
                  enabled={reminder1hEnabled}
                  onChange={setReminder1hEnabled}
                  label="1-hour reminder"
                  description="Send reminder 1 hour before appointment"
                />
              </div>
            </div>

            {/* Settings */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Settings
              </h4>
              <div className="space-y-3">
                <ToggleSwitch
                  enabled={isDefault}
                  onChange={setIsDefault}
                  label="Default appointment type"
                  description="Automatically select this type when creating appointments"
                />
                <ToggleSwitch
                  enabled={isActive}
                  onChange={setIsActive}
                  label="Active"
                  description="Allow booking this appointment type"
                />
              </div>
            </div>

            {/* Error Message */}
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
          <Button type="submit" variant="primary" loading={loading}>
            <Save className="w-4 h-4 mr-2" />
            {isEditing ? 'Save Changes' : 'Create Appointment Type'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
