/**
 * AI Providers Admin Page
 * Sprint FSA01 — Voice AI Admin
 * Route: /admin/voice-ai/providers
 *
 * Manage the AI provider catalog (Deepgram, OpenAI, Cartesia, etc.)
 * Features: List, search, filter by type, sort by column, create, edit, toggle, delete.
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Pencil, Trash2, Cpu, ChevronUp, ChevronDown, ChevronsUpDown, Search, X, DollarSign } from 'lucide-react';
import {
  getVoiceAiProviders,
  createVoiceAiProvider,
  updateVoiceAiProvider,
  deleteVoiceAiProvider,
} from '@/lib/api/voice-ai-admin';
import type { VoiceAiProvider, CreateProviderRequest } from '@/lib/types/voice-ai-admin';
import { Badge } from '@/components/ui/Badge';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { Modal } from '@/components/ui/Modal';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { ErrorModal } from '@/components/ui/ErrorModal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';

// ─── Zod schema ─────────────────────────────────────────────────────────────

const providerSchema = z.object({
  provider_key: z
    .string()
    .min(2, 'Min 2 characters')
    .max(50, 'Max 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Only lowercase letters, digits, and hyphens'),
  provider_type: z.enum(['STT', 'LLM', 'TTS'], {
    message: 'Select a valid type',
  }),
  display_name: z
    .string()
    .min(2, 'Min 2 characters')
    .max(100, 'Max 100 characters'),
  description: z.string().optional(),
  is_active: z.boolean(),
  cost_per_unit: z.number().positive('Must be a positive number').nullable().optional(),
  cost_unit: z.enum(['per_second', 'per_token', 'per_character']).nullable().optional(),
}).refine(
  (data) => {
    const hasCost = data.cost_per_unit != null && data.cost_per_unit !== undefined;
    const hasUnit = data.cost_unit != null && data.cost_unit !== undefined;
    return hasCost === hasUnit;
  },
  { message: 'Cost per unit and billing unit must both be set or both left empty', path: ['cost_unit'] }
);

type ProviderFormValues = z.infer<typeof providerSchema>;

// ─── Badge variant mapping ───────────────────────────────────────────────────

const TYPE_BADGE_VARIANT = {
  STT: 'blue',
  LLM: 'green',
  TTS: 'purple',
} as const satisfies Record<string, 'blue' | 'green' | 'purple'>;

const TYPE_LABEL: Record<string, string> = {
  STT: 'Speech-to-Text',
  LLM: 'Language Model',
  TTS: 'Text-to-Speech',
};

// ─── Cost formatting ─────────────────────────────────────────────────────────

const COST_UNIT_LABEL: Record<string, string> = {
  per_second: '/ sec',
  per_token: '/ token',
  per_character: '/ char',
};

function formatCost(cost: string | number | null, unit: string | null): string | null {
  if (cost == null) return null;
  const n = Number(cost);
  if (isNaN(n)) return null;
  // Use up to 8 significant digits, strip trailing zeros after decimal
  const formatted = n.toFixed(8).replace(/\.?0+$/, '');
  const unitLabel = unit ? COST_UNIT_LABEL[unit] ?? `/ ${unit}` : '';
  return `$${formatted}${unitLabel ? ` ${unitLabel}` : ''}`;
}

// ─── Sort types ──────────────────────────────────────────────────────────────

type SortField = 'display_name' | 'provider_type' | 'is_active';
type SortDir = 'asc' | 'desc';

// ─── Page component ──────────────────────────────────────────────────────────

export default function VoiceAiProvidersPage() {
  const [providers, setProviders] = useState<VoiceAiProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<VoiceAiProvider | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<VoiceAiProvider | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Filter / sort state ────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'STT' | 'LLM' | 'TTS'>('all');
  const [sortField, setSortField] = useState<SortField>('display_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchProviders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getVoiceAiProviders();
      setProviders(data);
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message ?? 'Failed to load providers';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // ── Derived: filtered + sorted list ───────────────────────────────────────

  const filteredProviders = useMemo(() => {
    const q = search.trim().toLowerCase();

    let list = providers.filter((p) => {
      if (typeFilter !== 'all' && p.provider_type !== typeFilter) return false;
      if (q) {
        return (
          p.display_name.toLowerCase().includes(q) ||
          p.provider_key.toLowerCase().includes(q) ||
          (p.description ?? '').toLowerCase().includes(q)
        );
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'display_name') {
        cmp = a.display_name.localeCompare(b.display_name);
      } else if (sortField === 'provider_type') {
        cmp = a.provider_type.localeCompare(b.provider_type);
      } else if (sortField === 'is_active') {
        // active first when asc
        cmp = Number(b.is_active) - Number(a.is_active);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [providers, search, typeFilter, sortField, sortDir]);

  const hasActiveFilters = search.trim() !== '' || typeFilter !== 'all';

  // ── Column sort handler ────────────────────────────────────────────────────

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // ── Toggle status inline ───────────────────────────────────────────────────

  const handleToggle = async (provider: VoiceAiProvider) => {
    if (toggleLoadingId) return;
    setToggleLoadingId(provider.id);
    try {
      const updated = await updateVoiceAiProvider(provider.id, {
        is_active: !provider.is_active,
      });
      setProviders((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message ?? 'Failed to update status';
      setError(message);
    } finally {
      setToggleLoadingId(null);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deletingProvider) return;
    setDeleteLoading(true);
    try {
      await deleteVoiceAiProvider(deletingProvider.id);
      setProviders((prev) => prev.filter((p) => p.id !== deletingProvider.id));
      setDeletingProvider(null);
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message ?? 'Failed to delete provider';
      setError(message);
      setDeletingProvider(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Open edit modal ────────────────────────────────────────────────────────

  const handleEdit = (provider: VoiceAiProvider) => {
    setEditingProvider(provider);
  };

  const handleModalClose = () => {
    setShowCreateModal(false);
    setEditingProvider(null);
  };

  const handleSaved = (saved: VoiceAiProvider) => {
    setProviders((prev) => {
      const exists = prev.find((p) => p.id === saved.id);
      if (exists) {
        return prev.map((p) => (p.id === saved.id ? saved : p));
      }
      return [saved, ...prev];
    });
    handleModalClose();
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Providers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage the AI provider catalog (STT, LLM, TTS)
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Provider
        </Button>
      </div>

      {/* Toolbar */}
      {!loading && providers.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or key…"
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

          {/* Vertical divider — desktop only */}
          <div className="hidden sm:block w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

          {/* Type filter — native select, same height as search */}
          <div className="relative shrink-0">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
              className="h-9 pl-3 pr-8 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none cursor-pointer transition-shadow"
            >
              <option value="all">All Types</option>
              <option value="STT">STT — Speech-to-Text</option>
              <option value="LLM">LLM — Language Model</option>
              <option value="TTS">TTS — Text-to-Speech</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>

          {/* Vertical divider — desktop only */}
          <div className="hidden sm:block w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

          {/* Result count */}
          <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap shrink-0">
            {filteredProviders.length === providers.length
              ? `${providers.length} provider${providers.length !== 1 ? 's' : ''}`
              : `${filteredProviders.length} of ${providers.length}`}
          </span>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={() => { setSearch(''); setTypeFilter('all'); }}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 whitespace-nowrap shrink-0 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-16">
          <LoadingSpinner />
        </div>
      ) : providers.length === 0 ? (
        /* Empty state — no providers at all */
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          <Cpu className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            No providers configured
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
            Add your first provider to get started.
          </p>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Provider
          </Button>
        </div>
      ) : filteredProviders.length === 0 ? (
        /* Empty state — providers exist but filter returns nothing */
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            No providers match your filters
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
            Try adjusting the search or type filter.
          </p>
          <Button variant="ghost" onClick={() => { setSearch(''); setTypeFilter('all'); }}>
            Clear filters
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  <SortableHeader
                    label="Name"
                    field="display_name"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                    className="pl-6"
                  />
                  <SortableHeader
                    label="Type"
                    field="provider_type"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Provider Key
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Unit Cost
                  </th>
                  <SortableHeader
                    label="Status"
                    field="is_active"
                    current={sortField}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredProviders.map((provider) => (
                  <ProviderTableRow
                    key={provider.id}
                    provider={provider}
                    toggleLoading={toggleLoadingId === provider.id}
                    onToggle={() => handleToggle(provider)}
                    onEdit={() => handleEdit(provider)}
                    onDelete={() => setDeletingProvider(provider)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredProviders.map((provider) => (
              <ProviderMobileCard
                key={provider.id}
                provider={provider}
                toggleLoading={toggleLoadingId === provider.id}
                onToggle={() => handleToggle(provider)}
                onEdit={() => handleEdit(provider)}
                onDelete={() => setDeletingProvider(provider)}
              />
            ))}
          </div>
        </>
      )}

      {/* Create / Edit modal */}
      {(showCreateModal || editingProvider) && (
        <ProviderFormModal
          provider={editingProvider}
          onClose={handleModalClose}
          onSaved={handleSaved}
          onError={setError}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={!!deletingProvider}
        onClose={() => setDeletingProvider(null)}
        onConfirm={handleDelete}
        title="Delete Provider"
        message={`Are you sure you want to delete "${deletingProvider?.display_name}"? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={deleteLoading}
      />

      {/* Error modal */}
      <ErrorModal
        isOpen={!!error}
        onClose={() => setError(null)}
        title="Error"
        message={error ?? ''}
      />
    </div>
  );
}

// ─── Sortable column header ───────────────────────────────────────────────────

interface SortableHeaderProps {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (field: SortField) => void;
  className?: string;
}

function SortableHeader({ label, field, current, dir, onSort, className }: SortableHeaderProps) {
  const isActive = current === field;
  return (
    <th
      className={`px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ${className ?? ''}`}
    >
      <button
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 group hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
      >
        {label}
        <span className="text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400">
          {isActive ? (
            dir === 'asc' ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )
          ) : (
            <ChevronsUpDown className="w-3.5 h-3.5" />
          )}
        </span>
      </button>
    </th>
  );
}

// ─── Table row (desktop) ─────────────────────────────────────────────────────

interface ProviderRowProps {
  provider: VoiceAiProvider;
  toggleLoading: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ProviderTableRow({
  provider,
  toggleLoading,
  onToggle,
  onEdit,
  onDelete,
}: ProviderRowProps) {
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
      {/* Name */}
      <td className="px-6 py-4">
        <div className="font-medium text-gray-900 dark:text-gray-100">
          {provider.display_name}
        </div>
        {provider.description && (
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs">
            {provider.description}
          </div>
        )}
      </td>

      {/* Type badge */}
      <td className="px-6 py-4">
        <Badge variant={TYPE_BADGE_VARIANT[provider.provider_type] ?? 'neutral'}>
          {provider.provider_type}
        </Badge>
      </td>

      {/* Provider key */}
      <td className="px-6 py-4">
        <span className="font-mono text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
          {provider.provider_key}
        </span>
      </td>

      {/* Unit cost */}
      <td className="px-6 py-4">
        {(() => {
          const display = formatCost(provider.cost_per_unit, provider.cost_unit);
          return display ? (
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="font-mono text-sm text-gray-800 dark:text-gray-200">
                {display.replace('$', '')}
              </span>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-2 py-0.5 rounded-full font-medium">
              Not set
            </span>
          );
        })()}
      </td>

      {/* Status toggle */}
      <td className="px-6 py-4">
        <ToggleSwitch
          enabled={provider.is_active}
          onChange={onToggle}
          disabled={toggleLoading}
        />
      </td>

      {/* Actions */}
      <td className="px-6 py-4">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onEdit}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            title="Edit provider"
            aria-label={`Edit ${provider.display_name}`}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title="Delete provider"
            aria-label={`Delete ${provider.display_name}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Mobile card ─────────────────────────────────────────────────────────────

function ProviderMobileCard({
  provider,
  toggleLoading,
  onToggle,
  onEdit,
  onDelete,
}: ProviderRowProps) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">
            {provider.display_name}
          </div>
          <div className="font-mono text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {provider.provider_key}
          </div>
        </div>
        <Badge variant={TYPE_BADGE_VARIANT[provider.provider_type] ?? 'neutral'}>
          {provider.provider_type}
        </Badge>
      </div>

      {/* Description */}
      {provider.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
          {provider.description}
        </p>
      )}

      {/* Unit cost */}
      {(() => {
        const display = formatCost(provider.cost_per_unit, provider.cost_unit);
        return (
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Unit Cost</span>
            {display ? (
              <div className="flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-emerald-500" />
                <span className="font-mono text-gray-800 dark:text-gray-200">
                  {display.replace('$', '')}
                </span>
              </div>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-2 py-0.5 rounded-full font-medium">
                Not set
              </span>
            )}
          </div>
        );
      })()}

      {/* Footer row */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
        <ToggleSwitch
          enabled={provider.is_active}
          onChange={onToggle}
          disabled={toggleLoading}
          label={provider.is_active ? 'Active' : 'Inactive'}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-blue-600 transition-colors"
            aria-label={`Edit ${provider.display_name}`}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-red-600 transition-colors"
            aria-label={`Delete ${provider.display_name}`}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create / Edit form modal ────────────────────────────────────────────────

interface ProviderFormModalProps {
  provider: VoiceAiProvider | null;
  onClose: () => void;
  onSaved: (provider: VoiceAiProvider) => void;
  onError: (message: string) => void;
}

function ProviderFormModal({ provider, onClose, onSaved, onError }: ProviderFormModalProps) {
  const isEditing = provider !== null;
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProviderFormValues>({
    resolver: zodResolver(providerSchema),
    defaultValues: {
      provider_key: provider?.provider_key ?? '',
      provider_type: provider?.provider_type ?? 'STT',
      display_name: provider?.display_name ?? '',
      description: provider?.description ?? '',
      is_active: provider?.is_active ?? true,
      cost_per_unit: provider?.cost_per_unit != null ? Number(provider.cost_per_unit) : undefined,
      cost_unit: provider?.cost_unit ?? undefined,
    },
  });

  const isActive = watch('is_active');
  const providerType = watch('provider_type');

  const onSubmit = async (values: ProviderFormValues) => {
    setSubmitting(true);
    try {
      const dto: CreateProviderRequest = {
        provider_key: values.provider_key,
        provider_type: values.provider_type,
        display_name: values.display_name,
        description: values.description || undefined,
        is_active: values.is_active,
        cost_per_unit: values.cost_per_unit ?? undefined,
        cost_unit: values.cost_unit ?? undefined,
      };

      let result: VoiceAiProvider;
      if (isEditing) {
        // provider_key is immutable — only send mutable fields on update
        result = await updateVoiceAiProvider(provider.id, {
          provider_type: dto.provider_type,
          display_name: dto.display_name,
          description: dto.description,
          is_active: dto.is_active,
          cost_per_unit: dto.cost_per_unit,
          cost_unit: dto.cost_unit,
        });
      } else {
        result = await createVoiceAiProvider(dto);
      }

      onSaved(result);
    } catch (err: unknown) {
      const errObj = err as { status?: number; message?: string };
      if (errObj?.status === 409) {
        onError('Provider key already exists. Choose a unique key.');
      } else {
        onError(errObj?.message ?? 'Failed to save provider');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const typeOptions = [
    { value: 'STT', label: `STT — ${TYPE_LABEL.STT}` },
    { value: 'LLM', label: `LLM — ${TYPE_LABEL.LLM}` },
    { value: 'TTS', label: `TTS — ${TYPE_LABEL.TTS}` },
  ];

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEditing ? `Edit Provider — ${provider.display_name}` : 'Add AI Provider'}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {/* Provider Key */}
        <Input
          id="provider_key"
          label="Provider Key"
          placeholder="e.g. deepgram, openai, cartesia"
          required
          disabled={isEditing}
          error={errors.provider_key?.message}
          {...register('provider_key')}
        />

        {/* Provider Type */}
        <div>
          <Select
            label="Provider Type"
            required
            options={typeOptions}
            value={providerType}
            onChange={(val) => setValue('provider_type', val as 'STT' | 'LLM' | 'TTS')}
            error={errors.provider_type?.message}
            disabled={isEditing}
          />
        </div>

        {/* Display Name */}
        <Input
          id="display_name"
          label="Display Name"
          placeholder="e.g. Deepgram"
          required
          error={errors.display_name?.message}
          {...register('display_name')}
        />

        {/* Description */}
        <Textarea
          id="description"
          label="Description"
          placeholder="Optional description of what this provider does"
          rows={3}
          resize="none"
          error={errors.description?.message}
          {...register('description')}
        />

        {/* Active toggle */}
        <div className="flex items-center justify-between py-3 border-t border-gray-200 dark:border-gray-700">
          <div>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Active
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Inactive providers are hidden from the agent context
            </p>
          </div>
          <ToggleSwitch
            enabled={isActive}
            onChange={(val) => setValue('is_active', val)}
          />
        </div>

        {/* Pricing Section */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Provider Pricing
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
            Used to calculate estimated infrastructure cost per call. Update when provider changes their rates.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Cost per unit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cost per Unit (USD)
              </label>
              <input
                type="number"
                step="0.00000001"
                min="0"
                placeholder="e.g. 0.0000716"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                {...register('cost_per_unit', { valueAsNumber: true })}
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {providerType === 'STT' && 'Cost per second of audio processed'}
                {providerType === 'LLM' && 'Cost per token (average of input + output rates)'}
                {providerType === 'TTS' && 'Cost per character synthesized'}
              </p>
              {errors.cost_per_unit && (
                <p className="text-xs text-red-500 mt-1">{errors.cost_per_unit.message}</p>
              )}
            </div>

            {/* Billing unit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Billing Unit
              </label>
              <select
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                {...register('cost_unit')}
              >
                <option value="">— Select unit —</option>
                <option value="per_second">Per Second (STT audio)</option>
                <option value="per_token">Per Token (LLM)</option>
                <option value="per_character">Per Character (TTS)</option>
              </select>
              {errors.cost_unit && (
                <p className="text-xs text-red-500 mt-1">{errors.cost_unit.message}</p>
              )}
            </div>
          </div>

          {/* Current rate hint when editing */}
          {provider?.cost_per_unit != null && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              Current rate: ${Number(provider.cost_per_unit).toFixed(8)} {provider.cost_unit}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Create Provider'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
