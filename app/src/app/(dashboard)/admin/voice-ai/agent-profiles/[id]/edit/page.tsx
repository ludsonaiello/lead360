// ============================================================================
// Edit Global Voice Agent Profile Page (Platform Admin)
// ============================================================================
// Form to edit existing global language/voice template
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { voiceAiAdminApi } from '@/lib/api/voice-ai-admin';
import type { GlobalAgentProfile, UpdateGlobalProfileDto } from '@/lib/types/voice-ai';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

export default function EditGlobalProfilePage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuth();
  const profileId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<GlobalAgentProfile | null>(null);
  const [formData, setFormData] = useState<UpdateGlobalProfileDto>({
    language_code: '',
    language_name: '',
    voice_id: '',
    voice_provider_type: 'tts',
    display_name: '',
    description: '',
    default_greeting: '',
    default_instructions: '',
    is_active: true,
    display_order: 0,
  });

  /**
   * Load existing profile
   */
  useEffect(() => {
    const loadProfile = async () => {
      if (!profileId) return;

      setLoading(true);
      try {
        const data = await voiceAiAdminApi.globalProfiles.get(profileId);
        setProfile(data);

        // Populate form
        setFormData({
          language_code: data.language_code,
          language_name: data.language_name,
          voice_id: data.voice_id,
          voice_provider_type: data.voice_provider_type,
          display_name: data.display_name,
          description: data.description || '',
          default_greeting: data.default_greeting || '',
          default_instructions: data.default_instructions || '',
          is_active: data.is_active,
          display_order: data.display_order,
        });
      } catch (error: any) {
        console.error('[EditGlobalProfilePage] Failed to load profile:', error);
        toast.error(error?.message || 'Failed to load profile');
        router.push('/admin/voice-ai/agent-profiles');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [profileId, router]);

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await voiceAiAdminApi.globalProfiles.update(profileId, formData);
      toast.success('Global profile updated successfully');
      router.push('/admin/voice-ai/agent-profiles');
    } catch (error: any) {
      console.error('[EditGlobalProfilePage] Failed to update profile:', error);
      toast.error(error?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle input change
   */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData({ ...formData, [name]: checked });
    } else if (type === 'number') {
      setFormData({ ...formData, [name]: parseInt(value) || 0 });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // Check if user is platform admin
  if (!user?.is_platform_admin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Platform Admin access required
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Not found
  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Profile Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            The profile you're looking for doesn't exist
          </p>
          <Button
            className="mt-4"
            onClick={() => router.push('/admin/voice-ai/agent-profiles')}
          >
            Back to Profiles
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          Edit Global Voice Agent Profile
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Update language/voice template: {profile.display_name}
        </p>
        {profile._count && profile._count.tenant_overrides > 0 && (
          <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
            ⚠️ This profile is used by {profile._count.tenant_overrides} tenant(s)
          </p>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6 space-y-6">
          {/* Language Code */}
          <div>
            <label
              htmlFor="language_code"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Language Code <span className="text-red-500">*</span>
            </label>
            <Input
              id="language_code"
              name="language_code"
              value={formData.language_code}
              onChange={handleChange}
              placeholder="en"
              required
              maxLength={10}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              ISO 639-1 code (e.g., en, pt, es, fr)
            </p>
          </div>

          {/* Language Name */}
          <div>
            <label
              htmlFor="language_name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Language Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="language_name"
              name="language_name"
              value={formData.language_name}
              onChange={handleChange}
              placeholder="English"
              required
              maxLength={100}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Human-readable language name
            </p>
          </div>

          {/* Voice ID */}
          <div>
            <label
              htmlFor="voice_id"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Voice ID <span className="text-red-500">*</span>
            </label>
            <Input
              id="voice_id"
              name="voice_id"
              value={formData.voice_id}
              onChange={handleChange}
              placeholder="2b568345-1f36-4cf8-baa7-5932856bf66a"
              required
              maxLength={200}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              TTS provider voice identifier (UUID from Cartesia, ElevenLabs, etc.)
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label
              htmlFor="display_name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Display Name <span className="text-red-500">*</span>
            </label>
            <Input
              id="display_name"
              name="display_name"
              value={formData.display_name}
              onChange={handleChange}
              placeholder="English - Professional"
              required
              maxLength={100}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Unique name shown to users (must be unique across all profiles)
            </p>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Description
            </label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Professional English voice for business calls"
              rows={3}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Optional explanation shown in UI tooltips
            </p>
          </div>

          {/* Default Greeting */}
          <div>
            <label
              htmlFor="default_greeting"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Default Greeting
            </label>
            <Textarea
              id="default_greeting"
              name="default_greeting"
              value={formData.default_greeting}
              onChange={handleChange}
              placeholder="Hello, thank you for calling {business_name}! How can I help you today?"
              rows={2}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Template greeting (use {'{business_name}'} placeholder)
            </p>
          </div>

          {/* Default Instructions */}
          <div>
            <label
              htmlFor="default_instructions"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Default Instructions
            </label>
            <Textarea
              id="default_instructions"
              name="default_instructions"
              value={formData.default_instructions}
              onChange={handleChange}
              placeholder="You are a professional phone assistant. Be concise, friendly, and helpful. Keep responses under 20 seconds."
              rows={4}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              LLM system prompt for this language/voice
            </p>
          </div>

          {/* Display Order */}
          <div>
            <label
              htmlFor="display_order"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Display Order
            </label>
            <Input
              id="display_order"
              name="display_order"
              type="number"
              value={formData.display_order}
              onChange={handleChange}
              min={0}
              max={9999}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Sort order in UI (lower numbers appear first)
            </p>
          </div>

          {/* Active Checkbox */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="is_active"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label
              htmlFor="is_active"
              className="text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Active (available to tenants)
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.back()}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
