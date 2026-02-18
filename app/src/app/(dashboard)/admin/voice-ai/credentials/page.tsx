/**
 * AI Provider Credentials Page — Admin Only
 * Sprint FSA02 — Voice AI Admin
 * Route: /admin/voice-ai/credentials
 *
 * Securely manage encrypted API keys for each AI provider.
 * Keys are never displayed — only masked previews shown.
 * Also surfaces the "Regenerate Agent API Key" action.
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Key,
  ShieldCheck,
  ShieldOff,
  RefreshCw,
  Copy,
  AlertTriangle,
  CheckCircle2,
  Search,
  X,
  ChevronDown,
} from 'lucide-react';
import {
  getVoiceAiProviders,
  getVoiceAiCredentials,
  setVoiceAiCredential,
  deleteVoiceAiCredential,
  regenerateAgentKey,
  getVoiceAiGlobalConfig,
} from '@/lib/api/voice-ai-admin';
import type { VoiceAiProvider, VoiceAiCredential, VoiceAiGlobalConfig } from '@/lib/types/voice-ai-admin';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_BADGE_VARIANT = {
  STT: 'blue',
  LLM: 'green',
  TTS: 'purple',
} as const satisfies Record<string, 'blue' | 'green' | 'purple'>;

type TypeFilter = 'all' | 'STT' | 'LLM' | 'TTS';
type StatusFilter = 'all' | 'configured' | 'missing';

// ─── Page component ──────────────────────────────────────────────────────────

export default function VoiceAiCredentialsPage() {
  const [providers, setProviders] = useState<VoiceAiProvider[]>([]);
  const [credentials, setCredentials] = useState<VoiceAiCredential[]>([]);
  const [config, setConfig] = useState<VoiceAiGlobalConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Set key modal
  const [setKeyProvider, setSetKeyProvider] = useState<VoiceAiProvider | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [setKeyError, setSetKeyError] = useState<string | null>(null);

  // Remove key confirm
  const [removeKeyProvider, setRemoveKeyProvider] = useState<VoiceAiProvider | null>(null);
  const [removingKey, setRemovingKey] = useState(false);

  // Regenerate agent key
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [newPlainKey, setNewPlainKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [providersData, credentialsData, configData] = await Promise.all([
        getVoiceAiProviders(),
        getVoiceAiCredentials(),
        getVoiceAiGlobalConfig(),
      ]);
      setProviders(providersData);
      setCredentials(credentialsData);
      setConfig(configData);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Failed to load data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Credential lookup ────────────────────────────────────────────────────────

  const getCredentialForProvider = useCallback(
    (providerId: string): VoiceAiCredential | undefined =>
      credentials.find((c) => c.provider_id === providerId),
    [credentials]
  );

  // ── Active providers missing credentials (for warning banner) ────────────────

  const activeProvidersMissingCreds = useMemo(
    () => providers.filter((p) => p.is_active && !getCredentialForProvider(p.id)),
    [providers, getCredentialForProvider]
  );

  // ── Filtered list ────────────────────────────────────────────────────────────

  const filteredProviders = useMemo(() => {
    const q = search.trim().toLowerCase();

    return providers.filter((p) => {
      // Type filter
      if (typeFilter !== 'all' && p.provider_type !== typeFilter) return false;

      // Status filter
      const isConfigured = !!getCredentialForProvider(p.id);
      if (statusFilter === 'configured' && !isConfigured) return false;
      if (statusFilter === 'missing' && isConfigured) return false;

      // Search
      if (q) {
        return (
          p.display_name.toLowerCase().includes(q) ||
          p.provider_key.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [providers, search, typeFilter, statusFilter, getCredentialForProvider]);

  const hasActiveFilters =
    search.trim() !== '' || typeFilter !== 'all' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setStatusFilter('all');
  };

  // ── Set API Key ──────────────────────────────────────────────────────────────

  const openSetKeyModal = (provider: VoiceAiProvider) => {
    setSetKeyProvider(provider);
    setApiKeyInput('');
    setSetKeyError(null);
  };

  const handleSaveKey = async () => {
    if (!setKeyProvider) return;
    if (!apiKeyInput.trim()) {
      setSetKeyError('API key is required');
      return;
    }
    setSavingKey(true);
    try {
      const updated = await setVoiceAiCredential(setKeyProvider.id, apiKeyInput.trim());
      setCredentials((prev) => {
        const exists = prev.find((c) => c.provider_id === setKeyProvider.id);
        if (exists) {
          return prev.map((c) => (c.provider_id === setKeyProvider.id ? updated : c));
        }
        return [...prev, updated];
      });
      setSetKeyProvider(null);
      setApiKeyInput('');
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Failed to save API key';
      // Close the set-key modal and surface error via ErrorModal (sprint rule: ErrorModal on all API failures)
      setSetKeyProvider(null);
      setApiKeyInput('');
      setSetKeyError(null);
      setError(msg);
    } finally {
      setSavingKey(false);
    }
  };

  // ── Remove API Key ───────────────────────────────────────────────────────────

  const handleRemoveKey = async () => {
    if (!removeKeyProvider) return;
    setRemovingKey(true);
    try {
      await deleteVoiceAiCredential(removeKeyProvider.id);
      setCredentials((prev) => prev.filter((c) => c.provider_id !== removeKeyProvider.id));
      setRemoveKeyProvider(null);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Failed to remove API key';
      setError(msg);
      setRemoveKeyProvider(null);
    } finally {
      setRemovingKey(false);
    }
  };

  // ── Regenerate Agent Key ─────────────────────────────────────────────────────

  const handleRegenerateKey = async () => {
    setRegenerating(true);
    setShowRegenConfirm(false);
    try {
      const result = await regenerateAgentKey();
      setNewPlainKey(result.plain_key);
      setCopied(false);
      const updatedConfig = await getVoiceAiGlobalConfig();
      setConfig(updatedConfig);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Failed to regenerate key';
      setError(msg);
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopyKey = async () => {
    if (!newPlainKey) return;
    try {
      await navigator.clipboard.writeText(newPlainKey);
      setCopied(true);
    } catch {
      // Clipboard API unavailable (e.g. HTTP context, permissions denied).
      // User can manually select and copy from the read-only textarea.
    }
  };

  // ─── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <LoadingSpinner />
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          AI Provider Credentials
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage encrypted API keys for AI providers. Keys are stored encrypted and are never displayed.
        </p>
      </div>

      {/* ── Warning Banner ─────────────────────────────────────────────────────── */}
      {activeProvidersMissingCreds.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            ⚠️ {activeProvidersMissingCreds.length} active provider
            {activeProvidersMissingCreds.length > 1 ? 's' : ''} missing credentials.
            The agent cannot function without credentials.
          </p>
        </div>
      )}

      {/* ── Toolbar (search + filters) ──────────────────────────────────────────── */}
      {providers.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or provider key…"
              className="w-full h-9 pl-9 pr-8 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

          {/* Type filter */}
          <div className="relative shrink-0">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer transition-shadow"
            >
              <option value="all">All Types</option>
              <option value="STT">STT — Speech-to-Text</option>
              <option value="LLM">LLM — Language Model</option>
              <option value="TTS">TTS — Text-to-Speech</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

          {/* Status filter */}
          <div className="relative shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer transition-shadow"
            >
              <option value="all">All Status</option>
              <option value="configured">Configured</option>
              <option value="missing">Missing Key</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

          {/* Count */}
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap shrink-0">
            {filteredProviders.length === providers.length
              ? `${providers.length} provider${providers.length !== 1 ? 's' : ''}`
              : `${filteredProviders.length} of ${providers.length}`}
          </span>

          {/* Clear */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 whitespace-nowrap shrink-0 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* ── Provider Cards ─────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {/* No providers at all */}
        {providers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
            <Key className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              No providers configured
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Add providers in the Providers tab first.
            </p>
          </div>
        )}

        {/* Filters returned nothing */}
        {providers.length > 0 && filteredProviders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
            <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              No providers match your filters
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
              Try adjusting the search or filters.
            </p>
            <Button variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        )}

        {/* Provider cards */}
        {filteredProviders.map((provider) => {
          const cred = getCredentialForProvider(provider.id);
          return (
            <ProviderCredentialCard
              key={provider.id}
              provider={provider}
              credential={cred}
              isConfigured={!!cred}
              onSetKey={() => openSetKeyModal(provider)}
              onRemoveKey={() => setRemoveKeyProvider(provider)}
            />
          );
        })}
      </div>

      {/* ── Agent API Key Section ───────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-500" />
              Voice Agent API Key
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              This key is used by the Python Voice AI agent to authenticate with Lead360&apos;s internal API.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setShowRegenConfirm(true)}
            disabled={regenerating}
          >
            {regenerating ? (
              <LoadingSpinner />
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate Key
              </>
            )}
          </Button>
        </div>

        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="text-sm text-gray-700 dark:text-gray-300 font-mono">
            {config?.agent_api_key_preview
              ? <>Current key: <span className="font-semibold">{config.agent_api_key_preview}</span></>
              : <span className="text-gray-400 italic">Not generated yet</span>}
          </p>
        </div>
      </div>

      {/* ── Set API Key Modal ───────────────────────────────────────────────────── */}
      {setKeyProvider && (
        <Modal
          isOpen
          onClose={() => {
            setSetKeyProvider(null);
            setApiKeyInput('');
            setSetKeyError(null);
          }}
          title={`Set API Key — ${setKeyProvider.display_name}`}
          size="md"
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="api_key_input"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                API Key <span className="text-red-500">*</span>
              </label>
              <input
                id="api_key_input"
                type="password"
                autoComplete="new-password"
                value={apiKeyInput}
                onChange={(e) => {
                  setApiKeyInput(e.target.value);
                  if (setKeyError) setSetKeyError(null);
                }}
                placeholder="Paste your API key here"
                className={`w-full px-3 py-2 rounded-lg border text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none transition-colors focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                  setKeyError
                    ? 'border-red-400 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {setKeyError && (
                <p className="text-xs text-red-500 dark:text-red-400">{setKeyError}</p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Your key will be encrypted before storage. You cannot retrieve it after saving.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSetKeyProvider(null);
                  setApiKeyInput('');
                  setSetKeyError(null);
                }}
                disabled={savingKey}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveKey} disabled={savingKey}>
                {savingKey ? 'Saving…' : 'Save Key'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Remove Key Confirm ──────────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={!!removeKeyProvider}
        onClose={() => setRemoveKeyProvider(null)}
        onConfirm={handleRemoveKey}
        title="Remove API Key"
        message={`Remove the stored API key for ${removeKeyProvider?.display_name}? The agent will stop working for this provider until a new key is set.`}
        confirmText="Remove Key"
        variant="danger"
        loading={removingKey}
      />

      {/* ── Regenerate Key Confirm ──────────────────────────────────────────────── */}
      <ConfirmModal
        isOpen={showRegenConfirm}
        onClose={() => setShowRegenConfirm(false)}
        onConfirm={handleRegenerateKey}
        title="Regenerate Agent API Key"
        message="Regenerating the key will immediately invalidate the current key. The Python agent will stop working until it is updated with the new key."
        confirmText="Regenerate"
        variant="danger"
      />

      {/* ── One-Time Key Display Modal ──────────────────────────────────────────── */}
      {newPlainKey && (
        <Modal
          isOpen
          onClose={() => {
            setNewPlainKey(null);
            setCopied(false);
          }}
          title="New Agent API Key Generated"
          size="md"
        >
          <div className="space-y-5">
            <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                ⚠️ Copy this key now. It will <strong>NOT</strong> be shown again.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Your new API key:
              </label>
              <textarea
                readOnly
                value={newPlainKey}
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm resize-none select-all"
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
              <button
                onClick={handleCopyKey}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy to clipboard
                  </>
                )}
              </button>

              <Button
                onClick={() => {
                  setNewPlainKey(null);
                  setCopied(false);
                }}
              >
                I have copied the key
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Error Modal ─────────────────────────────────────────────────────────── */}
      <ErrorModal
        isOpen={!!error}
        onClose={() => setError(null)}
        title="Error"
        message={error ?? ''}
      />
    </div>
  );
}

// ─── Provider Credential Card ────────────────────────────────────────────────

interface ProviderCredentialCardProps {
  provider: VoiceAiProvider;
  credential: VoiceAiCredential | undefined;
  isConfigured: boolean;
  onSetKey: () => void;
  onRemoveKey: () => void;
}

function ProviderCredentialCard({
  provider,
  credential,
  isConfigured,
  onSetKey,
  onRemoveKey,
}: ProviderCredentialCardProps) {
  const typeVariant = TYPE_BADGE_VARIANT[provider.provider_type] ?? 'neutral';

  return (
    <div
      className={`bg-white dark:bg-gray-800 border rounded-xl overflow-hidden transition-all ${
        isConfigured
          ? 'border-green-200 dark:border-green-800'
          : provider.is_active
          ? 'border-red-200 dark:border-red-800'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* Card body */}
      <div className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: Provider info */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {/* Icon */}
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
              isConfigured
                ? 'bg-green-100 dark:bg-green-900/30'
                : 'bg-gray-100 dark:bg-gray-700'
            }`}
          >
            {isConfigured ? (
              <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : (
              <ShieldOff className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                {provider.display_name}
              </span>
              <Badge variant={typeVariant}>{provider.provider_type}</Badge>
              {!provider.is_active && <Badge variant="neutral">Inactive</Badge>}
            </div>

            <div className="mt-1.5">
              {isConfigured && credential ? (
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  <span className="text-sm text-green-700 dark:text-green-400 font-mono">
                    {credential.masked_key}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-gray-400 dark:text-gray-500">✗ No key set</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button size="sm" variant="secondary" onClick={onSetKey}>
            <Key className="w-3.5 h-3.5 mr-1.5" />
            {isConfigured ? 'Update Key' : 'Set API Key'}
          </Button>
          {isConfigured && (
            <button
              onClick={onRemoveKey}
              className="text-sm text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:underline px-2 py-1 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Footer: last updated */}
      {isConfigured && credential && (
        <div className="px-5 py-2.5 bg-gray-50 dark:bg-gray-900/40 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Last updated: {new Date(credential.updated_at).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}
