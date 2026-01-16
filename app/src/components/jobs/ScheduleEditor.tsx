/**
 * Schedule Editor Component
 * Edit scheduled job configuration with cron expression
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { ScheduledJob, UpdateScheduledJobDto } from '@/lib/types/jobs';
import { cronToReadable, isValidCron, getCronPresets } from '@/lib/utils/cron-helpers';
import { AlertCircle, Info } from 'lucide-react';

interface ScheduleEditorProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: ScheduledJob | null;
  onSave: (data: UpdateScheduledJobDto) => Promise<void>;
}

type ScheduleMode = 'preset' | 'custom';

export function ScheduleEditor({ isOpen, onClose, schedule, onSave }: ScheduleEditorProps) {
  const [mode, setMode] = useState<ScheduleMode>('preset');
  const [preset, setPreset] = useState('');
  const [customCron, setCustomCron] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [maxRetries, setMaxRetries] = useState(1);
  const [timeoutSeconds, setTimeoutSeconds] = useState(300);
  const [isSaving, setIsSaving] = useState(false);
  const [cronError, setCronError] = useState<string | null>(null);

  useEffect(() => {
    if (schedule) {
      setName(schedule.name);
      setDescription(schedule.description || '');
      setTimezone(schedule.timezone);
      setIsEnabled(schedule.is_enabled);
      setMaxRetries(schedule.max_retries);
      setTimeoutSeconds(schedule.timeout_seconds);

      // Check if schedule matches a preset
      const presets = getCronPresets();
      const matchingPreset = presets.find(p => p.cron === schedule.schedule);
      if (matchingPreset) {
        setMode('preset');
        setPreset(schedule.schedule);
      } else {
        setMode('custom');
        setCustomCron(schedule.schedule);
      }
    }
  }, [schedule]);

  const getCurrentCron = (): string => {
    return mode === 'preset' ? preset : customCron;
  };

  const validateAndUpdateCron = (cron: string) => {
    if (!cron) {
      setCronError(null);
      return;
    }

    if (isValidCron(cron)) {
      setCronError(null);
    } else {
      setCronError('Invalid cron expression. Expected format: * * * * * (minute hour day month weekday)');
    }
  };

  const handlePresetChange = (value: string) => {
    setPreset(value);
    validateAndUpdateCron(value);
  };

  const handleCustomCronChange = (value: string) => {
    setCustomCron(value);
    validateAndUpdateCron(value);
  };

  const handleSave = async () => {
    const cron = getCurrentCron();

    if (!cron) {
      setCronError('Please select a schedule');
      return;
    }

    if (!isValidCron(cron)) {
      setCronError('Invalid cron expression');
      return;
    }

    try {
      setIsSaving(true);

      const data: UpdateScheduledJobDto = {
        schedule: cron,
        timezone,
        is_enabled: isEnabled,
        max_retries: maxRetries,
        timeout_seconds: timeoutSeconds,
      };

      // Only include name/description if they've changed
      if (name !== schedule?.name) {
        data.name = name;
      }
      if (description !== schedule?.description) {
        data.description = description || undefined;
      }

      await onSave(data);
      onClose();
    } catch (err: any) {
      console.error('[ScheduleEditor] Error saving:', err);
      // Error handling is done in parent component
    } finally {
      setIsSaving(false);
    }
  };

  const cron = getCurrentCron();
  const cronPreview = cron && isValidCron(cron) ? cronToReadable(cron) : null;

  const timezoneOptions = [
    { value: 'America/New_York', label: 'Eastern Time (ET)' },
    { value: 'America/Chicago', label: 'Central Time (CT)' },
    { value: 'America/Denver', label: 'Mountain Time (MT)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
    { value: 'UTC', label: 'UTC' },
  ];

  const presets = getCronPresets();
  const presetOptions = [
    { value: '', label: 'Select a preset...' },
    ...presets.map(p => ({ value: p.cron, label: p.label }))
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Schedule" size="xl">
      <ModalContent>
        <div className="space-y-4">
          {/* Name */}
          <Input
            label="Job Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={true} // Can't change job name after creation
            className="opacity-75"
          />

          {/* Description */}
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />

          {/* Schedule Mode Tabs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Schedule
            </label>
            <div className="flex gap-2 mb-3">
              <Button
                variant={mode === 'preset' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setMode('preset')}
              >
                Preset Schedule
              </Button>
              <Button
                variant={mode === 'custom' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setMode('custom')}
              >
                Custom Cron
              </Button>
            </div>

            {/* Preset Mode */}
            {mode === 'preset' && (
              <Select
                value={preset}
                onChange={(value) => handlePresetChange(value)}
                options={presetOptions}
              />
            )}

            {/* Custom Mode */}
            {mode === 'custom' && (
              <div className="space-y-2">
                <Input
                  value={customCron}
                  onChange={(e) => handleCustomCronChange(e.target.value)}
                  placeholder="0 6 * * *"
                  error={cronError || undefined}
                />
                <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 p-2 rounded">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium mb-1">Cron format: minute hour day month weekday</p>
                    <p>Example: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">0 6 * * *</code> = Daily at 6:00 AM</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cron Preview */}
          {cronPreview && !cronError && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
              <p className="text-sm text-green-800 dark:text-green-300">
                <strong>Runs:</strong> {cronPreview}
              </p>
            </div>
          )}

          {/* Timezone */}
          <Select
            label="Timezone"
            value={timezone}
            onChange={(value) => setTimezone(value)}
            options={timezoneOptions}
          />

          {/* Enabled Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Enabled
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Job will run on schedule when enabled
              </p>
            </div>
            <ToggleSwitch
              enabled={isEnabled}
              onChange={setIsEnabled}
              label=""
            />
          </div>

          {/* Advanced Settings */}
          <details className="border border-gray-200 dark:border-gray-700 rounded-md p-3">
            <summary className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
              Advanced Settings
            </summary>
            <div className="mt-3 space-y-3">
              <Input
                label="Max Retries"
                type="number"
                min="1"
                max="10"
                value={maxRetries}
                onChange={(e) => setMaxRetries(parseInt(e.target.value) || 1)}
              />
              <Input
                label="Timeout (seconds)"
                type="number"
                min="60"
                max="3600"
                value={timeoutSeconds}
                onChange={(e) => setTimeoutSeconds(parseInt(e.target.value) || 300)}
              />
            </div>
          </details>
        </div>
      </ModalContent>

      <ModalActions>
        <Button variant="secondary" onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={isSaving || !!cronError || !getCurrentCron()}
        >
          {isSaving ? 'Saving...' : 'Save Schedule'}
        </Button>
      </ModalActions>
    </Modal>
  );
}

export default ScheduleEditor;
