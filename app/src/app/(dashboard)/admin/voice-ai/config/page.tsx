/**
 * Voice AI Global Config Admin Page
 * Sprint FSA03 — Admin Global Config
 * Route: /admin/voice-ai/config
 *
 * Platform-wide Voice AI defaults: providers, LiveKit, behavior, languages, tools, quotas.
 */

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bot,
  Server,
  Globe,
  Wrench,
  Zap,
  Key,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Info,
} from 'lucide-react';
import {
  getVoiceAiGlobalConfig,
  getVoiceAiProviders,
  updateVoiceAiGlobalConfig,
  regenerateAgentKey,
} from '@/lib/api/voice-ai-admin';
import type { VoiceAiProvider, VoiceAiGlobalConfig } from '@/lib/types/voice-ai-admin';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { toast } from 'react-hot-toast';

// ─── JSON Schema Types ───────────────────────────────────────────────────────

interface SchemaProperty {
  type: 'string' | 'boolean' | 'number' | 'integer';
  title?: string;
  description?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  default?: unknown;
}

interface ConfigSchema {
  type: string;
  properties: Record<string, SchemaProperty>;
  required?: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
];

const CALL_DURATION_OPTIONS = [
  { value: '300', label: '5 minutes' },
  { value: '600', label: '10 minutes' },
  { value: '900', label: '15 minutes' },
  { value: '1800', label: '30 minutes' },
];

const TRANSFER_BEHAVIOR_OPTIONS = [
  { value: 'end_call', label: 'Politely end the call' },
  { value: 'voicemail', label: 'Ask caller to leave a message (future)' },
  { value: 'hold', label: 'Place on hold (future)' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeParseJson<T>(value: unknown, fallback: T): T {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  if (value !== null && typeof value === 'object') {
    return value as T;
  }
  return fallback;
}

function parseConfigSchema(schemaStr: string | null): ConfigSchema | null {
  if (!schemaStr) return null;
  try {
    return JSON.parse(schemaStr) as ConfigSchema;
  } catch {
    return null;
  }
}

// ─── Section Wrapper ─────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex items-start gap-3">
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex-shrink-0">
          <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>
      <div className="px-6 py-6 space-y-5">{children}</div>
    </div>
  );
}

// ─── Dynamic Config Editor ────────────────────────────────────────────────────

function DynamicConfigEditor({
  schema,
  values,
  onChange,
}: {
  schema: ConfigSchema;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}) {
  const entries = Object.entries(schema.properties || {});

  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 italic">
        No configurable options for this provider.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map(([key, prop]) => {
        const currentValue = values[key];
        const label = prop.title || key;
        const hint = prop.description;

        if (prop.type === 'string' && prop.enum && prop.enum.length > 0) {
          return (
            <Select
              key={key}
              label={label}
              helperText={hint}
              options={prop.enum.map((v) => ({ value: v, label: v }))}
              value={String(currentValue ?? prop.default ?? prop.enum[0])}
              onChange={(v) => onChange({ ...values, [key]: v })}
            />
          );
        }

        if (prop.type === 'boolean') {
          return (
            <div key={key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
                {hint && <p className="text-sm text-gray-500 dark:text-gray-400">{hint}</p>}
              </div>
              <ToggleSwitch
                enabled={Boolean(currentValue ?? prop.default ?? false)}
                onChange={(v) => onChange({ ...values, [key]: v })}
              />
            </div>
          );
        }

        if (prop.type === 'number' || prop.type === 'integer') {
          return (
            <Input
              key={key}
              label={label}
              type="number"
              helperText={hint}
              step={prop.type === 'integer' ? 1 : undefined}
              min={prop.minimum}
              max={prop.maximum}
              value={String(currentValue ?? prop.default ?? '')}
              onChange={(e) =>
                onChange({
                  ...values,
                  [key]:
                    prop.type === 'integer'
                      ? parseInt(e.target.value, 10)
                      : parseFloat(e.target.value),
                })
              }
            />
          );
        }

        // Default: string input
        return (
          <Input
            key={key}
            label={label}
            helperText={hint}
            value={String(currentValue ?? prop.default ?? '')}
            onChange={(e) => onChange({ ...values, [key]: e.target.value })}
          />
        );
      })}
    </div>
  );
}

// ─── Regenerate Key Modal ─────────────────────────────────────────────────────

function RegenerateKeyModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<'confirm' | 'reveal'>('confirm');
  const [loading, setLoading] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setStep('confirm');
    setNewKey('');
    setCopied(false);
    setConfirmed(false);
    setError('');
    onClose();
  };

  const handleRegenerate = async () => {
    try {
      setLoading(true);
      setError('');
      const result = await regenerateAgentKey();
      setNewKey(result.plain_key);
      setStep('reveal');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setError(e?.response?.data?.message || e?.message || 'Failed to regenerate key');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'confirm' ? (
          <>
            <div className="flex items-center gap-3 p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-full">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Regenerate Agent API Key</h2>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Regenerating will <strong>immediately invalidate</strong> the existing key. The Python
                agent will stop authenticating until you update it with the new key.
              </p>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                  Update your agent deployment immediately after copying the new key.
                </p>
              </div>
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
              )}
            </div>

            <div className="flex gap-2 justify-end p-6 border-t border-gray-200 dark:border-gray-700">
              <Button variant="ghost" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleRegenerate} disabled={loading}>
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span className="ml-2">Regenerating...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Regenerate
                  </>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-full">
                <Key className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">New API Key Generated</h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-800 dark:text-red-200 font-semibold">
                  This key will NEVER be shown again. Copy it now.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Agent API Key
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-3 font-mono text-gray-900 dark:text-gray-100 break-all select-all">
                    {newKey}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="p-2.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800 flex-shrink-0 transition-colors"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  I have copied and securely stored the API key. I understand it cannot be recovered.
                </span>
              </label>
            </div>

            <div className="flex justify-end p-6 border-t border-gray-200 dark:border-gray-700">
              <Button onClick={handleClose} disabled={!confirmed}>
                Done
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Form State Type ─────────────────────────────────────────────────────────

interface FormState {
  // Section 1: AI Providers
  default_stt_provider_id: string;
  default_llm_provider_id: string;
  default_tts_provider_id: string;
  default_voice_id: string;
  // Section 3: LiveKit
  livekit_sip_trunk_url: string;
  livekit_api_key: string;
  livekit_api_secret: string;
  // Section 4: Default Behavior
  default_language: string;
  default_languages: string[];
  default_greeting_template: string;
  default_system_prompt: string;
  default_max_call_duration_seconds: number;
  default_transfer_behavior: string;
  // Section 5: Tools
  tools_lead_creation: boolean;
  tools_booking: boolean;
  tools_call_transfer: boolean;
  // Section 6: Performance
  max_concurrent_calls: number;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function VoiceAiGlobalConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState<VoiceAiProvider[]>([]);
  const [config, setConfig] = useState<VoiceAiGlobalConfig | null>(null);

  // Section 2: Dynamic configs per provider
  const [sttConfig, setSttConfig] = useState<Record<string, unknown>>({});
  const [llmConfig, setLlmConfig] = useState<Record<string, unknown>>({});
  const [ttsConfig, setTtsConfig] = useState<Record<string, unknown>>({});

  // Form state
  const [form, setForm] = useState<FormState>({
    default_stt_provider_id: '',
    default_llm_provider_id: '',
    default_tts_provider_id: '',
    default_voice_id: '',
    livekit_sip_trunk_url: '',
    livekit_api_key: '',
    livekit_api_secret: '',
    default_language: 'en',
    default_languages: ['en'],
    default_greeting_template: '',
    default_system_prompt: '',
    default_max_call_duration_seconds: 600,
    default_transfer_behavior: 'end_call',
    tools_lead_creation: true,
    tools_booking: true,
    tools_call_transfer: true,
    max_concurrent_calls: 100,
  });

  // Validation errors
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // Modal state
  const [errorModal, setErrorModal] = useState({ isOpen: false, title: '', message: '' });
  const [showRegenModal, setShowRegenModal] = useState(false);

  // Ref for "original" config (for diff on save)
  const originalConfig = useRef<VoiceAiGlobalConfig | null>(null);
  const originalSttConfig = useRef<Record<string, unknown>>({});
  const originalLlmConfig = useRef<Record<string, unknown>>({});
  const originalTtsConfig = useRef<Record<string, unknown>>({});

  // ─── Load Data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [cfg, provs] = await Promise.all([getVoiceAiGlobalConfig(), getVoiceAiProviders()]);

      setConfig(cfg);
      setProviders(provs);
      originalConfig.current = cfg;

      // Parse JSON strings from API
      const langs = safeParseJson<string[]>(cfg.default_languages, ['en']);
      const tools = safeParseJson<{ lead_creation: boolean; booking: boolean; call_transfer: boolean }>(
        cfg.default_tools_enabled,
        { lead_creation: true, booking: true, call_transfer: true }
      );
      const sttCfg = safeParseJson<Record<string, unknown>>(cfg.default_stt_config, {});
      const llmCfg = safeParseJson<Record<string, unknown>>(cfg.default_llm_config, {});
      const ttsCfg = safeParseJson<Record<string, unknown>>(cfg.default_tts_config, {});

      setSttConfig(sttCfg);
      setLlmConfig(llmCfg);
      setTtsConfig(ttsCfg);
      originalSttConfig.current = sttCfg;
      originalLlmConfig.current = llmCfg;
      originalTtsConfig.current = ttsCfg;

      setForm({
        default_stt_provider_id: cfg.default_stt_provider_id ?? '',
        default_llm_provider_id: cfg.default_llm_provider_id ?? '',
        default_tts_provider_id: cfg.default_tts_provider_id ?? '',
        default_voice_id: cfg.default_voice_id ?? '',
        livekit_sip_trunk_url: cfg.livekit_sip_trunk_url ?? '',
        livekit_api_key: '',
        livekit_api_secret: '',
        default_language: cfg.default_language ?? 'en',
        default_languages: langs,
        default_greeting_template: cfg.default_greeting_template ?? '',
        default_system_prompt: cfg.default_system_prompt ?? '',
        default_max_call_duration_seconds: cfg.default_max_call_duration_seconds ?? 600,
        default_transfer_behavior: cfg.default_transfer_behavior ?? 'end_call',
        tools_lead_creation: tools.lead_creation ?? true,
        tools_booking: tools.booking ?? true,
        tools_call_transfer: tools.call_transfer ?? true,
        max_concurrent_calls: cfg.max_concurrent_calls ?? 100,
      });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setErrorModal({
        isOpen: true,
        title: 'Failed to Load Configuration',
        message: e?.response?.data?.message || e?.message || 'Could not load Voice AI configuration.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Derived Data ───────────────────────────────────────────────────────────

  const sttProviders = providers.filter((p) => p.provider_type === 'STT' && p.is_active);
  const llmProviders = providers.filter((p) => p.provider_type === 'LLM' && p.is_active);
  const ttsProviders = providers.filter((p) => p.provider_type === 'TTS' && p.is_active);

  const selectedSttProvider = providers.find((p) => p.id === form.default_stt_provider_id);
  const selectedLlmProvider = providers.find((p) => p.id === form.default_llm_provider_id);
  const selectedTtsProvider = providers.find((p) => p.id === form.default_tts_provider_id);

  const sttSchema = parseConfigSchema(selectedSttProvider?.config_schema ?? null);
  const llmSchema = parseConfigSchema(selectedLlmProvider?.config_schema ?? null);
  const ttsSchema = parseConfigSchema(selectedTtsProvider?.config_schema ?? null);

  // ─── Form Helpers ───────────────────────────────────────────────────────────

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  // ─── Validate ───────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormState, string>> = {};

    if (form.default_languages.length === 0) {
      newErrors.default_languages = 'Select at least one supported language';
    }

    if (form.default_voice_id && form.default_voice_id.length > 100) {
      newErrors.default_voice_id = 'Voice ID must be at most 100 characters';
    }

    if (form.default_greeting_template.length > 500) {
      newErrors.default_greeting_template = 'Greeting template must be at most 500 characters';
    }

    if (form.default_system_prompt.length > 2000) {
      newErrors.default_system_prompt = 'System prompt must be at most 2000 characters';
    }

    if (isNaN(form.max_concurrent_calls) || form.max_concurrent_calls < 1 || form.max_concurrent_calls > 1000) {
      newErrors.max_concurrent_calls = 'Must be between 1 and 1000';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ─── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Please fix the validation errors before saving.');
      return;
    }

    try {
      setSaving(true);

      const orig = originalConfig.current;
      // Build diff — only send changed fields
      const payload: Parameters<typeof updateVoiceAiGlobalConfig>[0] = {};

      if (!orig || form.default_stt_provider_id !== (orig.default_stt_provider_id ?? ''))
        payload.default_stt_provider_id = form.default_stt_provider_id || undefined;

      if (!orig || form.default_llm_provider_id !== (orig.default_llm_provider_id ?? ''))
        payload.default_llm_provider_id = form.default_llm_provider_id || undefined;

      if (!orig || form.default_tts_provider_id !== (orig.default_tts_provider_id ?? ''))
        payload.default_tts_provider_id = form.default_tts_provider_id || undefined;

      if (!orig || form.default_voice_id !== (orig.default_voice_id ?? ''))
        payload.default_voice_id = form.default_voice_id;

      if (!orig || form.livekit_sip_trunk_url !== (orig.livekit_sip_trunk_url ?? ''))
        payload.livekit_sip_trunk_url = form.livekit_sip_trunk_url;

      // Only send LiveKit secrets if user entered something
      if (form.livekit_api_key) payload.livekit_api_key = form.livekit_api_key;
      if (form.livekit_api_secret) payload.livekit_api_secret = form.livekit_api_secret;

      if (!orig || form.default_language !== orig.default_language)
        payload.default_language = form.default_language;

      // default_languages — compare sorted arrays, send as JSON string
      const origLangs = safeParseJson<string[]>(orig?.default_languages ?? null, ['en']);
      if (JSON.stringify([...form.default_languages].sort()) !== JSON.stringify([...origLangs].sort()))
        payload.default_languages = JSON.stringify(form.default_languages);

      if (!orig || form.default_greeting_template !== orig.default_greeting_template)
        payload.default_greeting_template = form.default_greeting_template;

      if (!orig || form.default_system_prompt !== orig.default_system_prompt)
        payload.default_system_prompt = form.default_system_prompt;

      if (!orig || form.default_max_call_duration_seconds !== orig.default_max_call_duration_seconds)
        payload.default_max_call_duration_seconds = form.default_max_call_duration_seconds;

      if (!orig || form.default_transfer_behavior !== orig.default_transfer_behavior)
        payload.default_transfer_behavior = form.default_transfer_behavior as
          | 'end_call'
          | 'voicemail'
          | 'hold';

      // default_tools_enabled — compare field-by-field (avoids JSON key-order issues), send as JSON string
      const origTools = safeParseJson<{ lead_creation: boolean; booking: boolean; call_transfer: boolean }>(
        orig?.default_tools_enabled ?? null,
        { lead_creation: true, booking: true, call_transfer: true }
      );
      const newTools = {
        lead_creation: form.tools_lead_creation,
        booking: form.tools_booking,
        call_transfer: form.tools_call_transfer,
      };
      const toolsChanged =
        newTools.lead_creation !== origTools.lead_creation ||
        newTools.booking !== origTools.booking ||
        newTools.call_transfer !== origTools.call_transfer;
      if (toolsChanged)
        payload.default_tools_enabled = JSON.stringify(newTools);

      if (!orig || form.max_concurrent_calls !== orig.max_concurrent_calls)
        payload.max_concurrent_calls = form.max_concurrent_calls;

      // Dynamic provider configs — send as JSON strings
      if (JSON.stringify(sttConfig) !== JSON.stringify(originalSttConfig.current))
        payload.default_stt_config = JSON.stringify(sttConfig);
      if (JSON.stringify(llmConfig) !== JSON.stringify(originalLlmConfig.current))
        payload.default_llm_config = JSON.stringify(llmConfig);
      if (JSON.stringify(ttsConfig) !== JSON.stringify(originalTtsConfig.current))
        payload.default_tts_config = JSON.stringify(ttsConfig);

      if (Object.keys(payload).length === 0) {
        toast.success('No changes to save.');
        return;
      }

      const updated = await updateVoiceAiGlobalConfig(payload);
      setConfig(updated);
      originalConfig.current = updated;

      // Reset password fields
      setForm((prev) => ({ ...prev, livekit_api_key: '', livekit_api_secret: '' }));

      // Sync refs
      const newSttCfg = safeParseJson<Record<string, unknown>>(updated.default_stt_config, {});
      const newLlmCfg = safeParseJson<Record<string, unknown>>(updated.default_llm_config, {});
      const newTtsCfg = safeParseJson<Record<string, unknown>>(updated.default_tts_config, {});
      originalSttConfig.current = newSttCfg;
      originalLlmConfig.current = newLlmCfg;
      originalTtsConfig.current = newTtsCfg;

      toast.success('Global configuration saved successfully.');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      setErrorModal({
        isOpen: true,
        title: 'Save Failed',
        message: e?.response?.data?.message || e?.message || 'Could not save configuration.',
      });
    } finally {
      setSaving(false);
    }
  };

  // ─── Loading State ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <LoadingSpinner />
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Voice AI Global Config</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Platform-wide defaults for the Voice AI system. Tenants can override these per their settings.
        </p>
      </div>

      {/* ── Section 1: AI Providers ─────────────────────────────────────────── */}
      <Section
        icon={Bot}
        title="AI Providers"
        description="Default providers used by all tenants unless overridden."
      >
        <Select
          label="Default STT Provider (Speech-to-Text)"
          options={[
            { value: '', label: 'None selected' },
            ...sttProviders.map((p) => ({ value: p.id, label: p.display_name })),
          ]}
          value={form.default_stt_provider_id}
          onChange={(v) => {
            setField('default_stt_provider_id', v);
            setSttConfig({});
          }}
          placeholder="Select STT provider"
          helperText={sttProviders.length === 0 ? 'No active STT providers. Add one in the Providers page.' : undefined}
        />

        <Select
          label="Default LLM Provider (Language Model)"
          options={[
            { value: '', label: 'None selected' },
            ...llmProviders.map((p) => ({ value: p.id, label: p.display_name })),
          ]}
          value={form.default_llm_provider_id}
          onChange={(v) => {
            setField('default_llm_provider_id', v);
            setLlmConfig({});
          }}
          placeholder="Select LLM provider"
          helperText={llmProviders.length === 0 ? 'No active LLM providers. Add one in the Providers page.' : undefined}
        />

        <Select
          label="Default TTS Provider (Text-to-Speech)"
          options={[
            { value: '', label: 'None selected' },
            ...ttsProviders.map((p) => ({ value: p.id, label: p.display_name })),
          ]}
          value={form.default_tts_provider_id}
          onChange={(v) => {
            setField('default_tts_provider_id', v);
            setTtsConfig({});
          }}
          placeholder="Select TTS provider"
          helperText={ttsProviders.length === 0 ? 'No active TTS providers. Add one in the Providers page.' : undefined}
        />

        <Input
          label="Default Voice ID"
          value={form.default_voice_id}
          onChange={(e) => setField('default_voice_id', e.target.value)}
          placeholder="e.g. a0e99841-438c-4a64-b679-ae501e7d6091"
          helperText="Voice ID from your TTS provider. For Cartesia: find UUIDs at cartesia.ai/voices"
          error={errors.default_voice_id}
          maxLength={100}
        />
      </Section>

      {/* ── Section 2: Dynamic Provider Config ─────────────────────────────── */}
      {(sttSchema || llmSchema || ttsSchema) && (
        <Section
          icon={Wrench}
          title="Default Provider Config"
          description="Per-provider configuration that drives the AI agent's behavior."
        >
          {sttSchema && selectedSttProvider && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                STT Config — {selectedSttProvider.display_name}
              </h3>
              <div className="pl-4 border-l-2 border-blue-200 dark:border-blue-700">
                <DynamicConfigEditor
                  schema={sttSchema}
                  values={sttConfig}
                  onChange={setSttConfig}
                />
              </div>
            </div>
          )}

          {llmSchema && selectedLlmProvider && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                LLM Config — {selectedLlmProvider.display_name}
              </h3>
              <div className="pl-4 border-l-2 border-green-200 dark:border-green-700">
                <DynamicConfigEditor
                  schema={llmSchema}
                  values={llmConfig}
                  onChange={setLlmConfig}
                />
              </div>
            </div>
          )}

          {ttsSchema && selectedTtsProvider && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                TTS Config — {selectedTtsProvider.display_name}
              </h3>
              <div className="pl-4 border-l-2 border-purple-200 dark:border-purple-700">
                <DynamicConfigEditor
                  schema={ttsSchema}
                  values={ttsConfig}
                  onChange={setTtsConfig}
                />
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ── Section 3: LiveKit Infrastructure ──────────────────────────────── */}
      <Section
        icon={Server}
        title="LiveKit Infrastructure"
        description="Configure the LiveKit SIP trunk and API credentials for call routing."
      >
        <Input
          label="LiveKit SIP Trunk URL"
          value={form.livekit_sip_trunk_url}
          onChange={(e) => setField('livekit_sip_trunk_url', e.target.value)}
          placeholder="sip.livekit.cloud"
          helperText="The SIP address where inbound calls are routed to the AI agent"
        />

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3 flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Leave password fields empty to keep existing values. Enter a new value to update.
          </p>
        </div>

        <Input
          label="LiveKit API Key"
          type="password"
          value={form.livekit_api_key}
          onChange={(e) => setField('livekit_api_key', e.target.value)}
          placeholder={config?.livekit_api_key_set ? '✓ Configured — enter new value to update' : 'Enter LiveKit API key'}
          helperText={config?.livekit_api_key_set ? 'API key is currently configured.' : 'Not configured yet.'}
        />

        <Input
          label="LiveKit API Secret"
          type="password"
          value={form.livekit_api_secret}
          onChange={(e) => setField('livekit_api_secret', e.target.value)}
          placeholder={config?.livekit_api_secret_set ? '✓ Configured — enter new value to update' : 'Enter LiveKit API secret'}
          helperText={config?.livekit_api_secret_set ? 'API secret is currently configured.' : 'Not configured yet.'}
        />
      </Section>

      {/* ── Section 4: Default Behavior ────────────────────────────────────── */}
      <Section
        icon={Globe}
        title="Default Behavior"
        description="Language, greeting, system prompt, and call handling defaults."
      >
        <Select
          label="Default Language"
          options={LANGUAGE_OPTIONS}
          value={form.default_language}
          onChange={(v) => setField('default_language', v)}
        />

        <MultiSelect
          label="Supported Languages"
          options={LANGUAGE_OPTIONS}
          value={form.default_languages}
          onChange={(v) => setField('default_languages', v)}
          helperText="Languages tenants can enable. Select all that should be available platform-wide."
          error={errors.default_languages}
          searchable
        />

        <Textarea
          label="Default Greeting Template"
          value={form.default_greeting_template}
          onChange={(e) => setField('default_greeting_template', e.target.value)}
          placeholder="Hello, thank you for calling {business_name}! How can I help you today?"
          helperText="Use {business_name} as a placeholder for the tenant's business name"
          showCharacterCount
          maxLength={500}
          rows={3}
          error={errors.default_greeting_template}
        />

        <Textarea
          label="Default System Prompt"
          value={form.default_system_prompt}
          onChange={(e) => setField('default_system_prompt', e.target.value)}
          placeholder="You are a helpful phone assistant. Be concise, friendly, and professional."
          helperText="Base instructions for the AI agent. Tenants can add their own instructions on top."
          showCharacterCount
          maxLength={2000}
          rows={5}
          error={errors.default_system_prompt}
        />

        <Select
          label="Default Max Call Duration"
          options={CALL_DURATION_OPTIONS}
          value={String(form.default_max_call_duration_seconds)}
          onChange={(v) => setField('default_max_call_duration_seconds', parseInt(v, 10))}
        />

        <Select
          label="Default Transfer Behavior"
          options={TRANSFER_BEHAVIOR_OPTIONS}
          value={form.default_transfer_behavior}
          onChange={(v) => setField('default_transfer_behavior', v)}
          helperText="What to do when no transfer number is available"
        />
      </Section>

      {/* ── Section 5: Default Enabled Tools ───────────────────────────────── */}
      <Section
        icon={Zap}
        title="Default Enabled Tools"
        description="Tools available to the AI agent by default. Tenants can override per their settings."
      >
        <div className="space-y-4 divide-y divide-gray-100 dark:divide-gray-700">
          <div className="flex items-start justify-between py-2">
            <div className="flex-1 pr-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Lead Creation</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Create a lead record when a new caller contacts the business.
              </p>
            </div>
            <ToggleSwitch
              enabled={form.tools_lead_creation}
              onChange={(v) => setField('tools_lead_creation', v)}
            />
          </div>

          <div className="flex items-start justify-between py-4">
            <div className="flex-1 pr-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Appointment Booking</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Book appointments or service requests during calls.
              </p>
            </div>
            <ToggleSwitch
              enabled={form.tools_booking}
              onChange={(v) => setField('tools_booking', v)}
            />
          </div>

          <div className="flex items-start justify-between py-4">
            <div className="flex-1 pr-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Call Transfer</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Transfer calls to the tenant&apos;s specified phone numbers.
              </p>
            </div>
            <ToggleSwitch
              enabled={form.tools_call_transfer}
              onChange={(v) => setField('tools_call_transfer', v)}
            />
          </div>
        </div>
      </Section>

      {/* ── Section 6: Performance + Agent Auth ────────────────────────────── */}
      <Section
        icon={Key}
        title="Performance & Agent Auth"
        description="Platform-wide call limits and the API key used by the Python agent."
      >
        <Input
          label="Max Concurrent Calls"
          type="number"
          min={1}
          max={1000}
          value={String(form.max_concurrent_calls)}
          onChange={(e) => setField('max_concurrent_calls', parseInt(e.target.value, 10))}
          helperText="Platform-wide limit on simultaneous active calls (1–1000)"
          error={errors.max_concurrent_calls}
        />

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Agent API Key</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Used by the Python voice agent to authenticate API calls.
              </p>
              {config?.agent_api_key_preview ? (
                <p className="text-sm font-mono text-gray-700 dark:text-gray-300 mt-1">
                  Current key ends with:{' '}
                  <strong className="text-blue-600 dark:text-blue-400">{config.agent_api_key_preview}</strong>
                </p>
              ) : (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-1 font-medium">
                  No agent API key configured.
                </p>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                Last updated: {config?.updated_at ? new Date(config.updated_at).toLocaleDateString() : 'Never'}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => setShowRegenModal(true)}
              className="flex-shrink-0"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate Key
            </Button>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-600 dark:text-gray-400">
              This key is used by the Python agent to authenticate with the API. Store it securely and
              never commit it to version control.
            </p>
          </div>
        </div>
      </Section>

      {/* ── Save Button ────────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-3 py-4">
        <Button
          variant="secondary"
          onClick={loadData}
          disabled={saving || loading}
        >
          Discard Changes
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || loading}
        >
          {saving ? (
            <>
              <LoadingSpinner size="sm" />
              <span className="ml-2">Saving...</span>
            </>
          ) : (
            'Save Configuration'
          )}
        </Button>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <ErrorModal
        isOpen={errorModal.isOpen}
        onClose={() => setErrorModal({ isOpen: false, title: '', message: '' })}
        title={errorModal.title}
        message={errorModal.message}
      />

      <RegenerateKeyModal
        isOpen={showRegenModal}
        onClose={() => {
          setShowRegenModal(false);
          // Reload to get updated preview
          loadData();
        }}
      />
    </div>
  );
}
