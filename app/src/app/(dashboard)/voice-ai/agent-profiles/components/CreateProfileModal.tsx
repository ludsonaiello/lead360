// ============================================================================
// Create Voice Agent Profile Modal
// ============================================================================
// Modal for creating a new voice agent profile with validation
// ============================================================================

'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import ModalContent from '@/components/ui/ModalContent';
import ModalActions from '@/components/ui/ModalActions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import voiceAiApi from '@/lib/api/voice-ai';

interface CreateProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const createProfileSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
  language_code: z.string().min(2, 'Language code must be at least 2 characters').max(10, 'Language code must be 10 characters or less'),
  voice_id: z.string().min(1, 'Voice ID is required').max(200, 'Voice ID must be 200 characters or less'),
  custom_greeting: z.string().max(500, 'Custom greeting must be 500 characters or less').optional(),
  custom_instructions: z.string().max(3000, 'Custom instructions must be 3000 characters or less').optional(),
  is_active: z.boolean().optional(),
  display_order: z.number().min(0, 'Display order must be 0 or greater').optional(),
});

type CreateProfileForm = z.infer<typeof createProfileSchema>;

export default function CreateProfileModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateProfileModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CreateProfileForm>({
    resolver: zodResolver(createProfileSchema),
    defaultValues: {
      title: '',
      language_code: '',
      voice_id: '',
      custom_greeting: '',
      custom_instructions: '',
      is_active: true,
      display_order: 0,
    },
  });

  const isActive = watch('is_active');

  async function onSubmit(data: CreateProfileForm) {
    setLoading(true);
    setError(null);

    try {
      // Remove empty optional fields
      const payload: any = {
        title: data.title.trim(),
        language_code: data.language_code.trim(),
        voice_id: data.voice_id.trim(),
        is_active: data.is_active ?? true,
        display_order: data.display_order ?? 0,
      };

      if (data.custom_greeting?.trim()) {
        payload.custom_greeting = data.custom_greeting.trim();
      }

      if (data.custom_instructions?.trim()) {
        payload.custom_instructions = data.custom_instructions.trim();
      }

      await voiceAiApi.createAgentProfile(payload);
      onSuccess();
    } catch (err: any) {
      console.error('[CreateProfileModal] Failed to create profile:', err);

      if (err.response?.status === 403) {
        setError(
          err.response.data.message ||
          'Your plan does not allow creating more profiles. Upgrade your plan to add more.'
        );
      } else if (err.response?.status === 409) {
        setError(
          err.response.data.message ||
          'A profile with this language and title already exists for your account.'
        );
      } else if (err.response?.status === 400) {
        setError(
          err.response.data.message ||
          'Invalid input. Please check all fields and try again.'
        );
      } else {
        setError('Failed to create profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Voice Agent Profile" size="lg">
      <form onSubmit={handleSubmit(onSubmit)}>
        <ModalContent>
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title *
              </label>
              <Input
                type="text"
                {...register('title')}
                placeholder="e.g., Main Agent, Spanish Support"
                className={errors.title ? 'border-red-500' : ''}
                disabled={loading}
              />
              {errors.title && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.title.message}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Human-readable name for this profile (1-100 characters)
              </p>
            </div>

            {/* Language Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Language Code *
              </label>
              <Input
                type="text"
                {...register('language_code')}
                placeholder="e.g., en, es, pt"
                onChange={(e) => {
                  setValue('language_code', e.target.value.toLowerCase());
                }}
                className={errors.language_code ? 'border-red-500' : ''}
                disabled={loading}
              />
              {errors.language_code && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  {errors.language_code.message}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                BCP-47 language code (e.g., en, pt, es, fr, de)
              </p>
            </div>

            {/* Voice ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Voice ID *
              </label>
              <Input
                type="text"
                {...register('voice_id')}
                placeholder="e.g., 694f9389-aac1-45b6-b726-9d9369183238"
                className={errors.voice_id ? 'border-red-500' : ''}
                disabled={loading}
              />
              {errors.voice_id && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  {errors.voice_id.message}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Provider-specific TTS voice identifier (e.g., Cartesia voice UUID)
              </p>
            </div>

            {/* Custom Greeting */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Custom Greeting (Optional)
              </label>
              <Textarea
                {...register('custom_greeting')}
                placeholder="Hello! How can I help you today?"
                rows={2}
                className={errors.custom_greeting ? 'border-red-500' : ''}
                disabled={loading}
              />
              {errors.custom_greeting && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  {errors.custom_greeting.message}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Overrides tenant default greeting for this profile (max 500 characters)
              </p>
            </div>

            {/* Custom Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Custom Instructions (Optional)
              </label>
              <Textarea
                {...register('custom_instructions')}
                placeholder="Additional instructions for this profile..."
                rows={3}
                className={errors.custom_instructions ? 'border-red-500' : ''}
                disabled={loading}
              />
              {errors.custom_instructions && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  {errors.custom_instructions.message}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Appends to tenant-level instructions (max 3000 characters)
              </p>
            </div>

            {/* Display Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Display Order
              </label>
              <Input
                type="number"
                min="0"
                {...register('display_order', { valueAsNumber: true })}
                disabled={loading}
              />
              {errors.display_order && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  {errors.display_order.message}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Sort order in UI dropdowns (lower = earlier)
              </p>
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-2">
              <ToggleSwitch
                checked={isActive ?? true}
                onChange={(checked) => setValue('is_active', checked)}
                label="Active"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Inactive profiles cannot be selected in new IVR configs
              </p>
            </div>
          </div>
        </ModalContent>

        <ModalActions>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Profile'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  );
}
