/**
 * IVR Configuration Create/Edit Page (Sprint 7)
 * Complex form for configuring Interactive Voice Response menus
 *
 * Features:
 * - Upsert pattern (single endpoint for create/update)
 * - Menu option builder with drag-and-drop reordering
 * - Form validation with Zod
 * - Dirty state tracking with navigation warnings
 * - RBAC enforcement (Owner, Admin only)
 * - Mobile responsive
 * - Dark mode support
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import {
  PhoneCall,
  Voicemail,
  Link as LinkIcon,
  ArrowRight,
  Save,
  X,
  Plus,
  GripVertical,
  Trash2,
  AlertCircle,
  Clock,
  RotateCcw,
  MessageSquare,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Breadcrumb } from '@/components/ui/Breadcrumb';

import { getIVRConfiguration, upsertIVRConfiguration } from '@/lib/api/ivr';
import type { IVRActionType } from '@/lib/types/ivr';
import { useAuth } from '@/contexts/AuthContext';
import { getAccessToken } from '@/lib/utils/token';

// Validation schema
const ivrSchema = z.object({
  ivr_enabled: z.boolean(),
  greeting_message: z
    .string()
    .min(5, 'Greeting message must be at least 5 characters')
    .max(500, 'Greeting message must not exceed 500 characters'),
  menu_options: z
    .array(
      z.object({
        digit: z.string().regex(/^[0-9]$/, 'Must be a single digit (0-9)'),
        action: z.enum(['route_to_number', 'route_to_default', 'trigger_webhook', 'voicemail']),
        label: z.string().min(1, 'Label is required').max(100, 'Label must not exceed 100 characters'),
        config: z.object({
          phone_number: z.string().optional(),
          webhook_url: z.string().optional(),
          max_duration_seconds: z.number().optional(),
        }),
      })
    )
    .min(1, 'At least one menu option is required')
    .max(10, 'Maximum 10 menu options allowed')
    .refine(
      (options) => {
        const digits = options.map((opt) => opt.digit);
        return digits.length === new Set(digits).size;
      },
      { message: 'Each digit must be unique' }
    ),
  default_action: z.object({
    action: z.enum(['route_to_number', 'route_to_default', 'trigger_webhook', 'voicemail']),
    config: z.object({
      phone_number: z.string().optional(),
      webhook_url: z.string().optional(),
      max_duration_seconds: z.number().optional(),
    }),
  }),
  timeout_seconds: z.number().min(5, 'Minimum 5 seconds').max(60, 'Maximum 60 seconds'),
  max_retries: z.number().min(1, 'Minimum 1 retry').max(5, 'Maximum 5 retries'),
});

// Refined schema with conditional validation
const refinedIvrSchema = ivrSchema
  .refine(
    (data) => {
      // Validate menu options configs
      return data.menu_options.every((option) => {
        if (option.action === 'route_to_number') {
          return (
            option.config.phone_number &&
            /^\+[1-9]\d{1,14}$/.test(option.config.phone_number)
          );
        }
        if (option.action === 'trigger_webhook') {
          return (
            option.config.webhook_url &&
            /^https:\/\/.+/.test(option.config.webhook_url)
          );
        }
        if (option.action === 'voicemail') {
          return (
            option.config.max_duration_seconds &&
            option.config.max_duration_seconds >= 60 &&
            option.config.max_duration_seconds <= 300
          );
        }
        return true;
      });
    },
    {
      message: 'Menu option configuration is invalid',
      path: ['menu_options'],
    }
  )
  .refine(
    (data) => {
      // Validate default action config
      if (data.default_action.action === 'route_to_number') {
        return (
          data.default_action.config.phone_number &&
          /^\+[1-9]\d{1,14}$/.test(data.default_action.config.phone_number)
        );
      }
      if (data.default_action.action === 'trigger_webhook') {
        return (
          data.default_action.config.webhook_url &&
          /^https:\/\/.+/.test(data.default_action.config.webhook_url)
        );
      }
      if (data.default_action.action === 'voicemail') {
        return (
          data.default_action.config.max_duration_seconds &&
          data.default_action.config.max_duration_seconds >= 60 &&
          data.default_action.config.max_duration_seconds <= 300
        );
      }
      return true;
    },
    {
      message: 'Default action configuration is invalid',
      path: ['default_action'],
    }
  );

type IVRFormData = z.infer<typeof ivrSchema>;

export default function IVREditPage() {
  const { user } = useAuth();
  const router = useRouter();

  // RBAC - Check if user can edit (Owner or Admin)
  const canEdit = user?.roles?.some((role) => ['Owner', 'Admin'].includes(role)) || false;

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  // Form
  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, dirtyFields },
    reset,
  } = useForm<IVRFormData>({
    resolver: zodResolver(refinedIvrSchema),
    defaultValues: {
      ivr_enabled: true,
      greeting_message: '',
      menu_options: [
        {
          digit: '1',
          action: 'route_to_number',
          label: '',
          config: {},
        },
      ],
      default_action: {
        action: 'voicemail',
        config: {
          max_duration_seconds: 180,
        },
      },
      timeout_seconds: 10,
      max_retries: 3,
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'menu_options',
  });

  // Watch form values
  const greetingMessage = watch('greeting_message');
  const menuOptions = watch('menu_options');
  const defaultActionType = watch('default_action.action');

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load existing config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  // Track dirty state
  useEffect(() => {
    setIsDirty(Object.keys(dirtyFields).length > 0);
  }, [dirtyFields]);

  // Warn before leaving if dirty
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      const data = await getIVRConfiguration(token);
      if (data) {
        // Edit mode - populate form
        setIsEdit(true);
        reset({
          ivr_enabled: data.ivr_enabled,
          greeting_message: data.greeting_message,
          menu_options: data.menu_options.map((opt) => ({
            digit: opt.digit,
            action: opt.action,
            label: opt.label,
            config: opt.config,
          })),
          default_action: data.default_action,
          timeout_seconds: data.timeout_seconds,
          max_retries: data.max_retries,
        });
      } else {
        // Create mode - keep defaults
        setIsEdit(false);
      }
    } catch (error: any) {
      console.error('Error loading IVR config:', error);
      setError(error.message || 'Failed to load IVR configuration');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: IVRFormData) => {
    try {
      setSaving(true);
      const token = getAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      await upsertIVRConfiguration(token, data);
      toast.success('IVR configuration saved successfully');
      setIsDirty(false);
      router.push('/communications/twilio/ivr');
    } catch (error: any) {
      console.error('Error saving IVR config:', error);
      toast.error(error.message || 'Failed to save IVR configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (isDirty) {
      setShowCancelModal(true);
    } else {
      router.push('/communications/twilio/ivr');
    }
  };

  const confirmCancel = () => {
    setShowCancelModal(false);
    router.push('/communications/twilio/ivr');
  };

  const handleAddMenuOption = () => {
    if (fields.length >= 10) {
      toast.error('Maximum 10 menu options allowed');
      return;
    }

    // Find next available digit
    const usedDigits = new Set(menuOptions.map((opt) => opt.digit));
    const availableDigit = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].find(
      (digit) => !usedDigits.has(digit)
    );

    if (!availableDigit) {
      toast.error('All digits (0-9) are already in use');
      return;
    }

    append({
      digit: availableDigit,
      action: 'route_to_number',
      label: '',
      config: {},
    });
  };

  const handleRemoveMenuOption = (index: number) => {
    if (fields.length <= 1) {
      toast.error('At least one menu option is required');
      return;
    }
    remove(index);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((field) => field.id === active.id);
      const newIndex = fields.findIndex((field) => field.id === over.id);
      move(oldIndex, newIndex);
    }
  };

  // Get available digits for a specific option
  const getAvailableDigits = (currentDigit: string) => {
    const usedDigits = new Set(
      menuOptions.filter((opt) => opt.digit !== currentDigit).map((opt) => opt.digit)
    );
    return ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].filter(
      (digit) => !usedDigits.has(digit)
    );
  };

  // Estimate speaking time (150 words per minute)
  const estimateSpeakingTime = (message: string): string => {
    const wordCount = message.trim().split(/\s+/).length;
    const seconds = Math.ceil((wordCount / 150) * 60);
    return `~${seconds} seconds`;
  };

  // Access Control
  if (!canEdit) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Configure IVR
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Interactive Voice Response menu configuration
          </p>
        </div>

        <Card>
          <div className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Access Denied
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your role does not allow configuring IVR settings. Owner or Admin access required.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Configure IVR
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Interactive Voice Response menu configuration
          </p>
        </div>

        <Card>
          <div className="p-12 text-center">
            <LoadingSpinner className="mx-auto mb-4" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading configuration...
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Configure IVR
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Interactive Voice Response menu configuration
          </p>
        </div>

        <ErrorModal
          isOpen={true}
          title="Error Loading Configuration"
          message={error}
          onClose={() => {
            setError(null);
            loadConfig();
          }}
        />

        <Card>
          <div className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Failed to Load
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
            <Button onClick={loadConfig}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumb
        items={[
          { label: 'Communications', href: '/communications/history' },
          { label: 'Twilio', href: '/communications/twilio' },
          { label: 'IVR', href: '/communications/twilio/ivr' },
          { label: isEdit ? 'Edit Configuration' : 'Configure IVR' }, // Current page
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Edit IVR Configuration' : 'Configure IVR'}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Set up Interactive Voice Response menu for incoming calls
          </p>
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <LoadingSpinner className="h-4 w-4 mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Configuration
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error Summary */}
      {Object.keys(errors).length > 0 && (
        <Card>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-2" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Please fix the following errors:
                </h3>
                <ul className="mt-2 text-sm text-red-700 dark:text-red-300 list-disc list-inside space-y-1">
                  {errors.ivr_enabled && <li>{errors.ivr_enabled.message}</li>}
                  {errors.greeting_message && <li>{errors.greeting_message.message}</li>}
                  {errors.menu_options && <li>{errors.menu_options.message}</li>}
                  {errors.default_action && <li>{errors.default_action.message}</li>}
                  {errors.timeout_seconds && <li>{errors.timeout_seconds.message}</li>}
                  {errors.max_retries && <li>{errors.max_retries.message}</li>}
                </ul>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Section 1: IVR Status */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            IVR Status
          </h2>

          <div className="flex items-center justify-between mb-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable IVR Menu
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Enable to activate interactive voice menu with digit options
              </p>
            </div>
            <Controller
              name="ivr_enabled"
              control={control}
              render={({ field }) => (
                <button
                  type="button"
                  role="switch"
                  aria-checked={field.value}
                  onClick={() => field.onChange(!field.value)}
                  className={`${
                    field.value ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                >
                  <span
                    className={`${
                      field.value ? 'translate-x-5' : 'translate-x-0'
                    } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                  />
                </button>
              )}
            />
          </div>

          {/* Info callout */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-1">How Call Routing Works:</p>
                <ul className="space-y-1 list-disc list-inside">
                  <li>
                    <strong>IVR Enabled:</strong> Caller hears greeting message and can press digits to route call
                  </li>
                  <li>
                    <strong>IVR Disabled:</strong> Calls go directly to the Default Action below (no greeting or menu)
                  </li>
                  <li>
                    <strong>Timeout/No Input:</strong> After waiting for caller input, uses Default Action
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Section 2: Greeting Message */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
              <MessageSquare className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
              Greeting Message
            </h2>
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
              <span>
                {greetingMessage.length} / 500 characters
              </span>
              {greetingMessage && (
                <span>{estimateSpeakingTime(greetingMessage)}</span>
              )}
            </div>
          </div>

          <div>
            <textarea
              {...register('greeting_message')}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="Thank you for calling ABC Company. Please press 1 for Sales, 2 for Support..."
            />
            {errors.greeting_message && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.greeting_message.message}
              </p>
            )}
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              This message will be spoken before presenting menu options
            </p>
          </div>
        </div>
      </Card>

      {/* Section 3: Menu Options Builder */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Menu Options
            </h2>
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddMenuOption}
              disabled={fields.length >= 10}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Menu Option
            </Button>
          </div>

          {errors.menu_options && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded">
              <p className="text-sm text-red-600 dark:text-red-400">
                {errors.menu_options.message}
              </p>
            </div>
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={fields.map((field) => field.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-4">
                {fields.map((field, index) => (
                  <MenuOptionItem
                    key={field.id}
                    id={field.id}
                    index={index}
                    control={control}
                    register={register}
                    errors={errors}
                    onRemove={() => handleRemoveMenuOption(index)}
                    availableDigits={getAvailableDigits(menuOptions[index].digit)}
                    currentDigit={menuOptions[index].digit}
                    currentAction={menuOptions[index].action}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </Card>

      {/* Section 4: Default Action */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Default Action / Call Routing
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Where calls should be routed in the following scenarios:
          </p>

          {/* Info box */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 rounded mb-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 mr-3 flex-shrink-0" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium mb-1">This action applies when:</p>
                <ul className="space-y-1 list-disc list-inside ml-2">
                  <li><strong>IVR is disabled</strong> - All calls go directly here (no greeting/menu)</li>
                  <li><strong>Caller doesn't press a digit</strong> - After timeout period expires</li>
                  <li><strong>Invalid input</strong> - Caller presses a digit not in menu after max retries</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Action Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Action Type
              </label>
              <select
                {...register('default_action.action')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="route_to_number">Route to Phone Number</option>
                <option value="voicemail">Voicemail</option>
                <option value="trigger_webhook">Trigger Webhook</option>
                <option value="route_to_default">Route to Default</option>
              </select>
            </div>

            {/* Action Config */}
            {defaultActionType === 'route_to_number' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Phone Number
                </label>
                <Controller
                  name="default_action.config.phone_number"
                  control={control}
                  render={({ field }) => (
                    <PhoneInput
                      {...field}
                      error={errors.default_action?.config?.phone_number?.message}
                      helperText="US phone number format"
                    />
                  )}
                />
              </div>
            )}

            {defaultActionType === 'trigger_webhook' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Webhook URL (HTTPS only)
                </label>
                <input
                  type="url"
                  {...register('default_action.config.webhook_url')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="https://api.example.com/webhook"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Must use HTTPS protocol
                </p>
              </div>
            )}

            {defaultActionType === 'voicemail' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Duration (seconds)
                </label>
                <input
                  type="number"
                  {...register('default_action.config.max_duration_seconds', {
                    valueAsNumber: true,
                  })}
                  min={60}
                  max={300}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="180"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Between 60 and 300 seconds
                </p>
              </div>
            )}

            {defaultActionType === 'route_to_default' && (
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  No additional configuration needed for default routing
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Section 5: Advanced Settings */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Advanced Settings
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Timeout */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                <Clock className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                Timeout Seconds
              </label>
              <input
                type="number"
                {...register('timeout_seconds', { valueAsNumber: true })}
                min={5}
                max={60}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              {errors.timeout_seconds && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.timeout_seconds.message}
                </p>
              )}
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Time to wait for caller input (5-60 seconds)
              </p>
            </div>

            {/* Max Retries */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                <RotateCcw className="h-4 w-4 mr-2 text-purple-600 dark:text-purple-400" />
                Max Retries
              </label>
              <input
                type="number"
                {...register('max_retries', { valueAsNumber: true })}
                min={1}
                max={5}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              {errors.max_retries && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.max_retries.message}
                </p>
              )}
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Number of retry attempts for invalid input (1-5)
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-4 pb-6">
        <Button type="button" variant="secondary" onClick={handleCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <LoadingSpinner className="h-4 w-4 mr-2" />
              Saving Configuration...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Configuration
            </>
          )}
        </Button>
      </div>

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={showCancelModal}
        title="Discard Changes?"
        message="You have unsaved changes. Are you sure you want to leave this page? All changes will be lost."
        confirmText="Discard Changes"
        cancelText="Continue Editing"
        variant="danger"
        onConfirm={confirmCancel}
        onClose={() => setShowCancelModal(false)}
      />
    </form>
  );
}

/**
 * Sortable Menu Option Item
 */
interface MenuOptionItemProps {
  id: string;
  index: number;
  control: any;
  register: any;
  errors: any;
  onRemove: () => void;
  availableDigits: string[];
  currentDigit: string;
  currentAction: IVRActionType;
}

function MenuOptionItem({
  id,
  index,
  control,
  register,
  errors,
  onRemove,
  availableDigits,
  currentDigit,
  currentAction,
}: MenuOptionItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getActionIcon = (action: IVRActionType) => {
    switch (action) {
      case 'route_to_number':
        return <PhoneCall className="h-5 w-5" />;
      case 'voicemail':
        return <Voicemail className="h-5 w-5" />;
      case 'trigger_webhook':
        return <LinkIcon className="h-5 w-5" />;
      case 'route_to_default':
        return <ArrowRight className="h-5 w-5" />;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
    >
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 mt-2"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <div className="flex-1 space-y-4">
          {/* Digit and Action Type Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Digit Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Digit
              </label>
              <select
                {...register(`menu_options.${index}.digit`)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value={currentDigit}>{currentDigit}</option>
                {availableDigits.map((digit) => (
                  <option key={digit} value={digit}>
                    {digit}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Action Type
              </label>
              <select
                {...register(`menu_options.${index}.action`)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="route_to_number">Route to Phone Number</option>
                <option value="voicemail">Voicemail</option>
                <option value="trigger_webhook">Trigger Webhook</option>
                <option value="route_to_default">Route to Default</option>
              </select>
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Label
            </label>
            <input
              type="text"
              {...register(`menu_options.${index}.label`)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="e.g., Sales Department"
            />
            {errors.menu_options?.[index]?.label && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.menu_options[index].label.message}
              </p>
            )}
          </div>

          {/* Action-specific Config */}
          {currentAction === 'route_to_number' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Phone Number
              </label>
              <Controller
                name={`menu_options.${index}.config.phone_number`}
                control={control}
                render={({ field }) => (
                  <PhoneInput
                    {...field}
                    error={errors.menu_options?.[index]?.config?.phone_number?.message}
                    helperText="US phone number format"
                  />
                )}
              />
            </div>
          )}

          {currentAction === 'trigger_webhook' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Webhook URL (HTTPS only)
              </label>
              <input
                type="url"
                {...register(`menu_options.${index}.config.webhook_url`)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="https://api.example.com/webhook"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Must use HTTPS protocol
              </p>
            </div>
          )}

          {currentAction === 'voicemail' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Max Duration (seconds)
              </label>
              <input
                type="number"
                {...register(`menu_options.${index}.config.max_duration_seconds`, {
                  valueAsNumber: true,
                })}
                min={60}
                max={300}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="180"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Between 60 and 300 seconds
              </p>
            </div>
          )}

          {currentAction === 'route_to_default' && (
            <div className="p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                No additional configuration needed for default routing
              </p>
            </div>
          )}
        </div>

        {/* Remove Button */}
        <button
          type="button"
          onClick={onRemove}
          className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 mt-2"
          title="Remove option"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
