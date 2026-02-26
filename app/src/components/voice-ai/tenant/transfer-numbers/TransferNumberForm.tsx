'use client';

// ============================================================================
// TransferNumberForm Component
// ============================================================================
// Form for creating/editing transfer numbers with validation
// ============================================================================

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import PhoneInput from '@/components/ui/PhoneInput';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import Button from '@/components/ui/Button';
import type { TransferNumber, TransferType } from '@/lib/types/voice-ai';
import { AvailableHoursEditor } from './AvailableHoursEditor';

// Validation schema
const transferNumberSchema = z.object({
  label: z
    .string()
    .min(1, 'Label is required')
    .max(100, 'Label must be 100 characters or less'),
  phone_number: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, 'Phone must be in E.164 format (e.g., +15551234567)'),
  transfer_type: z.enum(['primary', 'overflow', 'after_hours', 'emergency']),
  description: z
    .string()
    .max(200, 'Description must be 200 characters or less')
    .optional()
    .nullable()
    .transform((val) => val || null),
  is_default: z.boolean(),
  available_hours: z
    .string()
    .optional()
    .nullable()
    .refine(
      (val) => {
        if (!val || val.trim() === '') return true;
        try {
          JSON.parse(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Available hours must be valid JSON' }
    )
    .transform((val) => val || null),
  display_order: z
    .number()
    .int('Display order must be an integer')
    .min(0, 'Display order must be 0 or greater'),
});

type TransferNumberFormData = z.infer<typeof transferNumberSchema>;

interface TransferNumberFormProps {
  initialData?: TransferNumber | null;
  onSubmit: (data: TransferNumberFormData) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}

/**
 * TransferNumberForm - Form for create/edit transfer number
 */
export function TransferNumberForm({
  initialData,
  onSubmit,
  onCancel,
  submitting,
}: TransferNumberFormProps) {
  const isEdit = !!initialData;

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TransferNumberFormData>({
    resolver: zodResolver(transferNumberSchema),
    defaultValues: initialData
      ? {
          label: initialData.label,
          phone_number: initialData.phone_number,
          transfer_type: initialData.transfer_type,
          description: initialData.description || '',
          is_default: initialData.is_default,
          available_hours: initialData.available_hours || '',
          display_order: initialData.display_order,
        }
      : {
          label: '',
          phone_number: '',
          transfer_type: 'primary',
          description: '',
          is_default: false,
          available_hours: '',
          display_order: 0,
        },
  });

  const isDefaultValue = watch('is_default');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Label (Required) */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Label <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <Input
          {...register('label')}
          placeholder="Sales Team, After Hours, Emergency"
          error={errors.label?.message}
          disabled={submitting}
          maxLength={100}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
          A descriptive name for this transfer number
        </p>
      </div>

      {/* Phone Number (Required) */}
      <div>
        <Controller
          name="phone_number"
          control={control}
          render={({ field }) => (
            <PhoneInput
              {...field}
              label="Phone Number"
              error={errors.phone_number?.message}
              helperText="US phone number in E.164 format"
              disabled={submitting}
              required
            />
          )}
        />
      </div>

      {/* Transfer Type */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Transfer Type
        </label>
        <select
          {...register('transfer_type')}
          className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg
            text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
          disabled={submitting}
        >
          <option value="primary">Primary</option>
          <option value="overflow">Overflow</option>
          <option value="after_hours">After Hours</option>
          <option value="emergency">Emergency</option>
        </select>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
          Category of this transfer destination
        </p>
      </div>

      {/* Description (Optional) */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Description
        </label>
        <Textarea
          {...register('description')}
          placeholder="When to use this transfer number"
          error={errors.description?.message}
          disabled={submitting}
          maxLength={200}
          rows={3}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
          Optional description (max 200 characters)
        </p>
      </div>

      {/* Is Default */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Set as Default Transfer Number
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Only one transfer number can be default at a time
          </p>
        </div>
        <ToggleSwitch
          enabled={isDefaultValue || false}
          onChange={(value) => {
            setValue('is_default', value, { shouldValidate: true, shouldDirty: true });
          }}
          disabled={submitting}
        />
      </div>

      {/* Available Hours */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Available Hours
        </label>
        <Controller
          name="available_hours"
          control={control}
          render={({ field }) => (
            <AvailableHoursEditor
              value={field.value || ''}
              onChange={field.onChange}
              disabled={submitting}
            />
          )}
        />
        {errors.available_hours && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {errors.available_hours.message}
          </p>
        )}
      </div>

      {/* Display Order */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Display Order
        </label>
        <Input
          type="number"
          {...register('display_order', { valueAsNumber: true })}
          placeholder="0"
          error={errors.display_order?.message}
          disabled={submitting}
          min={0}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
          Lower values appear first (0 = highest priority)
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={submitting}
          disabled={submitting}
        >
          {isEdit ? 'Update Transfer Number' : 'Create Transfer Number'}
        </Button>
      </div>
    </form>
  );
}
