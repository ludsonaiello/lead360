/**
 * Voice AI Admin — Tenants & Plans Page
 * Sprint FSA04: Per-Tenant Overrides + Plan Flags
 *
 * Tab 1: Tenants — table with usage bars and override modal
 * Tab 2: Plans   — inline-editable plan voice config
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Search,
  Bot,
  X,
  Building2,
  Sliders,
  CheckCircle,
  XCircle,
  MinusCircle,
  Save,
  AlertTriangle,
} from 'lucide-react';
import {
  getTenantsVoiceAiOverview,
  getVoiceAiProviders,
  overrideTenantVoiceSettings,
  getPlansWithVoiceConfig,
  updatePlanVoiceConfig,
} from '@/lib/api/voice-ai-admin';
import type {
  TenantVoiceAiOverview,
  VoiceAiProvider,
  PlanWithVoiceConfig,
  AdminOverrideRequest,
} from '@/lib/types/voice-ai-admin';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Modal, ModalContent, ModalActions } from '@/components/ui/Modal';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { Button } from '@/components/ui/Button';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'tenants' | 'plans';

interface OverrideFormState {
  force_enabled: '' | 'true' | 'false'; // '' = null (plan default)
  monthly_minutes_override: string; // '' = null, otherwise a number string
  stt_provider_override_id: string; // '' = null
  llm_provider_override_id: string;
  tts_provider_override_id: string;
  admin_notes: string;
}

interface PlanRowEdit {
  voice_ai_enabled: boolean;
  voice_ai_minutes_included: number;
  voice_ai_overage_rate: string; // '' = null (block), otherwise $/min
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Resolve total pages from API meta (handles both camelCase and snake_case). */
function resolveTotalPages(meta: Record<string, unknown>, limit: number): number {
  if (typeof meta.totalPages === 'number') return meta.totalPages;
  if (typeof meta.total_pages === 'number') return meta.total_pages as number;
  if (typeof meta.total === 'number') return Math.ceil((meta.total as number) / limit);
  return 1;
}

function UsageBar({ used, included, isEnabled }: { used: number; included: number; isEnabled: boolean }) {
  if (!isEnabled && included === 0) {
    return <span className="text-xs text-gray-400 dark:text-gray-500">—</span>;
  }
  if (included === 0) {
    return <span className="text-xs text-gray-400 dark:text-gray-500">No limit set</span>;
  }
  const pct = Math.min(100, Math.round((used / included) * 100));
  const color =
    pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-blue-500';
  return (
    <div className="w-full min-w-[120px]">
      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
        <span>{used} min</span>
        <span>{included} min</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-right text-xs text-gray-400 dark:text-gray-500 mt-0.5">{pct}%</div>
    </div>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default function VoiceAiTenantsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('tenants');

  // ── Tenants tab state
  const [tenants, setTenants] = useState<TenantVoiceAiOverview[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [tenantsPage, setTenantsPage] = useState(1);
  const [tenantsTotalPages, setTenantsTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const TENANTS_LIMIT = 20;

  // ── Providers (for override modal dropdowns)
  const [providers, setProviders] = useState<VoiceAiProvider[]>([]);

  // ── Override modal state
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideTenant, setOverrideTenant] = useState<TenantVoiceAiOverview | null>(null);
  const [overrideForm, setOverrideForm] = useState<OverrideFormState>({
    force_enabled: '',
    monthly_minutes_override: '',
    stt_provider_override_id: '',
    llm_provider_override_id: '',
    tts_provider_override_id: '',
    admin_notes: '',
  });
  const [overrideSaving, setOverrideSaving] = useState(false);

  // ── Plans tab state
  const [plans, setPlans] = useState<PlanWithVoiceConfig[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [planEdits, setPlanEdits] = useState<Record<string, PlanRowEdit>>({});
  const [planSaving, setPlanSaving] = useState<Record<string, boolean>>({});

  // ── Error modal
  const [errorModal, setErrorModal] = useState({ open: false, title: '', message: '' });
  const showError = (title: string, message: string) =>
    setErrorModal({ open: true, title, message });

  // ── Load tenants
  const loadTenants = async () => {
    try {
      setTenantsLoading(true);
      const response = await getTenantsVoiceAiOverview({
        page: tenantsPage,
        limit: TENANTS_LIMIT,
        search: search || undefined,
      });
      setTenants(response.data);
      setTenantsTotalPages(
        resolveTotalPages(response.meta as unknown as Record<string, unknown>, TENANTS_LIMIT)
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load tenants';
      showError('Load Failed', msg);
    } finally {
      setTenantsLoading(false);
    }
  };

  // ── Load providers (once on mount)
  const loadProviders = async () => {
    try {
      const data = await getVoiceAiProviders();
      setProviders(data);
    } catch {
      // Non-critical — override modal will just have empty selects
    }
  };

  // ── Load plans
  const loadPlans = async () => {
    try {
      setPlansLoading(true);
      const data = await getPlansWithVoiceConfig();
      setPlans(data);
      const edits: Record<string, PlanRowEdit> = {};
      for (const p of data) {
        edits[p.id] = {
          voice_ai_enabled: p.voice_ai_enabled,
          voice_ai_minutes_included: p.voice_ai_minutes_included,
          voice_ai_overage_rate:
            p.voice_ai_overage_rate !== null ? String(p.voice_ai_overage_rate) : '',
        };
      }
      setPlanEdits(edits);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load plans';
      showError('Load Failed', msg);
    } finally {
      setPlansLoading(false);
    }
  };

  // Load providers once on mount (no deps needed, function is stable)
  useEffect(() => {
    loadProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload tenants whenever page or search changes (also runs on mount)
  useEffect(() => {
    loadTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantsPage, search]);

  // Load plans when tab becomes active (lazy)
  useEffect(() => {
    if (activeTab === 'plans' && plans.length === 0) {
      loadPlans();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // ── Search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTenantsPage(1);
    setSearch(searchInput);
  };

  const handleSearchClear = () => {
    setSearchInput('');
    setSearch('');
    setTenantsPage(1);
  };

  // ── Open override modal
  const openOverrideModal = (tenant: TenantVoiceAiOverview) => {
    setOverrideTenant(tenant);
    // Reset form to empty (we don't have existing override values in the tenant overview)
    setOverrideForm({
      force_enabled: '',
      monthly_minutes_override: '',
      stt_provider_override_id: '',
      llm_provider_override_id: '',
      tts_provider_override_id: '',
      admin_notes: '',
    });
    setOverrideModalOpen(true);
  };

  // ── Save override
  const handleOverrideSave = async () => {
    if (!overrideTenant) return;

    // Guard: force-enabling a non-voice-plan tenant with no minutes override results in 0 minutes
    if (
      overrideForm.force_enabled === 'true' &&
      overrideTenant.voice_ai_included_in_plan === false &&
      (overrideForm.monthly_minutes_override === '' ||
        Number(overrideForm.monthly_minutes_override) <= 0)
    ) {
      showError(
        'Minutes Override Required',
        "This tenant's plan does not include Voice AI. You must set a Monthly Minutes Override greater than 0 — otherwise the tenant will be enabled but unable to make any calls."
      );
      return;
    }

    try {
      setOverrideSaving(true);
      const dto: AdminOverrideRequest = {
        force_enabled:
          overrideForm.force_enabled === 'true'
            ? true
            : overrideForm.force_enabled === 'false'
            ? false
            : null,
        monthly_minutes_override:
          overrideForm.monthly_minutes_override !== ''
            ? Number(overrideForm.monthly_minutes_override)
            : null,
        stt_provider_override_id:
          overrideForm.stt_provider_override_id || null,
        llm_provider_override_id:
          overrideForm.llm_provider_override_id || null,
        tts_provider_override_id:
          overrideForm.tts_provider_override_id || null,
        admin_notes: overrideForm.admin_notes || null,
      };
      await overrideTenantVoiceSettings(overrideTenant.tenant_id, dto);
      setOverrideModalOpen(false);
      setOverrideTenant(null);
      await loadTenants();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save override';
      showError('Override Failed', msg);
    } finally {
      setOverrideSaving(false);
    }
  };

  // ── Save plan row
  const handlePlanSave = async (planId: string) => {
    const edit = planEdits[planId];
    if (!edit) return;
    try {
      setPlanSaving((s) => ({ ...s, [planId]: true }));
      const dto = {
        voice_ai_enabled: edit.voice_ai_enabled,
        voice_ai_minutes_included: edit.voice_ai_minutes_included,
        voice_ai_overage_rate:
          edit.voice_ai_overage_rate !== '' ? Number(edit.voice_ai_overage_rate) : null,
      };
      const updated = await updatePlanVoiceConfig(planId, dto);
      // Update local plan data
      setPlans((prev) => prev.map((p) => (p.id === planId ? updated : p)));
      setPlanEdits((prev) => ({
        ...prev,
        [planId]: {
          voice_ai_enabled: updated.voice_ai_enabled,
          voice_ai_minutes_included: updated.voice_ai_minutes_included,
          voice_ai_overage_rate:
            updated.voice_ai_overage_rate !== null
              ? String(updated.voice_ai_overage_rate)
              : '',
        },
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update plan';
      showError('Update Failed', msg);
    } finally {
      setPlanSaving((s) => ({ ...s, [planId]: false }));
    }
  };

  // ── Helpers
  const sttProviders = providers.filter((p) => p.provider_type === 'STT' && p.is_active);
  const llmProviders = providers.filter((p) => p.provider_type === 'LLM' && p.is_active);
  const ttsProviders = providers.filter((p) => p.provider_type === 'TTS' && p.is_active);

  const selectClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg ' +
    'bg-white dark:bg-gray-800 text-gray-900 dark:text-white ' +
    'focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg ' +
    'bg-white dark:bg-gray-800 text-gray-900 dark:text-white ' +
    'focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
            <Bot className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Voice AI — Tenants &amp; Plans
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
              Per-tenant overrides and subscription plan voice AI configuration
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-6">
          {(['tenants', 'plans'] as TabId[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'tenants' ? 'Tenants' : 'Plans'}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab: Tenants ─────────────────────────────────────────────────────── */}
      {activeTab === 'tenants' && (
        <div className="space-y-4">
          {/* Search */}
          <Card className="p-4">
            <form onSubmit={handleSearchSubmit} className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by company name..."
                  className={`${inputClass} pl-9`}
                />
              </div>
              <Button type="submit" size="sm">
                Search
              </Button>
              {search && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleSearchClear}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </form>
          </Card>

          {/* Table */}
          <Card className="overflow-hidden">
            {tenantsLoading ? (
              <div className="flex justify-center py-16">
                <LoadingSpinner size="lg" />
              </div>
            ) : tenants.length === 0 ? (
              <div className="text-center py-16">
                <Building2 className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                <p className="text-gray-500 dark:text-gray-400">No tenants found</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        {['Tenant', 'Plan', 'Voice AI on Plan', 'Status', 'Usage', 'Override', 'Actions'].map(
                          (h) => (
                            <th
                              key={h}
                              className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                      {tenants.map((t) => (
                        <tr
                          key={t.tenant_id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                        >
                          {/* Tenant */}
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {t.company_name}
                              </span>
                            </div>
                          </td>

                          {/* Plan */}
                          <td className="px-4 py-4 text-sm text-gray-700 dark:text-gray-300">
                            {t.plan_name || '—'}
                          </td>

                          {/* Voice AI on Plan */}
                          <td className="px-4 py-4">
                            {t.voice_ai_included_in_plan ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <CheckCircle className="w-3 h-3" />
                                Included
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                <XCircle className="w-3 h-3" />
                                Not Included
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-4">
                            {t.is_enabled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                <CheckCircle className="w-3 h-3" />
                                Enabled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                <MinusCircle className="w-3 h-3" />
                                Disabled
                              </span>
                            )}
                          </td>

                          {/* Usage */}
                          <td className="px-4 py-4 min-w-[160px]">
                            <UsageBar used={t.minutes_used} included={t.minutes_included} isEnabled={t.is_enabled} />
                          </td>

                          {/* Override badge */}
                          <td className="px-4 py-4">
                            {t.has_admin_override ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                <Sliders className="w-3 h-3" />
                                Override
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-4">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openOverrideModal(t)}
                            >
                              <Sliders className="w-3.5 h-3.5 mr-1.5" />
                              Configure
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
                  {tenants.map((t) => (
                    <div key={t.tenant_id} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {t.company_name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{t.plan_name}</p>
                          </div>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openOverrideModal(t)}
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {t.voice_ai_included_in_plan ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle className="w-3 h-3" />
                            Included
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                            <XCircle className="w-3 h-3" />
                            Not Included
                          </span>
                        )}
                        {t.is_enabled ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                            Disabled
                          </span>
                        )}
                        {t.has_admin_override && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                            <Sliders className="w-3 h-3" />
                            Override
                          </span>
                        )}
                      </div>

                      <UsageBar used={t.minutes_used} included={t.minutes_included} isEnabled={t.is_enabled} />
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {tenantsTotalPages > 1 && (
                  <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
                    <PaginationControls
                      currentPage={tenantsPage}
                      totalPages={tenantsTotalPages}
                      onNext={() => setTenantsPage((p) => Math.min(tenantsTotalPages, p + 1))}
                      onPrevious={() => setTenantsPage((p) => Math.max(1, p - 1))}
                      onGoToPage={setTenantsPage}
                    />
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      )}

      {/* ── Tab: Plans ───────────────────────────────────────────────────────── */}
      {activeTab === 'plans' && (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            {plansLoading ? (
              <div className="flex justify-center py-16">
                <LoadingSpinner size="lg" />
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 dark:text-gray-400">No subscription plans found</p>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        {['Plan Name', 'Voice AI Enabled', 'Minutes Included', 'Overage Rate ($/min)', 'Actions'].map(
                          (h) => (
                            <th
                              key={h}
                              className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                      {plans.map((plan) => {
                        const edit = planEdits[plan.id];
                        if (!edit) return null;
                        const isSaving = planSaving[plan.id] ?? false;
                        return (
                          <tr
                            key={plan.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                          >
                            {/* Plan Name */}
                            <td className="px-4 py-4">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {plan.name}
                              </span>
                            </td>

                            {/* Voice AI Enabled toggle */}
                            <td className="px-4 py-4">
                              <ToggleSwitch
                                enabled={edit.voice_ai_enabled}
                                onChange={(val) =>
                                  setPlanEdits((prev) => ({
                                    ...prev,
                                    [plan.id]: { ...prev[plan.id], voice_ai_enabled: val },
                                  }))
                                }
                                disabled={isSaving}
                              />
                            </td>

                            {/* Minutes Included */}
                            <td className="px-4 py-4">
                              <input
                                type="number"
                                min={0}
                                value={edit.voice_ai_minutes_included}
                                onChange={(e) =>
                                  setPlanEdits((prev) => ({
                                    ...prev,
                                    [plan.id]: {
                                      ...prev[plan.id],
                                      voice_ai_minutes_included: Number(e.target.value),
                                    },
                                  }))
                                }
                                disabled={isSaving}
                                className={`${inputClass} w-28`}
                              />
                            </td>

                            {/* Overage Rate */}
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  placeholder="Block when over"
                                  value={edit.voice_ai_overage_rate}
                                  onChange={(e) =>
                                    setPlanEdits((prev) => ({
                                      ...prev,
                                      [plan.id]: {
                                        ...prev[plan.id],
                                        voice_ai_overage_rate: e.target.value,
                                      },
                                    }))
                                  }
                                  disabled={isSaving}
                                  className={`${inputClass} w-36`}
                                />
                                {!edit.voice_ai_overage_rate && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                    (blocked)
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Save */}
                            <td className="px-4 py-4">
                              <Button
                                size="sm"
                                onClick={() => handlePlanSave(plan.id)}
                                loading={isSaving}
                                disabled={isSaving}
                              >
                                <Save className="w-3.5 h-3.5 mr-1.5" />
                                Save
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile plan cards */}
                <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
                  {plans.map((plan) => {
                    const edit = planEdits[plan.id];
                    if (!edit) return null;
                    const isSaving = planSaving[plan.id] ?? false;
                    return (
                      <div key={plan.id} className="p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">
                            {plan.name}
                          </span>
                          <Button
                            size="sm"
                            onClick={() => handlePlanSave(plan.id)}
                            loading={isSaving}
                            disabled={isSaving}
                          >
                            <Save className="w-3.5 h-3.5 mr-1" />
                            Save
                          </Button>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            Voice AI Enabled
                          </span>
                          <ToggleSwitch
                            enabled={edit.voice_ai_enabled}
                            onChange={(val) =>
                              setPlanEdits((prev) => ({
                                ...prev,
                                [plan.id]: { ...prev[plan.id], voice_ai_enabled: val },
                              }))
                            }
                            disabled={isSaving}
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                            Minutes Included
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={edit.voice_ai_minutes_included}
                            onChange={(e) =>
                              setPlanEdits((prev) => ({
                                ...prev,
                                [plan.id]: {
                                  ...prev[plan.id],
                                  voice_ai_minutes_included: Number(e.target.value),
                                },
                              }))
                            }
                            disabled={isSaving}
                            className={inputClass}
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                            Overage Rate ($/min) — leave blank to block
                          </label>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder="Leave blank to block when over"
                            value={edit.voice_ai_overage_rate}
                            onChange={(e) =>
                              setPlanEdits((prev) => ({
                                ...prev,
                                [plan.id]: {
                                  ...prev[plan.id],
                                  voice_ai_overage_rate: e.target.value,
                                },
                              }))
                            }
                            disabled={isSaving}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        </div>
      )}

      {/* ── Override Modal ───────────────────────────────────────────────────── */}
      <Modal
        isOpen={overrideModalOpen}
        onClose={() => !overrideSaving && setOverrideModalOpen(false)}
        title={
          <span>
            Voice AI Override —{' '}
            <span className="text-blue-600 dark:text-blue-400">
              {overrideTenant?.company_name}
            </span>
          </span>
        }
        size="lg"
      >
        <ModalContent>
          <div className="space-y-5">
            {/* Force Enable */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Force Enable
              </label>
              <select
                value={overrideForm.force_enabled}
                onChange={(e) =>
                  setOverrideForm((f) => ({
                    ...f,
                    force_enabled: e.target.value as OverrideFormState['force_enabled'],
                  }))
                }
                disabled={overrideSaving}
                className={selectClass}
              >
                <option value="">Plan Default (no override)</option>
                <option value="true">Force Enabled</option>
                <option value="false">Force Disabled</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Overrides the plan-level voice AI setting for this tenant.
              </p>
            </div>

            {/* Warning: force-enabling a non-voice-plan tenant requires a minutes override */}
            {overrideForm.force_enabled === 'true' &&
              overrideTenant?.voice_ai_included_in_plan === false && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20 p-3 flex gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 leading-relaxed">
                    This tenant's plan does not include Voice AI. You{' '}
                    <strong className="font-semibold">must</strong> set a Monthly Minutes
                    Override below — otherwise the tenant will be force-enabled but have{' '}
                    <strong className="font-semibold">0 minutes</strong> and cannot make any
                    calls.
                  </p>
                </div>
              )}

            {/* Monthly Minutes Override */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Monthly Minutes Override
              </label>
              <input
                type="number"
                min={0}
                placeholder="Leave blank to use plan default"
                value={overrideForm.monthly_minutes_override}
                onChange={(e) =>
                  setOverrideForm((f) => ({ ...f, monthly_minutes_override: e.target.value }))
                }
                disabled={overrideSaving}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Custom minute limit for this tenant. Leave blank to inherit from plan.
              </p>
            </div>

            {/* Provider Overrides */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* STT */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  STT Provider Override
                </label>
                <select
                  value={overrideForm.stt_provider_override_id}
                  onChange={(e) =>
                    setOverrideForm((f) => ({ ...f, stt_provider_override_id: e.target.value }))
                  }
                  disabled={overrideSaving}
                  className={selectClass}
                >
                  <option value="">Global Default</option>
                  {sttProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* LLM */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  LLM Provider Override
                </label>
                <select
                  value={overrideForm.llm_provider_override_id}
                  onChange={(e) =>
                    setOverrideForm((f) => ({ ...f, llm_provider_override_id: e.target.value }))
                  }
                  disabled={overrideSaving}
                  className={selectClass}
                >
                  <option value="">Global Default</option>
                  {llmProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* TTS */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  TTS Provider Override
                </label>
                <select
                  value={overrideForm.tts_provider_override_id}
                  onChange={(e) =>
                    setOverrideForm((f) => ({ ...f, tts_provider_override_id: e.target.value }))
                  }
                  disabled={overrideSaving}
                  className={selectClass}
                >
                  <option value="">Global Default</option>
                  {ttsProviders.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Admin Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Admin Notes
              </label>
              <textarea
                rows={3}
                placeholder="Optional internal notes for this override..."
                value={overrideForm.admin_notes}
                onChange={(e) => setOverrideForm((f) => ({ ...f, admin_notes: e.target.value }))}
                disabled={overrideSaving}
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>
        </ModalContent>
        <ModalActions>
          <Button
            variant="secondary"
            onClick={() => setOverrideModalOpen(false)}
            disabled={overrideSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleOverrideSave} loading={overrideSaving} disabled={overrideSaving}>
            Save Override
          </Button>
        </ModalActions>
      </Modal>

      {/* ── Error Modal ──────────────────────────────────────────────────────── */}
      <ErrorModal
        isOpen={errorModal.open}
        onClose={() => setErrorModal((s) => ({ ...s, open: false }))}
        title={errorModal.title}
        message={errorModal.message}
      />
    </div>
  );
}
