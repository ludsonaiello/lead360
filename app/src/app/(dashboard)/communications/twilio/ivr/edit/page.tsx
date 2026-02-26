/**
 * IVR Configuration Create/Edit Page (Sprint IVR-4)
 * Complex form for configuring Interactive Voice Response menus
 *
 * Features:
 * - Upsert pattern (single endpoint for create/update)
 * - Multi-level menu builder with recursive MenuTreeBuilder
 * - Form validation with Zod (recursive schema)
 * - Dirty state tracking with navigation warnings
 * - RBAC enforcement (Owner, Admin only)
 * - Mobile responsive
 * - Dark mode support
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'react-hot-toast';
import {
  Save,
  X,
  AlertCircle,
  Clock,
  RotateCcw,
  MessageSquare,
  Info,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { MenuTreeBuilder } from '@/components/ivr/MenuTreeBuilder';

import { getIVRConfiguration, upsertIVRConfiguration } from '@/lib/api/ivr';
import { validateIVRMenuTree } from '@/lib/utils/ivr-validation';
import { IVR_CONSTANTS, type IVRFormData } from '@/lib/types/ivr';
import { useAuth } from '@/contexts/AuthContext';
import { getAccessToken } from '@/lib/utils/token';

// Recursive menu option schema for multi-level IVR
// NOTE: This schema is lenient for form-time validation (allows empty strings, etc.)
// Strict validation happens on submit via validateIVRMenuTree
const ivrMenuOptionSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    digit: z.string(), // Lenient - allows empty during editing
    action: z.enum([
      'route_to_number',
      'route_to_default',
      'trigger_webhook',
      'voicemail',
      'voice_ai',
      'submenu',
      'return_to_parent',
      'return_to_root',
    ]),
    label: z.string(), // Lenient - allows empty during editing
    config: z.object({
      phone_number: z.string().optional(),
      // Handle empty strings for URL - empty string is valid for optional fields
      webhook_url: z.preprocess(
        (val) => (val === '' || val === null || val === undefined) ? undefined : val,
        z.string().url().optional()
      ),
      max_duration_seconds: z.preprocess(
        (val) => (val === '' || val === null || val === undefined) ? undefined : val,
        z.number().min(60).max(300).optional()
      ),
    }),
    submenu: z
      .object({
        greeting_message: z.string(), // Lenient - allows empty during editing
        options: z.array(ivrMenuOptionSchema).min(1).max(10),
        timeout_seconds: z.preprocess(
          (val) => (val === '' || val === null || val === undefined) ? undefined : val,
          z.number().min(5).max(60).optional()
        ),
      })
      .optional(),
  })
  .refine(
    (data) => {
      // If action is submenu, must have submenu config
      if (data.action === 'submenu') {
        return !!data.submenu && data.submenu.options.length > 0;
      }
      // If action is NOT submenu, must NOT have submenu config
      return !data.submenu;
    },
    { message: 'Submenu config must match action type' }
  )
);

const ivrFormSchema = z.object({
  ivr_enabled: z.boolean(),
  greeting_message: z.string(), // Lenient - strict validation on submit
  menu_options: z.array(ivrMenuOptionSchema).min(1).max(10),
  default_action: z.object({
    action: z.enum([
      'route_to_number',
      'route_to_default',
      'trigger_webhook',
      'voicemail',
      'voice_ai',
    ]),
    config: z.object({
      phone_number: z.string().optional(),
      webhook_url: z.preprocess(
        (val) => (val === '' || val === null || val === undefined) ? undefined : val,
        z.string().url().optional()
      ),
      max_duration_seconds: z.preprocess(
        (val) => (val === '' || val === null || val === undefined) ? undefined : val,
        z.number().optional()
      ),
    }),
  }),
  timeout_seconds: z.number().min(5).max(60),
  max_retries: z.number().min(1).max(5),
  max_depth: z.number().min(1).max(5).optional(),
});

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

  // Form with FormProvider for MenuTreeBuilder
  const methods = useForm<IVRFormData>({
    resolver: zodResolver(ivrFormSchema),
    defaultValues: {
      ivr_enabled: true,
      greeting_message: '',
      menu_options: [
        {
          id: crypto.randomUUID(),
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
      max_depth: 4,
    },
  });

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors, dirtyFields },
    reset,
  } = methods;

  // Watch form values
  const greetingMessage = watch('greeting_message');
  const defaultActionType = watch('default_action.action');
  const maxDepth = watch('max_depth');
  const menuOptions = watch('menu_options');

  // DEBUG: Log form errors whenever they change
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      console.log('🔴 FORM VALIDATION ERRORS DETECTED:', {
        errorKeys: Object.keys(errors),
        errors: errors,
        menuOptionsError: errors.menu_options,
        menuOptionsErrorMessage: errors.menu_options?.message,
        menuOptionsErrorType: errors.menu_options?.type,
        currentMenuOptions: menuOptions,
        currentMenuOptionsCount: menuOptions?.length || 0,
      });
    } else {
      console.log('✅ NO FORM ERRORS');
    }
  }, [errors, menuOptions]);

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

  // Helper: Recursively add UUIDs to menu options if missing
  const ensureMenuOptionsHaveIds = (options: any[]): any[] => {
    return options.map(option => {
      const optionWithId = {
        ...option,
        id: option.id || crypto.randomUUID(), // Add UUID if missing
      };

      // Recursively process submenu options
      if (optionWithId.submenu?.options) {
        optionWithId.submenu.options = ensureMenuOptionsHaveIds(optionWithId.submenu.options);
      }

      return optionWithId;
    });
  };

  const loadConfig = async () => {
    try {
      console.log('📥 LOADING CONFIG...');
      setLoading(true);
      setError(null);
      const token = getAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }
      const data = await getIVRConfiguration(token);
      console.log('📥 API Response:', data);

      if (data) {
        // Ensure all menu options have UUIDs (backend might not provide them)
        const menuOptionsWithIds = ensureMenuOptionsHaveIds(data.menu_options);

        console.log('✏️ EDIT MODE - Populating form with:', {
          ivr_enabled: data.ivr_enabled,
          greeting_message: data.greeting_message,
          menu_options_count: menuOptionsWithIds?.length || 0,
          menu_options: menuOptionsWithIds,
          default_action: data.default_action,
          timeout_seconds: data.timeout_seconds,
          max_retries: data.max_retries,
          max_depth: data.max_depth || 4,
        });

        setIsEdit(true);
        reset({
          ivr_enabled: data.ivr_enabled,
          greeting_message: data.greeting_message,
          menu_options: menuOptionsWithIds, // Now with guaranteed UUIDs
          default_action: data.default_action,
          timeout_seconds: data.timeout_seconds,
          max_retries: data.max_retries,
          max_depth: data.max_depth || 4,
        });

        console.log('✅ Form reset complete');
      } else {
        // Create mode - keep defaults
        console.log('➕ CREATE MODE - Using default values');
        setIsEdit(false);
      }
    } catch (error: any) {
      console.error('❌ ERROR loading IVR config:', error);
      setError(error.message || 'Failed to load IVR configuration');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: IVRFormData) => {
    try {
      console.log('📤 SUBMIT HANDLER CALLED');
      console.log('📋 Form Data:', {
        ivr_enabled: data.ivr_enabled,
        greeting_message: data.greeting_message,
        menu_options_count: data.menu_options?.length || 0,
        menu_options: data.menu_options,
        default_action: data.default_action,
        timeout_seconds: data.timeout_seconds,
        max_retries: data.max_retries,
        max_depth: data.max_depth,
      });

      setSaving(true);
      const token = getAccessToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Add client-side validation
      console.log('🔍 Running validateIVRMenuTree with:', {
        menu_options: data.menu_options,
        max_depth: data.max_depth || 4,
      });

      const { isValid, errors: validationErrors } = validateIVRMenuTree(
        data.menu_options,
        data.max_depth || 4
      );

      console.log('🔍 Validation Result:', {
        isValid,
        validationErrors,
        errorCount: validationErrors.length,
      });

      if (!isValid) {
        console.error('❌ VALIDATION FAILED:', validationErrors);
        toast.error(`Validation Error: ${validationErrors.join(', ')}`);
        return;
      }

      console.log('✅ Validation passed, calling API...');
      await upsertIVRConfiguration(token, data);
      console.log('✅ API call successful');
      toast.success('IVR configuration saved successfully');
      setIsDirty(false);
      router.push('/communications/twilio/ivr');
    } catch (error: any) {
      console.error('❌ ERROR in onSubmit:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        error: error,
      });
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
    <FormProvider {...methods}>
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
      {Object.keys(errors).length > 0 && (() => {
        console.log('🚨 RENDERING ERROR SUMMARY SECTION');
        console.log('Error details being displayed:', {
          errorCount: Object.keys(errors).length,
          errorKeys: Object.keys(errors),
          ivr_enabled: errors.ivr_enabled?.message,
          greeting_message: errors.greeting_message?.message,
          menu_options: errors.menu_options?.message,
          default_action: errors.default_action?.message,
          timeout_seconds: errors.timeout_seconds?.message,
          max_retries: errors.max_retries?.message,
        });
        return (
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
                    {errors.menu_options && <li>{errors.menu_options.message || '(empty error message)'}</li>}
                    {errors.default_action && <li>{errors.default_action.message}</li>}
                    {errors.timeout_seconds && <li>{errors.timeout_seconds.message}</li>}
                    {errors.max_retries && <li>{errors.max_retries.message}</li>}
                  </ul>
                </div>
              </div>
            </div>
          </Card>
        );
      })()}

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

      {/* Section 3: Menu Options Builder - Multi-Level Support */}
      <Card>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Menu Options
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Configure your IVR menu structure. You can create up to {maxDepth || 4} levels of nested submenus.
              </p>
            </div>
          </div>

          {errors.menu_options && (() => {
            console.log('🚨 RENDERING MENU VALIDATION ERROR SECTION');
            console.log('Menu options error details:', {
              message: errors.menu_options.message,
              type: errors.menu_options.type,
              hasMessage: !!errors.menu_options.message,
              messageLength: errors.menu_options.message?.length || 0,
              includesBullets: errors.menu_options.message?.includes('•'),
              fullError: errors.menu_options,
            });
            return (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-2 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                      Menu Validation Error
                    </p>
                    {errors.menu_options.message?.includes('•') ? (
                      <ul className="text-sm text-red-600 dark:text-red-400 space-y-1 list-disc list-inside">
                        {errors.menu_options.message.split(' • ').map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {errors.menu_options.message || '(No error message provided)'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          <MenuTreeBuilder
            parentPath="menu_options"
            level={1}
            maxDepth={maxDepth || 4}
          />
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

            {/* Max Depth */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                <Info className="h-4 w-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                Maximum Menu Depth
              </label>
              <input
                type="number"
                {...register('max_depth', { valueAsNumber: true })}
                min={1}
                max={5}
                defaultValue={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              {errors.max_depth && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.max_depth.message}
                </p>
              )}
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Controls how many levels of nested submenus are allowed (1-5)
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
    </FormProvider>
  );
}
